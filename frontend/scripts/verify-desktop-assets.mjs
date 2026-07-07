import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const requiredAssets = [
  { path: resolve("..", "rhelo.db"), minimumBytes: 1_000_000, label: "Rhelo database" },
  { path: resolve("..", "ggml-base.bin"), minimumBytes: 1_000_000, label: "Whisper model" },
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
  if (resources?.["../../rhelo.db"] !== "rhelo.db") {
    failures.push("Tauri must map ../../rhelo.db to the resource root as rhelo.db");
  }
  if (resources?.["../../ggml-base.bin"] !== "ggml-base.bin") {
    failures.push("Tauri must map ../../ggml-base.bin to the resource root as ggml-base.bin");
  }
  const externalBin = tauriConfig?.bundle?.externalBin;
  if (!Array.isArray(externalBin) || !externalBin.includes("binaries/server")) {
    failures.push("Tauri externalBin must contain binaries/server so the target triple is appended automatically");
  }
} catch (error) {
  failures.push(`Tauri resource configuration could not be validated: ${error}`);
}

try {
  const sidecarPath = resolve("src-tauri", "binaries", "server-aarch64-apple-darwin");
  const sidecarStat = statSync(sidecarPath);
  if (sidecarStat.size < 1_000_000) {
    failures.push(`The ARM64 Python sidecar is empty or incomplete: ${sidecarPath}`);
  }

  const backendSources = [resolve("..", "server.py"), resolve("..", "server.spec")];
  const backendRoot = resolve("..", "rhelo_backend");
  for (const entry of readdirSync(backendRoot, { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && [".py", ".ttf", ".txt"].some((suffix) => entry.name.endsWith(suffix))) {
      backendSources.push(resolve(entry.parentPath, entry.name));
    }
  }
  const newestSourceTime = Math.max(...backendSources.map((path) => statSync(path).mtimeMs));
  if (sidecarStat.mtimeMs < newestSourceTime) {
    failures.push("The ARM64 Python sidecar is older than its backend source; rebuild it before packaging");
  }
} catch {
  failures.push("The ARM64 Python sidecar is missing; rebuild server-aarch64-apple-darwin before packaging");
}

try {
  const rustHost = readFileSync(resolve("src-tauri", "src", "lib.rs"), "utf8");
  const apiClient = readFileSync(resolve("src", "lib", "api.ts"), "utf8");
  const readingDesk = readFileSync(resolve("src", "components", "ReadingDesk.tsx"), "utf8");

  if (!rustHost.includes('.env("RHELO_API_PORT", "5050")')) {
    failures.push("The desktop sidecar must use the application API endpoint");
  }
  if (!apiClient.includes('WEB_API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5050"')) {
    failures.push("The frontend and desktop sidecar endpoints do not match");
  }
  if (readingDesk.includes("NEXT_PUBLIC_API_URL")) {
    failures.push("ReadingDesk must use the shared API client instead of bypassing desktop routing");
  }
} catch (error) {
  failures.push(`Desktop endpoint routing could not be validated: ${error}`);
}

if (failures.length) {
  console.error(`Desktop asset verification failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Desktop assets are ready.");
