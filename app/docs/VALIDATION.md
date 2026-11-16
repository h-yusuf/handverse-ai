# Validation — 2026-11-16

Available host: macOS ARM64; existing dependencies were already present. No physical-camera test was performed for this change.

Push status rechecked on 2026-11-16: neither the workspace nor `app/` contains a `.git` directory, and `git -C app status --short --branch` reports “not a git repository”. No push was performed from this workspace. This local check cannot establish whether someone else has updated the GitHub repository; use the existing-repository procedure in [RELEASING.md](RELEASING.md) to publish the prepared app.

Push-status follow-up validation: `npm run tauri build -- --bundles app` exited 0 and rebuilt the macOS application (21.51 MiB), with the same nine nonfatal Objective-C macro warnings. `rebuild_check` passed the build, 2880×1880 launch/screenshot, Pong pointer movement, bubble popping and score display checks. Reference mechanics comparisons and physical-camera/two-hand tracking remain unverified.

Continuation rebuild: `npm run check:ci` passed again (production frontend, tracking assets, version checks, all 21 tests and Rust checks). `npm run tauri build -- --bundles app` also completed successfully and regenerated `target/release/bundle/macos/HANDVERSE.app`. No source fixes were required. Rust emitted nine existing `cargo-clippy` configuration warnings from Objective-C macros; there were no build errors. This rerun did not repeat DMG packaging, runtime camera tests or GitHub publishing.

| Check | Actual result |
| --- | --- |
| npm ci lockfile compatibility | Offline dry run with scripts disabled passed; a fresh network install was not performed |
| Version and asset checks | Passed; 1.0.0 matches package/lockfile/Cargo/Tauri, six MediaPipe assets verified |
| Production frontend | TypeScript and Vite passed |
| Existing tests | 21/21 passed |
| Rust | cargo check --locked passed on macOS ARM64 using the offline cache |
| Native release app | Built HANDVERSE.app successfully |
| Native DMG packaging | Attempted and failed: hdiutil create failed — Device not configured; disk-image creation is unavailable in this environment |
| Embedded assets | All six files extracted from the final release binary byte-match public originals |
| rebuild_check | Build, 2880×1880 launch/screenshot and pointer gameplay checks passed |
| Packaged MediaPipe | Actual WKWebView SIMD/GPU and non-SIMD/GPU initialization and blank-canvas inference passed; malformed loader rejected with 404 |
| Mechanics comparison | Reference behavior measurements remain unverified |
| Windows / Intel macOS | Compilation, installers, WebView2, camera, real hands and gameplay runtime tests not run locally; CI is configured but has not run |
| Physical camera / gesture acceptance | Permissions, hand detection, app-wide hand cursor, pinch-to-click, all games with real hands and offline post-install tests remain pending on each OS |
| Signing/notarization | Not run; no production signing credentials supplied |
| GitHub publish | Not performed; supplied app has no Git history, GitHub DNS fails, gh auth status reports saved authentication invalid (network unavailable). No remote workflow run or status can be retrieved |
| Workflow static checks | YAML parses, scripts parse, matching release tag validates; this is not a successful GitHub Actions run |

The release workflow uses macos-15 ARM64, macos-15-intel x64 and windows-latest x64. Runner labels were checked against [GitHub's runner documentation](https://docs.github.com/en/actions/reference/runners/github-hosted-runners); macOS 14 images are retired. Each macOS binary is audited on its native runner architecture. Installer failures remain fatal. GitHub Actions will retain check logs and installers and publish only after every matrix job passes.

No commit/push was made because upstream history cannot be fetched and usable authentication is not available. No repository, remote commit or tag was created. Follow RELEASING.md to apply the prepared files to the exact existing repository without force-pushing. Application license selection and the model/transitive redistribution review remain owner decisions; no project license file was added.
