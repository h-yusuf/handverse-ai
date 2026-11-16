# HANDVERSE __VERSION__

## Features
Real-time local MediaPipe hand tracking, an app-wide hand cursor, pinch-to-click, gesture controls, calibration, local records and the existing mini-games. This release adds automated desktop installer packaging without changing game rules.

## Operating systems and downloads
- macOS 12 or newer, Apple Silicon: download the `aarch64.dmg`, open it and drag HANDVERSE into Applications.
- macOS 12 or newer, Intel: download the `x64.dmg` (build support; runtime validation pending).
- Windows 10/11 x64: download the NSIS `setup.exe` or the alternative `.msi` and follow the installer. Install only one format. WebView2's offline installer is included.

Download the platform installer under **Assets**, not GitHub's source-code archives. No Node.js, Rust or development server is needed to run it.

## Known limitations
Camera hardware, driver compatibility, tracking performance and gesture behavior require the manual checks in docs/TESTING.md on each OS. CI builds and asset checks do not certify real-camera operation. Intel macOS and Windows runtime validation is pending. Unsigned testing installers may show Gatekeeper or SmartScreen warnings or be blocked by organizational policy; use a signed and notarized release when required. Do not disable OS security protections.

## Camera and privacy
Camera access is optional and requested when tracking starts. Enable desktop app camera access in Windows Privacy settings, or allow HANDVERSE in macOS Privacy & Security → Camera. Frames are processed on-device and are not recorded or uploaded. The model and SIMD/non-SIMD runtime are embedded; tracking and games work without a development server or runtime CDN. Settings and scores stay on this device.
