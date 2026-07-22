import type { RemoteTranslationConfig } from "@/lib/translations/config";
import { TranslationError, validateTranslationDescriptor, type TranslationDescriptor } from "@/lib/translations/domain";

interface RemoteCatalogueResponse {
  revision?: string;
  translations: TranslationDescriptor[];
}

export class RheloRemoteCatalogueClient {
  private etag: string | undefined;

  constructor(
    private readonly config: RemoteTranslationConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async fetchLatest(): Promise<TranslationDescriptor[]> {
    if (!this.config.enabled) return [];
    const response = await this.fetcher(`${this.config.baseUrl}/api/v1/translations`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(this.etag ? { "If-None-Match": this.etag } : {}),
      },
      credentials: "omit",
    });
    if (response.status === 304) return [];
    if (!response.ok) {
      throw new TranslationError("temporary_error", `The Rhelo catalogue returned HTTP ${response.status}.`, response.status >= 500);
    }
    const document = await response.json() as RemoteCatalogueResponse;
    if (!Array.isArray(document.translations)) {
      throw new TranslationError("invalid_response", "The Rhelo catalogue response is invalid.");
    }
    this.etag = response.headers.get("ETag") ?? undefined;
    return document.translations.map((descriptor) => validateTranslationDescriptor(descriptor));
  }
}
