import type { TranslationProvider } from "@/lib/translations/provider";
import {
  assertCanonicalReference,
  TranslationError,
  type CanonicalReference,
  type TranslationDescriptor,
  type TranslationPassage,
} from "@/lib/translations/domain";
import type { RemoteTranslationConfig } from "@/lib/translations/config";

interface RemotePassageResponse {
  translationId: string;
  reference: CanonicalReference;
  verses: Array<{
    verse: number;
    text: string;
    heading?: string;
    paragraphStart?: boolean;
    footnotes?: unknown[];
  }>;
  sourceRevision?: string;
  fetchedAt?: string;
  refreshAfter?: string;
  mustRefreshBy?: string;
  attribution?: string;
  copyright?: string;
}

function retryAfterSeconds(response: Response): number | undefined {
  const value = response.headers.get("Retry-After");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : undefined;
}

async function responseError(response: Response): Promise<TranslationError> {
  let applicationCode: string | undefined;
  try {
    const body = await response.clone().json() as { code?: string };
    applicationCode = body.code;
  } catch {
    applicationCode = undefined;
  }
  if (applicationCode === "remote_quota_exhausted") {
    return new TranslationError("remote_quota_exhausted", "The remote translation quota is temporarily exhausted.");
  }
  if (applicationCode === "subscription_required") return new TranslationError("subscription_required", "A subscription is required for this translation.");
  if (applicationCode === "license_expired") return new TranslationError("license_expired", "The licence for this translation has expired.");
  if (response.status === 401) return new TranslationError("login_required", "Sign in is required for this translation.");
  if (response.status === 403) return new TranslationError("entitlement_required", "Your account does not include this translation.");
  if (response.status === 404) return new TranslationError("missing_passage", "This passage is unavailable in the selected translation.");
  if (response.status === 409) return new TranslationError("pack_conflict", "The translation pack or revision conflicts with this passage.");
  if (response.status === 429) {
    return new TranslationError("rate_limited", "The translation service is rate limited.", false, retryAfterSeconds(response));
  }
  if (response.status >= 500) return new TranslationError("temporary_error", "The translation service is temporarily unavailable.", true);
  return new TranslationError("temporary_error", `The translation service returned HTTP ${response.status}.`);
}

export class RheloRemoteTranslationProvider implements TranslationProvider {
  constructor(
    private readonly config: RemoteTranslationConfig,
    private readonly catalogue: () => Promise<TranslationDescriptor[]>,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async listTranslations(): Promise<TranslationDescriptor[]> {
    return this.catalogue();
  }

  async isAvailableOffline(): Promise<boolean> {
    return false;
  }

  async getPassage(input: {
    translationId: string;
    reference: CanonicalReference;
    signal?: AbortSignal;
  }): Promise<TranslationPassage> {
    if (!this.config.enabled) {
      throw new TranslationError("remote_disabled", "Remote translations are not enabled in this build.");
    }
    assertCanonicalReference(input.reference);
    const path = [
      "api/v1/translations",
      encodeURIComponent(input.translationId),
      "chapters",
      encodeURIComponent(input.reference.bookId),
      String(input.reference.chapter),
    ].join("/");
    const url = `${this.config.baseUrl}/${path}`;

    let response: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await this.fetcher(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: input.signal,
          credentials: "omit",
        });
      } catch (error) {
        if (input.signal?.aborted) throw new TranslationError("cancelled", "The passage request was cancelled.");
        if (attempt === 0 && error instanceof Error && error.name === "TimeoutError") continue;
        throw new TranslationError("temporary_error", error instanceof Error ? error.message : "Remote passage request failed.", true);
      }
      if (response.ok || response.status < 500 || attempt === 1) break;
    }

    if (!response) throw new TranslationError("temporary_error", "Remote passage request failed.", true);
    if (!response.ok) throw await responseError(response);

    const body = await response.json() as RemotePassageResponse;
    if (
      body.translationId !== input.translationId
      || body.reference?.bookId !== input.reference.bookId
      || body.reference?.chapter !== input.reference.chapter
      || !Array.isArray(body.verses)
      || body.verses.some((verse) => !Number.isInteger(verse.verse) || typeof verse.text !== "string")
    ) {
      throw new TranslationError("invalid_response", "The Rhelo API returned an invalid passage response.");
    }

    return {
      ...body,
      reference: input.reference,
      cacheState: "live_remote",
      fetchedAt: body.fetchedAt ?? new Date().toISOString(),
    };
  }
}
