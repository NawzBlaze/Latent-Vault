/**
 * GET /api/play/[contentId] — playback authorisation.
 *
 * Flow: validate id -> verify published+available -> resolve fresh source
 * URL via the priority resolver (index first, yuhu only as fallback) -> 307.
 * The response is a few hundred bytes; video bytes NEVER pass through here.
 * They travel directly: browser <-> source CDN.
 *
 * Also answers HEAD (used by the player preflight) with identical semantics.
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

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}

function notFound(code = 'not found'): Response {
  return Response.json({ error: code }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

async function authorize(req: Request, contentId: string): Promise<Response> {
  if (!ID_RE.test(contentId)) return badRequest('invalid content id');

  const item = getById(contentId);
  // Publication gate: unknown OR unpublished -> 404 (no existence oracle).
  if (!item || !item.published) return notFound();
  // Verified identity but no usable media on either source.
  if (!isPlayable(item) || !item.source) return notFound('unavailable');

  // The viewing browser's UA: Yuhu CDN signatures bind to the resolving UA,
  // so the resolver must mint with the UA that will actually play the URL.
  const callerUa = req.headers.get('user-agent');
  try {
    const t0 = Date.now();
    const media = await resolvePlayable([item.source.primary, ...item.source.alternates], callerUa);
    return new Response(null, {
      status: 307,
      headers: {
        Location: media.playUrl,
        'Cache-Control': 'no-store',
        // Actual cost of THIS request's authorisation. Previously this echoed
        // media.resolveMs, which on a cache hit replayed the original mint
        // time — so a 150 ms cached response advertised the ~1.4 s cold cost
        // it had just avoided. Now the header measures what it claims to.
        'X-Resolve-Ms': String(Date.now() - t0),
        'X-Resolve-Cache': media.cached ? 'hit' : 'miss',
        'X-Resolve-Via': media.via,
        'X-Source-Origin': media.origin,
      },
    });
  } catch (err) {
    if (err instanceof SourceError && err.code === 'NOT_FOUND') return notFound();
    // Upstream outage / timeout / drift: small 502, never a proxied body,
    // never an infinite retry — the player surfaces a retry button.
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
