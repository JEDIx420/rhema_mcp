import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const fontFiles = [
  "NotoSans-Regular.ttf",
  "NotoSansHebrew-Regular.ttf",
  "NotoSansDevanagari-Regular.ttf",
  "NotoSansTelugu-Regular.ttf",
  "NotoSansMalayalam-Regular.ttf",
  "NotoSansTamil-Regular.ttf",
];
const requiredAssets = [
  { path: resolve("..", "rhelo.db"), minimumBytes: 1_000_000, label: "Rhelo database" },
  { path: resolve("..", "ggml-base.bin"), minimumBytes: 1_000_000, label: "Whisper model" },
  ...fontFiles.map((filename) => ({
    path: resolve("src-tauri", "resources", "fonts", filename),
    minimumBytes: 10_000,
    label: `PDF font ${filename}`,
  })),
];

const failures = [];
for (const asset of requiredAssets) {
  try {
    if (statSync(asset.path).size < asset.minimumBytes) failures.push(`${asset.label} is empty or incomplete: ${asset.path}`);
  } catch {
    failures.push(`${asset.label} is missing: ${asset.path}`);
  }
}

try {
  const tauriConfig = JSON.parse(readFileSync(resolve("src-tauri", "tauri.conf.json"), "utf8"));
  const resources = tauriConfig?.bundle?.resources;
  if (resources?.["../../rhelo.db"] !== "rhelo.db") failures.push("Tauri must bundle rhelo.db at the resource root");
  if (resources?.["../../ggml-base.bin"] !== "ggml-base.bin") failures.push("Tauri must bundle the Whisper model at the resource root");
  for (const filename of fontFiles) {
    if (resources?.[`resources/fonts/${filename}`] !== `fonts/${filename}`) {
      failures.push(`Tauri must bundle ${filename} in the fonts resource directory`);
    }
  }
  if ("externalBin" in (tauriConfig?.bundle ?? {})) failures.push("The pure Rust build must not configure a Python sidecar");
  if (tauriConfig?.app?.windows?.[0]?.dragDropEnabled !== false) failures.push("dragDropEnabled must stay false for internal macOS drag-and-drop");
} catch (error) {
  failures.push(`Tauri resource configuration could not be validated: ${error}`);
}

try {
  const rustHost = readFileSync(resolve("src-tauri", "src", "lib.rs"), "utf8");
  const apiClient = readFileSync(resolve("src", "lib", "api.ts"), "utf8");
  if (rustHost.includes("spawn_sidecar")) failures.push("Rust still contains sidecar lifecycle code");
  if (apiClient.includes("127.0.0.1:5050") || apiClient.includes("fetchRhelo")) failures.push("The frontend still contains Python HTTP fallback logic");
  if (!apiClient.includes('invokeDesktop<SessionPDFExportResult>("export_and_save_session_pdf"')) failures.push("PDF export must use the unified native save IPC command");
} catch (error) {
  failures.push(`Native architecture validation failed: ${error}`);
}

if (failures.length) {
  console.error(`Desktop asset verification failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Desktop assets are ready for the pure Rust build.");
