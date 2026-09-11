import type { Metadata } from 'next';
import { getPublished } from '@/catalog/catalogue';
import SearchExperience from '@/components/SearchExperience';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Search the archive',
  description:
    'Search Season 2 of India’s Got Latent by title, episode number, guest, panelist or description.',
  alternates: { canonical: `${SITE_URL}/search` },
};

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const published = getPublished();
  return (
    <div className="wrap">
      <div className="search-hero">
        <span className="label">The index</span>
        <h1>
          Search the <span className="alt">Archive</span>
        </h1>
        <SearchExperience key={searchParams.q ?? ''} items={published} initialQuery={searchParams.q ?? ''} />
      </div>
    </div>
  );
}
