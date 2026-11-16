#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
        let _: () = msg_send![view, takeSnapshotWithConfiguration: std::ptr::null_mut::<Object>() completionHandler: (&*callback as *const _ as *const std::ffi::c_void)];
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
    let context = tauri::generate_context!();
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
    let builder = tauri::Builder::default()
        .setup(|app| {
            // Use the existing window config while correcting custom-protocol runtime
            // responses. Unknown .task extensions otherwise default to text/html.
            tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?
                .on_web_resource_request(|request, response| {
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
            Ok(())
        })
        .manage(Automation { screenshot, self_test, runtime_test });
    #[cfg(target_os = "macos")]
    let builder = builder.invoke_handler(tauri::generate_handler![automation_options, finish_screenshot, finish_self_test, native_tracking_available, track_hands]);
    #[cfg(not(target_os = "macos"))]
    let builder = builder.invoke_handler(tauri::generate_handler![automation_options, finish_self_test, native_tracking_available]);
    builder.run(context).expect("Unable to start HANDVERSE");
}
