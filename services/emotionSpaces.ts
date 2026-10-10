import { EMOTION_SPACES } from '../integrations/shared/emotion-spaces.js';
export { EMOTION_SPACES };
export type EmotionId = keyof typeof EMOTION_SPACES;
export interface EmotionNote { id: string; text: string; timestamp: number; encouragements: Record<string, number>; }
export class SpaceError extends Error {
  constructor(public code: string, public needsSupport = false) { super(code); }
}
async function request(url: string, options?: RequestInit) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options?.signal?.addEventListener('abort', cancel, { once: true });
  if (options?.signal?.aborted) controller.abort();
  const timeout = setTimeout(cancel, 28000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (response.status === 429) throw new SpaceError('rate_limit');
    const data = await response.json();
    if (!response.ok) throw new SpaceError(data.error || 'unavailable', data.needsSupport === true);
    return data;
  } finally {
    clearTimeout(timeout);
    options?.signal?.removeEventListener('abort', cancel);
  }
}
export function readSpace(emotion: EmotionId, cursor: string | null, signal: AbortSignal): Promise<{ notes: EmotionNote[]; cursor: string | null }> {
  return request(`/api/spaces?${new URLSearchParams({ emotion, ...(cursor ? { cursor } : {}) })}`, { signal });
}
export function leaveNote(emotion: EmotionId, text: string, language: string): Promise<{ note: EmotionNote }> {
  return request('/api/spaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'note', emotion, text, language }) });
}
export function encourageNote(emotion: EmotionId, id: string, choice: number): Promise<{ choice: number; count: number }> {
  return request('/api/spaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'encourage', emotion, id, choice }) });
}
