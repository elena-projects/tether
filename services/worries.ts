// Worry postponement + outcome journaling (a CBT staple): write a worry down to set it aside,
// then later look back and mark whether it actually happened. Over time you see, in your own
// hand, that most worries never came true. Stored per identity, like the journal / sent record.

export type WorryOutcome = 'none' | 'partial' | 'came_true';

export interface Worry {
  id: number;
  text: string;
  t: number;                 // when it was written
  outcome?: WorryOutcome;    // set later, on looking back
  note?: string;             // what actually happened / what you learned
  resolvedAt?: number;
  uid?: string;
  owner?: string;
}

const KEY = 'tether_worries';

const identity = () => ({
  uid: (typeof localStorage !== 'undefined' && localStorage.getItem('tether_uid')) || '',
  name: ((typeof localStorage !== 'undefined' && localStorage.getItem('tether_username')) || '').trim().toLowerCase(),
});

const readAll = (): Worry[] => {
  try {
    return (JSON.parse(localStorage.getItem(KEY) || '[]') as any[]).map((w) => ({ id: w.id ?? w.t, ...w }));
  } catch {
    return [];
  }
};

export const readOwnWorries = (): Worry[] => {
  const { uid, name } = identity();
  return readAll().filter((w) => (w.uid && w.uid === uid) || (w.owner && name && (w.owner || '').trim().toLowerCase() === name));
};

export const appendWorry = (text: string) => {
  try {
    const { uid } = identity();
    const owner = (typeof localStorage !== 'undefined' && localStorage.getItem('tether_username')) || undefined;
    const now = Date.now();
    const rec: Worry = { id: now, text, t: now, uid: uid || undefined, owner };
    localStorage.setItem(KEY, JSON.stringify([rec, ...readAll()].slice(0, 100)));
  } catch {}
};

export const updateWorry = (id: number, patch: Partial<Pick<Worry, 'outcome' | 'note'>>) => {
  try {
    const all = readAll().map((w) => (w.id === id ? { ...w, ...patch, resolvedAt: patch.outcome ? Date.now() : w.resolvedAt } : w));
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
};
