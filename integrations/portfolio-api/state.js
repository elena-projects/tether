import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const RTDB = 'https://tether-7fc38-default-rtdb.asia-southeast1.firebasedatabase.app';
const UID_PATTERN = /^user_[a-f0-9]{20}$/;

let firebaseSession = { idToken: '', expiresAt: 0 };

function signedToken(uid) {
  return createHmac('sha256', process.env.STATE_SESSION_SECRET).update(`v1:${uid}`).digest('hex');
}

function validSession(uid, token) {
  if (!UID_PATTERN.test(uid) || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = Buffer.from(signedToken(uid), 'hex');
  const received = Buffer.from(token, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function firebaseIdToken() {
  if (firebaseSession.idToken && firebaseSession.expiresAt > Date.now() + 60_000) {
    return firebaseSession.idToken;
  }
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(process.env.FIREBASE_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.WALL_FIREBASE_EMAIL,
        password: process.env.WALL_FIREBASE_PASSWORD,
        returnSecureToken: true,
      }),
    },
  );
  if (!response.ok) throw new Error('firebase auth ' + response.status);
  const data = await response.json();
  const expiresIn = Math.max(60, Number(data.expiresIn) || 3600);
  firebaseSession = { idToken: data.idToken, expiresAt: Date.now() + expiresIn * 1000 };
  return firebaseSession.idToken;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'post_only' });
  if (!process.env.WALL_PROXY_SECRET || req.headers['x-tether-proxy'] !== process.env.WALL_PROXY_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (
    !process.env.STATE_SESSION_SECRET ||
    !process.env.DATA_SECRET ||
    !process.env.FIREBASE_API_KEY ||
    !process.env.WALL_FIREBASE_EMAIL ||
    !process.env.WALL_FIREBASE_PASSWORD
  ) return res.status(500).json({ error: 'not_configured' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return res.status(400).json({ error: 'bad_json' }); }

  const uid = String(body.uid || '');
  const token = String(body.token || '');
  if (body.action === 'session') {
    if (validSession(uid, token)) return res.status(200).json({ uid, token });
    const nextUid = `user_${randomBytes(10).toString('hex')}`;
    return res.status(200).json({ uid: nextUid, token: signedToken(nextUid) });
  }

  if (body.action !== 'state') return res.status(400).json({ error: 'action' });
  if (!validSession(uid, token)) return res.status(403).json({ error: 'session' });

  const valence = Number(body.state?.valence);
  const arousal = Number(body.state?.arousal);
  if (!Number.isFinite(valence) || !Number.isFinite(arousal) || valence < 0 || valence > 100 || arousal < 0 || arousal > 100) {
    return res.status(400).json({ error: 'state' });
  }

  let idToken;
  try { idToken = await firebaseIdToken(); }
  catch { return res.status(502).json({ error: 'store_auth' }); }

  const path = `/users/${encodeURIComponent(process.env.DATA_SECRET)}/${uid}.json?auth=${encodeURIComponent(idToken)}`;
  const stored = await fetch(`${RTDB}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: { valence: Math.round(valence), arousal: Math.round(arousal) },
      lastActive: Date.now(),
    }),
  });
  if (!stored.ok) return res.status(502).json({ error: 'store' });
  return res.status(200).json({ ok: true });
}
