import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getPublished, getSeasons } from '@/catalog/catalogue';
import { sortChronological } from '@/catalog/order';
import EpisodeCard from '@/components/EpisodeCard';
import { SITE_URL } from '@/lib/site';

interface Props {
  params: { season: string };
}

export function generateStaticParams() {
  return getSeasons().map((s) => ({ season: String(s) }));
}

export function generateMetadata({ params }: Props): Metadata {
  const n = Number(params.season);
  const url = `${SITE_URL}/season/${Number.isInteger(n) ? n : params.season}`;
  return {
    title: `Season ${n} — India’s Got Latent`,
    description: `Every archived Season ${n} episode of India’s Got Latent. Stream directly from the vault.`,
    alternates: { canonical: url },
    openGraph: { title: `Season ${n} · Latent Vault`, url },
  };
}

export default function SeasonPage({ params }: Props) {
  const n = Number(params.season);
  if (!Number.isInteger(n)) notFound();
  const items = sortChronological(
    getPublished().filter((i) => i.season === n && i.kind === 'episode'),
  );
  if (items.length === 0) notFound();
  // One canonical URL per season: /season/02, /season/2.0 etc. merge into /season/2.
  if (params.season !== String(n)) redirect(`/season/${n}`);

  return (
    <div className="wrap">
      <div className="page-head">
        <div className="kicker">India’s Got Latent</div>
        <h1>Season {n}</h1>
        <p>
          {items.length} verified {items.length === 1 ? 'episode' : 'episodes'} — every identity
          is researched; episodes without a usable media copy are marked unavailable.
        </p>
      </div>
      <div className="card-grid">
        {items.map((item) => (
          <EpisodeCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
