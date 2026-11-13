/* ============================================================
   verify-hangar-orte.mjs — Tor fuer die Orte der Halle und das Terminal
   im Leitstand (Schiene A, nur mit Hangar).

   WARUM ES DEN GIBT: Seit dem 13.11.2026 nennt die Leiste am Buehnenfuss
   des Hangars drei Orte (Schiffsfeld, Werkhalle, Leitstand), und im
   Leitstand zeigt ein Terminal die Seiten der Website in einem Fenster,
   das genau auf dem Schirm der Halle liegt (Krisz: „da oben ist ein menü
   wo man so hin und her switchen kann ohne seite nezuladen“). Vier Teile
   haengen dafuer nur ueber Namen und Zahlen zusammen: das Markup der
   Seite (HangarPage.astro), der Controller (hangar-overview.js), das
   Terminal (hangar-terminal.js) und die Buehne (hangar-viewer.js). Reisst
   eine Stelle, faehrt die Kamera vor einen leeren Schirm, liegt das
   Fenster neben dem Schirm, fuehrt ein Reiter ins Leere oder laedt das
   Fenster eine zweite Halle — und jede Aufnahme des Schiffsfelds sieht
   trotzdem gut aus.

   Dieses Tor liest das ARTEFAKT: dist/hangar.html und dist/de/hangar.html,
   die ausgelieferten Module unter dist/assets/ (in Node geladen, ihre
   reinen Funktionen gerufen) und die Rahmen-Dateien unter dist/_csp/.

   ZUSICHERUNGEN
     [1] Leiste: beide Hangarseiten tragen in #hgx-st vor den Stationen
         die Gruppe #hgx-orte, anfangs verborgen, mit genau den Orten
         halle, werk, leit in dieser Folge, jeder beschriftet; dazu die
         beiden Ansagen fuer Vorleser.
     [2] Terminal im Markup: #hgx-term anfangs verborgen, sein Modul als
         versionierte URL, deren Version der Inhalt der ausgelieferten
         Datei ist; ein Fenster OHNE Adresse (die Halle laedt keine zweite
         Seite, solange niemand im Leitstand steht) mit Namen und Titel;
         Zurueck-Pfeil, Suche, „eigener Tab“ und der Text fuer den Fall,
         dass sich die Seite nicht rahmen laesst.
     [3] Reiter: mindestens MIN_BEREICHE je Seite, Schluessel einmalig,
         jeder zielt ins Fenster, fuehrt auf eine Seite, die in dist/
         liegt, in der Sprache der Hangarseite, bleibt im Fenster
         (termRoute) und markiert sich selbst (termTool mit seinen
         Pfad-Anfaengen); data-home nennt einen von ihnen.
     [4] Reine Funktionen des ausgelieferten Terminals: Der Kasten deckt
         das Rechteck des Schirms (Breite mal Massstab), steht in voller
         Breite, solange der Massstab TERM_MIN_K haelt, darunter schmaler
         und nie in der Telefonansicht; Links zum Hangar, zum Konto und nach
         draussen verlassen das Fenster, Seiten der Website bleiben; das
         Stilblatt fuer die Seite im Fenster nimmt Kopfzeile und
         Vorschau-Marke heraus.
     [5] Geometrie der Buehne: Fuer viele Fenstergroessen und freie
         Rechtecke steht die Kamera aus leitFit so, dass der Schirm im
         Bild genau das gemeldete Rechteck ist (nachgerechnet mit der
         Zentralprojektion), im freien Stueck liegt, der Bildwinkel unter
         LEIT_FOV_MAX bleibt (auch in hohen, schmalen Fenstern, wo der
         Schirm dafuer in Metern kleiner wird) und die Kamera im Raum des
         Leitstands steht
         (HALL_LEIT.raum, mit Abstand zu Glas, Wand, Boden und Decke);
         beide Enden des erlaubten Abstands (HALL_LEIT.d) liegen im Raum.
     [6] Naht: Die Buehne liefert place, canPlace und onPlace, der
         Controller ruft sie und laedt das Terminal ueber data-js; der
         Zustand ?ort=leit ueberlebt die Adresse, steht nicht im geteilten
         Link und gilt nicht fuer Bodenfahrzeuge.
     [7] Rahmen: Dieser Bau erlaubt der eigenen Seite das Rahmen
         (dist/_csp/, scripts/lib/rahmen.mjs). Sonst bliebe der Schirm
         leer; audit:csp prueft dieselben Dateien in beide Richtungen.

   Selbstauskunft mit Klinken (nur nach oben; nach unten nur per Commit
   mit Ursache). Kein git, kein Netz, kein Kindprozess.

   VORGEFUEHRT ROT (13.11.2026), je ein Eingriff am gebauten dist/,
   dreizehn Laeufe:
     a  dist/de/hangar.html: dem Fenster src="/de/archiv.html" gegeben;
        den Reiter Missionen auf /de/missionen-alt.html gebogen;
        data-ort="werk" gestrichen
     b  dist/assets/hangar-terminal.js: TERM_MIN_W auf 0; TERM_MIN_K auf
        0.5; termFrame ohne die schmale Stufe; in termRoute die Zeile fuer
        /hangar.html entfernt; in TERM_CSS die Kopfzeile (#topbar)
        gestrichen
     c  dist/assets/hangar-viewer.js: in leitFit das Vorzeichen von dx
        gedreht; die Klemme auf LEIT_LUFT ausgeschaltet; d auf [2.3, 12]
        geweitet. Der letzte Eingriff blieb im ersten Lauf GRUEN: das
        Raster erreicht das ferne Ende des Abstands nicht. Seither prueft
        [5] beide Enden von d selbst gegen den Raum. Nach dem Review der
        PR (hohe, schmale Fenster): das Schrumpfen des Schirms am
        begrenzten Bildwinkel gestrichen.
     d  dist/_csp/frame-ancestors.conf auf 'none' gestellt
   Die Meldungen stehen in der PR, die dieses Tor eingefuehrt hat.

     node scripts/verify-hangar-orte.mjs
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RAHMEN } from './lib/rahmen.mjs';
import { leseMapWert, CSP_ORDNER } from './lib/csp-inline.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// Klinken
const MIN_BEREICHE = 7;    // Reiter des Terminals je Seite (13.11.2026: 7)
const MIN_FIT_PROBEN = 600; // Stellungen der Kamera, die [5] nachrechnet (13.11.2026: 432, mit hohen Fenstern 624)
const MIN_FIT_ENG = 60;     // davon mit begrenztem Bildwinkel: dort schrumpft der Schirm (13.11.2026: 66)
const MIN_WEG_PROBEN = 14;  // Links, die [4] durch termRoute schickt

const fehler = [];
const fail = (m) => fehler.push(m);
const say = (m) => console.log(m);

const PAGES = [
  { file: 'hangar.html', de: false },
  { file: 'de/hangar.html', de: true },
].map((p) => ({ ...p, html: existsSync(join(DIST, p.file)) ? readFileSync(join(DIST, p.file), 'utf8') : null }));
if (PAGES.some((p) => p.html === null)) {
  console.error('verify-hangar-orte: dist/hangar.html oder dist/de/hangar.html fehlt — erst als Vorschau bauen (STAGING=1 npm run build).');
  process.exit(1);
}

const attr = (tag, name) => new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>])`).exec(tag);
const wert = (tag, name) => attr(tag, name)?.[1] ?? null;
const hat = (tag, name) => attr(tag, name) !== null;
// Sichtbarer Text einer Beschriftung: Markup heraus, bis nichts mehr faellt
// (ein Durchgang allein kann aus Resten ein neues Tag zusammensetzen)
const text = (s) => {
  let t = s, vorher;
  do { vorher = t; t = t.replace(/<[^>]+>/g, ''); } while (t !== vorher);
  return t.replace(/\s+/g, ' ').trim();
};
const laden = async (rel) => {
  const f = join(DIST, rel);
  if (!existsSync(f)) { fail(`dist/${rel} fehlt`); return null; }
  try { return await import(pathToFileURL(f).href); } catch (e) { fail(`dist/${rel} laedt nicht als Modul (${e.message})`); return null; }
};

const term = await laden('assets/hangar-terminal.js');
const viewer = await laden('assets/hangar-viewer.js');
const ctrl = await laden('assets/hangar-overview.js');
const termSrc = existsSync(join(DIST, 'assets/hangar-terminal.js')) ? readFileSync(join(DIST, 'assets/hangar-terminal.js')) : null;
const termV = termSrc ? createHash('sha1').update(termSrc).digest('hex').slice(0, 8) : '';

/* ---------- [1] Leiste ---------- */
say('[1] Leiste: Orte der Halle vor den Stationen');
const ORTE = ['halle', 'werk', 'leit'];
let orte = 0;
for (const page of PAGES) {
  const bar = /id="hgx-st"[\s\S]*?id="hgx-tafel"/.exec(page.html)?.[0] ?? '';
  const box = /<div[^>]*\bid="hgx-orte"[^>]*>/.exec(bar)?.[0];
  if (!box) { fail(`[1] ${page.file}: in der Stationen-Leiste #hgx-st fehlt die Gruppe #hgx-orte (HangarPage.astro)`); continue; }
  if (!hat(box, 'hidden')) fail(`[1] ${page.file}: #hgx-orte ist nicht anfangs verborgen — ohne 3D und am Telefon stuenden Orte da, die es dort nicht gibt`);
  if (!wert(box, 'aria-label')) fail(`[1] ${page.file}: #hgx-orte hat keinen Namen (aria-label)`);
  for (const n of ['data-an-leit', 'data-an-halle']) if (!wert(box, n)?.trim()) fail(`[1] ${page.file}: #hgx-orte ohne ${n}: Vorleser erfuehren nicht, wo die Kamera steht`);
  if (bar.indexOf('id="hgx-orte"') > bar.indexOf('role="tablist"')) fail(`[1] ${page.file}: die Orte stehen nicht vor den Stationen`);
  const group = bar.slice(bar.indexOf('id="hgx-orte"'), bar.indexOf('role="tablist"'));
  const btns = [...group.matchAll(/<button[^>]*\bdata-ort="([a-z]+)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({ ort: m[1], label: text(m[2]) }));
  if (btns.map((b) => b.ort).join() !== ORTE.join()) fail(`[1] ${page.file}: Orte der Leiste (${btns.map((b) => b.ort).join(', ') || '—'}) sind nicht ${ORTE.join(', ')}`);
  for (const b of btns) {
    if (!b.label) fail(`[1] ${page.file}: Ort ${b.ort} ohne Beschriftung`);
    else orte++;
  }
}
say(`    ${orte} beschriftete Orte auf ${PAGES.length} Seiten`);

/* ---------- [2] Terminal im Markup ---------- */
say('[2] Terminal: Kasten, Fenster ohne Adresse, Modul mit Version des Inhalts');
let kaesten = 0;
const boxOf = (page) => /<section[^>]*\bid="hgx-term"[^>]*>[\s\S]*?<\/section>/.exec(page.html)?.[0] ?? '';
for (const page of PAGES) {
  const sec = boxOf(page), kopf = /^<section[^>]*>/.exec(sec)?.[0] ?? '';
  if (!sec) { fail(`[2] ${page.file}: #hgx-term fehlt (HangarPage.astro)`); continue; }
  if (!hat(kopf, 'hidden')) fail(`[2] ${page.file}: #hgx-term ist nicht anfangs verborgen`);
  if (!wert(kopf, 'aria-label')) fail(`[2] ${page.file}: #hgx-term hat keinen Namen (aria-label)`);
  const v = /^\/assets\/hangar-terminal\.js\?v=([0-9a-f]{8})$/.exec(wert(kopf, 'data-js') ?? '')?.[1];
  if (!v) fail(`[2] ${page.file}: data-js ist keine versionierte URL von /assets/hangar-terminal.js (${wert(kopf, 'data-js') ?? '—'})`);
  else if (termV && v !== termV) fail(`[2] ${page.file}: Version des Terminal-Moduls ${v}, Inhalt ${termV}: der Cache hielte den alten Stand`);
  const frames = [...sec.matchAll(/<iframe[^>]*>/g)].map((m) => m[0]);
  if (frames.length !== 1) fail(`[2] ${page.file}: #hgx-term hat ${frames.length} Fenster statt einem`);
  else {
    const f = frames[0];
    if (hat(f, 'src') || hat(f, 'srcdoc')) fail(`[2] ${page.file}: das Fenster des Terminals traegt schon im Markup eine Adresse — jede Hangarseite luede dann eine zweite Seite mit, auch ohne Besuch im Leitstand`);
    if (wert(f, 'name') !== 'hgx-term-frame') fail(`[2] ${page.file}: das Fenster heisst nicht hgx-term-frame — die Reiter zielten ins Leere`);
    if (!wert(f, 'title')?.trim()) fail(`[2] ${page.file}: das Fenster hat keinen Titel fuer Vorleser`);
  }
  for (const [id, was] of [['hgx-term-back', 'der Zurueck-Pfeil'], ['hgx-term-search', 'die Suche'], ['hgx-term-ext', '„In eigenem Tab öffnen“'], ['hgx-term-load', 'der Ladehinweis']])
    if (!sec.includes(`id="${id}"`)) fail(`[2] ${page.file}: ${was} (#${id}) fehlt im Terminal`);
  const load = /<p[^>]*\bid="hgx-term-load"[^>]*>/.exec(sec)?.[0] ?? '';
  if (load && !wert(load, 'data-fail')?.trim()) fail(`[2] ${page.file}: #hgx-term-load ohne data-fail: laesst sich die Seite nicht rahmen, stuende dort fuer immer „Seite lädt“`);
  const back = /<button[^>]*\bid="hgx-term-back"[^>]*>/.exec(sec)?.[0] ?? '';
  if (back && !wert(back, 'aria-label')?.trim()) fail(`[2] ${page.file}: der Zurueck-Pfeil hat keinen Namen`);
  kaesten++;
}
say(`    ${kaesten} von ${PAGES.length} Seiten mit Terminal, Modulversion ${termV || '—'}`);

/* ---------- [3] Reiter ---------- */
say('[3] Reiter: Ziele in dist/, in der Sprache der Seite, bleiben im Fenster, markieren sich selbst');
let reiter = 0, ziele = 0;
for (const page of PAGES) {
  const sec = boxOf(page);
  const links = [...sec.matchAll(/<a[^>]*\bdata-term="[^"]*"[^>]*>[\s\S]*?<\/a>/g)].map((m) => {
    const tag = /^<a[^>]*>/.exec(m[0])[0];
    return { key: wert(tag, 'data-term'), href: wert(tag, 'href') ?? '', target: wert(tag, 'target'), pre: (wert(tag, 'data-pre') ?? '').split(' ').filter(Boolean), label: text(m[0]) };
  });
  if (links.length < MIN_BEREICHE) fail(`[3] ${page.file}: ${links.length} Reiter, Klinke ${MIN_BEREICHE}`);
  const keys = links.map((l) => l.key);
  if (new Set(keys).size !== keys.length) fail(`[3] ${page.file}: Schluessel der Reiter nicht einmalig (${keys.join(', ')})`);
  const home = wert(/^<section[^>]*>/.exec(sec)?.[0] ?? '', 'data-home');
  if (!keys.includes(home)) fail(`[3] ${page.file}: data-home „${home ?? '—'}“ ist keiner der Reiter (${keys.join(', ')})`);
  const tools = links.map((l) => ({ key: l.key, pre: l.pre }));
  for (const l of links) {
    reiter++;
    const wo = `[3] ${page.file}: Reiter ${l.key}`;
    if (!l.label) fail(`${wo} ohne Beschriftung`);
    if (l.target !== 'hgx-term-frame') fail(`${wo} zielt nicht ins Fenster (target ${l.target ?? '—'})`);
    const pfad = l.href.split(/[?#]/)[0];
    if (!/^\/(?!\/)/.test(pfad)) { fail(`${wo}: ${l.href} ist kein Pfad dieser Seite`); continue; }
    if (/^\/de\//.test(pfad) !== page.de) fail(`${wo}: ${pfad} steht nicht in der Sprache der Hangarseite`);
    if (!existsSync(join(DIST, pfad))) fail(`${wo}: ${pfad} liegt nicht in dist/ — der Reiter fuehrte auf die Fehlerseite`);
    else ziele++;
    if (!l.pre.length) fail(`${wo} ohne data-pre: er markierte sich nie`);
    if (term) {
      const art = term.termRoute(l.href, `https://probe.invalid/${page.file}`).art;
      if (art !== 'innen') fail(`${wo}: ${l.href} bliebe nicht im Fenster (termRoute: ${art})`);
      const key = term.termTool(pfad, tools);
      if (key !== l.key) fail(`${wo}: auf seiner eigenen Seite ${pfad} waere „${key ?? 'keiner'}“ markiert (data-pre ${l.pre.join(' ') || '—'})`);
    }
  }
}
say(`    ${reiter} Reiter, ${ziele} Ziele in dist/ gefunden (Klinke ${MIN_BEREICHE} je Seite)`);

/* ---------- [4] Reine Funktionen des Terminals ---------- */
say('[4] Terminal: Kasten deckt den Schirm, Wege aus dem Fenster, Stil fuer die Seite');
let kastenProben = 0, wegProben = 0, klein = 0;
if (term) {
  const { termFrame, termRoute, TERM_MIN_W, TERM_MIN_K, TERM_NARROW_W, TERM_CSS } = term;
  if (!(TERM_MIN_W >= 1024)) fail(`[4] TERM_MIN_W ${TERM_MIN_W}: unter 1024 px steht die Seite im Fenster nie in voller Breite`);
  if (!(TERM_NARROW_W > 820 && TERM_NARROW_W < TERM_MIN_W)) fail(`[4] TERM_NARROW_W ${TERM_NARROW_W}: bis 820 px zeigt die Seite ihre Telefonansicht, die passt nicht auf den Schirm`);
  if (!(TERM_MIN_K >= 0.7 && TERM_MIN_K < 1)) fail(`[4] TERM_MIN_K ${TERM_MIN_K}: unter 0,7 ist die Schrift der Seite im Fenster nicht mehr lesbar (16 px werden unter 11 px)`);
  for (let w = 320; w <= 2560; w += 37) for (const form of [0.4, 0.5, 0.62, 0.8]) {
    kastenProben++;
    const h = w * form, f = termFrame(w, h);
    const bw = f.w * f.k, bh = f.h * f.k;
    if (!(f.k > 0 && f.k <= 1) || Math.abs(bw - Math.round(w)) > 0.01 || Math.abs(bh - Math.round(h)) > 1)
      { fail(`[4] termFrame(${w}, ${h.toFixed(1)}) → ${JSON.stringify(f)}: im Bild ${bw.toFixed(1)} × ${bh.toFixed(1)} px statt ${Math.round(w)} × ${Math.round(h)} px`); break; }
    // volle Breite, solange der Massstab reicht; schmaler erst an der Untergrenze des Massstabs; nie die Telefonansicht
    if (f.w < TERM_NARROW_W) { fail(`[4] termFrame(${w}, ${h.toFixed(1)}) → Breite ${f.w} px: unter ${TERM_NARROW_W} px stuende die Seite im Fenster in der Telefonansicht`); break; }
    if (f.k < 1 && f.w > TERM_MIN_W) { fail(`[4] termFrame(${w}, ${h.toFixed(1)}) → Breite ${f.w} px bei Massstab ${f.k.toFixed(3)}: breiter als ${TERM_MIN_W} px und trotzdem verkleinert`); break; }
    if (f.w < TERM_MIN_W && f.w > TERM_NARROW_W && Math.abs(f.k - TERM_MIN_K) > 0.002) { fail(`[4] termFrame(${w}, ${h.toFixed(1)}) → Breite ${f.w} px bei Massstab ${f.k.toFixed(3)}: schmaler als ${TERM_MIN_W} px steht die Seite nur am kleinsten Massstab ${TERM_MIN_K}`); break; }
    if (f.w === TERM_MIN_W && f.k < TERM_MIN_K - 0.002) { fail(`[4] termFrame(${w}, ${h.toFixed(1)}) → volle Breite bei Massstab ${f.k.toFixed(3)}: unter ${TERM_MIN_K} ist die Schrift der Seite nicht mehr lesbar`); break; }
    if (f.k < TERM_MIN_K - 0.002) klein++;
  }
  const hier = 'https://probe.invalid/de/hangar.html?ort=leit';
  const WEGE = [
    ['/de/schiffe/aegs-gladius.html', 'innen'], ['/items.html#waffen', 'innen'], ['/de/topics/crafting-werkbank.html?q=x', 'innen'],
    ['/de/archiv.html', 'innen'], ['mailto:hallo@example.org', 'innen'], ['/de/support.html', 'innen'],
    ['/de/hangar.html?ship=anvl-arrow', 'hangar'], ['/hangar.html', 'hangar'], ['https://probe.invalid/hangar.html?ship=x', 'hangar'],
    ['/de/hangar-loadout.html?l=abc', 'tab'], ['/hangar-bay/aegs-gladius', 'tab'], ['/de/account.html', 'tab'], ['/account/profil.html', 'tab'],
    ['https://robertsspaceindustries.com/', 'tab'], ['//probe.invalid.evil.test/de/schiffe.html', 'tab'], ['http://probe.invalid/de/schiffe.html', 'tab'],
  ];
  for (const [href, soll] of WEGE) {
    wegProben++;
    const ist = termRoute(href, hier);
    if (ist.art !== soll) fail(`[4] termRoute(${href}) → ${ist.art}, Soll ${soll}${soll === 'hangar' ? ': ein Link zum Hangar luede eine zweite Halle ins Fenster' : soll === 'tab' ? ': die Seite gehoert nicht ins Fenster' : ': die Seite verliesse das Terminal'}`);
  }
  if (termRoute('/de/hangar.html?ship=anvl-arrow', hier).ship !== 'anvl-arrow') fail('[4] termRoute nennt das Schiff eines Hangar-Links nicht: „Im Hangar ansehen“ holte es nicht aufs Feld');
  for (const [was, muster] of [['die Kopfzeile der Seite (#topbar)', /#topbar[^{]*\{[^}]*display:none/], ['die Vorschau-Marke', /2147483647[^{]*\{[^}]*display:none/], ['den Platz unter der Kopfzeile (--nav-h)', /--nav-h:0/]])
    if (!muster.test(TERM_CSS ?? '')) fail(`[4] TERM_CSS nimmt ${was} nicht heraus: sie stuende im Fenster unter der Leiste des Terminals`);
  // Die Marke des Vorschau-Baus muss es so auch geben, sonst griffe der Stil ins Leere
  const marke = /<div[^>]*\blang="de"[^>]*style="[^"]*2147483647[^"]*"[^>]*>/.test(PAGES[0].html);
  if (!marke) fail('[4] die Vorschau-Marke aus Layout.astro traegt nicht mehr lang und z-index 2147483647: TERM_CSS faende sie nicht');
  if (!/<nav[^>]*\bid="topbar"/.test(PAGES[0].html)) fail('[4] die Kopfzeile der Seite heisst nicht mehr #topbar: TERM_CSS faende sie nicht');
  // Schlanke Datenseiten (DataShell): der Pfad bleibt, Startlink, Suchknopf
  // und Sprachschalter gehen. Die Suche holt das Terminal ueber den Knopf
  // der Seite (data-scs-boot), also muss es ihn dort geben.
  const daten = existsSync(join(DIST, 'de/items.html')) ? readFileSync(join(DIST, 'de/items.html'), 'utf8') : '';
  const kopf = /<header class="dp-bar"[^>]*>([\s\S]*?)<\/header>/.exec(daten)?.[1] ?? '';
  if (!kopf) fail('[4] dist/de/items.html traegt keine Kopfleiste .dp-bar mehr: TERM_CSS und die Suche des Terminals griffen auf den Datenseiten ins Leere');
  for (const [was, klasse] of [['den Startlink', 'dp-home'], ['den Suchknopf', 'dp-search'], ['den Sprachschalter', 'dp-lang']]) {
    if (!new RegExp(`\\.dp-bar>\\.${klasse}[^{]*\\{[^}]*display:none`).test(TERM_CSS ?? '')) fail(`[4] TERM_CSS nimmt ${was} der Datenseiten (.${klasse}) nicht heraus: er stuende doppelt unter der Leiste des Terminals`);
    if (kopf && !new RegExp(`class="${klasse}"`).test(kopf)) fail(`[4] die Kopfleiste der Datenseiten traegt .${klasse} nicht mehr als Kind: TERM_CSS faende es nicht`);
  }
  if (kopf && !/<nav class="dp-crumbs"/.test(kopf)) fail('[4] die Kopfleiste der Datenseiten traegt den Pfad .dp-crumbs nicht mehr: im Fenster bliebe eine leere Leiste');
  if (kopf && !/<button[^>]*\bdata-scs-boot\b/.test(kopf)) fail('[4] der Suchknopf der Datenseiten traegt data-scs-boot nicht mehr: „Suche“ in der Leiste des Terminals oeffnete dort nichts');
  if (!/\[data-scs-boot\]/.test(String(termSrc ?? '')) || !/data-scs-open/.test(String(termSrc ?? ''))) fail('[4] das Terminal oeffnet die Suche nicht mehr ueber data-scs-boot (Datenseiten) und data-scs-open (uebrige Seiten)');
}
if (wegProben < MIN_WEG_PROBEN) fail(`[4] nur ${wegProben} Wege geprueft, Klinke ${MIN_WEG_PROBEN}`);
say(`    ${kastenProben} Kaesten (${klein} davon so schmal, dass die Seite unter den kleinsten Massstab muss), ${wegProben} Wege (Klinke ${MIN_WEG_PROBEN})`);

/* ---------- [5] Geometrie der Buehne ---------- */
say('[5] Buehne: Kamera vor dem Schirm, Schirm im Bild genau das gemeldete Rechteck');
let fitProben = 0, fitEng = 0, hallen = 0;
if (viewer) {
  const { HALL_LEIT, LEIT_FOV_MAX, leitFit } = viewer;
  if (typeof leitFit !== 'function' || !HALL_LEIT || !(LEIT_FOV_MAX > 0)) fail('[5] dist/assets/hangar-viewer.js liefert HALL_LEIT, LEIT_FOV_MAX oder leitFit nicht mehr');
  else for (const [id, L] of Object.entries(HALL_LEIT)) {
    hallen++;
    const S = L.schirm, R = L.raum;
    if (!R) { fail(`[5] HALL_LEIT.${id} nennt den Raum nicht (raum)`); continue; }
    if (!(S.z > R.z[0] && S.z < R.z[1] && S.y > R.y[0] && S.y < R.y[1])) fail(`[5] ${id}: der Schirm (${S.x}, ${S.y}, ${S.z}) steht nicht im Raum des Leitstands`);
    const RAND = 0.25; // so viel Luft bleibt zwischen Kamera und Glas, Wand, Boden, Decke
    // Die Grenzen des Abstands selbst: Fuer ein kleines freies Stueck schoepft leitFit sie ganz aus,
    // also muessen beide Enden im Raum liegen. Das Raster unten erreicht das ferne Ende nicht
    // (sein kleinstes Stueck kommt auf rund 7,6 m), eine geweitete Grenze bliebe sonst unbemerkt.
    if (!(Array.isArray(L.d) && L.d[0] > 0 && L.d[1] >= L.d[0])) fail(`[5] HALL_LEIT.${id}.d (${JSON.stringify(L.d)}) nennt keinen Abstand von bis`);
    else if (S.z + L.d[0] < R.z[0] + RAND || S.z + L.d[1] > R.z[1] - RAND)
      fail(`[5] ${id}: der Abstand ${L.d.join(' bis ')} m stellt die Kamera bei z ${(S.z + L.d[0]).toFixed(2)} bis ${(S.z + L.d[1]).toFixed(2)}, der Raum des Leitstands reicht mit ${RAND} m Luft nur von ${(R.z[0] + RAND).toFixed(2)} bis ${(R.z[1] - RAND).toFixed(2)} — in einem kleinen Fenster stuende sie hinter der Rueckwand`);
    let schlimm = null;
    // die letzten vier: hohe, schmale Fenster. Dort stoesst der Bildwinkel an LEIT_FOV_MAX, und der
    // Schirm muss in Metern kleiner werden, sonst ragt er aus dem freien Stueck (Review PR #355:
    // 800 × 1500 mit offener Schiffsauswahl, 25 px ueber den Rand der Buehne).
    for (const [W, H] of [[761, 540], [1024, 600], [1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1080], [2560, 1440], [3440, 1440], [761, 1080], [800, 1500], [900, 1400], [1080, 1920]])
      for (const l of [0, 70, 300, 400]) for (const r of [0, 60]) for (const t of [70, 120]) for (const b of [0, 80, 140]) {
        if (W - l - r < 240 || H - t - b < 180) continue;
        fitProben++;
        // wie leitPose im Viewer: das freie Stueck ist die Buehne ohne Raender, mit dem Rahmen (rand + 6 px) Luft
        const luft = L.rand + 6, frei = { l: l + luft, t: t + luft, r: W - r - luft, b: H - b - luft };
        const f = leitFit(W, H, frei, L);
        const eng = f.fov >= LEIT_FOV_MAX - 1e-6;
        if (eng) fitEng++;
        // Zentralprojektion nachgerechnet: Kamera bei Schirmmitte + (dx, dy, d), Blick nach -z
        const fpx = H / 2 / Math.tan((f.fov * Math.PI) / 360);
        const px = (x) => W / 2 + ((x - f.dx) / f.d) * fpx, py = (y) => H / 2 - ((y - f.dy) / f.d) * fpx;
        const ist = { l: px(-f.b / 2), r: px(f.b / 2), t: py(f.h / 2), b: py(-f.h / 2) };
        const ab = Math.max(...['l', 't', 'r', 'b'].map((k) => Math.abs(ist[k] - f.rect[k])));
        const cam = { x: S.x + f.dx, y: S.y + f.dy, z: S.z + f.d };
        const wo = `[5] ${id} bei ${W}×${H}, frei ${JSON.stringify(frei)}`;
        let m = null;
        if (!(ab <= 0.5)) m = `${wo}: der Schirm steht im Bild ${ab.toFixed(1)} px neben dem gemeldeten Rechteck — das Fenster der Seite laege neben dem Schirm`;
        // seitlich bleibt er im freien Stueck; nach oben und unten darf er um die Luft des Rahmens
        // ausweichen, wenn die Kamera sonst an Boden oder Decke stiesse, aber nie unter Kopfzeile oder Leiste
        else if (f.rect.l < frei.l - 0.5 || f.rect.r > frei.r + 0.5 || f.rect.t < frei.t - luft - 0.5 || f.rect.b > frei.b + luft + 0.5) m = `${wo}: der Schirm ragt aus dem freien Stueck (${JSON.stringify(f.rect)})`;
        else if (!(f.fov > 10 && f.fov <= LEIT_FOV_MAX + 1e-6)) m = `${wo}: Bildwinkel ${f.fov.toFixed(1)}°, Grenze ${LEIT_FOV_MAX}°`;
        else if (!(f.d >= L.d[0] - 1e-9 && f.d <= L.d[1] + 1e-9)) m = `${wo}: Abstand ${f.d.toFixed(2)} m ausserhalb ${L.d.join(' bis ')} m`;
        else if (!(f.h / f.b >= L.form[0] - 1e-9 && f.h / f.b <= L.form[1] + 1e-9)) m = `${wo}: Form ${(f.h / f.b).toFixed(2)} ausserhalb ${L.form.join(' bis ')}`;
        // der Schirm hat seine Breite aus HALL_LEIT; kleiner wird er nur, wo der Bildwinkel begrenzt ist
        else if (!(f.b <= S.b + 1e-9 && f.b > 0) || (!eng && Math.abs(f.b - S.b) > 1e-9)) m = `${wo}: Schirm ${f.b.toFixed(3)} m breit bei Bildwinkel ${f.fov.toFixed(1)}°, HALL_LEIT nennt ${S.b} m`;
        else if (cam.x < R.x[0] + RAND || cam.x > R.x[1] - RAND || cam.y < R.y[0] + RAND || cam.y > R.y[1] - RAND || cam.z < R.z[0] + RAND || cam.z > R.z[1] - RAND)
          m = `${wo}: die Kamera stuende bei (${cam.x.toFixed(2)}, ${cam.y.toFixed(2)}, ${cam.z.toFixed(2)}) ausserhalb des Leitstands oder naeher als ${RAND} m an Glas, Wand, Boden oder Decke`;
        else if ((f.rect.r - f.rect.l) < 0.45 * (frei.r - frei.l) && (f.rect.b - f.rect.t) < 0.45 * (frei.b - frei.t)) m = `${wo}: der Schirm fuellt weniger als die Haelfte des freien Stuecks (${Math.round(f.rect.r - f.rect.l)} × ${Math.round(f.rect.b - f.rect.t)} px)`;
        if (m && !schlimm) schlimm = m;
      }
    if (schlimm) fail(schlimm);
  }
}
if (fitProben < MIN_FIT_PROBEN) fail(`[5] nur ${fitProben} Stellungen nachgerechnet, Klinke ${MIN_FIT_PROBEN}`);
if (fitEng < MIN_FIT_ENG) fail(`[5] nur ${fitEng} Stellungen mit begrenztem Bildwinkel, Klinke ${MIN_FIT_ENG}: Das Raster erreicht den Zweig nicht mehr, in dem der Schirm schrumpft`);
say(`    ${fitProben} Stellungen in ${hallen} Halle(n) nachgerechnet (Klinke ${MIN_FIT_PROBEN}), davon ${fitEng} mit begrenztem Bildwinkel (Klinke ${MIN_FIT_ENG})`);

/* ---------- [6] Naht ---------- */
say('[6] Naht: Buehne, Controller und Terminal rufen einander, ?ort=leit in der Adresse');
let naht = 0;
{
  const vSrc = existsSync(join(DIST, 'assets/hangar-viewer.js')) ? readFileSync(join(DIST, 'assets/hangar-viewer.js'), 'utf8') : '';
  const cSrc = existsSync(join(DIST, 'assets/hangar-overview.js')) ? readFileSync(join(DIST, 'assets/hangar-overview.js'), 'utf8') : '';
  const NAHT = [
    [vSrc, /\n\s+place: \(name\) =>/, 'die Buehne liefert place nicht mehr'],
    [vSrc, /\n\s+canPlace: \(name\) =>/, 'die Buehne liefert canPlace nicht mehr'],
    [vSrc, /\n\s+onPlace\(fn\) \{/, 'die Buehne liefert onPlace nicht mehr'],
    [cSrc, /viewer\.place\('leit'\)/, 'der Controller schickt die Kamera nicht mehr in den Leitstand (viewer.place)'],
    [cSrc, /\.canPlace\?\.\('leit'\)/, 'der Controller fragt die Buehne nicht mehr nach dem Leitstand (canPlace)'],
    [cSrc, /\.onPlace\?\.\(onPlace\)/, 'der Controller hoert nicht mehr, wo die Kamera steht (onPlace)'],
    [cSrc, /import\(termBox\.dataset\.js\)/, 'der Controller laedt das Terminal nicht mehr ueber data-js'],
    [cSrc, /\.initTerminal\(termBox,/, 'der Controller ruft initTerminal nicht mehr'],
  ];
  for (const [src, muster, was] of NAHT) {
    if (muster.test(src)) naht++;
    else fail(`[6] ${was}`);
  }
  if (term && typeof term.initTerminal !== 'function') fail('[6] dist/assets/hangar-terminal.js liefert initTerminal nicht');
  if (ctrl) {
    const { parseState, serializeState, placeOf, placeShip } = ctrl;
    if (typeof placeOf !== 'function' || typeof placeShip !== 'function') fail('[6] dist/assets/hangar-overview.js liefert placeOf oder placeShip nicht mehr');
    else {
      const werk = new Set(['boden']);
      const ctx = { ids: new Set(['schiff', 'zweites', 'boden']), defaultShip: 'schiff', werk, tabs: ['overview'], sorts: ['name'], purs: new Set(), grps: new Set(), sizes: [], crews: new Set(), cargos: new Set(), prices: new Set(), makers: new Set() };
      const rund = (q, scope = 'location') => serializeState(parseState(q, '', ctx), ctx, scope);
      const PROBEN = [
        ['?ort=leit', 'location', '?ort=leit', 'der Leitstand ueberlebt die Adresse nicht'],
        ['?ship=zweites&ort=leit', 'location', '?ship=zweites&ort=leit', 'der Leitstand ueberlebt die Adresse nicht'],
        ['?ort=keller', 'location', '', 'ein unbekannter Ort bleibt in der Adresse'],
        ['?ship=boden&ort=leit', 'location', '?ship=boden', 'ein Bodenfahrzeug in der Werkhalle kaeme in den Leitstand'],
        ['?ship=zweites&ort=leit', 'share', '?ship=zweites', 'der geteilte Link traegt, wo die Kamera steht'],
      ];
      for (const [q, scope, soll, was] of PROBEN) {
        const ist = rund(q, scope);
        if (ist !== soll) fail(`[6] ${q} (${scope}) wird zu „${ist}“ statt „${soll}“: ${was}`);
        else naht++;
      }
      if (placeOf({ ship: 'boden', ort: 'halle' }, werk) !== 'werk' || placeOf({ ship: 'schiff', ort: 'leit' }, werk) !== 'leit' || placeOf({ ship: 'schiff', ort: 'halle' }, werk) !== 'halle') fail('[6] placeOf nennt den Ort nicht mehr nach Fahrzeug und Zustand');
      else naht++;
      const c = { ids: ['schiff', 'zweites', 'boden'], werk, defaultShip: 'schiff' };
      if (placeShip('werk', 'schiff', {}, c) !== 'boden' || placeShip('halle', 'boden', { halle: 'zweites' }, c) !== 'zweites' || placeShip('leit', 'boden', {}, c) !== 'schiff' || placeShip('halle', 'zweites', {}, c) !== 'zweites')
        fail('[6] placeShip waehlt fuer einen Ort nicht mehr das passende Fahrzeug (gezeigt, zuletzt dort, Vorgabe)');
      else naht++;
    }
  }
}
say(`    ${naht} Nahtstellen und Proben`);

/* ---------- [7] Rahmen ---------- */
say('[7] Rahmen: dieser Bau erlaubt der eigenen Seite das Fenster');
let rahmen = 0;
for (const e of RAHMEN) {
  const f = join(DIST, CSP_ORDNER, e.datei);
  const ist = existsSync(f) ? leseMapWert(readFileSync(f, 'utf8')) : null;
  if (ist !== e.offen) fail(`[7] dist/${CSP_ORDNER}/${e.datei}: ${ist === null ? 'fehlt oder ist nicht lesbar' : `„${ist}“`}, Soll „${e.offen}“ (${e.wo}) — der Browser wiese die Seite im Fenster ab, der Schirm des Terminals bliebe leer; als Vorschau bauen (STAGING=1 npm run build)`);
  else rahmen++;
}
say(`    ${rahmen} von ${RAHMEN.length} Werten offen fuer die eigene Seite`);

if (fehler.length) {
  console.error(`\nverify-hangar-orte: ${fehler.length} FEHLER`);
  for (const f of fehler) console.error(`  · ${f}`);
  process.exit(1);
}
console.log('\nverify-hangar-orte: ALLE ZUSICHERUNGEN ERFUELLT ✓');
