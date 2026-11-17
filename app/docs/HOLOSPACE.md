# HoloSpace 2.0 — spatial media workspace

Only HoloSpace was redesigned in the existing React/Tauri app. Arcade, tracking, Creative Studio and AR routes retain their implementation. No dependencies were added.

## Workspace

The supplied references guide the dark translucent surfaces, white typography, cyan/lavender/mint accents, rounded floating windows, restrained shadows and reduced chrome. The app-screen design sheet was consulted; the user's explicit glass, pastel and spatial composition requirements override its opaque-surface and sidebar defaults. Existing Manrope and Space Grotesk fonts remain loaded by the app.

The existing mirrored webcam stream fills the viewport using object-fit: cover: no stretching or letterboxing, with natural edge cropping where aspect ratios differ. A small status indicator and always-available Exit Fullscreen replace the header. The compact dock recedes after inactivity and returns on pointer, keyboard or tracked hand activity. Apps and workspace settings appear in contextual popovers. Window controls reveal on hover/focus; touch layouts retain them. Reduced-motion preferences disable animations.

Existing native/browser fullscreen, Escape/fallback, layout autosave/restore, Notes, pinch-to-select, palm launcher, drag, resize, keyboard manipulation and tracking-loss cancellation remain. Range inputs now support pinch-and-hold horizontal scrubbing for volume, seek and surroundings. Iframes cannot intercept mouse dragging while a window is manipulated. Minimized media apps remain mounted, pause playback, and retain their session state. Closing media or leaving HoloSpace unmounts and stops it.

## Media

YouTube uses the official IFrame Player API with a privacy-enhanced player host, validated video URL/ID entry, starter videos, play/pause, seeking and volume controls outside the cross-origin iframe for hand interaction. The last selected video ID is saved locally. It does not autoplay on opening. Loading, network, embedding-disabled and client identification errors have visible states, retry and an ordinary YouTube link. URL parsing accepts watch, mobile, shorts, live and embed links, rejecting unrelated hosts and protocols. No API key, scraping or fabricated live search results: search is explicitly linked to YouTube, then paste a selected video URL. Online access and YouTube's embedding policy apply. Native webviews can receive YouTube error 153 if YouTube rejects their app origin/referrer; actual native playback has not been verified. The root Tauri CSP permits only the required YouTube scripts, frame hosts and thumbnail host, retaining all existing local restrictions.

Music plays real bundled WAV assets through HTMLAudioElement: three original synthesized 32-second ambient sketches. It supports play/pause, previous/next, actual duration/progress/seek, volume, repeat, auto-advance, text filtering, multiple local audio imports and removal of inactive imports. Imported audio stays in memory on this device for the current immersive session; object URLs are revoked on removal/unmount. Decode failures are visible. Music starts only through user activation. Maps, Timer and Calculator are clearly disabled future apps in the launcher; previously saved placeholder windows can still be closed.

## Assets and sources

- `public/holospace/{stillwater,violet-hour,soft-focus}.wav`: original procedural sine-pad audio generated for this project; no third-party recording.
- Cover visuals: original inline SVG ellipses; no borrowed cover art.
- YouTube starter thumbnails: served by YouTube and labeled alongside the video title/source; not represented as original assets. Videos belong to their uploaders.
- API reference: https://developers.google.com/youtube/player_parameters and its linked IFrame API documentation.

## Verification

Production TypeScript/Vite build passed. All 87 tests across 10 files passed, including existing gesture/fullscreen/layout coverage and new URL validation, offline asset presence and playback-time formatting checks. Design source lint: zero failures/warnings. Craft Anything rebuild_check passed native desktop build, startup screenshot (2880 × 1880), and the existing game core-loop smoke test. That screenshot is the app's default arcade screen, not proof of HoloSpace layout or media playback.

Local Vite preview was attempted but sandbox restrictions rejected binding to 127.0.0.1:5173 (EPERM), preventing browser screenshot inspection and an interactive media check. Physical webcam/two-hand interaction, real native YouTube playback, actual fullscreen transitions, Windows execution, cross-browser behavior, frame rate and reference mechanics runtime comparisons remain unverified. These limits should not be presented as passed checks.
