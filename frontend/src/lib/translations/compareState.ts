export const DEFAULT_COMPARE_TRANSLATION_IDS = ["en_bsb", "en_web", "en_kjv"] as const;
export const COMPARE_PREFERENCES_KEY = "rhelo-compare-preferences:v1";

export interface ComparePreferences {
  version: 1;
  translationIds: string[];
  layout: "columns";
  synchronizedScroll: boolean;
}

export const DEFAULT_COMPARE_PREFERENCES: ComparePreferences = {
  version: 1,
  translationIds: [...DEFAULT_COMPARE_TRANSLATION_IDS],
  layout: "columns",
  synchronizedScroll: false,
};

export function normalizeComparePreferences(
  value: unknown,
  availableIds: readonly string[],
): ComparePreferences {
  const available = new Set(availableIds);
  const candidate = value && typeof value === "object" ? value as Partial<ComparePreferences> : {};
  const translationIds = Array.isArray(candidate.translationIds)
    ? [...new Set(candidate.translationIds.filter((id): id is string => typeof id === "string" && available.has(id)))]
    : [];
  const defaults = DEFAULT_COMPARE_TRANSLATION_IDS.filter((id) => available.has(id));
  return {
    version: 1,
    translationIds: translationIds.length > 0 ? translationIds : defaults,
    layout: "columns",
    synchronizedScroll: candidate.synchronizedScroll === true,
  };
}

export function addCompareTranslation(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? [...ids] : [...ids, id];
}

export function removeCompareTranslation(ids: readonly string[], id: string): string[] {
  return ids.length <= 1 ? [...ids] : ids.filter((candidate) => candidate !== id);
}

export function replaceCompareTranslation(ids: readonly string[], previousId: string, nextId: string): string[] {
  if (previousId === nextId || ids.includes(nextId)) return [...ids];
  return ids.map((candidate) => candidate === previousId ? nextId : candidate);
}

export function moveCompareTranslation(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const index = ids.indexOf(id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return [...ids];
  const reordered = [...ids];
  [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
  return reordered;
}

export function readComparePreferences(availableIds: readonly string[]): ComparePreferences {
  if (typeof window === "undefined") return normalizeComparePreferences(null, availableIds);
  try {
    return normalizeComparePreferences(JSON.parse(window.localStorage.getItem(COMPARE_PREFERENCES_KEY) ?? "null"), availableIds);
  } catch {
    return normalizeComparePreferences(null, availableIds);
  }
}

export function writeComparePreferences(preferences: ComparePreferences): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(COMPARE_PREFERENCES_KEY, JSON.stringify(preferences));
  }
}
