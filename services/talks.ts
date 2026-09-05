

// ============================================================
// "Someone wants to tell you something" — a bounded, consent-first channel.
//
// Reading the wall, you may find one person whose way of caring lands for you.
// This lets you reach that person — but deliberately NOT as a chat:
//   • they are asked first, every single time, and can always say no;
//   • the exchange is one message each, extendable once if BOTH want it;
//   • it then closes for good.
//
// The person on the other end is another teenager, not a counsellor. Every part of
// this file is built so that no one can be quietly turned into someone's only support.
// ============================================================

// Not `/rtdb` — that path is the public wall. These go through `/talks`, which the server
// rewrites into a secret box nobody outside can name, so private messages can't be listed
// by anyone who simply knows the database URL.
const BASE = '/talks';

async function rGet(path = ''): Promise<any> {
  try { const r = await fetch(`${BASE}/${path}.json`); return r.ok ? await r.json() : null; } catch { return null; }
}
/** POST returns Firebase's generated key, which we need in order to update the talk later. */
async function rPush(data: any): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/.json`, { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.name || null;
  } catch { return null; }
}
async function rPatch(path: string, data: any): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/${path}.json`, { method: 'PATCH', body: JSON.stringify(data) });
    return r.ok;
  } catch { return false; }
}

export type TalkStatus = 'pending' | 'open' | 'declined' | 'closed';
export interface Turn { by: 'from' | 'to'; text: string; ts: number }
export interface Talk {
  id: string;
  fromId: string; fromName: string;       // the person reaching out
  toId: string; toName: string;           // the wall author being reached
  wallMsgText: string;                    // what they wrote, so the recipient has context
  status: TalkStatus;
  turns: Turn[];
  maxTurns: number;                       // 2 normally, 4 once both agree to continue
  extendBy?: 'from' | 'to';               // who has asked to continue
  declineNote?: string;                   // the gentle "not right now" the recipient sent
  createdAt: number;
  updatedAt: number;
}

export const TEXT_LIMIT = 400;

// --- local blocklist: people this device never wants to hear from again ---
const BLOCK_KEY = 'tether_blocked';
export const blockedIds = (): string[] => {
  try { return JSON.parse(localStorage.getItem(BLOCK_KEY) || '[]'); } catch { return []; }
};
export const blockUser = (uid: string) => {
  try {
    const list = blockedIds();
    if (!list.includes(uid)) localStorage.setItem(BLOCK_KEY, JSON.stringify([...list, uid]));
  } catch { /* private mode */ }
};

const normalise = (id: string, raw: any): Talk => ({
  id,
  fromId: raw.fromId || '', fromName: raw.fromName || '',
  toId: raw.toId || '', toName: raw.toName || '',
  wallMsgText: raw.wallMsgText || '',
  status: (raw.status as TalkStatus) || 'pending',
  turns: Array.isArray(raw.turns) ? raw.turns : [],
  maxTurns: raw.maxTurns || 2,
  extendBy: raw.extendBy,
  declineNote: raw.declineNote,
  createdAt: raw.createdAt || 0,
  updatedAt: raw.updatedAt || raw.createdAt || 0,
});

const allTalks = async (): Promise<Talk[]> => {
  const obj = await rGet();
  if (!obj) return [];
  return Object.entries<any>(obj).map(([id, v]) => normalise(id, v));
};

/** Everything involving me, newest first, with blocked senders removed. */
export const myTalks = async (uid: string): Promise<Talk[]> => {
  const blocked = blockedIds();
  return (await allTalks())
    .filter((t) => (t.toId === uid || t.fromId === uid) && !blocked.includes(t.fromId))
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

/** Poll, but never while the tab is hidden — nobody should burn battery on a closed tab. */
export const listenToTalks = (uid: string, cb: (talks: Talk[]) => void, interval = 8000) => {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      try { cb(await myTalks(uid)); } catch { /* offline; try again next tick */ }
    }
    if (!stopped) setTimeout(tick, interval);
  };
  tick();
  return () => { stopped = true; };
};

/**
 * One live request per pair at a time. Without this, a single person could fill
 * someone's inbox with requests they have to keep declining.
 */
export const hasLiveTalkWith = async (fromId: string, toId: string): Promise<boolean> => {
  const talks = await allTalks();
  return talks.some((t) => t.fromId === fromId && t.toId === toId && (t.status === 'pending' || t.status === 'open'));
};

export const createTalk = async (
  from: { uid: string; name: string },
  to: { uid: string; name: string },
  wallMsgText: string,
  text: string,
): Promise<string | null> => {
  const now = Date.now();
  return rPush({
    fromId: from.uid, fromName: from.name || 'Someone',
    toId: to.uid, toName: to.name || '',
    wallMsgText: wallMsgText.slice(0, 300),
    status: 'pending',
    turns: [{ by: 'from', text: text.slice(0, TEXT_LIMIT), ts: now }],
    maxTurns: 2,
    createdAt: now, updatedAt: now,
  });
};

/** The recipient agrees to read it. Nothing is revealed to them before this. */
export const acceptTalk = (id: string) => rPatch(`${id}`, { status: 'open', updatedAt: Date.now() });

/**
 * "Not right now" — a decline that carries a kind, pre-written note rather than silence,
 * so saying no never has to feel like abandoning someone.
 */
export const declineTalk = (id: string, note: string) =>
  rPatch(`${id}`, { status: 'declined', declineNote: note, updatedAt: Date.now() });

export const addTurn = async (talk: Talk, by: 'from' | 'to', text: string): Promise<boolean> => {
  const turns = [...talk.turns, { by, text: text.slice(0, TEXT_LIMIT), ts: Date.now() }];
  const done = turns.length >= talk.maxTurns;
  return rPatch(`${talk.id}`, {
    turns,
    status: done ? 'closed' : 'open',
    extendBy: null,
    updatedAt: Date.now(),
  });
};

/** Continuing needs both sides: one asks, the other has to agree before it reopens. */
export const askToContinue = (id: string, by: 'from' | 'to') =>
  rPatch(`${id}`, { extendBy: by, updatedAt: Date.now() });

export const agreeToContinue = (talk: Talk) =>
  rPatch(`${talk.id}`, { maxTurns: talk.maxTurns + 2, status: 'open', extendBy: null, updatedAt: Date.now() });

export const endTalk = (id: string) => rPatch(`${id}`, { status: 'closed', extendBy: null, updatedAt: Date.now() });

/** Which side am I on in this talk? */
export const sideOf = (talk: Talk, uid: string): 'from' | 'to' => (talk.fromId === uid ? 'from' : 'to');

/** Whose turn is it — or nobody's, if the exchange has run its course. */
export const waitingOn = (talk: Talk): 'from' | 'to' | null => {
  if (talk.status !== 'open') return null;
  if (talk.turns.length >= talk.maxTurns) return null;
  const last = talk.turns[talk.turns.length - 1];
  return last?.by === 'from' ? 'to' : 'from';
};

/**
 * Send an abuse report to the site owner's private inbox.
 *
 * Blocking alone only protects the one person who pressed it — nobody would ever learn
 * that someone is working through the wall harassing people. This carries the reported
 * message itself, because a report you can't read is a report you can't act on. The UI
 * tells the reporter this before they tap it.
 */
export const reportTalk = async (talk: Talk, reporterName: string): Promise<boolean> => {
  const lines = [
    `举报 · Tether 一对一消息`,
    `对方: ${talk.fromName || '(无名)'} (${talk.fromId})`,
    `被举报者写的:`,
    ...talk.turns.filter((t) => t.by === 'from').map((t) => `  “${t.text}”`),
  ];
  try {
    const res = await fetch('https://elenaprojects.cc/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n').slice(0, 600), name: reporterName || '匿名', tool: 'report' }),
    });
    return res.ok;
  } catch { return false; }
};
