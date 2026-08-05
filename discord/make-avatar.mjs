// ═════════════════════════════════════════════════════════════════════════
//  make-avatar.mjs — generates Verse-Bot's profile picture (512×512 PNG).
//
//  Zero dependencies (lib/raster.mjs + lib/png.mjs). Discord crops avatars to
//  a circle and renders them as small as 32 px in the member list, so every
//  variant here keeps its mark well inside the inscribed circle and is built
//  from at most three shapes. All of them wear the site's hexagon so the bot
//  reads as part of VerseBase, and add amber — the rank ladder's own accent
//  (Ace, #f5a524) — so the bot is never mistaken for the server icon itself.
//
//    npm run avatar                     → assets/verse-bot-avatar.png (xp-ring)
//    npm run avatar -- ladder           → same file, different variant
//    npm run avatar -- --all            → every variant side by side, plus a
//                                         contact sheet showing each one
//                                         circle-cropped at 256/128/64/32 px
//
//  Then put it on the bot with `npm run avatar:apply` (set-avatar.mjs).
// ═════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { encodePNG } from './lib/png.mjs';
import {
  brandHex, distToOutline, distToArc, mix, mixRgb, clamp01, render,
} from './lib/raster.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TAU = Math.PI * 2;

const S = 512;        // avatar size Discord stores (it downsamples from here)
const SS = 4;         // supersampling for the avatar itself
const SHEET_SS = 3;   // …and for the preview sheet

// ── palette (the site's :root vars / blueprint.mjs C) ─────────────────────
const CYAN = [45, 212, 255];      // --accent   #2dd4ff
const CYAN_HI = [173, 240, 255];
const CYAN_DIM = [26, 122, 150];
const AMBER = [245, 165, 36];     // C.missionAmber #f5a524 — rank Ace
const AMBER_HI = [255, 221, 150];
const BG_INNER = [15, 26, 46];    // navy glow behind the mark
const BG_OUTER = [4, 6, 12];      // --bg #04060c
const SHEET_BG = [49, 51, 56];    // Discord's own chat background

// ── shading helpers ───────────────────────────────────────────────────────
/** Radial navy → near-black backdrop, identical in feel to the server icon. */
const backdrop = (dc, size) => mixRgb(BG_INNER, BG_OUTER, clamp01(dc / (0.62 * size)));

/** Additive halo. `k` is the (unclamped) falloff, `amount` its peak strength. */
const glow = (c, col, k, amount) => {
  const g = clamp01(k) * amount;
  return [c[0] + col[0] * g, c[1] + col[1] * g, c[2] + col[2] * g];
};

/** A stroke's own colour: `col`, brightened toward `hi` at the stroke's core. */
const strokeCore = (col, hi, d, half, lift = 0.35) =>
  mixRgb(col, hi, clamp01(1 - d / half) * lift);

/** Falloff term for a halo hugging a stroke of half-width `half`. */
const halo = (d, half, falloff) => Math.exp(-Math.max(0, d - half) / falloff);

// ═════════════════════════════════════════════════════════════════════════
//  Variants. Each is a factory: size → shade(x, y) → [r,g,b]. Geometry is
//  authored at 512 px and scaled by `u`, so every variant renders natively at
//  whatever size it is asked for (no downsampling artefacts in the preview).
// ═════════════════════════════════════════════════════════════════════════

/**
 * xp-ring — the server's mark wrapped in an amber XP progress ring, caught
 * mid-climb. Reads as "the bot that runs the ranks" and, at 32 px, as a warm
 * ring around the familiar cyan hexagon.
 */
function xpRing(size) {
  const u = size / 512;
  const cx = size / 2, cy = size / 2;
  const hex = brandHex(size, 0.8);
  const hexHalf = 13 * u;
  const nodeR = 26 * u;
  const trackR = 196 * u;       // outer edge ~47 px clear of the circle crop
  const arcHalf = 13 * u;
  const a0 = -Math.PI / 2;      // 12 o'clock
  const a1 = a0 + TAU * 0.82;   // 82 % — a rank ring on its way up
  const headX = cx + trackR * Math.cos(a1), headY = cy + trackR * Math.sin(a1);
  const headR = 19 * u;

  return (x, y) => {
    const dc = Math.hypot(x - cx, y - cy);
    const dHex = distToOutline(x, y, hex);
    const dArc = distToArc(x, y, cx, cy, trackR, a0, a1);
    const dHead = Math.hypot(x - headX, y - headY);
    const dLive = Math.min(dArc, dHead);

    let c = backdrop(dc, size);
    c = glow(c, CYAN, halo(dHex, hexHalf, 40 * u), 0.34);
    c = glow(c, CYAN, Math.exp(-dc / (108 * u)), 0.26);
    c = glow(c, AMBER, halo(dLive, arcHalf, 26 * u), 0.30);

    // Unfilled part of the ring: the same circle, barely lit.
    if (Math.abs(dc - trackR) <= arcHalf * 0.55) c = mixRgb(c, AMBER, 0.22);
    if (dHex <= hexHalf) c = strokeCore(CYAN, CYAN_HI, dHex, hexHalf);
    if (dc <= nodeR) c = mixRgb(CYAN, CYAN_HI, 0.35 + 0.5 * clamp01(1 - dc / nodeR));
    // Drawn last: the filled arc owns the outer edge.
    if (dLive <= arcHalf) c = strokeCore(AMBER, AMBER_HI, dLive, arcHalf, 0.45);
    if (dHead <= headR) c = mixRgb(AMBER, AMBER_HI, 0.3 + 0.7 * clamp01(1 - dHead / headR));

    return c;
  };
}

/**
 * ladder — three rising chevrons inside the hexagon: the rank ladder itself.
 * The top chevron is lit, the ones below it are still dim, so the mark carries
 * the idea of climbing rather than of a finished badge.
 */
function ladder(size) {
  const u = size / 512;
  const cx = size / 2, cy = size / 2;
  const hex = brandHex(size, 0.9);
  const hexHalf = 10 * u;
  const chevHalf = 14 * u;
  const arm = 58 * u, rise = 42 * u, step = 56 * u;
  // Apexes placed so the group is centred: -76, -20, +36 spans ±76 with the arms.
  const chevrons = [-76, -20, 36].map((dy) => {
    const ay = cy + dy * u;
    return [[cx - arm, ay + rise], [cx, ay], [cx + arm, ay + rise]];
  });
  // Only a hint of falloff downward: amber mixed further into the navy backdrop
  // turns brown, which reads as dirt rather than as depth.
  const lit = [1, 0.9, 0.8];

  return (x, y) => {
    const dc = Math.hypot(x - cx, y - cy);
    const dHex = distToOutline(x, y, hex);

    let best = Infinity, tint = 1;
    for (let i = 0; i < chevrons.length; i++) {
      const d = distToOutline(x, y, chevrons[i], false);
      if (d < best) { best = d; tint = lit[i]; }
    }

    let c = backdrop(dc, size);
    c = glow(c, CYAN, halo(dHex, hexHalf, 38 * u), 0.30);
    // The halo follows the nearest chevron's DISTANCE only. Folding `tint` in
    // here too would make the glow jump where the nearest chevron changes —
    // visible as boxy seams behind the mark.
    c = glow(c, AMBER, halo(best, chevHalf, 30 * u), 0.32);

    if (dHex <= hexHalf) c = strokeCore(CYAN, CYAN_HI, dHex, hexHalf);
    if (best <= chevHalf) {
      c = mixRgb(c, strokeCore(AMBER, AMBER_HI, best, chevHalf, 0.45), tint);
    }
    return c;
  };
}

/**
 * reticle — the flight-computer read: hexagon, targeting reticle, amber lock
 * dot. Busiest of the three, so it trades some 32 px legibility for character.
 */
function reticle(size) {
  const u = size / 512;
  const cx = size / 2, cy = size / 2;
  const hex = brandHex(size, 0.9);
  const hexHalf = 10 * u;
  const ringR = 86 * u, ringHalf = 6 * u;
  const dotR = 16 * u;

  // Crosshair arms on the axes, target ticks on the diagonals → 8-way HUD.
  const spoke = (angle, from, to) => {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    return [[cx + from * ca, cy + from * sa], [cx + to * ca, cy + to * sa]];
  };
  const arms = [0, 1, 2, 3].map((i) => spoke((i * TAU) / 4, 26 * u, 62 * u));
  const ticks = [0, 1, 2, 3].map((i) => spoke(((i * TAU) / 4) + TAU / 8, 104 * u, 132 * u));
  const armHalf = 8 * u, tickHalf = 9 * u;

  return (x, y) => {
    const dc = Math.hypot(x - cx, y - cy);
    const dHex = distToOutline(x, y, hex);
    const dRing = Math.abs(dc - ringR);
    let dArm = Infinity, dTick = Infinity;
    for (const s of arms) dArm = Math.min(dArm, distToOutline(x, y, s, false));
    for (const s of ticks) dTick = Math.min(dTick, distToOutline(x, y, s, false));

    let c = backdrop(dc, size);
    c = glow(c, CYAN, halo(dHex, hexHalf, 38 * u), 0.30);
    c = glow(c, AMBER, halo(Math.min(dTick, dc), tickHalf, 34 * u), 0.26);

    if (dRing <= ringHalf) c = mixRgb(CYAN_DIM, CYAN, 0.55);
    if (dHex <= hexHalf) c = strokeCore(CYAN, CYAN_HI, dHex, hexHalf);
    if (dArm <= armHalf) c = strokeCore(CYAN, CYAN_HI, dArm, armHalf);
    if (dTick <= tickHalf) c = strokeCore(AMBER, AMBER_HI, dTick, tickHalf, 0.45);
    if (dc <= dotR) c = mixRgb(AMBER, AMBER_HI, 0.3 + 0.7 * clamp01(1 - dc / dotR));
    return c;
  };
}

const VARIANTS = {
  ladder: { make: ladder, blurb: 'three rising rank chevrons in the hexagon' },
  'xp-ring': { make: xpRing, blurb: 'hexagon mark inside an amber XP ring at 82 %' },
  reticle: { make: reticle, blurb: 'flight-computer targeting reticle' },
};
const ORDER = Object.keys(VARIANTS);
// `ladder` is the default because it is the only one of the three that still
// reads as itself at 32 px, where Discord shows it in the member list.
const DEFAULT_VARIANT = 'ladder';

// ── preview contact sheet ─────────────────────────────────────────────────
// One row per variant, circle-cropped at the sizes Discord actually uses:
// profile popout, member list hover, chat, member list.
const SHEET_SIZES = [256, 128, 64, 32];
const PAD = 26, GAP = 34;

function buildSheet(names) {
  const rowH = SHEET_SIZES[0];
  const width = PAD * 2 + SHEET_SIZES.reduce((a, b) => a + b, 0) + GAP * (SHEET_SIZES.length - 1);
  const height = PAD * 2 + rowH * names.length + GAP * (names.length - 1);

  // cells[] = { x, y, size, shade } — laid out once, sampled per pixel below.
  const cells = [];
  names.forEach((name, row) => {
    const rowTop = PAD + row * (rowH + GAP);
    let x = PAD;
    for (const size of SHEET_SIZES) {
      cells.push({
        x, y: rowTop + (rowH - size) / 2, size,
        shade: VARIANTS[name].make(size),
      });
      x += size + GAP;
    }
  });

  const shade = (px, py) => {
    for (const cell of cells) {
      const lx = px - cell.x, ly = py - cell.y;
      if (lx < 0 || ly < 0 || lx >= cell.size || ly >= cell.size) continue;
      const r = cell.size / 2;
      // Discord's circular crop — outside it, the sheet shows through.
      if (Math.hypot(lx - r, ly - r) > r) return SHEET_BG;
      return cell.shade(lx, ly);
    }
    return SHEET_BG;
  };

  return { width, height, rgb: render(width, height, SHEET_SS, shade) };
}

// ── main ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const all = argv.includes('--all');
const picked = argv.find((a) => !a.startsWith('-'));

if (picked && !VARIANTS[picked]) {
  console.error(`✗ Unknown variant "${picked}". Try: ${ORDER.join(', ')}`);
  process.exit(1);
}

const outDir = join(__dirname, 'assets');
mkdirSync(outDir, { recursive: true });
const show = (p) => relative(process.cwd(), p).replace(/\\/g, '/');

function write(file, size, ss, shade) {
  const png = encodePNG(size, size, render(size, size, ss, shade));
  const path = join(outDir, file);
  writeFileSync(path, png);
  return { path, kb: png.length / 1024 };
}

if (all) {
  for (const name of ORDER) {
    const { path, kb } = write(`verse-bot-avatar-${name}.png`, S, SS, VARIANTS[name].make(S));
    console.log(`✓ ${show(path)}  (${S}×${S}, ${kb.toFixed(1)} KB) — ${VARIANTS[name].blurb}`);
  }
  const sheet = buildSheet(ORDER);
  const sheetPng = encodePNG(sheet.width, sheet.height, sheet.rgb);
  const sheetPath = join(outDir, 'verse-bot-avatar-preview.png');
  writeFileSync(sheetPath, sheetPng);
  console.log(`✓ ${show(sheetPath)}  (${sheet.width}×${sheet.height}, ${(sheetPng.length / 1024).toFixed(1)} KB)`);
  console.log(`  rows top → bottom: ${ORDER.join(', ')}`);
  console.log(`  columns: ${SHEET_SIZES.map((s) => `${s} px`).join(', ')} — all circle-cropped like Discord does`);
  console.log(`\n  Pick one:  npm run avatar -- <variant>   then:  npm run avatar:apply`);
} else {
  const name = picked ?? DEFAULT_VARIANT;
  const { path, kb } = write('verse-bot-avatar.png', S, SS, VARIANTS[name].make(S));
  console.log(`✓ ${show(path)}  (${S}×${S}, ${kb.toFixed(1)} KB) — variant "${name}": ${VARIANTS[name].blurb}`);
  console.log(`  Apply it to the bot:  npm run avatar:apply`);
}
