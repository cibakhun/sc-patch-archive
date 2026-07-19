// Hersteller-Logos aus der Data.p4k extrahieren (game-sourced, self-hosted).
//
// Quelle: Data/UI/SharedAssets/ManufacturerLogos/<Marke>_256.dds — die
// offiziellen 256×256-UI-Logos (DXT5/BC3). Ausgabe: getrimmte PNGs unter
// assets/manufacturers/ + Manifest src/data/manufacturer-logos.json
// (Herstellername → Datei/Maße), das der Renderer nutzt (Logo statt Text,
// mit Text-Fallback, wenn keine Marke gemappt ist).
//
// Kein externes Tool/keine DDS-Lib: DXT5-Decoder + minimaler PNG-Encoder inline.
// Lauf: node scripts/datamine-manufacturer-logos.mjs   (SC_P4K optional)
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';

// 18 Schiffs-Hersteller (exakter Klarname aus vehicles.json) -> Logo-Dateistamm.
const MANUFACTURERS = [
  ['Aegis Dynamics', 'Aegis_256.dds'],
  ['Anvil Aerospace', 'Anvil_256.dds'],
  ['Roberts Space Industries', 'RSI_256.dds'],
  ['Origin Jumpworks', 'Origin_256.dds'],
  ['Musashi Industrial and Starflight Concern', 'MISC_256.dds'],
  ['Mirai', 'Mirai_256.dds'],
  ['Argo Astronautics', 'Argo_256.dds'],
  ['Drake Interplanetary', 'Drake_256.dds'],
  ['Crusader Industries', 'Crusader_256.dds'],
  ['Consolidated Outland', 'Consolidated_256.dds'],
  ['Esperia', 'Esperia_256.dds'],
  ['Greycat Industrial', 'Greycat_256.dds'],
  ['Kruger Intergalactic', 'Kruger_256.dds'],
  ['Aopoa', 'Aopoa_256.dds'],
  ['Gatac Manufacture', 'Gatac_256.dds'],
  ['Banu Souli', 'Banu_256.dds'],
  ['Tumbril Land Systems', 'Tumbril_256.dds'],
  ["Grey's Market", 'GREY_256.dds'],
];

const slug = (name) =>
  name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- DXT5 / BC3 Decoder (16-Byte-Blöcke, 4×4) -> RGBA8 --------------------
function decodeDXT5(data, width, height) {
  const out = Buffer.alloc(width * height * 4);
  const bw = width / 4, bh = height / 4;
  let p = 0;
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++, p += 16) {
      // Alpha (BC4): a0,a1 + 16×3-Bit-Indizes
      const a0 = data[p], a1 = data[p + 1];
      const a = [a0, a1];
      if (a0 > a1) for (let i = 1; i <= 6; i++) a.push(Math.round(((7 - i) * a0 + i * a1) / 7));
      else { for (let i = 1; i <= 4; i++) a.push(Math.round(((5 - i) * a0 + i * a1) / 5)); a.push(0, 255); }
      let aBits = 0n;
      for (let i = 0; i < 6; i++) aBits |= BigInt(data[p + 2 + i]) << BigInt(8 * i);
      // Farbe (BC1, immer 4-Farb-Modus bei DXT5)
      const c0 = data.readUInt16LE(p + 8), c1 = data.readUInt16LE(p + 10);
      const col = (c) => {
        const r = (c >> 11) & 0x1f, g = (c >> 5) & 0x3f, b = c & 0x1f;
        return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
      };
      const p0 = col(c0), p1 = col(c1);
      const p2 = [0, 1, 2].map((k) => Math.round((2 * p0[k] + p1[k]) / 3));
      const p3 = [0, 1, 2].map((k) => Math.round((p0[k] + 2 * p1[k]) / 3));
      const pal = [p0, p1, p2, p3];
      const cBits = data.readUInt32LE(p + 12);
      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const idx = py * 4 + px;
          const ci = (cBits >> (2 * idx)) & 0x3;
          const ai = Number((aBits >> BigInt(3 * idx)) & 0x7n);
          const x = bx * 4 + px, y = by * 4 + py;
          const o = (y * width + x) * 4;
          out[o] = pal[ci][0]; out[o + 1] = pal[ci][1]; out[o + 2] = pal[ci][2]; out[o + 3] = a[ai];
        }
      }
    }
  }
  return out;
}

// ---- Auf sichtbaren Inhalt zuschneiden (Alpha-BBox + kleiner Rand) --------
function trim(rgba, width, height, margin = 3, aThresh = 12) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (rgba[(y * width + x) * 4 + 3] > aThresh) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  if (x1 < 0) return { data: rgba, width, height }; // komplett leer -> unverändert
  x0 = Math.max(0, x0 - margin); y0 = Math.max(0, y0 - margin);
  x1 = Math.min(width - 1, x1 + margin); y1 = Math.min(height - 1, y1 + margin);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    rgba.copy(out, y * w * 4, ((y0 + y) * width + x0) * 4, ((y0 + y) * width + x0 + w) * 4);
  return { data: out, width: w, height: h };
}

// ---- Minimaler PNG-Encoder (RGBA8) ---------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // Filter 0 (none)
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Lauf ----------------------------------------------------------------
const OUT_DIR = 'assets/manufacturers';
mkdirSync(OUT_DIR, { recursive: true });
const p4k = openP4k(process.env.SC_P4K ?? DEFAULT_P4K);
const dir = p4k.entries(/UI[\\/]SharedAssets[\\/]ManufacturerLogos[\\/][^\\/]+$/i)
  .map((e) => ({ e, base: e.name.replace(/\\/g, '/').split('/').pop() }));

const manifest = {};
for (const [name, file] of MANUFACTURERS) {
  const single = dir.find((x) => x.base.toLowerCase() === file.toLowerCase());
  let dxt;
  if (single && p4k.extract(single.e).length >= 65664) {
    dxt = p4k.extract(single.e).subarray(128, 128 + 65536); // 128-Byte-DDS-Header
  } else {
    // Mip-Split: höchste Auflösung liegt in <file>.4 (256×256-Top-Mip, kein Header)
    const top = dir.find((x) => x.base.toLowerCase() === (file + '.4').toLowerCase());
    if (!top) { console.warn('FEHLT:', name, file); continue; }
    dxt = p4k.extract(top.e);
  }
  const rgba = decodeDXT5(dxt, 256, 256);
  const t = trim(rgba, 256, 256);
  const png = encodePNG(t.data, t.width, t.height);
  const outName = slug(name) + '.png';
  writeFileSync(`${OUT_DIR}/${outName}`, png);
  manifest[name] = { file: outName, w: t.width, h: t.height };
  console.log(`  ✓ ${name.padEnd(45)} ${t.width}x${t.height}  ${(png.length / 1024).toFixed(1)} KB`);
}
p4k.close();

writeFileSync('src/data/manufacturer-logos.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${Object.keys(manifest).length}/${MANUFACTURERS.length} Logos -> ${OUT_DIR}/ + src/data/manufacturer-logos.json`);
