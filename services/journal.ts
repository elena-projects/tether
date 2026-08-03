// The emotion journal ("your journey" / trend / "what you told yourself") lives in one
// device-wide localStorage key, but each entry is tagged with the identity that wrote it so
// a reader only ever sees its OWN entries. A fresh identity on a shared browser starts empty
// instead of inheriting whatever the previous person logged. Matches the sent-message rule:
// an entry belongs to you if its id matches your identity id, or its owner is your username.

export interface JournalEntry {
  id: number;
  timestamp: number;
  valence: number;
  arousal: number;
  message: string;
  uid?: string;
  owner?: string;
}

const KEY = 'tether_journey_log';

const currentIdentity = () => ({
  uid: (typeof localStorage !== 'undefined' && localStorage.getItem('tether_uid')) || '',
  name: ((typeof localStorage !== 'undefined' && localStorage.getItem('tether_username')) || '').trim().toLowerCase(),
});

// Read only the entries that belong to the person currently signed in.
export const readOwnJournal = (): JournalEntry[] => {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '[]') as JournalEntry[];
    const { uid, name } = currentIdentity();
    return all.filter((e) => (e.uid && e.uid === uid) || (e.owner && name && (e.owner || '').trim().toLowerCase() === name));
  } catch {
    return [];
  }
};

// Append a new entry, stamped with the current identity. Keeps a generous cap so several
// people sharing one browser don't evict each other's history.
export const appendJournal = (entry: JournalEntry) => {
  try {
    const { uid } = currentIdentity();
    const owner = (typeof localStorage !== 'undefined' && localStorage.getItem('tether_username')) || undefined;
    const rec: JournalEntry = { ...entry, uid: uid || undefined, owner };
    const all = JSON.parse(localStorage.getItem(KEY) || '[]');
    localStorage.setItem(KEY, JSON.stringify([rec, ...all].slice(0, 200)));
  } catch {}
};
