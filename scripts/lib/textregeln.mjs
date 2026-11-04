/* ============================================================
   textregeln.mjs — die Regeln fuer sichtbaren Text, an EINER Stelle.

   WARUM ES DEN GIBT: Bis zum 04.11.2026 lebten die Rohtext-Regeln nur in
   scripts/audit-site.mjs, und audit:site liest nur das statische HTML. Was
   die Werkzeuge erst im Browser zusammensetzen (Item-Finder-Modal, Karten),
   sah kein Tor: die Schild-Werte standen am 03.11.2026 im Finder-Modal als
   "NaN%" da, und der Fix in assets/item-finder-app.js hatte keine Pruefung,
   die ihn je verteidigt. Damit statisches HTML (audit:site, verify:sprache)
   und clientseitig gerenderter Text (verify:clienttext) nach DENSELBEN
   Regeln geprueft werden, stehen sie hier.

   Kein git, kein Netz. ladeKataloge() buendelt die i18n-Dateien aus
   src/i18n mit esbuild (wie verify:crafting), damit die Pruefung die ECHTEN
   Kataloge liest und keine Abschrift; esbuild startet dafuer seinen eigenen
   Dienstprozess und schreibt einen Temp-Ordner, der danach geloescht wird.
   ============================================================ */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

/* Rohtext MITTEN im Satz (Anlass 03.11.2026, siehe audit-site.mjs):
     - NaN / undefined / Infinity als ganzes Wort (nie Fliesstext),
     - null nur neben einem Vergleichs- oder Mengenzeichen,
     - {GrossGeschrieben} — die Form der Spielplatzhalter,
     - %schluessel% — eine Fuellstelle, die t()/fill() nicht ersetzt hat,
     - ReputationStanding_ — interne Rangschluessel ohne Anzeigenamen,
     - [object Object] — ein Objekt, das als Text ausgegeben wurde.
   Infinity und [object kamen am 04.11.2026 dazu: beides sind dieselbe
   Klasse (ein JS-Wert statt eines Anzeigetexts), und [object fing bisher
   nur PLACEHOLDER_RE in audit:site, und zwar nur als ganzer Textknoten.
   Infinity NUR als Zahl (allein, mit Vorzeichen oder vor einer Einheit):
   "Infinity Custom" ist ein Hersteller in den Spieltexten (X1-Lackierungen,
   gemessen am selben Tag). */
export const ROHTEXT_RE = /\b(?:NaN|undefined)\b|^-?Infinity$|[-−]Infinity\b|\bInfinity\s?(?:%|a?UEC|SCU|m\/s|km\/s|km|m|s|kg|HP|DPS)(?![\w])|\[object [A-Z]|[×≠≥≤<>=]\s*null\b|\bnull\s*[×≠≥≤<>=]|\{[A-Z][A-Za-z0-9]*\}|%[a-z][a-zA-Z]*%|\bReputationStanding_/;

/* Ein Textknoten, der NUR aus "-1" besteht, ist ein Platzhalterwert der
   Spieldaten, kein Messwert. Anlass 04.11.2026: 91 Missionen je Sprache
   zeigten "Spieler je Instanz: -1" (der Wert steht im Spiel fuer "keine
   Angabe"; `m.maxPlayers || '—'` liess ihn durch, weil -1 wahr ist). Bewusst
   NUR die nackte -1: gemessen am selben Tag stehen sonst ausschliesslich
   echte negative Werte als ganzer Knoten da (Rufschwellen -500/-1.000,
   Koordinaten), und keiner davon ist -1.
   Nur der ASCII-Bindestrich: der Platzhalter kommt roh aus String(-1). Ein
   bewusst gesetztes Vorzeichen (Raffinerie-Ausbeute „−1" neben „+2", U+2212)
   ist ein formatierter Deltawert und kein Platzhalter — die erste Fassung
   mit [-−] hat genau diese zwei Raffinerie-Zellen falsch gemeldet. */
export const PLATZHALTERWERT_RE = /^\s*-1\s*$/;

/* Deutsches Funktionswort auf einer EN-Seite: Text, den KEIN Katalog kennt,
   weil er fest im Markup steht ("0 Items gefunden" als Startwert des
   Zerlege-Rechners auf /topics/crafting.html, Anlass 04.11.2026). Die
   Katalog-Regel sieht so etwas nicht. Bewusst nur Woerter, die es im
   Englischen nicht gibt (kein "die", "also", "will", "war", "hat"), und
   keine Nomen: gemessen am selben Tag ueber 8.880 EN-Seiten genau ein Fund,
   der echte. Die Gegenrichtung fehlt aus demselben Grund wie bei Regel 2:
   die Spieltexte auf deutschen Seiten sind englisch. */
export const DE_FUNKTIONSWORT_RE = /(?<![\p{L}\d-])(?:und|oder|nicht|gefunden|für|wählen|keine|kein|werden|wird|sind|ist|noch|auch|nur|bitte|zurück|anzeigen|über|beim|zum|zur|vom|eine|einen|einem|einer)(?![\p{L}\d-])/iu;

/* Englisches Doppelwort aus einer Satzvorlage ("The The Butcher Helmet"):
   entsteht, wenn "The {name}" auf einen Namen trifft, der schon mit "The"
   beginnt. Bewusst NUR gross geschrieben: die Spieltexte selbst haben
   Tippfehler wie "in the the high speed rotary system" oder "is a a
   handheld tractor beam" (gemessen 04.11.2026, 5 Stellen) — die zitiert die
   Seite woertlich und korrigiert sie nicht (keine erfundenen Texte). Deutsch
   ist ausgenommen: "die die" ist Relativpronomen plus Artikel. */
export const DOPPELWORT_EN_RE = /\b(The|A|An) \1\b/;

/* Zahl im Format der ANDEREN Sprache. Nur eindeutige Formen:
     - zwei oder mehr Tausendergruppen (1,508,220 / 1.508.220),
     - Tausendergruppe plus Dezimalteil (2,335.5 / 2.335,5),
     - eine Tausendergruppe vor aUEC/UEC: Waehrung ist immer ganzzahlig,
       "2,335 aUEC" ist auf einer deutschen Seite also nie 2,335.
   Eine einzelne Gruppe ohne Waehrung ("1,234 m") bleibt ungeprueft — auf
   Deutsch kann das ein Dezimalwert sein. Ein Satzzeichen danach zaehlt
   nicht als Fortsetzung ("Kosten 1.508.220." auf einer EN-Seite, Review
   04.11.2026): gesperrt ist nur eine weitere Ziffer oder Gruppe. */
export const ZAHL_EN_AUF_DE_RE = /(?<![\d.,])\d{1,3}(?:,\d{3}){2,}(?!\d|,\d)|(?<![\d.,])\d{1,3},\d{3}\.\d+|(?<![\d.,])[1-9]\d{0,2},\d{3}\s?a?UEC\b/;
export const ZAHL_DE_AUF_EN_RE = /(?<![\d.,])\d{1,3}(?:\.\d{3}){2,}(?!\d|\.\d)|(?<![\d.,])\d{1,3}\.\d{3},\d+|(?<![\d.,])[1-9]\d{0,2}\.\d{3}\s?a?UEC\b/;

export const decodeEntities = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

/** Attribute, die gelesen oder vorgelesen werden. */
export const TEXT_ATTRS = ['alt', 'title', 'aria-label', 'content', 'placeholder'];
const ATTR_RE = new RegExp(`\\s(?:${TEXT_ATTRS.join('|')})="([^"]*)"`, 'g');

/* Skript- und Stilbloecke und Kommentare: kein sichtbarer Text. <template>
   bleibt bewusst drin: die Seite klont ihn in sichtbare Oberflaeche
   (Raffinerie-Formular, addOreRow), seine Texte gelten also mit
   (Review 04.11.2026). Schliessendes Tag in jeder Schreibweise
   ("</script >", "</SCRIPT>"; wie verify:patch-angaben), Kommentarende
   auch "--!>". Wiederholt bis nichts mehr wegfaellt, damit ein
   verschachtelter Rest ("<scr<script></script>ipt>") nicht als neuer Block
   stehen bleibt. */
const NICHTTEXT = [
  /<script\b[\s\S]*?<\/script(?:\s[^>]*)?>/gi,
  /<style\b[\s\S]*?<\/style(?:\s[^>]*)?>/gi,
  /<!--[\s\S]*?--!?>/g,
];
function ohneNichttext(html) {
  let vorher;
  let s = html;
  do {
    vorher = s;
    for (const re of NICHTTEXT) s = s.replace(re, ' ');
  } while (s !== vorher);
  return s;
}

/**
 * Die Textstellen eines HTML-Stuecks: jeder Textknoten und jedes gelesene
 * Attribut, Entitaeten aufgeloest. Skripte, Stile und Kommentare sind kein
 * sichtbarer Text. `ohneAttr` laesst Attribute weg (z. B. fuer content= auf
 * meta-Tags, wenn nur der Seitenkoerper zaehlt).
 */
export function textStellen(html, { ohneAttr = false } = {}) {
  const markup = ohneNichttext(html);
  const out = [];
  for (const m of markup.matchAll(/>([^<]+)</g)) if (m[1].trim()) out.push(decodeEntities(m[1]));
  if (!ohneAttr) for (const m of markup.matchAll(ATTR_RE)) if (m[1].trim()) out.push(decodeEntities(m[1]));
  return out;
}

export const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

/**
 * Laedt alle UI-Kataloge aus src/i18n (die echten Objekte, per esbuild).
 * Drei der Kataloge (UI, HANGAR_UI, LAYOUT_UI) sind modul-intern; ein
 * esbuild-Plugin haengt ihnen fuer DIESE Pruefung eine Ausfuhr an, ohne die
 * Quelle zu aendern.
 * Rueckgabe: { de: Map(key -> value), en: Map(key -> value), namen: [...] }
 */
export async function ladeKataloge(root) {
  const esbuild = await import('esbuild');
  const tmp = mkdtempSync(join(tmpdir(), 'textregeln-'));
  const intern = { 'ui.ts': 'UI', 'hangarText.ts': 'HANGAR_UI', 'layoutText.ts': 'LAYOUT_UI' };
  const plugin = {
    name: 'katalog-ausfuhr',
    setup(b) {
      b.onLoad({ filter: /[\\/]src[\\/]i18n[\\/](ui|hangarText|layoutText)\.ts$/ }, (a) => {
        const datei = a.path.split(/[\\/]/).pop();
        return { contents: readFileSync(a.path, 'utf8') + `\nexport const __KATALOG = ${intern[datei]};\n`, loader: 'ts' };
      });
    },
  };
  try {
    await esbuild.build({
      stdin: {
        contents:
          "export { __KATALOG as UI } from './src/i18n/ui.ts';\n" +
          "export { __KATALOG as HANGAR } from './src/i18n/hangarText.ts';\n" +
          "export { __KATALOG as LAYOUT } from './src/i18n/layoutText.ts';\n" +
          "export { ITEM_UI as ITEM } from './src/i18n/itemText.ts';\n" +
          "export { HELP } from './src/i18n/help.ts';\n",
        resolveDir: root,
        sourcefile: 'textregeln-kataloge.ts',
        loader: 'ts',
      },
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile: join(tmp, 'kataloge.mjs'),
      loader: { '.json': 'json' },
      plugins: [plugin],
      logLevel: 'silent',
    });
    const mod = await import(pathToFileURL(join(tmp, 'kataloge.mjs')).href);
    const de = new Map(), en = new Map(), namen = [];
    for (const name of ['UI', 'HANGAR', 'LAYOUT', 'ITEM', 'HELP']) {
      const k = mod[name];
      if (!k || !k.de || !k.en) throw new Error(`Katalog ${name} ohne de/en`);
      namen.push(name);
      for (const [key, v] of Object.entries(k.de)) if (typeof v === 'string') de.set(`${name}:${key}`, v);
      for (const [key, v] of Object.entries(k.en)) if (typeof v === 'string') en.set(`${name}:${key}`, v);
    }
    return { de, en, namen };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Aus den Katalogen: welche Texte gibt es NUR in einer Sprache?
 *   mehrwortNurEn / mehrwortNurDe — Werte mit mindestens zwei Woertern, die
 *     in der anderen Sprache nirgends vorkommen. Ein solcher Text auf einer
 *     Seite der anderen Sprache ist immer ein Fehler (gemessen 04.11.2026:
 *     2.202 Funde, kein Fehlalarm).
 *   wortNurDe — einzelne Woerter, die es nur deutsch gibt (fuer EN-Seiten).
 *     Die Gegenrichtung (englisches Einzelwort auf DE-Seite) wird NICHT
 *     geprueft: die Spieldaten sind englisch, und Kategorie- und Typnamen wie
 *     "Legs", "Medium", "Industrial" stehen auf deutschen Seiten zu Recht —
 *     dieselben Woerter sind zugleich englische Katalogwerte (19.886 Funde,
 *     fast alle Spielbegriffe).
 *   schluessel — alle Katalogschluessel (ohne Katalogpraefix), praefixe —
 *     ihre ersten Glieder (nav, ship, find …), fuer die Rohschluessel-Regel.
 */
export function sprachMengen(kat) {
  const werte = (m) => new Set([...m.values()].map(norm).filter(Boolean));
  const de = werte(kat.de), en = werte(kat.en);
  const textig = (v) => /[A-Za-zÄÖÜäöüß]{3}/.test(v) && !/[{%<]/.test(v);
  const mehrwort = (v) => /\S\s+\S/.test(v);
  const mehrwortNurEn = new Set([...en].filter((v) => !de.has(v) && textig(v) && mehrwort(v)));
  const mehrwortNurDe = new Set([...de].filter((v) => !en.has(v) && textig(v) && mehrwort(v)));
  const wortNurDe = new Set([...de].filter((v) => !en.has(v) && textig(v) && !mehrwort(v)));
  const schluessel = new Set([...kat.de.keys(), ...kat.en.keys()].map((k) => k.slice(k.indexOf(':') + 1)));
  const praefixe = new Set([...schluessel].filter((k) => k.includes('.')).map((k) => k.split('.')[0]));
  return { mehrwortNurEn, mehrwortNurDe, wortNurDe, schluessel, praefixe };
}

/**
 * Regel fuer einen Katalogschluessel, der statt seines Werts sichtbar wird
 * ("ship.sheet.title"). Form: bekanntes erstes Glied, dann ein bis drei
 * Glieder aus Kleinbuchstaben/camelCase. Ausgenommen: Teil einer Adresse oder
 * eines Dateinamens (davor / . - @ oder ein Buchstabe, danach eine Endung).
 */
export function rohschluesselRe(praefixe) {
  const p = [...praefixe].sort((a, b) => b.length - a.length).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(?<![\\w/.@-])(?:${p})(?:\\.[a-z][A-Za-z0-9]*){1,3}(?![\\w.-])`, 'g');
}
const DATEIENDUNG_RE = /\.(?:html?|json|xml|txt|js|mjs|css|png|jpe?g|webp|avif|svg|com|net|org|de|io)$/;

/** Erster Rohschluessel in `text` (oder null); Dateinamen zaehlen nicht. */
export function findeRohschluessel(text, re) {
  re.lastIndex = 0;
  for (const m of text.matchAll(re)) if (!DATEIENDUNG_RE.test(m[0])) return m;
  return null;
}
