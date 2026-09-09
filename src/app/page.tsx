import Link from 'next/link';
import type { Metadata } from 'next';
import { getPublished } from '@/catalog/catalogue';
import { latestRegular, sortChronological } from '@/catalog/order';
import Hero from '@/components/Hero';
import EpisodeCard from '@/components/EpisodeCard';
import ContinueWatching from '@/components/ContinueWatching';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
};

function Section({
  id,
  title,
  moreHref,
  moreLabel,
  children,
}: {
  id: string;
  title: string;
  moreHref?: string;
  moreLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section" aria-label={id}>
      <div className="section-head">
        <h2>{title}</h2>
        {moreHref && (
          <Link className="more" href={moreHref}>
            {moreLabel ?? 'View all →'}
          </Link>
        )}
      </div>
      <div className="card-grid">{children}</div>
    </section>
  );
}

export default function HomePage() {
  const published = getPublished();
  const hero = latestRegular(published);
  const s2 = sortChronological(published.filter((i) => i.season === 2 && i.kind === 'episode'));
  const bonus = sortChronological(published.filter((i) => i.kind === 'bonus'));
  const specials = sortChronological(published.filter((i) => i.kind === 'special'));

  return (
    <div className="wrap">
      {hero && <Hero item={hero} />}

      <ContinueWatching items={published} />

      {s2.length > 0 && (
        <Section id="Season 2" title="Season 2" moreHref="/season/2" moreLabel="All of Season 2 →">
          {s2.map((item) => (
            <EpisodeCard key={item.id} item={item} />
          ))}
        </Section>
      )}

      {bonus.length > 0 && (
        <Section id="Bonus" title="Bonus" moreHref="/bonus" moreLabel="All bonus →">
          {bonus.map((item) => (
            <EpisodeCard key={item.id} item={item} />
          ))}
        </Section>
      )}

      {specials.length > 0 && (
        <Section id="Specials" title="Specials">
          {specials.map((item) => (
            <EpisodeCard key={item.id} item={item} />
          ))}
        </Section>
      )}
    </div>
  );
}
