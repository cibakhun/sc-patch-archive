// ─────────────────────────────────────────────────────────────────────────
//  make-icon.mjs — generates the VerseBase server icon (512×512 PNG)
//
//  Zero dependencies. Renders the site's hexagon-ring mark (public/favicon.svg)
//  with a soft cyan glow using a tiny signed-distance-field renderer, 4×4
//  supersampled for clean anti-aliasing, then encodes a PNG by hand via the
//  built-in `zlib`. Output: assets/verse-base-icon.png
//
//  Run:  npm run icon   (or: node make-icon.mjs)
// ─────────────────────────────────────────────────────────────────────────
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const S = 512;   // output size
const SS = 4;    // supersampling factor (4×4 samples per pixel)

// Brand palette (from the site's :root vars)
const CYAN = [45, 212, 255];    // --accent  #2dd4ff
const CYAN_HI = [173, 240, 255]; // brightened core
const BG_INNER = [15, 26, 46];   // subtle navy glow behind the mark
const BG_OUTER = [4, 6, 12];     // --bg #04060c

// Hexagon vertices — favicon path (0..64 grid) scaled to 512, then inset a touch.
const CX = S / 2, CY = S / 2;
const HEX = [
  [32, 8], [52, 20], [52, 44], [32, 56], [12, 44], [12, 20],
].map(([x, y]) => [x / 64 * S, y / 64 * S]);

const STROKE_HALF = 15;   // half of the ring stroke width (px)
const DOT_R = 34;         // centre node radius (px)
const RING_GLOW = 46;     // glow falloff around the ring (px)
const DOT_GLOW = 120;     // glow falloff around the centre (px)

// ── geometry helpers ──────────────────────────────────────────────────────
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function distToHexOutline(px, py) {
  let d = Infinity;
  for (let i = 0; i < HEX.length; i++) {
    const [ax, ay] = HEX[i];
    const [bx, by] = HEX[(i + 1) % HEX.length];
    d = Math.min(d, distToSegment(px, py, ax, ay, bx, by));
  }
  return d;
}
const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v) | 0;

// ── shade a single sample point → [r,g,b] ─────────────────────────────────
function shade(x, y) {
  const dc = Math.hypot(x - CX, y - CY);        // distance to centre
  const dRing = distToHexOutline(x, y);          // distance to hexagon outline

  // Background: radial navy → near-black
  const bgT = clamp01(dc / (0.62 * S));
  let r = mix(BG_INNER[0], BG_OUTER[0], bgT);
  let g = mix(BG_INNER[1], BG_OUTER[1], bgT);
  let b = mix(BG_INNER[2], BG_OUTER[2], bgT);

  // Additive glow — ring halo + centre halo
  const ringGlow = Math.exp(-Math.max(0, dRing - STROKE_HALF) / RING_GLOW);
  const dotGlow = Math.exp(-dc / DOT_GLOW);
  const glow = clamp01(ringGlow * 0.75 + dotGlow * 0.5);
  r += CYAN[0] * glow * 0.55;
  g += CYAN[1] * glow * 0.55;
  b += CYAN[2] * glow * 0.55;

  // Ring stroke (solid), with a slight inner-brighten toward the top vertex
  if (dRing <= STROKE_HALF) {
    const k = clamp01(1 - dRing / STROKE_HALF) * 0.35;
    r = mix(CYAN[0], CYAN_HI[0], k);
    g = mix(CYAN[1], CYAN_HI[1], k);
    b = mix(CYAN[2], CYAN_HI[2], k);
  }

  // Centre node (bright core)
  if (dc <= DOT_R) {
    const k = clamp01(1 - dc / DOT_R);
    r = mix(CYAN[0], CYAN_HI[0], 0.35 + 0.5 * k);
    g = mix(CYAN[1], CYAN_HI[1], 0.35 + 0.5 * k);
    b = mix(CYAN[2], CYAN_HI[2], 0.35 + 0.5 * k);
  }

  return [r, g, b];
}

// ── render (supersampled) → RGB buffer ────────────────────────────────────
function render() {
  const rgb = Buffer.alloc(S * S * 3);
  const inv = 1 / (SS * SS);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          const c = shade(x, y);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const o = (py * S + px) * 3;
      rgb[o] = clamp255(r * inv);
      rgb[o + 1] = clamp255(g * inv);
      rgb[o + 2] = clamp255(b * inv);
    }
  }
  return rgb;
}

// ── PNG encoding (truecolor, no alpha) ────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: 2 = truecolor RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  // raw scanlines, each prefixed with filter byte 0 (None)
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── main ──────────────────────────────────────────────────────────────────
const rgb = render();
const png = encodePNG(S, S, rgb);
const outDir = join(__dirname, 'assets');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'verse-base-icon.png');
writeFileSync(outPath, png);
console.log(`✓ Wrote ${outPath} (${S}×${S}, ${(png.length / 1024).toFixed(1)} KB)`);
