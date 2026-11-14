import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

interface StoredRecord {
  payload: unknown;
  updatedAt: string;
  updatedBy?: string;
  updatedByUserId?: string;
  updatedByClientId?: string;
  lastAction?: string;
  actionDetail?: string;
  version: number;
}

interface StoreFileShape {
  versionCounter: number;
  keys: Record<string, StoredRecord>;
}

interface OnlineClientInfo {
  clientId: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  connectedAt: string;
  lastSeenAt: string;
  res: Response;
}

const ALLOWED_KEYS = new Set<string>([
  'yp_erp_users',
  'yp_erp_projects',
  'yp_erp_units',
  'yp_erp_sales',
  'yp_erp_construction',
  'yp_erp_finances',
  'yp_erp_customers',
  'yp_erp_materials',
  'yp_erp_material_usages',
  'yp_erp_progress_docs',
  'yp_erp_attendance',
  'yp_erp_prospects',
  'yp_supabase_config',
]);

const DATA_DIR = path.join(process.cwd(), '.erp-live-data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

let storeState: StoreFileShape = {
  versionCounter: 0,
  keys: {},
};

let diskWriteQueue: Promise<void> = Promise.resolve();
const onlineClients = new Map<string, OnlineClientInfo>();

async function loadStoreFromDisk(): Promise<void> {
  try {
    if (!fsSync.existsSync(STORE_PATH)) {
      return;
    }
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw) as Partial<StoreFileShape>;
    if (parsed && typeof parsed.keys === 'object' && parsed.keys !== null) {
      const cleanKeys: Record<string, StoredRecord> = {};
      for (const [k, v] of Object.entries(parsed.keys)) {
        if (ALLOWED_KEYS.has(k) && v && typeof v === 'object' && 'payload' in v) {
          cleanKeys[k] = v as StoredRecord;
        }
      }
      storeState = {
        versionCounter: typeof parsed.versionCounter === 'number' ? parsed.versionCounter : 0,
        keys: cleanKeys,
      };
    }
  } catch (err) {
    console.warn('Could not load live store from disk, starting fresh:', err);
  }
}

function schedulePersistStore(): Promise<void> {
  const snapshot = JSON.stringify(storeState);
  diskWriteQueue = diskWriteQueue
    .catch(() => undefined)
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmpPath = `${STORE_PATH}.tmp`;
      await fs.writeFile(tmpPath, snapshot, 'utf8');
      await fs.rename(tmpPath, STORE_PATH);
    })
    .catch((err) => {
      console.error('Failed to persist live store to disk:', err);
    });
  return diskWriteQueue;
}

function getOnlineUsersSummary() {
  const uniqueUsers = new Map<string, { userId: string; userName: string; userRole: string; connections: number }>();
  for (const client of onlineClients.values()) {
    if (!client.userId) continue;
    const existing = uniqueUsers.get(client.userId);
    if (existing) {
      existing.connections += 1;
    } else {
      uniqueUsers.set(client.userId, {
        userId: client.userId,
        userName: client.userName || 'User',
        userRole: client.userRole || '',
        connections: 1,
      });
    }
  }
  return Array.from(uniqueUsers.values());
}

function broadcastSseEvent(eventName: string, data: unknown): void {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [clientId, client] of onlineClients.entries()) {
    try {
      client.res.write(frame);
    } catch {
      onlineClients.delete(clientId);
    }
  }
}

function checkUserLivePermission(userId?: string): { allowed: boolean; reason?: string } {
  if (!userId) return { allowed: true };
  const usersRec = storeState.keys['yp_erp_users'];
  if (!usersRec || !Array.isArray(usersRec.payload)) {
    return { allowed: true };
  }

  const matched = (usersRec.payload as Array<Record<string, unknown>>).find(
    (u) => u && String(u.id) === String(userId)
  );
  if (!matched) {
    return { allowed: true };
  }

  if (matched.status === 'Nonaktif') {
    return {
      allowed: false,
      reason: 'Akun pengguna berstatus Nonaktif oleh Administrator.',
    };
  }

  if (matched.liveSyncEnabled === false && matched.role !== 'Super Admin') {
    return {
      allowed: false,
      reason: 'Koneksi Live Sync belum diaktifkan Admin untuk akun ini.',
    };
  }

  return { allowed: true };
}

async function startServer() {
  await loadStoreFromDisk();

  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Health & status check
  app.get('/api/live/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      serverTime: new Date().toISOString(),
      versionCounter: storeState.versionCounter,
      keysStored: Object.keys(storeState.keys),
      onlineClientsCount: onlineClients.size,
      onlineUsers: getOnlineUsersSummary(),
    });
  });

  // SSE stream for real-time cross-device updates
  app.get('/api/live/events', (req: Request, res: Response) => {
    const clientId = String(req.query.clientId || `sse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    const userName = req.query.userName ? String(req.query.userName) : undefined;
    const userRole = req.query.userRole ? String(req.query.userRole) : undefined;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const nowIso = new Date().toISOString();
    onlineClients.set(clientId, {
      clientId,
      userId,
      userName,
      userRole,
      connectedAt: nowIso,
      lastSeenAt: nowIso,
      res,
    });

    res.write(
      `event: CONNECTED\ndata: ${JSON.stringify({
        clientId,
        serverTime: nowIso,
        versionCounter: storeState.versionCounter,
        onlineUsers: getOnlineUsersSummary(),
      })}\n\n`
    );

    broadcastSseEvent('PRESENCE_UPDATE', {
      onlineUsers: getOnlineUsersSummary(),
      onlineClientsCount: onlineClients.size,
    });

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
        const entry = onlineClients.get(clientId);
        if (entry) {
          entry.lastSeenAt = new Date().toISOString();
        }
      } catch {
        clearInterval(heartbeat);
        onlineClients.delete(clientId);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      onlineClients.delete(clientId);
      broadcastSseEvent('PRESENCE_UPDATE', {
        onlineUsers: getOnlineUsersSummary(),
        onlineClientsCount: onlineClients.size,
      });
    });
  });

  // Update active user presence for an existing SSE client
  app.post('/api/live/presence', (req: Request, res: Response) => {
    const { clientId, userId, userName, userRole } = req.body || {};
    if (typeof clientId === 'string' && onlineClients.has(clientId)) {
      const existing = onlineClients.get(clientId)!;
      existing.userId = userId ? String(userId) : undefined;
      existing.userName = userName ? String(userName) : undefined;
      existing.userRole = userRole ? String(userRole) : undefined;
      existing.lastSeenAt = new Date().toISOString();
      broadcastSseEvent('PRESENCE_UPDATE', {
        onlineUsers: getOnlineUsersSummary(),
        onlineClientsCount: onlineClients.size,
      });
    }
    res.json({
      ok: true,
      onlineUsers: getOnlineUsersSummary(),
      onlineClientsCount: onlineClients.size,
    });
  });

  // Fetch all synced datasets at once
  app.get('/api/live/state', (req: Request, res: Response) => {
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    const perm = checkUserLivePermission(userId);

    const responseKeys: Record<string, StoredRecord> = {};
    if (perm.allowed) {
      Object.assign(responseKeys, storeState.keys);
    } else if (storeState.keys['yp_erp_users']) {
      responseKeys['yp_erp_users'] = storeState.keys['yp_erp_users'];
    }

    res.json({
      ok: true,
      liveSyncAllowed: perm.allowed,
      reason: perm.reason,
      serverTime: new Date().toISOString(),
      versionCounter: storeState.versionCounter,
      keys: responseKeys,
      onlineUsers: getOnlineUsersSummary(),
    });
  });

  // Fetch a single dataset key
  app.get('/api/live/state/:key', (req: Request, res: Response) => {
    const key = String(req.params.key || '');
    if (!ALLOWED_KEYS.has(key)) {
      res.status(400).json({ ok: false, error: 'INVALID_KEY' });
      return;
    }

    const userId = req.query.userId ? String(req.query.userId) : undefined;
    if (key !== 'yp_erp_users') {
      const perm = checkUserLivePermission(userId);
      if (!perm.allowed) {
        res.status(403).json({
          ok: false,
          exists: false,
          error: 'LIVE_SYNC_DISABLED_BY_ADMIN',
          message: perm.reason,
        });
        return;
      }
    }

    const rec = storeState.keys[key];
    if (!rec) {
      res.json({ ok: true, exists: false });
      return;
    }

    res.json({
      ok: true,
      exists: true,
      ...rec,
    });
  });

  // Write/update a dataset key and immediately broadcast via SSE
  app.put('/api/live/state/:key', async (req: Request, res: Response) => {
    const key = String(req.params.key || '');
    if (!ALLOWED_KEYS.has(key)) {
      res.status(400).json({ ok: false, error: 'INVALID_KEY' });
      return;
    }

    const body = req.body || {};
    if (!('payload' in body)) {
      res.status(400).json({ ok: false, error: 'MISSING_PAYLOAD' });
      return;
    }

    const updatedByUserId = body.updatedByUserId ? String(body.updatedByUserId) : undefined;
    const perm = checkUserLivePermission(updatedByUserId);
    if (!perm.allowed) {
      res.status(403).json({
        ok: false,
        error: 'LIVE_SYNC_DISABLED_BY_ADMIN',
        message: perm.reason,
      });
      return;
    }

    storeState.versionCounter += 1;
    const updatedAt = new Date().toISOString();
    const record: StoredRecord = {
      payload: body.payload,
      updatedAt,
      updatedBy: body.updatedBy ? String(body.updatedBy).slice(0, 200) : undefined,
      updatedByUserId,
      updatedByClientId: body.updatedByClientId ? String(body.updatedByClientId).slice(0, 128) : undefined,
      lastAction: body.lastAction ? String(body.lastAction).slice(0, 128) : undefined,
      actionDetail: body.actionDetail ? String(body.actionDetail).slice(0, 500) : undefined,
      version: storeState.versionCounter,
    };

    storeState.keys[key] = record;
    await schedulePersistStore();

    broadcastSseEvent('KEY_UPDATED', {
      key,
      ...record,
    });

    res.json({
      ok: true,
      key,
      version: record.version,
      updatedAt: record.updatedAt,
    });
  });

  // Bulk bootstrap/publish from Super Admin device to Live Server
  app.post('/api/live/bootstrap', async (req: Request, res: Response) => {
    const {
      datasets,
      overwrite = false,
      updatedBy,
      updatedByUserId,
      updatedByClientId,
      actionDetail,
    } = req.body || {};

    if (!datasets || typeof datasets !== 'object') {
      res.status(400).json({ ok: false, error: 'INVALID_DATASETS' });
      return;
    }

    const existingUsersRec = storeState.keys['yp_erp_users'];
    if (existingUsersRec && Array.isArray(existingUsersRec.payload) && updatedByUserId) {
      const actor = (existingUsersRec.payload as Array<Record<string, unknown>>).find(
        (u) => u && String(u.id) === String(updatedByUserId)
      );
      if (actor && (actor.status === 'Nonaktif' || (actor.liveSyncEnabled === false && actor.role !== 'Super Admin'))) {
        res.status(403).json({
          ok: false,
          error: 'LIVE_SYNC_DISABLED_BY_ADMIN',
          message: 'Akun tidak memiliki izin untuk sinkronisasi live.',
        });
        return;
      }
      if (overwrite && actor && actor.role !== 'Super Admin') {
        res.status(403).json({
          ok: false,
          error: 'ADMIN_ONLY',
          message: 'Hanya Super Admin yang dapat menimpa seluruh data Live Server.',
        });
        return;
      }
    }

    const updatedKeys: string[] = [];
    const nowIso = new Date().toISOString();

    for (const [key, payload] of Object.entries(datasets as Record<string, unknown>)) {
      if (!ALLOWED_KEYS.has(key) || payload === undefined || payload === null) continue;
      if (!overwrite && storeState.keys[key]) continue;

      storeState.versionCounter += 1;
      const record: StoredRecord = {
        payload,
        updatedAt: nowIso,
        updatedBy: updatedBy ? String(updatedBy).slice(0, 200) : 'Super Admin',
        updatedByUserId: updatedByUserId ? String(updatedByUserId) : undefined,
        updatedByClientId: updatedByClientId ? String(updatedByClientId).slice(0, 128) : undefined,
        lastAction: 'LIVE_BOOTSTRAP',
        actionDetail: actionDetail
          ? String(actionDetail).slice(0, 500)
          : 'Data disinkronkan oleh Administrator ke Live Server',
        version: storeState.versionCounter,
      };
      storeState.keys[key] = record;
      updatedKeys.push(key);
    }

    if (updatedKeys.length > 0) {
      await schedulePersistStore();
      for (const key of updatedKeys) {
        broadcastSseEvent('KEY_UPDATED', {
          key,
          ...storeState.keys[key],
        });
      }
    }

    res.json({
      ok: true,
      updatedKeys,
      versionCounter: storeState.versionCounter,
      updatedAt: nowIso,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Yusuf Property ERP Live Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting ERP Live Server:', err);
  process.exit(1);
});
