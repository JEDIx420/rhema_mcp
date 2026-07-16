use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let schema_version_path = manifest_dir.join("../../schema-version.txt");
    println!("cargo:rerun-if-changed={}", schema_version_path.display());

    let schema_version = fs::read_to_string(&schema_version_path)
        .unwrap_or_else(|error| {
            panic!(
                "failed to read schema version from {}: {error}",
                schema_version_path.display()
            )
        })
        .trim()
        .parse::<i32>()
        .expect("schema-version.txt must contain a valid i32");
    assert!(schema_version >= 0, "schema version must be non-negative");

    let output_path =
        PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR")).join("schema_version.rs");
    fs::write(
        output_path,
        format!("const CURRENT_SCHEMA_VERSION: i32 = {schema_version};\n"),
    )
    .expect("failed to generate Rust schema version");

    tauri_build::build()
}
