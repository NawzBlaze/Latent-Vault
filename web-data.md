# web-data.md — LATENT VAULT canonical project context

> This is the single canonical handoff file. A new coding agent with **zero**
> prior context should read this first, then the files listed in
> "START HERE". Every statement below was verified against the current code
> (2026-09-10). Anything not provable is marked **UNKNOWN — VERIFY IN CODE**.

---

## 1 · Project identity

- **Name:** LATENT VAULT
- **Purpose:** an independent streaming/archive site for *India's Got Latent*.
- **Public scope:** **Season 2 ONLY.** Season 1 must never appear anywhere
  public (homepage, nav, search, sitemap, watch pages). This is enforced in
  code, not just convention (see §7).
- **Framework/runtime:** Next.js `^14.2.18` (App Router), React 18, TypeScript,
  Node `>=20`, deployed on **Vercel** (nodejs serverless runtime for API routes).
- **Rendering:** mostly static/SSG pages (`generateStaticParams`-style catalog
  pages) + two `force-dynamic` API routes (`/api/play/[contentId]`, `/api/health`).

---

## 2 · Architecture (confirmed by code)

```
Browser
  ↓  (HTML/JS from Vercel)
Next.js app (catalogue is compiled-in TS data, no DB)
  ↓  <video src="/api/play/<id>">
GET /api/play/[contentId]            (server-side, nodejs)
  ↓  publication gate (published + available + has source)
  ↓  resolve stable ref -> fresh signed URL (index first, yuhu fallback)
307  Location: <signed CDN URL>      (body is empty; bytes NEVER pass Vercel)
  ↓
Browser requests media DIRECTLY from the source CDN (Range/206 supported)
```

- **No database.** The catalogue is a typed TypeScript constant
  (`src/catalog/catalogue.ts`). No R2/Railway/scanner/proxy/YouTube playback.
- **Client/server boundary:** source-resolution code (`src/source/*`) is
  imported ONLY by server API routes, never by client components. Signed URLs
  are minted server-side and handed to the browser via a 307.

---

## 3 · Media sources (actual, in code)

There are **two** sources; one is primary.

### 3.1 PRIMARY — `https://index.csbots.live` (`src/source/adapter.ts`)
- Discovery: `POST {origin}/0:search {q, page_token, page_index}`.
- Per-request encrypted `id` tokens **rotate** — never stored.
- Fresh link mint: `POST {origin}/0:fallback {id}` → `{ link: "/download.aspx?...&expiry=...&mac=..." }`.
- The `link` is a **short-lived signed URL**, supports HTTP **Range** (206 + Content-Range).
- Stable identity = exact `fileName` (+ `sizeBytes`). At authorisation time the
  adapter re-searches, exact-matches the name, mints a fresh link, 307s to it.
- Server-side fresh-link cache TTL `45_000` ms (well below real expiry).

### 3.2 SECONDARY/fallback — Yuhu (`src/source/yuhu.ts`)
- Catalogue: `https://yuhu.freeforall.dev/okcdn.json`; resolution via worker
  `YUHU_WORKER_URL` (default `https://okcdn.okcdn-api.workers.dev`), which
  **requires a Yuhu Referer**.
- Signed URLs (~5 day expiry). **UA-bound**: the resolver forwards the caller's
  exact `User-Agent` and verifies with the same UA; cache keyed by exact UA.
- Expiry-derived cache: `lifetime = min(6h, urlExpiry − 24h)`; conservative
  10-min fallback when no `expires` param; max 200 entries.

### 3.3 Priority (`src/source/resolve.ts`)
`index` is **always tried first**; `yuhu` only when no usable index media
resolves. Refs attempted strictly in catalogue order (primary then alternates).

**Do NOT permanently store signed URLs** — the catalogue stores only *stable
references* (`IndexFileRef`/`YuhuFileRef`), never expiring URLs (see types.ts).

---

## 4 · Playback (`src/app/api/play/[contentId]/route.ts`)

- Endpoint `/api/play/[contentId]`, methods **GET and HEAD**, `dynamic=force-dynamic`, `runtime=nodejs`.
- Order: id regex → `getById` → **publication gate** (`!item || !item.published` → 404, no existence oracle) → `isPlayable(item) && item.source` else 404 `unavailable` → `resolvePlayable(...)` → **307** with `Location`.
- Headers on 307: `Cache-Control: no-store`, `X-Resolve-Ms` (this request's cost), `X-Resolve-Cache: hit|miss`, `X-Resolve-Via`, `X-Source-Origin`.
- Failures: `SourceError NOT_FOUND` → 404; upstream outage/timeout → **502** (small JSON, never a proxied body, never infinite retry; player shows a retry button).
- `/api/play/:id` also gets `Cache-Control: no-store` via `next.config.mjs` headers.

### Player (`src/player/LatentPlayer.tsx`, native HTML5 `<video>`)
- The media request **is** the authorization: `video.src = /api/play/<id>`; browser follows the 307. There is **no** separate HEAD preflight (it was removed as a duplicate round-trip).
- State machine: `loading / ready / playing / paused / buffering / seeking / ended / error`.
- Timeouts: `STALL_TIMEOUT_MS=20000`, `LOAD_TIMEOUT_MS=25000`, `MAX_AUTO_RETRIES=1`.
- Controls: play/pause, seek bar (+buffered indicator), volume, mute, speed `[0.5,0.75,1,1.25,1.5,1.75,2]`, fullscreen, theater, PiP (`requestPictureInPicture`), resume, keyboard.
- Keyboard: Space, ←/→ (5s), Shift+←/→ (30s), Home/End, `<`/`>` speed, `m` mute, `f` fullscreen, `,`/`.` frame-step, `?` help overlay, `Esc` close help, `0–9` jump %.
- Touch: double-tap left/right = ∓10s (with `lv-seekflash` feedback), long-press = 2× boost, `playsInline`.
- Debug overlay `?lv-debug=1` shows state, auth/meta/first-frame ms, and the
  Resource-Timing network breakdown (`net:` auth/redir/ttfb/total/host).
- Prefs persisted to `localStorage` key `lv.player.prefs` (volume + rate, clamped).

**SAFE TO CHANGE:** cosmetic CSS, help-panel copy, extra shortcuts.
**REGRESSION-TEST CAREFULLY:** anything touching `video.src` assignment, the
307 flow, `authorize`, `resolvePlayable`, seek/Range behaviour, resume.

---

## 5 · Catalogue (`src/catalog/*`)

Model `ContentItem` (types.ts): `id, slug, season, episodeNumber, kind
('episode'|'bonus'|'special'), title, description, releaseDate|null,
archivedAt|null, durationSeconds|null, thumbnail, heroImage, guests[],
panelists[], participants[], hosts[], judges[], aliases[], source|null,
availability ('available'|'unavailable'), resolution|null, published,
officialUrl?`.

- `isPlayable(item)` = `published && availability==='available' && source!==null`.
- `PUBLIC_SEASON = 2`; `validate.ts` errors if any item has `season !== 2`.
- `filter.ts` = Season-2-only inclusion/exclusion heuristics for candidate files.
- Ordering `order.ts`: `sortChronological`, `sortLatestFirst`, `latestRegular`,
  `prevNext`, `related`, and `playableFirst` (playable first, chronological
  within group — used for home rails).
- Current data: 9 items (6 regular episodes + 3 bonus); 2 unavailable (E1, E2),
  7 available. **Verify counts in code; they change.**

---

## 6 · Search (`src/catalog/search.ts`, UI `components/SearchExperience.tsx`)

- Operates **entirely on catalogue metadata** — no hardcoded names, no external calls.
- Fields: title, season/episode markers, guests, panelists, participants, hosts, judges, aliases, description.
- Matching: exact, case-insensitive, partial, token, and episode-number
  (`S2E5`, `S02E05`, `Episode 5`, `Bonus Episode 1`, `Season 2`) via `parseEpisodeQuery`.
- People names are searchable because they are structured metadata on each item.
- Zero-results state is intentional (shows tips + browse links).

---

## 7 · Season-2 isolation (where)

- `types.ts` `PUBLIC_SEASON=2`; `validate.ts` build/test gate; `filter.ts`
  exclusion logic; `sitemap.ts`/nav/pages all derive from the published
  catalogue which only ever contains Season 2. **No Season 1 strings in UI.**

---

## 8 · Thumbnails / artwork

- Playable items use **real video frames** committed as static JPEGs:
  `public/posters/frame-<id>.jpg` (16:9, cropped in CSS to hide a burned-in
  corner artifact). Enforced by `tests/unit/posters.test.ts`.
- Unavailable items use a neutral `public/posters/unavailable.svg` (never a
  borrowed frame). Legacy typographic SVG key art is generated by
  `scripts/make-posters.mjs` (still present; frames supersede it for playable).
- Frames are generated **offline during content preparation** (headless seek +
  luminance scoring), NOT per-request. The generation script is NOT in the repo.
  **UNKNOWN — VERIFY:** exact frame-extraction tooling lives outside this repo.

---

## 9 · Progress / resume (`src/player/progress.ts`)

- `localStorage` key `igl_progress_<contentId>` → `{position,duration,updatedAt,completed}`.
- Save cadence: throttled to ≥5s in `timeupdate`, plus on `ended` and unmount.
- Completed when `duration−position ≤ 20s` or `position/duration ≥ 0.97`.
- Resume: on `loadedmetadata`, if saved position ≥15s and not completed, seek + toast.
- Continue Watching (`components/ContinueWatching.tsx`) lists unfinished entries
  (position ≥15, not completed), newest first; rendered on home **only if non-empty**.

---

## 10 · Environment variables (all `process.env` reads, verified)

| Variable | Purpose | Required? | Used where | Scope |
|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | canonical origin for SEO/OG/canonical | No (default = prod URL) | `lib/site.ts` | **PUBLIC** |
| `SOURCE_ORIGIN` | primary media source origin | No (default `https://index.csbots.live`) | `source/adapter.ts` | server (also emitted into `<link preconnect>`) |
| `YUHU_WORKER_URL` | okcdn resolver worker | No (default worker) | `source/yuhu.ts` | server |
| `NODE_ENV` | framework built-in | — | `app/error.tsx` | both |

Dev-only (never read by app): `E2E_PORT`, `E2E_BASE_URL` (playwright config).
**No secrets are required at runtime.** See `.env.example`.

---

## 11 · Deployment

- Platform: **Vercel**, project `prj_PAxrm5FTqB8X9UwnVdVkY16yJPfu` (`.vercel/project.json`).
- Build: `next build` (run from `src/`). Start: `next start`. Dev: `next dev`.
- Prod URL: `https://latent-vault.vercel.app`.
- Deploy: `vercel deploy --prod --yes` from `src/` (a `vc` wrapper injects the
  token from a local credential store; **never commit tokens**).
- Current prod deployment (as of 2026-09-10): `dpl_A4TgUH44xc7XasLw1KXHY6nehvK8` —
  **verify via the Vercel API before relying on this.**
- Rollback: `vercel promote <previous-deployment>` or re-deploy a prior Git SHA.

---

## 12 · Testing

- `npm run typecheck` → `tsc --noEmit`.
- `npm run build` → static pages (currently 19).
- `npm test` → `vitest run` (unit + integration; currently **136 tests / 15 files**).
- `npm run test:e2e` → Playwright (responsive + axe a11y suites exist under `tests/`).
- Key regression tests: `play-route` (307/gate), `yuhu-cache` (expiry), `resolve`
  (priority), `catalogue`/`filter` (Season-2 gate), `posters` (real frames),
  `search`, `progress`, `prefetch`, `player-prefs`.
- Real-browser playback QA: headless Chromium against a running build; verify
  `206/Content-Range` and that media host is the source, not Vercel.

---

## 13 · Adding a new episode (actual workflow)

1. VERIFY the episode exists and is Season 2 (`filter.ts` evidence).
2. FIND media on the **primary** source (exact `fileName` + `sizeBytes`); probe
   real resolution/duration (`scripts/probe-source.mjs`). Never guess quality.
3. ADD a `ContentItem` to `src/catalog/catalogue.ts` with stable `source` refs
   (index primary, yuhu alternate only if real), `published:true` only when media
   is verified; else `availability:'unavailable'`.
4. ARTWORK: extract a real frame → `public/posters/frame-<id>.jpg` (playable) or
   keep `unavailable.svg`; `posters.test.ts` will enforce the invariant.
5. METADATA/SEARCH: fill people/aliases/description — search picks these up
   automatically (no separate index to update).
6. ORDERING/NAV: nothing manual — home rails, `prevNext`, `related`, sitemap all
   derive from the catalogue.
7. `npm run typecheck && npm test && npm run build`, browser-verify the watch
   page, then one deliberate deploy.

**Edit:** `catalogue.ts`, artwork assets. **Do NOT edit:** `source/*`, `api/play`,
`validate.ts` gates, `filter.ts` exclusions unless you understand the invariant.

---

## 14 · DO NOT BREAK THESE (all true in code)

- Large media must not pass through Vercel (`/api/play` returns 307, empty body).
- Publication gate runs **before** resolution (404, no existence oracle).
- Never hardcode/persist temporary signed URLs in the catalogue.
- Season 1 stays isolated (validate/filter/sitemap).
- Search uses structured metadata only (no hardcoded names).
- Never fabricate duration/resolution/source for unavailable items.
- Player must stay mobile-safe (44px targets, `playsInline`, safe-area).
- Index-before-Yuhu priority; keep UA-bound signature handling.

---

## 15 · Known limitations (real)

- **Cold mint latency:** a fresh serverless instance pays the upstream signed-URL
  mint on first play (~seconds). Mitigated by intent-prefetch (`lib/prefetch.ts`)
  + `preconnect`; not eliminated (no shared KV permitted). *Why:* serverless has
  no shared cache. *Workaround:* hover-prefetch warms likely plays.
- **MKV cues at file end:** metadata load issues a tail Range request per load.
  *Why:* source container layout. *Workaround:* none (inherent).
- **UA-bound signatures (Yuhu):** mismatched UA → 400. *Workaround:* forward exact
  caller UA + verify with same UA.
- **Frame-extraction tooling outside repo:** regeneration process not versioned.

---

## 16 · File map (meaningful files)

| Path | What / why | Safe? | Risk |
|---|---|---|---|
| `src/app/api/play/[contentId]/route.ts` | 307 authorisation + gate | careful | breaks playback |
| `src/source/{adapter,resolve,yuhu,types}.ts` | source clients + priority + cache | careful | signed-URL/UA bugs |
| `src/catalog/{catalogue,types,validate,filter,search,order,slug}.ts` | data + gates + search | data yes / gates careful | scope leaks |
| `src/player/{LatentPlayer,metrics,progress}.ts(x)` | player + instrumentation + resume | careful | regression |
| `src/lib/{prefetch,site,format,health-cache}.ts` | prefetch/SEO/helpers | mostly yes | low |
| `src/components/*` | UI surfaces | yes | visual |
| `src/styles/{globals,player}.css` | design system | yes | visual |
| `src/app/{layout,page,sitemap,robots,not-found,opengraph-image}.tsx` | shell/SEO | careful | SEO |
| `scripts/{probe-source,make-posters,push-to-github}` | ops tooling | yes | low |

---

## 17 · Decision log (intentional)

- **Direct media delivery (307), not proxying.** Reason: keeps Vercel bandwidth/
  compute ~zero and playback efficient. *INTENTIONAL — do not replace without a
  measured reason.*
- **No DB; compiled catalogue.** Reason: tiny corpus, strong typing, testable gates.
- **Removed HEAD preflight (single authorization).** Reason: it duplicated the
  browser's own request and added a round-trip. Measured improvement.
- **Expiry-derived caching, not flat TTLs.** Reason: measured real URL lifetimes.
- **Real frames over synthetic art for playable items.** Reason: honest artwork.

---

## START HERE — FOR A NEW AI AGENT

1. Read this file completely.
2. Read `package.json`.
3. Read `src/app/layout.tsx` + `src/app/page.tsx` (entry/home).
4. Read `src/source/adapter.ts` and `src/source/resolve.ts`.
5. Read `src/app/api/play/[contentId]/route.ts`.
6. Read `src/player/LatentPlayer.tsx`.
7. Read `src/catalog/catalogue.ts` + `types.ts` + `validate.ts`.
8. Read `src/catalog/search.ts`.
9. Read `.vercel/project.json` + `next.config.mjs`.
10. Run `npm run typecheck && npm test && npm run build`.
11. Start `npm run start` (or `dev`) and open a watch page.
12. Verify real playback (206 from source) before changing anything.

### Current architecture in 12 lines

Next.js 14 App Router on Vercel; no DB — catalogue is typed TS (Season 2 only).
Pages are SSG; `/api/play/[id]` and `/api/health` are the only dynamic routes.
`/api/play` gates publication, resolves a stable ref to a fresh signed URL
(index first, yuhu fallback, UA-bound), and returns **307** with an empty body.
The browser's `<video>` follows the 307 and streams **directly** from the CDN
(Range/206). Player is a custom native-HTML5 component with resume, keyboard,
touch, PiP/theater, and Resource-Timing instrumentation. Progress + prefs live
in `localStorage`. Search is pure metadata matching. Thumbnails are committed
real frames. Tests (136) gate the Season-2/307/cache/poster invariants.
