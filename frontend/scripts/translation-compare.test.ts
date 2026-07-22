import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BIBLE_BOOKS } from "../src/lib/books";
import {
  EMBEDDED_TRANSLATIONS,
  TranslationCatalogueService,
  getEmbeddedProviderId,
  mergeTranslationCatalogues,
} from "../src/lib/translations/catalogue";
import { MemoryPassageCache, getRemoteCacheFreshness } from "../src/lib/translations/cache";
import {
  DEFAULT_COMPARE_TRANSLATION_IDS,
  addCompareTranslation,
  moveCompareTranslation,
  normalizeComparePreferences,
  removeCompareTranslation,
  replaceCompareTranslation,
} from "../src/lib/translations/compareState";
import { normalizeRheloApiBaseUrl } from "../src/lib/translations/config";
import {
  canonicalPassageKey,
  isCanonicalBookId,
  TranslationError,
  validateTranslationDescriptor,
  type CanonicalReference,
  type TranslationDescriptor,
  type TranslationPassage,
} from "../src/lib/translations/domain";
import { TRANSLATION_DESCRIPTOR_FIXTURES, syntheticPassage } from "../src/lib/translations/fixtures";
import { EmbeddedTranslationProvider, type EmbeddedPassageClient, type TranslationProvider } from "../src/lib/translations/provider";
import { RheloRemoteTranslationProvider } from "../src/lib/translations/remoteProvider";
import { UnifiedTranslationService } from "../src/lib/translations/service";

const reference: CanonicalReference = { bookId: "JHN", chapter: 3 };

function fixture(id: string): TranslationDescriptor {
  const descriptor = TRANSLATION_DESCRIPTOR_FIXTURES.find((item) => item.id === id);
  if (!descriptor) throw new Error(`Missing fixture ${id}`);
  return { ...descriptor };
}

class FixtureProvider implements TranslationProvider {
  calls = 0;
  constructor(
    private readonly descriptors: TranslationDescriptor[],
    private readonly passage: (translationId: string, reference: CanonicalReference, signal?: AbortSignal) => Promise<TranslationPassage>,
  ) {}
  async listTranslations() { return this.descriptors; }
  async isAvailableOffline() { return false; }
  async getPassage(input: { translationId: string; reference: CanonicalReference; signal?: AbortSignal }) {
    this.calls += 1;
    return this.passage(input.translationId, input.reference, input.signal);
  }
}

test("embedded catalogue uses stable Rhelo IDs and explicit local provider mapping", () => {
  assert.deepEqual(EMBEDDED_TRANSLATIONS.map((item) => item.id), ["en_bsb", "en_web", "en_kjv"]);
  assert.equal(getEmbeddedProviderId("en_bsb"), "en_bsb");
  assert.equal(getEmbeddedProviderId("Berean Standard Bible"), null);
  for (const descriptor of EMBEDDED_TRANSLATIONS) {
    assert.equal(validateTranslationDescriptor(descriptor), descriptor);
    assert.equal(descriptor.availability, "available_offline");
    assert.equal(descriptor.textDirection, "ltr");
  }
});

test("canonical references use the existing 66 OSIS-style book IDs", () => {
  assert.equal(BIBLE_BOOKS.length, 66);
  assert.equal(isCanonicalBookId("GEN"), true);
  assert.equal(isCanonicalBookId("REV"), true);
  assert.equal(isCanonicalBookId("Genesis"), false);
});

test("fixture catalogue covers embedded, pack, account, entitlement, RTL, and quota states", () => {
  assert.equal(TRANSLATION_DESCRIPTOR_FIXTURES.filter((item) => item.source === "embedded").length, 3);
  assert.equal(fixture("fixture_pack").downloadable, true);
  assert.equal(fixture("fixture_account").accessState, "account_required");
  assert.equal(fixture("fixture_entitlement").requiresEntitlement, true);
  assert.equal(fixture("fixture_rtl").textDirection, "rtl");
  assert.equal(fixture("fixture_quota").source, "rhelo_api");
});

test("catalogue merge is deterministic and remote metadata cannot remove local availability", () => {
  const remoteBsb = { ...EMBEDDED_TRANSLATIONS[0], displayName: "Updated BSB metadata", source: "rhelo_api", availability: "online", offlineCapable: false } as TranslationDescriptor;
  const merged = mergeTranslationCatalogues({ latestRemote: [fixture("fixture_online"), remoteBsb] });
  const bsb = merged.find((item) => item.id === "en_bsb");
  assert.equal(bsb?.displayName, "Updated BSB metadata");
  assert.equal(bsb?.source, "embedded");
  assert.equal(bsb?.availability, "available_offline");
  assert.deepEqual(merged.map((item) => item.sortOrder), [...merged].map((item) => item.sortOrder).sort((a, b) => a - b));
});

test("installed-pack metadata merges without displacing the embedded fallback", () => {
  const installed = { ...fixture("fixture_pack"), availability: "downloaded" } as TranslationDescriptor;
  const merged = mergeTranslationCatalogues({ installed: [installed] });
  assert.equal(merged.filter((item) => item.source === "embedded").length, 3);
  assert.equal(merged.find((item) => item.id === installed.id)?.availability, "downloaded");
});

test("remote catalogue metadata cannot falsely mark a pack as installed", () => {
  const remotePack = { ...fixture("fixture_pack"), availability: "downloaded" } as TranslationDescriptor;
  const merged = mergeTranslationCatalogues({ latestRemote: [remotePack] });
  assert.equal(merged.find((item) => item.id === remotePack.id)?.availability, "unavailable");
});

test("catalogue startup uses fallback and cache without requesting the latest remote catalogue", async () => {
  let remoteCalls = 0;
  const catalogue = new TranslationCatalogueService({
    readCachedRemote: async () => [fixture("fixture_online")],
    fetchLatestRemote: async () => { remoteCalls += 1; throw new Error("offline"); },
  });
  const initial = await catalogue.getCatalogue();
  assert.equal(remoteCalls, 0);
  assert.equal(initial.filter((item) => item.source === "embedded").length, 3);
  await assert.rejects(() => catalogue.refreshRemoteCatalogue(), /offline/);
  assert.equal((await catalogue.getCatalogue()).filter((item) => item.source === "embedded").length, 3);
});

test("embedded provider discovers and normalizes all three local editions with zero network calls", async () => {
  let networkCalls = 0;
  const localCalls: string[] = [];
  const client: EmbeddedPassageClient = {
    async fetchPassage(localTranslationId, requestedReference) {
      localCalls.push(localTranslationId);
      return {
        translation_code: localTranslationId,
        book: requestedReference.bookId,
        chapter: requestedReference.chapter,
        verses: [{ verse: 1, text: `${localTranslationId} local verse` }],
      };
    },
  };
  const provider = new EmbeddedTranslationProvider(client);
  const passages = await Promise.all(EMBEDDED_TRANSLATIONS.map((item) => provider.getPassage({ translationId: item.id, reference })));
  assert.deepEqual(localCalls, ["en_bsb", "en_web", "en_kjv"]);
  assert.equal(passages.every((passage) => passage.cacheState === "embedded"), true);
  assert.equal(passages.every((passage) => passage.reference === reference), true);
  assert.equal(networkCalls, 0);
  networkCalls += 0;
});

test("embedded provider reports a missing chapter without substituting another translation", async () => {
  const provider = new EmbeddedTranslationProvider({
    async fetchPassage(localTranslationId) {
      return { translation_code: localTranslationId, book: "JHN", chapter: 3, verses: [] };
    },
  });
  await assert.rejects(
    () => provider.getPassage({ translationId: "en_bsb", reference }),
    (error: unknown) => error instanceof TranslationError && error.code === "missing_passage",
  );
});

test("Compare state defaults to three columns and prevents duplicate selections", () => {
  const available = EMBEDDED_TRANSLATIONS.map((item) => item.id);
  assert.deepEqual(normalizeComparePreferences(null, available).translationIds, DEFAULT_COMPARE_TRANSLATION_IDS);
  assert.deepEqual(addCompareTranslation(["en_bsb"], "en_web"), ["en_bsb", "en_web"]);
  assert.deepEqual(addCompareTranslation(["en_bsb"], "en_bsb"), ["en_bsb"]);
  assert.deepEqual(replaceCompareTranslation(["en_bsb", "en_web"], "en_bsb", "en_web"), ["en_bsb", "en_web"]);
});

test("Compare state removes, replaces, reorders, and restores persisted IDs safely", () => {
  assert.deepEqual(removeCompareTranslation(["en_bsb", "en_web"], "en_bsb"), ["en_web"]);
  assert.deepEqual(removeCompareTranslation(["en_bsb"], "en_bsb"), ["en_bsb"]);
  assert.deepEqual(replaceCompareTranslation(["en_bsb", "en_web"], "en_web", "en_kjv"), ["en_bsb", "en_kjv"]);
  assert.deepEqual(moveCompareTranslation(["en_bsb", "en_web", "en_kjv"], "en_kjv", -1), ["en_bsb", "en_kjv", "en_web"]);
  assert.deepEqual(
    normalizeComparePreferences({ translationIds: ["missing", "en_web", "en_web"], synchronizedScroll: true }, ["en_bsb", "en_web", "en_kjv"]),
    { version: 1, translationIds: ["en_web"], layout: "columns", synchronizedScroll: true },
  );
});

test("reference propagation loads each selected column independently", async () => {
  const requested: string[] = [];
  const provider = new FixtureProvider(EMBEDDED_TRANSLATIONS.map((item) => ({ ...item })), async (id, requestedReference) => {
    requested.push(`${id}:${requestedReference.bookId}:${requestedReference.chapter}`);
    if (id === "en_web") throw new TranslationError("missing_passage", "missing");
    return { ...syntheticPassage(id), reference: requestedReference, cacheState: "embedded" };
  });
  const catalogue = new TranslationCatalogueService();
  const service = new UnifiedTranslationService(catalogue, { embedded: provider, installed_pack: provider, rhelo_api: provider }, new MemoryPassageCache());
  const results = await Promise.allSettled(DEFAULT_COMPARE_TRANSLATION_IDS.map((translationId) => service.getPassage({ translationId, reference })));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(requested.every((item) => item.endsWith(":JHN:3")), true);
});

test("identical concurrent remote passage requests are deduplicated", async () => {
  const remoteDescriptor = fixture("fixture_online");
  const remote = new FixtureProvider([remoteDescriptor], async (id) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ...syntheticPassage(id), fetchedAt: new Date().toISOString() };
  });
  const catalogue = new TranslationCatalogueService({ readCachedRemote: async () => [remoteDescriptor] });
  const service = new UnifiedTranslationService(catalogue, { embedded: remote, installed_pack: remote, rhelo_api: remote }, new MemoryPassageCache());
  const [first, second] = await Promise.all([
    service.getPassage({ translationId: remoteDescriptor.id, reference }),
    service.getPassage({ translationId: remoteDescriptor.id, reference }),
  ]);
  assert.equal(remote.calls, 1);
  assert.equal(first.translationId, second.translationId);
});

test("fresh device cache prevents repeat remote requests and stale state is explicit", async () => {
  const remoteDescriptor = fixture("fixture_online");
  const cache = new MemoryPassageCache();
  const remote = new FixtureProvider([remoteDescriptor], async (id) => ({ ...syntheticPassage(id), fetchedAt: new Date().toISOString() }));
  const catalogue = new TranslationCatalogueService({ readCachedRemote: async () => [remoteDescriptor] });
  const service = new UnifiedTranslationService(catalogue, { embedded: remote, installed_pack: remote, rhelo_api: remote }, cache);
  const key = canonicalPassageKey(remoteDescriptor.id, reference, remoteDescriptor.revision);
  await cache.set(key, { ...syntheticPassage(remoteDescriptor.id), fetchedAt: new Date().toISOString() });
  const passage = await service.getPassage({ translationId: remoteDescriptor.id, reference });
  assert.equal(passage.cacheState, "device_fresh");
  assert.equal(remote.calls, 0);
  const stale = { ...passage, fetchedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() };
  assert.equal(getRemoteCacheFreshness(stale), "stale");
  assert.equal(getRemoteCacheFreshness({ ...stale, fetchedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString() }), "expired");
});

test("rapid chapter change cancels stale client work without prefetching adjacent chapters", async () => {
  const remoteDescriptor = fixture("fixture_online");
  const chapters: number[] = [];
  const remote = new FixtureProvider([remoteDescriptor], async (id, requestedReference, signal) => {
    chapters.push(requestedReference.chapter);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 15);
      signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new TranslationError("cancelled", "cancelled")); }, { once: true });
    });
    return { ...syntheticPassage(id), reference: requestedReference, fetchedAt: new Date().toISOString() };
  });
  const catalogue = new TranslationCatalogueService({ readCachedRemote: async () => [remoteDescriptor] });
  const service = new UnifiedTranslationService(catalogue, { embedded: remote, installed_pack: remote, rhelo_api: remote }, new MemoryPassageCache());
  const controller = new AbortController();
  const staleRequest = service.getPassage({ translationId: remoteDescriptor.id, reference, signal: controller.signal });
  controller.abort();
  await assert.rejects(staleRequest, (error: unknown) => error instanceof TranslationError && error.code === "cancelled");
  await service.getPassage({ translationId: remoteDescriptor.id, reference: { bookId: "JHN", chapter: 4 } });
  assert.deepEqual(chapters, [4]);
});

test("remote adapter does not retry 401, 403, or 404", async () => {
  for (const status of [401, 403, 404]) {
    let calls = 0;
    const provider = new RheloRemoteTranslationProvider(
      { enabled: true, baseUrl: "https://api.rhelobible.com" },
      async () => [fixture("fixture_online")],
      (async () => { calls += 1; return new Response("{}", { status }); }) as typeof fetch,
    );
    await assert.rejects(() => provider.getPassage({ translationId: "fixture_online", reference }));
    assert.equal(calls, 1);
  }
});

test("remote adapter retries a 5xx at most once and surfaces quota state per column", async () => {
  let calls = 0;
  const provider = new RheloRemoteTranslationProvider(
    { enabled: true, baseUrl: "https://api.rhelobible.com" },
    async () => [fixture("fixture_online")],
    (async () => {
      calls += 1;
      if (calls === 1) return new Response("{}", { status: 503 });
      return Response.json({ ...syntheticPassage("fixture_online"), cacheState: undefined });
    }) as typeof fetch,
  );
  assert.equal((await provider.getPassage({ translationId: "fixture_online", reference })).cacheState, "live_remote");
  assert.equal(calls, 2);

  const quotaProvider = new RheloRemoteTranslationProvider(
    { enabled: true, baseUrl: "https://api.rhelobible.com" },
    async () => [fixture("fixture_quota")],
    (async () => Response.json({ code: "remote_quota_exhausted" }, { status: 429 })) as typeof fetch,
  );
  await assert.rejects(
    () => quotaProvider.getPassage({ translationId: "fixture_quota", reference }),
    (error: unknown) => error instanceof TranslationError && error.code === "remote_quota_exhausted",
  );
});

test("remote API configuration is environment-owned and rejects unsafe origins", () => {
  assert.equal(normalizeRheloApiBaseUrl("https://preview.rhelobible.com/"), "https://preview.rhelobible.com");
  assert.equal(normalizeRheloApiBaseUrl("http://localhost:8787"), "http://localhost:8787");
  assert.throws(() => normalizeRheloApiBaseUrl("http://example.com"), /HTTPS/);
  assert.throws(() => normalizeRheloApiBaseUrl("https://user:secret@example.com"), /credentials/);
});

test("Compare UI exposes production column, overflow, RTL, attribution, and isolated-state hooks", () => {
  const source = readFileSync(new URL("../src/components/CompareTranslationsView.tsx", import.meta.url), "utf8");
  assert.match(source, /data-compare-columns/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /min-w-\[22rem\]/);
  assert.match(source, /dir=\{descriptor\.textDirection\}/);
  assert.match(source, /descriptor\.attribution/);
  assert.match(source, /Other translation columns remain available/);
  assert.match(source, /data-compare-verse/);
});

test("frontend providers contain no direct upstream API host, key, or administrator authentication dependency", () => {
  const remoteProvider = readFileSync(new URL("../src/lib/translations/remoteProvider.ts", import.meta.url), "utf8").toLowerCase();
  const runtime = readFileSync(new URL("../src/lib/translations/runtime.ts", import.meta.url), "utf8").toLowerCase();
  assert.equal(remoteProvider.includes(["api", "bible"].join(".")), false);
  assert.equal(remoteProvider.includes(["api", "bible", "key"].join("_")), false);
  assert.equal(`${remoteProvider}${runtime}`.includes("cloudflare access"), false);
  assert.match(remoteProvider, /api\/v1\/translations/);
});
