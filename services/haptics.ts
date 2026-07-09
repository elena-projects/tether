// Gentle haptic feedback via the Web Vibration API.
//
// IMPORTANT: this only works on browsers that support navigator.vibrate —
// notably Android (Chrome/Edge/Firefox). iOS Safari does NOT support web
// vibration at all, so on iPhones/iPads these calls simply do nothing.
// Everything below is guarded so it never throws on unsupported devices.

export const hapticsSupported =
  typeof navigator !== 'undefined' && typeof (navigator as any).vibrate === 'function';

export const vibrate = (pattern: number | number[]) => {
  try {
    if (hapticsSupported) (navigator as any).vibrate(pattern);
  } catch {
    /* ignore — device doesn't allow it */
  }
};

export const stopVibration = () => {
  try {
    if (hapticsSupported) (navigator as any).vibrate(0);
  } catch {
    /* ignore */
  }
};
