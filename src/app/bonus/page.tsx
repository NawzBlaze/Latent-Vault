import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublished } from '@/catalog/catalogue';
import { sortChronological } from '@/catalog/order';
import BonusRow from '@/components/BonusRow';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Bonus episodes — India’s Got Latent',
  description:
    'Season 2 bonus episodes of India’s Got Latent, archived and verified. Bonus content is listed separately from the regular season.',
  alternates: { canonical: `${SITE_URL}/bonus` },
};

export default function BonusPage() {
  const items = sortChronological(getPublished().filter((i) => i.kind === 'bonus'));
  if (items.length === 0) notFound();

  return (
    <div className="wrap">
      <div className="page-head">
        <span className="label">Beyond the season</span>
        <h1>
          Bonus <span className="alt">Reels</span>
        </h1>
        <p>
          {items.length} bonus programmes from Season 2 — listed separately from the
          regular episode sequence.
        </p>
      </div>
      {items.map((item) => (
        <BonusRow key={item.id} item={item} />
      ))}
    </div>
  );
}
