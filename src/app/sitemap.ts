import type { MetadataRoute } from 'next';
import { getPublished, getSeasons } from '@/catalog/catalogue';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const published = getPublished();
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/bonus`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ...getSeasons().map((s) => ({
      url: `${SITE_URL}/season/${s}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...published.map((i) => ({
      url: `${SITE_URL}/watch/${i.slug}`,
      lastModified: i.archivedAt ? new Date(i.archivedAt) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
  ];
}
