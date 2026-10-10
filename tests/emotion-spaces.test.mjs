import test from 'node:test';
import assert from 'node:assert/strict';

const env = { WALL_PROXY_SECRET: 'test-proxy', FIREBASE_API_KEY: 'test-key', WALL_FIREBASE_EMAIL: 'test@example.test', WALL_FIREBASE_PASSWORD: 'test-password', GEMINI_API_KEY: 'test-key', INBOX_SECRET: 'test-inbox' };
const noteId = '-O' + 'a'.repeat(18);
async function run(req, fetcher) {
  const previousFetch = globalThis.fetch;
  const previousEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  globalThis.fetch = fetcher;
  const { default: handler } = await import(`../integrations/portfolio-api/spaces.js?test=${Math.random()}`);
  const res = { code: 200, data: null, headers: {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, setHeader(name, value) { this.headers[name] = value; } };
  try { await handler({ headers: { 'x-tether-proxy': 'test-proxy' }, ...req }, res); return res; }
  finally { globalThis.fetch = previousFetch; for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const model = verdict => json({ candidates: [{ content: { parts: [{ text: JSON.stringify(verdict) }] } }] });
const noFetch = () => { throw new Error('Unexpected network access'); };

test('requires the private proxy and rejects invalid room/action/encouragement', async () => {
  assert.equal((await run({ method: 'GET', headers: {}, query: { emotion: 'sad' } }, noFetch)).code, 403);
  for (const body of [{ emotion: '../users', action: 'note', text: 'hello' }, { emotion: 'sad', action: 'delete' }, { emotion: 'sad', action: 'note', text: 'x'.repeat(301) }, { emotion: 'sad', action: 'encourage', id: noteId, choice: 9 }, { emotion: 'sad', action: 'encourage', id: '../other', choice: 0 }]) {
    assert.equal((await run({ method: 'POST', body }, noFetch)).code, 400);
  }
});

test('ordinary first-person distress is reviewed as expression and stored without identity', async () => {
  let stored;
  const response = await run({ method: 'POST', body: { emotion: 'tired', action: 'note', text: 'I feel tired today.', senderName: 'Private name', uid: 'user_secret', language: 'en' } }, async (url, options) => {
    if (url.includes('generativelanguage')) {
      const prompt = JSON.parse(options.body).contents[0].parts[0].text;
      assert.match(prompt, /ALLOW honest sadness/);
      assert.match(prompt, /Do NOT demand optimism/);
      return model({ isSafe: true, needsSupport: false, reason: '' });
    }
    if (url.includes('identitytoolkit')) return json({ idToken: 'test', expiresIn: 3600 });
    assert.match(url, /emotionSpaces\/tired\/notes.json/);
    stored = JSON.parse(options.body);
    return json({ name: noteId });
  });
  assert.equal(response.code, 200);
  assert.deepEqual(Object.keys(stored).sort(), ['text', 'timestamp']);
  assert.equal(response.data.note.text, 'I feel tired today.');
});

test('moderation outages and malformed verdicts cannot publish', async () => {
  for (const response of [json({}, 503), model({}), model({ isSafe: 'true', needsSupport: false })]) {
    let calls = 0;
    const result = await run({ method: 'POST', body: { emotion: 'sad', action: 'note', text: 'A note' } }, async url => { calls++; assert.match(url, /generativelanguage/); return response; });
    assert.ok([422, 503].includes(result.code));
    assert.equal(calls, 1);
  }
});

test('personal crisis routes to support without storing the note', async () => {
  const result = await run({ method: 'POST', body: { emotion: 'sad', action: 'note', text: 'A private support request' } }, async url => {
    assert.match(url, /generativelanguage/);
    return model({ isSafe: false, needsSupport: true, reason: 'Please seek support.' });
  });
  assert.equal(result.code, 422);
  assert.equal(result.data.needsSupport, true);
});

test('bounded room reads exclude private properties and cursor duplicates', async () => {
  const entries = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`-O${String(i).padStart(18, '0')}`, { text: `Note ${i}`, timestamp: i + 1, senderId: 'must-not-return' }]));
  const result = await run({ method: 'GET', query: { emotion: 'lonely' } }, async url => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'test' });
    const parsed = new URL(url);
    if (parsed.searchParams.get('orderBy') === '"timestamp"') return json({});
    assert.equal(parsed.searchParams.get('limitToLast'), '21');
    assert.equal(parsed.searchParams.get('orderBy'), '"$key"');
    assert.match(parsed.pathname, /emotionSpaces\/lonely\/notes.json/);
    return json(entries);
  });
  assert.equal(result.data.notes.length, 20);
  assert.equal(result.data.notes[0].text, 'Note 20');
  assert.equal(result.data.notes[19].text, 'Note 1');
  assert.ok(result.data.notes.every(note => !('senderId' in note)));
  const cursor = result.data.cursor;
  const page = await run({ method: 'GET', query: { emotion: 'lonely', cursor } }, async url => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'test' });
    const parsed = new URL(url);
    if (parsed.searchParams.get('orderBy') === '"timestamp"') return json({});
    assert.equal(parsed.searchParams.get('endAt'), JSON.stringify(cursor));
    return json({ [cursor]: entries[cursor], '-O000000000000000000': entries['-O000000000000000000'] });
  });
  assert.equal(page.data.notes.length, 1);
  assert.equal(page.data.notes[0].text, 'Note 0');
  assert.equal(page.data.cursor, null);
});

test('encouragement retries conditional-write conflicts and never accepts custom text', async () => {
  let writes = 0;
  const result = await run({ method: 'POST', body: { emotion: 'tired', action: 'encourage', id: noteId, choice: 1, text: 'Ignored custom comment' } }, async (url, options) => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'test' });
    if (url.includes('/timestamp.json')) return json(123);
    assert.match(url, /encouragements\/c1.json/);
    if (options.method !== 'PUT') return json(writes ? 5 : 4, 200, { etag: `etag-${writes}` });
    assert.equal(options.headers['if-match'], `etag-${writes}`);
    writes++;
    assert.equal(options.body, String(writes === 1 ? 5 : 6));
    return writes === 1 ? json({}, 412) : json(6);
  });
  assert.equal(result.code, 200);
  assert.equal(result.data.count, 6);
  assert.equal(writes, 2);
});

test('cannot encourage a deleted or non-existent note', async () => {
  const result = await run({ method: 'POST', body: { emotion: 'sad', action: 'encourage', id: noteId, choice: 0 } }, async url => url.includes('identitytoolkit') ? json({ idToken: 'test' }) : json(null));
  assert.equal(result.code, 404);
});

test('reports an existing note to the private inbox without accepting report text', async () => {
  let report;
  const result = await run({ method: 'POST', body: { emotion: 'anxious', action: 'report', id: noteId, text: 'attacker supplied report text' } }, async (url, options = {}) => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'test' });
    if (url.includes(`/notes/${noteId}.json`)) return json({ text: 'The stored note', timestamp: 1 });
    assert.match(url, /feedback\/test-inbox\.json/);
    report = JSON.parse(options.body);
    return json({ name: '-Oreport000000000000' });
  });
  assert.equal(result.code, 200);
  assert.match(report.text, /The stored note/);
  assert.doesNotMatch(report.text, /attacker supplied/);
});
