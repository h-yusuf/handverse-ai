fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        let out = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap());
        let object = out.join("hand_tracking.o");
        // clang otherwise compiles for the runner's architecture, even when Cargo
        // targets Intel on an Apple Silicon runner.
        let arch = match std::env::var("CARGO_CFG_TARGET_ARCH").unwrap().as_str() {
            "aarch64" => "arm64",
            "x86_64" => "x86_64",
            other => panic!("Unsupported macOS architecture: {other}"),
        };
        assert!(std::process::Command::new("clang").args(["-arch", arch, "-fobjc-arc", "-mmacosx-version-min=12.0", "-c", "src/hand_tracking.m", "-o"]).arg(&object).status().unwrap().success());
        assert!(std::process::Command::new("ar").arg("crs").arg(out.join("libhand_tracking.a")).arg(object).status().unwrap().success());
        println!("cargo:rustc-link-search=native={}", out.display());
        println!("cargo:rustc-link-lib=static=hand_tracking");
        println!("cargo:rustc-link-lib=framework=Vision");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rerun-if-changed=src/hand_tracking.m");
    }
    tauri_build::build()
}
