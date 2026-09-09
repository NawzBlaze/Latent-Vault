#!/usr/bin/env node
/**
 * make-posters.mjs — deterministic editorial artwork for every catalogue item.
 *
 * The source provides no artwork, so the archive ships its own honest,
 * typographic key art (gold-on-ink, serif numerals). Nothing here pretends
 * to be a photograph or an official thumbnail.
 *
 * Mirror of src/catalog/catalogue.ts display facts. When adding an episode,
 * extend EPISODES below and re-run:  node scripts/make-posters.mjs
 * A test fails the build if a published item lacks its poster files.
 *
 * Output per item:
 *   public/posters/<slug>.svg        640x400 card art (self-contained)
 *   public/posters/<slug>-hero.svg   1600x640 cinematic backdrop (atmospheric)
 *   public/posters/<slug>-m.svg      900x1000 portrait art for mobile hero
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'posters');
mkdirSync(OUT, { recursive: true });

const EPISODES = [
  { slug: 's2-e1', season: 2, ep: 1, kind: 'episode', guests: ['Alia Bhatt', 'Sharvari', 'Ashish Solanki'], unavailable: true },
  { slug: 's2-e2', season: 2, ep: 2, kind: 'episode', guests: ['Harssh Limbachiya', 'Kiku Sharda', 'Chandan Prabhakar'], unavailable: true },
  { slug: 's2-e3', season: 2, ep: 3, kind: 'episode', guests: ['Raghu Ram', 'Vishal Dadlani', 'Tanmay Bhat', 'Yashraj'], runtime: '54 min', quality: '1080p' },
  { slug: 's2-e4', season: 2, ep: 4, kind: 'episode', guests: ['Karan Aujla', 'Tanmay Bhat', 'Gurleen Pannu', 'Rahul Dua'], runtime: '55 min', quality: '1080p' },
  { slug: 's2-e5', season: 2, ep: 5, kind: 'episode', guests: ['Orry', 'Archana Puran Singh', 'Sharon Verma', 'Nishant Suri'], runtime: '55 min', quality: '1080p' },
  { slug: 's2-e6', season: 2, ep: 6, kind: 'episode', guests: ['Rakhi Sawant', 'Ashneer Grover', 'Kushagra Srivastava'], runtime: '52 min', quality: '1080p' },
  { slug: 's2-bonus-e1', season: 2, ep: 1, kind: 'bonus', guests: ['Raghav Juyal', 'Munawar Faruqui', 'Niharika NM', 'Rohan Joshi'], runtime: '57 min', quality: '1080p' },
  { slug: 's2-bonus-e2', season: 2, ep: 2, kind: 'bonus', guests: ['Badshah', 'Sourav Joshi', 'Haarsh Limbachiyaa', 'Rajat Sood'], runtime: '40 min', quality: '1080p' },
  { slug: 's2-bonus-e3', season: 2, ep: 3, kind: 'bonus', guests: ['Varun Dhawan', 'Medha Shankar', 'Sharon Verma', 'Nishant Tanwar'], runtime: '44 min', quality: '1080p' },
];

const INK = '#0d0b07';
const INK2 = '#14110a';
const GOLD = '#d2a94f';
const GOLD_DIM = '#9a7a35';
const CREAM = '#efe6d4';
const MUTED = '#8d8471';

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Verdana, sans-serif";

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function frame(w, h, inset) {
  return `<rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" fill="none" stroke="${GOLD}" stroke-width="1" opacity="0.45"/>
  <rect x="${inset + 5}" y="${inset + 5}" width="${w - inset * 2 - 10}" height="${h - inset * 2 - 10}" fill="none" stroke="${GOLD}" stroke-width="0.5" opacity="0.22"/>`;
}

function vignette(id, w, h) {
  return `<defs><radialGradient id="${id}" cx="50%" cy="38%" r="85%">
    <stop offset="0%" stop-color="${INK2}"/><stop offset="62%" stop-color="${INK}"/><stop offset="100%" stop-color="#070604"/>
  </radialGradient></defs><rect width="${w}" height="${h}" fill="url(#${id})"/>`;
}

function arch(cx, baseY, w, h, opacity) {
  const r = w / 2;
  const topY = baseY - h;
  const springY = topY + r;
  return `<g fill="none" stroke="${GOLD}" opacity="${opacity}">
    <path d="M ${cx - r} ${baseY} V ${springY} A ${r} ${r} 0 0 1 ${cx + r} ${springY} V ${baseY}" stroke-width="2"/>
    <path d="M ${cx - r + 14} ${baseY} V ${springY} A ${r - 14} ${r - 14} 0 0 1 ${cx + r - 14} ${springY} V ${baseY}" stroke-width="1"/>
  </g>`;
}

function ticks(w, y, opacity) {
  // film-sprocket-esque side ticks, very subtle
  let s = `<g fill="${GOLD}" opacity="${opacity}">`;
  for (let x = 28; x < w - 20; x += 26) s += `<rect x="${x}" y="${y}" width="10" height="3" rx="1"/>`;
  return s + '</g>';
}

function badge(x, y, text) {
  const w = text.length * 8.4 + 26;
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="26" fill="none" stroke="${GOLD}" opacity="0.8"/>
    <text x="${x + w / 2}" y="${y + 17.5}" text-anchor="middle" font-family="${SANS}" font-size="12" letter-spacing="3" fill="${GOLD}">${esc(text)}</text>
  </g>`;
}

function card(e) {
  const W = 640, H = 400;
  const num = String(e.ep).padStart(2, '0');
  const kindLabel = e.kind === 'bonus' ? 'BONUS' : 'EPISODE';
  const isBonus = e.kind === 'bonus';
  const guestLine = e.guests.length ? e.guests.join('  ·  ') : null;
  const gSize = guestLine && guestLine.length > 60 ? 15 : 20;
  const numFill = e.unavailable ? MUTED : isBonus ? CREAM : GOLD;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="India's Got Latent season ${e.season} ${kindLabel.toLowerCase()} ${e.ep}">
  ${vignette('cv' + e.slug, W, H)}
  ${arch(W / 2, H + 40, 460, 420, 0.10)}
  ${frame(W, H, 14)}
  ${ticks(W, 30, 0.28)}
  <text x="${W / 2}" y="${guestLine ? 208 : 222}" text-anchor="middle" font-family="${SERIF}" font-size="118" fill="${numFill}" letter-spacing="2">${num}</text>
  <text x="${W / 2}" y="${guestLine ? 244 : 258}" text-anchor="middle" font-family="${SANS}" font-size="13" letter-spacing="6" fill="${MUTED}">${kindLabel}</text>
  ${guestLine ? `<text x="${W / 2}" y="292" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="${gSize}" fill="${CREAM}">${esc(guestLine)}</text>` : ''}
  <text x="${W / 2}" y="${guestLine ? 326 : 308}" text-anchor="middle" font-family="${SANS}" font-size="11.5" letter-spacing="3" fill="${GOLD_DIM}">${e.unavailable ? 'SEASON ' + e.season + ' · NOT CURRENTLY AVAILABLE' : 'SEASON ' + e.season + ' · ' + e.quality + ' · ' + esc(e.runtime.toUpperCase())}</text>
  ${ticks(W, H - 34, 0.28)}
</svg>`;
}

function hero(e) {
  const W = 1600, H = 640;
  const num = String(e.ep).padStart(2, '0');
  // Atmospheric: oversized numeral right, arch left. HTML overlays all text.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Artwork for season ${e.season} episode ${e.ep}">
  ${vignette('hv' + e.slug, W, H)}
  ${arch(330, H + 60, 560, 640, 0.19)}
  ${arch(330, H + 60, 380, 560, 0.12)}
  <text x="${W - 90}" y="${H - 60}" text-anchor="end" font-family="${SERIF}" font-size="560" fill="${GOLD}" opacity="0.22">${num}</text>
  <text x="${W - 96}" y="${H - 66}" text-anchor="end" font-family="${SERIF}" font-size="560" fill="none" stroke="${GOLD}" stroke-width="1.5" opacity="0.45">${num}</text>
  ${frame(W, H, 22)}
  <rect x="120" y="150" width="52" height="2" fill="${GOLD}" opacity="0.8"/>
  <rect x="120" y="150" width="26" height="2" fill="${CREAM}" opacity="0.9"/>
</svg>`;
}

function portrait(e) {
  const W = 900, H = 1100;
  const num = String(e.ep).padStart(2, '0');
  const kindLabel = e.kind === 'bonus' ? 'BONUS' : 'EPISODE';
  const guestLine = e.guests.length ? e.guests.join(' · ') : null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Artwork for season ${e.season} episode ${e.ep}">
  ${vignette('pv' + e.slug, W, H)}
  ${arch(W / 2, H * 0.62, 560, 560, 0.14)}
  ${frame(W, H, 20)}
  ${ticks(W, 44, 0.25)}
  <text x="${W / 2}" y="120" text-anchor="middle" font-family="${SANS}" font-size="17" letter-spacing="7" fill="${GOLD}">INDIA’S GOT LATENT</text>
  <text x="${W / 2}" y="470" text-anchor="middle" font-family="${SERIF}" font-size="330" fill="${GOLD}">${num}</text>
  <text x="${W / 2}" y="540" text-anchor="middle" font-family="${SANS}" font-size="19" letter-spacing="10" fill="${MUTED}">${kindLabel} ${num}</text>
  <text x="${W / 2}" y="620" text-anchor="middle" font-family="${SANS}" font-size="16" letter-spacing="5" fill="${GOLD_DIM}">${e.unavailable ? 'SEASON ' + e.season + ' · NOT AVAILABLE' : 'SEASON ' + e.season + ' · ' + e.quality}</text>
  ${guestLine ? `<text x="${W / 2}" y="690" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="27" fill="${CREAM}">${esc(guestLine.length > 52 ? guestLine.slice(0, 50) + '…' : guestLine)}</text>` : ''}
  <rect x="${W / 2 - 40}" y="800" width="80" height="2" fill="${GOLD}" opacity="0.7"/>
  <text x="${W / 2}" y="${H - 90}" text-anchor="middle" font-family="${SANS}" font-size="15" letter-spacing="6" fill="${MUTED}">LATENT VAULT ARCHIVE</text>
  ${ticks(W, H - 48, 0.25)}
</svg>`;
}

for (const e of EPISODES) {
  writeFileSync(join(OUT, `${e.slug}.svg`), card(e));
  writeFileSync(join(OUT, `${e.slug}-hero.svg`), hero(e));
  writeFileSync(join(OUT, `${e.slug}-m.svg`), portrait(e));
  console.log('wrote', e.slug);
}
