import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublished } from '@/catalog/catalogue';
import { sortChronological } from '@/catalog/order';
import EpisodeCard from '@/components/EpisodeCard';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Bonus episodes — India’s Got Latent',
  description: 'Archived bonus episodes of India’s Got Latent. Stream directly from the vault.',
  alternates: { canonical: `${SITE_URL}/bonus` },
};

export default function BonusPage() {
  const items = sortChronological(getPublished().filter((i) => i.kind === 'bonus'));
  if (items.length === 0) notFound();
  return (
    <div className="wrap">
      <div className="page-head">
        <div className="kicker">Beyond the season</div>
        <h1>Bonus episodes</h1>
        <p>
          {items.length} archived {items.length === 1 ? 'episode' : 'episodes'} — only titles
          verified on the media source are listed.
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
