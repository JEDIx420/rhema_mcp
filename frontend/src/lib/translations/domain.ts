import { BIBLE_BOOKS } from "@/lib/books";

export type TranslationSource = "embedded" | "installed_pack" | "rhelo_api";

export type TranslationAvailability =
  | "available_offline"
  | "downloaded"
  | "cached_remote"
  | "online"
  | "unavailable";

export type TranslationAccessState =
  | "public"
  | "account_required"
  | "entitlement_required"
  | "subscription_required"
  | "license_expired";

export type TranslationCacheState =
  | "embedded"
  | "downloaded"
  | "device_fresh"
  | "device_stale"
  | "live_remote";

export interface TranslationDescriptor {
  id: string;
  slug: string;
  abbreviation: string;
  displayName: string;
  languageCode: string;
  languageName: string;
  textDirection: "ltr" | "rtl";
  source: TranslationSource;
  availability: TranslationAvailability;
  accessState: TranslationAccessState;
  version?: string;
  revision?: string;
  downloadable: boolean;
  offlineCapable: boolean;
  requiresAccount: boolean;
  requiresEntitlement: boolean;
  copyright?: string;
  attribution?: string;
  sortOrder: number;
}

export interface CanonicalReference {
  bookId: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

export interface TranslationVerse {
  verse: number;
  text: string;
  heading?: string;
  paragraphStart?: boolean;
  footnotes?: unknown[];
}

export interface TranslationPassage {
  translationId: string;
  reference: CanonicalReference;
  verses: TranslationVerse[];
  sourceRevision?: string;
  fetchedAt?: string;
  refreshAfter?: string;
  mustRefreshBy?: string;
  attribution?: string;
  copyright?: string;
  cacheState?: TranslationCacheState;
}

export type TranslationErrorCode =
  | "invalid_reference"
  | "unknown_translation"
  | "missing_passage"
  | "unavailable_offline"
  | "remote_disabled"
  | "login_required"
  | "entitlement_required"
  | "subscription_required"
  | "license_expired"
  | "pack_conflict"
  | "remote_quota_exhausted"
  | "rate_limited"
  | "temporary_error"
  | "invalid_response"
  | "cancelled";

export class TranslationError extends Error {
  constructor(
    public readonly code: TranslationErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "TranslationError";
  }
}

const CANONICAL_BOOK_IDS = new Set(BIBLE_BOOKS.map((book) => book.code));
const RHELO_TRANSLATION_ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const TRANSLATION_SOURCES = new Set<TranslationSource>(["embedded", "installed_pack", "rhelo_api"]);
const TRANSLATION_AVAILABILITIES = new Set<TranslationAvailability>(["available_offline", "downloaded", "cached_remote", "online", "unavailable"]);
const TRANSLATION_ACCESS_STATES = new Set<TranslationAccessState>(["public", "account_required", "entitlement_required", "subscription_required", "license_expired"]);

export function isCanonicalBookId(bookId: string): boolean {
  return CANONICAL_BOOK_IDS.has(bookId);
}

export function assertCanonicalReference(reference: CanonicalReference): CanonicalReference {
  if (!isCanonicalBookId(reference.bookId)) {
    throw new TranslationError("invalid_reference", `Unknown canonical book ID: ${reference.bookId}`);
  }
  const book = BIBLE_BOOKS.find((candidate) => candidate.code === reference.bookId);
  if (!Number.isInteger(reference.chapter) || reference.chapter < 1 || reference.chapter > (book?.chapters ?? 0)) {
    throw new TranslationError(
      "invalid_reference",
      `Invalid chapter ${reference.chapter} for ${reference.bookId}`,
    );
  }
  if (reference.verseStart !== undefined && (!Number.isInteger(reference.verseStart) || reference.verseStart < 1)) {
    throw new TranslationError("invalid_reference", "verseStart must be a positive integer");
  }
  if (reference.verseEnd !== undefined && (!Number.isInteger(reference.verseEnd) || reference.verseEnd < 1)) {
    throw new TranslationError("invalid_reference", "verseEnd must be a positive integer");
  }
  if (
    reference.verseStart !== undefined
    && reference.verseEnd !== undefined
    && reference.verseEnd < reference.verseStart
  ) {
    throw new TranslationError("invalid_reference", "verseEnd must not precede verseStart");
  }
  return reference;
}

export function validateTranslationDescriptor(descriptor: TranslationDescriptor): TranslationDescriptor {
  if (!RHELO_TRANSLATION_ID_PATTERN.test(descriptor.id)) {
    throw new Error(`Invalid Rhelo translation ID: ${descriptor.id}`);
  }
  if (!descriptor.slug || !descriptor.abbreviation || !descriptor.displayName) {
    throw new Error(`Translation ${descriptor.id} is missing display metadata`);
  }
  if (!descriptor.languageCode || !descriptor.languageName) {
    throw new Error(`Translation ${descriptor.id} is missing language metadata`);
  }
  if (!TRANSLATION_SOURCES.has(descriptor.source)) throw new Error(`Translation ${descriptor.id} has an invalid source`);
  if (!TRANSLATION_AVAILABILITIES.has(descriptor.availability)) throw new Error(`Translation ${descriptor.id} has invalid availability`);
  if (!TRANSLATION_ACCESS_STATES.has(descriptor.accessState)) throw new Error(`Translation ${descriptor.id} has an invalid access state`);
  if (descriptor.textDirection !== "ltr" && descriptor.textDirection !== "rtl") {
    throw new Error(`Translation ${descriptor.id} has an invalid text direction`);
  }
  if (
    typeof descriptor.downloadable !== "boolean"
    || typeof descriptor.offlineCapable !== "boolean"
    || typeof descriptor.requiresAccount !== "boolean"
    || typeof descriptor.requiresEntitlement !== "boolean"
  ) {
    throw new Error(`Translation ${descriptor.id} has invalid capability metadata`);
  }
  if (!Number.isFinite(descriptor.sortOrder)) throw new Error(`Translation ${descriptor.id} has an invalid sort order`);
  if (descriptor.requiresAccount !== (descriptor.accessState !== "public")) {
    throw new Error(`Translation ${descriptor.id} has inconsistent account access metadata`);
  }
  if (descriptor.requiresEntitlement !== descriptor.accessState.includes("entitlement")) {
    throw new Error(`Translation ${descriptor.id} has inconsistent entitlement metadata`);
  }
  return descriptor;
}

export function canonicalPassageKey(
  translationId: string,
  reference: CanonicalReference,
  revision = "current",
  contentFormatVersion = 1,
): string {
  assertCanonicalReference(reference);
  return [translationId, reference.bookId, reference.chapter, revision, `v${contentFormatVersion}`].join(":");
}
