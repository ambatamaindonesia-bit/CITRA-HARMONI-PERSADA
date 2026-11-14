// Unique ID per browser tab/session to distinguish remote updates from local echoes
export const CLIENT_TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export interface LiveOnlineUser {
  userId: string;
  userName: string;
  userRole: string;
  connections: number;
}

export interface LiveKeyRecord<T = unknown> {
  payload: T;
  updatedAt: string;
  updatedBy?: string;
  updatedByUserId?: string;
  updatedByClientId?: string;
  lastAction?: string;
  actionDetail?: string;
  version: number;
}

export interface LiveServerStateResponse {
  ok: boolean;
  liveSyncAllowed: boolean;
  reason?: string;
  serverTime: string;
  versionCounter: number;
  keys: Record<string, LiveKeyRecord>;
  onlineUsers: LiveOnlineUser[];
}

export interface LiveConnectionState {
  connected: boolean;
  lastEventAt?: string;
  lastError?: string;
  onlineUsers: LiveOnlineUser[];
  onlineClientsCount: number;
}

let liveConnectionState: LiveConnectionState = {
  connected: false,
  onlineUsers: [],
  onlineClientsCount: 0,
};

const liveStateListeners = new Set<(state: LiveConnectionState) => void>();

function updateLiveConnectionState(patch: Partial<LiveConnectionState>) {
  liveConnectionState = {
    ...liveConnectionState,
    ...patch,
  };
  liveStateListeners.forEach((cb) => {
    try {
      cb(liveConnectionState);
    } catch {
      // ignore listener errors
    }
  });
}

export function getLiveConnectionState(): LiveConnectionState {
  return liveConnectionState;
}

export function subscribeLiveConnectionState(
  listener: (state: LiveConnectionState) => void
): () => void {
  liveStateListeners.add(listener);
  listener(liveConnectionState);
  return () => {
    liveStateListeners.delete(listener);
  };
}

export async function fetchAllLiveState(userId?: string): Promise<LiveServerStateResponse | null> {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`/api/live/state${query}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as LiveServerStateResponse;
    updateLiveConnectionState({
      connected: true,
      lastEventAt: data.serverTime || new Date().toISOString(),
      onlineUsers: Array.isArray(data.onlineUsers) ? data.onlineUsers : [],
    });
    return data;
  } catch (err: any) {
    updateLiveConnectionState({
      lastError: err?.message || 'Live server unavailable',
    });
    return null;
  }
}

export async function fetchLiveKey<T>(
  key: string,
  userId?: string
): Promise<{ exists: boolean; record?: LiveKeyRecord<T>; error?: string }> {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`/api/live/state/${encodeURIComponent(key)}${query}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      return { exists: false, error: body?.error || 'LIVE_SYNC_DISABLED_BY_ADMIN' };
    }
    if (!res.ok) return { exists: false };
    const data = await res.json();
    if (!data?.exists) return { exists: false };
    return {
      exists: true,
      record: {
        payload: data.payload as T,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
        updatedByUserId: data.updatedByUserId,
        updatedByClientId: data.updatedByClientId,
        lastAction: data.lastAction,
        actionDetail: data.actionDetail,
        version: data.version,
      },
    };
  } catch {
    return { exists: false };
  }
}

export async function pushLiveKey<T>(
  key: string,
  payload: T,
  meta?: {
    updatedBy?: string;
    updatedByUserId?: string;
    lastAction?: string;
    actionDetail?: string;
  }
): Promise<{ ok: boolean; error?: string; message?: string }> {
  try {
    const res = await fetch(`/api/live/state/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload,
        updatedBy: meta?.updatedBy,
        updatedByUserId: meta?.updatedByUserId,
        updatedByClientId: CLIENT_TAB_ID,
        lastAction: meta?.lastAction,
        actionDetail: meta?.actionDetail,
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: body?.error || `HTTP_${res.status}`,
        message: body?.message,
      };
    }

    updateLiveConnectionState({
      connected: true,
      lastEventAt: body?.updatedAt || new Date().toISOString(),
      lastError: undefined,
    });
    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: err?.message,
    };
  }
}

export async function bootstrapLiveServer(
  datasets: Record<string, unknown>,
  meta?: {
    overwrite?: boolean;
    updatedBy?: string;
    updatedByUserId?: string;
    actionDetail?: string;
  }
): Promise<{ ok: boolean; updatedKeys: string[]; error?: string }> {
  try {
    const res = await fetch('/api/live/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        datasets,
        overwrite: Boolean(meta?.overwrite),
        updatedBy: meta?.updatedBy,
        updatedByUserId: meta?.updatedByUserId,
        updatedByClientId: CLIENT_TAB_ID,
        actionDetail: meta?.actionDetail,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, updatedKeys: [], error: body?.error || `HTTP_${res.status}` };
    }
    updateLiveConnectionState({
      connected: true,
      lastEventAt: body?.updatedAt || new Date().toISOString(),
      lastError: undefined,
    });
    return { ok: true, updatedKeys: Array.isArray(body?.updatedKeys) ? body.updatedKeys : [] };
  } catch (err: any) {
    return { ok: false, updatedKeys: [], error: err?.message || 'NETWORK_ERROR' };
  }
}

export async function reportLivePresence(
  user: { id: string; name: string; role: string } | null
): Promise<void> {
  try {
    const res = await fetch('/api/live/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: CLIENT_TAB_ID,
        userId: user?.id || null,
        userName: user?.name || null,
        userRole: user?.role || null,
      }),
    });
    if (res.ok) {
      const body = await res.json().catch(() => null);
      if (body && Array.isArray(body.onlineUsers)) {
        updateLiveConnectionState({
          connected: true,
          onlineUsers: body.onlineUsers,
          onlineClientsCount: body.onlineClientsCount ?? body.onlineUsers.length,
        });
      }
    }
  } catch {
    // ignore background presence errors
  }
}

export function connectLiveEventStream(
  user: { id?: string; name?: string; role?: string } | null,
  handlers: {
    onKeyUpdated: (key: string, record: LiveKeyRecord) => void;
    onPresenceUpdate?: (onlineUsers: LiveOnlineUser[]) => void;
    onReconnect?: () => void;
  }
): () => void {
  if (typeof EventSource === 'undefined') {
    return () => {};
  }

  const params = new URLSearchParams({ clientId: CLIENT_TAB_ID });
  if (user?.id) params.set('userId', user.id);
  if (user?.name) params.set('userName', user.name);
  if (user?.role) params.set('userRole', user.role);

  let hasOpenedOnce = false;
  const es = new EventSource(`/api/live/events?${params.toString()}`);

  es.addEventListener('CONNECTED', (evt) => {
    try {
      const data = JSON.parse((evt as MessageEvent).data || '{}');
      updateLiveConnectionState({
        connected: true,
        lastEventAt: data.serverTime || new Date().toISOString(),
        lastError: undefined,
        onlineUsers: Array.isArray(data.onlineUsers) ? data.onlineUsers : liveConnectionState.onlineUsers,
      });
      if (hasOpenedOnce && handlers.onReconnect) {
        handlers.onReconnect();
      }
      hasOpenedOnce = true;
    } catch {
      updateLiveConnectionState({ connected: true });
    }
  });

  es.addEventListener('KEY_UPDATED', (evt) => {
    try {
      const data = JSON.parse((evt as MessageEvent).data || '{}') as LiveKeyRecord & { key?: string };
      if (!data.key) return;
      updateLiveConnectionState({
        connected: true,
        lastEventAt: data.updatedAt || new Date().toISOString(),
      });
      handlers.onKeyUpdated(data.key, data);
    } catch (err) {
      console.warn('SSE KEY_UPDATED parse error:', err);
    }
  });

  es.addEventListener('PRESENCE_UPDATE', (evt) => {
    try {
      const data = JSON.parse((evt as MessageEvent).data || '{}');
      const onlineUsers = Array.isArray(data.onlineUsers) ? (data.onlineUsers as LiveOnlineUser[]) : [];
      updateLiveConnectionState({
        connected: true,
        onlineUsers,
        onlineClientsCount: typeof data.onlineClientsCount === 'number' ? data.onlineClientsCount : onlineUsers.length,
      });
      if (handlers.onPresenceUpdate) {
        handlers.onPresenceUpdate(onlineUsers);
      }
    } catch {
      // ignore
    }
  });

  es.onerror = () => {
    updateLiveConnectionState({
      connected: false,
      lastError: 'Menghubungkan ulang ke Live Server...',
    });
  };

  return () => {
    es.close();
  };
}
