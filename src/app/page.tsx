import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublished } from '@/catalog/catalogue';
import { latestRegular, sortChronological } from '@/catalog/order';
import { isPlayable } from '@/catalog/types';
import Hero from '@/components/Hero';
import Ticker from '@/components/Ticker';
import ScrollReveal from '@/components/ScrollReveal';
import ContinueWatching from '@/components/ContinueWatching';
import { Feature, ArchiveRow } from '@/components/ArchiveRow';
import EditorialBanner from '@/components/EditorialBanner';
import BonusRow from '@/components/BonusRow';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = { alternates: { canonical: SITE_URL } };

export default function HomePage() {
  const published = getPublished();
  const hero = latestRegular(published);

  // Season 2 episodes in STRICT episode-number order — E01…E06.
  // Unavailable episodes keep their place; nothing is filtered out.
  const episodes = sortChronological(
    published.filter((i) => i.season === 2 && i.kind === 'episode'),
  );

  // One featured moment: the latest playable episode (hero if it plays).
  const feature = hero && isPlayable(hero) ? hero : [...episodes].reverse().find(isPlayable);

  const bonus = sortChronological(published.filter((i) => i.kind === 'bonus'));

  return (
    <>
      {hero && <Hero item={hero} />}

      <Ticker items={episodes} />

      <div className="wrap">
        <ContinueWatching items={published} />

        {/* ── SEASON 2 INDEX ── */}
        <section className="season-index" aria-label="Season 2 episodes">
          <div className="section-head">
            <h2>
              Season <span className="alt">Two</span>
            </h2>
            <span className="section-count">{episodes.length} episodes</span>
            <Link href="/season/2" className="more">All episodes</Link>
          </div>

          <ScrollReveal>
            {feature && <Feature item={feature} />}
          </ScrollReveal>

          <div className="archive-list">
            {episodes.map((item, i) => (
              <ScrollReveal key={item.id} delay={Math.min(i * 40, 240)} className="rv-row">
                <ArchiveRow item={item} />
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ── EDITORIAL INTERLUDE ── */}
        <ScrollReveal>
          <EditorialBanner featuredItem={feature} />
        </ScrollReveal>

        {/* ── BONUS ── */}
        {bonus.length > 0 && (
          <section className="bonus-section" aria-label="Bonus episodes">
            <div className="section-head">
              <h2>
                The <span className="alt">Bonus</span> Reels
              </h2>
              <span className="section-count">{bonus.length} programmes</span>
              <Link href="/bonus" className="more">All bonus</Link>
            </div>
            {bonus.map((item, i) => (
              <ScrollReveal key={item.id} delay={Math.min(i * 60, 200)}>
                <BonusRow item={item} />
              </ScrollReveal>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
