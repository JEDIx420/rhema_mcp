export type OriginalLanguage = "greek" | "hebrew";

export interface TtsSettingsTarget {
  section: "tts";
  missingLanguage: OriginalLanguage;
  requestId: number;
}

export interface TtsRecoveryDetail {
  actionId: number;
  language: OriginalLanguage;
  requestedLanguage: string;
  normalizedLocale: "el-gr" | "he-il";
  platform: string;
  nativeVoiceFound: boolean | null;
  browserVoiceFound: boolean;
  code: string;
  message: string;
}

export const originalLanguageFromLocale = (locale: string): OriginalLanguage | null => {
  const normalized = locale.trim().toLowerCase().replaceAll("_", "-");
  if (normalized === "el" || normalized.startsWith("el-")) return "greek";
  if (normalized === "he" || normalized.startsWith("he-") || normalized === "iw" || normalized.startsWith("iw-")) {
    return "hebrew";
  }
  return null;
};

export const createTtsSettingsTarget = (
  missingLanguage: OriginalLanguage,
  requestId: number,
): TtsSettingsTarget => ({ section: "tts", missingLanguage, requestId });

export const mergeRecoveryDetail = (
  current: TtsRecoveryDetail | null,
  incoming: TtsRecoveryDetail,
): TtsRecoveryDetail => (current?.actionId === incoming.actionId ? current : incoming);

export const clearRecoveryForDetectedLanguage = (
  current: TtsRecoveryDetail | null,
  detectedLanguage: OriginalLanguage,
): TtsRecoveryDetail | null => current?.language === detectedLanguage ? null : current;

export const isWindowsPlatform = (platform: string) => platform.toLowerCase().includes("win");

export const shouldRecoverMissingVoice = (code: string, requestedLanguage: string) => {
  if (!originalLanguageFromLocale(requestedLanguage)) return false;
  return [
    "native-unavailable",
    "voice-unavailable",
    "voice-selection-failed",
    "browser-fallback-unavailable",
  ].includes(code);
};

export const consumeFocusRefresh = (pending: boolean) => ({
  shouldRefresh: pending,
  pending: false,
});
