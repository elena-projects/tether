# Tether Product Audit

Date: 2026-10-07

Implementation update: the first-pass recommendations for landing-page entry,
identity/privacy copy, mood-control accessibility, support-link visibility, and reduced
motion were implemented and rechecked at 1280 x 720 and 390 x 844. Updated screenshots
are in `revised/`.

## Scope

Combined UX and accessibility review of the first-time path on desktop and mobile:
landing, identity entry, welcome, mood check-in, reflection, community stream, and
breathing close.

## Overall Verdict

Tether has a distinctive and emotionally coherent core. The product avoids noisy
gamification, the mood-to-reflection transition feels humane, and the breathing close
gives the journey a real ending. The largest problems are concentrated at the entrance
and in accessibility, not in the visual concept.

## Flow

1. Landing and identity entry — Needs work
   - The value proposition is calm and clear.
   - At 1280 x 720, the identity entry and primary action fall below the first viewport.
   - At 390 x 844, users must scroll through all three explanatory sections before they
     can begin.
   - The identity prompt is a clickable `div`, not an initially visible form field.

2. Personal welcome — Healthy
   - Warm, focused, and easy to understand.
   - The single primary action has strong hierarchy on desktop and mobile.

3. Mood check-in — Strong concept, accessibility risk
   - The two-dimensional valence x arousal control is the product's clearest signature.
   - The control is pointer-only and exposes no keyboard, slider, or accessible value.
   - Desktop height around 720px can push the Continue action below the viewport.

4. Reflection — Healthy
   - The short response validates without crowding the user with advice.
   - The permanent crisis-support action is visually too faint for a safety-critical link.

5. Community stream — Mostly healthy
   - Real messages make the product feel inhabited and credible.
   - The highest-resonance message gives the stream a clear start.
   - Message quality is uneven, so all new posts now pass through the deployed
     server-side Guardian moderation endpoint before Firebase accepts them.

6. Breathing close — Healthy
   - The experience ends quietly instead of trapping the user in an endless feed.
   - Motion needs a reduced-motion alternative and non-visual inhale/exhale status.

## Highest-Priority Changes

1. Put identity entry and the primary action in the first viewport. Move the three value
   explanations below it or collapse them into one short line.
2. Make identity entry a visible labeled input. Explain that it is a display name and how
   it is stored before asking for it.
3. Rebuild the mood pad as an accessible composite control with keyboard arrows, focus
   styling, ARIA values, and two ordinary range inputs as a fallback.
4. Increase contrast for secondary text and the real-person support action. Safety links
   should not use `opacity-40` as their resting state.
5. Keep server-side wall moderation fail-closed and monitor blocked/error rates as usage
   grows.
6. Add `prefers-reduced-motion` behavior for floating, pulsing, and breathing animations.

## Evidence

- `01-landing.jpg`: desktop landing
- `02-welcome.jpg`: desktop welcome
- `03-mood-checkin.jpg`: desktop mood check-in
- `04-reflection.jpg`: desktop reflection
- `05-community-stream.jpg`: desktop community stream
- `06-breathing.jpg`: desktop breathing close
- `07-mobile-landing.jpg`: mobile landing first viewport
- `08-mobile-entry-control.jpg`: mobile identity entry after scrolling
- `09-mobile-welcome.jpg`: mobile welcome
- `10-mobile-mood-checkin.jpg`: mobile mood check-in
- `11-mobile-community-stream.jpg`: mobile community stream

## Evidence Limits

This review used screenshots, accessibility snapshots, source inspection, production
endpoint checks, and Firebase permission probes. It does not claim WCAG conformance.
Screen-reader behavior, measured color contrast ratios, and focus order across every modal
still need dedicated testing.
