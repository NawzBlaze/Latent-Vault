# Architecture

_Last verified against the code on 2026-09-09. Every module and behaviour named
below exists in the tree at that revision; nothing here describes a service,
file, or mechanism that is not present._

## Routes (all Season 2 only)

| Route | Type | Notes |
|-------|------|-------|
| `/` | static | Hero = latest playable (E6) · continue watching (when progress exists) · Season 2 rail · Bonus rail · footer |
| `/season/[season]` | SSG | Only `/season/2` is generated. Non-canonical forms (`/season/02`) 307-merge here; anything else 404s |
| `/bonus` | static | All three bonus programmes |
| `/search` | static + client | Typo-tolerant search over titles, guests, episode codes; explicit-season queries hard-skip other seasons |
| `/watch/[slug]` | SSG ×9 | Player + metadata + prev/next + related, or the honest unavailable panel |
| `/api/play/[contentId]` | dynamic, `nodejs` runtime | Authorise → 307 to source. GET + HEAD. `no-store` |
| `/api/health` | dynamic, `nodejs` runtime | Published / available / unavailable / seasons counts + source reachability |

No `/season/1`, no per-source pages, no duplicate episode URLs. One canonical
episode entity; multiple internal source references stay invisible.

## Request flow (playback)

```
browser  video.src = /api/play/s2e6
   │
   ▼
/api/play  authorise:  id shape → published? → playable + has source?
   │                  (failures: 400 invalid id, 404 unknown/unpublished,
   │                   404 {"error":"unavailable"} verified-but-no-media)
   ▼
resolvePlayable([primary, ...alternates], callerUa)
   │   index refs first in catalogue order, then yuhu refs
   │   first ref that resolves wins
   ▼
307 Location: <fresh signed source URL>
   headers: Cache-Control: no-store
            X-Resolve-Ms     actual ms this request spent resolving
            X-Resolve-Cache  hit | miss
            X-Resolve-Via    primary | alternate:<n>
            X-Source-Origin  index | yuhu
   ▼
browser follows the 307  →  media bytes stream source CDN → device
                            (native Range / 206 / seek)
```

**The server never proxies video bodies.** Every `/api/play` response is a 307
with `content-length: 0`. Verified by browser network capture: media responses
are attributed to the CDN host and marked `redirected from <our host>`; zero
bodies over 200 KB have ever been served by the application. Signed URLs are
minted per resolution and never written to the catalogue.

## Key modules

- `src/catalog/catalogue.ts` — the typed catalogue (9 items), validation and
  availability. `isPlayable` = a verified media ref exists; `null` media means
  verified identity but no copy. **Publication gate:** unknown, unpublished, or
  unplayable → `/api/play` returns 404. Nothing downstream of the gate can be
  reached for an unpublished id.
- `src/catalog/search.ts` — multi-signal search; explicit season tokens
  (`"season 1"`, `"s1e3"`) hard-skip non-matching seasons.
- `src/catalog/{filter,order,slug,validate,types}.ts` — S2-only filtering,
  numbering order, slug rules, catalogue invariants, shared types.
- `src/source/adapter.ts` — the **index.csbots.live** client. Stable identity is
  `fileName` + `sizeBytes`; the tokenised download link is minted per request
  (`POST /0:search` then `POST /0:fallback`) because the source's `id` tokens
  rotate and are never stable. Exposes `SOURCE_ORIGIN`.
- `src/source/yuhu.ts` — the **yuhu.freeforall.dev / okcdn** client. Resolves
  `videoId` through the okcdn worker, HEAD-verifies the CDN URL, and forwards
  the viewer's exact User-Agent (see `docs/SOURCE.md`). Exposes `YUHU_WORKER_URL`.
- `src/source/resolve.ts` — ordered failover across `[primary, ...alternates]`,
  preserving the primary error as the reported cause.
- `src/player/LatentPlayer.tsx` — custom HTML5 player: HEAD preflight
  (`redirect: manual`), explicit states, one auto-retry on stall, bounded
  timeouts, progress in `localStorage` (`igl_progress_[contentId]`),
  input-aware keyboard shortcuts.
- `src/components/*` — editorial UI; unavailable episodes render the honest
  panel with no player, no `<video>`, and no play affordance anywhere.

## Source URL expiry handling

Both sources issue short-lived signed URLs. Neither is ever persisted.

| | index.csbots.live | yuhu / okcdn |
|---|---|---|
| Signed URL lifetime | short, minted per request | **~127.5 h (5.3 days)**, measured 2026-09-09 from the URL's own `expires` parameter |
| Server cache TTL | 45 s flat | **expiry-derived** (below) |
| Stale-signature behaviour | re-mint per request | worker can serve a dead cached entry; every URL is HEAD-verified and re-resolved **once** on a 400, then it fails honestly |

The Yuhu cache lifetime is computed, not guessed:

```
lifetime = min( 6 h , urlExpires − 24 h )
```

- The 24 h safety margin means a cached URL is never handed out with less than
  a day of life left, so a cached URL cannot expire in a viewer's hands.
- The 6 h cap bounds reuse even if the source ever issues longer-lived URLs.
- If a URL carries no parseable `expires`, or its `expires` is already in the
  past (a claim the CDN just contradicted by answering 200), the cache falls
  back to a conservative 10-minute TTL rather than assuming longevity.
- A URL already inside the safety margin is not cached at all; it is still
  returned to the caller because it was HEAD-verified good on that request.

Entries are evicted on read once past their safe-by time, and the map is capped
at 200 entries with oldest-first eviction. Because signatures bind to the
resolving User-Agent, the cache key is `videoId::quality::<exact UA>` — a URL
minted for one UA is never served to another.

The cache is **in-process** (`Map` in module scope). On Vercel it therefore
survives across invocations only while one Lambda instance stays warm; a cold
instance starts empty. That is the main remaining cause of a slow first
authorisation, and it is inherent to serverless without adding an external
store. See "Known limitations".

## Catalogue model

`src/catalog/catalogue.ts` holds nine items, each built through `item()` so the
invariants are enforced at construction:

- **Identity**: `id` (`s2e1`…), `slug` (`s2-e1`…), season, episode number, kind
  (`episode` | `bonus`).
- **Editorial**: title, description, release date, archived-at, duration,
  thumbnail + hero, guests, panelists, participants, hosts, judges, aliases.
- **Source**: `primary` plus `alternates`, each a stable *reference* — for
  index a file name and byte size; for yuhu a `dataId`, `videoId` and the exact
  expected quality. Never a URL, never a signature.
- **Availability**: `available` or verified-unavailable. E1 and E2 are
  published-but-unavailable: they keep numbering, metadata and search presence
  but expose no player, no watch action, no duration and no quality badge.
- **Publication gate**: `published: true` is required before `/api/play` will
  resolve anything.

Quality, duration and codec labels come only from verified media. No label is
invented for an item that has no verified copy.

## Manual episode workflow

Adding an episode is a manual, operator-driven change — there is no scanner and
no automatic catalogue discovery. The procedure is `docs/ADD_EPISODE.md`:

1. Verify the media exists on the preferred source and probe its real quality.
2. Add the `item({...})` entry to `catalogue.ts` with a stable ref.
3. Confirm numbering against the show's own titles (`docs/SOURCE.md` explains
   the authority order).
4. Add the poster assets to `public/posters/`.
5. Run `npm run typecheck && npm test` — catalogue, filter, ordering and search
   tests all re-assert the S2-only invariants.
6. Verify playback through `/api/play/<id>` and the watch page.

## Vercel deployment

- **Project**: `latent-vault`, Hobby plan, team `nawz`. Framework `nextjs`,
  Node `24.x`, build command `npm run build`, function region `iad1`.
- **Deployed via the Vercel CLI/API, not Git** — the project has no `link`
  record, so deployments come from a local working copy. A Git repository now
  exists locally for history; connecting it to Vercel is an open follow-up.
- **No `vercel.json`.** Security and cache headers are declared in
  `next.config.mjs` (`headers()`): HSTS 2 years + subdomains, `nosniff`,
  strict referrer policy, restrictive permissions policy, and `no-store` on
  `/api/play/:id`.
- Both `/api/play` and `/api/health` declare `runtime = 'nodejs'`. The two
  `opengraph-image.tsx` files declare `runtime = 'edge'` because `next/og`
  needs it; this produces the build warning "Using edge runtime on a page
  currently disables static generation", which is expected and harmless.
- Environment: only `NEXT_PUBLIC_SITE_URL`, `SOURCE_ORIGIN` and
  `YUHU_WORKER_URL` are read by runtime code. See `.env.example`.

## Invariants (enforced by tests)

1. Season 2 only, everywhere — pages, nav, search, sitemap, JSON-LD.
2. Index-first: yuhu is consulted only for episodes where index has no usable
   media (currently E6 only). No duplicate public episodes.
3. No fake metadata: quality/duration/codec labels come from verified media
   only; unavailable episodes show none of these and no watch action.
4. No byte proxy: playback is 307-only with an empty body; the player
   re-resolves through `/api/play` on retry to get a fresh signature.
5. The publication gate cannot be bypassed: unknown, unpublished and
   verified-unavailable ids all 404 from `/api/play`.

## Known limitations (documented, not implemented)

- **`/api/play` has no rate limiting.** There is no rate-limit code and no
  rate-limit test anywhere in the tree; a burst of 20 forced-cold requests
  against production returned 20 × 307 with zero 429s. Meaningful limiting on
  serverless needs a shared store across instances, which would add an external
  dependency. Left as an explicit follow-up rather than solved with a
  per-instance counter that would be both ineffective and a risk to legitimate
  viewers.
- **Cold-instance cost.** The first authorisation after a Lambda goes cold pays
  the full source round-trip (measured ~1.5–4.8 s, dominated by the okcdn
  worker). A warm-up schedule would remove it but was out of scope for this pass.
