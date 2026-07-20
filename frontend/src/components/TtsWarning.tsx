"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Settings, X } from "lucide-react";

import { useTtsDetector } from "@/hooks/useTtsDetector";
import {
  clearRecoveryForDetectedLanguage,
  isWindowsPlatform,
  mergeRecoveryDetail,
  type OriginalLanguage,
  type TtsRecoveryDetail,
} from "@/lib/ttsRecovery";
import { openWindowsLanguageSettings } from "@/utils/SystemHelper";

interface TtsWarningProps {
  onGoToSettings: (language: OriginalLanguage) => void;
}

const languageLabel = (language: OriginalLanguage) => language === "greek" ? "Greek" : "Hebrew";

export const TtsWarning = ({ onGoToSettings }: TtsWarningProps) => {
  const [recovery, setRecovery] = useState<TtsRecoveryDetail | null>(null);
  const [manualFallback, setManualFallback] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<OriginalLanguage | null>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const activeLocale = recovery?.language === "hebrew" ? "he-IL" : "el-GR";

  useTtsDetector(activeLocale, recovery !== null);

  useEffect(() => {
    const handleRecovery = (event: Event) => {
      const detail = (event as CustomEvent<TtsRecoveryDetail>).detail;
      setRecovery((current) => mergeRecoveryDetail(current, detail));
      setManualFallback(null);
    };
    const handleDetected = (event: Event) => {
      const language = (event as CustomEvent<{ language: OriginalLanguage }>).detail.language;
      setRecovery((current) => clearRecoveryForDetectedLanguage(current, language));
      setDetectedLanguage(language);
    };

    window.addEventListener("rhelo:tts-recovery", handleRecovery);
    window.addEventListener("rhelo:tts-voice-detected", handleDetected);
    return () => {
      window.removeEventListener("rhelo:tts-recovery", handleRecovery);
      window.removeEventListener("rhelo:tts-voice-detected", handleDetected);
    };
  }, []);

  useEffect(() => {
    if (!detectedLanguage) return undefined;
    const timeout = window.setTimeout(() => setDetectedLanguage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [detectedLanguage]);

  useEffect(() => {
    if (!recovery) return undefined;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    primaryButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRecovery(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [recovery]);

  const handleOpenWindowsSettings = async () => {
    if (!recovery) return;
    const result = await openWindowsLanguageSettings(recovery.language);
    if (!result.opened) {
      setManualFallback(result.error || "Open Settings > Time & language > Language & region manually.");
    }
  };

  const handleGoToSettings = () => {
    if (!recovery) return;
    const language = recovery.language;
    setRecovery(null);
    onGoToSettings(language);
  };

  const label = recovery ? languageLabel(recovery.language) : "";
  const isWindows = recovery ? isWindowsPlatform(recovery.platform) : false;

  return (
    <>
      {detectedLanguage ? (
        <div className="fixed bottom-5 right-5 z-[3100] flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 shadow-xl" role="status">
          <CheckCircle2 size={18} />
          {languageLabel(detectedLanguage)} voice detected
        </div>
      ) : null}

      {recovery ? (
        <div
          className="fixed bottom-5 right-5 z-[3200] w-[min(420px,calc(100vw-2.5rem))] rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl"
          role="dialog"
          aria-labelledby="tts-recovery-title"
          aria-describedby="tts-recovery-description"
        >
          <button
            type="button"
            onClick={() => setRecovery(null)}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close voice setup message"
          >
            <X size={16} />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700"><AlertTriangle size={20} /></div>
            <div>
              <h3 id="tts-recovery-title" className="font-bold text-slate-900">{label} voice required</h3>
              <p id="tts-recovery-description" className="mt-1 text-sm leading-6 text-slate-600">
                Rhelo could not find a compatible {label} text-to-speech voice on this {isWindows ? "Windows computer" : "computer"}.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {isWindows
                  ? `Install the ${label} speech feature through Windows Settings, then refresh voice detection in Rhelo.`
                  : `Open Rhelo TTS Settings for diagnostics and refresh after installing a compatible ${label} system voice.`}
              </p>
            </div>
          </div>

          {manualFallback ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Windows Settings could not be opened automatically. {manualFallback} The complete manual steps remain available in Rhelo TTS Settings.
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              ref={primaryButtonRef}
              type="button"
              onClick={handleGoToSettings}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Settings size={15} /> Go to TTS Settings
            </button>
            {isWindows ? (
              <button
                type="button"
                onClick={() => void handleOpenWindowsSettings()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink size={15} /> Open Windows Language Settings
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setRecovery(null)}
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
};
