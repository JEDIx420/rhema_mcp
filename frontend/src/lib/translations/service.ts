import { canonicalPassageKey, TranslationError, type CanonicalReference, type TranslationDescriptor, type TranslationPassage, type TranslationSource } from "@/lib/translations/domain";
import type { TranslationCatalogueService } from "@/lib/translations/catalogue";
import type { PassageCache } from "@/lib/translations/cache";
import { getRemoteCacheFreshness } from "@/lib/translations/cache";
import type { TranslationProvider } from "@/lib/translations/provider";

export class UnifiedTranslationService {
  private readonly inFlight = new Map<string, Promise<TranslationPassage>>();
  private readonly embeddedMemory = new Map<string, TranslationPassage>();

  constructor(
    private readonly catalogue: TranslationCatalogueService,
    private readonly providers: Readonly<Record<TranslationSource, TranslationProvider>>,
    private readonly passageCache: PassageCache,
  ) {}

  listTranslations(): Promise<TranslationDescriptor[]> {
    return this.catalogue.getCatalogue();
  }

  async getPassage(input: {
    translationId: string;
    reference: CanonicalReference;
    signal?: AbortSignal;
  }): Promise<TranslationPassage> {
    if (input.signal?.aborted) throw new TranslationError("cancelled", "The passage request was cancelled.");
    const descriptor = (await this.catalogue.getCatalogue()).find((item) => item.id === input.translationId);
    if (!descriptor) throw new TranslationError("unknown_translation", `Unknown translation: ${input.translationId}`);
    if (input.signal?.aborted) throw new TranslationError("cancelled", "The passage request was cancelled.");

    const key = canonicalPassageKey(input.translationId, input.reference, descriptor.revision);
    if (descriptor.source === "embedded") {
      const cached = this.embeddedMemory.get(key);
      if (cached) return cached;
      return this.deduplicated(key, async () => {
        const passage = await this.providers.embedded.getPassage(input);
        this.embeddedMemory.set(key, passage);
        return passage;
      });
    }

    if (descriptor.source === "installed_pack") {
      return this.deduplicated(key, () => this.providers.installed_pack.getPassage(input));
    }

    const cached = await this.passageCache.get(key);
    if (cached) {
      const freshness = getRemoteCacheFreshness(cached);
      if (freshness === "fresh") return { ...cached, cacheState: "device_fresh" };
      if (freshness === "stale") {
        void this.refreshRemotePassage(key, input).catch(() => undefined);
        return { ...cached, cacheState: "device_stale" };
      }
      await this.passageCache.delete(key);
    }

    return this.refreshRemotePassage(key, input);
  }

  isAvailableOffline(translationId: string): Promise<boolean> {
    return this.catalogue.getCatalogue().then((items) => {
      const descriptor = items.find((item) => item.id === translationId);
      return descriptor ? this.providers[descriptor.source].isAvailableOffline(translationId) : false;
    });
  }

  private refreshRemotePassage(
    key: string,
    input: { translationId: string; reference: CanonicalReference; signal?: AbortSignal },
  ): Promise<TranslationPassage> {
    return this.deduplicated(key, async () => {
      const passage = await this.providers.rhelo_api.getPassage(input);
      await this.passageCache.set(key, passage);
      return passage;
    });
  }

  private deduplicated(key: string, operation: () => Promise<TranslationPassage>): Promise<TranslationPassage> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const request = operation().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }
}
