# Adding a Season 2 episode

Scope is locked to Season 2. Never add another season through this flow.

## 1. Verify identity (research, never guess)

Confirm season + episode number, title, guests, release date (IST), and runtime.
Numbering authority, in order: the show's own YouTube titles (oEmbed) →
TMDB/Plex → press consensus → ripper filenames last (see `docs/SOURCE.md`:
press and filenames both mis-numbered the E6/B3 pair). Cross-check guests and
dates against at least two of: YouTube metadata, reputable press, Wikipedia
(known errors: dates, spellings — never sole-source it), the show's official
posts. YouTube is metadata-only — never download or re-host bytes.

## 2. Verify media (primary first)

1. Check `index.csbots.live` for a usable copy. Match with the multi-signal
   filter: filename + path + size + show/season/episode markers + title context.
   Probe the real stream (resolution, codecs, duration) — labels must reflect
   measurement, never filenames alone.
2. Only if the primary has no usable copy for this episode, check the Yuhu
   secondary the same way. Reject YouTube-backed entries and rival/duplicate
   entries; resolve identity conflicts by duration + guests + release order
   (see `docs/SOURCE.md` for the E6-vs-B3 numbering precedent).

## 3. Add to the catalogue

- `src/catalog/catalogue.ts`: new entry with `id` (`s2e8`…), slug, season `2`,
  guests, release date, and a `source` block (`primary` + `alternates`).
- If NO usable copy exists on either source: publish with `source: null`
  (verified-but-unavailable). The UI, search, and SEO handle this honestly —
  do not invent duration/quality or add a watch action.
- Posters: extend `EPISODES` in `scripts/make-posters.mjs` and re-run it —
  it generates the self-contained SVG set (`<slug>.svg`, `<slug>-hero.svg`,
  `<slug>-m.svg`) per item. A test fails if any published item lacks artwork.

## 4. Re-verify and ship

1. `npx vitest run` — catalogue validation must pass (ids, slugs, ordering,
   no S1 leakage).
2. `npm run build && npm run start -- --port 3100`, then
   `npx playwright test` — update counts only if the roster changed
   (health, sitemap, hero-latest expectations).
3. Media-QA the new episode (timings + full control matrix) and record the
   result in `docs/QA.md`.
4. Deploy once — no deploy spam.
