/**
 * Priority playback resolver — the ONE entry point for turning stable
 * catalogue references into a fresh playable URL.
 *
 * Rule (enforced by catalogue construction + tests, executed here):
 *   index.csbots.live is ALWAYS tried first.
 *   yuhu.freeforall.dev is tried ONLY when no usable index media resolves.
 *
 * References are attempted strictly in catalogue order (primary, then
 * alternates). The first working media wins; when everything fails the
 * primary error is thrown so callers report the most relevant cause.
 */

import type { MediaVariant } from '@/catalog/types';
import { resolveSourceFile } from './adapter';
import { resolveYuhuFile } from './yuhu';
import { SourceError, type ResolvedMedia } from './types';

export async function resolvePlayable(
  refs: MediaVariant[],
  callerUa?: string | null,
): Promise<ResolvedMedia> {
  if (refs.length === 0) {
    throw new SourceError('NOT_FOUND', 'no source references to resolve');
  }
  // YouTube refs are not resolved server-side — they're embedded as iframes.
  if (refs[0].origin === 'youtube') {
    throw new SourceError('NOT_FOUND', 'youtube content is embedded, not resolved');
  }
  let lastErr: unknown = null;
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    if (ref.origin === 'youtube') continue; // skip youtube in alternates
    try {
      const media =
        ref.origin === 'index'
          ? await resolveSourceFile(ref)
          : await resolveYuhuFile(ref, callerUa);
      return { ...media, via: i === 0 ? 'primary' : `alternate:${i - 1}` };
    } catch (err) {
      // Preserve the PRIMARY error when it exists: it names the most
      // relevant failure (e.g. 'file no longer listed on source').
      if (i === 0) lastErr = err;
      else if (lastErr === null) lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('resolution failed');
}
