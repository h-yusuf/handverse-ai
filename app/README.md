# HANDVERSE

A desktop hand-controlled arcade built with React, Rust and Tauri 2. MediaPipe detects hands locally; the app-wide cursor, pinch-to-click, gesture controls and mini-games share the existing tracking pipeline.

Repository: [h-yusuf/handverse-ai](https://github.com/h-yusuf/handverse-ai). The repository root contains this `app/` folder and `.github/workflows/release.yml`.

Screenshots: arcade overview — placeholder; camera setup — placeholder; gesture gameplay — placeholder. Add reviewed screenshots without exposing personal camera imagery.

Features include real-time hand tracking, app-wide navigation, five mini-games, pointer practice, calibration, local records and settings. The hand cursor operates within HANDVERSE, not other desktop applications.

## Install

Open [GitHub Releases](https://github.com/h-yusuf/handverse-ai/releases), choose a version and expand **Assets**. On Apple Silicon download the `aarch64.dmg`. Open the disk image and drag HANDVERSE to Applications. On Windows x64 download the NSIS `setup.exe`, or use the alternative MSI. Install one Windows format only. Source-code ZIP files are not installers.

Requirements: macOS 12+ on Apple Silicon, or Windows 10/11 x64 with WebView2, a webcam for hand controls, and a GPU/CPU capable of running MediaPipe WASM. Windows installers include the WebView2 offline installer. No development server, Node.js or Rust is needed after installation. Model/runtime assets are embedded for offline use. Camera performance depends on hardware and lighting.

Unsigned test builds can trigger Gatekeeper or SmartScreen warnings and may be blocked by policy. Signing and macOS notarization are recommended for public distribution. Follow OS security guidance; do not disable protections or remove quarantine attributes. Signing does not guarantee immediate SmartScreen reputation.

## Development and builds

Use Node.js 22, npm, stable Rust and the platform prerequisites in [Tauri's documentation](https://v2.tauri.app/start/prerequisites/): Xcode Command Line Tools on macOS; Visual Studio C++ Build Tools and Windows SDK on Windows. GitHub-hosted runners already include these tools. No Linux installers are configured.

This is a nonstandard layout: **Cargo.toml, tauri.conf.json and build.rs are in `app/`**; Rust lives in `src/main.rs`, alongside the frontend. Run the following commands from `app/`. The unused `src-tauri/` starter template is excluded from publication and must not replace the working root crate. The existing macOS output is `target/release/bundle/macos/HANDVERSE.app`.

```sh
npm ci
npm run check:ci
npm run tauri build -- --bundles dmg             # macOS
npm run tauri build -- --bundles nsis,msi        # Windows x64
```

`npm ci` copies the pinned MediaPipe runtime locally and verifies the bundled model hash. If a model is missing, setup downloads the pinned official model at build time; the installed app never downloads it. `npm run build` typechecks TypeScript, validates all local tracking assets and builds the production frontend. `npm test` checks existing behavior. `cargo check --locked` checks the actual Rust crate. A frontend preview alone does not validate native permissions or packaging.

CI uses explicit Rust targets; its output is under `target/<target>/release/bundle/`. For Intel from Apple Silicon: `rustup target add x86_64-apple-darwin`, then `npm run tauri build -- --target x86_64-apple-darwin --bundles dmg`. The native Objective-C helper follows the Cargo target architecture. Cocoa, Vision, screenshot code and dependencies remain macOS-only; Windows hand tracking uses local MediaPipe with GPU/CPU and non-SIMD fallbacks. Windows uses a secure local WebView2 origin with the same narrow CSP and no remote runtime host.

## Publish to the existing GitHub repository

See [RELEASING.md](docs/RELEASING.md) for exact push/tag instructions, optional signing secrets, workflow behavior and download steps. Do not create a different repository or force-push. All application versions start at `1.0.0` and must match the tag `v1.0.0`; CI rejects mismatches. [Release note template](docs/RELEASE-NOTES.md) supplies features, platforms, instructions, limitations and privacy information.

## Privacy and validation

Camera frames stay on the device and are not recorded or sent to a server. Tracking loads the local model, JavaScript and SIMD/non-SIMD WASM; there are no runtime CDN/API dependencies or API keys. Camera and microphone are not silently enabled; camera access begins on user request, with audio disabled. Scores/settings are stored locally. Setup downloads build dependencies only. Preserve the existing restrictive CSP.

[TESTING.md](docs/TESTING.md) distinguishes automated checks from real-camera acceptance tests. Do not interpret a successful release build as proof that camera permissions, hand detection, pinch control, all games or offline installation were tested on every OS.

## License

The owner has not selected an application license. No project LICENSE file has been added; public visibility alone does not grant a software license. Owner: please choose a license before inviting reuse. See [THIRD-PARTY.md](docs/THIRD-PARTY.md) for dependency/model sources, redistribution obligations and remaining review. Third-party licenses do not license HANDVERSE itself.
