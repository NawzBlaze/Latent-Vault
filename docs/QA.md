# QA gates (release candidate, 2026-09-09)

All gates passed on the shipping build. Prod must work with the operator's PC
off — deploy only after every gate below is green.

## 1. Unit + integration — 124/124

`npx vitest run` (re-run 2026-09-09 after the expiry-aware cache change) —
catalogue validation (6 episodes + 3 bonus, contiguous numbering both chains),
S2 filter, search (incl. explicit-season hard skip and `EP6`/`S2 EP6` query
forms), index/yuhu resolvers, UA forwarding (exact-UA worker+verify, UA-keyed
cache, fallback), `/api/play` (307/404/400/HEAD/UA passthrough), the
expiry-derived cache (`readUrlExpiryMs`, `cacheLifetimeMs`, hit / expiry /
refresh / never-cache-near-expiry), `X-Resolve-Cache` truthfulness for **both**
sources, zero-byte 307 bodies, and the publication gate.

## 2. E2E — 85 passed, 3 skipped (by design)

_Re-run 2026-09-09 against the expiry-aware cache build: same result._

`npx playwright test` (desktop-chromium + mobile-390 + mobile-375, prod build
on :3100):

- home: hero = E6, S2/Bonus rails, S1 absent everywhere, footer honesty
- playback-redirect: real 307s (index + yuhu), Range/206, no-store
- watch: E1 unavailable (no player/video/play affordance), E6 real media +
  duration + play, keyboard, resume, prev/next
- search: S2E6 + Alia hits, "Season 1" zero-result, hints S2-only
- seo: S2-only sitemap, `/season/1` 404, no `/api/play` in E1 JSON-LD,
  health = published 9 / seasons [2] / available 7 / unavailable 2

## 3. Media QA — 4/4 episodes, all controls

Measured end-to-end (click → metadata → first frame; seeks; pause/play;
mute; 1.25×; fullscreen; 6 s rebuffer window):

| Episode | Auth* | Metadata | First frame | Seeks | Rebuffers |
|---------|-------|----------|-------------|-------|-----------|
| E5 (index MKV) | 1793 ms | 2859 ms | 1137 ms | ≤21 ms | 1 (post-seek) |
| B1 (index AV1, 57 min) | 1655 ms | 1740 ms | 424 ms | ≤23 ms | 1 (post-seek) |
| E6 (yuhu) | 796 ms | 2552 ms | 387 ms | ≤26 ms | 1 (post-seek) |
| B2 (index AVC) | 2409 ms | 1710 ms | 372 ms | ≤29 ms | 1 (post-seek) |

All 1920×1080, durations match catalogue. \*Auth = cold HEAD following the
307 to the CDN. Each "rebuffer" is the single post-seek buffering blip at the
window start — zero mid-playback stalls observed.

## 4. Browser QA — 9/9, zero overflow

desktop 1440×900 + mobile 375/390/430: home, watch E6 (real frame playing),
watch E1 (unavailable panel), search, season. Screenshots in `qa/`.

## 5. Catalogue truth — re-verified 2026-09-09

A second research pass corrected late-season numbering: the show's own YouTube
titles ("S2 EP6 ft. Rakhi Sawant…", "S2 EP5 ft. Orry…") plus Plex/TMDB,
Wikipedia's 5+2 structure, and India TV's "special episode" billing prove the
Rakhi programme is Episode 6 and the Netflix-exclusive Varun programme is
Bonus Episode 3 — overriding one outlier press headline and a ripper filename.
Cross-checks held: E5/E4 guests+dates on Plex, B1 57:14 on a dedicated tracker,
B1's fourth guest Rohan Joshi in three outlets, Balraj Singh Ghai confirmed as
regular co-host (correctly absent from guest lists). No Episode 7+ exists yet.

## 6. Accessibility + hardening

- axe-core (WCAG 2A/2AA): **0 violations** on home, watch E6/B3/E1, search,
  season, bonus. One contrast fix shipped (prev/next chain-end labels now use
  a solid 5.1:1 muted tone instead of 45% opacity).
- Headers: HSTS (2yr + subdomains), nosniff, strict referrer policy,
  restrictive permissions policy. No `X-Frame-Options` by decision (nothing
  legitimately frames the archive; sandbox previews require framing).
- Page weight: FCP ~250 ms, ~100 kB JS transfer, 87 kB shared First Load —
  no bundle action needed. Custom 404 ("Reel not found") + branded error page
  verified.

## 7. Bug hunt — 30/30

Shortcuts inert while typing in search; rapid-seek + play/pause stable;
8 weird queries safe; URL edges (case-404, 308 slashes, `/season/02`→307
canonical merge, `?x=1` tolerated, route 307/400s); **source blocked → honest
Retry → unblocked → retry re-resolves and plays**; refresh mid-playback
restores position; all 9 watch URLs + OG images 200.
