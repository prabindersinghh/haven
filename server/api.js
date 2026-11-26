// Haven app-server API. Mounted by the Vite dev server (see vite.config.ts) and by
// server/index.js in production, so both paths run exactly the same code.
//
//   GET  /api/health   -> { ok, mode }
//   POST /api/session  -> { mode, appKey?, areaCode?, token?, userId, dispatchChannelId }
//
// mode "nexconn": real Nexconn Chat (App Key + Secret configured on the server).
// mode "local":    no credentials configured; the client falls back to an in-browser
//                  demo transport so the UI can be tried without an account.

import crypto from 'node:crypto';
import { NexconnPlatformClient } from './nexconn.js';

const ROLES = new Set(['member', 'volunteer', 'family', 'staff']);
const LANGS = new Set(['en', 'hi', 'pa']);
const AREA_CODES = { sg: 2, na: 3, sa: 5 };

export function loadConfig(env = process.env) {
  const appKey = env.NEXCONN_APP_KEY?.trim();
  const appSecret = env.NEXCONN_APP_SECRET?.trim();
  const region = (env.NEXCONN_REGION ?? 'sg').trim().toLowerCase();
  return {
    appKey,
    appSecret,
    region,
    areaCode: AREA_CODES[region] ?? AREA_CODES.sg,
    dispatchChannelId: (env.HAVEN_DISPATCH_CHANNEL_ID ?? 'havendispatch').trim(),
    configured: Boolean(appKey && appSecret),
  };
}

/** Normalises a display name into a stable, Nexconn-safe user id (letters and digits, <= 64 bytes). */
export function toUserId(role, name) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'user';
  const suffix = crypto.createHash('sha1').update(`${role}:${name}`).digest('hex').slice(0, 8);
  return `${role}${slug}${suffix}`.slice(0, 64);
}

export function validateSession(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const role = body?.role;
  const lang = body?.lang;
  if (!name || name.length > 40) return { error: 'name must be 1-40 characters' };
  if (!ROLES.has(role)) return { error: 'role must be member, volunteer, family or staff' };
  if (!LANGS.has(lang)) return { error: 'lang must be en, hi or pa' };
  return { name, role, lang };
}

export function createApi(config = loadConfig(), deps = {}) {
  const client = config.configured
    ? deps.client ?? new NexconnPlatformClient({ appKey: config.appKey, appSecret: config.appSecret, region: config.region })
    : null;
  let dispatchReady = null; // promise: dispatch group created once per process

  async function ensureDispatch(ownerId) {
    if (!dispatchReady) {
      dispatchReady = client
        .createGroup({ channelId: config.dispatchChannelId, name: 'Haven Dispatch', owner: ownerId })
        .catch(() => null); // already exists is fine; join below is authoritative
    }
    await dispatchReady;
    const joined = await client.joinGroup({ channelId: config.dispatchChannelId, userIds: [ownerId] });
    if (joined?.code !== 0) {
      // The group may have been created under a different owner id earlier; retry create once.
      await client.createGroup({ channelId: config.dispatchChannelId, name: 'Haven Dispatch', owner: ownerId });
    }
  }

  async function session(body) {
    const v = validateSession(body);
    if (v.error) return { status: 400, json: { error: v.error } };
    const userId = toUserId(v.role, v.name);
    if (!config.configured) {
      return { status: 200, json: { mode: 'local', userId, dispatchChannelId: config.dispatchChannelId } };
    }
    try {
      const token = await client.issueAccessToken({ userId, name: v.name });
      await ensureDispatch(userId);
      return {
        status: 200,
        json: { mode: 'nexconn', appKey: config.appKey, areaCode: config.areaCode, token, userId, dispatchChannelId: config.dispatchChannelId },
      };
    } catch (err) {
      return { status: 502, json: { error: `Nexconn platform error: ${err.message}` } };
    }
  }

  /** Node-style (req, res, next) middleware usable by Vite and by the production server. */
  return async function handler(req, res, next) {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next?.();
    const send = (status, json) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(json));
    };
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return send(200, { ok: true, mode: config.configured ? 'nexconn' : 'local' });
    }
    if (req.method === 'POST' && url.pathname === '/api/session') {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 4096) return send(413, { error: 'body too large' });
      }
      let body;
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        return send(400, { error: 'invalid JSON' });
      }
      const r = await session(body);
      return send(r.status, r.json);
    }
    return send(404, { error: 'not found' });
  };
}
