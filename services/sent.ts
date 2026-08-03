// The kind words YOU sent (to a drifting stranger or the public wall). Stored device-wide but
// each record is stamped with the identity that wrote it, so you only ever see your own — a
// different person on the same browser sees none. Same identity rule as the emotion journal:
// a record is yours if its id matches your identity id, or its owner is your username.

export interface SentMessage {
  id: number;
  timestamp: number;
  text: string;
  target?: string;
  uid?: string;
  owner?: string;
}

const KEY = 'my_sent_messages';

const identity = () => ({
  uid: (typeof localStorage !== 'undefined' && localStorage.getItem('tether_uid')) || '',
  name: ((typeof localStorage !== 'undefined' && localStorage.getItem('tether_username')) || '').trim().toLowerCase(),
});

export const readOwnSent = (): SentMessage[] => {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '[]') as SentMessage[];
    const { uid, name } = identity();
    return all.filter((m) => (m.uid && m.uid === uid) || (m.owner && name && (m.owner || '').trim().toLowerCase() === name));
  } catch {
    return [];
  }
};

export const appendSent = (msg: SentMessage) => {
  try {
    const { uid } = identity();
    const owner = (typeof localStorage !== 'undefined' && localStorage.getItem('tether_username')) || undefined;
    const rec: SentMessage = { ...msg, uid: uid || undefined, owner };
    const all = JSON.parse(localStorage.getItem(KEY) || '[]');
    localStorage.setItem(KEY, JSON.stringify([rec, ...all].slice(0, 50)));
  } catch {}
};
