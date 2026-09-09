#!/usr/bin/env node
/**
 * probe-source.mjs — one-shot source inspection tool for LATENT VAULT.
 *
 * Used during the manual "add the new episode" workflow to:
 *   1. search index.csbots.live for a file by exact name
 *   2. resolve a fresh playable link via the fallback endpoint
 *   3. HEAD the media (MIME, size, range support)
 *   4. parse real duration / resolution / codecs from MP4 (ISO-BMFF) or MKV (EBML) headers
 *      using small HTTP Range requests — never downloads whole files.
 *
 * This runs on the operator machine at catalogue-authoring time. It is NOT
 * part of the production runtime.
 *
 * Usage:
 *   node scripts/probe-source.mjs "<exact file name>"
 *   node scripts/probe-source.mjs --search "<query>"
 */

const SRC = 'https://index.csbots.live';
const UA = 'Mozilla/5.0 (compatible; latent-vault-probe/1.0)';

async function postJson(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}`);
  return res.json();
}

async function getRange(url, start, end) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Range: `bytes=${start}-${end}` },
  });
  if (res.status !== 206 && res.status !== 200) {
    throw new Error(`Range request -> ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, status: res.status, headers: res.headers };
}

/* ---------------- MP4 (ISO-BMFF) parsing ---------------- */

function mp4Children(buf, base, end) {
  const out = [];
  let p = base;
  while (p + 8 <= end && p + 8 <= buf.length) {
    let sz = buf.readUInt32BE(p);
    const ty = buf.subarray(p + 4, p + 8).toString('latin1');
    let h = 8;
    if (sz === 1) {
      if (p + 16 > buf.length) break;
      sz = Number(buf.readBigUInt64BE(p + 8));
      h = 16;
    } else if (sz === 0) {
      sz = end - p;
    }
    if (sz < 8) break;
    out.push({ ty, p, sz, h });
    p += sz;
  }
  return out;
}

async function probeMp4(url, total) {
  const head = (await getRange(url, 0, 65535)).buf;
  let moov = null;
  for (const { ty, p, sz } of mp4Children(head, 0, head.length)) {
    if (ty === 'moov') moov = (await getRange(url, p, p + sz - 1)).buf;
  }
  if (!moov) {
    const tailSize = 5000000;
    const tail = (await getRange(url, Math.max(0, total - tailSize), total - 1)).buf;
    const idx = tail.indexOf(Buffer.from('moov'));
    if (idx < 4) return { error: 'moov not found in tail' };
    moov = tail.subarray(idx - 4);
  }
  const msz = moov.readUInt32BE(0);
  const info = { container: 'mp4', tracks: [] };
  for (const { ty, p, sz, h } of mp4Children(moov, 8, Math.min(msz, moov.length))) {
    if (ty === 'mvhd') {
      const ver = moov[p + 8];
      let ts, dur;
      if (ver === 1) {
        ts = moov.readUInt32BE(p + 28);
        dur = Number(moov.readBigUInt64BE(p + 32));
      } else {
        ts = moov.readUInt32BE(p + 20);
        dur = moov.readUInt32BE(p + 24);
      }
      info.duration_s = ts ? dur / ts : null;
    }
    if (ty === 'trak') {
      const t = {};
      for (const t2 of mp4Children(moov, p + h, Math.min(p + sz, moov.length))) {
        if (t2.ty === 'mdia') {
          for (const t3 of mp4Children(moov, t2.p + t2.h, Math.min(t2.p + t2.sz, moov.length))) {
            if (t3.ty === 'mdhd') {
              const ver = moov[t3.p + 8];
              let ts, dur;
              if (ver === 1) {
                ts = moov.readUInt32BE(t3.p + 28);
                dur = Number(moov.readBigUInt64BE(t3.p + 32));
              } else {
                ts = moov.readUInt32BE(t3.p + 20);
                dur = moov.readUInt32BE(t3.p + 24);
              }
              t.duration_s = ts ? dur / ts : null;
            }
            if (t3.ty === 'hdlr') t.handler = moov.subarray(t3.p + 16, t3.p + 20).toString('latin1');
            if (t3.ty === 'minf') {
              const blob = moov.subarray(t3.p, Math.min(t3.p + t3.sz, moov.length));
              for (const cc of ['avc1', 'hev1', 'hvc1', 'av01', 'mp4a', 'ac-3', 'ec-3', 'opus']) {
                const at = blob.indexOf(Buffer.from(cc));
                if (at >= 4) {
                  t.codec = cc;
                  // visual sample entry: width/height at entry+32/+34
                  const entry = at - 4;
                  if (['avc1', 'hev1', 'hvc1', 'av01'].includes(cc) && entry + 36 <= blob.length) {
                    t.width = blob.readUInt16BE(entry + 32);
                    t.height = blob.readUInt16BE(entry + 34);
                  }
                  break;
                }
              }
            }
          }
        }
      }
      info.tracks.push(t);
    }
  }
  return info;
}

/* ---------------- MKV (EBML) parsing ---------------- */

function readVint(buf, pos, isId) {
  if (pos >= buf.length) return null;
  const b = buf[pos];
  if (b === 0) return null;
  let n = 0;
  let mask = 0x80;
  while (n < 8 && !(b & mask)) {
    mask >>= 1;
    n++;
  }
  const ln = n + 1;
  if (pos + ln > buf.length) return null;
  const raw = buf.subarray(pos, pos + ln);
  let val;
  if (isId) {
    val = 0;
    for (const x of raw) val = val * 256 + x;
  } else {
    val = raw[0] & (mask - 1);
    for (let i = 1; i < raw.length; i++) val = val * 256 + raw[i];
    if (val === 2 ** (7 * ln) - 1) val = -1;
  }
  return [val, ln];
}

const CONTAINERS = new Set([0x1a45dfa3, 0x18538067, 0x1549a966, 0x1654ae6b, 0xae, 0xe0, 0xe1, 0x114d9b74, 0x1941a469]);

function ebmlParse(buf, start, end, depth = 0) {
  const out = [];
  let pos = start;
  let guard = 0;
  while (pos < end && pos < buf.length && guard++ < 4000) {
    const r = readVint(buf, pos, true);
    if (!r) break;
    const [eid, ll] = r;
    pos += ll;
    const r2 = readVint(buf, pos, false);
    if (!r2) break;
    let [size, ls] = r2;
    pos += ls;
    if (size === -1) size = end - pos;
    size = Math.min(size, end - pos);
    out.push([eid, pos, size, depth]);
    if (CONTAINERS.has(eid) && size > 0) out.push(...ebmlParse(buf, pos, pos + size, depth + 1));
    pos += size;
  }
  return out;
}

async function probeMkv(url) {
  const head = (await getRange(url, 0, 3000000 - 1)).buf;
  const els = ebmlParse(head, 0, head.length);
  const info = { container: 'mkv', timescale: 1000000, tracks: [] };
  let cur = null;
  for (const [eid, pos, size, depth] of els) {
    try {
      if (eid === 0x2ad7b1 && size <= 8) {
        info.timescale = parseInt(head.subarray(pos, pos + size).toString('hex'), 16);
      } else if (eid === 0x4489 && depth <= 3 && (size === 4 || size === 8)) {
        const raw = head.subarray(pos, pos + size);
        info.duration_raw = size === 4 ? raw.readFloatBE(0) : raw.readDoubleBE(0);
      } else if (eid === 0xae && depth <= 3) {
        cur = { _d: depth };
        info.tracks.push(cur);
      } else if (cur && depth === cur._d + 1) {
        if (eid === 0xd7) cur.num = parseInt(head.subarray(pos, pos + size).toString('hex'), 16);
        else if (eid === 0x83) cur.type = parseInt(head.subarray(pos, pos + size).toString('hex'), 16);
        else if (eid === 0x86) cur.codec = head.subarray(pos, pos + size).toString('utf-8');
        else if (eid === 0xb0) cur.w = parseInt(head.subarray(pos, pos + size).toString('hex'), 16);
        else if (eid === 0xba) cur.h = parseInt(head.subarray(pos, pos + size).toString('hex'), 16);
        else if (eid === 0xe1) {
          // video sub-element: pixel dims live one level deeper
        }
      } else if (cur && depth === cur._d + 2) {
        if (eid === 0xb0) cur.w = parseInt(head.subarray(pos, pos + size).toString('hex'), 16);
        else if (eid === 0xba) cur.h = parseInt(head.subarray(pos, pos + size).toString('hex'), 16);
      }
    } catch {
      /* ignore malformed tails */
    }
  }
  for (const t of info.tracks) delete t._d;
  if (info.duration_raw != null) info.duration_s = (info.duration_raw * info.timescale) / 1e9;
  return info;
}

/* ---------------- driver ---------------- */

async function searchExact(name) {
  const res = await postJson(`${SRC}/0:search`, { q: 'latent', page_token: null, page_index: 0 });
  const files = (res.data && res.data.files) || [];
  return files.find((f) => f.name === name) || null;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--search' && args[1]) {
    const res = await postJson(`${SRC}/0:search`, { q: args[1], page_token: null, page_index: 0 });
    const files = (res.data && res.data.files) || [];
    console.log(`query=${JSON.stringify(args[1])} results=${files.length} next=${res.nextPageToken}`);
    for (const f of files) console.log(`- ${f.mimeType} ${f.size || '-'} ${f.name}`);
    return;
  }
  const name = args[0];
  if (!name) {
    console.error('Usage: node scripts/probe-source.mjs "<exact file name>" | --search "<query>"');
    process.exit(1);
  }
  const hit = await searchExact(name);
  if (!hit) {
    console.error('NOT FOUND on source');
    process.exit(2);
  }
  console.log(JSON.stringify({ name: hit.name, size: hit.size, mimeType: hit.mimeType, modifiedTime: hit.modifiedTime }, null, 2));
  const fb = await postJson(`${SRC}/0:fallback`, { id: hit.id });
  const link = `${SRC}${fb.link}`;
  const total = Number(fb.size || hit.size);
  console.log(`link_ok=true size=${total} mime=${fb.mimeType}`);

  // HEAD check
  const headRes = await fetch(link, { method: 'HEAD', headers: { 'User-Agent': UA } });
  console.log(
    `head status=${headRes.status} content-type=${headRes.headers.get('content-type')} content-length=${headRes.headers.get('content-length')}`,
  );
  const r0 = await fetch(link, { headers: { 'User-Agent': UA, Range: 'bytes=0-0' } });
  console.log(`range0 status=${r0.status} content-range=${r0.headers.get('content-range')}`);

  const info = name.endsWith('.mp4') ? await probeMp4(link, total) : await probeMkv(link);
  console.log(JSON.stringify(info, null, 2));
}

main().catch((e) => {
  console.error('probe failed:', e);
  process.exit(1);
});
