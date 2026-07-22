import { validateTranslationDescriptor, type TranslationDescriptor } from "@/lib/translations/domain";

interface CachedCatalogueDocument {
  revision?: string;
  etag?: string;
  fetchedAt: string;
  translations: TranslationDescriptor[];
}

const CATALOGUE_STORAGE_KEY = "rhelo-translation-catalogue:v1";

export class BrowserTranslationCatalogueStore {
  async read(): Promise<TranslationDescriptor[]> {
    if (typeof window === "undefined") return [];
    const value = window.localStorage.getItem(CATALOGUE_STORAGE_KEY);
    if (!value) return [];
    try {
      const document = JSON.parse(value) as CachedCatalogueDocument;
      return Array.isArray(document.translations)
        ? document.translations.map((descriptor) => validateTranslationDescriptor(descriptor))
        : [];
    } catch {
      window.localStorage.removeItem(CATALOGUE_STORAGE_KEY);
      return [];
    }
  }

  async write(translations: TranslationDescriptor[], revision?: string, etag?: string): Promise<void> {
    if (typeof window === "undefined") return;
    const document: CachedCatalogueDocument = {
      revision,
      etag,
      fetchedAt: new Date().toISOString(),
      translations,
    };
    window.localStorage.setItem(CATALOGUE_STORAGE_KEY, JSON.stringify(document));
  }
}
