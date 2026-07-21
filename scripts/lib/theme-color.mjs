/* ============================================================
   theme-color.mjs — Farbmathematik für den Hell-/Dunkel-Umbau.

   Kernidee: Der FARBTON jeder Seitenpalette ist Identität (Pyro ist
   orange, Nyx ist blaugold, Supply-or-Die ist rostrot). Beim Wechsel
   nach Hell bleibt der Ton erhalten; nur Helligkeit und Buntheit
   werden pro Token-ROLLE neu abgestimmt.

   Gerechnet wird in OKLCH, weil dort L wahrnehmungsnah ist: „L = 0.48"
   heißt auf jedem Farbton gleich hell — und damit gleich kontraststark.
   In HSL wäre das nicht so (gelb bei 50% ist viel heller als blau).

   Kein Laufzeit-CSS: alle Werte werden hier zu Hex/RGBA gerechnet und
   statisch ausgegeben. Damit hängt nichts an Browser-Support für
   relative Farbsyntax.
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

/**
 * Dunkelt eine Farbe so weit ab (bei gleichem Farbton), bis sie das
 * geforderte Kontrastverhältnis gegen `bg` erreicht. Rettungsanker für
 * Paletten, deren Ton bei der Ziel-Helligkeit noch nicht reicht — z. B.
 * Gelb, das erst sehr dunkel genug Kontrast auf Weiß liefert.
 */
export function ensureContrast(hex, bg, ratio, { minL = 0.12, step = 0.01 } = {}) {
  const { C, h } = toOklch(hex);
  let { L } = toOklch(hex);
  let out = oklch(L, C, h);
  while (contrast(out, bg) < ratio && L > minL) {
    L -= step;
    out = oklch(L, C, h);
  }
  return out;
}

/* ============================================================
   Die Ableitungsregeln: dunkle Palette -> helle Palette.

   Jede Rolle bekommt ihr eigenes Helligkeitsziel. Die Buntheit wird
   bei Flächen stark gedeckelt (ein Hintergrund mit C=.15 wäre Neon-
   Pastell), bei Akzenten dagegen gehalten oder angehoben, damit die
   Marke nicht ausbleicht.
   ============================================================ */

/** Flächen: Ton bleibt als Hauch, Helligkeit wird gesetzt. */
const surface = (hex, L, capC) => {
  const { C, h } = toOklch(hex);
  return oklch(L, Math.min(C, capC), h);
};

/** Akzente: Ton bleibt, Helligkeit auf Kontrast getrimmt, Buntheit gehalten. */
const accentFor = (hex, L, bg, ratio) => {
  const { C, h } = toOklch(hex);
  // Buntheit leicht anheben: dunklere Töne wirken sonst matschig.
  return ensureContrast(oklch(L, Math.min(C * 1.15, 0.19), h), bg, ratio);
};

export const LIGHT_RULES = {
  /* Grundflächen — Papier. Der Farbton der dunklen Palette überlebt als
     kaum sichtbare Tönung: Pyro-Seiten bleiben warm, Nyx-Seiten kühl. */
  '--bg': (v) => surface(v, 0.977, 0.012),
  '--bg-2': (v) => surface(v, 0.948, 0.016),
  '--surface': (v) => surface(v, 0.995, 0.006),
  '--surface-2': (v) => surface(v, 0.962, 0.014),

  /* Tinte. Nicht reines Schwarz — der Seitenton bleibt spürbar. */
  '--text': (v) => surface(v, 0.24, 0.03),
  '--muted': (v) => surface(v, 0.46, 0.035),

  /* Akzente auf Papier: gleicher Ton, aber AA-tauglich.
     Ziel 4,9 statt 4,5 — mit Reserve: gerechnet wird gegen reines Weiß,
     tatsächlich sitzen die Akzente aber auf leicht getönten Flächen
     (--surface-2, halbtransparente Panels). Genau auf 4,5 gerechnet
     landen sie dort bei ~4,1 und fallen durch. */
  '--accent': (v) => accentFor(v, 0.47, '#ffffff', 4.9),
  '--accent-2': (v) => accentFor(v, 0.45, '#ffffff', 4.9),
  '--hot': (v) => accentFor(v, 0.44, '#ffffff', 4.9),
  '--gold': (v) => accentFor(v, 0.45, '#ffffff', 4.9),

  /* Text AUF Akzentflächen kippt von Fast-Schwarz auf Weiß. */
  '--ink': () => '#ffffff',
};

/** Linien: aus dem Akzent, aber deutlich sichtbar auf Papier. */
export function lightLine(accentHex, alpha = 0.3) {
  const { h, C } = toOklch(accentHex);
  return oklcha(0.55, Math.min(C, 0.1), h, alpha);
}

/** Weiche Trennlinie: aus der Tinte. */
export function lightLineSoft(textHex, alpha = 0.12) {
  const { h, C } = toOklch(textHex);
  return oklcha(0.3, Math.min(C, 0.04), h, alpha);
}

/** Neon-Bloom wird auf Papier zu einem weichen, farbigen Schlagschatten. */
export function lightGlow(accentHex) {
  const { h, C } = toOklch(accentHex);
  return `0 6px 22px ${oklcha(0.55, Math.min(C, 0.12), h, 0.18)}`;
}
