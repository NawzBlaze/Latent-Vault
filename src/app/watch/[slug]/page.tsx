import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBySlug, getPublished } from '@/catalog/catalogue';
import { isPlayable } from '@/catalog/types';
import { prevNext, related } from '@/catalog/order';
import WatchView from '@/components/WatchView';
import { SITE_URL } from '@/lib/site';

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  return getPublished().map((i) => ({ slug: i.slug }));
}

function pageTitle(slug: string): { title: string; label: string } {
  const item = getBySlug(slug);
  if (!item) return { title: 'Not found', label: '' };
  const label =
    item.kind === 'episode'
      ? `S${item.season} E${item.episodeNumber}`
      : `S${item.season} ${item.title}`;
  return { title: `${label} — India’s Got Latent`, label };
}

export function generateMetadata({ params }: Props): Metadata {
  const item = getBySlug(params.slug);
  // Genuine 404: trigger the not-found boundary here as well as in the page,
  // otherwise Next may serve the not-found UI with a 200 status.
  if (!item || !item.published) notFound();
  const { title } = pageTitle(params.slug);
  const url = `${SITE_URL}/watch/${item.slug}`;
  return {
    title,
    description: item.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} · Latent Vault`,
      description: item.description,
      url,
      type: 'video.other',
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · Latent Vault`,
      description: item.description,
      images: [`${url}/opengraph-image`],
    },
  };
}

function isoDuration(seconds: number | null): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `PT${h > 0 ? `${h}H` : ''}${m}M${sec}S`;
}

export default function WatchPage({ params }: Props) {
  const item = getBySlug(params.slug);
  // Publication gate: only published catalogue entries render. Anything
  // else is a genuine 404 (never a soft-404 player shell).
  if (!item || !item.published) notFound();

  const published = getPublished();
  const pn = prevNext(published, item);
  const rel = related(published, item, 6);

  const playable = isPlayable(item);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `India’s Got Latent — ${item.kind === 'episode' ? `Season ${item.season} Episode ${item.episodeNumber}` : item.title}`,
    description: item.description,
    thumbnailUrl: [`${SITE_URL}${item.thumbnail}`],
    // Prefer the verified original release date; fall back to archival date.
    uploadDate: item.releaseDate ?? item.archivedAt ?? undefined,
    duration: isoDuration(item.durationSeconds),
    // Never advertise a playback URL for episodes with no media.
    ...(playable ? { contentUrl: `${SITE_URL}/api/play/${item.id}` } : {}),
    embedUrl: `${SITE_URL}/watch/${item.slug}`,
  };

  return (
    <div className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <WatchView item={item} prevNext={pn} related={rel} />
    </div>
  );
}
