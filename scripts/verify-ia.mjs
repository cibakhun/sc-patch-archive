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
       traegt (Hangar, Items-Werkbank, Vorschau-Patches). Im Live-Bau prueft
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
       Werkzeug-Eintraege beider Suchregister (suchZiele()). Verglichen
       werden Schluessel, Adresse und Name in Reihenfolge; Feedback traegt
       die eigene Seite als ?seite= (A8). Nicht hier: die TERM-Leiste des
       Hangar-Terminals (eigener Rahmen, bei den Hangar-Threads).

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
import { hangarImArtefakt, HANGAR_DIST_DIRS, HANGAR_DIST_FILES } from './lib/hangar-switch.mjs';
import { VORSCHAU_DIST_FILES } from './lib/vorschau-seiten.mjs';
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
};

/* ---------- Ausnahmen fuer [1] (benannt, mit Zombie-Waechter) ---------- */
const AUSNAHMEN = [
  {
    muster: /^\/(?:de\/)?impressum\.html$/,
    anlass:
      'Impressum: sein Ort ist der Fuss jeder Seite (verify:rechtsfuss haelt das fest), ein Inhaltslink dorthin waere kuenstlich. Die Datenschutzerklaerung braucht die Ausnahme nicht, sie wird aus Formularen und Datenblaettern verlinkt.',
  },
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
const vorschau = hangarImArtefakt(DIST);
// seo.ts liest STAGING beim Laden (HAS_HANGAR): die Quelle muss denselben
// Stand sehen wie der Bau, der in dist/ liegt.
if (vorschau) process.env.STAGING = '1';
else delete process.env.STAGING;

const tmp = mkdtempSync(join(tmpdir(), 'verify-ia-'));
let B, SEO;
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
  console.error('verify:ia: src/lib/bereiche.ts liess sich nicht buendeln — das Tor kann die echte Liste nicht pruefen.');
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
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

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const text = (s) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
      e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
const ATTRRE = new Map();
const attr = (tag, name) => {
  let re = ATTRRE.get(name);
  if (!re) ATTRRE.set(name, (re = new RegExp(`\\s${name}="([^"]*)"`)));
  const m = tag.match(re);
  return m ? text(m[1]) : null;
};

/** Ende des Elements, das bei `start` mit <tag oeffnet (gleichnamige Tags gezaehlt). */
const TAGRE = new Map();
function ende(html, start, tag) {
  let re = TAGRE.get(tag);
  if (!re) TAGRE.set(tag, (re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g')));
  re.lastIndex = start;
  let tiefe = 0;
  for (let m; (m = re.exec(html)); ) {
    tiefe += m[1] ? -1 : 1;
    if (tiefe === 0) return re.lastIndex;
  }
  return html.length;
}

/** Ein Element als Text: von seinem Anfang bis zum passenden End-Tag. */
function element(html, re, tag) {
  re.lastIndex = 0;
  const m = re.exec(html);
  return m ? html.slice(m.index, ende(html, m.index, tag)) : null;
}

/** Oeffnendes <tag> mit dieser Klasse, auch neben weiteren Klassen. */
const mitKlasse = (tag, klasse) => new RegExp(`<${tag}\\b[^>]*\\bclass="(?:[^"]*\\s)?(?:${klasse})(?:\\s[^"]*)?"[^>]*>`, 'g');
const RE = {
  datenleiste: mitKlasse('header', 'dp-bar'),
  snLeiste: mitKlasse('ul', 'snav__areas'),
  snMenue: mitKlasse('nav', 'snav-deck__cols'),
  snLokal: mitKlasse('ul', 'snav__local'),
  dsLeiste: mitKlasse('ul', 'dp-areas'),
  dsMenue: mitKlasse('div', 'dp-menu__cols'),
  dsLokal: mitKlasse('nav', 'dp-local'),
  pillen: mitKlasse('nav', 'hero__areas'),
};

// Was auf jeder Seite gleich steht und darum kein Inhalt ist.
const RAHMEN = [
  [/<nav\b[^>]*\bid="topbar"[^>]*>/g, 'nav'],
  [/<div\b[^>]*\bid="snavDeck"[^>]*>/g, 'div'],
  [RE.datenleiste, 'header'],
  [mitKlasse('nav', 'dp-local|hero__areas'), 'nav'],
  [/<footer\b[^>]*>/g, 'footer'],
];
const OHNE = /<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/g;
// Gegenprobe: keines dieser Rahmen-Teile darf nach dem Schnitt im Inhalt
// stehen. Aendert sich das Markup einer Leiste so, dass RAHMEN sie nicht
// mehr trifft, zaehlten ihre Links still als Inhalt und das Tor waere
// falsch gruen; so reisst es stattdessen.
const RAHMEN_MARKE = /\bclass="(?:[^"]*\s)?(snav__areas|snav__back|snav__local|snav-deck__cols|dp-areas|dp-menu|dp-crumbs|dp-local|hero__areas)(?:\s[^"]*)?"/;

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
function auflösen(href, von) {
  href = text(href);
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

const NUR_VORSCHAU = new Set([...VORSCHAU_DIST_FILES, ...VORSCHAU_PATCH_DIST_FILES].map((f) => '/' + f));
const nurVorschau = (url) => {
  const rel = url.slice(1);
  return NUR_VORSCHAU.has(url) || HANGAR_DIST_FILES.test(rel) || HANGAR_DIST_DIRS.some((d) => rel.startsWith(d));
};
const grundform = (url) => (url === '/de.html' ? '/index.html' : url.startsWith('/de/') ? url.slice(3) : url);
/** Die Regel, die der Live-Bau anwendet (Layout.astro, isNoindex, 404-Prop). */
const indexierbarNachRegel = (url) => url !== '/404.html' && !SEO.NOINDEX_PATHS.has(grundform(url)) && !nurVorschau(url);
const ROBOTS_NOINDEX = /<meta\s+name="robots"\s+content="[^"]*noindex/i;
const REFRESH = /<meta[^>]+http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/i;

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
const zielseiten = [];
let gesamt = 0;
let umleitungen = 0;
let links = 0;
const umleitung = new Map();
const robotsAbweichung = [];
const eigenerRahmen = [];
const rahmenImInhalt = [];
const zahl = { sitenav: 0, datashell: 0, leisteSn: 0, leisteDs: 0, menueSn: 0, menueDs: 0, lokal: 0, start: 0, such: 0 };
const leistenFehler = new Map(); // Art -> [Seiten]
const leisteFalsch = (art, url, detail) => {
  if (!leistenFehler.has(art)) leistenFehler.set(art, { seiten: [], detail });
  leistenFehler.get(art).seiten.push(url);
};

// Erster Durchgang: Weiterleitungen kennen, bevor Links aufgeloest werden.
const html = new Map();
for (const f of dateien) {
  const url = urlVon(f);
  const roh = readFileSync(f, 'utf8');
  const r = roh.slice(0, 4000).match(REFRESH);
  if (r) {
    umleitungen++;
    umleitung.set(url, r[1].trim());
    continue;
  }
  html.set(url, f);
}
const folge = (z, von) => {
  if (z && umleitung.has(z)) return auflösen(umleitung.get(z), z);
  return z;
};

const AREA_A = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
const lies = (stueck) => [...stueck.matchAll(AREA_A)].map((m) => ({ tag: m[1], text: text(m[2]) }));

for (const [url, f] of html) {
  gesamt++;
  const lang = url === '/de.html' || url.startsWith('/de/') ? 'de' : 'en';
  const E = ERWARTET[lang];
  const roh = readFileSync(f, 'utf8');
  const sauber = roh.replace(OHNE, '');

  // ---- Indexierbarkeit ----
  const regel = indexierbarNachRegel(url);
  if (!vorschau && regel === ROBOTS_NOINDEX.test(roh)) robotsAbweichung.push(url);
  if (regel) zielseiten.push(url);

  // ---- [1] Inhaltslinks ----
  // Als Quelle zaehlt nur eine Seite der oeffentlichen Struktur: was selbst
  // nicht indexierbar ist (Konto, Testpiloten-Tor, 404, Vorschau-Seiten),
  // macht eine andere Seite nicht auffindbar.
  if (regel) {
    const ziele = new Set();
    const rumpf = inhalt(sauber);
    const marke = rumpf.match(RAHMEN_MARKE);
    if (marke) rahmenImInhalt.push(`${url} (${marke[1]})`);
    for (const m of rumpf.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)) {
      const z = folge(auflösen(m[1], url), url);
      if (!z || z === url) continue;
      links++;
      ziele.add(z);
    }
    for (const z of ziele) {
      let e = ein.get(z);
      if (!e) ein.set(z, (e = { n: 0, quellen: [] }));
      e.n++;
      if (e.quellen.length < 3) e.quellen.push(url);
    }
  }

  // ---- [2] Leisten ----
  const sn = /<nav\b[^>]*\bid="topbar"/.test(sauber);
  RE.datenleiste.lastIndex = 0;
  const ds = RE.datenleiste.test(sauber);
  if (sn) zahl.sitenav++;
  if (ds) zahl.datashell++;
  if (!sn && !ds) eigenerRahmen.push(url);

  const leiste = (re, tag, art) => {
    const s = element(sauber, re, tag);
    if (!s) return leisteFalsch(art, url, 'fehlt');
    const ist = lies(s).map((a) => [attr(a.tag, 'data-area'), attr(a.tag, 'href'), a.text]);
    if (!gleich(ist, E.leiste)) leisteFalsch(art, url, abweichung(ist, E.leiste));
    return true;
  };
  if (sn) {
    zahl.leisteSn++;
    leiste(RE.snLeiste, 'ul', 'Bereichsleiste (volle Navigation, ul.snav__areas)');
    zahl.menueSn++;
    const deck = element(sauber, RE.snMenue, 'nav');
    if (!deck) leisteFalsch('Menue (volle Navigation, nav.snav-deck__cols)', url, 'fehlt');
    else {
      const ist = deck.split(/<section\b[^>]*\bclass="snav-deck__group"/).slice(1).map((g) => {
        const name = text((g.match(/<span class="snav-deck__gname"[^>]*>([\s\S]*?)<\/span>/) || [])[1] ?? '');
        const zeilen = [...g.matchAll(/<a\b([^>]*)>[\s\S]*?<span class="snav-deck__label[^"]*"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => [attr(m[1], 'href'), text(m[2])]);
        return [name, zeilen];
      });
      prüfeMenue(ist, E, url, lang, 'Menue (volle Navigation, nav.snav-deck__cols)');
    }
    const lokalIst = element(sauber, RE.snLokal, 'ul');
    prüfeLokal(lokalIst, url, lang, 'Lokale Leiste (volle Navigation, ul.snav__local)');
  }
  if (ds) {
    zahl.leisteDs++;
    leiste(RE.dsLeiste, 'ul', 'Bereichsleiste (Datenblatt, ul.dp-areas)');
    zahl.menueDs++;
    const menue = element(sauber, RE.dsMenue, 'div');
    if (!menue) leisteFalsch('Menue (Datenblatt, .dp-menu__cols)', url, 'fehlt');
    else {
      const ist = menue.split(/<div\b[^>]*\bclass="dp-menu__grp"/).slice(1).map((g) => {
        const name = text((g.match(/<p class="dp-menu__h"[^>]*>([\s\S]*?)<\/p>/) || [])[1] ?? '');
        return [name, lies(g).map((a) => [attr(a.tag, 'href'), a.text])];
      });
      prüfeMenue(ist, E, url, lang, 'Menue (Datenblatt, .dp-menu__cols)');
    }
    const lokalIst = element(sauber, RE.dsLokal, 'nav');
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
console.log(`    Seiten mit voller Navigation: ${zahl.sitenav}, mit Datenleiste: ${zahl.datashell} (Klinke ${KLINKE.rahmen} zusammen)`);
console.log(`    mit eigenem Rahmen, ohne diese Leisten: ${eigenerRahmen.length}`);
for (const r of RAHMENLOS) {
  const t = eigenerRahmen.filter((u) => r.muster.test(u));
  console.log(`      ${r.muster}: ${t.length} Seite(n) — ${r.anlass}`);
  if (!t.length && !(r.nurVorschau && !vorschau)) fail(`Ausnahme ohne Leisten ${r.muster} trifft keine Seite mehr — Anlass weg, Ausnahme streichen`);
}
const unbenannt = eigenerRahmen.filter((u) => !RAHMENLOS.some((r) => r.muster.test(u)));
if (unbenannt.length) fail(`${unbenannt.length} Seite(n) ohne volle Navigation und ohne Datenleiste: ${unbenannt.slice(0, 8).join(', ')} — Navigation einbauen oder als benannte Ausnahme mit Anlass eintragen`);
console.log(`    geprueft: ${zahl.leisteSn + zahl.leisteDs} Bereichsleisten, ${zahl.menueSn + zahl.menueDs} Menues, ${zahl.lokal} lokale Leisten (Klinke ${KLINKE.lokal}), ${zahl.start} Startseiten, ${zahl.such} Suchregister`);
const rahmen = zahl.sitenav + zahl.datashell;
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

if (!ok) {
  console.error('\nverify:ia ROT.');
  for (const b of befunde) console.error(`  FEHLER: ${b}`);
  process.exit(1);
}
console.log('\nverify:ia gruen — keine Waisen, und jede Leiste zeigt die eine Bereichsliste.');
