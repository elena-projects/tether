// Simple Drone Generator using Web Audio API
// Generates a binaural beat effect for relaxation

let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let osc1: OscillatorNode | null = null;
let osc2: OscillatorNode | null = null;

const FADE_TIME = 2; // Seconds

export const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.connect(audioCtx.destination);
  }
};

// Mobile browsers create every AudioContext in a "suspended" state and will stay
// silent until resume() is called from inside a real user gesture (tap/click).
// Call this from a touch/click handler once, early, to unlock playback on phones.
export const unlockAudio = () => {
  if (!audioCtx) initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
};

export const startHealingDrone = () => {
  if (!audioCtx) initAudio();
  if (!audioCtx || !gainNode) return;

  // On mobile the context may still be suspended — resume it so the drone is audible.
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

  // If already playing, just ensure volume is up
  if (osc1 && osc2) {
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + FADE_TIME);
    return;
  }

  // Oscillator 1: Base Tone (Theta wave range carrier)
  osc1 = audioCtx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(110, audioCtx.currentTime); // 110Hz (Low A)

  // Oscillator 2: Detuned slightly to create a "beat" (Binaural effect)
  osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(114, audioCtx.currentTime); // 4Hz difference = 4Hz beat (Theta relaxation)

  osc1.connect(gainNode);
  osc2.connect(gainNode);

  osc1.start();
  osc2.start();

  // Fade In
  gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + FADE_TIME);
};

export const stopHealingDrone = () => {
  if (!audioCtx || !gainNode) return;

  // Fade Out
  gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + FADE_TIME);

  // Stop oscillators after fade
  setTimeout(() => {
    if (gainNode?.gain.value === 0) {
      if (osc1) { osc1.stop(); osc1.disconnect(); osc1 = null; }
      if (osc2) { osc2.stop(); osc2.disconnect(); osc2 = null; }
    }
  }, FADE_TIME * 1000 + 100);
};