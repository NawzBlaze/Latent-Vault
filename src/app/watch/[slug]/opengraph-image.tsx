import { ImageResponse } from 'next/og';
import { getBySlug, getPublished } from '@/catalog/catalogue';

export const runtime = 'edge';
export const alt = 'Latent Vault episode artwork';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return getPublished().map((i) => ({ slug: i.slug }));
}

export default function OgImage({ params }: { params: { slug: string } }) {
  const item = getBySlug(params.slug);
  const label = item
    ? item.kind === 'episode'
      ? `SEASON ${item.season} · EPISODE ${item.episodeNumber}`
      : `SEASON ${item.season} · ${item.title.toUpperCase()}`
    : 'LATENT VAULT';
  const people = item ? [...item.guests, ...item.panelists].slice(0, 4).join(' · ') : '';
  const num = item ? String(item.episodeNumber).padStart(2, '0') : '··';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#0a0908',
        }}
      >
        {/* gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 60% 70% at 30% 40%, rgba(228,87,46,0.1) 0%, transparent 65%)',
          }}
        />

        {/* top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, transparent, #e4572e 40%, #c98a4e 70%, transparent)',
          }}
        />

        {/* content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            padding: '0 80px',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 24,
            }}
          >
            <div style={{ width: 24, height: 2, background: '#e4572e' }} />
            <span style={{ fontSize: 14, letterSpacing: 7, color: '#e4572e', fontFamily: 'monospace', fontWeight: 500 }}>
              LATENT VAULT
            </span>
          </div>

          {/* title */}
          <div
            style={{
              fontSize: 64,
              color: '#efe9dd',
              fontFamily: 'serif',
              fontWeight: 400,
              lineHeight: 1.05,
              marginBottom: 16,
            }}
          >
            India&apos;s Got Latent
          </div>

          {/* episode label */}
          <div
            style={{
              fontSize: 24,
              letterSpacing: 4,
              color: '#e4572e',
              fontFamily: 'monospace',
              marginBottom: 14,
            }}
          >
            {label}
          </div>

          {/* guests */}
          {people ? (
            <div
              style={{
                fontSize: 22,
                color: '#8d8471',
                fontStyle: 'italic',
                fontFamily: 'serif',
                lineHeight: 1.4,
              }}
            >
              {people}
            </div>
          ) : null}

          {/* bottom bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 56,
              borderTop: '1px solid rgba(239,233,221,0.1)',
              paddingTop: 18,
            }}
          >
            <span style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(239,233,221,0.3)', fontFamily: 'monospace' }}>
              LATENTVAULT.VERCEL.APP
            </span>
            <span style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(239,233,221,0.3)', fontFamily: 'monospace' }}>
              PRESERVED FOR THE RIGHT AUDIENCE
            </span>
          </div>
        </div>

        {/* giant episode number */}
        <div
          style={{
            position: 'absolute',
            right: 60,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 320,
            fontFamily: 'serif',
            fontWeight: 300,
            lineHeight: 0.85,
            color: 'transparent',
            WebkitTextStroke: '1px rgba(228,87,46,0.2)',
          }}
        >
          {num}
        </div>
      </div>
    ),
    { ...size },
  );
}
