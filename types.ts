// The internal state of the user based on Circumplex Model
export interface TetherState {
  valence: number; // 0 (Unpleasant) to 100 (Pleasant) - X Axis
  arousal: number; // 0 (Low Energy) to 100 (High Energy) - Y Axis
  body: number; // 0 (Shattered) to 100 (Whole)
}

// The user's role based on their Valence state
export enum TetherRole {
  DRIFTING = 'DRIFTING', // Valence < 40
  WITNESS = 'WITNESS',   // Valence 40 - 60
  ANCHORED = 'ANCHORED'  // Valence > 60
}

// Supported languages
export type Language = 'en' | 'zh' | 'es' | 'ja' | 'fr' | 'de' | 'ko';

// Moderation result from the Guardian AI
export interface GuardianResult {
  isSafe: boolean;
  reason?: string;
  originalText?: string;
}

// A message in the system
export interface Message {
  id: string;
  text: string;
  senderName: string; // Now required
  senderId: string;
  targetId?: string; // If null, it might be a broadcast/community message
  timestamp: number;
  voteCount: number; // The "Heart" count
  type: 'human' | 'ai';
}

// Social Platform Types
export interface UserProfile {
  uid: string;
  username: string;
  state: TetherState;
  lastActive: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  state: TetherState;
  note?: string; // If they sent/received a message at this time
}