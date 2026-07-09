import { open } from "@tauri-apps/plugin-shell";

const getSettingsUri = () => {
  const platform = navigator.userAgent.toLowerCase();
  if (platform.includes("win")) {
    return "ms-settings:speech";
  }
  return "x-apple.systempreferences:com.apple.preference.universalaccess?Speech";
};

export const openSpeechSettings = async () => {
  try {
    await open(getSettingsUri());
  } catch (err) {
    console.error("Failed to open speech settings:", err);
    alert("Please open your system speech settings and install a Greek voice pack.");
  }
};
