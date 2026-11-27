/* ============================================================
   verify-ia.mjs  (UX-Audit A9 / IA-Vorschlag V13, 24.11.2026)

   Das Tor der Informationsarchitektur. Der IA-Bericht (UX-Audit vom
   24.11.2026) hat den gebauten Bestand gecrawlt und Seiten gefunden, die
   nur ueber Menue und Suche erreichbar waren: Precision Jump hatte keinen
   einzigen Inhaltslink und war live trotzdem Einstieg Nummer fuenf,
   Downloads ebenso keinen. Und bis Paket A gab es die Liste der Bereiche
   sechsmal, in sechs Fassungen. Seit A1 steht sie EINMAL, in
   src/lib/bereiche.ts. Dieses Tor haelt beides fest, gegen das Artefakt:

   [1] Inhaltslinks: jede Seite, die eine Suchmaschine indexieren darf,
       hat mindestens einen eingehenden Link aus dem INHALT einer anderen
       Seite. Nicht gezaehlt wird, was auf jeder Seite gleich steht und
       deshalb nichts ueber die Struktur sagt: Kopfleiste mit Zurueck-Marke
       und lokaler Leiste (nav#topbar), Menue (#snavDeck), Datenleiste mit
       Menue und Brotkrumen (header.dp-bar), lokale Leiste der
       Datenblaetter (nav.dp-local), die Bereichs-Pillen der Startseite
       (nav.hero__areas), jeder Fuss (footer), dazu Skripte, Stile und
       Kommentare. Dieselbe Einteilung wie das Crawl-Skript des Berichts
       (informationsarchitektur/_skript/crawl.mjs), erweitert um die
       Leisten, die Paket A seitdem gebaut hat.
       „Indexierbar“: im Live-Bau keine robots-noindex-Marke. Im Vorschau-
       Bau traegt JEDE Seite noindex (src/lib/seo.ts, IS_STAGING); dort
       gilt dieselbe Regel, wie der Live-Bau sie anwendet: nicht in
       NOINDEX_PATHS, nicht 404, keine Seite, die nur der Vorschau-Bau
       traegt (Hangar, Vorschau-Patches). Im Live-Bau prueft
       [1c], dass diese Regel und die robots-Marken deckungsgleich sind;
       so bleibt die Vorschau-Ableitung ehrlich.

   [2] Leisten: jede Leiste und jedes Menue auf jeder Seite zeigt genau
       die Bereichsliste (bereiche(), dienste() aus src/lib/bereiche.ts,
       echt gebuendelt, kein Nachbau): Bereichsleiste der vollen
       Navigation (ul.snav__areas) und der Datenblaetter (ul.dp-areas),
       Menue der vollen Navigation (nav.snav-deck__cols) und der
       Datenblaetter (.dp-menu__cols), lokale Leiste (ul.snav__local,
       nav.dp-local) genau dort, wo lokaleLeiste() eine liefert, die
       Bereichs-Pillen der Startseite in beiden Sprachen und die
       Werkzeug-Eintraege beider Suchregister (suchZiele()). Jede Leiste
       steht genau einmal da. Verglichen werden Adresse und Name in
       Reihenfolge, dazu was das Markup sonst traegt: der Schluessel
       (data-area) in Bereichsleisten und Pillen, die markierte Seite
       (aria-current) der lokalen Leiste, die Unterzeile der Suchwerkzeuge.
       Menue- und Suchzeilen tragen keinen Schluessel. Feedback traegt die
       eigene Seite als ?seite= (A8). Nicht hier: die TERM-Leiste des
       Hangar-Terminals (eigener Rahmen, bei den Hangar-Threads).

   [3] Weg der Suchmaschine in die Items (seit 26.11.2026): die Items-Seite
       /items.html ist seit dem Tag die Items-Werkbank, Verzeichnis und
       Item Finder in einem, und /item-finder.html leitet dorthin. Ein
       Crawler kennt nur, was im HTML steht, nicht was das Skript
       nachzeichnet. Deshalb hier, je Sprache: die Seite ist indexierbar
       (Regel; im Live-Bau auch ohne noindex-Marke und in einer Sitemap),
       traegt das ItemPage-JSON-LD, und ihr INHALT verlinkt jede
       indexierbare Kategorieliste (/items/category/*.html, die erste Seite;
       die Folgeseiten -2, -3 … verlinkt die Liste selbst) mit einem
       echten <a href>. Selbstauskunft: Zahl der Kategorielisten, Klinke.

   Robots-Marke und Weiterleitung werden am echten <meta> im Kopf gelesen
   (ohne Kommentare, jede Attributreihenfolge), Links am echten href eines
   <a>. Ein Bau ohne lesbaren Stempel (dist/build.json) wird abgelehnt.

   Ausnahmen in [1] sind benannt, mit Anlass und Zombie-Waechter: hat eine
   ausgenommene Seite inzwischen einen Inhaltslink oder gibt es sie nicht
   mehr, reisst das Tor. Ebenso die Seiten ohne Navigation in [2] (404,
   Testpiloten-Tor, Onepager, im Vorschau-Bau die Hangar-Bucht): jede
   andere Seite ohne volle Navigation und ohne Datenleiste reisst.

   Gegenprobe zum Schnitt: steht nach dem Herausschneiden noch ein Teil
   einer Leiste im Inhalt (geaendertes Markup), reisst das Tor, statt
   Menuelinks still als Inhalt zu zaehlen.

   Selbstauskunft: druckt die Zahl der Seiten, Zielseiten, Links und
   Leisten und reisst unter den Klinken.

       node scripts/verify-ia.mjs            (npm run verify:ia)
       node scripts/verify-ia.mjs --quellen /refinery.html
                                             (woher kommen ihre Inhaltslinks?)
   ============================================================ */

import { readdirSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { HANGAR_DIST_DIRS, HANGAR_DIST_FILES } from './lib/hangar-switch.mjs';
import { VORSCHAU_PATCH_DIST_FILES } from './lib/vorschau-patches.mjs';
import { zielImBau } from './lib/supabase-ziel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

/* ---------- Klinken (gemessen 24.11.2026, Live-Bau) ---------- */
const KLINKE = {
  seiten: 17000, // gebaute Seiten ohne Weiterleitungen (live 18.658)
  zielseiten: 17000, // davon indexierbar (live 18.646)
  inhaltslinks: 500000, // aufgeloeste Inhaltslinks auf eigene Seiten
  rahmen: 17000, // Seiten mit voller Navigation oder Datenleiste
  lokal: 16, // Seiten mit lokaler Leiste (live 20: Mining, Crafting, Archiv, Schiffe je Sprache)
  // [3], 26.11.2026: Kategorielisten je Sprache, die die Items-Seite verlinkt
  // (gemessen 78 nach der Kategorie-Ordnung vom 24.11.2026; ein Datenlauf darf
  // eine Kategorie streichen).
  kategorien: 70,
};

/* ---------- [3] Items-Seite: der Weg der Suchmaschine in die Kategorien ---------- */
const ITEMS_NABE = { en: '/items.html', de: '/de/items.html' };
const KATEGORIE = { en: /^\/items\/category\/[^/]+\.html$/, de: /^\/de\/items\/category\/[^/]+\.html$/ };

/* ---------- Ausnahmen fuer [1] (benannt, mit Zombie-Waechter) ---------- */
// Je Sprache ein Eintrag: verschwindet eine der beiden Seiten, meldet der
// Zombie-Waechter genau diese.
const IMPRESSUM =
  'Impressum: sein Ort ist der Fuss jeder Seite (verify:rechtsfuss haelt das fest), ein Inhaltslink dorthin waere kuenstlich. Die Datenschutzerklaerung braucht die Ausnahme nicht, sie wird aus Formularen und Datenblaettern verlinkt.';
const AUSNAHMEN = [
  { muster: /^\/impressum\.html$/, anlass: IMPRESSUM },
  { muster: /^\/de\/impressum\.html$/, anlass: IMPRESSUM },
];

/* ---------- Seiten ohne Leisten fuer [2] (benannt, mit Zombie-Waechter) ----------
   Jede andere Seite traegt die volle Navigation (SiteNav) oder die
   Datenleiste (DataShell). Eine neue Seite ohne beides faellt sonst still
   aus [2] heraus. */
const RAHMENLOS = [
  { muster: /^\/404\.html$/, anlass: 'Fehlerseite: eigener schlichter Kopf mit Suche und Heimweg, eine Datei fuer beide Sprachen (Paket K).' },
  { muster: /^\/gate\.html$/, anlass: 'Testpiloten-Tor: Anmeldeseite vor staging, fuehrt nur hinein.' },
  {
    muster: /^\/(?:de\/)?hangar-bay\//,
    nurVorschau: true,
    anlass: 'Hangar-Bucht: Stellplatz-Seiten, nur im Vorschau-Bau und ohne Layout (Heuristik P80, bei den Hangar-Threads).',
  },
  {
    muster: /^\/onepager\/|^\/downloads\/onepager-[a-z0-9-]+\.html$/,
    anlass: 'Onepager: eigenstaendige Leitfaeden zum Herunterladen, ohne Layout (Heuristik P70, Paket H).',
  },
];

/* ---------- Bereichsliste: die echte Quelle, gebuendelt ---------- */

if (!existsSync(DIST)) {
  console.error('verify:ia: dist/ fehlt. Erst `npm run build`, dann pruefen.');
  process.exit(1);
}
// Welcher Bau liegt in dist/? Der Stempel muss es sagen. hangarImArtefakt()
// nimmt bei fehlendem Stempel den Vorschau-Bau an (dort der strengere Fall);
// hier waere es der laxere, weil [1c] im Vorschau-Bau entfaellt. Ein Bau
// ohne lesbaren Stempel wird deshalb abgelehnt, nicht geraten.
let stempel = null;
try {
  stempel = JSON.parse(readFileSync(join(DIST, 'build.json'), 'utf8'));
} catch {}
if (typeof stempel?.staging !== 'boolean') {
  console.error('verify:ia: dist/build.json fehlt oder nennt `staging` nicht als true/false — unbekannter Bau, das Tor prueft nicht ins Blaue.');
  process.exit(1);
}
const vorschau = stempel.staging;
// seo.ts liest STAGING beim Laden (HAS_HANGAR): die Quelle muss denselben
// Stand sehen wie der Bau, der in dist/ liegt.
if (vorschau) process.env.STAGING = '1';
else delete process.env.STAGING;

const tmp = mkdtempSync(join(tmpdir(), 'verify-ia-'));
let B, SEO;
let buendelFehler = null;
try {
  const esbuild = await import('esbuild');
  await esbuild.build({
    stdin: {
      contents:
        "export * as bereiche from './src/lib/bereiche.ts';\n" +
        "export { NOINDEX_PATHS } from './src/lib/seo.ts';\n",
      resolveDir: ROOT,
      sourcefile: 'verify-ia-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: join(tmp, 'src.mjs'),
    loader: { '.json': 'json' },
    // src/consts.ts erwartet das Supabase-Ziel wie im Bau (astro.config.mjs,
    // vite.define); die Bereichsliste braucht es nicht, nur den Import.
    define: { __VB_SUPABASE__: JSON.stringify(zielImBau()) },
    logLevel: 'silent',
  });
  const mod = await import(pathToFileURL(join(tmp, 'src.mjs')).href);
  B = mod.bereiche;
  SEO = { NOINDEX_PATHS: mod.NOINDEX_PATHS };
} catch (err) {
  buendelFehler = err;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
if (buendelFehler || !B) {
  console.error('verify:ia: src/lib/bereiche.ts liess sich nicht buendeln — das Tor kann die echte Liste nicht pruefen.');
  console.error(String(buendelFehler?.message ?? buendelFehler ?? 'Modul ohne Bereichsliste'));
  process.exit(1);
}

/* ---------- Bestand ---------- */

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}
const dateien = walk(DIST).sort();
const urlVon = (f) => '/' + f.slice(DIST.length + 1).replace(/\\/g, '/');
const seiten = new Set(dateien.map(urlVon));

/** Ein Pfad auf eine Seite im Bestand (wie crawl.mjs), sonst null. */
function ziel(p) {
  if (p === '' || p === '/') p = '/index.html';
  if (p === '/de' || p === '/de/') p = '/de.html';
  if (seiten.has(p)) return p;
  if (p.endsWith('/') && seiten.has(p + 'index.html')) return p + 'index.html';
  if (!p.endsWith('.html') && seiten.has(p + '.html')) return p + '.html';
  if (!p.endsWith('.html') && seiten.has(p + '/index.html')) return p + '/index.html';
  return null;
}

/** Entfernt alle Treffer, bis keiner mehr da ist: ein einziger Durchgang
 *  kann aus Resten einen neuen bilden (`<scr<b>ipt>`). Das Tor liest nur
 *  den eigenen Bau, aber es soll sich nicht darauf verlassen. */
function ohneAlle(s, re, ersatz = '') {
  let vorher;
  do {
    vorher = s;
    s = s.replace(re, ersatz);
  } while (s !== vorher);
  return s;
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
// Wie der HTML-Parser: 0, Ersatzhaelften und alles ueber U+10FFFF werden
// U+FFFD, statt den Lauf mit einem RangeError abzubrechen.
const zeichen = (n) => (n > 0 && n <= 0x10ffff && (n < 0xd800 || n > 0xdfff) ? String.fromCodePoint(n) : '�');
const entitaeten = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === '#' ? zeichen(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] ?? m);
const text = (s) => entitaeten(ohneAlle(s, /<[^>]*>/g)).replace(/\s+/g, ' ').trim();

// Tag-Grenzen wie im HTML-Parser: Leerraum ist dort nur ASCII (Tab, LF, FF,
// CR, Leerzeichen), nicht \s. Ein U+00A0 beendet keinen Tagnamen, also ist
// `</textarea\u00a0>` kein End-Tag. Ein Tagname endet erst an diesem
// Leerraum, „/“ oder „>“: `</textarea-x>` ist kein End-Tag von textarea
// (\b wuerde am Bindestrich schon greifen). So in allen Mustern dieses Tors.
const LR = '\\t\\n\\f\\r ';
const NAMENSENDE = `(?=[${LR}/>])`;
// Attribute wie der HTML-Parser: beliebige Anfuehrung (oder keine), Abstand
// um das =, der erste von zwei gleichnamigen gewinnt. Ein „>“ in einem
// Attributwert beendet das Tag nicht.
const TAGRUMPF = `((?:[^>"']|"[^"]*"|'[^']*')*)`;
const ATTRS = new RegExp(`([^${LR}"'>\\/=]+)(?:[${LR}]*=[${LR}]*(?:"([^"]*)"|'([^']*)'|([^${LR}"'=<>\`]+)))?`, 'g');
function attrs(rumpf) {
  const m = new Map();
  for (const a of rumpf.matchAll(ATTRS)) {
    const k = a[1].toLowerCase();
    if (!m.has(k)) m.set(k, entitaeten(a[2] ?? a[3] ?? a[4] ?? ''));
  }
  return m;
}
const attr = (rumpf, name) => attrs(rumpf).get(name) ?? null;
const klassen = (a) => (a.get('class') ?? '').split(new RegExp(`[${LR}]+`));

// Der Schnitt vor allem anderen geht wie der Tokenizer des Parsers Stelle
// fuer Stelle durch die Datei: an jeder „<“ zuerst ein Kommentar, dann ein
// Element, dessen Inhalt der Parser als Text liest, dann irgendein anderes
// Tag samt seinen Attributwerten. Was in einem Attributwert steht
// (`data-x="<script>"`), ist so nie der Anfang eines Treffers.
// - Kommentare (auch `<!-->` und `--!>`) und Pseudo-Kommentare (`<!doctype>`,
//   `<?…>`, `</ …>`) fallen weg.
// - script, style und die Elemente, deren Inhalt der Parser als Text liest
//   (textarea, xmp, iframe, noembed, noframes), fallen samt Inhalt weg: ein
//   „<a>“ darin ist kein Link. Nicht dabei: title (im SVG ein gewoehnliches
//   Element, oft in Leisten-Links) und noscript (fuer Crawler ohne Skript
//   sind das echte Links).
// - Jedes andere Tag bleibt, aber „<“ und „>“ in seinem Rumpf werden zu
//   Entitaeten. attrs() liest dieselben Werte, und kein spaeteres Muster
//   kann mehr mitten in einem Attributwert anfangen.
// - Eine „<“, die nichts davon beginnt, ist Text und wird zu &lt;. Danach
//   ist jede „<“ im Ergebnis der Anfang eines echten Tags, und kein
//   Wegfall kann zwei Reste zu einem neuen Tag verbinden.
// Gross- und Kleinschreibung wie im Parser.
const TEXTELEMENT = 'script|style|textarea|xmp|iframe|noembed|noframes';
const OHNE = new RegExp(
  `<!--(?:-?>|[\\s\\S]*?--!?>)` +
    `|<(?<roh>${TEXTELEMENT})${NAMENSENDE}${TAGRUMPF}>[\\s\\S]*?<\\/\\k<roh>${NAMENSENDE}${TAGRUMPF}>` +
    `|<(?:[!?]|\\/(?![a-z]))[^>]*>` +
    `|(?<tag><\\/?[a-z][^${LR}/>]*${TAGRUMPF}>)` +
    `|<`,
  'gi',
);
const OHNE_ERSATZ = (m, ...rest) => {
  const tag = rest.at(-1).tag;
  if (tag !== undefined) {
    const innen = tag.slice(1, -1);
    return innen.includes('<') || innen.includes('>') ? `<${innen.replace(/</g, '&lt;').replace(/>/g, '&gt;')}>` : tag;
  }
  return m === '<' ? '&lt;' : '';
};
const sauberVon = (s) => ohneAlle(s, OHNE, OHNE_ERSATZ);

/** Ende des Elements, das bei `start` mit <tag oeffnet (gleichnamige Tags gezaehlt). */
const TAGRE = new Map();
function ende(html, start, tag) {
  let re = TAGRE.get(tag);
  if (!re) TAGRE.set(tag, (re = new RegExp(`<(/?)${tag}${NAMENSENDE}${TAGRUMPF}>`, 'gi')));
  re.lastIndex = start;
  let tiefe = 0;
  for (let m; (m = re.exec(html)); ) {
    tiefe += m[1] ? -1 : 1;
    if (tiefe === 0) return re.lastIndex;
  }
  return html.length;
}

/** Alle Elemente zu `re` (ohne verschachtelte Treffer im selben Element). */
function elemente(html, re, tag) {
  const out = [];
  re.lastIndex = 0;
  for (let m; (m = re.exec(html)); ) {
    const e = ende(html, m.index, tag);
    out.push(html.slice(m.index, e));
    re.lastIndex = e;
  }
  re.lastIndex = 0;
  return out;
}

/** Das eine Element einer Leiste; fehlt es (ausser `darfFehlen`) oder steht
 *  es mehrfach da, ist das ein Befund. Mehrfach ist nie erlaubt: der Schnitt
 *  in [1] nimmt jede Kopie mit, also muss [2] jede gesehen haben. */
function einzeln(html, re, tag, art, url, darfFehlen = false) {
  const alle = elemente(html, re, tag);
  if (alle.length > 1) {
    leisteFalsch(art, url, `steht ${alle.length}-mal da`);
    return null;
  }
  if (!alle.length && !darfFehlen) leisteFalsch(art, url, 'fehlt');
  return alle[0] ?? null;
}

/** Inhalt des ersten Elements zu `re` (ohne seine eigenen Tags), sonst null. */
function innenVon(stueck, re, tag) {
  re.lastIndex = 0;
  const m = re.exec(stueck);
  re.lastIndex = 0;
  if (!m) return null;
  const innen = stueck.slice(m.index + m[0].length, ende(stueck, m.index, tag));
  return innen.replace(new RegExp(`<\\/${tag}${NAMENSENDE}${TAGRUMPF}>$`, 'i'), '');
}

/** Oeffnende <tag>, deren echte Attribute `wahl` bestehen. Die Werte kommen
 *  aus attrs() ueber das ganze Tag: ein `class="…"` als Text in einem
 *  anderen Attributwert (`data-x=' class="snav__areas"'`) ist keine Klasse.
 *  `vorab` sind Zeichenketten, von denen eine im Rumpf stehen muss, damit
 *  attrs() ueberhaupt laeuft; mit einer Entitaet im Rumpf laeuft es immer.
 *  Verhaelt sich wie ein globales RegExp (lastIndex, exec, test). */
function tagMit(tag, vorab, wahl) {
  const re = new RegExp(`<${tag}${NAMENSENDE}${TAGRUMPF}>`, 'gi');
  return {
    lastIndex: 0,
    exec(s) {
      re.lastIndex = this.lastIndex;
      for (let m; (m = re.exec(s)); ) {
        if (!m[1].includes('&') && !vorab.some((v) => m[1].includes(v))) continue;
        if (!wahl(attrs(m[1]))) continue;
        this.lastIndex = re.lastIndex;
        return m;
      }
      this.lastIndex = 0;
      return null;
    },
    test(s) {
      return this.exec(s) !== null;
    },
  };
}
/** Oeffnendes <tag> mit einer dieser Klassen, auch neben weiteren Klassen. */
const mitKlasse = (tag, ...k) => tagMit(tag, k, (a) => klassen(a).some((x) => k.includes(x)));
const mitId = (tag, id) => tagMit(tag, [id], (a) => a.get('id') === id);
const RE = {
  topbar: mitId('nav', 'topbar'),
  deck: mitId('div', 'snavDeck'),
  datenleiste: mitKlasse('header', 'dp-bar'),
  snLeiste: mitKlasse('ul', 'snav__areas'),
  snMenue: mitKlasse('nav', 'snav-deck__cols'),
  snLokal: mitKlasse('ul', 'snav__local'),
  dsLeiste: mitKlasse('ul', 'dp-areas'),
  dsMenue: mitKlasse('div', 'dp-menu__cols'),
  dsLokal: mitKlasse('nav', 'dp-local'),
  snGruppe: mitKlasse('section', 'snav-deck__group'),
  snGName: mitKlasse('span', 'snav-deck__gname'),
  snLabel: mitKlasse('span', 'snav-deck__label'),
  dsGruppe: mitKlasse('div', 'dp-menu__grp'),
  dsGName: mitKlasse('p', 'dp-menu__h'),
  pillen: mitKlasse('nav', 'hero__areas'),
};

// Was auf jeder Seite gleich steht und darum kein Inhalt ist.
const RAHMEN = [
  [mitId('nav', 'topbar'), 'nav'],
  [mitId('div', 'snavDeck'), 'div'],
  [mitKlasse('header', 'dp-bar'), 'header'],
  [mitKlasse('nav', 'dp-local', 'hero__areas'), 'nav'],
  [new RegExp(`<footer${NAMENSENDE}${TAGRUMPF}>`, 'gi'), 'footer'],
];
// Gegenprobe: keines dieser Rahmen-Teile darf nach dem Schnitt im Inhalt
// stehen. Aendert sich das Markup einer Leiste so, dass RAHMEN sie nicht
// mehr trifft, zaehlten ihre Links still als Inhalt und das Tor waere
// falsch gruen; so reisst es stattdessen. Geprueft am echten class-Attribut
// jedes Tags im Inhalt (im Lauf fuer [1]).
const RAHMEN_MARKEN = ['snav__areas', 'snav__back', 'snav__local', 'snav-deck__cols', 'dp-areas', 'dp-menu', 'dp-crumbs', 'dp-local', 'hero__areas'];
const rahmenMarke = (rumpf) =>
  (rumpf.includes('&') || RAHMEN_MARKEN.some((k) => rumpf.includes(k))) && klassen(attrs(rumpf)).find((k) => RAHMEN_MARKEN.includes(k));

function inhalt(html) {
  const raus = [];
  for (const [re, tag] of RAHMEN) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(html)); ) {
      const e = ende(html, m.index, tag);
      raus.push([m.index, e]);
      re.lastIndex = e;
    }
  }
  raus.sort((a, b) => a[0] - b[0]);
  let out = '';
  let pos = 0;
  for (const [a, e] of raus) {
    if (e <= pos) continue;
    if (a > pos) out += html.slice(pos, a);
    pos = Math.max(pos, e);
  }
  return out + html.slice(pos);
}

const IGNOR = /^(?:#|mailto:|tel:|javascript:|data:)/i;
const HOST = /^(?:www\.)?verse-base\.com$/;
// `href` kommt schon dekodiert aus attr(): nur Leerraum am Rand faellt weg,
// wie beim URL-Parser. Kein text(): der wuerde „<…>“ aus der Adresse
// schneiden und ein zweites Mal dekodieren.
function auflösen(href, von) {
  href = href.trim();
  if (!href || IGNOR.test(href)) return null;
  let u;
  try {
    u = new URL(href, 'https://verse-base.com' + von);
  } catch {
    return null;
  }
  if (!HOST.test(u.hostname)) return null;
  let p = u.pathname;
  try {
    p = decodeURI(p);
  } catch {}
  return ziel(p);
}

/* ---------- Indexierbarkeit ---------- */

const NUR_VORSCHAU = new Set(VORSCHAU_PATCH_DIST_FILES.map((f) => '/' + f));
const nurVorschau = (url) => {
  const rel = url.slice(1);
  return NUR_VORSCHAU.has(url) || HANGAR_DIST_FILES.test(rel) || HANGAR_DIST_DIRS.some((d) => rel.startsWith(d));
};
const grundform = (url) => (url === '/de.html' ? '/index.html' : url.startsWith('/de/') ? url.slice(3) : url);
/** Die Regel, die der Live-Bau anwendet (Layout.astro, isNoindex, 404-Prop). */
const indexierbarNachRegel = (url) => url !== '/404.html' && !SEO.NOINDEX_PATHS.has(grundform(url)) && !nurVorschau(url);
// robots und Weiterleitung am echten <meta> im Kopf, ohne Kommentare, in
// jeder Attributreihenfolge.
const META = new RegExp(`<meta${NAMENSENDE}${TAGRUMPF}>`, 'gi');
// Die Kopfgrenze zaehlt nur an einem echten Tag: ein „<body>“ in einem
// Kommentar, Skript, Stil oder Attributwert beendet den Kopf nicht. Der Lauf
// geht wie OHNE Stelle fuer Stelle und hoert an der Grenze auf, statt die
// ganze Datei vorher zu bereinigen.
const KOPF_ENDE = new RegExp(OHNE.source, 'gi');
const KOPF_GRENZE = new RegExp(`^<(?:\\/head|body)${NAMENSENDE}`, 'i');
function kopfMetas(html) {
  let ende = html.length;
  KOPF_ENDE.lastIndex = 0;
  for (let m; (m = KOPF_ENDE.exec(html)); ) {
    if (m.groups.tag !== undefined && KOPF_GRENZE.test(m.groups.tag)) {
      ende = m.index;
      break;
    }
  }
  KOPF_ENDE.lastIndex = 0;
  return [...sauberVon(html.slice(0, ende)).matchAll(META)].map((m) => attrs(m[1]));
}
const robotsNoindex = (metas) =>
  metas.some((a) => (a.get('name') ?? '').toLowerCase() === 'robots' && (a.get('content') ?? '').toLowerCase().split(/[\s,]+/).includes('noindex'));
function refreshZiel(metas) {
  const a = metas.find((x) => (x.get('http-equiv') ?? '').toLowerCase() === 'refresh');
  const m = a && (a.get('content') ?? '').match(/url\s*=\s*['"]?([^'"]+)/i);
  return m ? m[1].trim() : null;
}

/* ---------- Erwartete Leisten aus der Quelle ---------- */

const ERWARTET = {};
for (const lang of ['en', 'de']) {
  const bs = B.bereiche(lang);
  ERWARTET[lang] = {
    leiste: bs.map((b) => [b.key, b.href, b.kurz]),
    menue: [
      ...bs.map((b) => [b.name, b.seiten.map((z) => [z.href, z.name])]),
      [null, B.dienste(lang).map((z) => [z.href, z.name, z.key])],
    ],
    such: B.suchZiele(lang).map((z) => [z.name, z.sub, z.href]),
    feedback: B.ziel('feedback', lang).href,
  };
}
const kontoGruppe = { en: null, de: null };

/* ---------- Lauf ---------- */

let ok = true;
const befunde = [];
const fail = (msg) => {
  ok = false;
  befunde.push(msg);
};
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const kurz = (v) => JSON.stringify(v).slice(0, 220);
/** Die erste Abweichung zweier Listen, lesbar. */
const abweichung = (ist, soll) => {
  for (let i = 0; i < Math.max(ist.length, soll.length); i++)
    if (!gleich(ist[i], soll[i])) return `Eintrag ${i + 1}: ${ist[i] === undefined ? 'fehlt' : kurz(ist[i])} statt ${soll[i] === undefined ? 'nichts' : kurz(soll[i])}`;
  return '';
};

const ein = new Map(); // Zielseite -> { n, quellen[] }
const nabe = new Map(); // Sprache -> { url, ziele, itemPage, regel, noindex } ([3])
const zielseiten = [];
let gesamt = 0;
let umleitungen = 0;
let links = 0;
const umleitung = new Map();
const robotsAbweichung = [];
const eigenerRahmen = [];
const rahmenImInhalt = [];
const zahl = { sitenav: 0, datashell: 0, mitRahmen: 0, leisteSn: 0, leisteDs: 0, menueSn: 0, menueDs: 0, lokal: 0, start: 0, such: 0 };
const leistenFehler = new Map(); // Art -> [Seiten]
const leisteFalsch = (art, url, detail) => {
  if (!leistenFehler.has(art)) leistenFehler.set(art, { seiten: [], detail });
  leistenFehler.get(art).seiten.push(url);
};

// Erster Durchgang: Weiterleitungen kennen, bevor Links aufgeloest werden.
const html = new Map();
for (const f of dateien) {
  const url = urlVon(f);
  const r = refreshZiel(kopfMetas(readFileSync(f, 'utf8')));
  if (r) {
    umleitungen++;
    umleitung.set(url, r);
    continue;
  }
  html.set(url, f);
}
const folge = (z, von) => {
  if (z && umleitung.has(z)) return auflösen(umleitung.get(z), z);
  return z;
};

const ANKER = new RegExp(`<a${NAMENSENDE}${TAGRUMPF}>([\\s\\S]*?)<\\/a${NAMENSENDE}${TAGRUMPF}>`, 'gi');
// Fuer [1] geht der Lauf Tag fuer Tag durch den Inhalt. Nach sauberVon()
// beginnt jede „<“ ein echtes Tag; der Lauf bleibt trotzdem tagweise, damit
// er auch die Rahmen-Marke am echten class-Attribut jedes Tags sieht.
const TAG_AUF = new RegExp(`<([a-z][^${LR}/>]*)${TAGRUMPF}>`, 'gi');
const ANKER_AUF = new RegExp(`<a${NAMENSENDE}${TAGRUMPF}>`, 'gi');
const ankerZahl = (s) => s.match(ANKER_AUF)?.length ?? 0;
const lies = (stueck) => [...stueck.matchAll(ANKER)].map((m) => ({ tag: m[1], innen: m[2], text: text(m[2]) }));

for (const [url, f] of html) {
  gesamt++;
  const lang = url === '/de.html' || url.startsWith('/de/') ? 'de' : 'en';
  const E = ERWARTET[lang];
  const roh = readFileSync(f, 'utf8');
  const sauber = sauberVon(roh);

  // ---- Indexierbarkeit ----
  const regel = indexierbarNachRegel(url);
  if (!vorschau && regel === robotsNoindex(kopfMetas(sauber))) robotsAbweichung.push(url);
  if (regel) zielseiten.push(url);

  // ---- [3] Items-Seite: Inhaltslinks, JSON-LD, Marke ----
  if (url === ITEMS_NABE[lang]) {
    const ziele = new Set();
    for (const m of inhalt(sauber).matchAll(TAG_AUF)) {
      if (m[1].toLowerCase() !== 'a') continue;
      const href = attr(m[2], 'href');
      const z = href === null ? null : folge(auflösen(href, url), url);
      if (z && z !== url) ziele.add(z);
    }
    // JSON-LD steht im Rohtext (sauberVon nimmt Skripte heraus).
    let itemPage = false;
    for (const m of roh.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
      let j = null;
      try { j = JSON.parse(m[1]); } catch { continue; }
      const typen = [j, ...(Array.isArray(j?.['@graph']) ? j['@graph'] : [])].flat().map((x) => x?.['@type']);
      if (typen.includes('ItemPage')) itemPage = true;
    }
    nabe.set(lang, { url, ziele, itemPage, regel, noindex: robotsNoindex(kopfMetas(sauber)) });
  }

  // ---- [1] Inhaltslinks ----
  // Als Quelle zaehlt nur eine Seite der oeffentlichen Struktur: was selbst
  // nicht indexierbar ist (Konto, Testpiloten-Tor, 404, Vorschau-Seiten),
  // macht eine andere Seite nicht auffindbar.
  if (regel) {
    const ziele = new Set();
    const rumpf = inhalt(sauber);
    let marke = null;
    for (const m of rumpf.matchAll(TAG_AUF)) {
      marke ??= rahmenMarke(m[2]) || null;
      if (m[1].toLowerCase() !== 'a') continue;
      const href = attr(m[2], 'href');
      if (href === null) continue;
      const z = folge(auflösen(href, url), url);
      if (!z || z === url) continue;
      links++;
      ziele.add(z);
    }
    if (marke) rahmenImInhalt.push(`${url} (${marke})`);
    for (const z of ziele) {
      let e = ein.get(z);
      if (!e) ein.set(z, (e = { n: 0, quellen: [] }));
      e.n++;
      if (e.quellen.length < 3) e.quellen.push(url);
    }
  }

  // ---- [2] Leisten ----
  RE.topbar.lastIndex = 0;
  const sn = RE.topbar.test(sauber);
  RE.datenleiste.lastIndex = 0;
  const ds = RE.datenleiste.test(sauber);
  if (sn) zahl.sitenav++;
  if (ds) zahl.datashell++;
  if (sn || ds) zahl.mitRahmen++;
  if (!sn && !ds) eigenerRahmen.push(url);

  // Jede Leiste steht in ihrem Rahmen: nur dort ist sie die Navigation, die
  // der Besucher oben sieht. Eine einzige Kopie im Fuss oder im Inhalt
  // bestuende sonst den Abgleich, waehrend oben die Leiste fehlt.
  const rahmenSn = sn ? elemente(sauber, RE.topbar, 'nav') : [];
  const deckSn = sn ? elemente(sauber, RE.deck, 'div') : [];
  const rahmenDs = ds ? elemente(sauber, RE.datenleiste, 'header') : [];
  const drin = (s, rahmen, wo, art) => {
    if (s && rahmen && !rahmen.some((r) => r.includes(s))) {
      leisteFalsch(art, url, `steht nicht in ${wo}`);
      return null;
    }
    return s;
  };
  const leiste = (re, tag, art, rahmen, wo) => {
    const s = drin(einzeln(sauber, re, tag, art, url), rahmen, wo, art);
    if (!s) return;
    const ist = lies(s).map((a) => [attr(a.tag, 'data-area'), attr(a.tag, 'href'), a.text]);
    if (!gleich(ist, E.leiste)) leisteFalsch(art, url, abweichung(ist, E.leiste));
    return true;
  };
  if (sn) {
    zahl.leisteSn++;
    leiste(RE.snLeiste, 'ul', 'Bereichsleiste (volle Navigation, ul.snav__areas)', rahmenSn, 'nav#topbar');
    zahl.menueSn++;
    const artSn = 'Menue (volle Navigation, nav.snav-deck__cols)';
    const deck = drin(einzeln(sauber, RE.snMenue, 'nav', artSn, url), deckSn, 'div#snavDeck', artSn);
    if (deck) {
      // Zeilen nur aus den Gruppenelementen selbst; jeder Anker des Menues,
      // der in keiner Gruppe liegt (davor, dazwischen, dahinter), ist ein Befund.
      const gruppen = elemente(deck, RE.snGruppe, 'section');
      if (ankerZahl(deck) !== gruppen.reduce((n, g) => n + ankerZahl(g), 0)) leisteFalsch(artSn, url, 'Link ausserhalb der Gruppen');
      else {
        const ist = gruppen.map((g) => {
          const name = text(innenVon(g, RE.snGName, 'span') ?? '');
          const zeilen = lies(g).map((a) => {
            const label = innenVon(a.innen, RE.snLabel, 'span');
            return [attr(a.tag, 'href'), label === null ? null : text(label)];
          });
          return [name, zeilen];
        });
        prüfeMenue(ist, E, url, lang, artSn);
      }
    }
    const artLokal = 'Lokale Leiste (volle Navigation, ul.snav__local)';
    const lokalIst = drin(einzeln(sauber, RE.snLokal, 'ul', artLokal, url, true), rahmenSn, 'nav#topbar', artLokal);
    prüfeLokal(lokalIst, url, lang, artLokal);
  }
  if (ds) {
    zahl.leisteDs++;
    leiste(RE.dsLeiste, 'ul', 'Bereichsleiste (Datenblatt, ul.dp-areas)', rahmenDs, 'header.dp-bar');
    zahl.menueDs++;
    const artDs = 'Menue (Datenblatt, .dp-menu__cols)';
    const menue = drin(einzeln(sauber, RE.dsMenue, 'div', artDs, url), rahmenDs, 'header.dp-bar', artDs);
    if (menue) {
      const gruppen = elemente(menue, RE.dsGruppe, 'div');
      if (ankerZahl(menue) !== gruppen.reduce((n, g) => n + ankerZahl(g), 0)) leisteFalsch(artDs, url, 'Link ausserhalb der Gruppen');
      else {
        const ist = gruppen.map((g) => {
          const name = text(innenVon(g, RE.dsGName, 'p') ?? '');
          return [name, lies(g).map((a) => [attr(a.tag, 'href'), a.text])];
        });
        prüfeMenue(ist, E, url, lang, artDs);
      }
    }
    const lokalIst = einzeln(sauber, RE.dsLokal, 'nav', 'Lokale Leiste (Datenblatt, nav.dp-local)', url, true);
    prüfeLokal(lokalIst, url, lang, 'Lokale Leiste (Datenblatt, nav.dp-local)');
  }
  if (url === '/index.html' || url === '/de.html') {
    zahl.start++;
    leiste(RE.pillen, 'nav', `Bereichs-Pillen der Startseite (${url})`);
  }
}

function prüfeMenue(ist, E, url, lang, art) {
  const soll = E.menue;
  if (ist.length !== soll.length) return leisteFalsch(art, url, `${ist.length} Gruppen statt ${soll.length}`);
  for (let i = 0; i < soll.length; i++) {
    const [sName, sZeilen] = soll[i];
    const [iName, iZeilen] = ist[i];
    if (sName !== null && iName !== sName) return leisteFalsch(art, url, `Gruppe ${i + 1}: „${iName}“ statt „${sName}“`);
    if (sName === null) {
      // Konto & Service: der Gruppenname kommt aus ui.ts und muss auf allen
      // Seiten einer Sprache gleich lauten.
      if (kontoGruppe[lang] === null) kontoGruppe[lang] = iName;
      else if (iName !== kontoGruppe[lang]) return leisteFalsch(art, url, `Gruppe Konto: „${iName}“ statt „${kontoGruppe[lang]}“`);
    }
    if (iZeilen.length !== sZeilen.length) return leisteFalsch(art, url, `Gruppe „${iName}“: ${iZeilen.length} Eintraege statt ${sZeilen.length}`);
    for (let k = 0; k < sZeilen.length; k++) {
      const [sHref, sTxt, sKey] = sZeilen[k];
      let [iHref, iTxt] = iZeilen[k];
      if (sKey === 'feedback') {
        // A8: Feedback nimmt die Seite mit (?seite=), ausser auf sich selbst.
        if (!iHref) return leisteFalsch(art, url, `Gruppe „${iName}“, Eintrag ${k + 1}: Feedback ohne href`);
        const [basis, q] = iHref.split('?');
        const seite = q && new URLSearchParams(q).get('seite');
        const selbst = grundform(url) === '/feedback.html';
        if (basis !== E.feedback || (selbst ? !!q : !seite || ziel(seite) !== url))
          return leisteFalsch(art, url, `Feedback-Ziel ${iHref} (Soll ${E.feedback}${selbst ? '' : `?seite=${url}`})`);
        iHref = sHref;
      }
      if (iHref !== sHref || iTxt !== sTxt) return leisteFalsch(art, url, `Gruppe „${iName}“, Eintrag ${k + 1}: ${kurz([iHref, iTxt])} statt ${kurz([sHref, sTxt])}`);
    }
  }
}

function prüfeLokal(stueck, url, lang, art) {
  const lokal = B.lokaleLeiste(url, lang);
  if (!lokal && !stueck) return;
  zahl.lokal++;
  if (lokal && !stueck) return leisteFalsch(art, url, `fehlt (Soll: ${lokal.bereich.name})`);
  if (!lokal && stueck) return leisteFalsch(art, url, 'steht da, obwohl die Seite keine hat');
  const ist = lies(stueck).map((a) => [attr(a.tag, 'href'), a.text, attr(a.tag, 'aria-current')]);
  const soll = lokal.bereich.seiten.map((z) => [z.href, z.name, z.key === lokal.aktiv ? 'page' : null]);
  if (!gleich(ist, soll)) leisteFalsch(art, url, abweichung(ist, soll));
}

// ---- Suchregister ----
for (const lang of ['en', 'de']) {
  const datei = join(DIST, lang === 'de' ? 'de' : '', 'search-index.json');
  const art = `Werkzeuge im Suchregister (${lang === 'de' ? 'de/' : ''}search-index.json)`;
  zahl.such++;
  if (!existsSync(datei)) {
    leisteFalsch(art, datei, 'Datei fehlt');
    continue;
  }
  const ist = JSON.parse(readFileSync(datei, 'utf8')).filter((e) => e.k === 'werkzeug').map((e) => [e.t, e.s, e.u]);
  const soll = ERWARTET[lang].such;
  if (!gleich(ist, soll)) leisteFalsch(art, lang, abweichung(ist, soll));
}

/* ---------- Bericht ---------- */

const START = new Set(['/index.html', '/de.html']);
const waisen = [];
const nurStart = [];
const ausnahmeTreffer = new Map(AUSNAHMEN.map((a) => [a, []]));
for (const url of zielseiten) {
  // Die Startseiten sind die Wurzel des Baums, sie brauchen keinen Weg hinein.
  if (START.has(url)) continue;
  const e = ein.get(url);
  const ausnahme = AUSNAHMEN.find((a) => a.muster.test(url));
  if (ausnahme) {
    ausnahmeTreffer.get(ausnahme).push({ url, n: e?.n ?? 0 });
    continue;
  }
  if (!e) waisen.push(url);
  else if (e.quellen.every((q) => START.has(q)) && e.n <= 2) nurStart.push(url);
}

console.log(`verify:ia — dist/ (${vorschau ? 'Vorschau-Bau' : 'Live-Bau'})`);
// Werkzeug: `--quellen /pfad.html` nennt, woher eine Seite Inhaltslinks hat.
const qi = process.argv.indexOf('--quellen');
if (qi > 0) {
  const q = process.argv[qi + 1];
  const e = ein.get(q);
  console.log(`\n    ${q}: ${e ? `${e.n} Seite(n) mit Inhaltslink, z. B. ${e.quellen.join(', ')}` : 'kein Inhaltslink'}`);
}
console.log(`\n[1] Jede indexierbare Seite hat einen eingehenden Inhaltslink`);
console.log(`    Seiten: ${gesamt} (Klinke ${KLINKE.seiten}), Weiterleitungen uebersprungen: ${umleitungen}`);
console.log(`    Zielseiten (indexierbar): ${zielseiten.length} (Klinke ${KLINKE.zielseiten}), davon 2 Startseiten als Wurzel`);
console.log(`    Inhaltslinks aus Zielseiten auf eigene Seiten: ${links} (Klinke ${KLINKE.inhaltslinks})`);
console.log(`    Zielseiten ohne Inhaltslink — Soll: 0   Ist: ${waisen.length}`);
for (const w of waisen.slice(0, 40)) console.log(`      ${w}`);
if (waisen.length > 40) console.log(`      … und ${waisen.length - 40} weitere`);
console.log(`    nur von der Startseite verlinkt (Hinweis, kein Fehler): ${nurStart.length}${nurStart.length ? ' — ' + nurStart.join(', ') : ''}`);
if (gesamt < KLINKE.seiten) fail(`nur ${gesamt} Seiten gelesen, erwartet mindestens ${KLINKE.seiten} — laeuft die Pruefung leer?`);
if (zielseiten.length < KLINKE.zielseiten) fail(`nur ${zielseiten.length} Zielseiten, erwartet mindestens ${KLINKE.zielseiten}`);
if (links < KLINKE.inhaltslinks) fail(`nur ${links} Inhaltslinks gefunden, erwartet mindestens ${KLINKE.inhaltslinks} — schneidet der Rahmen-Filter zu viel weg?`);
console.log(`    Rahmen-Teile, die nach dem Schnitt noch im Inhalt stehen — Soll: 0   Ist: ${rahmenImInhalt.length}`);
if (rahmenImInhalt.length) fail(`Rahmen-Filter greift nicht: ${rahmenImInhalt.slice(0, 5).join(', ')} — RAHMEN in diesem Skript an das neue Markup anpassen`);
if (waisen.length) fail(`${waisen.length} indexierbare Seite(n) ohne einen einzigen Inhaltslink: ${waisen.slice(0, 8).join(', ')}${waisen.length > 8 ? ' …' : ''} — von einer passenden Seite aus verlinken (Menue, Leisten, Fuss und Suche zaehlen nicht)`);

console.log(`\n[1b] Ausnahmen (benannt, mit Zombie-Waechter): ${AUSNAHMEN.length}`);
for (const a of AUSNAHMEN) {
  const t = ausnahmeTreffer.get(a);
  console.log(`    ${a.muster}: ${t.length} Seite(n) — ${a.anlass}`);
  if (!t.length && !(a.nurVorschau && !vorschau)) fail(`Ausnahme ${a.muster} trifft keine Zielseite mehr — Anlass weg, Ausnahme streichen`);
  const verlinkt = t.filter((x) => x.n > 0);
  if (verlinkt.length) fail(`Ausnahme ${a.muster}: ${verlinkt.map((x) => x.url).slice(0, 3).join(', ')} hat inzwischen einen Inhaltslink — Ausnahme streichen`);
}

console.log(`\n[1c] Indexierbarkeit: Regel gegen robots-Marke`);
if (vorschau) console.log('    Vorschau-Bau: jede Seite traegt noindex; es gilt die Regel des Live-Baus (geprueft, wenn das Tor den Live-Bau sieht).');
else {
  console.log(`    Seiten, bei denen Regel und robots-Marke auseinanderlaufen — Soll: 0   Ist: ${robotsAbweichung.length}`);
  if (robotsAbweichung.length) fail(`Indexierbarkeit nach Regel und robots-Marke weichen ab: ${robotsAbweichung.slice(0, 8).join(', ')} — NOINDEX_PATHS in src/lib/seo.ts oder diese Regel nachziehen`);
}

console.log(`\n[2] Leisten und Menues stimmen mit der Bereichsliste (src/lib/bereiche.ts)`);
console.log(`    Seiten mit voller Navigation: ${zahl.sitenav}, mit Datenleiste: ${zahl.datashell}, mit einem von beiden: ${zahl.mitRahmen} (Klinke ${KLINKE.rahmen})`);
console.log(`    mit eigenem Rahmen, ohne diese Leisten: ${eigenerRahmen.length}`);
// Eine Ausnahme nur fuer den Vorschau-Bau gilt im Live-Bau nicht: steht
// dort eine solche Seite, ist sie unbenannt.
const RAHMENLOS_AKTIV = RAHMENLOS.filter((r) => !r.nurVorschau || vorschau);
for (const r of RAHMENLOS) {
  const aktiv = RAHMENLOS_AKTIV.includes(r);
  const t = aktiv ? eigenerRahmen.filter((u) => r.muster.test(u)) : [];
  console.log(`      ${r.muster}: ${aktiv ? `${t.length} Seite(n)` : 'nur im Vorschau-Bau'} — ${r.anlass}`);
  if (aktiv && !t.length) fail(`Ausnahme ohne Leisten ${r.muster} trifft keine Seite mehr — Anlass weg, Ausnahme streichen`);
}
const unbenannt = eigenerRahmen.filter((u) => !RAHMENLOS_AKTIV.some((r) => r.muster.test(u)));
if (unbenannt.length) fail(`${unbenannt.length} Seite(n) ohne volle Navigation und ohne Datenleiste: ${unbenannt.slice(0, 8).join(', ')} — Navigation einbauen oder als benannte Ausnahme mit Anlass eintragen`);
console.log(`    geprueft: ${zahl.leisteSn + zahl.leisteDs} Bereichsleisten, ${zahl.menueSn + zahl.menueDs} Menues, ${zahl.lokal} lokale Leisten (Klinke ${KLINKE.lokal}), ${zahl.start} Startseiten, ${zahl.such} Suchregister`);
const rahmen = zahl.mitRahmen;
if (rahmen < KLINKE.rahmen) fail(`nur ${rahmen} Seiten mit Navigation erkannt, erwartet mindestens ${KLINKE.rahmen} — hat sich das Markup der Leisten geaendert?`);
if (zahl.start !== 2) fail(`Startseiten gefunden: ${zahl.start} statt 2`);
if (zahl.lokal < KLINKE.lokal) fail(`nur ${zahl.lokal} lokale Leisten geprueft, erwartet mindestens ${KLINKE.lokal}`);
console.log(`    abweichende Leisten — Soll: 0   Ist: ${[...leistenFehler.values()].reduce((n, v) => n + v.seiten.length, 0)}`);
for (const [art, v] of leistenFehler) {
  console.log(`      ${art}: an ${v.seiten.length} Stelle(n), z. B. ${v.seiten.slice(0, 3).join(', ')}`);
  console.log(`        erster Befund: ${v.detail}`);
  fail(`${art} weicht an ${v.seiten.length} Stelle(n) von der Bereichsliste ab (${v.seiten[0]}: ${v.detail})`);
}
console.log('    nicht hier: die TERM-Leiste des Hangar-Terminals (eigener Rahmen, Hangar-Threads)');

console.log(`\n[3] Items-Seite: indexierbar, ItemPage-JSON-LD, Inhaltslink auf jede Kategorieliste`);
// Sitemaps: der Vorschau-Bau schreibt sie leer (src/lib/sitemap.ts).
const sitemapLocs = new Set();
if (!vorschau) {
  for (const f of readdirSync(DIST).filter((n) => /^sitemap.*\.xml$/.test(n))) {
    for (const m of readFileSync(join(DIST, f), 'utf8').matchAll(/<loc>\s*https?:\/\/[^/<\s]+(\/[^<\s]*)\s*<\/loc>/g)) sitemapLocs.add(m[1]);
  }
}
for (const lang of ['en', 'de']) {
  const n = nabe.get(lang);
  if (!n) { fail(`[3] ${ITEMS_NABE[lang]} fehlt im Bau oder ist eine Weiterleitung — die Items-Seite ist der Weg in die Kategorielisten`); continue; }
  // Lange Listen sind geblaettert (armour-arms.html, armour-arms-2.html …):
  // die Items-Seite verlinkt die erste Seite jeder Kategorie, die weiteren
  // erreicht man von dort ([1] haelt fest, dass sie einen Inhaltslink haben).
  const alle = new Set(zielseiten.filter((u) => KATEGORIE[lang].test(u)));
  const kategorien = [...alle].filter((u) => {
    const m = /^(.*)-(\d+)\.html$/.exec(u);
    return !(m && Number(m[2]) >= 2 && alle.has(`${m[1]}.html`));
  });
  const fehlend = kategorien.filter((u) => !n.ziele.has(u));
  const inSitemap = vorschau ? null : sitemapLocs.has(n.url);
  console.log(`    ${n.url}: Kategorielisten ${kategorien.length} (Klinke ${KLINKE.kategorien}; dazu ${alle.size - kategorien.length} Folgeseiten), davon im Inhalt verlinkt ${kategorien.length - fehlend.length}; ItemPage ${n.itemPage ? 'ja' : 'NEIN'}; indexierbar nach Regel ${n.regel ? 'ja' : 'NEIN'}${vorschau ? '; Marke und Sitemap: Vorschau-Bau, geprueft im Live-Bau' : `; noindex-Marke ${n.noindex ? 'JA' : 'nein'}; in der Sitemap ${inSitemap ? 'ja' : 'NEIN'}`}`);
  if (kategorien.length < KLINKE.kategorien) fail(`[3] nur ${kategorien.length} Kategorielisten (${lang}), erwartet mindestens ${KLINKE.kategorien} — laeuft die Pruefung leer?`);
  if (fehlend.length) fail(`[3] ${n.url} verlinkt ${fehlend.length} Kategorieliste(n) nicht im Inhalt: ${fehlend.slice(0, 5).join(', ')}${fehlend.length > 5 ? ' …' : ''} — die Leiste der Items-Werkbank muss jede Kategorie als <a href> tragen`);
  if (!n.itemPage) fail(`[3] ${n.url} traegt kein ItemPage-JSON-LD — itemPage am Layout der Items-Seite setzen`);
  if (!n.regel) fail(`[3] ${n.url} ist nach der Regel nicht indexierbar (NOINDEX_PATHS oder Vorschau-Liste) — die Items-Seite muss in die Suche`);
  if (!vorschau && n.noindex) fail(`[3] ${n.url} traegt robots noindex`);
  if (!vorschau && !inSitemap) fail(`[3] ${n.url} steht in keiner Sitemap`);
}

if (!ok) {
  console.error('\nverify:ia ROT.');
  for (const b of befunde) console.error(`  FEHLER: ${b}`);
  process.exit(1);
}
console.log('\nverify:ia gruen — keine Waisen, und jede Leiste zeigt die eine Bereichsliste.');
