# Responsive Layout

Layout responds to available CSS viewport dimensions, not device model names.

- Below 640px, check-in controls stack vertically. The entry-page feature list uses compact icon/text rows.
- At 640px and above, check-in controls sit beside the orb.
- Navigation stays in two rows below 1100px, then becomes one row with a 1440px maximum width.
- Windows at most 700px tall use smaller orb sizing and spacing. Landscape windows at least 568px wide and at most 500px tall use side-by-side check-in controls.
- Safe-area insets protect controls near cutouts and gesture bars. Content scrolls rather than being cropped.
- Fixed overlays track VisualViewport height and offset when not pinch-zoomed. Dialog content scrolls within the visible area.
- Inputs use at least 16px text below 1100px to avoid focus zoom on mobile Safari.
- Hidden history and the main screen behind the entry/welcome overlays are inert.

## Verification (2026-10-07)

Browser viewport checks covered 320x568, 390x844, 430x932, 667x375,
768x1024, 1024x768, 1366x768, 1920x1080, and 2560x1440.
No document horizontal overflow or intersecting navigation groups was detected.
Header buttons have at least 44x44px touch targets.

The entry, welcome, check-in, reflection, and neutral response screens were inspected.
Feedback, reset tools, wall, support, and history overlays were opened and measured.
At a simulated 390x350 available viewport, the feedback panel fit within 16px margins,
scrolled internally, and keyboard focus brought the Send button into view. Its text
input computed to 16px. No feedback or mood data was sent by the isolated local harness.

These are browser viewport simulations, not physical-device certification. Actual
iOS/Android keyboard behavior, pinch zoom, and hardware safe-area insets still need
device testing. No claim is made that every individual device model was tested.
