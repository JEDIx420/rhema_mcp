import type { TtsDiagnosticsResponse, TtsVoiceDescriptor } from "@/lib/api";

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
  | "unknown";

export class SpeechError extends Error {
  code: SpeechErrorCode;

  constructor(code: SpeechErrorCode, message: string) {
    super(message);
    this.name = "SpeechError";
    this.code = code;
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

const selectBrowserVoice = (voices: SpeechSynthesisVoice[], language: string) => {
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

export const ensureGreekVoice = (): boolean => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  return selectBrowserVoice(window.speechSynthesis.getVoices(), "el") !== null;
};

export const getBrowserTtsDiagnostics = () => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return {
      available: false,
      voices: [] as SpeechSynthesisVoice[],
      english: null as SpeechSynthesisVoice | null,
      greek: null as SpeechSynthesisVoice | null,
      hebrew: null as SpeechSynthesisVoice | null,
    };
  }

  const voices = window.speechSynthesis.getVoices();
  return {
    available: voices.length > 0,
    voices,
    english: selectBrowserVoice(voices, "en"),
    greek: selectBrowserVoice(voices, "el"),
    hebrew: selectBrowserVoice(voices, "he"),
  };
};

const speakWithBrowserFallback = ({ text, lang }: SpeakArguments) => {
  const diagnostics = getBrowserTtsDiagnostics();
  const selectedVoice = selectBrowserVoice(diagnostics.voices, lang);
  if (!selectedVoice) {
    throw new SpeechError(
      "browser-fallback-unavailable",
      "No compatible browser speech voice is available for this language.",
    );
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = selectedVoice;
  utterance.lang = selectedVoice.lang || normalizeSpeechLocale(lang);
  window.speechSynthesis.speak(utterance);
};

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
  normalizeSpeechLocale(lang);

  if (!isTauri) {
    speakWithBrowserFallback({ text, lang });
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");

  try {
    await invoke(command, args);
  } catch (error) {
    const parsed = parseNativeSpeechError(error);
    if (parsed.code === "voice-unavailable" || parsed.code === "native-unavailable") {
      speakWithBrowserFallback({ text, lang });
      return;
    }
    throw parsed;
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
