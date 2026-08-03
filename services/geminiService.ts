import { GoogleGenAI, Type } from "@google/genai";
import { TetherState, GuardianResult, Language } from "../types";

// In production the bundle carries NO real key — nginx injects it server-side (x-goog-api-key).
// The placeholder just lets the SDK construct; it's replaced at the proxy. In dev, the real
// key from .env.local flows through so the vite proxy works.
const apiKey = process.env.API_KEY || 'proxied';

// Route Gemini through our own origin (a same-origin /v1beta proxy) so moderation
// works on networks where googleapis.com is blocked (e.g. mainland China).
const httpOptions = typeof window !== 'undefined' ? { baseUrl: window.location.origin } : undefined;
const ai = new GoogleGenAI({ apiKey: apiKey, httpOptions } as any);

/**
 * THE GUARDIAN
 * Filters user content for the "Anchored" users.
 */
export const moderateContent = async (text: string, language: Language): Promise<GuardianResult> => {
  if (!apiKey) throw new Error("API Key missing");

  const prompt = `
    Role: You are "The Guardian", a STRICT safety filter for a mental-health support app for teenagers.
    A struggling stranger will read this message. This place is for warmth ONLY.
    Be very strict. When in ANY doubt, BLOCK. Not even a little negativity is allowed.
    Target Language for Reason: ${language}

    BLOCK (isSafe=false) if the message contains ANY of the following, even slightly:
    - Negativity, criticism, blame, judgment, sarcasm, mockery, teasing, or dark/cynical humor
    - Discouragement, hopelessness, coldness, dismissiveness, or anything that could make someone feel worse
    - Toxicity, insults, hostility, hate, swearing
    - Flirting, dating, romantic or sexual content
    - Medical/clinical advice or diagnoses
    - Personal contact info (phone, email, social handles) or requests to meet/add each other
    - Any mention or encouragement of self-harm or suicide (even indirect)
    - Pressure, guilt-tripping, commands, or conditional kindness
    - Anything ambiguous, edgy, or that is NOT clearly warm and supportive
    - Meaningless spam, gibberish, or off-topic content

    ALLOW (isSafe=true) ONLY if the message is clearly gentle, warm, kind, comforting and encouraging.

    Message: "${text}"

    Return JSON:
    {
      "isSafe": boolean,
      "reason": "Short gentle explanation in ${language} if blocked, otherwise null"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
          },
          required: ["isSafe"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      isSafe: result.isSafe,
      reason: result.reason,
      originalText: text
    };

  } catch (error) {
    console.error("Guardian Logic Failed:", error);
    return { isSafe: false, reason: "Guardian connection error." };
  }
};

/**
 * THE FALLBACK
 * Generates poetic comfort for "Drifting" users.
 */
export const generateFallbackMessage = async (state: TetherState, language: Language): Promise<string> => {
  if (!apiKey) return "The silence is holding you.";

  const prompt = `
    Role: You are "Tether", an AI companion for a user in a low-energy or painful state.
    User State:
    - Valence (Happiness): ${state.valence}/100 (Low is sad, high is happy)
    - Arousal (Energy): ${state.arousal}/100 (Low is calm/lethargic, high is agitated)

    Target Language: ${language} (Return ONLY the message in this language)

    Task: Write a single, very short sentence (max 15 words) of poetic comfort matching their specific state.

    CRITICAL LOGIC:
    - High Arousal + Low Valence (Anxiety): Speak of calm, grounding, slowing down.
    - Low Arousal + Low Valence (Depression): Speak of presence, small lights, waiting, the earth holding them.
    - Low Valence generally: witness the heaviness gently; never dismiss or rush it.

    Tone: Gentle, non-intrusive, abstract, witnessing.

    Examples (English):
    - "The fog is thick, but the ground remains." (Depression)
    - "You do not need to be whole to be here." (Low)
    - "Rest in the quiet spacing between things." (Anxiety)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text?.trim() || "The ground is still beneath you.";
  } catch (error) {
    return "You are seen in the dark.";
  }
};

/**
 * REFLECT — a warm, witnessing reply to a private self-reflection the user just wrote in the
 * Reset Kit. Only they see it. Validates and reflects back with warmth; never advice, never
 * judgment. If the words sound like real danger, it gently encourages reaching out for help.
 */
export const reflectReply = async (text: string, language: Language): Promise<string> => {
  const fallback = language === 'zh'
    ? '谢谢你把它说出来。此刻，就让自己被这样听见，已经很好了。'
    : "Thank you for putting it into words. For now, just let yourself be heard — that's enough.";
  if (!apiKey) return fallback;

  const prompt = `
    You are a warm, gentle companion inside a mental-health app for teenagers. The user has just
    written down, privately, what they are noticing or feeling right now. Only they will read
    your reply.

    Reply in ${language}, in 1–2 short sentences. GENTLY WITNESS and VALIDATE what they shared:
    reflect it back with warmth, name the feeling if it's clear, let them feel heard.
    - Never judge, lecture, diagnose, or give advice or fixes.
    - Never minimize or rush them ("it'll be fine", "cheer up", "at least...").
    - No clichés. Sound like a caring human, not a poster.
    - If their words suggest they might be in real danger or thinking of hurting themselves,
      warmly and without alarm encourage them to reach out to someone they trust or a helpline,
      and remind them they don't have to carry it alone.

    Their words: "${text}"

    Return ONLY the reply text, in ${language}.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text?.trim() || fallback;
  } catch (error) {
    return fallback;
  }
};