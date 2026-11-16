# Release workflow validation — 2026-11-16

The actual Git root is `/Users/apittmy/Documents/Craft Anything/project-handverse-ai`; origin is `https://github.com/h-yusuf/handverse-ai.git`. Application source remains in `app/`. The workflow is now at `.github/workflows/release.yml`, with app-relative run commands, npm cache paths, Tauri project path and artifact paths. It targets only macOS ARM64 and Windows x64.

| Relevant check | Actual result |
| --- | --- |
| Workflow YAML | Ruby YAML parse passed; tag/manual triggers, app working directories and both target triples checked |
| Script/config syntax | Release, CI, asset-setup and bundle-audit scripts pass `node --check`; all three Tauri JSON configurations parse |
| `npm run check:ci -- aarch64-apple-darwin` (in app/) | Passed: version alignment, pinned MediaPipe/model assets, TypeScript/Vite production build, 21 existing unit tests, and `cargo check --locked --target aarch64-apple-darwin` |
| `npm run tauri build -- --bundles app -- --locked` (in app/) | Passed; generated `target/release/bundle/macos/HANDVERSE.app`, 21.40 MiB, with ad-hoc signature |
| Embedded assets | All six runtime/model files extracted from the newly built release executable and byte-compared successfully against public originals; no GUI launched for this audit |
| `rebuild_check` | Called once as requested; build passed. Tool also runs built-in launch/screenshot and pointer self-test checks, which passed. No follow-up gameplay verification loop was run |
| Windows x64 | Not compiled or tested on this macOS host. Native Windows CI builds/checks and NSIS/MSI packaging are configured; no successful remote run is claimed |
| DMG and Windows installer packaging | Not run locally for this change; required on the two native GitHub runners |
| Real-camera/gesture operation and reference mechanics | Not tested for this release-configuration task; remain unverified |
| Production signing/notarization | Not run; optional credentials supported, default macOS signature is ad-hoc |
| Git index cleanup | Attempted `git rm --cached`, blocked by environment denial creating `.git/index.lock`; nothing deleted locally. Exact untracking commands are in RELEASING.md |
| Publishing | No commit, push, version tag, release or repository created |

Rust emitted nine existing nonfatal `cargo-clippy` configuration warnings from the macOS Objective-C macros. No build errors remain. An initial invocation put `--locked` among Tauri options; the corrected workflow forwards it to Cargo after `--`, as verified by the successful rebuild.

The Rust context is explicitly typed as `tauri::Context<tauri::Wry>` so its runtime inference does not depend on macOS-only command signatures. Objective-C code and dependencies remain guarded for macOS; this source review does not establish Windows compilation success.

See [RELEASING.md](RELEASING.md) for the exact changed files, commands to untrack generated artifacts without removing local copies, and commands to commit, push and tag the existing repository. The workflow creates a draft on a matching version tag and publishes it only after both native builds and installer/embedded-asset checks succeed. A branch workflow dispatch builds artifacts without publishing.
