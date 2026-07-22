import { fetchEmbeddedTranslationPassage, type EmbeddedPassageResponse } from "@/lib/api";
import { EMBEDDED_TRANSLATIONS, getEmbeddedProviderId } from "@/lib/translations/catalogue";
import {
  assertCanonicalReference,
  TranslationError,
  type CanonicalReference,
  type TranslationDescriptor,
  type TranslationPassage,
} from "@/lib/translations/domain";

export interface TranslationProvider {
  listTranslations(): Promise<TranslationDescriptor[]>;
  getPassage(input: {
    translationId: string;
    reference: CanonicalReference;
    signal?: AbortSignal;
  }): Promise<TranslationPassage>;
  isAvailableOffline(translationId: string): Promise<boolean>;
  prefetchPassage?(input: {
    translationId: string;
    reference: CanonicalReference;
    signal?: AbortSignal;
  }): Promise<void>;
}

export interface EmbeddedPassageClient {
  fetchPassage(localTranslationId: string, reference: CanonicalReference): Promise<EmbeddedPassageResponse>;
}

const defaultEmbeddedClient: EmbeddedPassageClient = {
  fetchPassage(localTranslationId, reference) {
    return fetchEmbeddedTranslationPassage(localTranslationId, reference.bookId, reference.chapter);
  },
};

export class EmbeddedTranslationProvider implements TranslationProvider {
  constructor(private readonly client: EmbeddedPassageClient = defaultEmbeddedClient) {}

  async listTranslations(): Promise<TranslationDescriptor[]> {
    return EMBEDDED_TRANSLATIONS.map((descriptor) => ({ ...descriptor }));
  }

  async isAvailableOffline(translationId: string): Promise<boolean> {
    return getEmbeddedProviderId(translationId) !== null;
  }

  async getPassage(input: {
    translationId: string;
    reference: CanonicalReference;
    signal?: AbortSignal;
  }): Promise<TranslationPassage> {
    assertCanonicalReference(input.reference);
    const localTranslationId = getEmbeddedProviderId(input.translationId);
    if (!localTranslationId) {
      throw new TranslationError("unknown_translation", `Unknown embedded translation: ${input.translationId}`);
    }
    if (input.signal?.aborted) throw new TranslationError("cancelled", "The passage request was cancelled.");

    const response = await this.client.fetchPassage(localTranslationId, input.reference);
    if (input.signal?.aborted) throw new TranslationError("cancelled", "The passage request was cancelled.");
    if (response.translation_code !== localTranslationId) {
      throw new TranslationError("invalid_response", "The embedded provider returned a mismatched translation.");
    }
    if (response.verses.length === 0) {
      throw new TranslationError("missing_passage", "This chapter is unavailable in the embedded translation.");
    }

    const descriptor = EMBEDDED_TRANSLATIONS.find((item) => item.id === input.translationId);
    return {
      translationId: input.translationId,
      reference: input.reference,
      verses: response.verses.map((verse) => ({ verse: verse.verse, text: verse.text })),
      sourceRevision: descriptor?.revision,
      attribution: descriptor?.attribution,
      copyright: descriptor?.copyright,
      cacheState: "embedded",
    };
  }
}

export class UnavailableInstalledPackProvider implements TranslationProvider {
  async listTranslations(): Promise<TranslationDescriptor[]> {
    return [];
  }

  async isAvailableOffline(): Promise<boolean> {
    return false;
  }

  async getPassage(): Promise<TranslationPassage> {
    throw new TranslationError("unavailable_offline", "This translation pack is not installed on this device.");
  }
}
