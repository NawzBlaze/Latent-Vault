export const SITE_NAME = 'LATENT VAULT';
export const SITE_TAGLINE = 'An independent streaming archive of India’s Got Latent';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://latent-vault.vercel.app').replace(
  /\/$/,
  '',
);

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/season/2', label: 'Season 2' },
  { href: '/bonus', label: 'Bonus' },
  { href: '/search', label: 'Search' },
] as const;
