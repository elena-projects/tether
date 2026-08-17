import { TetherState, UserProfile, Message } from "../types";

// --- Same-origin Realtime Database access (works in mainland China) ---
// The browser only ever talks to our own domain at `/rtdb/...`; nginx (prod) and the
// vite dev server both proxy that to the Firebase RTDB REST API. No client websocket,
// no *.firebasedatabase.app, no Firebase Auth — so nothing that China commonly blocks.
const BASE = '/rtdb';

async function rGet(path: string): Promise<any> {
  try {
    const r = await fetch(`${BASE}/${path}.json`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
async function rPut(path: string, data: any): Promise<void> {
  try { await fetch(`${BASE}/${path}.json`, { method: 'PUT', body: JSON.stringify(data) }); } catch {}
}
async function rPost(path: string, data: any): Promise<void> {
  try { await fetch(`${BASE}/${path}.json`, { method: 'POST', body: JSON.stringify(data) }); } catch {}
}

// --- User Management (local session) ---
export const saveUserSession = (userId: string, username: string) => {
  localStorage.setItem('tether_uid', userId);
  localStorage.setItem('tether_username', username);
};
export const loadUserSession = () => ({
  uid: localStorage.getItem('tether_uid'),
  username: localStorage.getItem('tether_username'),
});

// --- Realtime State Sync ---
export const updateUserState = async (userId: string, username: string, state: TetherState) => {
  await rPut(`users/${userId}`, { username, state, lastActive: Date.now() });
  await rPost(`history/${userId}`, { state, timestamp: Date.now() });
};

// --- Social Discovery (Finding Drifters) ---
export const getDriftingUsers = async (currentUserId: string): Promise<UserProfile[]> => {
  const users = await rGet('users');
  if (!users) return [];
  const drifters: UserProfile[] = [];
  for (const [uid, data] of Object.entries<any>(users)) {
    const isActive = (Date.now() - (data.lastActive || 0)) < 10 * 60 * 1000;
    if (uid !== currentUserId && data.state && data.state.valence < 40 && isActive) {
      drifters.push({ uid, username: data.username, state: data.state, lastActive: data.lastActive });
    }
  }
  return drifters;
};

// --- Global Messaging & Voting ---
export const sendTetherMessage = async (
  fromUser: { uid: string; name: string },
  toUserId: string,
  text: string,
  type: 'human' | 'ai' = 'human',
) => {
  await rPost('messages', {
    text, senderName: fromUser.name, senderId: fromUser.uid, targetId: toUserId,
    timestamp: Date.now(), voteCount: 0, type,
  });
};

export const voteForMessage = async (messageId: string) => {
  const cur = await rGet(`messages/${messageId}/voteCount`);
  await rPut(`messages/${messageId}/voteCount`, (cur || 0) + 1);
};

export const unvoteForMessage = async (messageId: string) => {
  const cur = await rGet(`messages/${messageId}/voteCount`);
  await rPut(`messages/${messageId}/voteCount`, Math.max(0, (cur || 0) - 1));
};

// --- Polling (replaces the realtime websocket listeners) ---
function poll(fetcher: () => Promise<void>, interval = 6000) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    // Don't spend the reader's battery — or our Firebase quota — on a tab nobody is looking at.
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      try { await fetcher(); } catch {}
    }
    if (!stopped) setTimeout(tick, interval);
  };
  tick();
  return () => { stopped = true; };
}

// Several listeners (the wall, the inbox, the spotlight, the vote tally) each want the
// whole message list on their own timer. Left alone they fire near-identical requests a
// second apart. One short-lived shared promise collapses them into a single fetch.
let messagesCache: { at: number; value: Promise<Message[]> } | null = null;

const allMessages = async (): Promise<Message[]> => {
  const now = Date.now();
  if (messagesCache && now - messagesCache.at < 4000) return messagesCache.value;

  const value = (async (): Promise<Message[]> => {
    const obj = await rGet('messages');
    if (!obj) return [];
    return Object.entries<any>(obj).map(([id, d]) => ({
      id, text: d.text, senderName: d.senderName, senderId: d.senderId,
      targetId: d.targetId, timestamp: d.timestamp || 0, voteCount: d.voteCount || 0, type: d.type,
    }));
  })();

  messagesCache = { at: now, value };
  // A failed fetch must not be cached, or every listener retries the same rejection.
  value.catch(() => { if (messagesCache?.value === value) messagesCache = null; });
  return value;
};

// The wall — most recent kind messages everyone has written.
export const listenToWall = (callback: (messages: Message[]) => void) =>
  poll(async () => {
    // most-hearted first (ties broken by newest), so the wall scrolls down by love.
    const msgs = (await allMessages())
      .sort((a, b) => (b.voteCount - a.voteCount) || (b.timestamp - a.timestamp))
      .slice(0, 60);
    callback(msgs);
  });

// Messages targeted at this specific user.
export const listenToInbox = (userId: string, callback: (messages: Message[]) => void) =>
  poll(async () => {
    const msgs = (await allMessages()).filter((m) => m.targetId === userId).sort((a, b) => a.timestamp - b.timestamp);
    callback(msgs);
  });

// The single most-hearted message (the spotlight).
export const listenToSpotlight = (callback: (msg: Message | null) => void) =>
  poll(async () => {
    const msgs = await allMessages();
    if (!msgs.length) { callback(null); return; }
    callback(msgs.reduce((a, b) => (b.voteCount > a.voteCount ? b : a)));
  });

// Total hearts this user has received (their "healing power").
export const listenToUserTotalVotes = (userId: string, callback: (totalVotes: number) => void) =>
  poll(async () => {
    const msgs = await allMessages();
    callback(msgs.filter((m) => m.senderId === userId).reduce((s, m) => s + (m.voteCount || 0), 0));
  });

// --- History ---
export const getHistory = async (userId: string) => {
  const obj = await rGet(`history/${userId}`);
  if (!obj) return [];
  return Object.entries<any>(obj)
    .map(([id, d]) => ({ id, ...d }))
    .sort((a: any, b: any) => b.timestamp - a.timestamp)
    .slice(0, 20);
};
