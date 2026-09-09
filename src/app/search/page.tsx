import type { Metadata } from 'next';
import { getPublished } from '@/catalog/catalogue';
import SearchExperience from '@/components/SearchExperience';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Search the archive',
  description:
    'Search India’s Got Latent episodes by title, episode number, season, or guest. Results come only from verified archive metadata.',
  alternates: { canonical: `${SITE_URL}/search` },
};

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const published = getPublished();
  return (
    <div className="wrap">
      <div className="search-hero">
        <div className="kicker">The index</div>
        <h1>Search the archive</h1>
        <SearchExperience items={published} initialQuery={searchParams.q ?? ''} />
      </div>
    </div>
  );
}
