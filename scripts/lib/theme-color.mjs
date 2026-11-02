/* ============================================================
   theme-color.mjs — Farbmathematik fuer die Kontrast-Pruefungen.

   Parsen, WCAG-Kontrast und das Uebereinanderlegen halbtransparenter
   Schichten (verify-layers.mjs, tests/e2e/layer-compositing.test.js,
   Messwerkzeuge unter scripts/probes/). Dazu die OKLCH-Umrechnung,
   weil dort L wahrnehmungsnah ist: „L = 0.48" heisst auf jedem Farbton
   gleich hell.

   Bis zum 02.11.2026 standen hier auch die Regeln, nach denen die
   hellen Paletten aus den dunklen abgeleitet wurden. Den hellen Modus
   gibt es nicht mehr; die Regeln sind mit ihm gegangen.
   ============================================================ */

/* ---------- sRGB <-> Linear ---------- */
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/* ---------- sRGB -> OKLab (Björn Ottosson) ---------- */
function rgbToOklab({ r, g, b }) {
  const R = toLin(r), G = toLin(g), B = toLin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToRgb({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/* ---------- OKLCH-Ansicht ---------- */
export function toOklch(hex) {
  const { L, a, b } = rgbToOklab(parseColor(hex));
  return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180) / Math.PI };
}

/* Gamut-Mapping: Sinkt die Farbe außerhalb von sRGB, wird die Buntheit
   schrittweise zurückgenommen statt hart geklippt — sonst kippt der
   Farbton (klassischer Fehler bei Orange/Magenta). */
function oklchToRgb(L, C, h) {
  const rad = (h * Math.PI) / 180;
  for (let c = C; c >= 0; c -= 0.002) {
    const rgb = oklabToRgb({ L, a: Math.cos(rad) * c, b: Math.sin(rad) * c });
    if (rgb.r >= -0.001 && rgb.r <= 1.001 && rgb.g >= -0.001 && rgb.g <= 1.001 && rgb.b >= -0.001 && rgb.b <= 1.001) {
      return { r: clamp01(rgb.r), g: clamp01(rgb.g), b: clamp01(rgb.b) };
    }
  }
  return { r: L > 0.5 ? 1 : 0, g: L > 0.5 ? 1 : 0, b: L > 0.5 ? 1 : 0 };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/* ---------- Parsen / Ausgeben ---------- */
export function parseColor(str) {
  const s = String(str).trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) {
    const [a, b, c] = m[1];
    return { r: parseInt(a + a, 16) / 255, g: parseInt(b + b, 16) / 255, b: parseInt(c + c, 16) / 255, alpha: 1 };
  }
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, alpha: 1 };
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(s);
  if (m) {
    return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, alpha: m[4] === undefined ? 1 : +m[4] };
  }
  return null;
}

const hex2 = (x) => Math.round(clamp01(x) * 255).toString(16).padStart(2, '0');
export const toHex = ({ r, g, b }) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

/** OKLCH -> #rrggbb (gamut-gemappt) */
export function oklch(L, C, h) {
  return toHex(oklchToRgb(L, C, h));
}

/** OKLCH -> rgba(...) mit Alpha */
export function oklcha(L, C, h, alpha) {
  const { r, g, b } = oklchToRgb(L, C, h);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${trimNum(alpha)})`;
}

const trimNum = (n) => String(+n.toFixed(3)).replace(/^0\./, '.');

/* ---------- Kontrast (WCAG 2.1) ---------- */
export function luminance(c) {
  const { r, g, b } = typeof c === 'string' ? parseColor(c) : c;
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ---------- Schichten zusammenlegen (Phase 3, Plan 1 — D-04/LAYER-02) ----------
   WCAG rechnet (L1+.05)/(L2+.05). Dieses Verhaeltnis bleibt NICHT erhalten,
   wenn man beide Seiten gleichmaessig Richtung einer dritten Farbe mischt —
   Vordergrund und Hintergrund muessen deshalb JEDER FUER SICH durch den
   ganzen Schichtstapel geschickt und erst danach ins Verhaeltnis gesetzt
   werden. compositeOver()/flattenStack() sind der fehlende Baustein dafuer;
   contrast()/luminance() oben bleiben unangetastet — es gibt weiterhin genau
   eine WCAG-Formel im Bestand. */
const toColorObj = (c) => (typeof c === 'string' ? parseColor(c) : c);

/** Standard-Auflegeoperator ("source-over"): legt `top` (mit seinem eigenen
 * Alpha) auf `bottom` (als deckend behandelt). Beide Argumente nehmen
 * dieselbe Form wie parseColor() zurueckgibt (Kanaele 0..1) oder einen
 * CSS-Farbstring, der ueber parseColor() geschickt wird. Rueckgabe ist immer
 * deckend (alpha:1) — das Ergebnis ist selbst wieder eine gueltige "Basis"
 * fuer die naechste Schicht. */
export function compositeOver(top, bottom) {
  const t = toColorObj(top);
  const b = toColorObj(bottom);
  const a = t.alpha ?? 1;
  if (a >= 1) return { r: t.r, g: t.g, b: t.b, alpha: 1 };
  if (a <= 0) return { r: b.r, g: b.g, b: b.b, alpha: 1 };
  return {
    r: t.r * a + b.r * (1 - a),
    g: t.g * a + b.g * (1 - a),
    b: t.b * a + b.b * (1 - a),
    alpha: 1,
  };
}

/** Faltet `layers` (Index 0 zuunterst, die letzte Schicht liegt oben) in
 * Malreihenfolge ueber die deckende `base` und gibt eine deckende Farbe
 * zurueck. `compositeOver` ist ihr Baustein; dies ist die Funktion, die die
 * Pruefskripte (z. B. scripts/verify-layers.mjs) benutzen. */
export function flattenStack(base, layers) {
  let acc = { ...toColorObj(base), alpha: 1 };
  for (const layer of layers) acc = compositeOver(layer, acc);
  return acc;
}
