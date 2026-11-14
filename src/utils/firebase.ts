import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { saveToSupabase, loadFromSupabase, subscribeToSupabaseKey, isSupabaseConnected } from './supabase';
import {
  CLIENT_TAB_ID,
  fetchLiveKey,
  pushLiveKey,
  getLiveConnectionState,
  subscribeLiveConnectionState,
} from './liveSync';

export { CLIENT_TAB_ID };

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const dbId =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== ''
    ? firebaseConfig.firestoreDatabaseId
    : '(default)';

export const db = getFirestore(app, dbId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | null;
    email: string | null;
  };
}

export type CloudStatusType =
  | 'connecting'
  | 'connected'
  | 'paused-by-admin'
  | 'permission-denied'
  | 'quota-exceeded'
  | 'offline'
  | 'error';

export interface CloudStatusInfo {
  status: CloudStatusType;
  lastError?: string;
  lastSyncAt?: string;
  writeQuotaExceeded: boolean;
  readQuotaExceeded: boolean;
  liveServerConnected: boolean;
  onlineUsersCount: number;
  userLiveSyncEnabled: boolean;
}

export interface CloudSyncMeta {
  updatedAt?: string;
  updatedBy?: string;
  updatedByUserId?: string;
  updatedByClientId?: string;
  lastAction?: string;
  actionDetail?: string;
  hasPendingWrites?: boolean;
  fromCache?: boolean;
}

export interface CloudLoadResult<T> {
  data: T | null;
  existsInCloud: boolean;
  error?: string;
}

const MAX_SINGLE_DOC_CHARS = 700_000;
const CHUNK_CHAR_SIZE = 550_000;

let isFirebaseWriteQuotaExceeded = false;
let isFirebaseReadQuotaExceeded = false;
let currentUserLiveSyncAllowed = true;
let hasLoggedInUserContext = false;

let cloudStatusState: CloudStatusInfo = {
  status: 'connecting',
  writeQuotaExceeded: false,
  readQuotaExceeded: false,
  liveServerConnected: getLiveConnectionState().connected,
  onlineUsersCount: getLiveConnectionState().onlineUsers.length,
  userLiveSyncEnabled: true,
};

const statusListeners = new Set<(info: CloudStatusInfo) => void>();
const writeDebounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
let globalWriteQueue: Promise<void> = Promise.resolve();

function resolveEffectiveStatus(requested: CloudStatusType): CloudStatusType {
  if (hasLoggedInUserContext && !currentUserLiveSyncAllowed) {
    return 'paused-by-admin';
  }
  const liveConn = getLiveConnectionState();
  if (liveConn.connected || isSupabaseConnected()) {
    return 'connected';
  }
  return requested;
}

function updateCloudStatus(patch: Partial<CloudStatusInfo>) {
  const liveConn = getLiveConnectionState();
  const nextRawStatus = patch.status ?? cloudStatusState.status;
  const effectiveStatus = resolveEffectiveStatus(nextRawStatus);
  cloudStatusState = {
    ...cloudStatusState,
    ...patch,
    status: effectiveStatus,
    writeQuotaExceeded: isFirebaseWriteQuotaExceeded,
    readQuotaExceeded: isFirebaseReadQuotaExceeded,
    liveServerConnected: liveConn.connected,
    onlineUsersCount: liveConn.onlineUsers.length,
    userLiveSyncEnabled: currentUserLiveSyncAllowed,
  };
  statusListeners.forEach((cb) => {
    try {
      cb(cloudStatusState);
    } catch {
      // ignore listener error
    }
  });
}

subscribeLiveConnectionState((liveConn) => {
  updateCloudStatus({
    status: liveConn.connected ? 'connected' : cloudStatusState.status,
    liveServerConnected: liveConn.connected,
    onlineUsersCount: liveConn.onlineUsers.length,
    lastSyncAt: liveConn.lastEventAt || cloudStatusState.lastSyncAt,
    lastError:
      liveConn.connected && cloudStatusState.status === 'quota-exceeded'
        ? undefined
        : cloudStatusState.lastError,
  });
});

export function setUserLiveSyncPermission(hasUser: boolean, allowed: boolean) {
  hasLoggedInUserContext = hasUser;
  currentUserLiveSyncAllowed = allowed;
  updateCloudStatus({
    status: !hasUser || allowed ? (getLiveConnectionState().connected ? 'connected' : cloudStatusState.status) : 'paused-by-admin',
    lastError:
      hasUser && !allowed
        ? 'Sinkronisasi Live untuk akun ini sedang dinonaktifkan oleh Administrator.'
        : undefined,
  });
}

export function getCloudStatus(): CloudStatusInfo {
  return cloudStatusState;
}

export function subscribeCloudStatus(listener: (info: CloudStatusInfo) => void): () => void {
  statusListeners.add(listener);
  listener(cloudStatusState);
  return () => {
    statusListeners.delete(listener);
  };
}

export function checkIsFirebaseQuotaExceeded(): boolean {
  return isFirebaseWriteQuotaExceeded || isFirebaseReadQuotaExceeded;
}

function classifyFirestoreError(
  err: any,
  operationType: OperationType,
  path: string | null
): CloudStatusType {
  const errMsg = err?.message || String(err);
  const code = err?.code || '';

  if (
    code === 'resource-exhausted' ||
    errMsg.includes('Quota limit exceeded') ||
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('429')
  ) {
    if (operationType === OperationType.WRITE || operationType === OperationType.CREATE || operationType === OperationType.UPDATE || operationType === OperationType.DELETE) {
      isFirebaseWriteQuotaExceeded = true;
    } else {
      isFirebaseReadQuotaExceeded = true;
    }
    const liveReady = getLiveConnectionState().connected || isSupabaseConnected();
    updateCloudStatus({
      status: liveReady ? 'connected' : 'quota-exceeded',
      lastError: liveReady
        ? undefined
        : 'Batas kuota harian gratis Cloud Firestore tercapai. Kuota akan reset besok, atau hubungkan Supabase di menu Database & Sync.',
    });
    return 'quota-exceeded';
  }

  if (code === 'permission-denied' || errMsg.includes('Missing or insufficient permissions')) {
    const errInfo: FirestoreErrorInfo = {
      error: errMsg,
      operationType,
      path,
      authInfo: { userId: null, email: null },
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    const liveReady = getLiveConnectionState().connected;
    updateCloudStatus({
      status: liveReady ? 'connected' : 'permission-denied',
      lastError: liveReady ? undefined : `Akses database Firestore ditolak (${path || 'root'}).`,
    });
    return 'permission-denied';
  }

  if (code === 'unavailable' || errMsg.includes('the client is offline') || errMsg.includes('Failed to fetch')) {
    const liveReady = getLiveConnectionState().connected;
    updateCloudStatus({
      status: liveReady ? 'connected' : 'offline',
      lastError: liveReady ? undefined : 'Koneksi internet / server Firestore sedang offline.',
    });
    return 'offline';
  }

  const liveReady = getLiveConnectionState().connected;
  updateCloudStatus({
    status: liveReady ? 'connected' : 'error',
    lastError: liveReady ? undefined : errMsg,
  });
  return 'error';
}

// Validate initial Firestore connection on boot
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    updateCloudStatus({
      status: isFirebaseWriteQuotaExceeded && !getLiveConnectionState().connected ? 'quota-exceeded' : 'connected',
      lastSyncAt: new Date().toISOString(),
    });
  } catch (error: any) {
    const kind = classifyFirestoreError(error, OperationType.GET, 'test/connection');
    if (kind === 'offline') {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testFirestoreConnection();

// Helper function to recursively sanitize data (convert undefined properties)
function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  const cleanObj: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== undefined) {
      cleanObj[key] = sanitizeForFirestore(value);
    }
  }
  return cleanObj;
}

async function readChunkedPayload<T>(key: string, chunkCount: number, useServer = true): Promise<T | null> {
  const chunkPromises = Array.from({ length: chunkCount }, (_, idx) => {
    const chunkRef = doc(db, 'erp_data', `${key}__chunk_${idx}`);
    return useServer ? getDocFromServer(chunkRef) : getDoc(chunkRef);
  });
  const snaps = await Promise.all(chunkPromises);
  let combined = '';
  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i];
    if (!s.exists() || typeof s.data()?.chunkData !== 'string') {
      throw new Error(`Missing chunk ${i} for ${key}`);
    }
    combined += s.data().chunkData;
  }
  return JSON.parse(combined) as T;
}

async function writePayloadToFirestore(
  key: string,
  cleanData: any,
  metaFields: Record<string, string>
): Promise<void> {
  const serialized = JSON.stringify(cleanData);
  const docRef = doc(db, 'erp_data', key);

  if (serialized.length <= MAX_SINGLE_DOC_CHARS) {
    await setDoc(docRef, {
      payload: cleanData,
      ...metaFields,
    });
    return;
  }

  // Split large payloads (e.g., multiple base64 photos) into chunks under Firestore's 1MB doc limit
  const totalLength = serialized.length;
  const chunkCount = Math.ceil(totalLength / CHUNK_CHAR_SIZE);
  const chunkWrites: Promise<void>[] = [];

  for (let i = 0; i < chunkCount; i++) {
    const slice = serialized.slice(i * CHUNK_CHAR_SIZE, (i + 1) * CHUNK_CHAR_SIZE);
    const chunkRef = doc(db, 'erp_data', `${key}__chunk_${i}`);
    chunkWrites.push(
      setDoc(chunkRef, {
        chunkData: slice,
        chunkIndex: i,
        updatedAt: metaFields.updatedAt,
      })
    );
  }
  await Promise.all(chunkWrites);

  await setDoc(docRef, {
    isChunked: true,
    chunkCount,
    totalLength,
    ...metaFields,
  });

  // Clean up one trailing stale chunk if payload shrank
  try {
    await deleteDoc(doc(db, 'erp_data', `${key}__chunk_${chunkCount}`));
  } catch {
    // ignore if doesn't exist
  }
}

export async function saveToCloud<T>(
  key: string,
  data: T,
  immediate = false,
  meta?: { updatedBy?: string; updatedByUserId?: string; lastAction?: string; actionDetail?: string }
): Promise<void> {
  const executeSave = () => {
    const nextTask = globalWriteQueue
      .catch(() => undefined)
      .then(async () => {
        const updatedAt = new Date().toISOString();
        const metaFields: Record<string, string> = {
          updatedAt,
          updatedByClientId: CLIENT_TAB_ID,
        };
        if (meta?.updatedBy) metaFields.updatedBy = String(meta.updatedBy).slice(0, 200);
        if (meta?.lastAction) metaFields.lastAction = String(meta.lastAction).slice(0, 128);
        if (meta?.actionDetail) metaFields.actionDetail = String(meta.actionDetail).slice(0, 500);

        // 0. Always push immediately to ERP Live Sync Server (real-time SSE across devices)
        const liveRes = await pushLiveKey(key, data, {
          updatedBy: meta?.updatedBy,
          updatedByUserId: meta?.updatedByUserId,
          lastAction: meta?.lastAction,
          actionDetail: meta?.actionDetail,
        });
        if (liveRes.error === 'LIVE_SYNC_DISABLED_BY_ADMIN') {
          currentUserLiveSyncAllowed = false;
          updateCloudStatus({
            status: 'paused-by-admin',
            lastError: liveRes.message || 'Sinkronisasi Live untuk akun ini dinonaktifkan oleh Admin.',
          });
          return;
        }
        if (liveRes.ok) {
          updateCloudStatus({
            status: 'connected',
            lastError: undefined,
            lastSyncAt: updatedAt,
          });
        }

        // 1. Save to Firebase Firestore if write quota not exceeded
        if (!isFirebaseWriteQuotaExceeded) {
          try {
            const cleanData = sanitizeForFirestore(data);
            await writePayloadToFirestore(key, cleanData, metaFields);
            updateCloudStatus({
              status: 'connected',
              lastError: undefined,
              lastSyncAt: updatedAt,
            });
          } catch (err: any) {
            classifyFirestoreError(err, OperationType.WRITE, `erp_data/${key}`);
          }
        }

        // 2. Save to Supabase if connected
        if (isSupabaseConnected()) {
          try {
            const ok = await saveToSupabase(key, data);
            if (ok) {
              updateCloudStatus({
                status: 'connected',
                lastSyncAt: updatedAt,
              });
            }
          } catch (err) {
            console.warn(`Supabase save notice for key ${key}:`, err);
          }
        }
      });

    globalWriteQueue = nextTask;
    return nextTask;
  };

  if (immediate) {
    if (writeDebounceTimers[key]) {
      clearTimeout(writeDebounceTimers[key]);
      delete writeDebounceTimers[key];
    }
    return executeSave();
  }

  if (writeDebounceTimers[key]) {
    clearTimeout(writeDebounceTimers[key]);
  }

  return new Promise((resolve) => {
    writeDebounceTimers[key] = setTimeout(async () => {
      delete writeDebounceTimers[key];
      await executeSave();
      resolve();
    }, 300);
  });
}

export async function loadFromCloudWithStatus<T>(key: string, userId?: string): Promise<CloudLoadResult<T>> {
  let firestoreError: string | undefined;

  // 0. Try ERP Live Server first (always freshest across devices)
  const liveRes = await fetchLiveKey<T>(key, userId);
  if (liveRes.error === 'LIVE_SYNC_DISABLED_BY_ADMIN') {
    return { data: null, existsInCloud: false, error: liveRes.error };
  }
  if (liveRes.exists && liveRes.record && liveRes.record.payload !== undefined) {
    updateCloudStatus({
      status: 'connected',
      lastSyncAt: liveRes.record.updatedAt || new Date().toISOString(),
    });
    return { data: liveRes.record.payload, existsInCloud: true };
  }

  // 1. Try Firebase Firestore directly from server
  if (!isFirebaseReadQuotaExceeded) {
    try {
      const docRef = doc(db, 'erp_data', key);
      const snap = await getDocFromServer(docRef);
      if (snap.exists()) {
        const docData = snap.data();
        if (docData?.isChunked && typeof docData.chunkCount === 'number') {
          const reassembled = await readChunkedPayload<T>(key, docData.chunkCount, true);
          updateCloudStatus({
            status: 'connected',
            lastSyncAt: new Date().toISOString(),
          });
          return { data: reassembled, existsInCloud: true };
        }
        if (docData && docData.payload !== undefined) {
          updateCloudStatus({
            status: 'connected',
            lastSyncAt: new Date().toISOString(),
          });
          return { data: docData.payload as T, existsInCloud: true };
        }
      }
      // Document genuinely does not exist on server
      updateCloudStatus({
        status: getLiveConnectionState().connected ? 'connected' : isFirebaseWriteQuotaExceeded ? 'quota-exceeded' : 'connected',
      });
    } catch (serverErr: any) {
      // Fallback to cached getDoc if server unreachable
      try {
        const docRef = doc(db, 'erp_data', key);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const docData = snap.data();
          if (docData?.isChunked && typeof docData.chunkCount === 'number') {
            const reassembled = await readChunkedPayload<T>(key, docData.chunkCount, false);
            return { data: reassembled, existsInCloud: true };
          }
          if (docData && docData.payload !== undefined) {
            return { data: docData.payload as T, existsInCloud: true };
          }
        }
        // Check if original error was permission/offline/quota
        const kind = classifyFirestoreError(serverErr, OperationType.GET, `erp_data/${key}`);
        firestoreError = serverErr?.message || kind;
      } catch (cacheErr: any) {
        const kind = classifyFirestoreError(cacheErr, OperationType.GET, `erp_data/${key}`);
        firestoreError = cacheErr?.message || kind;
      }
    }
  } else {
    firestoreError = 'read-quota-exceeded';
  }

  // 2. Try Supabase as backup/dual load
  if (isSupabaseConnected()) {
    try {
      const supabaseData = await loadFromSupabase<T>(key);
      if (supabaseData !== null && supabaseData !== undefined) {
        return { data: supabaseData, existsInCloud: true };
      }
    } catch (err: any) {
      console.warn(`Supabase load notice for key ${key}:`, err);
    }
  }

  return {
    data: null,
    existsInCloud: false,
    error: firestoreError,
  };
}

export async function loadFromCloud<T>(key: string): Promise<T | null> {
  const res = await loadFromCloudWithStatus<T>(key);
  return res.data;
}

export function subscribeToCloudKey<T>(
  key: string,
  callback: (data: T, meta?: CloudSyncMeta) => void
): () => void {
  let unsubFirebase = () => {};

  if (!isFirebaseReadQuotaExceeded) {
    try {
      const docRef = doc(db, 'erp_data', key);
      unsubFirebase = onSnapshot(
        docRef,
        async (snap) => {
          if (!snap.exists()) return;
          const docData = snap.data();
          if (!docData) return;

          const meta: CloudSyncMeta = {
            updatedAt: docData.updatedAt,
            updatedBy: docData.updatedBy,
            updatedByClientId: docData.updatedByClientId,
            lastAction: docData.lastAction,
            actionDetail: docData.actionDetail,
            hasPendingWrites: snap.metadata.hasPendingWrites,
            fromCache: snap.metadata.fromCache,
          };

          if (docData.isChunked && typeof docData.chunkCount === 'number') {
            try {
              const reassembled = await readChunkedPayload<T>(key, docData.chunkCount, !snap.metadata.fromCache);
              if (reassembled !== null) {
                updateCloudStatus({
                  status: isFirebaseWriteQuotaExceeded ? 'quota-exceeded' : 'connected',
                  lastSyncAt: new Date().toISOString(),
                });
                callback(reassembled, meta);
              }
            } catch (err) {
              console.warn(`Failed to reassemble chunked snapshot for ${key}:`, err);
            }
            return;
          }

          if (docData.payload !== undefined) {
            updateCloudStatus({
              status: isFirebaseWriteQuotaExceeded ? 'quota-exceeded' : 'connected',
              lastSyncAt: new Date().toISOString(),
            });
            callback(docData.payload as T, meta);
          }
        },
        (err) => {
          classifyFirestoreError(err, OperationType.GET, `erp_data/${key}`);
        }
      );
    } catch (err) {
      classifyFirestoreError(err, OperationType.GET, `erp_data/${key}`);
    }
  }

  let unsubSupabase = () => {};
  if (isSupabaseConnected()) {
    unsubSupabase = subscribeToSupabaseKey<T>(key, (data) =>
      callback(data, { updatedAt: new Date().toISOString() })
    );
  }

  return () => {
    unsubFirebase();
    unsubSupabase();
  };
}
