"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_ENGLISH_TRANSLATION,
  EnglishTranslationCode,
  getStoredEnglishTranslation,
  storeEnglishTranslation,
} from "@/lib/englishTranslations";

interface EnglishTranslationContextValue {
  activeEnglishTranslation: EnglishTranslationCode;
  setActiveEnglishTranslation: (code: EnglishTranslationCode) => void;
}

const EnglishTranslationContext = createContext<EnglishTranslationContextValue | null>(null);

export default function EnglishTranslationProvider({ children }: { children: React.ReactNode }) {
  const [activeEnglishTranslation, setActiveTranslationState] = useState<EnglishTranslationCode>(DEFAULT_ENGLISH_TRANSLATION);

  useEffect(() => {
    const initialization = window.setTimeout(() => setActiveTranslationState(getStoredEnglishTranslation()), 0);
    return () => window.clearTimeout(initialization);
  }, []);

  const setActiveEnglishTranslation = (code: EnglishTranslationCode) => {
    storeEnglishTranslation(code);
    setActiveTranslationState(code);
  };

  return (
    <EnglishTranslationContext.Provider value={{ activeEnglishTranslation, setActiveEnglishTranslation }}>
      {children}
    </EnglishTranslationContext.Provider>
  );
}

export function useEnglishTranslation() {
  const context = useContext(EnglishTranslationContext);
  if (!context) throw new Error("useEnglishTranslation must be used inside EnglishTranslationProvider");
  return context;
}
