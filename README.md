# Latent Vault — Season 2 Archive

An independent streaming archive of **India's Got Latent, Season 2 only** — 6
episodes + 3 bonus programmes. Episodes stream directly from the configured
media sources to the viewer's device; nothing is re-hosted here.

- **Stack:** Next.js 14 (static pages + 2 API routes), TypeScript, no database,
  no cron, no Redis, no object storage.
- **Scope lock:** Season 2 is the entire public catalogue. Season 1 (or any
  other season) must not appear in pages, nav, search, sitemap, or structured
  data. E2E tests enforce this.
- **Media priority:** `index.csbots.live` (primary) → `yuhu.freeforall.dev`
  (secondary, only when the primary lacks usable media for that episode).
  Playback is an HTTP 307 redirect — video bytes never pass through Vercel.

## Quick start

```bash
npm install
npm run build
npm run start        # production server, http://localhost:3000
```

Development: `npm run dev`. Tests: `npx vitest run` (unit + integration),
`npx playwright test` (E2E, needs `npm run build && npm run start` on :3100 —
see `playwright.config.ts`).

## Docs

- `docs/ARCHITECTURE.md` — routes, components, playback pipeline
- `docs/SOURCE.md` — the dual-source media model (priority, refs, Yuhu UA binding)
- `docs/QA.md` — test gates and measured results
- `docs/ADD_EPISODE.md` — how to verify and add a new Season 2 episode

## Catalogue status (verified 2026-09-09)

| ID | Episode | Guests | Media | Quality |
|----|---------|--------|-------|---------|
| s2e1 | S2 E1 | Alia Bhatt, Sharvari, Ashish Solanki | — | Not available |
| s2e2 | S2 E2 | Harssh Limbachiya, Kiku Sharda, Chandan Prabhakar | — | Not available |
| s2e3 | S2 E3 | Raghu Ram, Vishal Dadlani, Tanmay Bhat, Yashraj | index | 1080p |
| s2e4 | S2 E4 | Karan Aujla, Tanmay Bhat, Garleen Pannu, Rahul Dua | index | 1080p |
| s2e5 | S2 E5 | Orry, Archana Puran Singh, Sharon Verma, Nishant Suri | index | 1080p |
| s2e6 | S2 E6 | Rakhi Sawant, Ashneer Grover, Kushagra Srivastava | **yuhu** | 1080p |
| s2b1 | Bonus EP1 | Raghav Juyal, Munawar Faruqui, Niharika NM, Rohan Joshi | index | 1080p |
| s2b2 | Bonus EP2 | Badshah, Haarsh Limbachiyaa, Sourav Joshi, Rajat Sood | index | 1080p |
| s2b3 | Bonus EP3 | Varun Dhawan, Medha Shankr, Sharon Verma, Nishant Tanwar | index | 1080p |

E1/E2 are published as verified-but-unavailable: they keep numbering, metadata,
and search presence, but expose no player, no watch action, no duration, and no
quality badge. Numbering follows the show's own YouTube titles: the Rakhi
Sawant programme is officially "S2 EP6", and the Netflix-exclusive Varun
Dhawan programme (billed as a special/exclusive, never given a regular number)
is archived as Bonus Episode 3 — even though its source file is labelled
"S02E06" (noted on the episode). See `docs/SOURCE.md`.

Unofficial fan archive — not affiliated with, endorsed, or sponsored by the
show, its creators, or any network.
