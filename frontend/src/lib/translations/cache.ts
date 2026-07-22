import { canonicalPassageKey, isCanonicalBookId, type TranslationPassage } from "@/lib/translations/domain";

export const REMOTE_CACHE_FRESH_DAYS = 14;
export const REMOTE_CACHE_MAX_DAYS = 30;
export const TRANSLATION_CONTENT_FORMAT_VERSION = 1;

export type RemoteCacheFreshness = "fresh" | "stale" | "expired";

export interface PassageCache {
  get(key: string): Promise<TranslationPassage | null>;
  set(key: string, passage: TranslationPassage): Promise<void>;
  delete(key: string): Promise<void>;
}

export function remotePassageCacheKey(passage: Pick<TranslationPassage, "translationId" | "reference" | "sourceRevision">): string {
  return canonicalPassageKey(
    passage.translationId,
    passage.reference,
    passage.sourceRevision ?? "current",
    TRANSLATION_CONTENT_FORMAT_VERSION,
  );
}

export function getRemoteCacheFreshness(passage: TranslationPassage, now = Date.now()): RemoteCacheFreshness {
  const fetchedAt = Date.parse(passage.fetchedAt ?? "");
  if (!Number.isFinite(fetchedAt)) return "expired";

  const ageMs = Math.max(0, now - fetchedAt);
  const dayMs = 24 * 60 * 60 * 1000;
  const refreshAfter = Date.parse(passage.refreshAfter ?? "");
  const mustRefreshBy = Date.parse(passage.mustRefreshBy ?? "");

  if (Number.isFinite(mustRefreshBy) && now >= mustRefreshBy) return "expired";
  if (Number.isFinite(refreshAfter) && now >= refreshAfter) {
    return ageMs < REMOTE_CACHE_MAX_DAYS * dayMs ? "stale" : "expired";
  }
  if (ageMs < REMOTE_CACHE_FRESH_DAYS * dayMs) return "fresh";
  if (ageMs < REMOTE_CACHE_MAX_DAYS * dayMs) return "stale";
  return "expired";
}

export class MemoryPassageCache implements PassageCache {
  private readonly passages = new Map<string, TranslationPassage>();

  async get(key: string): Promise<TranslationPassage | null> {
    return this.passages.get(key) ?? null;
  }

  async set(key: string, passage: TranslationPassage): Promise<void> {
    this.passages.set(key, passage);
  }

  async delete(key: string): Promise<void> {
    this.passages.delete(key);
  }
}

export class LocalStoragePassageCache implements PassageCache {
  constructor(private readonly prefix = "rhelo-translation-passage:") {}

  async get(key: string): Promise<TranslationPassage | null> {
    if (typeof window === "undefined") return null;
    const value = window.localStorage.getItem(`${this.prefix}${key}`);
    if (!value) return null;
    try {
      const passage = JSON.parse(value) as TranslationPassage;
      if (
        !passage
        || typeof passage.translationId !== "string"
        || !passage.reference
        || !isCanonicalBookId(passage.reference.bookId)
        || !Number.isInteger(passage.reference.chapter)
        || !Array.isArray(passage.verses)
        || passage.verses.some((verse) => !Number.isInteger(verse.verse) || typeof verse.text !== "string")
      ) {
        throw new Error("Invalid cached passage");
      }
      return passage;
    } catch {
      window.localStorage.removeItem(`${this.prefix}${key}`);
      return null;
    }
  }

  async set(key: string, passage: TranslationPassage): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(`${this.prefix}${key}`, JSON.stringify(passage));
    } catch {
      // A full device cache must not make an otherwise usable remote passage fail.
    }
  }

  async delete(key: string): Promise<void> {
    if (typeof window !== "undefined") window.localStorage.removeItem(`${this.prefix}${key}`);
  }
}
