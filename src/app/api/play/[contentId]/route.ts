/**
 * GET /api/play/[contentId] — playback authorisation.
 *
 * Flow: rate-limit → validate id → verify published+available → resolve fresh
 * source URL via the priority resolver (index first, yuhu only as fallback) → 307.
 * The response is a few hundred bytes; video bytes NEVER pass through here.
 * They travel directly: browser ↔ source CDN.
 *
 * Also answers HEAD (used by the player preflight) with identical semantics.
 *
 * Rate limiting: 30 requests / 60 s per IP, in-process best-effort.
 * On Vercel serverless this is per-Lambda-instance, not cross-instance —
 * a shared store (KV/Redis) would be needed for global enforcement.
 * This still deflects simple abusive bursts and is zero-dependency.
 */

import { getById } from '@/catalog/catalogue';
import { isPlayable } from '@/catalog/types';
import { resolvePlayable } from '@/source/resolve';
import { SourceError } from '@/source/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: { contentId: string };
}

const ID_RE = /^[a-z0-9]{2,16}$/;

/* ── in-process rate limiter ── */
const RATE_LIMIT     = 30;   // max requests
const RATE_WINDOW_MS = 60_000; // per 60 s
const MAX_IPS        = 2000;  // cap map size to bound memory

interface RateBucket { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Evict expired entries periodically — purge the whole map when it overflows
  if (rateBuckets.size >= MAX_IPS) {
    for (const [key, bucket] of rateBuckets) {
      if (now >= bucket.resetAt) rateBuckets.delete(key);
    }
    // If still over limit after eviction, deny to stay safe
    if (rateBuckets.size >= MAX_IPS) return false;
  }

  const bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count++;
  return true;
}

function getIp(req: Request): string {
  // Vercel forwards the real IP in these headers; fall back gracefully.
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/* ── response helpers ── */
function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}

function notFound(code = 'not found'): Response {
  return Response.json({ error: code }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

function tooManyRequests(): Response {
  return Response.json(
    { error: 'rate limit exceeded' },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': String(Math.ceil(RATE_WINDOW_MS / 1000)),
      },
    },
  );
}

/* ── main handler ── */
async function authorize(req: Request, contentId: string): Promise<Response> {
  // Rate limit before doing any catalogue or source work
  const ip = getIp(req);
  if (!checkRateLimit(ip)) return tooManyRequests();

  if (!ID_RE.test(contentId)) return badRequest('invalid content id');

  const item = getById(contentId);
  // Publication gate: unknown OR unpublished → 404 (no existence oracle).
  if (!item || !item.published) return notFound();
  // Verified identity but no usable media on either source.
  if (!isPlayable(item) || !item.source) return notFound('unavailable');

  // YouTube episodes: return video ID for client-side iframe embed.
  if (item.source.primary.origin === 'youtube') {
    return Response.json(
      { source: 'youtube', videoId: item.source.primary.videoId },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // The viewing browser's UA: Yuhu CDN signatures bind to the resolving UA,
  // so the resolver must mint with the UA that will actually play the URL.
  const callerUa = req.headers.get('user-agent');
  try {
    const t0    = Date.now();
    const media = await resolvePlayable([item.source.primary, ...item.source.alternates], callerUa);
    return new Response(null, {
      status: 307,
      headers: {
        Location: media.playUrl,
        'Cache-Control': 'no-store',
        'X-Resolve-Ms':    String(Date.now() - t0),
        'X-Resolve-Cache': media.cached ? 'hit' : 'miss',
        'X-Resolve-Via':   media.via,
        'X-Source-Origin': media.origin,
      },
    });
  } catch (err) {
    if (err instanceof SourceError && err.code === 'NOT_FOUND') return notFound();
    return Response.json(
      { error: 'media source unavailable' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  return authorize(req, ctx.params.contentId);
}

export async function HEAD(req: Request, ctx: Ctx): Promise<Response> {
  return authorize(req, ctx.params.contentId);
}
