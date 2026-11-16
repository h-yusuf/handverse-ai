# HANDVERSE Gesture Reactive Playground V2

The existing sidebar, five mini-games, global hand tracking provider, shared camera/MediaPipe instance, bundled model and WASM assets, and Tauri 2 platform configurations are preserved. No new dependencies or development-server requirements were added.

## Implementation

Created `src/ar/gestures.ts` (reusable pose/motion state engine), `src/ar/hud.ts` (landmark HUD and reactive effects), `src/ar/GestureStudio.tsx` (saved preferences), `src/services/hand-landmarks.ts` (anatomical connections), and `tests/gesture-engine.test.ts`.

Updated `src/ARPlayground.tsx`, `src/ar/interaction.ts`, `src/ar/renderer.ts`, `src/ar/playground.css`, `src/ar/smoke-test.ts`, `src/TrackingLayer.tsx`, `src/services/hand-navigation.ts`, `src/services/vision.ts`, and `tests/ar-playground.test.ts`.

The previous Floating Code, Hologram Lab and Gesture Visualizer remain available alongside Gesture Reactive. Gesture Studio is a subpage with the same actual camera preview. It saves effect mappings, colors, intensity, particles, skeleton stroke/dot size, tracking smoothing, sensitivity, hold duration, opacity and quality locally; Reset to Defaults restores all preferences. Reset positions separately clears scene placement.

## Definitions and thresholds

Distances are normalized by wrist-to-middle-MCP palm size, with input aspect ratio corrected before classification. These are screen-plane heuristics, not a trained gesture model or metric depth estimate.

- A non-thumb finger is extended when tip-to-wrist / PIP-to-wrist exceeds 1.16 and tip-to-MCP / palm size exceeds 0.55.
- Thumb extension requires thumb-tip to pinky-MCP / palm > 1.25 and thumb-tip to thumb-MCP / palm > 0.5.
- Priority is PINCH, L_SHAPE, OPEN_PALM, FIST, PEACE, POINT, then NONE. L_SHAPE requires extended thumb and index with the remaining fingers folded; POINT additionally requires the thumb folded. PEACE requires extended index/middle and folded ring/pinky. OPEN_PALM requires all five extended; FIST requires all folded.
- PINCH enters below 0.30 palm lengths and releases above 0.48, multiplied by Studio sensitivity (0.65–1.4, default 1).
- Default minimum hold: 120 ms (configurable 80–500 ms). Transitions explicitly emit ENTER, ACTIVE, EXIT and IDLE. Switching poses passes through EXIT; a 100 ms reentry cooldown prevents immediate conflicting activation.
- Landmark/palm exponential smoothing defaults to 65 ms (0–180 ms). Pose confidence derives from distance to classification thresholds; it is labeled a heuristic. MediaPipe's genuine handedness score is labeled separately, never described as hand-detection confidence.
- Tracking loss after 250 ms exits states, releases grabs and dual manipulation, and resets smoothing/history. Recovery requires a new stable hold. Inactive per-hand records expire after 2.5 seconds. Short-lived handedness flips are matched to nearby prior palm tracks; identity during complete occlusion or crossing hands remains ambiguous.
- SWIPE_LEFT/RIGHT require an active open palm, at least 110 ms of history (320 ms window), horizontal travel > 1.2 palm lengths, vertical travel < 0.65 palm lengths, and 850 ms cooldown. Directions follow the displayed mirroring.
- PALM_ROTATION measures the index-to-pinky MCP axis changing by > 0.35 radians, with the same motion cooldown.
- TWO_HAND_PINCH requires two independently stable pinches. TWO_HAND_DISTANCE_CHANGE reports > 8% separation change. Scaling uses current separation / initial separation, clamped to 25–300%, and rotation uses the relative screen-plane angle (clamped to ±π). Position/scale/rotation interpolate; releasing or losing one hand retains the last transform and rebases on reacquisition.

## Working effects

L_SHAPE draws a thin glass frame bounded by the real thumb/index tips with cyan corners and pixel measurement labels. PINCH maintains one orb per tracked hand at the thumb/index midpoint, with rings, pooled attraction particles and a subtle trail. OPEN_PALM displays rotating radial rings and diagnostics around the palm. FIST collapses visible scene elements toward the palm with lavender particles and shrinking rings; dropped panel positions and the two-hand object transform survive. POINT extends a fine line along the real index finger direction, with a target reticle and hover feedback. PEACE shows two readable syntax-highlighted code panels near the index/middle tips, using locally bundled original JavaScript, Rust and Python examples; swipes cycle samples. Studio can remap any pose to any effect.

The live HUD draws all 21 points and anatomical connections in white by default (1.5 px strokes, 4 px dots). Independent controls show/hide the skeleton, point numbers, fingertip pixel coordinates, brackets and diagnostics. Palm markers, labels and leader lines share the exact mirrored object-fit-cover projection as the camera.

## Input and performance

The camera workspace owns AR pinches. Pinches inside that region cannot activate UI; navigation and settings outside it retain global hand cursor/pinch interaction, plus mouse/keyboard support. The pinch latch continues updating inside AR so a held pinch cannot create a new click when crossing into UI. Leaving AR restores normal ownership. Mini-game control code is unchanged.

The existing WebGL renderer handles the camera and perspective wireframes with persistent GPU buffers; a transparent Canvas 2D layer handles the fine HUD, text and small effects. Particle seeds are pooled. Landmark updates stay outside React; UI diagnostics update at the provider's throttled rate. Adaptive quality reduces resolution, particle count and render cadence. Hidden windows skip rendering; leaving the page unsubscribes and disposes graphics resources. Render FPS, inference FPS and inference latency are measured. No 60 FPS hardware guarantee is claimed.

## Verification

49 automated tests pass, including classification across scales/rotations, pose priority, state transitions, hold/cooldown, pinch hysteresis, tracking loss/recovery, swipe cooldown, two-hand relative scaling/rotation/release, coordinate mapping, saved settings, AR ownership, and all six effect paths using synthetic landmarks. Existing navigation and camera-service tests remain passing.

Production TypeScript/Vite build and macOS ARM64 Tauri app build succeed. Local SIMD/non-SIMD MediaPipe WASM and model checks pass. The existing nine nonfatal Objective-C macro warnings remain. The repository's release/asset/frontend/test/Rust CI checks pass.

Physical webcam performance/gesture tuning, complete occlusions, Windows-native builds and Windows webcam execution require testing on those devices. Synthetic sequences and packaged smoke tests do not replace physical camera testing. 2.5D positions do not imply physically accurate depth, occlusion or room mapping.

Final `rebuild_check` passed production build, native launch/screenshot, pointer gameplay/HUD, WebGL startup (linked shader, error 0), AR mode switching, Gesture Studio/UI ownership, immersive controls, navigation cleanup, and bundled SIMD/non-SIMD runtime initialization/inference on a blank canvas. The captured arcade screenshot was inspected; no physical camera session was performed. Reference mechanics behavior comparisons remain explicitly incomplete; the mechanics sheet's values were not measured against reference inputs.
