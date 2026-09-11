/**
 * LATENT VAULT catalogue — Season 2 ONLY. Nothing from Season 1 (or any
 * other show) may appear here; enforced by validate + tests.
 *
 * Provenance rules (enforced by tests + code review):
 *  - Index items map to REAL files on index.csbots.live, verified with
 *    scripts/probe-source.mjs (search -> fallback -> HEAD/Range -> parse).
 *  - The Yuhu item maps to a REAL okcdn entry on yuhu.freeforall.dev,
 *    verified end-to-end (worker resolve -> CDN HEAD/Range -> in-browser
 *    probe of pixels, codecs and duration).
 *  - YouTube items stream from the official YouTube upload via embedded
 *    iframe. The archive does not re-host or proxy YouTube video bytes.
 *  - Durations, resolutions and codecs are PROBED from real media, never
 *    taken from labels alone.
 *  - Episode identity, release dates and people credits are cross-verified
 *    against official YouTube metadata (oEmbed titles, upload dates,
 *    lengthSeconds) and independent press reporting. See docs/SOURCE.md.
 *  - No expiring data is stored: index refs hold exact file names + sizes;
 *    Yuhu refs hold stable dataId + videoId + verified quality. Fresh URLs
 *    are minted at request time by the source layer.
 */

import type { ContentItem } from './types';
import { isPlayable } from './types';

function item(i: ContentItem): ContentItem {
  return i;
}

export const CATALOGUE: ContentItem[] = [
  item({
    id: 's2e1',
    slug: 's2-e1',
    season: 2,
    episodeNumber: 1,
    kind: 'episode',
    title: 'Episode 1',
    description:
      'Season 2, Episode 1 of India\u2019s Got Latent, released 20 June 2026. Panel: Alia Bhatt, Sharvari and Ashish Solanki. Streamed via the official YouTube upload.',
    releaseDate: '2026-06-20',
    archivedAt: '2026-06-20',
    durationSeconds: null,
    thumbnail: '/posters/s2e1.jpg',
    heroImage: '/posters/s2e1-hero.jpg',
    guests: ['Alia Bhatt', 'Sharvari', 'Ashish Solanki'],
    panelists: [],
    participants: [],
    hosts: [],
    judges: [],
    aliases: [],
    source: {
      primary: {
        origin: 'youtube',
        videoId: 'eHTXQW58WhA',
      },
      alternates: [],
    },
    availability: 'available',
    resolution: null,
    published: true,
  }),

  item({
    id: 's2e2',
    slug: 's2-e2',
    season: 2,
    episodeNumber: 2,
    kind: 'episode',
    title: 'Episode 2',
    description:
      'Season 2, Episode 2 of India\u2019s Got Latent, released 3 July 2026. Panel: Harssh Limbachiya, Kiku Sharda and Chandan Prabhakar. Streamed via the official YouTube upload.',
    releaseDate: '2026-07-03',
    archivedAt: '2026-07-03',
    durationSeconds: null,
    thumbnail: '/posters/s2e2.jpg',
    heroImage: '/posters/s2e2-hero.jpg',
    guests: ['Harssh Limbachiya', 'Kiku Sharda', 'Chandan Prabhakar'],
    panelists: [],
    participants: [],
    hosts: [],
    judges: [],
    aliases: [],
    source: {
      primary: {
        origin: 'youtube',
        videoId: 'c35fpGWqXnk',
      },
      alternates: [],
    },
    availability: 'available',
    resolution: null,
    published: true,
  }),

  item({
    id: 's2e3',
    slug: 's2-e3',
    season: 2,
    episodeNumber: 3,
    kind: 'episode',
    title: 'Episode 3',
    description:
      'Season 2, Episode 3 of India’s Got Latent, released 17 July 2026. Panel: Raghu Ram, Vishal Dadlani, Tanmay Bhat and Yashraj. Archived from a verified 1080p source copy.',
    releaseDate: '2026-07-17',
    archivedAt: '2026-08-05T10:10:48.358Z',
    durationSeconds: 3223,
    thumbnail: '/posters/frame-s2e3.jpg',
    heroImage: '/posters/frame-s2e3.jpg',
    guests: ['Raghu Ram', 'Vishal Dadlani', 'Tanmay Bhat', 'Yashraj'],
    panelists: [],
    participants: [],
    hosts: [],
    judges: [],
    aliases: [],
    source: {
      primary: {
        origin: 'index',
        fileName: 'Indias.Got.Latent.S02E03.1080p.Hindi.WEB-DL.2.0.ESub.x264- @.mkv',
        sizeBytes: 1099933899,
        mimeType: 'video/x-matroska',
        searchHint: 'latent s02',
        videoCodec: 'V_MPEG4/ISO/AVC',
        audioCodec: 'A_AAC',
        width: 1920,
        height: 1080,
      },
      alternates: [],
    },
    availability: 'available',
    resolution: { width: 1920, height: 1080, label: '1080p' },
    published: true,
  }),

  item({
    id: 's2e4',
    slug: 's2-e4',
    season: 2,
    episodeNumber: 4,
    kind: 'episode',
    title: 'Episode 4',
    description:
      'Season 2, Episode 4 of India’s Got Latent, released 2 August 2026. Panel: Karan Aujla, Tanmay Bhat, Gurleen Pannu and Rahul Dua. Archived from a verified 1080p source copy.',
    releaseDate: '2026-08-02',
    archivedAt: '2026-08-02T18:39:43.166Z',
    durationSeconds: 3302,
    thumbnail: '/posters/frame-s2e4.jpg',
    heroImage: '/posters/frame-s2e4.jpg',
    guests: ['Karan Aujla', 'Tanmay Bhat', 'Gurleen Pannu', 'Rahul Dua'],
    panelists: [],
    participants: [],
    hosts: [],
    judges: [],
    aliases: [],
    source: {
      primary: {
        origin: 'index',
        fileName: 'Movies4u_Foo_Indias_Got_Latent_S02_E04_1080p_NF_WEB_DL_Hindi_ESubs.mkv',
        sizeBytes: 2432941174,
        mimeType: 'video/x-matroska',
        searchHint: 'latent s02',
        videoCodec: 'V_MPEG4/ISO/AVC',
        audioCodec: 'A_AAC',
        width: 1920,
        height: 1080,
        note: 'This archived copy runs about a minute longer than the public YouTube upload (streaming-platform bumper).',
      },
      alternates: [],
    },
    availability: 'available',
    resolution: { width: 1920, height: 1080, label: '1080p' },
    published: true,
  }),

  item({
    id: 's2e5',
    slug: 's2-e5',
    season: 2,
    episodeNumber: 5,
    kind: 'episode',
    title: 'Episode 5',
    description:
      'Season 2, Episode 5 of India’s Got Latent, released 28 August 2026. Panel: Orry, Archana Puran Singh, Sharon Verma and Nishant Suri. Archived from a verified 1080p source copy.',
    releaseDate: '2026-08-28',
    archivedAt: '2026-08-31T11:17:40.898Z',
    durationSeconds: 3274,
    thumbnail: '/posters/frame-s2e5.jpg',
    heroImage: '/posters/frame-s2e5.jpg',
    guests: ['Orry', 'Archana Puran Singh', 'Sharon Verma', 'Nishant Suri'],
    panelists: [],
    participants: [],
    hosts: [],
    judges: [],
    // The source file name truncates the surname ("...Archana.Puran.Sin.mkv").
    aliases: ['Archana Puran Sin'],
    source: {
      primary: {
        origin: 'index',
        fileName: 'Indias.Got.Latent.S02E05.Episode.5.Ft.Orry.Archana.Puran.Sin.mkv',
        sizeBytes: 2087459184,
        mimeType: 'video/x-matroska',
        searchHint: 'latent s02',
        videoCodec: 'V_MPEG4/ISO/AVC',
        audioCodec: 'A_AAC',
        width: 1920,
        height: 1080,
        note: 'This archived copy runs about half a minute longer than the public YouTube upload (streaming-platform bumper).',
      },
      alternates: [],
    },
    availability: 'available',
    resolution: { width: 1920, height: 1080, label: '1080p' },
    published: true,
  }),

  item({
    id: 's2e6',
    slug: 's2-e6',
    season: 2,
    episodeNumber: 6,
    kind: 'episode',
    title: 'Episode 6',
    description:
      'Season 2, Episode 6 of India’s Got Latent, released 6 September 2026. Panel: Rakhi Sawant, Ashneer Grover and Kushagra Srivastava. Archived from a verified 1080p source copy.',
    releaseDate: '2026-09-06',
    archivedAt: '2026-09-09',
    durationSeconds: 3146,
    thumbnail: '/posters/frame-s2e6.jpg',
    heroImage: '/posters/frame-s2e6.jpg',
    guests: ['Rakhi Sawant', 'Ashneer Grover', 'Kushagra Srivastava'],
    panelists: [],
    participants: [],
    hosts: [],
    judges: [],
    aliases: [],
    source: {
      primary: {
        origin: 'yuhu',
        dataId: 's2-06-rakhi',
        videoId: '6a9d7adc5882d566ebfc00e6',
        quality: '1080p',
        mimeType: 'video/mp4',
        videoCodec: 'avc1',
        audioCodec: 'mp4a',
        width: 1920,
        height: 1080,
      },
      alternates: [],
    },
    availability: 'available',
    resolution: { width: 1920, height: 1080, label: '1080p' },
    published: true,
  }),

  item({
    id: 's2b1',
    slug: 's2-bonus-e1',
    season: 2,
    episodeNumber: 1,
    kind: 'bonus',
    title: 'Bonus Episode 1',
    description:
      'Season 2 bonus episode of India’s Got Latent, released 27 July 2026. Panel: Raghav Juyal, Munawar Faruqui, Niharika NM and Rohan Joshi. Archived from a verified 1080p source copy.',
    releaseDate: '2026-07-27',
    archivedAt: '2026-07-27T14:18:28.832Z',
    durationSeconds: 3434,
    thumbnail: '/posters/frame-s2b1.jpg',
    heroImage: '/posters/frame-s2b1.jpg',
    guests: ['Raghav Juyal', 'Munawar Faruqui', 'Niharika NM', 'Rohan Joshi'],
    panelists: [],
    participants: [],
    hosts: [],
    judges: [],
    // Truncated name forms as seen in the source file name.
    aliases: ['Munawar', 'Niharika'],
    source: {
      primary: {
        origin: 'index',
        fileName: 'INDIA’S_GOT_LATENT_S2_Bonus_EP1_ft_Raghav_Juyal,_Munawar,_Niharika.mp4',
        sizeBytes: 413174469,
        mimeType: 'video/mp4',
        searchHint: 'latent bonus',
        videoCodec: 'av01',
        audioCodec: 'mp4a',
        width: 1920,
        height: 1080,
      },
      alternates: [],
    },
    availability: 'available',
    resolution: { width: 1920, height: 1080, label: '1080p' },
    published: true,
  }),

  item({
    id: 's2b2',
    slug: 's2-bonus-e2',
    season: 2,
    episodeNumber: 2,
    kind: 'bonus',
    title: 'Bonus Episode 2',
    description:
      'Season 2 bonus episode of India’s Got Latent, released 10 August 2026. Panel: Badshah, Sourav Joshi, Haarsh Limbachiyaa and Rajat Sood. Archived from a verified 1080p source copy.',
    releaseDate: '2026-08-10',
    archivedAt: '2026-08-10T18:53:51.980Z',
    durationSeconds: 2400,
    thumbnail: '/posters/frame-s2b2.jpg',
    heroImage: '/posters/frame-s2b2.jpg',
    guests: ['Badshah', 'Sourav Joshi', 'Haarsh Limbachiyaa', 'Rajat Sood'],
    panelists: [],
    participants: [],
    hosts: [],
    judges: [],
    // Spellings as seen in the source file names ("Harssh", bonus MKV tag).
    aliases: ['Harssh Limbachiyaa', 'S02E02(Bonus)'],
    source: {
      primary: {
        origin: 'index',
        fileName:
          'INDIA’S GOT LATENT S2 Bonus EP2 ft Badshah Sourav Joshi Harssh Limbachiyaa Rajat Sood 1080p25fps - Falix.mp4',
        sizeBytes: 607821456,
        mimeType: 'video/mp4',
        searchHint: 'latent bonus',
        videoCodec: 'avc1',
        audioCodec: 'mp4a',
        width: 1920,
        height: 1080,
        note: 'Primary: MP4/AVC plays in every modern browser.',
      },
      alternates: [
        {
          origin: 'index',
          fileName: "India's Got Latent - S02E02(Bonus) - Bonus Episode 2.mkv",
          sizeBytes: 606619757,
          mimeType: 'video/x-matroska',
          searchHint: 'latent bonus',
          videoCodec: 'V_MPEG4/ISO/AVC',
          audioCodec: 'A_AAC',
          width: 1920,
          height: 1080,
          note: 'Alternate: same 40-minute programme as an MKV remux (probed duration matches to the millisecond).',
        },
      ],
    },
    availability: 'available',
    resolution: { width: 1920, height: 1080, label: '1080p' },
    published: true,
  }),

  item({
    id: 's2b3',
    slug: 's2-bonus-e3',
    season: 2,
    episodeNumber: 3,
    kind: 'bonus',
    title: 'Bonus Episode 3',
    description:
      'Season 2 bonus episode of India’s Got Latent, released 4 September 2026. Panel: Varun Dhawan, Medha Shankar, Sharon Verma and Nishant Tanwar. A Netflix-exclusive programme, archived from a verified 1080p source copy.',
    releaseDate: '2026-09-04',
    archivedAt: '2026-09-04T18:20:45.975Z',
    durationSeconds: 2621,
    thumbnail: '/posters/frame-s2b3.jpg',
    heroImage: '/posters/frame-s2b3.jpg',
    guests: ['Varun Dhawan', 'Medha Shankar', 'Sharon Verma', 'Nishant Tanwar'],
    panelists: [],
    participants: [],
    hosts: [],
    judges: [],
    aliases: [],
    source: {
      primary: {
        origin: 'index',
        fileName: 'Indias_Got_Latent_S02E06_1080p_Hindi_WEB_DL_2_0_ESub_x264_HDHub4u.mkv',
        sizeBytes: 894246488,
        mimeType: 'video/x-matroska',
        searchHint: 'latent s02',
        videoCodec: 'V_MPEG4/ISO/AVC',
        audioCodec: 'A_AAC',
        width: 1920,
        height: 1080,
        note: 'The source file is labelled “S02E06”; the show’s own numbering places the Rakhi Sawant programme as Episode 6, so this Netflix-exclusive programme is archived here as Bonus Episode 3.',
      },
      alternates: [],
    },
    availability: 'available',
    resolution: { width: 1920, height: 1080, label: '1080p' },
    published: true,
  }),
];

export function getPublished(): ContentItem[] {
  return CATALOGUE.filter((c) => c.published);
}

export function getPlayable(): ContentItem[] {
  return CATALOGUE.filter(isPlayable);
}

export function getById(id: string): ContentItem | undefined {
  return CATALOGUE.find((c) => c.id === id);
}

export function getBySlug(slug: string): ContentItem | undefined {
  return CATALOGUE.find((c) => c.slug === slug);
}

export function getSeasons(): number[] {
  return [...new Set(getPublished().map((c) => c.season))].sort((a, b) => a - b);
}
