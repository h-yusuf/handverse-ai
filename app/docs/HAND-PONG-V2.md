# Hand Pong v2 — Phase 1

Implemented only Solo vs AI. Local and Online Multiplayer are disabled Coming Soon choices. Existing global MediaPipe, gesture cursor, navigation, other games, AR workspace and platform integrations are retained.

## Files

- `src/games/pong/simulation.ts`: independent physics, adaptive palm filter and AI.
- `src/games/pong/PongView.tsx`: Pong canvas renderer, input subscription, bounded effects pools and match UI.
- `src/games/pong/pong.css`: scoped HANDVERSE controls and responsive game layout.
- `src/GameView.tsx`: routes Pong to its v2 component; other games use the original view.
- `src/App.tsx`: Pong arcade label and removal of the obsolete Two-hand Pong settings switch.
- `src/games/engine.ts`: Pong arcade metadata now says Solo vs AI.
- `src/selftest.ts`: selects the new Start round button in the mode screen.
- `tests/pong.test.ts`: 14 focused behavioral tests.

## Physics and input

The logical court remains 1100 × 620. The simulation consumes a rendering accumulator in 1/120-second steps and interpolates ball and paddle positions for rendering. It caps accumulated wall time to 100 ms to discard long stalls. Swept time-of-impact resolves the earliest wall, paddle-front or goal crossing, then consumes the remaining step. Contact offset produces a bounce up to 60 degrees from horizontal. Each paddle return increases speed by 4.5%, capped at 850 court units/second. Goals reset the ball with an 850 ms serve break and stop the match immediately at seven. Non-finite ball/paddle state resets safely.

The existing tracker already mirrors and calibrates palm coordinates. Pong consumes its normalized palm Y directly, without viewport offsets or a second mirroring operation. A One Euro filter uses the measured elapsed time between shared inference callbacks, with a 1.6 Hz base cutoff and derivative-based acceleration. Paddle motion clamps to the court with a 1300 units/second recovery limit. Input older than 350 ms holds the paddle; returning samples automatically recover without a jump. A gap above 300 ms resets the filter derivative while retaining the displayed paddle position. Keyboard arrows/W/S remain usable without a camera, and pointer practice remains available.

## AI

AI periodically chooses a target and moves toward it within a speed limit. Landing prediction folds the projected ball position across the top/bottom walls, including multiple reflections. Prediction is blended with current ball position for lower difficulties. Each decision adds bounded random aim error and a difficulty-dependent chance of a larger miss. Reproducible tests inject an RNG; normal play uses local randomness.

| Mode | Speed limit | Reaction interval | Aim error | Larger miss chance | Prediction blend |
| --- | ---: | ---: | ---: | ---: | ---: |
| Easy | 230 units/s | 320 ms | ±100 | 20% | 30% |
| Normal | 370 units/s | 170 ms | ±48 | 7% | 75% |
| Hard | 510 units/s | 90 ms | ±19 | 2% | 100% |

Hard remains limited by reaction and movement speed, rather than snapping to a predicted intercept.

## Lifecycle and effects

Three-second countdown, pause/resume, restart, game over, score display and sound toggle are included. Space/Escape pause and R restarts; Space on focused buttons retains native button behavior. Window blur or hidden-tab events pause the match. Paused/menu/game-over states draw once and stop requestAnimationFrame. Unmount removes input subscriptions and event listeners. Input sampling does not recreate streams or models. The court uses logical dimensions, so CSS resizing does not alter physics or require resetting a match. HUD updates are throttled to 10 Hz. Trail and collision particles use bounded reusable pools; scoring adds a restrained temporary tint. Effects retain the white/cyan/lavender HANDVERSE palette.

## Validation

- `npm run check:ci`: passed production TypeScript/Vite build, local tracking asset checks, all 63 tests, version checks and `cargo check --locked` on macOS ARM64.
- 14 new tests cover both walls, swept returns at high velocity, paddle bounds, contact angles, capped speed, one goal per crossing, first-to-seven, countdown/stall behavior, 30/60/144 Hz consistency, reflection prediction, difficulty limits, AI movement constraints, invalid-state recovery, measured input intervals, jitter reduction and tracking-loss recovery.
- Tauri integration and platform configuration are unchanged. Rust reports nine existing Objective-C macro configuration warnings.
- Craft Anything `rebuild_check`: passed build, native launch/rendering at 2880 × 1880, Pong pointer movement (310 → 160), existing gameplay/HUD checks, AR smoke checks and packaged SIMD/non-SIMD inference. Inspected its launch screenshot. Comparison against reference mechanics remains unverified, as reported by the checker; the legacy mechanics sheet is not proof of v2 runtime behavior.

Physical webcam behavior, camera-to-display latency, sustained 60 FPS on target hardware and native Windows x64 execution require manual testing. No physical camera or Windows performance result is claimed. AI tuning can be adjusted after human playtesting. This phase adds no networking or multiplayer implementation.
