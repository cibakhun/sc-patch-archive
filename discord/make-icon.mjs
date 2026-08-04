// ─────────────────────────────────────────────────────────────────────────
//  make-icon.mjs — generates the VerseBase server icon (512×512 PNG)
//
//  Zero dependencies. Renders the site's hexagon-ring mark (public/favicon.svg)
//  with a soft cyan glow using the shared signed-distance-field rasteriser
//  (lib/raster.mjs), 4×4 supersampled for clean anti-aliasing, then encodes a
//  PNG by hand (lib/png.mjs). Output: assets/verse-base-icon.png
//
//  The bot's own profile picture is a separate mark — see make-avatar.mjs.
//
//  Run:  npm run icon   (or: node make-icon.mjs)
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { encodePNG } from './lib/png.mjs';
import { brandHex, distToOutline, mix, clamp01, render } from './lib/raster.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const S = 512;   // output size
const SS = 4;    // supersampling factor (4×4 samples per pixel)

// Brand palette (from the site's :root vars)
const CYAN = [45, 212, 255];    // --accent  #2dd4ff
const CYAN_HI = [173, 240, 255]; // brightened core
const BG_INNER = [15, 26, 46];   // subtle navy glow behind the mark
const BG_OUTER = [4, 6, 12];     // --bg #04060c

// Hexagon vertices — the favicon path scaled to the output size.
const CX = S / 2, CY = S / 2;
const HEX = brandHex(S);

const STROKE_HALF = 15;   // half of the ring stroke width (px)
const DOT_R = 34;         // centre node radius (px)
const RING_GLOW = 46;     // glow falloff around the ring (px)
const DOT_GLOW = 120;     // glow falloff around the centre (px)

// ── shade a single sample point → [r,g,b] ─────────────────────────────────
function shade(x, y) {
  const dc = Math.hypot(x - CX, y - CY);        // distance to centre
  const dRing = distToOutline(x, y, HEX);        // distance to hexagon outline

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

// ── main ──────────────────────────────────────────────────────────────────
const rgb = render(S, S, SS, shade);
const png = encodePNG(S, S, rgb);
const outDir = join(__dirname, 'assets');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'verse-base-icon.png');
writeFileSync(outPath, png);
console.log(`✓ Wrote ${outPath} (${S}×${S}, ${(png.length / 1024).toFixed(1)} KB)`);
