import { useCallback, useEffect, useRef, useState } from "react";

import { fetchTtsDiagnostics, type TtsDiagnosticsResponse } from "@/lib/api";
import { getBrowserTtsDiagnosticsFrom, normalizeSpeechLocale } from "@/lib/speech";
import { consumeFocusRefresh, originalLanguageFromLocale } from "@/lib/ttsRecovery";

export type TtsStatus = "checking" | "ready" | "missing";

export interface TtsDetection {
  status: TtsStatus;
  nativeVoiceFound: boolean | null;
  browserVoiceFound: boolean;
  selectedVoice: string | null;
}

const nativeSelectionFor = (diagnostics: TtsDiagnosticsResponse, language: string) => {
  const normalized = normalizeSpeechLocale(language);
  if (normalized === "el-gr") return diagnostics.greek;
  if (normalized === "he-il") return diagnostics.hebrew;
  return diagnostics.english;
};

export async function detectTtsAvailabilityWith(
  language: string,
  loadNative: () => Promise<TtsDiagnosticsResponse>,
  browserVoices: SpeechSynthesisVoice[],
): Promise<TtsDetection> {
  const browser = getBrowserTtsDiagnosticsFrom(browserVoices);
  const normalized = normalizeSpeechLocale(language);
  const browserVoice = normalized === "el-gr" ? browser.greek : normalized === "he-il" ? browser.hebrew : browser.english;

  try {
    const native = nativeSelectionFor(await loadNative(), language);
    const available = native.available || browserVoice !== null;
    return {
      status: available ? "ready" : "missing",
      nativeVoiceFound: native.available,
      browserVoiceFound: browserVoice !== null,
      selectedVoice: native.selected_voice?.name ?? browserVoice?.name ?? null,
    };
  } catch {
    return {
      status: browserVoice ? "ready" : "missing",
      nativeVoiceFound: null,
      browserVoiceFound: browserVoice !== null,
      selectedVoice: browserVoice?.name ?? null,
    };
  }
}

export const useTtsDetector = (lang: string = "el-GR", enabled = true) => {
  const [detection, setDetection] = useState<TtsDetection>({
    status: "checking",
    nativeVoiceFound: null,
    browserVoiceFound: false,
    selectedVoice: null,
  });
  const refreshInFlight = useRef(false);
  const pendingSettingsFocus = useRef(false);
  const previousAvailable = useRef<boolean | null>(null);

  const refresh = useCallback(async (showChecking = false) => {
    if (!enabled || refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (showChecking) setDetection((current) => ({ ...current, status: "checking" }));

    const voices = typeof window !== "undefined" && "speechSynthesis" in window
      ? window.speechSynthesis.getVoices()
      : [];
    try {
      const next = await detectTtsAvailabilityWith(lang, fetchTtsDiagnostics, voices);
      const available = next.status === "ready";
      if (previousAvailable.current !== true && available) {
        const language = originalLanguageFromLocale(lang);
        if (language) window.dispatchEvent(new CustomEvent("rhelo:tts-voice-detected", { detail: { language } }));
      }
      previousAvailable.current = available;
      setDetection(next);
    } finally {
      refreshInFlight.current = false;
    }
  }, [enabled, lang]);

  useEffect(() => {
    if (!enabled) return undefined;
    void refresh(true);

    const handleSettingsOpened = () => {
      pendingSettingsFocus.current = true;
    };
    const handleFocus = () => {
      const focusRefresh = consumeFocusRefresh(pendingSettingsFocus.current);
      pendingSettingsFocus.current = focusRefresh.pending;
      if (!focusRefresh.shouldRefresh) return;
      void refresh(true);
    };
    const handleVoicesChanged = () => void refresh(false);

    window.addEventListener("rhelo:windows-settings-opened", handleSettingsOpened);
    window.addEventListener("focus", handleFocus);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    }

    return () => {
      window.removeEventListener("rhelo:windows-settings-opened", handleSettingsOpened);
      window.removeEventListener("focus", handleFocus);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
      }
    };
  }, [enabled, lang, refresh]);

  return { ...detection, refresh: () => refresh(true) };
};
