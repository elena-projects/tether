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
  const headers = { 'x-tether-proxy': 'test-proxy', ...(req.method === 'POST' ? { 'content-type': 'application/json' } : {}), ...(req.headers || {}) };
  try { await handler({ ...req, headers }, res); return res; }
  finally { globalThis.fetch = previousFetch; for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const model = verdict => json({ candidates: [{ content: { parts: [{ text: JSON.stringify(verdict) }] } }] });
const noFetch = () => { throw new Error('Unexpected network access'); };

test('requires the private proxy and rejects invalid room/action/encouragement', async () => {
  assert.equal((await run({ method: 'GET', headers: { 'x-tether-proxy': '' }, query: { emotion: 'sad' } }, noFetch)).code, 403);
  assert.equal((await run({ method: 'POST', headers: { 'content-type': 'text/plain' }, body: { emotion: 'sad', action: 'note', text: 'hello' } }, noFetch)).code, 415);
  for (const body of [{ emotion: '../users', action: 'note', text: 'hello' }, { emotion: 'sad', action: 'delete' }, { emotion: 'sad', action: 'note', text: 'x'.repeat(301) }, { emotion: 'sad', action: 'comment', id: noteId, text: 'x'.repeat(181) }, { emotion: 'sad', action: 'comment', id: '../other', text: 'hello' }, { emotion: 'sad', action: 'encourage', id: noteId, choice: 9 }, { emotion: 'sad', action: 'encourage', id: '../other', choice: 0 }, { emotion: 'sad', action: 'report', id: noteId }, { emotion: 'sad', action: 'report', id: noteId, reason: 'dislike' }]) {
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
    if (url.includes(`/notes/${noteId}.json`)) return json({ text: 'A note', timestamp: 123 });
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

test('comment hard blocks reject obvious abuse and contact details before network access', async () => {
  for (const text of ['你这个废物滚开', 'add me on Discord', 'https://spam.example']) {
    const result = await run({ method: 'POST', body: { emotion: 'sad', action: 'comment', id: noteId, text } }, noFetch);
    assert.equal(result.code, 422);
    assert.equal(result.data.error, 'blocked');
  }
});

test('safe comments are reviewed in note context and stored without identity', async () => {
  let stored;
  const result = await run({ method: 'POST', body: { emotion: 'lonely', action: 'comment', id: noteId, text: 'I have felt this too. I hope today feels lighter.', language: 'en', uid: 'ignored' } }, async (url, options = {}) => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'test' });
    if (url.includes(`/notes/${noteId}.json`)) return json({ text: 'I feel alone today.', timestamp: 1 });
    if (url.includes('generativelanguage')) {
      const prompt = JSON.parse(options.body).contents[0].parts[0].text;
      assert.match(prompt, /BLOCK rumors, defamation/);
      assert.match(prompt, /Parent note: "I feel alone today\."/);
      assert.match(prompt, /Proposed reply:/);
      return model({ isSafe: true, needsSupport: false, reason: '' });
    }
    if (url.includes(`/emotionSpaceComments/lonely/${noteId}.json`) && !options.method) return json({});
    assert.match(url, new RegExp(`emotionSpaceComments/lonely/${noteId}\\.json`));
    stored = JSON.parse(options.body);
    return json({ name: '-Ocomment00000000000' });
  });
  assert.equal(result.code, 200);
  assert.deepEqual(Object.keys(stored).sort(), ['text', 'timestamp']);
  assert.equal(result.data.comment.text, 'I have felt this too. I hope today feels lighter.');
});

test('comment moderation fails closed', async () => {
  const result = await run({ method: 'POST', body: { emotion: 'sad', action: 'comment', id: noteId, text: 'A reply' } }, async url => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'test' });
    if (url.includes(`/notes/${noteId}.json`)) return json({ text: 'A note', timestamp: 1 });
    if (url.includes(`/emotionSpaceComments/sad/${noteId}.json`)) return json({});
    if (url.includes('generativelanguage')) return json({}, 503);
    throw new Error('Unexpected write');
  });
  assert.equal(result.code, 503);
  assert.equal(result.data.error, 'unverifiable');
});

test('a note cannot accumulate an unbounded number of replies', async () => {
  const full = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`-C${String(i).padStart(18, '0')}`, { text: 'Reply', timestamp: i }]));
  const result = await run({ method: 'POST', body: { emotion: 'sad', action: 'comment', id: noteId, text: 'A kind reply' } }, async url => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'test' });
    if (url.includes(`/notes/${noteId}.json`)) return json({ text: 'A note', timestamp: 1 });
    if (url.includes(`/emotionSpaceComments/sad/${noteId}.json`)) return json(full);
    throw new Error('Moderation must not run after the cap is reached');
  });
  assert.equal(result.code, 409);
  assert.equal(result.data.error, 'full');
});

test('comment reads are parent-scoped, bounded, and strip private properties', async () => {
  const entries = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`-C${String(i).padStart(18, '0')}`, { text: `Reply ${i}`, timestamp: i + 1, uid: 'must-not-return' }]));
  const result = await run({ method: 'GET', query: { emotion: 'tired', id: noteId } }, async url => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'test' });
    if (url.includes(`/notes/${noteId}/timestamp.json`)) return json(1);
    const parsed = new URL(url);
    assert.match(parsed.pathname, new RegExp(`emotionSpaceComments/tired/${noteId}\\.json`));
    assert.equal(parsed.searchParams.get('limitToLast'), '12');
    return json(entries);
  });
  assert.equal(result.code, 200);
  assert.equal(result.data.comments.length, 12);
  assert.equal(result.data.comments[0].text, 'Reply 3');
  assert.ok(result.data.comments.every(comment => !('uid' in comment)));
});

test('actionable reports reach the private inbox with a fixed reason and stored text', async () => {
  let report;
  const result = await run({ method: 'POST', body: { emotion: 'anxious', action: 'report', id: noteId, reason: 'abuse', text: 'attacker supplied report text' } }, async (url, options = {}) => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'test' });
    if (url.includes(`/notes/${noteId}.json`)) return json({ text: 'The stored note', timestamp: 1 });
    if (url.includes('generativelanguage')) return model({ actionable: true, urgent: false, reason: 'Targeted abuse.' });
    assert.match(url, /feedback\/test-inbox\.json/);
    report = JSON.parse(options.body);
    return json({ name: '-Oreport000000000000' });
  });
  assert.equal(result.code, 200);
  assert.equal(result.data.forwarded, true);
  assert.match(report.text, /The stored note/);
  assert.match(report.text, /Reason: abuse/);
  assert.doesNotMatch(report.text, /attacker supplied/);
});

test('reports a stored comment without accepting caller-supplied report text', async () => {
  const commentId = '-C' + 'b'.repeat(18);
  let report;
  const result = await run({ method: 'POST', body: { emotion: 'anxious', action: 'report', id: noteId, commentId, reason: 'privacy', text: 'forged report' } }, async (url, options = {}) => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'test' });
    if (url.includes(`/notes/${noteId}.json`)) return json({ text: 'Parent note', timestamp: 1 });
    if (url.includes(`/emotionSpaceComments/anxious/${noteId}/${commentId}.json`)) return json({ text: 'Stored comment', timestamp: 2 });
    if (url.includes('generativelanguage')) return model({ actionable: true, urgent: false, reason: 'Contact details.' });
    assert.match(url, /feedback\/test-inbox\.json/);
    report = JSON.parse(options.body);
    return json({ name: '-Oreport000000000000' });
  });
  assert.equal(result.code, 200);
  assert.match(report.text, /Stored comment/);
  assert.doesNotMatch(report.text, /forged report/);
});

test('benign content reported by mistake does not enter the private inbox', async () => {
  let inboxWrites = 0;
  const result = await run({ method: 'POST', body: { emotion: 'sad', action: 'report', id: noteId, reason: 'dangerous' } }, async (url, options = {}) => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'test' });
    if (url.includes(`/notes/${noteId}.json`)) return json({ text: 'Go outside, feel the sun, and remember this will pass.', timestamp: 1 });
    if (url.includes('generativelanguage')) {
      const prompt = JSON.parse(options.body).contents[0].parts[0].text;
      assert.match(prompt, /disagreement, or content that simply does not match/);
      return model({ actionable: false, urgent: false, reason: 'Benign encouragement.' });
    }
    if (url.includes('/feedback/')) inboxWrites++;
    return json({ name: '-Ounexpected' });
  });
  assert.equal(result.code, 200);
  assert.equal(result.data.forwarded, false);
  assert.equal(inboxWrites, 0);
});

test('report review outages preserve the report for human review', async () => {
  let report;
  const result = await run({ method: 'POST', body: { emotion: 'sad', action: 'report', id: noteId, reason: 'other' } }, async (url, options = {}) => {
    if (url.includes('identitytoolkit')) return json({ idToken: 'test' });
    if (url.includes(`/notes/${noteId}.json`)) return json({ text: 'Ambiguous stored note', timestamp: 1 });
    if (url.includes('generativelanguage')) return json({}, 503);
    if (url.includes('/feedback/')) { report = JSON.parse(options.body); return json({ name: '-Ofallback' }); }
    throw new Error('Unexpected request');
  });
  assert.equal(result.code, 200);
  assert.equal(result.data.forwarded, true);
  assert.match(report.text, /review was unavailable/i);
});
