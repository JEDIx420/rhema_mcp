import { useEffect, useState } from "react";
import { normalizeSpeechLocale } from "@/lib/speech";

type TtsStatus = "checking" | "ready" | "missing";

const normalizeLanguage = (language: string) =>
  language.toLowerCase().replace("_", "-");

export const useTtsDetector = (lang: string = "el-GR") => {
  const [status, setStatus] = useState<TtsStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    let retries = 0;
    const maxRetries = 10;
    const normalizedTarget = normalizeSpeechLocale(lang);
    const targetBase = normalizedTarget.split("-")[0];
    const aliases =
      normalizedTarget === "he-il"
        ? ["he-il", "he", "iw-il", "iw"]
        : normalizedTarget === "el-gr"
          ? ["el-gr", "el"]
          : ["en-us", "en-gb", "en"];

    const matchesLanguage = (voiceLang: string) => {
      const normalizedVoice = normalizeLanguage(voiceLang);
      const voiceBase = normalizedVoice.split("-")[0];
      return (
        normalizedVoice === normalizedTarget ||
        voiceBase === targetBase ||
        normalizedVoice.startsWith(`${targetBase}-`) ||
        aliases.includes(normalizedVoice)
      );
    };

    const checkVoices = () => {
      if (cancelled) return false;
      const voices = window.speechSynthesis.getVoices();
      if (
        voices.some((voice) =>
          matchesLanguage(voice.lang) ||
          (targetBase === "el" && /greek|stefanos/i.test(voice.name)) ||
          (targetBase === "he" && /hebrew/i.test(voice.name)),
        )
      ) {
        setStatus("ready");
        return true;
      }
      return false;
    };

    const settleMissing = () => {
      if (!cancelled) setStatus((current) => (current === "checking" ? "missing" : current));
    };

    if (checkVoices()) {
      return () => {
        cancelled = true;
      };
    }

    const interval = window.setInterval(() => {
      if (checkVoices()) {
        window.clearInterval(interval);
        return;
      }

      retries += 1;
      if (retries >= maxRetries) {
        window.clearInterval(interval);
        settleMissing();
      }
    }, 500);

    const handleVoicesChanged = () => {
      if (checkVoices()) {
        window.clearInterval(interval);
      }
    };

    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
    };
  }, [lang]);

  return status;
};
