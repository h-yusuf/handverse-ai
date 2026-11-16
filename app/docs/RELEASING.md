# Publishing HANDVERSE

Use only https://github.com/h-yusuf/handverse-ai.git. Never force-push or replace existing history. Run these commands in a terminal with GitHub Git authentication. No credential belongs in tracked files.

## 1. Push the prepared project

If this folder already has the repository history, check `git status` and `git remote -v`, review `git diff`, stage the intended changes, commit, and `git push origin HEAD`. Confirm origin is the exact repository above first.

If this folder has **no .git directory** (as in the supplied workspace), preserve upstream history by cloning the existing repository into a separate folder:

```sh
git clone https://github.com/h-yusuf/handverse-ai.git handverse-ai
cd handverse-ai
git switch -c release-pipeline
```

Copy the **contents of the prepared app/ folder** into that clone's root, excluding `.git`, node_modules, target, dist, gen, logs, caches, src-tauri and local/private files. Include dotfiles `.github/` and `.gitignore`, both lockfiles and all public model/runtime files. Do not copy the surrounding Craft Anything workspace. Review any existing upstream files for conflicts before replacing them. The workflow expects the app at repository root; do not nest it inside another app directory.

```sh
git status --short
git diff --check
git add .github .gitignore README.md Cargo.toml Cargo.lock build.rs tauri.conf.json tauri.macos.conf.json tauri.windows.conf.json package.json package-lock.json scripts docs src tests public icons capabilities Info.plist Entitlements.plist index.html tsconfig.json vite.config.ts mechanics.json TRACKING-VALIDATION.txt
git diff --cached --stat
git commit -m "Prepare HANDVERSE desktop releases"
git push -u origin release-pipeline
```

Review and merge this branch into the repository's default branch using GitHub. If upstream already has different app code, resolve that review before tagging. This procedure preserves existing commits and does not create another repository.

## 2. Choose a version and create a tag

For the initial release keep package.json, package-lock.json (root and packages[""]), Cargo.toml, Cargo.lock's handverse package and tauri.conf.json at 1.0.0. For subsequent releases update all together, run `npm run check:release`, commit and push the version changes. Edit docs/RELEASE-NOTES.md to describe the actual release before tagging. Never move a published tag.

After pulling the merged default branch and completing the checks:

```sh
npm ci
npm run check:ci
git tag -a v1.0.0 -m "HANDVERSE 1.0.0"
git push origin v1.0.0
```

## 3. Watch GitHub Actions

Open https://github.com/h-yusuf/handverse-ai/actions and select **Desktop release**. A semantic version tag automatically creates a draft release, then builds ARM64/Intel DMGs and Windows x64 NSIS/MSI using the official [tauri-action](https://github.com/tauri-apps/tauri-action). Every job runs npm ci, version/asset validation, frontend checks, existing tests and Rust checks. Windows SDK and Xcode tooling come from hosted runners; Tauri obtains NSIS/WiX and the offline WebView2 installer during packaging. Packaging/tool downloads need network access.

A final check requires actual installer files and extracts all six embedded tracking assets from the compiled binary, comparing bytes to public/. All matrix jobs must succeed before the release becomes public. Failed runs keep a draft for inspection; installer and check-log artifacts are retained for 14 days. Full packaging logs are in the Actions job log. Re-run failed jobs after diagnosing them. **Run workflow** on a branch performs builds/artifact checks without publishing; dispatch on a version tag also publishes. Do not regard an incomplete draft as a completed release. Re-running a published tag may replace same-name installer assets; use a new version for changed source.

## 4. Download

Open https://github.com/h-yusuf/handverse-ai/releases, select HANDVERSE's version, expand **Assets**, then download the architecture-specific `.dmg` or Windows `setup.exe`/`.msi`. The source-code archives are not installers. If there is no public release, inspect Actions first. No successful remote run is claimed by preparing this workflow.

## Optional signing credentials

Set these in repository **Settings → Secrets and variables → Actions**. Never commit certificate files, passwords, tokens or generated ci-signing.json. Missing signing secrets allow unsigned testing builds; do not advertise those as signed or notarized. Partial/incorrect credentials must fail packaging rather than silently downgrade trust.

For macOS: `APPLE_CERTIFICATE` (base64 Developer ID Application .p12 with private key), `APPLE_CERTIFICATE_PASSWORD` (export password), `APPLE_SIGNING_IDENTITY` (full Developer ID Application identity), `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), and `APPLE_TEAM_ID`. Tauri imports the certificate and uses the Apple ID credentials for notarization. The existing camera entitlement remains enabled. See [official macOS signing guidance](https://v2.tauri.app/distribute/sign/macos/).

For Windows: `WINDOWS_CERTIFICATE` (base64 exportable code-signing PFX with private key), `WINDOWS_CERTIFICATE_PASSWORD`. The workflow imports it into the temporary runner's current-user certificate store, configures its thumbprint and SHA-256 RFC3161 timestamping, signs during bundling and removes it afterward. For EV/hardware/cloud certificates, use the issuer's supported signing service with a reviewed custom signing command instead of trying to export a hardware key. See [official Windows signing guidance](https://v2.tauri.app/distribute/sign/windows/). The GitHub-provided `GITHUB_TOKEN` only needs contents:write for release jobs; no personal access token is embedded.

Unsigned or ad-hoc macOS builds are not Developer ID notarized and may be blocked by Gatekeeper. Windows unsigned builds may trigger SmartScreen or enterprise restrictions. Do not disable security protections; obtain signed builds when required. Signing is separate from the Tauri updater and no automatic updater is enabled.
