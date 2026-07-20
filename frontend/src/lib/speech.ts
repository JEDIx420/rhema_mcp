import type { TtsDiagnosticsResponse, TtsVoiceDescriptor } from "@/lib/api";
import {
  originalLanguageFromLocale,
  shouldRecoverMissingVoice,
  type TtsRecoveryDetail,
} from "@/lib/ttsRecovery";

type SpeechCommand = "speak_text" | "stop_speech";

interface SpeakArguments extends Record<string, unknown> {
  text: string;
  lang: string;
}

type SpeechArguments = SpeakArguments | Record<string, unknown>;

interface TauriWindow extends Window {
  __TAURI_INTERNALS__?: unknown;
}

export type SpeechErrorCode =
  | "unsupported-language"
  | "empty-text"
  | "native-unavailable"
  | "native-query-failed"
  | "voice-unavailable"
  | "voice-selection-failed"
  | "speak-failed"
  | "stop-failed"
  | "state-lock-failed"
  | "browser-fallback-unavailable"
  | "cancelled"
  | "unknown";

export class SpeechError extends Error {
  code: SpeechErrorCode;
  requestedLanguage: string;
  normalizedLocale: string | null;
  platform: string;
  nativeVoiceFound: boolean | null;
  browserVoiceFound: boolean;
  recoveryNotified: boolean;

  constructor(
    code: SpeechErrorCode,
    message: string,
    context: Partial<Pick<SpeechError, "requestedLanguage" | "normalizedLocale" | "platform" | "nativeVoiceFound" | "browserVoiceFound" | "recoveryNotified">> = {},
  ) {
    super(message);
    this.name = "SpeechError";
    this.code = code;
    this.requestedLanguage = context.requestedLanguage ?? "unknown";
    this.normalizedLocale = context.normalizedLocale ?? null;
    this.platform = context.platform ?? getSpeechPlatform();
    this.nativeVoiceFound = context.nativeVoiceFound ?? null;
    this.browserVoiceFound = context.browserVoiceFound ?? false;
    this.recoveryNotified = context.recoveryNotified ?? false;
  }
}

const FALLBACK_TEST_TEXT: Record<"en" | "el" | "he", string> = {
  en: "In the beginning God created the heaven and the earth.",
  el: "Εν αρχη εποιησεν ο Θεος τον ουρανον και την γην.",
  he: "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ.",
};

const LANGUAGE_ALIASES: Record<string, string[]> = {
  "en-us": ["en-us", "en-gb", "en"],
  "el-gr": ["el-gr", "el"],
  "he-il": ["he-il", "he", "iw-il", "iw"],
};

const normalizeLanguage = (language: string) =>
  language.trim().toLowerCase().replaceAll("_", "-");

export const normalizeSpeechLocale = (language: string): "en-us" | "el-gr" | "he-il" => {
  const normalized = normalizeLanguage(language);
  if (normalized === "en" || normalized === "en-us" || normalized === "en-gb") return "en-us";
  if (normalized === "el" || normalized === "el-gr") return "el-gr";
  if (normalized === "he" || normalized === "he-il" || normalized === "iw" || normalized === "iw-il") return "he-il";
  throw new SpeechError("unsupported-language", "Rhelo TTS supports English, Hebrew, and Greek only.");
};

const getBaseLanguage = (language: string) => normalizeLanguage(language).split("-")[0] || "";

const parseNativeSpeechError = (error: unknown): SpeechError => {
  const raw = error instanceof Error ? error.message : String(error);
  const match = raw.match(/\[tts:([a-z-]+)\]\s*(.*)/i);
  if (!match) return new SpeechError("unknown", raw);

  const [, code, message] = match;
  return new SpeechError((code as SpeechErrorCode) || "unknown", message || raw);
};

export const selectBrowserVoice = (voices: SpeechSynthesisVoice[], language: string) => {
  const normalizedTarget = normalizeSpeechLocale(language);
  const targetBase = getBaseLanguage(normalizedTarget);
  const aliases = LANGUAGE_ALIASES[normalizedTarget];
  const hints =
    normalizedTarget === "el-gr"
      ? ["greek", "stefanos"]
      : normalizedTarget === "he-il"
        ? ["hebrew"]
        : ["english"];

  return (
    voices.find((voice) => normalizeLanguage(voice.lang) === normalizedTarget) ||
    voices.find((voice) => getBaseLanguage(voice.lang) === targetBase) ||
    voices.find((voice) => aliases.includes(normalizeLanguage(voice.lang))) ||
    voices.find(
      (voice) =>
        getBaseLanguage(voice.lang) === targetBase &&
        hints.some((hint) => voice.name.toLowerCase().includes(hint)),
    ) ||
    null
  );
};

export const getBrowserTtsDiagnosticsFrom = (voices: SpeechSynthesisVoice[]) => {
  return {
    available: voices.length > 0,
    voices,
    english: selectBrowserVoice(voices, "en"),
    greek: selectBrowserVoice(voices, "el"),
    hebrew: selectBrowserVoice(voices, "he"),
  };
};

export const getBrowserTtsDiagnostics = () => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return getBrowserTtsDiagnosticsFrom([]);
  }

  return getBrowserTtsDiagnosticsFrom(window.speechSynthesis.getVoices());
};

const getSpeechPlatform = () => {
  if (typeof navigator === "undefined") return "unknown";
  return navigator.userAgent || navigator.platform || "unknown";
};

const speakWithBrowserFallback = ({ text, lang }: SpeakArguments) => {
  const diagnostics = getBrowserTtsDiagnostics();
  const selectedVoice = selectBrowserVoice(diagnostics.voices, lang);
  if (!selectedVoice) {
    throw new SpeechError("browser-fallback-unavailable", "No compatible browser speech voice is available for this language.", {
      requestedLanguage: lang,
      normalizedLocale: normalizeSpeechLocale(lang),
      nativeVoiceFound: false,
      browserVoiceFound: false,
    });
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = selectedVoice;
  utterance.lang = selectedVoice.lang || normalizeSpeechLocale(lang);
  window.speechSynthesis.speak(utterance);
};

let nextSpeechActionId = 1;
let speechRequestInFlight = false;

const dispatchRecovery = (error: SpeechError, actionId: number) => {
  if (typeof window === "undefined" || error.recoveryNotified) return;
  const language = originalLanguageFromLocale(error.requestedLanguage);
  if (!language || !shouldRecoverMissingVoice(error.code, error.requestedLanguage)) return;

  const detail: TtsRecoveryDetail = {
    actionId,
    language,
    requestedLanguage: error.requestedLanguage,
    normalizedLocale: language === "greek" ? "el-gr" : "he-il",
    platform: error.platform,
    nativeVoiceFound: error.nativeVoiceFound,
    browserVoiceFound: error.browserVoiceFound,
    code: error.code,
    message: error.message,
  };
  error.recoveryNotified = true;
  window.dispatchEvent(new CustomEvent<TtsRecoveryDetail>("rhelo:tts-recovery", { detail }));
};

export const isTtsRecoveryError = (error: unknown): error is SpeechError =>
  error instanceof SpeechError && error.recoveryNotified;

export async function invokeSpeech(command: SpeechCommand, args: SpeechArguments): Promise<void> {
  const isTauri = (window as TauriWindow).__TAURI_INTERNALS__ !== undefined;

  if (command === "stop_speech") {
    if (isTauri) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke(command, args);
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    return;
  }

  const { text, lang } = args as SpeakArguments;
  const normalizedLocale = normalizeSpeechLocale(lang);
  if (!text.trim()) throw new SpeechError("empty-text", "Rhelo cannot speak an empty text selection.", { requestedLanguage: lang, normalizedLocale });
  if (speechRequestInFlight) return;

  const actionId = nextSpeechActionId++;
  speechRequestInFlight = true;

  try {
    if (!isTauri) {
      speakWithBrowserFallback({ text, lang });
      return;
    }

    const { invoke } = await import("@tauri-apps/api/core");

    try {
      await invoke(command, args);
    } catch (error) {
      const parsed = parseNativeSpeechError(error);
      parsed.requestedLanguage = lang;
      parsed.normalizedLocale = normalizedLocale;
      parsed.platform = getSpeechPlatform();
      const nativeVoiceFound = parsed.code === "voice-selection-failed";
      parsed.nativeVoiceFound = nativeVoiceFound;

      if (["voice-unavailable", "native-unavailable", "voice-selection-failed"].includes(parsed.code)) {
        try {
          speakWithBrowserFallback({ text, lang });
          return;
        } catch (fallbackError) {
          const browserError = fallbackError instanceof SpeechError ? fallbackError : parsed;
          browserError.requestedLanguage = lang;
          browserError.normalizedLocale = normalizedLocale;
          browserError.nativeVoiceFound = nativeVoiceFound;
          browserError.browserVoiceFound = false;
          throw browserError;
        }
      }
      throw parsed;
    }
  } catch (error) {
    const parsed = error instanceof SpeechError
      ? error
      : new SpeechError("unknown", error instanceof Error ? error.message : String(error), {
          requestedLanguage: lang,
          normalizedLocale,
        });
    dispatchRecovery(parsed, actionId);
    throw parsed;
  } finally {
    speechRequestInFlight = false;
  }
}

export const getTtsTestText = (language: "en" | "el" | "he") => FALLBACK_TEST_TEXT[language];

export const summarizeSelectedVoice = (
  selection:
    | TtsDiagnosticsResponse["english"]
    | TtsDiagnosticsResponse["greek"]
    | TtsDiagnosticsResponse["hebrew"]
    | null,
) => {
  if (!selection?.selected_voice) return "None";
  const voice: TtsVoiceDescriptor = selection.selected_voice;
  return `${voice.name} (${voice.language})`;
};
