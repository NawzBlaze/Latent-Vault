import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Latent Vault — an independent streaming archive of India’s Got Latent';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Social preview card — dark stage aesthetic with gold accents.
 *
 * To use a custom static image instead: place your image at
 * public/opengraph-image.png and delete this file.
 */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          position: 'relative',
          background: '#0a0908',
        }}
      >
        {/* gradient stage light */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 70% 65% at 50% 30%, rgba(228,87,46,0.12) 0%, transparent 70%), ' +
              'radial-gradient(ellipse 50% 50% at 80% 60%, rgba(200,150,60,0.06) 0%, transparent 60%)',
          }}
        />

        {/* top bar */}
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

        {/* LATENT VAULT header */}
        <div
          style={{
            position: 'absolute',
            top: 52,
            left: 80,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div style={{ width: 32, height: 2, background: '#e4572e' }} />
          <span
            style={{
              fontSize: 18,
              letterSpacing: 8,
              color: '#e4572e',
              fontFamily: 'monospace',
              fontWeight: 500,
            }}
          >
            LATENT VAULT
          </span>
        </div>

        {/* main title area */}
        <div style={{ padding: '0 80px', position: 'relative', zIndex: 1 }}>
          <div
            style={{
              fontSize: 72,
              fontFamily: 'serif',
              fontWeight: 400,
              color: '#efe9dd',
              lineHeight: 1.02,
              marginBottom: 12,
            }}
          >
            India&apos;s Got Latent
          </div>

          <div
            style={{
              fontSize: 24,
              fontFamily: 'monospace',
              color: '#8d8471',
              letterSpacing: 4,
              marginBottom: 40,
            }}
          >
            SEASON 2 — STREAMING ARCHIVE
          </div>

          {/* bottom strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(239,233,221,0.12)',
              paddingTop: 24,
            }}
          >
            <div style={{ display: 'flex', gap: 48 }}>
              {[
                { value: '6', label: 'EPISODES' },
                { value: '3', label: 'BONUS' },
                { value: '1080p', label: 'FULL HD' },
              ].map((s) => (
                <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 600, color: '#efe9dd', fontFamily: 'serif' }}>
                    {s.value}
                  </span>
                  <span style={{ fontSize: 11, letterSpacing: 3, color: '#8d8471', fontFamily: 'monospace' }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                padding: '10px 24px',
                background: '#e4572e',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 2,
                fontFamily: 'sans-serif',
              }}
            >
              EXPLORE →
            </div>
          </div>
        </div>

        {/* right accent number */}
        <div
          style={{
            position: 'absolute',
            right: 50,
            top: 40,
            fontSize: 240,
            fontFamily: 'serif',
            fontWeight: 300,
            lineHeight: 0.85,
            color: 'transparent',
            WebkitTextStroke: '1px rgba(228,87,46,0.18)',
          }}
        >
          S2
        </div>

        {/* bottom credit */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 80,
            fontSize: 10,
            letterSpacing: 3,
            color: 'rgba(239,233,221,0.3)',
            fontFamily: 'monospace',
          }}
        >
          LATENTVAULT.VERCEL.APP
        </div>
      </div>
    ),
    { ...size },
  );
}
