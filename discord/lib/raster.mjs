// ─────────────────────────────────────────────────────────────────────────
//  lib/raster.mjs — the tiny signed-distance-field rasteriser behind the
//  server icon and the bot avatar: colour maths, 2D distance functions, the
//  site's hexagon mark, and a supersampled render loop.
//
//  Everything is distance-based, so a mark is authored once and comes out
//  clean at any size — which matters for avatars, where Discord renders the
//  same file at 512 px and at 32 px.
// ─────────────────────────────────────────────────────────────────────────

// ── colour ────────────────────────────────────────────────────────────────
export const mix = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v) | 0;

/** Linear blend between two [r,g,b] triples. */
export const mixRgb = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// ── distance functions ────────────────────────────────────────────────────
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Distance to a polyline through `pts`; `closed` joins the last point to the first. */
export function distToOutline(px, py, pts, closed = true) {
  let d = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    d = Math.min(d, distToSegment(px, py, ax, ay, bx, by));
  }
  return d;
}

/**
 * Distance to a circular arc of radius `r` around (cx,cy), sweeping from angle
 * `a0` to `a1` (radians, y-down, clockwise for a1 > a0). Points beyond the
 * sweep measure to the nearest end, so thresholding the result gives round caps.
 */
export function distToArc(px, py, cx, cy, r, a0, a1) {
  const TAU = Math.PI * 2;
  const dx = px - cx, dy = py - cy;
  const span = a1 - a0;
  const rel = (((Math.atan2(dy, dx) - a0) % TAU) + TAU) % TAU;
  if (rel <= span) return Math.abs(Math.hypot(dx, dy) - r);
  const e0 = Math.hypot(px - (cx + r * Math.cos(a0)), py - (cy + r * Math.sin(a0)));
  const e1 = Math.hypot(px - (cx + r * Math.cos(a1)), py - (cy + r * Math.sin(a1)));
  return Math.min(e0, e1);
}

// ── the brand mark ────────────────────────────────────────────────────────
// The site's favicon hexagon (public/favicon.svg) on its native 0..64 grid.
const HEX_PATH = [[32, 8], [52, 20], [52, 44], [32, 56], [12, 44], [12, 20]];

/** The hexagon's vertices for a `size`×`size` canvas, optionally scaled about the centre. */
export function brandHex(size, scale = 1) {
  const c = size / 2;
  return HEX_PATH.map(([x, y]) => {
    const px = (x / 64) * size, py = (y / 64) * size;
    return scale === 1 ? [px, py] : [c + (px - c) * scale, c + (py - c) * scale];
  });
}

// ── render ────────────────────────────────────────────────────────────────
/**
 * Renders `shade(x, y) → [r,g,b]` into a packed RGB buffer, `ss`×`ss`
 * supersampled per pixel for anti-aliasing.
 */
export function render(width, height, ss, shade) {
  const rgb = Buffer.alloc(width * height * 3);
  const inv = 1 / (ss * ss);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = shade(px + (sx + 0.5) / ss, py + (sy + 0.5) / ss);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const o = (py * width + px) * 3;
      rgb[o] = clamp255(r * inv);
      rgb[o + 1] = clamp255(g * inv);
      rgb[o + 2] = clamp255(b * inv);
    }
  }
  return rgb;
}
