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
          alignItems: 'center',
          padding: '0 96px',
          background: '#0d0b07',
          border: '3px solid #9a7a35',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ fontSize: 24, letterSpacing: 9, color: '#d2a94f' }}>LATENT VAULT</div>
          <div style={{ fontSize: 76, color: '#efe6d4', fontFamily: 'serif', marginTop: 14 }}>
            India’s Got Latent
          </div>
          <div style={{ fontSize: 30, letterSpacing: 5, color: '#e8c476', marginTop: 18 }}>{label}</div>
          {people ? (
            <div style={{ fontSize: 27, color: '#8d8471', fontStyle: 'italic', fontFamily: 'serif', marginTop: 12 }}>
              {people}
            </div>
          ) : null}
        </div>
        <div style={{ fontSize: 300, color: '#d2a94f', opacity: 0.32, fontFamily: 'serif', lineHeight: 1 }}>
          {num}
        </div>
      </div>
    ),
    { ...size },
  );
}
