import { TetherState, UserProfile, Message } from "../types";

const STATE_TOKEN_KEY = 'tether_state_token';

export const establishUserSession = async (userId?: string | null): Promise<string> => {
  const token = userId ? localStorage.getItem(STATE_TOKEN_KEY) : null;
  try {
    const response = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'session', uid: userId || '', token: token || '' }),
    });
    if (!response.ok) throw new Error('state_session_failed');
    const result = await response.json();
    if (!/^user_[a-f0-9]{20}$/.test(result.uid) || typeof result.token !== 'string') {
      throw new Error('state_session_invalid');
    }
    localStorage.setItem(STATE_TOKEN_KEY, result.token);
    return result.uid;
  } catch {
    // Remote presence is an enhancement. The check-in remains fully usable offline or
    // during a backend outage, but it will not publish an unauthenticated mood record.
    if (userId) return userId;
    localStorage.removeItem(STATE_TOKEN_KEY);
    return `user_${Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => n.toString(16).padStart(2, '0')).join('')}`;
  }
};

export const clearUserSessionToken = () => localStorage.removeItem(STATE_TOKEN_KEY);

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
// The name is deliberately NOT stored here. This node exists only so someone who is
// low can be matched with someone willing to send a light, and matching needs a uid and
// a mood — never a name. Keeping names out means this record can't identify anybody.
export const updateUserState = async (userId: string, _username: string, state: TetherState) => {
  const token = localStorage.getItem(STATE_TOKEN_KEY);
  if (!token) return;
  try {
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'state', uid: userId, token, state }),
    });
  } catch {}
};

// --- Social Discovery (Finding Drifters) ---
export const getDriftingUsers = async (currentUserId: string): Promise<UserProfile[]> => {
  const token = localStorage.getItem(STATE_TOKEN_KEY);
  if (!token) return [];
  try {
    const response = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'match', uid: currentUserId, token }),
    });
    if (!response.ok) return [];
    const result = await response.json();
    const user = result.user;
    if (!user || !/^user_[a-f0-9]{20}$/.test(user.uid)) return [];
    return [{ uid: user.uid, username: '', state: user.state, lastActive: user.lastActive }];
  } catch {
    return [];
  }
};

// --- Global Messaging & Voting ---
export const sendTetherMessage = async (
  fromUser: { uid: string; name: string },
  toUserId: string,
  text: string,
  type: 'human' | 'ai' = 'human',
  language: 'en' | 'zh' = 'zh',
) => {
  const response = await fetch('/api/wall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      senderName: fromUser.name,
      senderId: fromUser.uid,
      targetId: toUserId,
      language,
      type,
    }),
  });

  if (response.ok) return;

  let result: any = {};
  try { result = await response.json(); } catch {}
  const error: any = new Error(result.error || 'wall_post_failed');
  error.code = result.blocked ? 'blocked' : (result.error || 'wall_post_failed');
  error.reason = result.reason || '';
  throw error;
};

export const voteForMessage = async (messageId: string) => {
  await fetch('/api/wall', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'vote', id: messageId, delta: 1 }),
  });
};

export const unvoteForMessage = async (messageId: string) => {
  await fetch('/api/wall', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'vote', id: messageId, delta: -1 }),
  });
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

async function readWall(): Promise<Message[]> {
  const response = await fetch('/api/wall');
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data.messages)) return [];
  return data.messages.map((message: any) => ({ ...message, senderId: '', targetId: 'wall' }));
}

// The wall is loaded only while its panel is open. The backend returns at most 60
// public wall entries and never exposes sender IDs or retired targeted messages.
export const listenToWall = (callback: (messages: Message[]) => void) =>
  poll(async () => {
    callback(await readWall());
  });

// --- History ---
export const getHistory = async (userId: string) => {
  void userId;
  // Mood history has no account system, so server-side ownership cannot be proved.
  // Keep the trajectory local instead of exposing everyone's history by public UID.
  return [];
};
