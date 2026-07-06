import { statSync } from "node:fs";
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

if (failures.length) {
  console.error(`Desktop asset verification failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Desktop assets are ready.");
