// Hersteller-Logos aus der Data.p4k extrahieren (game-sourced, self-hosted).
//
// Zwei Quellen je Hersteller:
//  A) VOLLES Marken-Logo (Emblem + Wortmarke) aus den Rumpf-Brand-Decals unter
//     Data/Textures/Branding/<CODE>/…_logo_stencil / …_decal_stencil — einkanalige
//     Stencil-Masken (DX10 R8/R8G8, teils mip-gesplittet). Manche Decal-Atlanten
//     packen Varianten übereinander -> pro Hersteller ein Crop-Rechteck isoliert
//     das saubere Lockup.
//  B) EMBLEM-Fallback aus Data/UI/SharedAssets/ManufacturerLogos/<Marke>_256.dds
//     (DXT5) — für Marken ohne generisches Brand-Decal (nur schiffsspezifische
//     Decals oder Alien-Marken).
//
// Ausgabe: getrimmte weiß-auf-transparent PNGs unter assets/manufacturers/ +
// Manifest src/data/manufacturer-logos.json (Herstellername -> {file,w,h,full}).
// Kein externes Tool: DXT5- + Stencil-Decoder + PNG-Encoder inline.
// Lauf: node scripts/datamine-manufacturer-logos.mjs   (SC_P4K optional)
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';

// name -> { decal, crop } (volles Logo) ODER { emblem } (Fallback).
// crop = [x0,y0,x1,y1] als Fraktion der getrimmten BBox (default = ganze BBox).
const CFG = {
  'Aegis Dynamics': { decal: 'AEGS/aegs_logo_stencil_02_stencil.dds' },
  'Anvil Aerospace': { decal: 'ANVL/anvl_logo_stencil_02_stencil.dds' },
  'Roberts Space Industries': { decal: 'RSI/rsi_logo_stencil_02_stencil.dds', crop: [0, 0.5, 1, 1] },
  'Origin Jumpworks': { decal: 'ORIG/orig_logo_stencil_stencil.dds', crop: [0, 0.5, 1, 1] },
  'Drake Interplanetary': { decal: 'DRAK/drak_logo_stencil_02_stencil.dds' },
  'Musashi Industrial and Starflight Concern': { decal: 'MISC/misc_logo_stencil_02_stencil.dds', crop: [0, 0.55, 1, 1] },
  'Argo Astronautics': { decal: 'ARGO/ARGO_decal_stencil_stencil.dds', crop: [0, 0, 1, 0.62] },
  'Mirai': { decal: 'MRAI/mrai_logo_stencil_03_stencil.dds', crop: [0, 0.5, 1, 1] },
  'Greycat Industrial': { decal: 'GRIN/grin_logo_stencil_02_stencil.dds' },
  'Consolidated Outland': { decal: 'CNOU/cnou_decal_stencil.dds', crop: [0, 0, 1, 0.75] },
  'Gatac Manufacture': { decal: 'GAMA/gama_logo_stencil_stencil.dds' },
  // Emblem-Fallback (kein sauberes generisches Brand-Decal):
  'Kruger Intergalactic': { emblem: 'Kruger_256.dds' },
  'Esperia': { emblem: 'Esperia_256.dds' },
  'Crusader Industries': { emblem: 'Crusader_256.dds' },
  'Aopoa': { emblem: 'Aopoa_256.dds' },
  'Banu Souli': { emblem: 'Banu_256.dds' },
  'Tumbril Land Systems': { emblem: 'Tumbril_256.dds' },
  "Grey's Market": { emblem: 'GREY_256.dds' },
};

const slug = (n) => n.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- DXT5/BC3 (Emblem-Texturen) -> RGBA ----------------------------------
function decodeDXT5(data, width, height) {
  const out = Buffer.alloc(width * height * 4);
  const bw = width / 4, bh = height / 4;
  let p = 0;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++, p += 16) {
    const a0 = data[p], a1 = data[p + 1], a = [a0, a1];
    if (a0 > a1) for (let i = 1; i <= 6; i++) a.push(Math.round(((7 - i) * a0 + i * a1) / 7));
    else { for (let i = 1; i <= 4; i++) a.push(Math.round(((5 - i) * a0 + i * a1) / 5)); a.push(0, 255); }
    let aBits = 0n; for (let i = 0; i < 6; i++) aBits |= BigInt(data[p + 2 + i]) << BigInt(8 * i);
    const c0 = data.readUInt16LE(p + 8), c1 = data.readUInt16LE(p + 10);
    const col = (c) => { const r = (c >> 11) & 31, g = (c >> 5) & 63, b = c & 31; return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)]; };
    const p0 = col(c0), p1 = col(c1);
    const p2 = [0, 1, 2].map((k) => Math.round((2 * p0[k] + p1[k]) / 3));
    const p3 = [0, 1, 2].map((k) => Math.round((p0[k] + 2 * p1[k]) / 3));
    const pal = [p0, p1, p2, p3], cBits = data.readUInt32LE(p + 12);
    for (let py = 0; py < 4; py++) for (let px = 0; px < 4; px++) {
      const idx = py * 4 + px, ci = (cBits >> (2 * idx)) & 3, ai = Number((aBits >> BigInt(3 * idx)) & 7n);
      const o = ((by * 4 + py) * width + bx * 4 + px) * 4;
      out[o] = pal[ci][0]; out[o + 1] = pal[ci][1]; out[o + 2] = pal[ci][2]; out[o + 3] = a[ai];
    }
  }
  return out;
}

// ---- Emblem (_256 DXT5, ggf. mip-gesplittet) -> RGBA 256x256 --------------
function emblemRGBA(p4k, dir, file) {
  const single = dir.find((x) => x.base.toLowerCase() === file.toLowerCase());
  let dxt;
  if (single && p4k.extract(single.e).length >= 65664) dxt = p4k.extract(single.e).subarray(128, 128 + 65536);
  else { const top = dir.find((x) => x.base.toLowerCase() === (file + '.4').toLowerCase()); dxt = p4k.extract(top.e); }
  return { rgba: decodeDXT5(dxt, 256, 256), w: 256, h: 256 };
}

// ---- Brand-Decal (einkanaliger Stencil, DX10/legacy, mip-split) -> RGBA ---
function parseHdr(b) {
  const h = b.readUInt32LE(12), w = b.readUInt32LE(16), fc = b.toString('ascii', 84, 88), rb = b.readUInt32LE(88);
  let dxgi = null, ds = 128; if (fc === 'DX10') { dxgi = b.readUInt32LE(128); ds = 148; }
  return { w, h, fc, rb, dxgi, ds };
}
function decalRGBA(p4k, entry) {
  const base = p4k.extract(entry), hd = parseHdr(base);
  const bpp = hd.dxgi === 61 ? 1 : hd.dxgi === 49 ? 2 : Math.max(1, Math.round(hd.rb / 8));
  const top = hd.w * hd.h * bpp;
  let data;
  if (base.length - hd.ds >= top) data = base.subarray(hd.ds, hd.ds + top);
  else {
    const mips = p4k.entries(new RegExp(entry.name.replace(/[\\/]/g, '[\\\\/]').replace(/[.]/g, '[.]') + '[.][0-9]+$'));
    const t = mips.map((e) => ({ e, u: e.usize })).sort((a, b) => b.u - a.u)[0];
    data = t ? p4k.extract(t.e) : base.subarray(hd.ds);
  }
  const rgba = Buffer.alloc(hd.w * hd.h * 4);
  for (let i = 0; i < hd.w * hd.h; i++) {
    let v; if (bpp === 1) v = data[i]; else if (bpp === 2) v = Math.max(data[i * 2], data[i * 2 + 1]);
    else if (bpp === 4) v = data[i * 4 + 3]; else v = Math.round((data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2]) / 3);
    rgba[i * 4] = 255; rgba[i * 4 + 1] = 255; rgba[i * 4 + 2] = 255; rgba[i * 4 + 3] = v || 0;
  }
  return { rgba, w: hd.w, h: hd.h };
}

// ---- Crop (Fraktion der Alpha-BBox) + Trim -------------------------------
function bbox(rgba, w, h, th) { let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3] > th) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : [x0, y0, x1, y1]; }
function cropTrim(rgba, w, h, crop, margin = 4, th = 12) {
  let bb = bbox(rgba, w, h, th); if (!bb) return { data: rgba, width: w, height: h };
  if (crop) { const [bx0, by0, bx1, by1] = bb, bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
    const cx0 = bx0 + Math.round(crop[0] * bw), cy0 = by0 + Math.round(crop[1] * bh);
    const cx1 = bx0 + Math.round(crop[2] * bw) - 1, cy1 = by0 + Math.round(crop[3] * bh) - 1;
    // Alpha außerhalb des Crops verwerfen, dann neu trimmen
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < cx0 || x > cx1 || y < cy0 || y > cy1) rgba[(y * w + x) * 4 + 3] = 0;
    bb = bbox(rgba, w, h, th); if (!bb) return { data: rgba, width: w, height: h };
  }
  let [x0, y0, x1, y1] = bb;
  x0 = Math.max(0, x0 - margin); y0 = Math.max(0, y0 - margin); x1 = Math.min(w - 1, x1 + margin); y1 = Math.min(h - 1, y1 + margin);
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1, out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++) rgba.copy(out, y * nw * 4, ((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + nw) * 4);
  return { data: out, width: nw, height: nh };
}

// ---- PNG ------------------------------------------------------------------
const CT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CT[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (ty, d) => { const L = Buffer.alloc(4); L.writeUInt32BE(d.length); const T = Buffer.from(ty); const C = Buffer.alloc(4); C.writeUInt32BE(crc(Buffer.concat([T, d]))); return Buffer.concat([L, T, d, C]); };
function encodePNG(rgba, w, h) { const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); }

// ---- Lauf -----------------------------------------------------------------
const OUT = 'assets/manufacturers';
mkdirSync(OUT, { recursive: true });
const p4k = openP4k(process.env.SC_P4K ?? DEFAULT_P4K);
const emblemDir = p4k.entries(/UI[\\/]SharedAssets[\\/]ManufacturerLogos[\\/][^\\/]+$/i)
  .map((e) => ({ e, base: e.name.replace(/\\/g, '/').split('/').pop() }));

const manifest = {};
const tiles = [];
for (const [name, spec] of Object.entries(CFG)) {
  let img, full = false;
  if (spec.decal) {
    const es = p4k.entries(new RegExp('Textures[\\\\/]Branding[\\\\/]' + spec.decal.replace(/[/]/g, '[\\\\/]').replace(/[.]/g, '[.]') + '$', 'i'));
    if (!es.length) { console.warn('DECAL FEHLT, nutze Emblem:', name, spec.decal); }
    else { img = decalRGBA(p4k, es[0]); full = true; }
  }
  if (!img) {
    const ef = spec.emblem || (name.split(' ')[0] + '_256.dds');
    img = emblemRGBA(p4k, emblemDir, ef);
  }
  const t = cropTrim(img.rgba, img.w, img.h, full ? spec.crop : null);
  const png = encodePNG(t.data, t.width, t.height);
  const outName = slug(name) + '.png';
  writeFileSync(`${OUT}/${outName}`, png);
  manifest[name] = { file: outName, w: t.width, h: t.height, full };
  tiles.push({ data: t.data, w: t.width, h: t.height });
  console.log(`  ${full ? '◆ LOGO ' : '· emblem'} ${name.padEnd(45)} ${t.width}x${t.height}  ${(png.length / 1024).toFixed(1)} KB`);
}
p4k.close();

// Optionaler Review-Kontaktbogen (weiß-auf-dunkel) -> LOGO_SHEET=<pfad>
if (process.env.LOGO_SHEET) {
  const COLS = 3, CW = 340, CH = 150, PAD = 14, rows = Math.ceil(tiles.length / COLS);
  const SW = COLS * CW, SH = rows * CH, sheet = Buffer.alloc(SW * SH * 4);
  for (let i = 0; i < SW * SH; i++) { sheet[i * 4] = 12; sheet[i * 4 + 1] = 14; sheet[i * 4 + 2] = 22; sheet[i * 4 + 3] = 255; }
  tiles.forEach((t, idx) => {
    const cx = (idx % COLS) * CW, cy = Math.floor(idx / COLS) * CH;
    const s = Math.min((CW - 2 * PAD) / t.w, (CH - 2 * PAD) / t.h), dw = Math.round(t.w * s), dh = Math.round(t.h * s);
    const ox = cx + Math.round((CW - dw) / 2), oy = cy + Math.round((CH - dh) / 2);
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const sx = Math.min(t.w - 1, Math.round(x / s)), sy = Math.min(t.h - 1, Math.round(y / s));
      const v = t.data[(sy * t.w + sx) * 4 + 3] / 255, o = ((oy + y) * SW + (ox + x)) * 4;
      sheet[o] = Math.round(255 * v + 12 * (1 - v)); sheet[o + 1] = Math.round(255 * v + 14 * (1 - v)); sheet[o + 2] = Math.round(255 * v + 22 * (1 - v));
    }
  });
  writeFileSync(process.env.LOGO_SHEET, encodePNG(sheet, SW, SH));
  console.log('Kontaktbogen ->', process.env.LOGO_SHEET);
}

writeFileSync('src/data/manufacturer-logos.json', JSON.stringify(manifest, null, 2) + '\n');
const full = Object.values(manifest).filter((m) => m.full).length;
console.log(`\n${Object.keys(manifest).length} Logos (${full} volle Marken-Logos, ${Object.keys(manifest).length - full} Emblem) -> ${OUT}/ + Manifest`);
