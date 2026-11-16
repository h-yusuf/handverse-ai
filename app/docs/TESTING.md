# Desktop acceptance tests

Run on a clean Windows 10/11 x64 machine, Apple Silicon macOS 12+, and Intel macOS 12+ before claiming each platform is runtime validated. Record OS/version, hardware, tag/commit, installer, signature status, expected/actual result and diagnostic output. CI compilation/packaging and a blank-canvas MediaPipe inference are not physical-camera tests.

- Download from Releases, install, launch from Applications/Start Menu with no dev server. Verify the existing UI and all five games are present.
- Request camera access; test allow and deny, permission recovery, camera selection, busy camera and unplug/reconnect. On Windows enable Camera → Allow desktop apps to access your camera. Check WebView2's local origin and getUserMedia availability.
- Confirm MediaPipe initializes and reports active tracking. Test SIMD and non-SIMD with the runtime probe. GPU failure must fall back to CPU without loading a remote resource.
- With a physical hand confirm stable detection and app-wide cursor in menus and games; point, pinch once, hold and release, then pinch again. Check no duplicate clicks and calibration across the screen.
- Play every mini-game with hand controls; confirm collision/score/timer, pause/resume, restart and local records. Also check pointer practice.
- Quit, disconnect the network, relaunch and repeat tracking/gameplay. Install on an offline clean Windows machine as well to validate bundled WebView2 installation. No server/CDN should be needed.
- Stop tracking and verify the camera indicator goes off. Inspect network traffic while tracking: frames must not be uploaded. Confirm settings/records survive restart.
- Uninstall/reinstall and test the intended signed or unsigned security behavior without disabling OS protections.

The executable supports `--runtime-test <absolute-report.json>` for real WebView model initialization with blank-canvas inference, `--self-test <absolute-report.json>` for existing gameplay/runtime checks, and `--audit-runtime-assets <folder>` for embedded byte checks without launching a GUI. Screenshot automation is macOS-only and is not a user feature.

Current results are recorded in VALIDATION.md. Windows and Intel hardware runtime tests remain pending until actually performed; never fill them in from inference.
