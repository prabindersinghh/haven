import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sign, makeNonce, NexconnPlatformClient } from './nexconn.js';
import { createApi, toUserId, validateSession } from './api.js';

test('signature is lowercase hex SHA1 of secret+nonce+timestamp', () => {
  const expected = crypto.createHash('sha1').update('secret' + '14314' + '1408710653000').digest('hex');
  assert.equal(sign('secret', '14314', '1408710653000'), expected);
  assert.match(expected, /^[0-9a-f]{40}$/);
});

test('nonce is at most 18 characters and random', () => {
  const a = makeNonce();
  assert.ok(a.length <= 18);
  assert.notEqual(a, makeNonce());
});

test('user ids are stable, alphanumeric and <= 64 bytes', () => {
  const id = toUserId('member', 'Mr. Singh (72)');
  assert.match(id, /^[a-z0-9]+$/);
  assert.ok(id.length <= 64);
  assert.equal(id, toUserId('member', 'Mr. Singh (72)'));
  assert.notEqual(id, toUserId('volunteer', 'Mr. Singh (72)'));
});

test('session validation', () => {
  assert.ok(validateSession({ name: 'Asha', role: 'member', lang: 'hi' }).name);
  assert.ok(validateSession({ name: '', role: 'member', lang: 'hi' }).error);
  assert.ok(validateSession({ name: 'A', role: 'admin', lang: 'hi' }).error);
  assert.ok(validateSession({ name: 'A', role: 'member', lang: 'fr' }).error);
});

test('client sends signed headers and parses the token', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { status: 200, json: async () => ({ code: 0, result: { userId: 'u1', accessToken: 'tok' } }) };
  };
  const c = new NexconnPlatformClient({ appKey: 'k', appSecret: 's', fetchImpl });
  assert.equal(await c.issueAccessToken({ userId: 'u1', name: 'U' }), 'tok');
  const h = calls[0].init.headers;
  assert.equal(calls[0].url, 'https://api.sg-light-api.com/v4/auth/access-token/issue');
  assert.equal(h.Signature, sign('s', h.Nonce, h.Timestamp));
});

test('client fails over to the backup domain', async () => {
  const hosts = [];
  const fetchImpl = async (url) => {
    hosts.push(new URL(url).host);
    if (hosts.length === 1) throw new Error('timeout');
    return { status: 200, json: async () => ({ code: 0, result: { accessToken: 't' } }) };
  };
  const c = new NexconnPlatformClient({ appKey: 'k', appSecret: 's', fetchImpl });
  await c.issueAccessToken({ userId: 'u', name: 'U' });
  assert.deepEqual(hosts, ['api.sg-light-api.com', 'api-b.sg-light-api.com']);
});

function call(api, method, url, body) {
  return new Promise((resolve) => {
    const chunks = body ? [Buffer.from(JSON.stringify(body))] : [];
    const req = { method, url, async *[Symbol.asyncIterator]() { yield* chunks; } };
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(data) { resolve({ status: this.statusCode, json: JSON.parse(data) }); },
    };
    api(req, res);
  });
}

test('local mode when no credentials are configured', async () => {
  const api = createApi({ configured: false, dispatchChannelId: 'd' });
  const r = await call(api, 'POST', '/api/session', { name: 'Asha', role: 'member', lang: 'hi' });
  assert.equal(r.status, 200);
  assert.equal(r.json.mode, 'local');
  assert.ok(!('token' in r.json));
});

test('nexconn mode issues a token and joins the dispatch room, never leaking the secret', async () => {
  const fake = {
    issueAccessToken: async () => 'tok',
    createGroup: async () => ({ code: 0 }),
    joinGroup: async () => ({ code: 0 }),
  };
  const api = createApi({ configured: true, appKey: 'key', appSecret: 'SECRET', areaCode: 2, dispatchChannelId: 'd' }, { client: fake });
  const r = await call(api, 'POST', '/api/session', { name: 'Sarah', role: 'volunteer', lang: 'en' });
  assert.equal(r.json.mode, 'nexconn');
  assert.equal(r.json.token, 'tok');
  assert.ok(!JSON.stringify(r.json).includes('SECRET'));
});
