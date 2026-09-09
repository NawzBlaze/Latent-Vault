# Media sources

## Priority

1. **Primary — `index.csbots.live`.** Stable file identity (path + size);
   direct download URLs verified with HEAD. Serves E3–E6, B1, B2.
2. **Secondary — `yuhu.freeforall.dev` (okcdn).** Used ONLY for episodes where
   the primary has no usable media for that same episode — currently E6 only.
   Never preferred when the primary has a valid asset.

One canonical episode, multiple internal refs, zero duplicate public episodes.
No other media sources may be added without approval; YouTube is
metadata/verification only (never download, extract, re-host, or proxy bytes).

## Stable refs + fresh resolve

The catalogue stores identities, not URLs:

- index: file identity (name/size); the tokenised download URL is minted live.
- yuhu: `dataId` + `videoId` (+ expected quality); the worker
  (`okcdn.okcdn-api.workers.dev`, called with the site's Referer/Origin)
  returns a short-lived signed okcdn URL, which is HEAD-verified before use.

`/api/play` resolves on every request and answers with a 307, so playback
always follows a live signature. Resolved URLs are held in a short server-side
cache keyed by `videoId::quality::<exact UA>`; its lifetime is derived from the
signed URL's own `expires` value — `min(6 h, expires − 24 h)` — so an entry is
always dropped well before the signature dies, and never within 24 h of it.
See `docs/ARCHITECTURE.md` → "Source URL expiry handling".

Stale cache → one re-resolve, then an honest error. No signed URL is ever
written into the catalogue or to disk.

## Yuhu UA binding (critical)

Measured 2026-09-09: the okcdn CDN binds each signed URL to the User-Agent
that resolved it (`srcAg` differs per UA class) and answers **400 to any other
UA** — finer than browser family (desktop-Chrome-minted URLs fail even on
iPhone-Chrome). Therefore:

- `/api/play` reads the viewer's exact `User-Agent` and forwards it (trimmed,
  ≤500 chars) to the worker; the HEAD verify uses the same UA.
- Resolve cache keys include the exact UA (`videoId::quality::ua`, LRU 200).
- Missing/empty caller UA → canonical desktop-Chrome fallback.

This mirrors an in-browser Yuhu resolve: the signature always matches the
browser that will play it. Verified live across desktop/mobile Safari, Chrome,
CriOS, Firefox, FxiOS, and Android Chrome.

## Numbering authority (verified 2026-09-09)

Press outlets disagree about late-season numbering (Zoom calls the Rakhi
programme "Episode 7"; India TV, Plex/TMDB call it "Episode 6"), and the
primary source's Varun file is labelled "S02E06". The tiebreak is the show's
own voice — the official Samay Raina YouTube titles:

- "INDIA'S GOT LATENT S2 EP6 ft. Rakhi Sawant, Ashneer Grover, Kushagra
  Srivastava" → the Rakhi programme is **Episode 6** (this archive's E6).
- The Varun Dhawan programme is Netflix-exclusive with no regular number;
  press and Wikipedia bill it as a special/exclusive → archived here as
  **Bonus Episode 3**, with a source note explaining the file label.

Rule: official YouTube titles outrank press headlines, which outrank ripper
filenames. Never renumber from a single source.

## Yuhu entry notes (verified)

- The Rakhi entry (`s2-06-rakhi`, "S2 EP6") matches the official title above
  and is this archive's E6.
- Upstream `s2-01…s2-05` are YouTube-backed (unusable as media). The Varun
  entry's attached YouTube id is a fan re-upload, not an official upload —
  worthless as numbering evidence and unused.
- Rival/duplicate entries are rejected by the multi-signal filter; the
  documentary, BTS, and clip entries are out of catalogue scope — none
  surface.
