import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobileTabBar from '@/components/MobileTabBar';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import { SOURCE_ORIGIN } from '@/source/adapter';
import '@/styles/globals.css';
import '@/styles/player.css';

const serif = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-serif',
});

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
      <head>
        {/* Media goes straight from the browser to the source, so warm that
            connection early: DNS + TLS for the source origin would otherwise
            be paid inside the first-frame budget. */}
        <link rel="preconnect" href={SOURCE_ORIGIN} />
        <link rel="dns-prefetch" href={SOURCE_ORIGIN} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <MobileTabBar />
      </body>
    </html>
  );
}
