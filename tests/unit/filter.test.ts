import { describe, expect, it } from 'vitest';
import { classifyYuhuEntry, filterSourceFile } from '@/catalog/filter';

/** Every real Season 2 file on the primary source must match. */
const REAL_S2_FILES: { fileName: string; mimeType: string; season: number; episode: number; kind: string }[] = [
  { fileName: "India's Got Latent - S02E02(Bonus) - Bonus Episode 2.mkv", mimeType: 'video/x-matroska', season: 2, episode: 2, kind: 'bonus' },
  { fileName: 'Indias.Got.Latent.S02E03.1080p.Hindi.WEB-DL.2.0.ESub.x264- @.mkv', mimeType: 'video/x-matroska', season: 2, episode: 3, kind: 'episode' },
  { fileName: 'Indias.Got.Latent.S02E05.Episode.5.Ft.Orry.Archana.Puran.Sin.mkv', mimeType: 'video/x-matroska', season: 2, episode: 5, kind: 'episode' },
  { fileName: 'Indias_Got_Latent_S02E06_1080p_Hindi_WEB_DL_2_0_ESub_x264_HDHub4u.mkv', mimeType: 'video/x-matroska', season: 2, episode: 6, kind: 'episode' },
  { fileName: 'INDIA’S GOT LATENT S2 Bonus EP2 ft Badshah Sourav Joshi Harssh Limbachiyaa Rajat Sood 1080p25fps - Falix.mp4', mimeType: 'video/mp4', season: 2, episode: 2, kind: 'bonus' },
  { fileName: 'INDIA’S_GOT_LATENT_S2_Bonus_EP1_ft_Raghav_Juyal,_Munawar,_Niharika.mp4', mimeType: 'video/mp4', season: 2, episode: 1, kind: 'bonus' },
  { fileName: 'Movies4u_Foo_Indias_Got_Latent_S02_E04_1080p_NF_WEB_DL_Hindi_ESubs.mkv', mimeType: 'video/x-matroska', season: 2, episode: 4, kind: 'episode' },
];

/** Real Season 1 files on the source must be REJECTED (out of scope). */
const REAL_S1_FILES = [
  { fileName: "India's Got Latent (2024) - S01E09 _ft_@DeepakKalal_@MananDesai.mp4", mimeType: 'video/mp4' },
  { fileName: 'Indias.Got.Latent.S01E01.1080p.NF.WEB-DL.DDP5.1.H.264-XDMovies.com.mkv', mimeType: 'video/x-matroska' },
  { fileName: 'Indias.Got.Latent.S01E01.1080p.NF.WEB-DL.DDP5.1.H.265-XDMovies.com.mkv', mimeType: 'video/x-matroska' },
];

/** Real unrelated files seen on the same source must NOT match. */
const UNRELATED = [
  { fileName: '100 (2019) Tamil 720p Proper HQ HDRip @FrediesChannel.mkv', mimeType: 'video/x-matroska' },
  { fileName: 'Agent.Kim.Reactivated.S01E01.720p.NF.WEB-DL.AAC2.0.AV1-XDMovies.com.mkv', mimeType: 'video/x-matroska' },
  { fileName: 'The Wind (2018) [WEBRip] [720p] [YTS.AM].mp4', mimeType: 'video/mp4' },
  { fileName: '96.Minutes.2025.1080p.NF.WEB-DL.DDP5.1.H.264-Archie.mkv', mimeType: 'video/x-matroska' },
  { fileName: '@shinchan_hind.mkv', mimeType: 'video/x-matroska' },
  { fileName: 'Gabriel Iglesias Stadium Fluffy (2022).mp4', mimeType: 'video/mp4' },
  { fileName: '01 - One Name (From Jailer 2) - Anirudh Ravichander.flac', mimeType: 'audio/flac' },
  { fileName: "India's Got Latent", mimeType: 'application/vnd.google-apps.folder' },
];

describe('latent content filter (season 2 only)', () => {
  it.each(REAL_S2_FILES)('matches real S2 file: $fileName', (f) => {
    const v = filterSourceFile(f);
    expect(v.match).toBe(true);
    expect(v.season).toBe(f.season);
    expect(v.episodeNumber).toBe(f.episode);
    expect(v.kind).toBe(f.kind);
    expect(v.evidence.length).toBeGreaterThanOrEqual(3);
  });

  it.each(REAL_S1_FILES)('rejects season-1 file: $fileName', (f) => {
    const v = filterSourceFile(f);
    expect(v.match).toBe(false);
    expect(v.season).toBe(1);
    expect(v.evidence).toContain('exclude:season-1');
  });

  it.each(UNRELATED)('rejects unrelated: $fileName', (f) => {
    expect(filterSourceFile(f).match).toBe(false);
  });

  it('rejects a bare show mention with no corroboration and no video', () => {
    expect(filterSourceFile({ fileName: 'got latent fan notes.txt', mimeType: 'text/plain' }).match).toBe(false);
  });

  it('rejects folders even when named after the show', () => {
    const v = filterSourceFile({
      fileName: "India's.Got.Latent.(2026).S02.Bonus.Ep02.1080p.WEB-DL",
      mimeType: 'application/vnd.google-apps.folder',
    });
    expect(v.match).toBe(false);
    expect(v.evidence).toContain('exclude:folder');
  });

  it('uses folder context as corroboration', () => {
    const v = filterSourceFile({
      fileName: "India's Got Latent S02E07.mkv",
      mimeType: 'video/x-matroska',
      pathSegments: ["India's Got Latent"],
    });
    expect(v.match).toBe(true);
    expect(v.evidence.some((e) => e.startsWith('folder:'))).toBe(true);
  });

  it('detects special kind', () => {
    const v = filterSourceFile({
      fileName: "India's Got Latent S02 Special Reunion.mkv",
      mimeType: 'video/x-matroska',
    });
    expect(v.match).toBe(true);
    expect(v.kind).toBe('special');
  });
});

describe('yuhu entry classifier', () => {
  it('accepts numbered S2 okcdn episodes and bonuses', () => {
    expect(classifyYuhuEntry({ dataId: 's2-06-rakhi', title: 'x', type: 'okcdn' })).toMatchObject({
      usable: true,
      kind: 'episode',
    });
    expect(classifyYuhuEntry({ dataId: 's2-bonus-ep1', title: 'x', type: 'okcdn' })).toMatchObject({
      usable: true,
      kind: 'bonus',
    });
  });

  it('treats youtube-type S2 entries as metadata-only', () => {
    const v = classifyYuhuEntry({ dataId: 's2-05', title: 'x', type: 'youtube' });
    expect(v.usable).toBe(false);
    expect(v.kind).toBe('episode');
    expect(v.reason).toMatch(/metadata-only/);
  });

  it.each(['s2-bts-04', 's2-bonus-clip-01', 's2-stillalive'])('rejects non-episode S2 entry %s', (dataId) => {
    expect(classifyYuhuEntry({ dataId, title: 'x', type: 'okcdn' }).usable).toBe(false);
  });

  it.each(['ep-01', 'bonus-03', 'special-01', 'kapil-01'])('rejects non-S2 entry %s', (dataId) => {
    expect(classifyYuhuEntry({ dataId, title: 'x', type: 'okcdn' }).usable).toBe(false);
  });
});
