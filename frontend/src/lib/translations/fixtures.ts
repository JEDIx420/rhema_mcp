import type { TranslationDescriptor, TranslationPassage } from "@/lib/translations/domain";

const base = {
  version: "fixture-1",
  revision: "fixture-1",
  downloadable: false,
  offlineCapable: false,
  requiresAccount: false,
  requiresEntitlement: false,
  sortOrder: 100,
} as const;

export const TRANSLATION_DESCRIPTOR_FIXTURES: readonly TranslationDescriptor[] = [
  { ...base, id: "fixture_embedded_one", slug: "fixture-embedded-one", abbreviation: "E1", displayName: "Embedded One", languageCode: "en", languageName: "English", textDirection: "ltr", source: "embedded", availability: "available_offline", accessState: "public", offlineCapable: true, sortOrder: 10 },
  { ...base, id: "fixture_embedded_two", slug: "fixture-embedded-two", abbreviation: "E2", displayName: "Embedded Two", languageCode: "en", languageName: "English", textDirection: "ltr", source: "embedded", availability: "available_offline", accessState: "public", offlineCapable: true, sortOrder: 20 },
  { ...base, id: "fixture_embedded_three", slug: "fixture-embedded-three", abbreviation: "E3", displayName: "Embedded Three", languageCode: "en", languageName: "English", textDirection: "ltr", source: "embedded", availability: "available_offline", accessState: "public", offlineCapable: true, sortOrder: 30 },
  { ...base, id: "fixture_online", slug: "fixture-online", abbreviation: "ON", displayName: "Online Fixture", languageCode: "en", languageName: "English", textDirection: "ltr", source: "rhelo_api", availability: "online", accessState: "public", sortOrder: 40 },
  { ...base, id: "fixture_pack", slug: "fixture-pack", abbreviation: "PK", displayName: "Downloadable Pack", languageCode: "es", languageName: "Spanish", textDirection: "ltr", source: "installed_pack", availability: "unavailable", accessState: "public", downloadable: true, offlineCapable: true, sortOrder: 50 },
  { ...base, id: "fixture_account", slug: "fixture-account", abbreviation: "AC", displayName: "Account Fixture", languageCode: "en", languageName: "English", textDirection: "ltr", source: "rhelo_api", availability: "online", accessState: "account_required", requiresAccount: true, sortOrder: 60 },
  { ...base, id: "fixture_entitlement", slug: "fixture-entitlement", abbreviation: "EN", displayName: "Entitlement Fixture", languageCode: "en", languageName: "English", textDirection: "ltr", source: "rhelo_api", availability: "online", accessState: "entitlement_required", requiresAccount: true, requiresEntitlement: true, sortOrder: 70 },
  { ...base, id: "fixture_rtl", slug: "fixture-rtl", abbreviation: "RTL", displayName: "RTL Fixture", languageCode: "ar", languageName: "Arabic", textDirection: "rtl", source: "rhelo_api", availability: "online", accessState: "public", sortOrder: 80 },
  { ...base, id: "fixture_quota", slug: "fixture-quota", abbreviation: "QT", displayName: "Quota Fixture", languageCode: "en", languageName: "English", textDirection: "ltr", source: "rhelo_api", availability: "online", accessState: "public", sortOrder: 90 },
];

export function syntheticPassage(translationId: string): TranslationPassage {
  return {
    translationId,
    reference: { bookId: "JHN", chapter: 3 },
    verses: [
      { verse: 1, text: `${translationId} synthetic verse one.` },
      { verse: 2, text: `${translationId} synthetic verse two.` },
    ],
    fetchedAt: "2026-01-01T00:00:00.000Z",
    cacheState: "live_remote",
  };
}
