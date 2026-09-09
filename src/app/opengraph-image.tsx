import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Latent Vault — an independent streaming archive of India’s Got Latent';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 96px',
          background: '#0d0b07',
          border: '3px solid #9a7a35',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 2, background: '#d2a94f', marginRight: 18 }} />
          <div style={{ fontSize: 26, letterSpacing: 10, color: '#d2a94f' }}>LATENT VAULT</div>
        </div>
        <div style={{ fontSize: 88, color: '#efe6d4', fontFamily: 'serif', lineHeight: 1.05 }}>
          India’s Got Latent
        </div>
        <div style={{ fontSize: 34, color: '#8d8471', fontStyle: 'italic', fontFamily: 'serif', marginTop: 18 }}>
          An independent streaming archive
        </div>
        <div style={{ fontSize: 22, letterSpacing: 6, color: '#9a7a35', marginTop: 44 }}>
          SEASONS · BONUS · SEARCH
        </div>
      </div>
    ),
    { ...size },
  );
}
