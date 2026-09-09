import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import '@/styles/globals.css';
import '@/styles/player.css';

const serif = Fraunces({
  subsets: ['latin'],
  weight: ['600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-serif',
});

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    'Latent Vault is an independent streaming archive of India’s Got Latent. Browse seasons, search guests, and stream episodes directly.',
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: 'An independent streaming archive of India’s Got Latent.',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: 'An independent streaming archive of India’s Got Latent.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0d0b07',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
