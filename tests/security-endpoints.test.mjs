import test from 'node:test';
import assert from 'node:assert/strict';

const env = {
  WALL_PROXY_SECRET: 'test-proxy', GEMINI_API_KEY: 'test-key', FIREBASE_API_KEY: 'firebase-key',
  WALL_FIREBASE_EMAIL: 'test@example.test', WALL_FIREBASE_PASSWORD: 'test-password',
};
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });

async function run(module, req, fetcher) {
  const oldFetch = globalThis.fetch;
  const oldEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  globalThis.fetch = fetcher;
  const { default: handler } = await import(`${module}?test=${Math.random()}`);
  const res = { code: 200, data: null, headers: {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, setHeader(name, value) { this.headers[name] = value; } };
  try { await handler(req, res); return res; }
  finally {
    globalThis.fetch = oldFetch;
    for (const [key, value] of Object.entries(oldEnv)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
}

test('companion endpoint exposes only fixed actions behind the private proxy', async () => {
  const path = '../integrations/portfolio-api/companion.js';
  assert.equal((await run(path, { method: 'GET', headers: {} }, () => { throw new Error('network'); })).code, 405);
  assert.equal((await run(path, { method: 'POST', headers: {}, body: { action: 'worry', text: 'x' } }, () => { throw new Error('network'); })).code, 403);
  assert.equal((await run(path, { method: 'POST', headers: { 'x-tether-proxy': 'test-proxy' }, body: { action: 'arbitrary', text: 'x' } }, () => { throw new Error('network'); })).code, 400);

  let prompt = '';
  const result = await run(path, { method: 'POST', headers: { 'x-tether-proxy': 'test-proxy' }, body: { action: 'ground', text: 'blue chair', language: 'en' } }, async (_url, options) => {
    prompt = JSON.parse(options.body).contents[0].parts[0].text;
    return json({ candidates: [{ content: { parts: [{ text: 'The blue chair is here with you.' }] } }] });
  });
  assert.equal(result.code, 200);
  assert.equal(result.data.reply, 'The blue chair is here with you.');
  assert.match(prompt, /untrusted content/);
});

test('wall read is bounded to public entries and strips identifiers', async () => {
  const path = '../integrations/portfolio-api/wall.js';
  const result = await run(path, { method: 'GET', headers: { 'x-tether-proxy': 'test-proxy' } }, async url => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'token', expiresIn: 3600 });
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('equalTo'), '"wall"');
    assert.equal(parsed.searchParams.get('limitToLast'), '60');
    return json({
      '-Opublic000000000000': { text: 'Hello', senderName: 'A', senderId: 'private', targetId: 'wall', timestamp: 2, voteCount: 1, type: 'human' },
      '-Otarget000000000000': { text: 'Private', senderName: 'B', senderId: 'private', targetId: 'user_x', timestamp: 1, voteCount: 0, type: 'human' },
    });
  });
  assert.equal(result.code, 200);
  assert.equal(result.data.messages.length, 1);
  assert.equal(result.data.messages[0].text, 'Hello');
  assert.equal('senderId' in result.data.messages[0], false);
  assert.equal('targetId' in result.data.messages[0], false);
});
