// Nexconn Platform Chat API client (server-side only).
// Every request is signed with SHA1(AppSecret + Nonce + Timestamp), as required by
// https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth.md
// The App Secret never leaves this process.

import crypto from 'node:crypto';

const REGION_HOSTS = {
  sg: ['api.sg-light-api.com', 'api-b.sg-light-api.com'],
  na: ['api.us-light-api.com', 'api-b.us-light-api.com'],
  sa: ['api.sau-light-api.com', 'api-b.sau-light-api.com'],
};

/** Computes the Signature header value: lowercase hex SHA1 of secret + nonce + timestamp. */
export function sign(appSecret, nonce, timestamp) {
  return crypto.createHash('sha1').update(`${appSecret}${nonce}${timestamp}`).digest('hex');
}

/** A random nonce of at most 18 characters, different for every request. */
export function makeNonce() {
  return crypto.randomBytes(9).toString('hex').slice(0, 18);
}

export class NexconnPlatformClient {
  /**
   * @param {{ appKey: string, appSecret: string, region?: string, timeoutMs?: number, fetchImpl?: typeof fetch }} opts
   */
  constructor({ appKey, appSecret, region = 'sg', timeoutMs = 5000, fetchImpl = globalThis.fetch }) {
    if (!appKey || !appSecret) throw new Error('NexconnPlatformClient requires appKey and appSecret');
    this.appKey = appKey;
    this.appSecret = appSecret;
    this.hosts = REGION_HOSTS[region] ?? REGION_HOSTS.sg;
    this.hostIndex = 0;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  headers() {
    const nonce = makeNonce();
    const timestamp = String(Date.now());
    return {
      'App-Key': this.appKey,
      Nonce: nonce,
      Timestamp: timestamp,
      Signature: sign(this.appSecret, nonce, timestamp),
      'Content-Type': 'application/json',
      'X-Request-ID': crypto.randomUUID(),
    };
  }

  /**
   * POSTs JSON to a Platform API path. On timeout or an unexpected HTTP status it
   * switches to the region's backup domain once (documented failover behaviour).
   */
  async post(path, body) {
    let lastError;
    for (let attempt = 0; attempt < this.hosts.length; attempt++) {
      const host = this.hosts[this.hostIndex];
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await this.fetch(`https://${host}${path}`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (res.status >= 500) throw new Error(`HTTP ${res.status} from ${host}`);
        return json;
      } catch (err) {
        lastError = err;
        this.hostIndex = (this.hostIndex + 1) % this.hosts.length;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }

  /** POST /v4/auth/access-token/issue — registers the user and returns an access token. */
  async issueAccessToken({ userId, name, avatarUrl }) {
    const json = await this.post('/v4/auth/access-token/issue', { userId, name, ...(avatarUrl ? { avatarUrl } : {}) });
    if (json.code !== 0 || !json.result?.accessToken) {
      throw new Error(`access-token/issue failed: code ${json.code} ${json.msg ?? ''}`.trim());
    }
    return json.result.accessToken;
  }

  /** POST /v4/group-channel/create — creator becomes owner. joinPerm 1 = no approval needed. */
  async createGroup({ channelId, name, owner, userIds = [] }) {
    return this.post('/v4/group-channel/create', {
      channelId,
      name,
      owner,
      userIds,
      groupProfile: { introduction: 'Haven volunteer dispatch room' },
      permissions: { joinPerm: 1, memInvitePerm: 2 },
    });
  }

  /** POST /v4/group-channel/join — adds users directly, no approval. */
  async joinGroup({ channelId, userIds }) {
    return this.post('/v4/group-channel/join', { channelId, userIds });
  }
}
