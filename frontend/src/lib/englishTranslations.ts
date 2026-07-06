export const ENGLISH_TRANSLATIONS = [
  { code: "en_bsb", shortLabel: "BSB", label: "Berean Standard Bible", description: "Modern, accurate, and highly readable." },
  { code: "en_web", shortLabel: "WEB", label: "World English Bible", description: "Contemporary public-domain English." },
  { code: "en_kjv", shortLabel: "KJV", label: "King James Version", description: "The classic 1769 English edition." },
] as const;

export type EnglishTranslationCode = (typeof ENGLISH_TRANSLATIONS)[number]["code"];
export const DEFAULT_ENGLISH_TRANSLATION: EnglishTranslationCode = "en_bsb";

export function getStoredEnglishTranslation(): EnglishTranslationCode {
  if (typeof window === "undefined") return DEFAULT_ENGLISH_TRANSLATION;
  const stored = window.localStorage.getItem("rhelo-english-translation");
  return ENGLISH_TRANSLATIONS.some((item) => item.code === stored)
    ? stored as EnglishTranslationCode
    : DEFAULT_ENGLISH_TRANSLATION;
}

export function storeEnglishTranslation(code: EnglishTranslationCode) {
  window.localStorage.setItem("rhelo-english-translation", code);
}
