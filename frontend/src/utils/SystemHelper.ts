import { isWindowsPlatform, type OriginalLanguage } from "@/lib/ttsRecovery";

export type WindowsSettingsPage = "language" | "speech";

export interface WindowsSettingsOpenResult {
  opened: boolean;
  requested_page: WindowsSettingsPage;
  opened_uri: string | null;
  used_fallback: boolean;
  error: string | null;
}

type InvokeWindowsSettings = (
  command: "open_windows_settings",
  args: { page: WindowsSettingsPage },
) => Promise<WindowsSettingsOpenResult>;

const unsupportedResult = (page: WindowsSettingsPage): WindowsSettingsOpenResult => ({
  opened: false,
  requested_page: page,
  opened_uri: null,
  used_fallback: false,
  error: "Windows Settings links are available only on Windows.",
});

export async function openWindowsSettingsWith(
  invoke: InvokeWindowsSettings,
  page: WindowsSettingsPage,
  platform: string,
): Promise<WindowsSettingsOpenResult> {
  if (!isWindowsPlatform(platform)) return unsupportedResult(page);
  return invoke("open_windows_settings", { page });
}

export async function openWindowsSettings(
  page: WindowsSettingsPage,
  missingLanguage?: OriginalLanguage,
): Promise<WindowsSettingsOpenResult> {
  const platform = typeof navigator === "undefined" ? "unknown" : navigator.userAgent || navigator.platform;
  if (!isWindowsPlatform(platform)) return unsupportedResult(page);

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await openWindowsSettingsWith(invoke, page, platform);
    if (result.opened && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("rhelo:windows-settings-opened", {
          detail: { page, missingLanguage },
        }),
      );
    }
    return result;
  } catch (error) {
    return {
      ...unsupportedResult(page),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const openWindowsLanguageSettings = (missingLanguage?: OriginalLanguage) =>
  openWindowsSettings("language", missingLanguage);

export const openWindowsSpeechSettings = () => openWindowsSettings("speech");
