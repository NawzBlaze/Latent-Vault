/**
 * GET /api/health — tiny status readout. Exposes counts only; no secrets,
 * no signed URLs, no catalogue internals.
 */

import { getPublished, getSeasons } from '@/catalog/catalogue';
import { isPlayable } from '@/catalog/types';
import { SOURCE_ORIGIN } from '@/source/adapter';
import { YUHU_SITE_ORIGIN, YUHU_WORKER_URL } from '@/source/yuhu';
import { getHealthProbe, setHealthProbe } from '@/lib/health-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SourcePing {
  reachable: boolean;
  latencyMs: number | null;
}

async function pingIndex(): Promise<SourcePing> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${SOURCE_ORIGIN}/0:search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'latent-vault/1.0' },
      body: JSON.stringify({ q: 'latent', page_token: null, page_index: 0 }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return { reachable: res.ok && !!body?.data, latencyMs: Date.now() - t0 };
  } catch {
    return { reachable: false, latencyMs: null };
  } finally {
    clearTimeout(t);
  }
}

async function pingYuhu(): Promise<SourcePing> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    // A bare worker call answers 403 without a referer — any HTTP answer at
    // all proves the worker is up. No media ids are touched here.
    const res = await fetch(`${YUHU_WORKER_URL}/`, {
      headers: { 'User-Agent': 'latent-vault/1.0' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    await res.arrayBuffer().catch(() => undefined);
    return { reachable: res.status > 0, latencyMs: Date.now() - t0 };
  } catch {
    return { reachable: false, latencyMs: null };
  } finally {
    clearTimeout(t);
  }
}

export async function GET(): Promise<Response> {
  const published = getPublished();
  const cached = getHealthProbe();
  const [index, yuhu] = cached
    ? [cached.index, cached.yuhu]
    : await Promise.all([pingIndex(), pingYuhu()]).then((r) => {
        setHealthProbe({ at: Date.now(), index: r[0], yuhu: r[1] });
        return r;
      });
  return Response.json(
    {
      ok: true,
      version: '1.0.0',
      time: new Date().toISOString(),
      catalogue: {
        published: published.length,
        seasons: getSeasons(),
        episodes: published.filter((i) => i.kind === 'episode').length,
        bonus: published.filter((i) => i.kind === 'bonus').length,
        specials: published.filter((i) => i.kind === 'special').length,
        available: published.filter(isPlayable).length,
        unavailable: published.filter((i) => !isPlayable(i)).length,
      },
      sources: {
        index: { origin: SOURCE_ORIGIN, ...index },
        yuhu: { origin: YUHU_SITE_ORIGIN, ...yuhu },
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
