# Publishing HANDVERSE

Use only https://github.com/h-yusuf/handverse-ai.git. Never force-push or replace existing history. Run these commands in a terminal with GitHub Git authentication. No credential belongs in tracked files.

## 1. Publish the prepared workflow in the existing repository

The actual Git root is the directory containing `app/`, with origin already set to `https://github.com/h-yusuf/handverse-ai.git`. Keep this layout. GitHub reads `.github/workflows/release.yml` at that Git root; the workflow runs commands in `app/` and configures `projectPath: app`. Do not create or clone another repository and do not move application source.

Exact source/configuration changes for this release preparation:

- Added root `.github/workflows/release.yml`; removed the inactive `app/.github/workflows/release.yml`.
- Added root `.gitignore` for caches, generated Craft Anything state, logs and private files.
- Updated `app/.gitignore` to ignore generated release notes.
- Updated `app/src/main.rs` to explicitly type the Tauri Wry context on all platforms, independent of macOS-only command arguments.
- Updated `app/tauri.macos.conf.json` to default to ad-hoc signing for Apple Silicon downloads; configured Apple credentials override this for production signing.
- Updated `app/README.md`, `app/docs/RELEASE-NOTES.md`, this file and `app/docs/VALIDATION.md` to reflect the actual repository layout, two release targets and validation limits.

The pinned MediaPipe JavaScript, SIMD/non-SIMD WASM and SHA-256-verified Hand Landmarker model already exist under `app/public/` and remain tracked. `npm ci` prepares them, frontend builds copy them to `dist/`, and Tauri embeds them in the binary. CI extracts and byte-compares all six assets after packaging.

The current execution environment denies writes to `.git/index.lock`, so **untracking could not be performed here**. From your normal terminal at the Git root, run the following to remove only generated files from Git's index while preserving every local file, then stage only the intended release changes:

```sh
git remote -v
git status --short
git rm -r --cached --ignore-unmatch .DS_Store .npm-cache build-activity.log craft.json feed.json usage.json checks inbox investigation.cany capture
git add .github/workflows/release.yml .gitignore app/.github/workflows/release.yml app/.gitignore app/src/main.rs app/tauri.macos.conf.json app/README.md app/docs/RELEASING.md app/docs/RELEASE-NOTES.md app/docs/VALIDATION.md
git diff --cached --check
git diff --cached --stat
git commit -m "Prepare cross-platform HANDVERSE release workflow"
git push origin HEAD
```

Review the staged changes before committing. Existing unrelated local changes are not part of this release preparation. No commit, push, tag or GitHub release was made by this task.

## 2. Choose a version and create a tag

For the initial release keep package.json, package-lock.json (root and packages[""]), Cargo.toml, Cargo.lock's handverse package and tauri.conf.json at 1.0.0. For subsequent releases update all together, run `npm --prefix app run check:release`, commit and push the version changes. Edit app/docs/RELEASE-NOTES.md to describe the actual release before tagging. Never move a published tag.

After pulling the merged default branch and completing the checks:

```sh
npm --prefix app ci
npm --prefix app run check:ci
git tag -a v1.0.0 -m "HANDVERSE 1.0.0"
git push origin v1.0.0
```

## 3. Watch GitHub Actions

Open https://github.com/h-yusuf/handverse-ai/actions and select **Desktop release**. A semantic version tag automatically creates a draft release, then builds an ARM64 DMG and Windows x64 NSIS/MSI using the official [tauri-action](https://github.com/tauri-apps/tauri-action). Every job runs npm ci, version/asset validation, frontend checks, existing tests and Rust checks. Windows SDK and Xcode tooling come from hosted runners; Tauri obtains NSIS/WiX and the offline WebView2 installer during packaging. Packaging/tool downloads need network access.

A final check requires actual installer files and extracts all six embedded tracking assets from the compiled binary, comparing bytes to app/public/. All matrix jobs must succeed before the release becomes public. Failed runs keep a draft for inspection; installer and check-log artifacts are retained for 14 days. Full packaging logs are in the Actions job log. Re-run failed jobs after diagnosing them. **Run workflow** on a branch performs builds/artifact checks without publishing; dispatch on a version tag also publishes. Do not regard an incomplete draft as a completed release. Re-running a published tag may replace same-name installer assets; use a new version for changed source.

## 4. Download

Open https://github.com/h-yusuf/handverse-ai/releases, select HANDVERSE's version, expand **Assets**, then download the architecture-specific `.dmg` or Windows `setup.exe`/`.msi`. The source-code archives are not installers. If there is no public release, inspect Actions first. No successful remote run is claimed by preparing this workflow.

## Optional signing credentials

Set these in repository **Settings → Secrets and variables → Actions**. Never commit certificate files, passwords, tokens or generated ci-signing.json. Missing signing secrets allow unsigned testing builds; do not advertise those as signed or notarized. Partial/incorrect credentials must fail packaging rather than silently downgrade trust.

For macOS: `APPLE_CERTIFICATE` (base64 Developer ID Application .p12 with private key), `APPLE_CERTIFICATE_PASSWORD` (export password), `APPLE_SIGNING_IDENTITY` (full Developer ID Application identity), `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), and `APPLE_TEAM_ID`. Tauri imports the certificate and uses the Apple ID credentials for notarization. The existing camera entitlement remains enabled. See [official macOS signing guidance](https://v2.tauri.app/distribute/sign/macos/).

For Windows: `WINDOWS_CERTIFICATE` (base64 exportable code-signing PFX with private key), `WINDOWS_CERTIFICATE_PASSWORD`. The workflow imports it into the temporary runner's current-user certificate store, configures its thumbprint and SHA-256 RFC3161 timestamping, signs during bundling and removes it afterward. For EV/hardware/cloud certificates, use the issuer's supported signing service with a reviewed custom signing command instead of trying to export a hardware key. See [official Windows signing guidance](https://v2.tauri.app/distribute/sign/windows/). The GitHub-provided `GITHUB_TOKEN` only needs contents:write for release jobs; no personal access token is embedded.

Unsigned or ad-hoc macOS builds are not Developer ID notarized and may be blocked by Gatekeeper. Windows unsigned builds may trigger SmartScreen or enterprise restrictions. Do not disable security protections; obtain signed builds when required. Signing is separate from the Tauri updater and no automatic updater is enabled.
