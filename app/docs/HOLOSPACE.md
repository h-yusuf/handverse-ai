# HoloSpace — Phase 1

HoloSpace is a new main navigation destination (`page === 'holospace'` in the existing state-based router). Existing arcade, Hand Pong, Creative Studio and AR Playground remain available.

## Delivered

- Landing page with camera/tracking status, explicit camera activation, instructions and resume.
- Full-display camera workspace using the existing stream, mirrored with aspect-preserving `contain`. The existing normalized, calibrated global cursor is reused; no additional camera acquisition or inference model/loop.
- Browser Fullscreen API with fullscreenchange handling, denied/unavailable fallback, visible Exit and Escape. Tauri uses narrowly scoped Rust commands for the invoking window's native fullscreen API; native state is polled while immersive mode is active to observe system fullscreen exits.
- Single-instance window lifecycle: open, close, minimize, restore, compact z-order/focus, title dragging, visible resize handles, boundary snapping and viewport clamping. Title bars support arrow-key movement; resize handles support arrow-key resizing. Windows preserve normalized coordinates across display changes.
- Radial launcher via open palm held for 850 ms, visible Apps button, or Alt+Space. Includes YouTube, Music, Maps, Notes, Timer, Calculator. Notes works locally; other apps explicitly show “Coming in Phase 2/3.” No external embeds or arbitrary code execution.
- Existing pinch hysteresis plus release-to-arm, 220 ms manipulation hold, primary-hand ownership, 350 ms stale-frame cancellation, tracking-loss recovery, and cancellation on blur/visibility loss. Global cursor renders while its click/dwell activation is suspended only during immersive HoloSpace ownership. Pointer and hand manipulation cannot both own a window.
- Versioned `handverse.holospace.v1` local storage through existing storage helpers. Saves windows, geometry, minimization, stacking, Notes text and dim preference; validates restored data and display boundaries. Explicit Save/Restore/Reset, debounced autosave and save on exit. No webcam footage saved.
- Cyan/lavender glass-style overlays with readable dark panels, corner brackets, adjustable dimming, no particle effects or expensive backdrop blur. Direct DOM transforms during movement avoid React state updates per motion frame. Reduced-motion support; shadows removed at narrow widths. Work is suspended when this workspace is inactive.

## Files

Created: `src/holospace/HoloSpace.tsx`, `model.ts`, `fullscreen.ts`, `holospace.css`; `tests/holospace.test.ts`; this document.
Modified: `src/App.tsx`, `src/TrackingLayer.tsx`, `src/services/vision.ts`, `src/services/hand-navigation.ts`, `src/main.rs`.

## Verification and limits

83 tests pass across 9 test files. HoloSpace's 9 focused tests cover lifecycle/focus, drag/resize/boundaries, validated save/restore, ownership, hold/release/loss recovery, and mocked web/native fullscreen transitions. Production TypeScript/Vite build passes. Craft Anything rebuild_check passed desktop build, native startup/screenshot and existing game smoke checks. Native Rust commands compile through the desktop build. No new JavaScript package or broad Tauri capability permission was introduced.

Physical webcam gestures, actual native fullscreen transitions, Windows execution, Safari/Firefox fullscreen behavior and achieved hardware frame rate have not been tested. Reference mechanics comparison remains unmeasured, as reported by rebuild_check. Notes requires keyboard text entry; pinch focuses it. Camera preview preserves its full aspect ratio with letterboxing; the shared global cursor uses viewport coordinates, just like the existing HANDVERSE UI. Swipes are intentionally omitted. Later integrations and Phases 2–4 are not implemented.
