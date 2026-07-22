# Rhelo Translation Contract

Status: desktop implementation contract, version 1.

This document is platform-neutral. Desktop and tablet applications may use different UI and persistence implementations, but should preserve these identifiers and semantics.

## Stable identifiers

Rhelo translation IDs are lowercase, underscore-delimited identifiers owned by Rhelo. Display names, list positions, SQLite codes, pack IDs, and upstream provider IDs are not public identifiers.

Current embedded IDs:

| Rhelo ID | Abbreviation | Display name |
|---|---|---|
| `en_bsb` | BSB | Berean Standard Bible |
| `en_web` | WEB | World English Bible |
| `en_kjv` | KJV | King James Version |

Provider adapters maintain any provider-specific mapping. The current desktop SQLite codes happen to match the Rhelo IDs, but consumers must not rely on that coincidence.

## Descriptor contract

Every catalogue entry contains:

```ts
interface TranslationDescriptor {
  id: string;
  slug: string;
  abbreviation: string;
  displayName: string;
  languageCode: string;
  languageName: string;
  textDirection: "ltr" | "rtl";
  source: "embedded" | "installed_pack" | "rhelo_api";
  availability: "available_offline" | "downloaded" | "cached_remote" | "online" | "unavailable";
  accessState: "public" | "account_required" | "entitlement_required" | "subscription_required" | "license_expired";
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
```

Remote metadata may improve names, rights, revision, and access metadata. It must never override locally determined installation or offline availability facts.

## Canonical references

References use Rhelo's existing 66 three-character OSIS-style book IDs, a one-based chapter, and optional one-based verse bounds:

```ts
interface CanonicalReference {
  bookId: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}
```

Examples are `GEN 1`, `JHN 3:16`, and `ROM 8:1-4`. Provider-specific book IDs are converted only inside provider adapters.

## Passage contract

```ts
interface TranslationPassage {
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
  cacheState?: "embedded" | "downloaded" | "device_fresh" | "device_stale" | "live_remote";
}
```

Providers must normalize raw content into this shape. Missing or combined verse segmentation must remain truthful; clients must not fabricate Scripture text to force visual alignment.

## Error codes

Column-scoped translation errors use these stable codes:

- `invalid_reference`
- `unknown_translation`
- `missing_passage`
- `unavailable_offline`
- `remote_disabled`
- `login_required`
- `entitlement_required`
- `subscription_required`
- `license_expired`
- `pack_conflict`
- `remote_quota_exhausted`
- `rate_limited`
- `temporary_error`
- `invalid_response`
- `cancelled`

One provider failure must never invalidate another column or mutate the shared reference.

## Cache semantics

- `embedded`: bundled with the application; no time expiry.
- `downloaded`: installed pack; lifecycle follows the pack revision.
- `device_fresh`: remote content fetched less than 14 days ago or before `refreshAfter`.
- `device_stale`: remote content 14-30 days old; display is allowed while a selected-column refresh is attempted.
- `live_remote`: freshly returned by the Rhelo API.
- Remote content at least 30 days old, or after `mustRefreshBy`, is not valid without a successful refresh.

The cache key is translation ID + canonical book ID + chapter + source revision + content-format version.

## Cross-platform fixtures

Desktop fixtures in `frontend/src/lib/translations/fixtures.ts` define three embedded translations, one online translation, one downloadable pack, account and entitlement states, an RTL translation, and a quota-exhausted translation. Tablet tests should reproduce the same descriptor and synthetic-passage shapes without copying platform UI code or copyrighted Bible text.
