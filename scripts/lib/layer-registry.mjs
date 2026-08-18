/* ============================================================
   layer-registry.mjs — die vollstaendige Aufzaehlung der Messstellen
   fuer LAYER-02 (Phase 3, Plan 05).

   HERLEITUNG (siehe 03-05-PLAN.md <enumeration_principle>): eine Stelle
   ist betroffen, wenn eine dekorative Schicht (Scrim/Zeilenraster) am
   gerenderten Hintergrund ihres Textes beteiligt ist. Das ist im CSS
   ablesbar: jede Regel, die ein containerfuellendes Pseudo-Element
   (`content:"";position:absolute|fixed;inset:0`) mit einem Farbverlauf
   erzeugt. Diese Datei fuehrt fuer jede solche Regel-FAMILIE einen
   Registry-Eintrag (Container, Textrolle, Bildmenge, Begruendung).

   Vier Bausteine:
     SHARED_REGISTRY   — A1-A10 (assets/detail.css, geteiltes System)
     OWN_BUILD_REGISTRY— C1-C3 (PilotPage, Startseite, /archiv)
     buildPatchRegistry() — B1-B6, HERGELEITET aus den 19 Quelldateien
                            unter src/components/patches/ (kein
                            Abtippen von 19 Paletten/Bildern von Hand —
                            die Funktion liest sie).
     EXCLUSIONS        — benannte Ausnahmen samt Grund (D-06, #stars,
                          .lb, Scrim-Skala, A9-Kontrollgruppe, die
                          .ship.foe-Farbabweichung, /archiv .space).

   Jeder MESSBARE Eintrag (kind:'photo'|'flat') traegt eine `text`-Rolle
   und wird gegen WCAG AA geprueft. Jeder KONTROLLFALL (controlCase:true)
   hat keine Textrolle -- er existiert nur, damit der Vollstaendigkeits-
   waechter (verify-layers.mjs Zusicherung 5) seine Selektor-Familie
   nicht als Fund ohne Registry-Eintrag meldet.
   ============================================================ */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseColor } from './theme-color.mjs';

/* ---------- generischer Verlaufs-Compositor ----------
   Deckt alle in diesem Bestand tatsaechlich vorkommenden Winkel ab
   (0/90/180/270 -- axis-aligned, kein "at 42deg" im Bestand). Fuer
   0deg/180deg zaehlt yFrac, fuer 90deg/270deg xFrac -- siehe CSS-Spec:
   0deg = "to top" (0%-Stop UNTEN), 180deg = "to bottom" (0%-Stop OBEN),
   90deg = "to right" (0%-Stop LINKS), 270deg = "to left" (0%-Stop RECHTS). */
export function axisFraction(angleDeg, xFrac, yFrac) {
  switch (((angleDeg % 360) + 360) % 360) {
    case 0:
      return 1 - yFrac;
    case 180:
      return yFrac;
    case 90:
      return xFrac;
    case 270:
      return 1 - xFrac;
    default:
      throw new Error(`axisFraction: unbekannter Winkel ${angleDeg} (nur 0/90/180/270 verdrahtet)`);
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerpColor(c1, c2, t) {
  return {
    r: lerp(c1.r, c2.r, t),
    g: lerp(c1.g, c2.g, t),
    b: lerp(c1.b, c2.b, t),
    alpha: lerp(c1.alpha ?? 1, c2.alpha ?? 1, t),
  };
}

/** Ein Stop ist entweder {t, tok} (Token-Name, gegen `tokens` aufgeloest,
 *  optional {t, tok, alpha} um dessen Alpha zu ersetzen -- fuer
 *  color-mix(in srgb, var(--bg) X%, transparent)-Stops, deren RGB am
 *  Token haengt aber deren Deckkraft eine feste Zahl ist), {t, rgba}
 *  (fixe Farbe, z. B. archive.css' .node--major-Scrim) oder
 *  {t, transparent:true}. */
function resolveStop(stop, tokens) {
  if (stop.transparent) return { r: 0, g: 0, b: 0, alpha: 0 };
  if (stop.rgba) return stop.rgba;
  const v = tokens[stop.tok];
  if (!v) throw new Error(`resolveStop: Token "${stop.tok}" nicht in tokens aufloesbar`);
  return stop.alpha === undefined ? v : { ...v, alpha: stop.alpha };
}

/** Farbe EINER Verlaufs-Ebene am Punkt (xFrac,yFrac). */
export function gradientLayerColorAt(layer, xFrac, yFrac, tokens) {
  const f = axisFraction(layer.angle, xFrac, yFrac);
  const stops = layer.stops;
  let i = 0;
  while (i < stops.length - 1 && f > stops[i + 1].t) i++;
  const a = stops[Math.max(0, i)];
  const b = stops[Math.min(stops.length - 1, i + 1)];
  const span = b.t - a.t || 1;
  const localT = Math.min(1, Math.max(0, (f - a.t) / span));
  return lerpColor(resolveStop(a, tokens), resolveStop(b, tokens), localT);
}

/** Alle Ebenen EINES Scrim-Konstrukts uebereinandergelegt. `layers` steht
 * in CSS-Reihenfolge (erste = oben) -- zum Malen wird umgedreht (unterste
 * zuerst auf das Foto, oberste zuletzt). */
export function scrimColorAt(scrim, xFrac, yFrac, tokens, base) {
  const layerColors = scrim.layers.map((l) => gradientLayerColorAt(l, xFrac, yFrac, tokens)).reverse();
  let acc = { ...base, alpha: 1 };
  for (const c of layerColors) {
    const a = c.alpha ?? 1;
    acc = {
      r: c.r * a + acc.r * (1 - a),
      g: c.g * a + acc.g * (1 - a),
      b: c.b * a + acc.b * (1 - a),
      alpha: 1,
    };
  }
  return acc;
}

/* ---------- A: Geteiltes System (assets/detail.css) ---------- */
export const SHARED_REGISTRY = [
  {
    id: 'A1-hero',
    archetype: 'shared',
    label: 'A1 · .hero (assets/detail.css)',
    selectorFamilies: ['.hero::before', '.hero__photo::after'],
    rationale:
      'h1/.lead/.tags liegen direkt ueber dem Hero-Foto, hinter Scrim (.hero__photo::after) UND Zeilenraster (.hero::before) -- der Leitfall dieser Phase (Tracer, Plan 01).',
    kind: 'photo',
    images: [{ id: 'contested-zones', path: 'public/assets/cz-facility.jpg', usedBy: 'src/pages/topics/4-0-0-contested-zones.astro (.hero__photo)' }],
    anchor: { xFrac: 0.18, yFrac: 0.85 },
    // Plan 05, Task 2 (Rule 1/D-04): Stopp von "scrim4 55% -> bg" auf ein
    // Plateau bis 90% verschoben -- der Ankerpunkt (yFrac 0.85) lag vorher
    // im Interpolationsbereich Richtung --bg (im Hellmodus hell), siehe
    // Kommentar an .hero__photo::after in assets/detail.css.
    scrim: { layers: [{ angle: 180, stops: [{ t: 0, tok: 'scrim2' }, { t: 0.55, tok: 'scrim4' }, { t: 0.9, tok: 'scrim4' }, { t: 1, tok: 'bg' }] }] },
    text: {
      body: { tokenKey: '--on-media-dim', minRatio: 4.5, label: 'Fliesstext (.hero .lead)' },
      large: { tokenKey: '--on-media', minRatio: 3.0, label: 'grosse Schrift (.hero h1 / .thin)' },
    },
  },
  {
    id: 'A2-band',
    archetype: 'shared',
    label: 'A2 · .band (assets/detail.css)',
    selectorFamilies: ['.band::before', '.band::after', '.band--right::after'],
    rationale: '.big/.kx/p liegen ueber dem Standbild (.bbg), hinter Scrim (.band::after) UND Zeilenraster (.band::before, D-01/Plan 2).',
    kind: 'photo',
    images: [{ id: 'no-net', path: 'public/assets/t-pyro-4.jpg', usedBy: 'src/components/topics/4-0-0-contested-zones.astro (.band .bbg, "KEIN NETZ")' }],
    anchor: { xFrac: 0.15, yFrac: 0.82 },
    scrim: {
      layers: [
        { angle: 180, stops: [{ t: 0, tok: 'scrim0' }, { t: 0.68, tok: 'scrim1' }, { t: 1, tok: 'bg' }] },
        { angle: 90, stops: [{ t: 0, tok: 'scrim3' }, { t: 0.52, transparent: true }] },
      ],
    },
    text: {
      body: { tokenKey: '--on-media-dim', minRatio: 4.5, label: 'Fliesstext (.band p)' },
      large: { tokenKey: '--on-media', minRatio: 3.0, label: 'grosse Schrift (.band .big)' },
    },
  },
  {
    id: 'A3-gtile',
    archetype: 'shared',
    label: 'A3 · .gtile figcaption (assets/detail.css)',
    selectorFamilies: ['.gtile::before'],
    rationale:
      'figcaption liegt ueber dem Kachel-Foto, hinter dem Zeilenraster (.gtile::before, z-index:1) UND ihrem eigenen kurzen Scrim-Streifen (background:linear-gradient(0deg,var(--scrim-6),transparent) auf der figcaption selbst, keine eigene ::before/::after-Familie, siehe naechster Absatz). Konservative Naeherung: die figcaption-Box ist klein (Padding .6rem, keine feste Hoehe) -- der Text sitzt darin vertikal mittig, deshalb wird die Verlaufsposition bei 50% der Box (halbe Staerke von --scrim-6) angesetzt statt der vollen Kante -- derselbe "ungünstigster Fall, aber nicht geometrisch exakt"-Grundsatz wie die Vignetten-Naeherung aus Plan 01 (03-01-SUMMARY.md).',
    kind: 'photo',
    images: [{ id: 'cz-loot', path: 'public/assets/cz-loot.jpg', usedBy: 'src/components/topics/4-0-0-contested-zones.astro (.gtile figcaption "High-Tier Loot")' }],
    anchor: { xFrac: 0.5, yFrac: 0.9 },
    scrim: { layers: [{ angle: 0, stops: [{ t: 0, tok: 'scrim6Half' }, { t: 1, transparent: true }] }] },
    text: { body: { tokenKey: '--on-media', minRatio: 4.5, label: 'figcaption (kurz, aber Fliesstextgroesse var(--fs-6))' } },
  },
  {
    id: 'A4-video',
    archetype: 'shared',
    label: 'A4 · .video (assets/detail.css)',
    selectorFamilies: ['.video::before', '.video::after'],
    rationale: '.vlbl liegt ueber dem Video-Standbild, hinter Scrim (.video::after) UND Zeilenraster (.video::before).',
    kind: 'photo',
    images: [{ id: 'trailer-4-0-0', path: 'public/assets/trailer-4-0-0.jpg', usedBy: 'src/components/topics/4-0-0-contested-zones.astro (.video Standbild)' }],
    anchor: { xFrac: 0.06, yFrac: 0.92 },
    scrim: { layers: [{ angle: 0, stops: [{ t: 0, tok: 'scrim4' }, { t: 0.55, transparent: true }] }] },
    text: { large: { tokenKey: '--on-media', minRatio: 3.0, label: '.vlbl (Bedienelement-Beschriftung, keine Fliesstextrolle)' } },
  },
  {
    id: 'A5-scrolly',
    archetype: 'shared',
    label: 'A5 · .scrolly__media + .sstep (assets/detail.css)',
    selectorFamilies: ['.scrolly__media::before', '.scrolly__media::after'],
    rationale: '.sn/h3/p liegen ueber dem aktiven Frame, hinter Scrim (.scrolly__media::after) UND Zeilenraster (.scrolly__media::before).',
    kind: 'photo',
    images: [{ id: 'cz-step1', path: 'public/assets/t-pyro-7.jpg', usedBy: 'src/components/topics/4-0-0-contested-zones.astro (.scrolly__media .frame.active, Schritt 1)' }],
    // .sstep ist vertikal zentriert (justify-content:center) im 100vh-Frame;
    // xFrac nahe der Innenkante, konsistent mit dem an A1 etablierten
    // Ankerverfahren (Textspalte beginnt nahe dem linken Rand von --maxw).
    anchor: { xFrac: 0.15, yFrac: 0.5 },
    scrim: {
      layers: [
        { angle: 90, stops: [{ t: 0, tok: 'scrim5' }, { t: 0.5, tok: 'scrim1' }, { t: 1, transparent: true }] },
        { angle: 0, stops: [{ t: 0, tok: 'bg' }, { t: 0.1, tok: 'scrim1' }, { t: 0.32, transparent: true }] },
      ],
    },
    text: {
      body: { tokenKey: '--on-media-dim', minRatio: 4.5, label: 'Fliesstext (.sstep p)' },
      large: { tokenKey: '--on-media', minRatio: 3.0, label: 'grosse Schrift (.sstep h3)' },
    },
  },
  {
    id: 'A6-split-control',
    archetype: 'shared',
    label: 'A6 · .split__media (assets/detail.css) — Kontrollfall',
    selectorFamilies: ['.split__media::before', '.split__media::after'],
    controlCase: true,
    rationale:
      '.split__text (h3/.kx/p) sitzt in der ANDEREN Grid-Spalte, flaechig neben dem Foto, nicht darueber -- .split__media traegt Zeilenraster+Scrim, aber keinen Text. Registriert, damit Zusicherung 5 diese Selektor-Familie nicht als Fund ohne Eintrag meldet; nicht Teil der AA-Marke, weil kein Text betroffen ist.',
    kind: 'flat',
    resolve: () => sharedFallbackFlat('--text', '--surface'),
    images: [],
  },
  {
    id: 'A7-editorial-control',
    archetype: 'shared',
    label: 'A7 · .editorial__img (assets/detail.css) — Kontrollfall',
    selectorFamilies: ['.editorial__img::before'],
    controlCase: true,
    rationale:
      '.editorial__card (h3/p) ueberlappt das Bild geometrisch, sitzt aber auf einer EIGENEN, blickdichten Panelflaeche (color-mix(in srgb,var(--surface) 92%,transparent) + backdrop-filter:blur(8px)), nicht direkt auf dem Foto -- Text-Hintergrund ist --surface, nicht das Bild. Registriert fuer Zusicherung 5, kein AA-Fall gegen das Foto.',
    kind: 'flat',
    resolve: () => sharedFallbackFlat('--text', '--surface'),
    images: [],
  },
  {
    id: 'A8-sticky-control',
    archetype: 'shared',
    label: 'A8 · .sticky__media (assets/detail.css) — Kontrollfall',
    selectorFamilies: ['.sticky__media::before'],
    controlCase: true,
    rationale: '.sticky__media traegt ueberhaupt keinen Text (die Feature-Liste .sticky__list sitzt in der Nachbarspalte). Registriert fuer Zusicherung 5.',
    kind: 'flat',
    resolve: () => sharedFallbackFlat('--text', '--surface'),
    images: [],
  },
  {
    id: 'A9-manifesto-control',
    archetype: 'shared',
    label: 'A9 · .manifesto (assets/detail.css) — Kontrollfall',
    selectorFamilies: ['.manifesto::before'],
    controlCase: true,
    rationale:
      '.manifesto::before ist ein flaechiger Akzent-Tin (radial-gradient mit var(--accent) bei 14% Mischung) auf der SEITENFLAECHE (--bg), kein Foto. blockquote/cite haengen an --text/--accent-2 gegen --bg, unveraendert von diesem Verlauf. Die uebrige A9-Gruppe (.statstrip, .flow, .specs, .versus) hat KEINE containerfuellende Verlaufs-Ebene (.flow::before ist eine 2px-Linie, kein inset:0) und wird deshalb von Zusicherung 5 gar nicht erst gefunden -- als Ausschluss dokumentiert (siehe EXCLUSIONS), nicht als Registry-Eintrag noetig.',
    kind: 'flat',
    resolve: () => sharedFallbackFlat('--text', '--bg'),
    images: [],
  },
  {
    id: 'A10-freed',
    archetype: 'shared',
    label: 'A10 · footer .foot-nav / .disclaimer / .lead-p / .src (assets/detail.css) — von der Maske freigestellt',
    selectorFamilies: [],
    rationale:
      'Diese Stellen tragen selbst KEINE Scrim/Raster-Regel (keine Selektor-Familie fuer Zusicherung 5) -- sie sind der Ort, an dem D-01s Maske vorher (unmaskiertes body::after) etwas abdunkelte und jetzt (maskiert) nichts mehr. Gemessen wird direkt --text/--muted gegen --bg/--bg-2/--surface -- dieselben Tokenpaare, die scripts/build-light-palettes.mjs (LIGHT_RULES) site-weit auf AA zielt (--text auf 0.24 Helligkeit, --muted auf 0.46, siehe theme-color.mjs-Kommentar). Eine Stichprobe ueber die 69 Seiten-Paletten wuerde nichts Neues zeigen, weil ALLE aus demselben Generator stammen -- strukturell garantiert statt Seite fuer Seite gemessen, dokumentierte Vereinfachung (Praezedenz: Vignetten-Naeherung, 03-01-SUMMARY.md).',
    kind: 'flat',
    resolve: () => sharedFallbackFlat('--text', '--bg-2'),
    images: [],
    text: { body: { minRatio: 4.5, label: '.disclaimer/.lead-p (--text/--muted auf --bg-2, Fallback-Palette)' } },
  },
];

/* Aufloesungshelfer fuer die flachen A6-A10-Eintraege: liest die Fallback-
   Palette aus assets/detail.css (:root{}) fuer dunkel und assets/theme.css
   (:root[data-theme="light"]) fuer hell -- s.u. resolveSharedTokens(). */
let SHARED_FLAT_CACHE = null;
function sharedFallbackFlat(fgTok, bgTok) {
  if (!SHARED_FLAT_CACHE) SHARED_FLAT_CACHE = resolveSharedFallbackPalette();
  return {
    dunkel: { fg: SHARED_FLAT_CACHE.dunkel[fgTok], bg: SHARED_FLAT_CACHE.dunkel[bgTok] },
    hell: { fg: SHARED_FLAT_CACHE.hell[fgTok], bg: SHARED_FLAT_CACHE.hell[bgTok] },
  };
}
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}
/** assets/theme.css deklariert :root[data-theme='light']{} MEHRFACH (Zeile 48
 * nur color-scheme, Zeile 117 die eigentliche Palette) -- der erste Treffer
 * ist nicht immer der richtige. Sucht deshalb den ERSTEN Block, der --bg
 * tatsaechlich definiert, statt blind den ersten Treffer zu nehmen. */
function findRootBlockWithBg(css, re) {
  const global = new RegExp(re.source, 'g');
  let m;
  while ((m = global.exec(css))) {
    if (/--bg\s*:/.test(m[1])) return m[1];
  }
  return '';
}
function resolveSharedFallbackPalette() {
  const detailCss = stripCssComments(safeRead('assets/detail.css'));
  const themeCss = stripCssComments(safeRead('assets/theme.css'));
  const darkRoot = findRootBlockWithBg(detailCss, /:root\s*\{([^}]*)\}/);
  const lightRoot = findRootBlockWithBg(themeCss, /:root\[data-theme=['"]light['"]\]\s*\{([^}]*)\}/);
  const pick = (block, tok) => {
    const re = new RegExp(`${tok.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')}\\s*:\\s*([^;]+);`);
    const m = re.exec(block);
    return m ? m[1].trim() : undefined;
  };
  return {
    dunkel: { '--text': pick(darkRoot, '--text'), '--muted': pick(darkRoot, '--muted'), '--bg': pick(darkRoot, '--bg'), '--bg-2': pick(darkRoot, '--bg-2') || pick(darkRoot, '--bg'), '--surface': pick(darkRoot, '--surface') },
    hell: { '--text': pick(lightRoot, '--text'), '--muted': pick(lightRoot, '--muted'), '--bg': pick(lightRoot, '--bg'), '--bg-2': pick(lightRoot, '--bg-2'), '--surface': pick(lightRoot, '--surface') },
  };
}
function safeRead(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

/* ---------- C: Eigenbauten ausserhalb beider Systeme ---------- */
export const OWN_BUILD_REGISTRY = [
  {
    id: 'C1-pilot-hero',
    archetype: 'own',
    label: 'C1 · .pp-hero (src/components/pilot/PilotPage.astro)',
    selectorFamilies: ['.pp-hero__scrim'],
    rationale:
      'Eigener Hero, keiner der Archetypen (03-05-PLAN.md C1). Traegt data-media-surface -- theme.css remappt --text/--bg im Hellmodus INNERHALB dieser Insel auf die Medien-Werte (--on-media/--media-void), im Dunkelmodus setzt PilotPage bereits selbst dunkle Werte. Die Insel bleibt dadurch in BEIDEN Modi de facto dunkel -- gemessen statt angenommen.',
    kind: 'photo',
    images: [{ id: 'pilot-fallback-banner', path: 'public/assets/t-pyro-2.jpg', usedBy: 'src/components/pilot/PilotPage.astro (#ppBannerImg Fallback-Banner ohne RSI-Verifizierung)' }],
    anchor: { xFrac: 0.25, yFrac: 0.82 },
    scrim: {
      layers: [
        {
          angle: 180,
          stops: [
            { t: 0, tok: 'ppVeil' },
            { t: 0.45, tok: 'ppVeil' },
            { t: 0.82, tok: 'ppBgMix78' },
            { t: 1, tok: 'ppBg' },
          ],
        },
      ],
    },
    text: { body: { tokenKey: 'ppText', minRatio: 4.5, label: 'Fliesstext (.pp-chrome / .pp-hero__body, --text unter data-media-surface)' } },
  },
  {
    id: 'C2-home-hero',
    archetype: 'own',
    label: 'C2 · .hero (src/pages/index.astro, Startseite)',
    selectorFamilies: ['.hero__scrim'],
    rationale:
      '⚠ Laedt body::after aus assets/theme.css/detail.css GAR NICHT (eigenes, unabhaengiges .hero__scrim) -- der geteilte Class-B-Befund trifft sie nicht direkt, gemessen wird sie trotzdem (03-05-PLAN.md C2).',
    kind: 'photo',
    images: [{ id: 'home-hero', path: 'public/assets/t-polaris-5.jpg', usedBy: 'src/pages/index.astro (HERO_IMG)' }],
    // .hero__search sitzt unten mittig (padding-bottom clamp(4rem,9vh,6rem)
    // von 94svh Hero-Hoehe); eigener --scrim-5-Kasten kommt als zweite,
    // FLACHE Ebene hinzu (siehe scrim unten).
    anchor: { xFrac: 0.5, yFrac: 0.86 },
    scrim: {
      layers: [
        { angle: 90, stops: [{ t: 0, tok: 'scrim6' }, { t: 0.4, tok: 'scrim4' }, { t: 0.78, tok: 'scrim0' }, { t: 1, transparent: true }] },
        { angle: 0, stops: [{ t: 0.01, tok: 'bg' }, { t: 0.24, tok: 'scrim2' }, { t: 0.58, transparent: true }] },
        // .hero__search's eigener undurchsichtiger Kasten (--scrim-5) liegt
        // ÜBER dem Foto-Scrim -- als dritte (oberste) Ebene angesetzt.
        { angle: 0, stops: [{ t: 0, tok: 'scrim5' }, { t: 1, tok: 'scrim5' }] },
      ],
    },
    text: { body: { tokenKey: '--on-media-dim', minRatio: 4.5, label: '.hero__search (Suchfeld-Text auf eigenem --scrim-5-Kasten)' } },
  },
  {
    id: 'C3-archiv-node-major',
    archetype: 'own',
    label: 'C3a · .node--major .node__art (assets/archive.css, /archiv)',
    selectorFamilies: ['.node--major .node__art::before'],
    rationale:
      '/archiv seit Plan 03 im Umfang (D-05). .node__ver/.node__name/.node__tag liegen ueber dem Foto (--art), hinter einem FIXEN (nicht --scrim-*-token-basierten) Scrim. Textfarbe ist --text/--muted (Seiten-Token), NICHT --on-media/--on-media-dim wie ueberall sonst in diesem Bestand -- siehe Task 2 (Rule-1-Fund).',
    kind: 'photo',
    images: [
      { id: 'trailer-4-0-0', path: 'public/assets/thumb-src/trailer-4-0-0.jpg', usedBy: 'ART["4-0-0"] (major, src/lib/archive.ts)', fallbackPath: 'public/assets/trailer-4-0-0.jpg' },
    ],
    anchor: { xFrac: 0.12, yFrac: 0.85 },
    scrim: {
      layers: [
        { angle: 0, stops: [{ t: 0, rgba: { r: 3 / 255, g: 5 / 255, b: 12 / 255, alpha: 0.94 } }, { t: 0.46, rgba: { r: 3 / 255, g: 5 / 255, b: 12 / 255, alpha: 0.42 } }, { t: 1, rgba: { r: 3 / 255, g: 5 / 255, b: 12 / 255, alpha: 0.72 } }] },
        { angle: 90, stops: [{ t: 0, rgba: { r: 3 / 255, g: 5 / 255, b: 12 / 255, alpha: 0.7 } }, { t: 0.55, transparent: true }] },
      ],
    },
    text: { large: { tokenKey: 'archiveText', minRatio: 3.0, label: '.node__ver/.node__name (color:var(--text), archive.css eigene Palette)' } },
  },
  {
    id: 'C3-archiv-node-point',
    archetype: 'own',
    label: 'C3b · .node--point .node__art (assets/archive.css, /archiv) — Kontrollfall',
    selectorFamilies: ['.node--point .node__art::before'],
    controlCase: true,
    rationale:
      'Korrigiert gegenueber der ersten Erhebung (Task 1): anders als bei .node--major ist .node__art bei .node--point ein FLEX-GESCHWISTER von .node__body (display:flex;align-items:stretch auf .node--point .node__card), keine absolute Ueberlagerung -- .node__tag sitzt in .node__body, NICHT ueber dem Foto-Streifen. Kontrollfall wie A6 (.split__media), registriert fuer Zusicherung 5.',
    kind: 'flat',
    resolve: () => ({ dunkel: { fg: '#97a8ca', bg: '#04060e' }, hell: { fg: '#97a8ca', bg: '#04060e' } }),
    images: [],
  },
];

/* ---------- D: Von Zusicherung 5 selbst gefundene Archetyp-Varianten ----------
   Genau der Fall, den 03-05-PLAN.md <enumeration_principle> beschreibt: der
   erste echte Lauf von Zusicherung 5 gegen den VOLLEN dist/-Bestand (nicht
   nur diese Phase) foerderte drei weitere, echte Text-ueber-Foto-Stellen aus
   anderen Werkzeugseiten zutage, die weder A/B/C noch die urspruengliche
   Recherche nannten. Aufgenommen statt uebergangen -- das ist der Sinn der
   Zusicherung. */
export const DISCOVERED_REGISTRY = [
  {
    id: 'D1-item-finder-hero',
    archetype: 'discovered',
    label: 'D1 · .hero--tool (src/components/ItemFinderPage.astro) — Hero-Variante',
    // Kein eigener Registry-Zwang: .hero--tool .hero__photo::after ist eine
    // Ueberschreibung von Werten (kein erneutes content/position/inset), die
    // Basisregel .hero__photo::after ist bereits ueber A1/B1 bekannt. Trotzdem
    // gemessen, weil die Ueberschreibung den Verlauf tatsaechlich AENDERT
    // (color-mix(var(--bg)) statt --scrim-2/4) -- LAYER-02-Vollstaendigkeit,
    // nicht Zusicherung-5-Pflicht.
    selectorFamilies: [],
    rationale:
      'Von Zusicherung 5 selbst gefunden (.hero--tool::before, Blend-Modus-Tint, siehe EXCLUSIONS X-hero-tool-blend). Die zugehoerige .hero__photo::after-UEBERSCHREIBUNG ersetzt den Standard-Scrim durch color-mix(var(--bg))-Stufen -- ein eigener, ungemessener Verlauf, wenn man ihn ausliesse. Kurzer Hero (min-height:0, padding-bottom 1.9rem), Titel zentriert.',
    kind: 'photo',
    images: [{ id: 'item-finder-hero', path: 'public/assets/cz-loot.jpg', usedBy: 'src/components/ItemFinderPage.astro (.hero__photo)' }],
    anchor: { xFrac: 0.5, yFrac: 0.55 },
    scrim: {
      layers: [
        { angle: 180, stops: [{ t: 0, tok: 'bg', alpha: 0.56 }, { t: 0.46, tok: 'bg', alpha: 0.34 }, { t: 1, tok: 'bg', alpha: 1 }] },
      ],
    },
    text: { large: { tokenKey: '--on-media', minRatio: 3.0, label: 'h1 (Titelverlauf endet auf --accent-media, Ankerfarbe --on-media als obere Kante)' } },
  },
  {
    id: 'D2-bvid-sc-4-9-0',
    archetype: 'discovered',
    label: 'D2 · .bvid (src/components/patches/sc-4-9-0.astro) — eigenstaendige Video-Variante',
    selectorFamilies: ['.bvid::after'],
    rationale: 'Von Zusicherung 5 gefunden: eigenstaendiges 21:8-Video-Banner NUR in sc-4-9-0 (Staub-Patch), .vlbl liegt ueber dem Standbild hinter einem --veil-2-Scrim -- dieselbe Textrolle wie A4/B4, aber mit --veil-2 statt --scrim-4.',
    kind: 'photo',
    images: [{ id: 'sc-4-9-0-bvid', path: 'public/assets/trailer-4-9-0.jpg', usedBy: 'src/components/patches/sc-4-9-0.astro (.bvid)' }],
    anchor: { xFrac: 0.06, yFrac: 0.9 },
    scrim: { layers: [{ angle: 0, stops: [{ t: 0, tok: 'veil2' }, { t: 0.55, transparent: true }] }] },
    text: { large: { tokenKey: '--on-media', minRatio: 3.0, label: '.vlbl' } },
  },
  {
    id: 'D3-ships-overview-hero',
    archetype: 'discovered',
    label: 'D3 · .sdb__hero (src/components/ships/ShipsOverview.astro)',
    selectorFamilies: ['.sdb__hero::after'],
    rationale: 'Von Zusicherung 5 gefunden: eigener Hero fuer /schiffe.html, h1/.sdb__sub liegen ueber dem Foto hinter einem --veil/--veil-2-Scrim (kein --scrim-*-Token) -- eigene Variante, nicht Teil von A oder B.',
    kind: 'photo',
    images: [{ id: 'ships-overview-hero', path: 'public/assets/img-polaris.jpg', usedBy: 'src/components/ships/ShipsOverview.astro (.sdb__hero::before)' }],
    anchor: { xFrac: 0.15, yFrac: 0.82 },
    scrim: {
      layers: [
        { angle: 90, stops: [{ t: 0, tok: 'veil2' }, { t: 0.4, tok: 'veil2' }, { t: 1, tok: 'veil' }] },
        { angle: 180, stops: [{ t: 0, tok: 'veil2' }, { t: 0.26, transparent: true }, { t: 0.6, tok: 'veil' }, { t: 0.99, tok: 'bg' }] },
      ],
    },
    text: {
      body: { tokenKey: '--on-media-dim', minRatio: 4.5, label: '.sdb__sub (Rule-1-Fund: war fixe Farbe #dbe6ff + generierter dunkler Hellmodus-Override, jetzt var(--on-media-dim))' },
      large: { tokenKey: '--on-media', minRatio: 3.0, label: 'h1 (Titelverlauf, obere Ankerfarbe --title-hi/--on-media)' },
    },
  },
  {
    id: 'D4-home-tool-tiles',
    archetype: 'discovered',
    label: 'D4 · .tool (src/pages/index.astro, Startseite Werkzeug-Kacheln)',
    selectorFamilies: ['.tool::after'],
    rationale: 'Von Zusicherung 5 gefunden: .tool__name/.tool__sub liegen ueber dem Kachel-Foto (.tool::before), hinter einem --scrim-6/--scrim-4/--scrim-0-Verlauf (.tool::after) -- bereits KORREKT auf den Medien-Tokensatz gebaut (--on-media/--on-media-dim), trotzdem bisher ungemessen.',
    kind: 'photo',
    images: [{ id: 'home-tool-item-finder', path: 'public/assets/cz-loot.jpg', usedBy: "src/pages/index.astro (tools[], 'Item Finder'-Kachel)" }],
    anchor: { xFrac: 0.5, yFrac: 0.85 },
    scrim: { layers: [{ angle: 0, stops: [{ t: 0.04, tok: 'scrim6' }, { t: 0.42, tok: 'scrim4' }, { t: 1, tok: 'scrim0' }] }] },
    text: {
      body: { tokenKey: '--on-media-dim', minRatio: 4.5, label: '.tool__sub' },
      large: { tokenKey: '--on-media', minRatio: 3.0, label: '.tool__name' },
    },
  },
  {
    id: 'D5-topic-fcard',
    archetype: 'discovered',
    label: 'D5 · .fcard (src/components/topics/4-0-1-fight-for-pyro.astro) — Rule-1-Fund',
    selectorFamilies: ['.fcard::after'],
    rationale:
      'Von Zusicherung 5 gefunden UND als Rule-1-Bug behoben (Task 2): h3/.fk/p/.ftag benutzten --text/--accent/--accent-2 (Seitenflaechen-Tokens) ueber einem Foto, hinter einem --veil/--veil-2-Verlauf (Flaechen-Schleier, im Hellmodus absichtlich fast durchsichtig) -- im Hellmodus brach der Kontrast ein (dunkler Text auf kaum getoentem hellem Foto). Auf --scrim-*/--on-media* umgestellt, wie ueberall sonst im Bestand fuer Text-auf-Foto (vgl. D4/.tool).',
    kind: 'photo',
    images: [
      { id: 'ffp-card-1', path: 'public/assets/cz-facility.jpg', usedBy: "src/components/topics/4-0-1-fight-for-pyro.astro (.fcard 1/3, 'Beacon')" },
      { id: 'ffp-card-2', path: 'public/assets/cz-combat.jpg', usedBy: 'src/components/topics/4-0-1-fight-for-pyro.astro (.fcard 2/3)' },
      { id: 'ffp-card-3', path: 'public/assets/t-ffp-2.jpg', usedBy: 'src/components/topics/4-0-1-fight-for-pyro.astro (.fcard 3/3)' },
    ],
    anchor: { xFrac: 0.15, yFrac: 0.88 },
    scrim: { layers: [{ angle: 0, stops: [{ t: 0, tok: 'scrim6' }, { t: 0.45, tok: 'scrim6' }, { t: 1, tok: 'scrim1' }] }] },
    text: {
      body: { tokenKey: '--on-media-dim', minRatio: 4.5, label: '.fcard p' },
      large: { tokenKey: '--on-media', minRatio: 3.0, label: '.fcard h3' },
    },
  },
  {
    id: 'D6-crafting-hero',
    archetype: 'discovered',
    label: 'D6 · .hero--tool (src/components/topics/crafting.astro) — Hero-Variante, zentrierter Titel',
    // Wie D1 kein Zusicherung-5-Zwang: .hero--tool .hero__photo::after ist eine
    // WERT-Ueberschreibung einer bereits bekannten Familie (.hero__photo::after,
    // ueber A1/B1 erfasst), kein neues content/position/inset. Aufgenommen aus
    // LAYER-02-Vollstaendigkeit — und weil der Kommentar in crafting.astro auf
    // diesen Eintrag verweist: ein Verweis ins Leere waere ein Zombie.
    selectorFamilies: [],
    rationale:
      'Der Titel steht seit 18.08.2026 ZENTRIERT im schmalen Kopfband, gerahmt von zwei gegenueberliegenden Eckwinkeln (.cr-mark, nach dem Vorbild .uf-mark im Item Finder) — die Winkel haben das Band von 225 auf 243 px wachsen lassen, weshalb Streifen und Anker unten nachgerechnet sind. Der Standard-Scrim aus detail.css hat sein radiales Sichtfenster fest bei 78 % x / 18 % y — gebaut fuer den hohen Hero mit Titel unten links; unter einem zentrierten Titel schwaerzt das die linke Haelfte und laesst die rechte offen. Ueberschrieben wird deshalb NUR das radiale Fenster (jetzt 50 % / 40 %); die LINEARE Stufenfolge bleibt Zeichen fuer Zeichen die aus detail.css (scrim-2 -> scrim-4 55 % -> scrim-4 90 % -> bg) und ist hier identisch modelliert. Die noetige Abdunklung steckt BEWUSST im Schleier (scrim-4 -> scrim-5 ab 50 %) und nicht in einem filter: am Foto: ein filter waere optisch gleichwertig, fuer dieses Modell aber unsichtbar — der Eintrag wuerde dann eine Seite zertifizieren, die er gar nicht misst. An den Bildpunkten gemessen (Kernpunkte, ohne Kantenglaettung): orangenes Wort 4,21:1, helle Zeile 10,55:1.',
    kind: 'photo',
    images: [{ id: 'crafting-hero', path: 'public/assets/t-craft-1.jpg', usedBy: 'src/components/topics/crafting.astro (.hero__photo)' }],
    // ⚠ Ankerpunkt NACHGERECHNET, in zwei Stufen, und beide Male korrigiert:
    // (1) Das Band ist ein AUSSCHNITT. Bei 1280x243 mit background-size:cover
    //     zeigt es vom 1919x823-Bild nur den Streifen yFrac 0.279..0.721; der
    //     Titel liegt darin bei 0.516..0.665. Der erste Anlauf stand auf 0.78 —
    //     ausserhalb des Streifens. Das Tor mass einen Bildteil, den das Band
    //     nie zeigt, und meldete 18.47:1 gruen.
    // (2) sampleAnchorColor MITTELT ueber 3 % der Bildflaeche (58x25 px hier).
    //     Der hellste EINZELPUNKT des Streifens (RGB 244, ein duennes Glanz-
    //     licht) verschwindet in diesem Mittel restlos — auf ihn gesetzt blieb
    //     der Wert bei 5.79:1 und reagierte kaum auf den Schleier. 0.67/0.522
    //     ist der hellste PATCH-MITTELWERT im sichtbaren Streifen (RGB
    //     202,198,194) und damit der unguenstigste Fall, den dieses Modell
    //     ueberhaupt sehen kann.
    anchor: { xFrac: 0.67, yFrac: 0.52 },
    scrim: { layers: [{ angle: 180, stops: [{ t: 0, tok: 'scrim2' }, { t: 0.5, tok: 'scrim5' }, { t: 0.9, tok: 'scrim5' }, { t: 1, tok: 'bg' }] }] },
    // Gemessen wird die DUNKLERE der beiden Titelfarben: das Wort "Crafting"
    // laeuft im Verlauf auf --accent-media aus, die Zeile darueber steht in der
    // hellen --on-media. D1 modelliert nur die helle Kante; hier die orangene,
    // weil sie der unguenstigere Fall ist und weil genau sie beim Zentrieren auf
    // das Glanzlicht geriet.
    // Als Hex, nicht als Token: resolveTextColor kennt nur Text-ROLLEN
    // (--on-media, --on-media-dim, ...), --accent-media ist eine Palettenfarbe.
    // #FF5E1A ist der Wert aus src/components/topics/crafting.astro (:root und
    // der Hellmodus-Block setzen beide --accent-media auf genau diesen Wert) —
    // wer ihn dort aendert, muss ihn hier mitziehen.
    text: { large: { tokenKey: '#FF5E1A', minRatio: 3.0, label: 'h1, orangenes Wort (Titelverlauf endet auf --accent-media #FF5E1A)' } },
  },
];

/* /archiv verwendet keine 480px-Thumb-Quelle im Baum unter demselben Pfad
   wie die Volltextaufnahmen -- die Karten benutzen /assets/thumb/*.webp
   (scripts/build-thumbs.mjs), das sharp-Sampling in verify-layers.mjs
   arbeitet aber gegen die ORIGINALE unter public/assets/*.jpg (dieselbe
   Bildinformation, groesser). fallbackPath oben verweist deshalb auf die
   Originaldatei; existsSync in verify-layers.mjs faellt automatisch darauf
   zurueck, wenn der thumb-src-Pfad fehlt (er tut es immer -- absichtlich
   dokumentierter, stabiler Pfad statt eines zweiten Bildbestands). */

/* ---------- B: Patch-System, HERGELEITET aus den 19 Quelldateien ---------- */
// Plan 05, Task 2: dieselbe Plateau-Verschiebung wie A1/A2 (assets/detail.css),
// woertlich in alle 19 Patch-Koerper migriert (Soll/Ist 20 bzw. 19 Treffer,
// siehe 03-05-SUMMARY.md) -- das Modell hier MUSS mit dem echten CSS-Text
// uebereinstimmen, sonst misst verify-layers.mjs den alten, bereits
// geheilten Stand.
const SCRIM_LAYERS = {
  hero: [{ angle: 180, stops: [{ t: 0, tok: 'scrim2' }, { t: 0.55, tok: 'scrim4' }, { t: 0.9, tok: 'scrim4' }, { t: 1, tok: 'bg' }] }],
  shot: [
    { angle: 180, stops: [{ t: 0, tok: 'scrim0' }, { t: 0.6, tok: 'scrim3' }, { t: 0.9, tok: 'scrim3' }, { t: 1, tok: 'bg' }] },
    { angle: 90, stops: [{ t: 0, tok: 'scrim4' }, { t: 0.55, transparent: true }] },
  ],
  tileImg: [{ angle: 0, stops: [{ t: 0, tok: 'scrim6' }, { t: 0.65, tok: 'scrim0' }] }],
  video: [{ angle: 0, stops: [{ t: 0, tok: 'scrim4' }, { t: 0.55, transparent: true }] }],
  ship: [{ angle: 0, stops: [{ t: 0, tok: 'scrim6' }, { t: 0.6, tok: 'scrim0' }] }],
};

const PATCH_DIR = 'src/components/patches';

function patchIdFromFile(f) {
  return f.replace(/\.astro$/, '');
}

function extractPalette(rawIn) {
  const raw = stripCssComments(rawIn);
  const darkBlock = /:root\s*\{([^}]*)\}/.exec(raw)?.[1] ?? '';
  const lightBlock = /:root\[data-theme=["']light["']\]\s*\{([^}]*)\}/.exec(raw)?.[1] ?? '';
  const pick = (block, tok) => new RegExp(`${tok}\\s*:\\s*(#[0-9a-fA-F]{3,8})`).exec(block)?.[1];
  return {
    bgDark: pick(darkBlock, '--bg'),
    bgLight: pick(lightBlock, '--bg'),
    mutedDark: pick(darkBlock, '--muted'),
    mutedLight: pick(lightBlock, '--muted'),
    bg2Dark: pick(darkBlock, '--bg-2') || pick(darkBlock, '--bg'),
    bg2Light: pick(lightBlock, '--bg-2') || pick(lightBlock, '--bg'),
  };
}

function firstMatch(raw, re) {
  const m = re.exec(raw);
  return m ? m[1] : null;
}

function imageNear(raw, markerRe, windowChars = 500) {
  const m = markerRe.exec(raw);
  if (!m) return null;
  const slice = raw.slice(m.index, m.index + windowChars);
  const img = /background-image:url\('([^']+)'\)/.exec(slice);
  return img ? img[1] : null;
}

/**
 * Liest die 19 Patch-Quelldateien und baut die B1-B5-Registry-Eintraege
 * (je einer PRO ARCHETYP, mit einer perPatch-Bildliste) -- hergeleitet,
 * kein Abtippen. B6 (flaechige Fusszeile) kommt als eigene Funktion.
 */
export function buildPatchRegistry(patchDir = PATCH_DIR) {
  let files;
  try {
    files = readdirSync(patchDir).filter((f) => /^sc-4-[\d-]+\.astro$/.test(f)).sort();
  } catch {
    files = [];
  }

  const perPatch = files.map((f) => {
    const raw = readFileSync(join(patchDir, f), 'utf8');
    const palette = extractPalette(raw);
    const heroImg = firstMatch(raw, /\.hero__photo\{[^}]*background:url\('([^']+)'\)/);
    const shotImg = imageNear(raw, /<section class="shot">/);
    const tileImg = imageNear(raw, /class="tile[^"]*\bimg\b[^"]*"/);
    const videoImg = firstMatch(raw, /<div class="video"[^>]*style="background-image:url\('([^']+)'\)/);
    const shipImg = imageNear(raw, /class="ship reveal"/) ?? imageNear(raw, /class="ship[^"]*"/);
    return { patchId: patchIdFromFile(f), ...palette, heroImg, shotImg, tileImg, videoImg, shipImg };
  });

  const familyFor = (key, archKey, label, anchor, textDef, rationale) => {
    const images = perPatch
      .filter((p) => p[key])
      .map((p) => ({ id: p.patchId, path: `public/assets${p[key].replace(/^\/assets/, '')}`, usedBy: `src/components/patches/${p.patchId}.astro`, bgDark: p.bgDark, bgLight: p.bgLight }));
    return {
      id: `B-${archKey}`,
      archetype: 'patch',
      label,
      selectorFamilies: [
        archKey === 'hero' ? '.hero__photo::after' : archKey === 'shot' ? '.shot::after' : archKey === 'tileImg' ? '.tile.img::after' : archKey === 'video' ? '.video::after' : '.ship::after',
        archKey === 'hero' ? '.hero::before' : archKey === 'shot' ? '.shot::before' : archKey === 'tileImg' ? '.tile.img::before' : archKey === 'video' ? '.video::before' : '.ship::before',
      ],
      rationale,
      kind: 'photo',
      perPatchImages: images,
      images,
      anchor,
      scrim: { layers: SCRIM_LAYERS[archKey] },
      text: textDef,
    };
  };

  return [
    familyFor(
      'heroImg',
      'hero',
      'B1 · .hero (19 Patch-Koerper, je eigene Palette+Motiv)',
      { xFrac: 0.18, yFrac: 0.85 },
      { body: { tokenKey: '--on-media-dim', minRatio: 4.5, label: 'Fliesstext (.hero .tagline/.codename)' }, large: { tokenKey: '--on-media', minRatio: 3.0, label: 'grosse Schrift (.hero h1)' } },
      '19 verschiedene Paletten ueber 19 verschiedenen Motiven (materiell verschiedene Zahlen, siehe 03-05-PLAN.md B-Tabelle) -- je Koerper einzeln aus dem Quelltext gelesen, nicht ein Vertreter je Stimmung.'
    ),
    familyFor(
      'shotImg',
      'shot',
      'B2 · .shot (19 Patch-Koerper)',
      { xFrac: 0.12, yFrac: 0.86 },
      { body: { tokenKey: '--on-media-dim', minRatio: 4.5, label: 'Fliesstext (.shot p)' }, large: { tokenKey: '--on-media', minRatio: 3.0, label: 'grosse Schrift (.shot .big)' } },
      'Volltext-identisches Scrim ueber alle 19 Koerper (bestaetigt per grep), aber je eigenes Motiv+Palette -- je Koerper gemessen.'
    ),
    familyFor(
      'tileImg',
      'tileImg',
      'B3 · .tile.img (19 Patch-Koerper)',
      { xFrac: 0.5, yFrac: 0.85 },
      { body: { tokenKey: '--on-media', minRatio: 4.5, label: '.tile .lbl/.sub' } },
      'Bento-Kachel, Beschriftung sitzt am Kachelfuss ueber dem Foto.'
    ),
    familyFor(
      'videoImg',
      'video',
      'B4 · .video (17 Patch-Koerper)',
      { xFrac: 0.06, yFrac: 0.9 },
      { large: { tokenKey: '--on-media', minRatio: 3.0, label: '.vlbl' } },
      '17 von 19 Koerpern tragen ein Video-Wall (03-04-SUMMARY.md: 17 .video::before).'
    ),
    familyFor(
      'shipImg',
      'ship',
      'B5 · .ship (13 Patch-Koerper)',
      { xFrac: 0.15, yFrac: 0.85 },
      { body: { tokenKey: '--on-media', minRatio: 4.5, label: '.ship__in .role/h3' } },
      '13 von 19 Koerpern tragen eine Schiffs-Garage (03-04-SUMMARY.md: 13 .ship::before). .ship.foe verwendet eine FIXE, dunklere rgba-Ersetzung statt --scrim-6/--scrim-0 (siehe EXCLUSIONS) -- mindestens so opak wie die Standardregel, daher nicht separat gemessen.'
    ),
    buildPatchFlatEntry(perPatch),
  ];
}

function buildPatchFlatEntry(perPatch) {
  return {
    id: 'B6-patch-flat',
    archetype: 'patch',
    label: 'B6 · .pager / .foot-meta / .disclaimer (19 Patch-Koerper) — Fusszeile auf Seitenflaeche',
    selectorFamilies: [],
    rationale: 'Fliesstext auf der Seitenflaeche (--muted auf --bg-2), keine Scrim/Raster-Regel -- gemessen wie A10, je Patch-Palette (keine Stichprobe: alle 19 --bg/--bg-2-Paare werden geprueft).',
    kind: 'flat-multi',
    images: [],
    perPatchTokens: perPatch.map((p) => ({ id: p.patchId, bg2Dark: p.bg2Dark, bg2Light: p.bg2Light, mutedDark: p.mutedDark, mutedLight: p.mutedLight })),
    text: { body: { minRatio: 4.5, label: '.foot-meta / .disclaimer (--muted)' } },
  };
}

/* ---------- Ausschluesse — benannt, damit sie keine Luecke sind ----------
   `selectorFamilies` ist hier OPTIONAL: wenn gesetzt, schliesst der Eintrag
   Zusicherung 5 GENAUSO wie ein Registry-Eintrag (nur ohne Messpflicht) --
   das ist der Unterschied zwischen "diese Regel existiert und wurde
   ANGESEHEN, aber bewusst nicht gemessen" und einer echten Luecke. */
export const EXCLUSIONS = [
  { id: 'X-embers', reason: 'D-06, ausdruecklich zurueckgestellt: #embers (mix-blend-mode:screen) laeuft seit Phase 1.1 nur auf ausdruecklichen Wunsch, Standard AUS. Ein statischer Kontrastwert kann einen Blend-Modus grundsaetzlich nicht zertifizieren -- auch ein spaeteres Tor koennte diese Stelle nicht abdecken.' },
  { id: 'X-stars', reason: '#stars: derselbe Schalter, derselbe Standard AUS wie #embers (D-06-Praezedenz).' },
  { id: 'X-lightbox', reason: '.lb (Lightbox): Overlay ueber Foto, traegt aber keinen Fliesstext (nur Bild/Video/Schliessen-Knopf).' },
  { id: 'X-scrim-scale', reason: 'Vereinheitlichung der --scrim-*-Skala ist in 03-CONTEXT.md <deferred> zurueckgestellt -- eine tiefere Stufe an EINEM Container (Task 2) ist keine Vereinheitlichung.' },
  { id: 'X-a9-flat-group', reason: '.statstrip/.flow/.specs/.versus (A9-Restgruppe) haben KEINE containerfuellende Verlaufs-Ebene (.flow::before ist eine 2px-Linie, kein inset:0) -- von Zusicherung 5 gar nicht erst gefunden, deshalb kein Registry-Eintrag noetig.' },
  { id: 'X-ship-foe', reason: '.ship.foe::after ersetzt --scrim-6/--scrim-0 durch eine FIXE rgba(45,6,6,.93)/rgba(45,6,6,.05)-Ersetzung (mindestens so opak wie die Standardregel bei t=0, daher keine schwaechere Stelle) -- ueber die B5-Familie (.ship::after) mit abgedeckt, nicht separat gemessen.' },
  {
    id: 'X-archiv-space',
    reason:
      'assets/archive.css § "Deep-space backdrop" (.space/.space__nebula/.space__grid/.space__scan/.space__vignette) ist KEINE Pseudo-Element-Familie (echte Elemente, kein content:"") -- von Zusicherung 5 nicht gefunden. Ob dieser globale, unmaskierte Backdrop denselben Class-B-Fehler traegt wie das vormalige body::after in assets/detail.css (D-01), wurde von D-05 NICHT geprueft (D-05 deckte ausschliesslich den .reveal-Beobachter ab, 03-03-SUMMARY.md). BEOBACHTETE GRENZE, nicht in diesem Plan geloest -- siehe SUMMARY "Beobachtungen ausserhalb des Anfassbestands".',
  },
  {
    id: 'X-body-after-dup',
    selectorFamilies: ['body::after'],
    reason: 'body::after (die Vignette) wird bereits EXKLUSIV durch Zusicherung 1 (Begrenzung/Maske) und Zusicherung 2 (die einzige erlaubte bildschirmfuellende Verlaufs-Ebene) geprueft -- ein zweiter Registry-Eintrag waere doppelte Zustaendigkeit fuer dieselbe Regel.',
  },
  {
    id: 'X-rec-banner-dead',
    selectorFamilies: ['.rec-banner::after'],
    reason: 'assets/account-dossier.css: .rec-banner (samt .bmeta/.bchip/.barcode) ist TOTES CSS -- 0 Fundstellen in src/ (grep bestaetigt), die Klasse wird auf keiner Seite verwendet. Keine tatsaechliche Rendering-Instanz zu messen.',
  },
  {
    id: 'X-account-ambient',
    selectorFamilies: ['.dsr::after'],
    reason: 'assets/account-dossier.css: .dsr::after ist ein seitenweiter, sehr blasser (z-index:-1) Akzent-Glow HINTER allen Panels (.metric/.qcard/.card/… sitzen auf einer eigenen, opaken --surface-Flaeche darueber) -- dieselbe Bauart wie /archiv .space, ships .sdb::before und data-page.css .dp::before (siehe X-ambient-family unten), keine Text-auf-Foto-Stelle.',
  },
  {
    id: 'X-rg-pv-banner',
    selectorFamilies: ['.rg__banner::before', '.rg__banner::after', '.pv-banner::after'],
    reason: 'assets/account.css: .rg__banner/.pv-banner sind Kopfbanner, deren Verlauf INS --surface/--bg-2 (die Flaeche darunter) ausblendet. Der zugehoerige Name-/Handle-Text (.rg__name h3, .pv-name) sitzt im FLUSS darunter auf der Flaeche, nicht auf dem Banner-Scrim selbst (margin-top:-38px zieht nur den Avatar-Ring nach oben) -- kein Text-auf-Foto-Fall.',
  },
  {
    id: 'X-icard-glow',
    selectorFamilies: ['.icard::before'],
    reason: 'assets/archive.css: .icard::before ist ein flaechiger Eckglanz (radial-gradient mit var(--c) bei 13% Mischung) auf der opaken --panel-Flaeche, kein Foto -- Text (.icard__n/.icard__t) haengt an --text/--muted/--c gegen --panel, unveraendert von diesem sehr blassen Verlauf.',
  },
  {
    id: 'X-ambient-family',
    selectorFamilies: ['.dp::before', '.sdb::before'],
    reason:
      'assets/data-page.css (.dp::before, ~17.000 Item-/Crafting-Seiten) und src/components/ships/ShipsOverview.astro (.sdb::before) sind dieselbe Bauart wie .dsr::after (X-account-ambient) und archiv.css .space: ein sehr blasser (<=17%), maskiert ausblendender ODER z-index<=0 liegender Seiten-Hintergrund HINTER dem eigentlichen Inhalt, der auf einer eigenen, hoeher liegenden Flaeche (.dp-bar/.dp-main/.dp-foot bzw. .sdb__hero) sitzt. Vier unabhaengige Subsysteme (archiv, Konto, Schiffe, Item/Crafting-DataShell) teilen dasselbe Muster -- einzeln benannt, damit die Menge nicht wie eine Luecke wirkt, keines davon legt Text UNMITTELBAR auf den Verlauf.',
  },
  {
    id: 'X-hero-tool-blend',
    selectorFamilies: ['.hero--tool::before'],
    reason: 'src/components/ItemFinderPage.astro: .hero--tool::before ist ein Akzent-Tint mit mix-blend-mode:color (Einfaerbung, keine Abdunklung) -- dieselbe D-06-Begruendung wie #embers: ein statischer Kontrastwert kann einen Blend-Modus nicht zertifizieren. Die zugehoerige .hero__photo::after-Verlaufs-UEBERSCHREIBUNG wird trotzdem gemessen, siehe D1.',
  },
  {
    id: 'X-pj-map-frame',
    selectorFamilies: ['.pj-map__frame::after'],
    reason: 'src/components/PrecisionJumpApp.astro: .pj-map__frame::after ist eine holografische Vignette UEBER der SVG-Radarkarte (#pj-svg) -- keine Textrolle dort, die Distanz-/Achsbeschriftungen sind SVG-<text> mit eigener Fuellfarbe unabhaengig von diesem CSS-Verlauf.',
  },
  {
    id: 'X-holo-videoposter',
    selectorFamilies: ['.holo__videoposter::after'],
    reason: 'src/components/ShipDetail.astro: .holo__videoposter::after ist eine radiale Abdunklung des Video-Postbilds vor dem ersten Klick (Play-Button ist ein SVG-Icon, kein Fliesstext).',
  },
  {
    id: 'X-fresh-media',
    selectorFamilies: ['.fresh__media::after'],
    reason: 'src/pages/index.astro: .fresh__media::after blendet das Foto horizontal in --surface aus (90deg, Text-Seite) -- .fresh__name/.fresh__ver sitzen in .fresh__body, der ANDEREN Grid-Spalte, nicht ueber dem Foto (derselbe Kontrollfall wie A6 .split__media).',
  },
  {
    id: 'X-holo-panel-scanline',
    selectorFamilies: ['.holo__panel::after'],
    reason: 'src/components/ShipDetail.astro: .holo__panel::after ist eine sehr blasse (7%) Scanline-Textur UEBER der bereits OPAKEN Basisflaeche von .holo__panel (background:linear-gradient(180deg,var(--scrim-6),var(--scrim-6)) -- beide Stops identisch, also deckend). Der massgebliche Kontrast (Text gegen scrim-6) haengt an der Basisregel, nicht an diesem `::after`; die Basisregel ist kein `::before/::after` und wird von Zusicherung 5 nicht erfasst, ihre Deckkraft macht die Stelle aber unkritisch (scrim-6 ist mode-unabhaengig nahezu Schwarz).',
  },
];

/* ============================================================
   TEXTSTELLEN im geteilten System — Grundlage von Zusicherung 7.

   WARUM ES DIESE TABELLE GIBT (WINDOWS.md id 9, 09.08.2026):
   Die `text`-Rollen oben behaupten einen Token, aber nichts hat je
   nachgesehen, ob das CSS an dieser Stelle wirklich daran haengt.
   A1-hero fuehrte "grosse Schrift (.hero h1 / .thin)" als --on-media --
   `.thin` hing im CSS jedoch an var(--text). Im Hellmodus ist --text
   dunkel: gemessen 2,14:1 auf einem dunklen Foto, waehrend der Bericht
   19,65:1 meldete. `.eyebrow` stand ueberhaupt nicht in der Aufzaehlung
   und lag bei 1,26:1 bis 1,80:1 ueber acht Seiten.

   Der Vollstaendigkeitswaechter (Zusicherung 5) konnte das nicht sehen:
   er zaehlt SCRIM-Selektorfamilien, also die Bauart der Schicht -- nicht
   die Textelemente, die darauf liegen. Die Luecke lag in der
   Aufzaehlung, nicht in der Messung.

   `quelle` ist der Token bzw. die Funktion, aus der die Farbe im
   GEBAUTEN CSS kommen MUSS. Fuer Stellen mit modusabhaengiger Herkunft
   stehen beide da: `quelle` (Grundregel) und `hell` (die Regel in
   assets/theme.css, die im Hellmodus gewinnt).
   ============================================================ */
export const SHARED_TEXT_CLAIMS = [
  {
    container: '.hero',
    seite: 'topics/4-0-0-contested-zones.html',
    stellen: [
      { sel: '.hero .lead', quelle: '--on-media-dim', rolle: 'Fliesstext' },
      { sel: '.hero h1 .thin', quelle: '--text', hell: '--on-media', rolle: 'Kicker im Titel' },
      { sel: '.eyebrow', quelle: '--accent-2', hell: 'color-mix', rolle: 'Augenbrauen-Zeile' },
      { sel: '.hero__play', quelle: '--text', hell: '--on-media', rolle: 'Trailer-Beschriftung' },
      { sel: '.scrollcue', quelle: '--muted', hell: '--on-media-dim', rolle: 'Scroll-Hinweis' },
    ],
  },
  {
    container: '.band',
    seite: 'topics/4-0-0-contested-zones.html',
    stellen: [
      { sel: '.band .big', quelle: '--on-media', rolle: 'grosse Schrift' },
      { sel: '.band p', quelle: '--on-media-dim', rolle: 'Fliesstext' },
    ],
  },
  {
    container: '.gtile',
    seite: 'topics/4-0-0-contested-zones.html',
    stellen: [{ sel: '.gtile figcaption', quelle: '--on-media', rolle: 'Bildunterschrift' }],
  },
  {
    container: '.scrolly',
    seite: 'topics/4-0-0-contested-zones.html',
    stellen: [
      { sel: '.sstep h3', quelle: '--on-media', rolle: 'Schritt-Ueberschrift' },
      { sel: '.sstep p', quelle: '--on-media-dim', rolle: 'Schritt-Fliesstext' },
    ],
  },
];

/* Klassen, die im Container zwar eine Textfarbe setzen, aber KEINE
   Textstelle auf dem Motiv sind. Jede braucht einen Grund -- eine
   unbegruendete Ausnahme waere dasselbe wie ein blindes Tor. */
export const TEXT_CLAIM_EXCLUSIONS = [
  {
    id: 'X-text-tag',
    sel: '.tag',
    reason:
      'Die Marken-Pillen bringen ihre eigene deckende Flaeche mit (background:var(--scrim-4) + Rahmen). Ihr Kontrast haengt an dieser Flaeche, nicht am Motiv darunter; assets/theme.css faerbt sie im Hellmodus ausdruecklich auf --on-media um (Abschnitt "Nachzuegler im Hero").',
  },
];

/* ---------- Zusammenfuehren ---------- */
export function buildRegistry() {
  return [...SHARED_REGISTRY, ...OWN_BUILD_REGISTRY, ...DISCOVERED_REGISTRY, ...buildPatchRegistry()];
}

export function isControlCase(entry) {
  return !!entry.controlCase;
}
