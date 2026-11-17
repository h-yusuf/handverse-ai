#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Restricted to the invoking HANDVERSE window; no arbitrary window labels or code.
#[tauri::command]
fn holospace_fullscreen(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    window.set_fullscreen(enabled).map_err(|e| e.to_string())
}
#[tauri::command]
fn holospace_is_fullscreen(window: tauri::WebviewWindow) -> Result<bool, String> {
    window.is_fullscreen().map_err(|e| e.to_string())
}

struct Automation {
    screenshot: Option<std::path::PathBuf>,
    self_test: Option<std::path::PathBuf>,
    runtime_test: bool,
}

#[tauri::command]
fn native_tracking_available() -> bool { cfg!(target_os = "macos") }

#[cfg(target_os = "macos")]
#[tauri::command]
async fn track_hands(frame: Vec<u8>) -> Result<serde_json::Value, String> {
    if frame.len() > 2_000_000 { return Err("Camera frame is too large".into()); }
    tauri::async_runtime::spawn_blocking(move || unsafe {
        extern "C" {
            fn handverse_track(bytes: *const u8, length: usize) -> *mut std::ffi::c_char;
            fn handverse_free(result: *mut std::ffi::c_char);
        }
        let result = handverse_track(frame.as_ptr(), frame.len());
        if result.is_null() { return Err("Hand tracking returned no result".into()); }
        let parsed = serde_json::from_slice(std::ffi::CStr::from_ptr(result).to_bytes()).map_err(|e| e.to_string());
        handverse_free(result);
        parsed
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn automation_options(options: tauri::State<'_, Automation>) -> serde_json::Value {
    serde_json::json!({"screenshot": options.screenshot.is_some(), "self_test": options.self_test.is_some(), "runtime_test": options.runtime_test})
}

#[tauri::command]
fn finish_self_test(app: tauri::AppHandle, options: tauri::State<'_, Automation>, result: serde_json::Value) -> Result<(), String> {
    let path = options.self_test.as_ref().ok_or("No self-test requested")?;
    let report = serde_json::to_vec_pretty(&result).map_err(|error| error.to_string())?;
    std::fs::write(path, report).map_err(|error| error.to_string())?;
    app.exit(0);
    Ok(())
}

// Capture the rendered webview, including CSS and canvas, without activating the window.
#[cfg(target_os = "macos")]
#[tauri::command]
fn finish_screenshot(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    options: tauri::State<'_, Automation>,
) -> Result<(), String> {
    use objc::{class, msg_send, sel, sel_impl};
    use objc::runtime::Object;
    let path = options.screenshot.clone().ok_or("No screenshot requested")?;
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    window.with_webview(move |webview| unsafe {
        let callback = block2::RcBlock::new(move |image: *mut std::ffi::c_void, error: *mut std::ffi::c_void| {
            let image = image as *mut Object;
            if !error.is_null() || image.is_null() {
                eprintln!("Unable to capture webview screenshot");
                app.exit(1);
                return;
            }
            let tiff: *mut Object = msg_send![image, TIFFRepresentation];
            let bitmap: *mut Object = msg_send![class!(NSBitmapImageRep), imageRepWithData: tiff];
            let properties: *mut Object = msg_send![class!(NSDictionary), dictionary];
            let png: *mut Object = msg_send![bitmap, representationUsingType: 4usize properties: properties];
            if png.is_null() {
                eprintln!("Unable to encode screenshot as PNG");
                app.exit(1);
                return;
            }
            let bytes: *const u8 = msg_send![png, bytes];
            let length: usize = msg_send![png, length];
            let result = std::fs::write(&path, std::slice::from_raw_parts(bytes, length));
            match result {
                Ok(()) => app.exit(0),
                Err(error) => { eprintln!("Unable to save screenshot: {error}"); app.exit(1); }
            }
        });
        let view = webview.inner() as *mut Object;
        // The 120 application frames are already drawn. Waiting for a future
        // screen update can hang indefinitely when another app covers this one.
        let config: *mut Object = msg_send![class!(WKSnapshotConfiguration), new];
        let _: () = msg_send![config, setAfterScreenUpdates: false];
        let _: () = msg_send![view, takeSnapshotWithConfiguration: config completionHandler: (&*callback as *const _ as *const std::ffi::c_void)];
        let _: () = msg_send![config, release];
    }).map_err(|error| error.to_string())
}

fn main() {
    let mut args = std::env::args_os().skip(1);
    let mut screenshot = None;
    let mut self_test = None;
    let mut runtime_test = false;
    let mut audit_assets = None;
    while let Some(arg) = args.next() {
        if arg == "--audit-runtime-assets" {
            audit_assets = Some(std::path::PathBuf::from(args.next().expect("--audit-runtime-assets requires a folder")));
        } else if arg == "--runtime-test" {
            runtime_test = true;
            self_test = Some(std::path::PathBuf::from(args.next().expect("--runtime-test requires a JSON path")));
        } else if arg == "--self-test" {
            self_test = Some(std::path::PathBuf::from(args.next().expect("--self-test requires a JSON path")));
        } else if arg == "--screenshot" {
            screenshot = Some(std::path::PathBuf::from(args.next().expect("--screenshot requires a PNG path")));
        }
    }
    // Pin the runtime explicitly on every platform; macOS-only command arguments
    // must not be needed to infer the runtime in Windows builds.
    let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    // Read the actual release binary's embedded asset table without opening a GUI.
    if let Some(folder) = audit_assets {
        for path in ["vendor/vision_bundle.mjs", "wasm/vision_wasm_internal.js", "wasm/vision_wasm_internal.wasm", "wasm/vision_wasm_nosimd_internal.js", "wasm/vision_wasm_nosimd_internal.wasm", "models/hand_landmarker.task"] {
            let key = format!("/{path}").into();
            let bytes = context.assets().get(&key).expect("Missing embedded runtime asset");
            let destination = folder.join(path);
            std::fs::create_dir_all(destination.parent().unwrap()).unwrap();
            std::fs::write(destination, bytes).unwrap();
        }
        let malformed = context.assets().get(&"/wasm//vision_wasm_internal.js".into()).is_some();
        println!("Embedded runtime assets extracted; malformed double-slash loader exists: {malformed}");
        return;
    }
    let screenshot_mode = screenshot.is_some();
    let automation_mode = screenshot_mode || self_test.is_some();
    let builder = tauri::Builder::default();
    // Tauri forwards this to Tao before the event loop starts.
    #[cfg(target_os = "macos")]
    let builder = builder.activate_ignoring_other_apps(!screenshot_mode);
    let builder = builder
        .setup(move |app| {
            // Use the existing window config while correcting custom-protocol runtime
            // responses. Unknown .task extensions otherwise default to text/html.
            let window = tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?
                .focused(!screenshot_mode);
            let window = if automation_mode {
                window.background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
                    // Native ticks keep render callbacks progressing even when
                    // WebKit clamps background JavaScript timers to one per second.
                    .initialization_script(r#"
                        window.__HANDVERSE_AUTOMATION__ = true;
                        let nextFrame = 0;
                        const frames = new Map();
                        let nextTimer = 0;
                        const timers = new Map();
                        const schedule = (callback, delay, repeat, args) => {
                            const id = ++nextTimer;
                            const duration = Math.max(0, Number(delay) || 0);
                            timers.set(id, {callback, args, due: performance.now() + duration, duration, repeat});
                            return id;
                        };
                        window.setTimeout = (callback, delay, ...args) => schedule(callback, delay, false, args);
                        window.setInterval = (callback, delay, ...args) => schedule(callback, delay, true, args);
                        window.clearTimeout = window.clearInterval = id => timers.delete(id);
                        window.requestAnimationFrame = callback => {
                            const id = ++nextFrame;
                            frames.set(id, callback);
                            return id;
                        };
                        window.cancelAnimationFrame = id => frames.delete(id);
                        window.__handverseDrawFrame = () => {
                            const batch = Array.from(frames.entries());
                            const now = performance.now();
                            for (const [id, timer] of Array.from(timers.entries())) {
                                if (timers.has(id) && now >= timer.due) {
                                    if (timer.repeat) timer.due = now + timer.duration;
                                    else timers.delete(id);
                                    try { timer.callback(...timer.args); } catch (error) { console.error(error); }
                                }
                            }
                            for (const [id, callback] of batch) {
                                if (frames.delete(id)) callback(now);
                            }
                        };
                    "#)
            } else { window };
            // Covered WKWebView/GTK windows can stop painting. Only lower on Windows.
            #[cfg(target_os = "windows")]
            let window = if screenshot_mode {
                window.always_on_bottom(true)
                    .additional_browser_args("--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows")
            } else { window };
            let window = window.on_web_resource_request(|request, response| {
                    let path = request.uri().path();
                    if !(path.starts_with("/vendor/") || path.starts_with("/wasm/") || path.starts_with("/models/")) { return; }
                    let mime = match path {
                        "/vendor/vision_bundle.mjs" | "/wasm/vision_wasm_internal.js" | "/wasm/vision_wasm_nosimd_internal.js" => Some("text/javascript"),
                        "/wasm/vision_wasm_internal.wasm" | "/wasm/vision_wasm_nosimd_internal.wasm" => Some("application/wasm"),
                        "/models/hand_landmarker.task" => Some("application/octet-stream"),
                        _ => None,
                    };
                    // Tauri's route fallback must never masquerade as a runtime file.
                    if mime.is_none() || response.body().starts_with(b"<") {
                        *response.status_mut() = tauri::http::StatusCode::NOT_FOUND;
                        *response.body_mut() = std::borrow::Cow::Owned(b"Runtime asset not found".to_vec());
                        response.headers_mut().insert(tauri::http::header::CONTENT_TYPE, "text/plain".parse().unwrap());
                    } else {
                        response.headers_mut().insert(tauri::http::header::CONTENT_TYPE, mime.unwrap().parse().unwrap());
                    }
                    response.headers_mut().remove(tauri::http::header::CONTENT_LENGTH);
                    response.headers_mut().insert("X-Content-Type-Options", "nosniff".parse().unwrap());
                })
                .build()?;
            if automation_mode {
                std::thread::spawn(move || {
                    for _ in 0..3600 {
                        if window.eval("window.__handverseDrawFrame?.()").is_err() { break; }
                        std::thread::sleep(std::time::Duration::from_millis(16));
                    }
                });
            }
            Ok(())
        })
        .manage(Automation { screenshot, self_test, runtime_test });
    #[cfg(target_os = "macos")]
    let builder = builder.invoke_handler(tauri::generate_handler![holospace_fullscreen, holospace_is_fullscreen, automation_options, finish_screenshot, finish_self_test, native_tracking_available, track_hands]);
    #[cfg(not(target_os = "macos"))]
    let builder = builder.invoke_handler(tauri::generate_handler![holospace_fullscreen, holospace_is_fullscreen, automation_options, finish_self_test, native_tracking_available]);
    builder.run(context).expect("Unable to start HANDVERSE");
}
