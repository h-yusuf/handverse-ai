# Air Canvas 2D — Phase 1

Creative Studio adds Air Canvas without changing game implementations, Hand Pong multiplayer, AR Playground, camera acquisition or inference scheduling. It subscribes to the existing global MediaPipe service; its animation frame only renders camera, ink and HUD layers.

## Files

- `src/studio/AirCanvas.tsx`: workspace, shared-camera subscription, gesture ownership, pointer/touch fallback, toolbar, dialogs, fullscreen/immersive fallback, PNG/project/video export, replay.
- `src/studio/engine.ts`: structured strokes with timestamps and brush parameters, adaptive smoothing, confidence/staleness/jump handling, release-to-rearm, held pose recognition, history, pan/zoom, validated local project format.
- `src/studio/render.ts`: Canvas 2D curves, five brushes, erasing, glow, lightweight deterministic spark trails, velocity width and optional light fading, mirrored camera composition, runtime video format detection.
- `src/studio/studio.css`: responsive HANDVERSE dark surfaces, pastel accents, floating toolbar and immersive layout.
- `src/App.tsx`: Creative Studio navigation, breadcrumb and workspace route.
- `src/TrackingLayer.tsx`, `src/services/vision.ts`, `src/services/hand-navigation.ts`: canvas gesture ownership and raw-camera-aware input exclusion; navigation remains available outside the canvas and on toolbar controls.
- `tests/air-canvas.test.ts`: synthetic gesture transitions, confidence loss, discontinuities, mappings, history, document restoration, ownership, held gestures and pan/zoom.
- `src/selftest.ts`: packaged desktop drawing, actual PNG header, pixel history and fullscreen preservation checks alongside existing game tests.

## Behavior

Index fingertip positions are mirrored and cropped using the same transformation as camera pixels. Thumb/index pinch uses the global provider's existing hysteresis. A release is required after hand loss, identity change or two-hand zoom. Low-confidence hands, gaps above 220 ms and jumps above 180 screen pixels end strokes. Open palm, peace sign and index/middle/ring poses require a 600 ms hold; tool activations have a 1600 ms cooldown. Two pinching hands take precedence over ink. Points are smoothed adaptively according to displacement without per-frame React state updates.

Undo/redo includes eraser strokes. Clear requires confirmation. Project JSON includes a version, 1280 × 960 document dimensions, viewport, strokes, points, timestamps and settings, and is validated before replacement. Loading adjusts the drawing clock for subsequent strokes. CSS resizing and fullscreen do not resize or erase the logical canvas.

PNG is 1280 × 960 at the current viewport; transparent export excludes camera and HUD, and camera export requires an active readable shared video. Timelapse uses original stroke timing, excludes the camera, and records a dark background when exporting video. It picks a working advertised MediaRecorder MIME type (WebM variants preferred; MP4 only when explicitly supported by the running platform). Unsupported capture/encoder capabilities show a message. Save/load and exports use local browser downloads/files, with no backend or uploads.

## Validation and limits

74 Vitest tests pass. Production TypeScript/Vite build and macOS `cargo check --locked` pass (existing Objective-C macro warnings). Craft Anything `rebuild_check` passed build, native startup screenshot, existing game and AR smoke checks, packaged SIMD/non-SIMD initialization and inference. Packaged Air Canvas checks passed: 937 visible stroke pixels, undo/redo pixel restoration, actual PNG IHDR dimensions 1280 × 960, and fullscreen enter/exit preserving drawing.

No physical webcam or real-hand/two-hand test was performed. Windows native execution, platform download dialogs and real video encoder output remain unverified; video support is capability checked at runtime. Mechanics values from the existing reference sheet have not been measured against reference behavior. Large documents require replaying more stored segments and have no unlimited-size performance guarantee. Three-finger recognition is conservative and depends on landmark quality. Drawing remains session-local until the user saves a project. No later Creative Studio phases or multiplayer changes are included.
