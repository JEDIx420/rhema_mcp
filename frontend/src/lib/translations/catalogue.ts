import type { TranslationDescriptor } from "@/lib/translations/domain";
import { validateTranslationDescriptor } from "@/lib/translations/domain";

export const EMBEDDED_TRANSLATIONS = [
  {
    id: "en_bsb",
    slug: "berean-standard-bible",
    abbreviation: "BSB",
    displayName: "Berean Standard Bible",
    languageCode: "en",
    languageName: "English",
    textDirection: "ltr",
    source: "embedded",
    availability: "available_offline",
    accessState: "public",
    version: "2023",
    revision: "desktop-seed-1",
    downloadable: false,
    offlineCapable: true,
    requiresAccount: false,
    requiresEntitlement: false,
    copyright: "Public domain",
    attribution: "Berean Standard Bible",
    sortOrder: 10,
  },
  {
    id: "en_web",
    slug: "world-english-bible",
    abbreviation: "WEB",
    displayName: "World English Bible",
    languageCode: "en",
    languageName: "English",
    textDirection: "ltr",
    source: "embedded",
    availability: "available_offline",
    accessState: "public",
    revision: "desktop-seed-1",
    downloadable: false,
    offlineCapable: true,
    requiresAccount: false,
    requiresEntitlement: false,
    copyright: "Public domain; World English Bible is an eBible.org trademark",
    attribution: "World English Bible",
    sortOrder: 20,
  },
  {
    id: "en_kjv",
    slug: "king-james-version",
    abbreviation: "KJV",
    displayName: "King James Version",
    languageCode: "en",
    languageName: "English",
    textDirection: "ltr",
    source: "embedded",
    availability: "available_offline",
    accessState: "public",
    version: "1769",
    revision: "desktop-seed-1",
    downloadable: false,
    offlineCapable: true,
    requiresAccount: false,
    requiresEntitlement: false,
    copyright: "Public domain",
    attribution: "King James Version",
    sortOrder: 30,
  },
] as const satisfies readonly TranslationDescriptor[];

export type EmbeddedTranslationId = (typeof EMBEDDED_TRANSLATIONS)[number]["id"];

const EMBEDDED_PROVIDER_IDS: Readonly<Record<EmbeddedTranslationId, string>> = {
  en_bsb: "en_bsb",
  en_web: "en_web",
  en_kjv: "en_kjv",
};

export function isEmbeddedTranslationId(id: string): id is EmbeddedTranslationId {
  return Object.hasOwn(EMBEDDED_PROVIDER_IDS, id);
}

export function getEmbeddedProviderId(id: string): string | null {
  return isEmbeddedTranslationId(id) ? EMBEDDED_PROVIDER_IDS[id] : null;
}

interface CatalogueLayers {
  embedded?: readonly TranslationDescriptor[];
  installed?: readonly TranslationDescriptor[];
  cachedRemote?: readonly TranslationDescriptor[];
  latestRemote?: readonly TranslationDescriptor[];
}

export function mergeTranslationCatalogues(layers: CatalogueLayers): TranslationDescriptor[] {
  const embedded = layers.embedded ?? EMBEDDED_TRANSLATIONS;
  const orderedLayers = [embedded, layers.installed ?? [], layers.cachedRemote ?? [], layers.latestRemote ?? []];
  const merged = new Map<string, TranslationDescriptor>();
  const localFacts = new Map<string, Pick<TranslationDescriptor, "source" | "availability" | "offlineCapable">>();

  for (const descriptor of embedded) {
    localFacts.set(descriptor.id, {
      source: "embedded",
      availability: "available_offline",
      offlineCapable: true,
    });
  }
  for (const descriptor of layers.installed ?? []) {
    localFacts.set(descriptor.id, {
      source: "installed_pack",
      availability: "downloaded",
      offlineCapable: true,
    });
  }

  for (const layer of orderedLayers) {
    for (const rawDescriptor of layer) {
      const descriptor = validateTranslationDescriptor({ ...rawDescriptor });
      const previous = merged.get(descriptor.id);
      merged.set(descriptor.id, previous ? { ...previous, ...descriptor } : descriptor);
    }
  }

  for (const [id, facts] of localFacts) {
    const descriptor = merged.get(id);
    if (descriptor) merged.set(id, { ...descriptor, ...facts });
  }

  for (const [id, descriptor] of merged) {
    if (localFacts.has(id)) continue;
    if (descriptor.source === "installed_pack") {
      merged.set(id, { ...descriptor, availability: "unavailable" });
    } else if (descriptor.source === "rhelo_api") {
      merged.set(id, {
        ...descriptor,
        availability: descriptor.availability === "unavailable" ? "unavailable" : "online",
      });
    }
  }

  return [...merged.values()].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id),
  );
}

export interface TranslationCatalogueSources {
  listInstalled?: () => Promise<TranslationDescriptor[]>;
  readCachedRemote?: () => Promise<TranslationDescriptor[]>;
  fetchLatestRemote?: () => Promise<TranslationDescriptor[]>;
  writeCachedRemote?: (catalogue: TranslationDescriptor[]) => Promise<void>;
}

export class TranslationCatalogueService {
  private cataloguePromise: Promise<TranslationDescriptor[]> | null = null;

  constructor(private readonly sources: TranslationCatalogueSources = {}) {}

  getCatalogue(): Promise<TranslationDescriptor[]> {
    if (!this.cataloguePromise) {
      this.cataloguePromise = Promise.all([
        this.sources.listInstalled?.().catch(() => []) ?? Promise.resolve([]),
        this.sources.readCachedRemote?.().catch(() => []) ?? Promise.resolve([]),
      ]).then(([installed, cachedRemote]) => mergeTranslationCatalogues({ installed, cachedRemote }));
    }
    return this.cataloguePromise;
  }

  async refreshRemoteCatalogue(): Promise<TranslationDescriptor[]> {
    const [current, latestRemote] = await Promise.all([
      this.getCatalogue(),
      this.sources.fetchLatestRemote?.() ?? Promise.resolve([]),
    ]);
    if (latestRemote.length > 0) await this.sources.writeCachedRemote?.(latestRemote);
    const refreshed = mergeTranslationCatalogues({
      installed: current.filter((item) => item.source === "installed_pack"),
      cachedRemote: current.filter((item) => item.source === "rhelo_api"),
      latestRemote,
    });
    this.cataloguePromise = Promise.resolve(refreshed);
    return refreshed;
  }

  invalidateLocalSnapshot(): void {
    this.cataloguePromise = null;
  }
}
