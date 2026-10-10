import { Language } from '../types';

type ScreenResult = {
  allowed: boolean;
  crisis: boolean;
  heavy: boolean;
  reason?: string;
  screened: boolean;
};

const FALLBACKS = {
  ground: {
    zh: '你把身边一样样看清楚了。此刻，你就在这里。',
    en: "You noticed each thing around you, one by one. Right now, you're here.",
  },
  worry: {
    zh: '把它写下来，已经是在照顾自己了。先放这儿，过些天你可以回来看看它到底有没有发生。',
    en: "Writing it down is already looking after yourself. Leave it here for now — you can come back later and see whether it actually happened.",
  },
} as const;

async function companion(action: 'ground' | 'worry' | 'screen', text: string, language: Language) {
  const response = await fetch('/api/companion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, text, language: language === 'en' ? 'en' : 'zh' }),
  });
  if (!response.ok) throw new Error('companion_unavailable');
  return response.json();
}

export async function groundingReply(text: string, language: Language): Promise<string> {
  const fallback = FALLBACKS.ground[language === 'en' ? 'en' : 'zh'];
  try {
    const result = await companion('ground', text, language);
    return typeof result.reply === 'string' && result.reply.trim() ? result.reply.trim() : fallback;
  } catch {
    return fallback;
  }
}

export async function worryReply(text: string, language: Language): Promise<string> {
  const fallback = FALLBACKS.worry[language === 'en' ? 'en' : 'zh'];
  try {
    const result = await companion('worry', text, language);
    return typeof result.reply === 'string' && result.reply.trim() ? result.reply.trim() : fallback;
  } catch {
    return fallback;
  }
}

export async function screenConfide(text: string, language: Language): Promise<ScreenResult> {
  try {
    const result = await companion('screen', text, language);
    return {
      allowed: result.allowed === true,
      crisis: result.crisis === true,
      heavy: result.heavy === true || result.crisis === true,
      reason: typeof result.reason === 'string' ? result.reason : undefined,
      screened: true,
    };
  } catch {
    return { allowed: false, crisis: false, heavy: false, screened: false };
  }
}
