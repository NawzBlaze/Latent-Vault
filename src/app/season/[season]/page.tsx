import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getPublished, getSeasons } from '@/catalog/catalogue';
import { sortChronological } from '@/catalog/order';
import { isPlayable } from '@/catalog/types';
import { Feature, ArchiveRow } from '@/components/ArchiveRow';
import { SITE_URL } from '@/lib/site';

interface Props {
  params: { season: string };
}

export function generateStaticParams() {
  return getSeasons().map((s) => ({ season: String(s) }));
}

export function generateMetadata({ params }: Props): Metadata {
  const n = Number(params.season);
  if (!Number.isInteger(n)) return {};
  const url = `${SITE_URL}/season/${n}`;
  return {
    title: `Season ${n} — India’s Got Latent`,
    description: `Every archived Season ${n} episode of India’s Got Latent, in episode order. Episodes without a usable media copy are listed as unavailable.`,
    alternates: { canonical: url },
    openGraph: { title: `Season ${n} · Latent Vault`, url },
  };
}

export default function SeasonPage({ params }: Props) {
  const n = Number(params.season);
  if (!Number.isInteger(n)) notFound();

  // STRICT episode-number order; unavailable episodes retained in sequence.
  const items = sortChronological(
    getPublished().filter((i) => i.season === n && i.kind === 'episode'),
  );
  if (items.length === 0) notFound();
  // One canonical URL per season: /season/02 etc. merges into /season/2.
  if (params.season !== String(n)) redirect(`/season/${n}`);

  const feature = [...items].reverse().find(isPlayable);

  return (
    <div className="wrap">
      <div className="page-head">
        <span className="label">India&rsquo;s Got Latent</span>
        <h1>Season {n}</h1>
        <p>
          {items.length} episodes in broadcast order. Episodes without a usable media copy
          are listed and marked unavailable — identities stay verified, numbering stays intact.
        </p>
      </div>

      {feature && <Feature item={feature} />}

      <div className="archive-list">
        {items.map((item) => (
          <ArchiveRow key={item.id} item={item} />
        ))}
      </div>

      <p style={{ marginTop: '32px' }}>
        <Link href="/bonus" className="more">Browse bonus episodes →</Link>
      </p>
    </div>
  );
}
