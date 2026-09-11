import type { ContentItem } from '@/catalog/types';

/**
 * The single editorial moment on the homepage:
 * a monochrome frame from the archive plus a short archival statement.
 */
export default function EditorialBanner({ featuredItem }: { featuredItem?: ContentItem }) {
  const still = featuredItem?.heroImage ?? '/posters/unavailable.svg';

  return (
    <section className="interlude" aria-label="About the archive">
      <div>
        <p className="interlude-quote">
          Every episode <span className="accent">verified</span> against the record before it enters the vault.
        </p>
        <p className="interlude-note">
          The archive holds only Season 2 of India&rsquo;s Got Latent. Identities, release
          dates and credits are cross-checked against official uploads and independent
          reporting; episodes without a usable media copy remain listed, marked
          unavailable — never silently removed.
        </p>
      </div>
      <div>
        <figure className="interlude-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={still}
            alt="Frame from the archived Season 2 recordings"
            width="1280"
            height="720"
            loading="lazy"
            decoding="async"
          />
        </figure>
        <p className="interlude-caption">Frame from the archive · Season 2</p>
      </div>
    </section>
  );
}
