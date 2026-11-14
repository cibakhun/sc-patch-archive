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
         dass sich die Seite nicht rahmen laesst. Dazu die Anmeldung
         (seit 14.11.2026): die Blende #hgx-term-login, anfangs verborgen,
         mit Marke, Schritt, Namen und allen Worten in der Sprache der
         Seite, und in der Leiste #hgx-term-who mit beiden Zielen (Konto,
         Anmeldung) in dist/, eigenem Tab und beiden Namen fuer Vorleser.
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
         Vorschau-Marke heraus. termIdent macht aus der Profilzeile des
         Kontos, wer vor dem Terminal sitzt, und laesst nichts durch, was
         nicht in Stil oder Adresse gehoert; die Anmeldung bleibt kurz
         (TERM_LOGIN).
     [5] Geometrie der Buehne: Fuer viele Fenstergroessen und freie
         Rechtecke steht die Kamera aus leitFit so, dass das Fenster der
         Seite im Bild genau das gemeldete Rechteck ist (nachgerechnet mit
         der Zentralprojektion), im freien Stueck liegt, auf dem Glas des
         Monitors bleibt (HALL_LEIT.schirm ohne Saum; so hoch wie das
         Glas, solange der Bildwinkel nicht begrenzt), der Bildwinkel unter
         LEIT_FOV_MAX bleibt (auch in hohen, schmalen Fenstern, wo das
         Fenster dafuer in Metern kleiner wird) und die Kamera im Raum des
         Leitstands steht, suedlich des Pults
         (HALL_LEIT.raum, mit Abstand zu Glas, Wand, Boden und Decke);
         beide Enden des erlaubten Abstands (HALL_LEIT.d) liegen im Raum.
         Seit der Large-Halle (14.11.2026) sieht nicht mehr jeder Monitor
         nach Sueden: Die Kamera steht auf der Blickachse seines Glases
         (leitAchsen aus schirm.dreh und schirm.neig), und dort wird
         gerechnet. Wo etwas im Raum steht (HALL_LEIT.voll: Pult,
         Stuehle), geraet sie nie hinein, auch nicht an den Enden von d.
     [6] Naht: Die Buehne liefert place, canPlace und onPlace, der
         Controller ruft sie und laedt das Terminal ueber data-js; der
         Zustand ?ort=leit ueberlebt die Adresse, steht nicht im geteilten
         Link und gilt nicht fuer Bodenfahrzeuge.
         Die Buehne setzt das Modell der Halle mit hallOrigin
         (loadRealHall): Damit rechnet [8].
     [7] Rahmen: Dieser Bau erlaubt der eigenen Seite das Rahmen
         (dist/_csp/, scripts/lib/rahmen.mjs). Sonst bliebe der Schirm
         leer; audit:csp prueft dieselben Dateien in beide Richtungen.
     [8] Monitor im Modell (seit 14.11.2026): Das Terminal liegt auf dem
         Glas eines Monitors, den das Spiel in den Raum gestellt hat
         (Krisz: „dass unser bildschirmscreen wirklich auf einem
         bildschirm drauf ist der in den control raum sitzt“). In der
         Halle von Revel & York ist es der mittlere am Pult, in den
         Hallen fester Groesse (hg-stage, halls) ein Bildschirm im Modell
         der Halle selbst (HALL_LEIT.schirm.mat nennt das Material seines
         Glases; dann ohne bank): Dort misst das Tor das Glas in den
         Achsen des Monitors nach (gedreht, geneigt). Eine Halle aus
         HALL_LEIT, die der Bau nicht ausliefert, nennt es beim Namen,
         statt zu reissen; dass keine verloren geht, haelt die Klinke.
         Die ausgelieferte Einrichtung der Halle
         (die Datei, die die Seite der Buehne nennt: hg-stage,
         opts.hall.furniture) traegt die Monitore des Pults in der
         Groesse und an der Stelle, die HALL_LEIT.bank nennt, und darin
         eine nach Sueden gewandte Glasflaeche genau dort, wo
         HALL_LEIT.schirm sie nennt. Die Stelle ist absolut gemeint: Der
         Ursprung der Halle im Modell kommt aus der Buehne (hallOrigin:
         Raum, Schiffsfeld, Bodenhoehe aus hg-stage), nicht aus den
         Monitoren selbst. Sonst schwebte das Bild neben dem Monitor,
         oder es staenden wieder zwei Schirme hintereinander. Nicht
         nachgerechnet: was die Buehne nach dem Laden noch bewegt
         (Feldmitte, Zuwachs der Halle); das Pult steht ausserhalb der
         Streifen der Feldmitte, und der Zuwachs traegt Monitor und Bild
         gemeinsam (leitAt). Die Marke der Blende
         (CSS der Seite) steht, wo der Monitor sie in Ruhe zeigt
         (LEIT_MARKE).

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

   VORGEFUEHRT ROT (14.11.2026, Terminal auf dem Monitor und Anmeldung),
   je ein Eingriff am gebauten dist/:
     e  dist/de/hangar.html: der Blende das hidden genommen; data-l-gast
        geleert; dem Link der Leiste data-dash auf /de/konto.html gebogen
        (im ersten Lauf GRUEN: der Eingriff traf das data-dash der
        Kopfzeile der Seite, nicht das des Terminals; am richtigen Link
        rot), dann auf /de/schiffe.html (eine Seite, die im Fenster
        bliebe); in data-a-user das {name} gestrichen
     f  dist/assets/hangar-terminal.js: in termIdent die Pruefung auf
        https gestrichen; TERM_LOGIN.hold auf 6000
     g  dist/assets/hangar-viewer.js: HALL_LEIT.schirm.z auf 58.5 (der
        alte Schirm vor dem Pult); schirm.b auf 3.4; in leitFit den Saum
        gestrichen; LEIT_MARKE.y auf 0.5
     h  Nach dem Review der PR (#365): [8] leitete den Ursprung der Halle
        aus der Mitte der Monitore ab und mass das Glas damit nur gegen
        das Pult. Vorher GRUEN, seither rot: dist/assets/hangar-viewer.js
        HALL_SHIFT.field 4 → 0 (Halle 4 m weiter in x); beide Seiten
        floor 1 → 2 (Halle 1 m tiefer). Dazu: bank und schirm gemeinsam
        um 1 m in x versetzt; in loadRealHall die Hoehe wieder aus
        h.floor gesetzt ([6]); floor nur in dist/de/hangar.html auf 2;
        die Halle der Seiten umbenannt; floor aus hg-stage gestrichen
   Die Meldungen stehen in der PR dieses Umbaus.

   VORGEFUEHRT ROT (14.11.2026, Terminal der Large-Halle: gedrehter und
   geneigter Monitor im Modell der Halle), je ein Eingriff am gebauten
   dist/assets/hangar-viewer.js, sieben Laeufe:
     i  HALL_LEIT.util-lrgtop: schirm.dreh gestrichen (der Monitor saehe
        nach Sueden, die Kamera stuende hinter der Rueckwand); neig auf
        -15 (sie stiege unter die Decke); voll bis z 101 und y 19.6
        gezogen (sie saesse im Stuhl); d auf [2, 7]; voll ohne z; dreh
        und neig gestrichen und den Raum geweitet (Klinke der gedrehten
        Monitore); in leitAchsen die dritte Achse verbogen
   Noch nicht vorgefuehrt, weil nur mit dem gebauten Modell der Halle
   moeglich (es liegt bis zur PR der Large-Halle nur am PC): der Zweig
   von [8], der das Glas im Modell der Halle selbst nachmisst.
   Die Meldungen stehen in der PR der Large-Halle.

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
const MIN_FIT_PROBEN = 1200; // Stellungen der Kamera, die [5] nachrechnet (13.11.2026: 432, mit hohen Fenstern 624; 14.11.2026 mit der Large-Halle 1248)
const MIN_FIT_ENG = 130;     // davon mit begrenztem Bildwinkel: dort schrumpft der Schirm (13.11.2026: 66; 14.11.2026 mit der Large-Halle 144)
const MIN_WEG_PROBEN = 14;  // Links, die [4] durch termRoute schickt
const MIN_WER_PROBEN = 11;  // Profilzeilen, die [4] durch termIdent schickt (14.11.2026: 11)
const MIN_GLAS_HALLEN = 1;  // Hallen, deren Monitor [8] im Modell nachmisst (14.11.2026: 1)
const MIN_GEDREHT = 1;      // Hallen, deren Monitor nicht gerade nach Sueden sieht (14.11.2026: 1, Large-Halle)

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
  // Anmeldung: die Blende und der Platz in der Leiste
  const blende = /<div[^>]*\bid="hgx-term-login"[^>]*>/.exec(sec)?.[0];
  if (!blende) fail(`[2] ${page.file}: die Blende der Anmeldung (#hgx-term-login) fehlt im Terminal`);
  else {
    if (!hat(blende, 'hidden')) fail(`[2] ${page.file}: #hgx-term-login ist nicht anfangs verborgen — die Blende laege ueber der Seite, bis das Modul sie zum ersten Mal schliesst`);
    if (wert(blende, 'aria-hidden') !== 'true') fail(`[2] ${page.file}: #hgx-term-login ohne aria-hidden="true": Vorleser laesen die Begruessung bei jedem Hinsetzen vor, den Namen nennt schon die Leiste`);
    for (const n of ['data-l-auth', 'data-l-user', 'data-l-guest', 'data-l-gast', 'data-l-gastsub']) if (!wert(blende, n)?.trim()) fail(`[2] ${page.file}: #hgx-term-login ohne ${n}: der Schritt der Anmeldung stuende ohne Worte da`);
    for (const [id, was] of [['hgx-term-lstep', 'der Schritt'], ['hgx-term-lname', 'der Name'], ['hgx-term-lsub', 'die Zeile unter dem Namen']]) if (!sec.includes(`id="${id}"`)) fail(`[2] ${page.file}: ${was} der Anmeldung (#${id}) fehlt`);
    if (!/class="hgx-term__mark"[^>]*>\s*<svg/.test(sec)) fail(`[2] ${page.file}: die Blende traegt die Marke nicht (.hgx-term__mark mit svg): der Uebergang vom Monitor der Halle spraenge`);
  }
  const wer = /<a[^>]*\bid="hgx-term-who"[^>]*>/.exec(sec)?.[0];
  if (!wer) fail(`[2] ${page.file}: in der Leiste fehlt, wer angemeldet ist (#hgx-term-who)`);
  else {
    if (wert(wer, 'target') !== '_blank') fail(`[2] ${page.file}: #hgx-term-who oeffnet keinen eigenen Tab — Konto und Anmeldung lassen sich nicht rahmen, die Halle ginge verloren`);
    for (const n of ['data-login', 'data-dash']) {
      const ziel = wert(wer, n) ?? '';
      if (!ziel.startsWith(page.de ? '/de/' : '/') || (!page.de && ziel.startsWith('/de/'))) fail(`[2] ${page.file}: #hgx-term-who ${n}="${ziel}" liegt nicht in der Sprache der Seite`);
      else if (!existsSync(join(DIST, ziel.replace(/[?#].*$/, '')))) fail(`[2] ${page.file}: #hgx-term-who ${n}="${ziel}" fuehrt auf keine Seite in dist/`);
      else if (term && term.termRoute(ziel, `https://x.test/${page.file}`).art !== 'tab') fail(`[2] ${page.file}: #hgx-term-who ${n}="${ziel}" gilt dem Terminal nicht als Ziel fuer einen eigenen Tab`);
    }
    if (wert(wer, 'href') !== wert(wer, 'data-login')) fail(`[2] ${page.file}: #hgx-term-who fuehrt ohne Skript nicht zur Anmeldung (href ist nicht data-login)`);
    for (const n of ['data-l-login', 'data-l-acct', 'data-a-guest', 'data-a-user', 'aria-label']) if (!wert(wer, n)?.trim()) fail(`[2] ${page.file}: #hgx-term-who ohne ${n}`);
    if (!(wert(wer, 'data-a-user') ?? '').includes('{name}')) fail(`[2] ${page.file}: #hgx-term-who data-a-user nennt den Platz fuer den Namen nicht ({name}): Vorleser erfuehren nicht, wer angemeldet ist`);
  }
  kaesten++;
}
say(`    ${kaesten} von ${PAGES.length} Seiten mit Terminal und Anmeldung, Modulversion ${termV || '—'}`);

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
// Anmeldung: wer vor dem Terminal sitzt, und wie lange die Blende steht
let werProben = 0;
if (term) {
  const { termIdent, TERM_LOGIN } = term;
  if (typeof termIdent !== 'function' || !TERM_LOGIN) fail('[4] dist/assets/hangar-terminal.js liefert termIdent oder TERM_LOGIN nicht');
  else {
    const WER = [
      [null, null, null, 'ohne Sitzung sitzt ein Gast da'],
      ['', { display_name: 'Ada' }, null, 'ohne Sitzung sitzt ein Gast da'],
      ['u1', { display_name: 'Ada', handle: 'ada' }, { name: 'Ada', sub: '@ada', zeichen: 'A' }, 'der Anzeigename geht vor, das Handle steht darunter'],
      ['u1', { display_name: '  ', handle: '@@zed' }, { name: '@zed', sub: '', zeichen: 'Z' }, 'ohne Anzeigenamen nennt sich das Konto beim Handle'],
      ['u1', null, { name: '', sub: '', bild: '', zeichen: '◆', farbe: '#2dd4ff' }, 'ein Konto ohne lesbares Profil bleibt ein Konto'],
      ['u1', { display_name: 'Bo', avatar_url: 'https://cdn.discordapp.com/a/b.png', avatar_color: '#A1b2C3', avatar_icon: '✦' }, { bild: 'https://cdn.discordapp.com/a/b.png', farbe: '#A1b2C3', zeichen: '✦' }, 'Bild, Farbe und Zeichen des Profils kommen an'],
      ['u1', { display_name: 'Bo', avatar_url: 'javascript:alert(1)' }, { bild: '' }, 'als Bild gilt nur eine Adresse ueber https'],
      ['u1', { display_name: 'Bo', avatar_url: 'http://bilder.test/a.png' }, { bild: '' }, 'als Bild gilt nur eine Adresse ueber https'],
      ['u1', { display_name: 'Bo', avatar_color: 'red;background:url(//x.test)' }, { farbe: '#2dd4ff' }, 'als Farbe gilt nur #rrggbb, sie landet im Stil'],
      ['u1', { display_name: 'Bo', avatar_icon: 'ABCDEFGH' }, { zeichen: 'ABCD' }, 'das Zeichen bleibt hoechstens vier Zeichen lang'],
      ['u1', { display_name: 7, handle: {}, avatar_url: [], avatar_color: null, avatar_icon: 0 }, { name: '', bild: '', farbe: '#2dd4ff', zeichen: '◆' }, 'was kein Text ist, zaehlt nicht'],
    ];
    for (const [uid, zeile, soll, was] of WER) {
      werProben++;
      let ist;
      try { ist = termIdent(uid, zeile); } catch (e) { fail(`[4] termIdent(${JSON.stringify(uid)}, ${JSON.stringify(zeile)}) wirft (${e.message})`); continue; }
      if (soll === null ? ist !== null : !ist || Object.entries(soll).some(([k, v]) => ist[k] !== v)) fail(`[4] termIdent(${JSON.stringify(uid)}, ${JSON.stringify(zeile)}) → ${JSON.stringify(ist)}: ${was}`);
    }
    // „kurz“ (Krisz): die ganze Blende unter drei Sekunden, beim Wiederkommen unter zwei; die Frist reicht fuer eine langsame Leitung
    const lang = TERM_LOGIN.auth + TERM_LOGIN.hold + TERM_LOGIN.aus, kurz = (TERM_LOGIN.kurz?.auth ?? NaN) + (TERM_LOGIN.kurz?.hold ?? NaN) + TERM_LOGIN.aus;
    if (!(lang >= 1200 && lang <= 3000)) fail(`[4] TERM_LOGIN: die Anmeldung dauert ${lang} ms, gedacht sind 1,2 bis 3 s — kuerzer liest niemand den Namen, laenger steht sie der Seite im Weg`);
    if (!(kurz >= 800 && kurz < lang && kurz <= 2000)) fail(`[4] TERM_LOGIN.kurz: beim Wiederkommen ${kurz} ms, gedacht sind 0,8 bis 2 s und weniger als beim ersten Mal (${lang} ms)`);
    if (!(TERM_LOGIN.frist >= TERM_LOGIN.auth && TERM_LOGIN.frist <= 5000)) fail(`[4] TERM_LOGIN.frist ${TERM_LOGIN.frist} ms: die Antwort des Kontos bekommt mindestens die Dauer des ersten Schritts (${TERM_LOGIN.auth} ms) und haelt die Blende hoechstens 5 s`);
  }
}
if (werProben < MIN_WER_PROBEN) fail(`[4] nur ${werProben} Profilzeilen durch termIdent geschickt, Klinke ${MIN_WER_PROBEN}`);
say(`    ${kastenProben} Kaesten (${klein} davon so schmal, dass die Seite unter den kleinsten Massstab muss), ${wegProben} Wege (Klinke ${MIN_WEG_PROBEN}), ${werProben} Profilzeilen (Klinke ${MIN_WER_PROBEN})`);

/* ---------- [5] Geometrie der Buehne ---------- */
say('[5] Buehne: Kamera vor dem Monitor, Fenster der Seite im Bild genau das gemeldete Rechteck und auf dem Glas');
let fitProben = 0, fitEng = 0, hallen = 0, gedreht = 0, vollQuader = 0;
if (viewer) {
  const { HALL_LEIT, LEIT_FOV_MAX, leitFit, leitAchsen } = viewer;
  if (typeof leitFit !== 'function' || typeof leitAchsen !== 'function' || !HALL_LEIT || !(LEIT_FOV_MAX > 0)) fail('[5] dist/assets/hangar-viewer.js liefert HALL_LEIT, LEIT_FOV_MAX, leitFit oder leitAchsen nicht mehr');
  else for (const [id, L] of Object.entries(HALL_LEIT)) {
    hallen++;
    const S = L.schirm, R = L.raum;
    if (!R) { fail(`[5] HALL_LEIT.${id} nennt den Raum nicht (raum)`); continue; }
    // Das Fenster der Seite liegt auf dem Glas des Monitors, mit dem Saum als Rand
    if (!(S.saum >= 0.01 && S.saum <= 0.1 && S.b > 4 * S.saum && S.h > 4 * S.saum)) { fail(`[5] HALL_LEIT.${id}.schirm: Saum ${S.saum} m passt nicht zu einem Glas von ${S.b} × ${S.h} m (gedacht: 1 bis 10 cm Rand um das Fenster der Seite)`); continue; }
    const bMax = S.b - 2 * S.saum, hMax = S.h - 2 * S.saum;
    // Die Kamera sitzt suedlich des Pults: zwischen ihr und dem Monitor steht nur die Tischplatte unterhalb des Bilds
    if (L.bank && !(S.z + L.d[0] >= L.bank.z[1] + 0.1)) fail(`[5] ${id}: beim kleinsten Abstand ${L.d[0]} m stuende die Kamera bei z ${(S.z + L.d[0]).toFixed(2)}, das Pult reicht bis z ${L.bank.z[1]} — sie saesse im Tisch`);
    if (!(S.z > R.z[0] && S.z < R.z[1] && S.y > R.y[0] && S.y < R.y[1])) fail(`[5] ${id}: der Schirm (${S.x}, ${S.y}, ${S.z}) steht nicht im Raum des Leitstands`);
    const RAND = 0.25; // so viel Luft bleibt zwischen Kamera und Glas, Wand, Boden, Decke
    // Wohin der Monitor sieht (dreh, neig): Die Kamera steht um d vor seinem Glas auf dieser Achse,
    // nicht einfach suedlich von ihm. Sie steht bei Mitte + dx·X + dy·Y + d·Z.
    const { X, Y, Z } = leitAchsen(S);
    const lot = [X, Y, Z].map((v) => Math.hypot(...v));
    if (lot.some((n) => Math.abs(n - 1) > 1e-9) || Math.abs(X[0] * Z[0] + X[1] * Z[1] + X[2] * Z[2]) > 1e-9 || Math.abs(Y[0] * Z[0] + Y[1] * Z[1] + Y[2] * Z[2]) > 1e-9) { fail(`[5] ${id}: leitAchsen liefert keine drei senkrechten Achsen der Laenge 1 (${JSON.stringify({ X, Y, Z })})`); continue; }
    if (S.dreh || S.neig) gedreht++;
    const kam = (dx, dy, d) => ({ x: S.x + dx * X[0] + dy * Y[0] + d * Z[0], y: S.y + dx * X[1] + dy * Y[1] + d * Z[1], z: S.z + dx * X[2] + dy * Y[2] + d * Z[2] });
    const draussen = (c) => c.x < R.x[0] + RAND || c.x > R.x[1] - RAND || c.y < R.y[0] + RAND || c.y > R.y[1] - RAND || c.z < R.z[0] + RAND || c.z > R.z[1] - RAND;
    // voll: Quader, in denen etwas steht (Pult, Stuehle); auch dort bleibt RAND Luft
    const VOLL = L.voll ?? [];
    if (!Array.isArray(VOLL) || VOLL.some((q) => !['x', 'y', 'z'].every((k) => Array.isArray(q?.[k]) && q[k][1] > q[k][0]))) { fail(`[5] HALL_LEIT.${id}.voll nennt keine Quader (je x, y, z von bis)`); continue; }
    const imVollen = (c) => VOLL.findIndex((q) => c.x > q.x[0] - RAND && c.x < q.x[1] + RAND && c.y > q.y[0] - RAND && c.y < q.y[1] + RAND && c.z > q.z[0] - RAND && c.z < q.z[1] + RAND);
    vollQuader += VOLL.length;
    // Die Grenzen des Abstands selbst: Fuer ein kleines freies Stueck schoepft leitFit sie ganz aus,
    // also muessen beide Enden im Raum liegen. Das Raster unten erreicht das ferne Ende nicht
    // (sein kleinstes Stueck kommt auf rund 7,6 m), eine geweitete Grenze bliebe sonst unbemerkt.
    if (!(Array.isArray(L.d) && L.d[0] > 0 && L.d[1] >= L.d[0])) fail(`[5] HALL_LEIT.${id}.d (${JSON.stringify(L.d)}) nennt keinen Abstand von bis`);
    else {
      const nah = kam(0, 0, L.d[0]), fern = kam(0, 0, L.d[1]), ort = (c) => `(${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)})`;
      if (draussen(nah) || draussen(fern))
        fail(`[5] ${id}: der Abstand ${L.d.join(' bis ')} m stellt die Kamera bei ${ort(nah)} bis ${ort(fern)}, der Raum des Leitstands reicht mit ${RAND} m Luft nur von x ${(R.x[0] + RAND).toFixed(2)} bis ${(R.x[1] - RAND).toFixed(2)}, y ${(R.y[0] + RAND).toFixed(2)} bis ${(R.y[1] - RAND).toFixed(2)}, z ${(R.z[0] + RAND).toFixed(2)} bis ${(R.z[1] - RAND).toFixed(2)} — in einem kleinen Fenster stuende sie hinter der Rueckwand`);
      else if (imVollen(nah) >= 0 || imVollen(fern) >= 0)
        fail(`[5] ${id}: der Abstand ${L.d.join(' bis ')} m stellt die Kamera bei ${ort(nah)} bis ${ort(fern)}, dort steht etwas (HALL_LEIT.${id}.voll, mit ${RAND} m Luft) — sie saesse in Pult oder Stuhl`);
    }
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
        const cam = kam(f.dx, f.dy, f.d);
        const wo = `[5] ${id} bei ${W}×${H}, frei ${JSON.stringify(frei)}`;
        let m = null;
        if (!(ab <= 0.5)) m = `${wo}: der Schirm steht im Bild ${ab.toFixed(1)} px neben dem gemeldeten Rechteck — das Fenster der Seite laege neben dem Schirm`;
        // seitlich bleibt er im freien Stueck; nach oben und unten darf er um die Luft des Rahmens
        // ausweichen, wenn die Kamera sonst an Boden oder Decke stiesse, aber nie unter Kopfzeile oder Leiste
        else if (f.rect.l < frei.l - 0.5 || f.rect.r > frei.r + 0.5 || f.rect.t < frei.t - luft - 0.5 || f.rect.b > frei.b + luft + 0.5) m = `${wo}: der Schirm ragt aus dem freien Stueck (${JSON.stringify(f.rect)})`;
        else if (!(f.fov > 10 && f.fov <= LEIT_FOV_MAX + 1e-6)) m = `${wo}: Bildwinkel ${f.fov.toFixed(1)}°, Grenze ${LEIT_FOV_MAX}°`;
        else if (!(f.d >= L.d[0] - 1e-9 && f.d <= L.d[1] + 1e-9)) m = `${wo}: Abstand ${f.d.toFixed(2)} m ausserhalb ${L.d.join(' bis ')} m`;
        else if (!(f.h / f.b >= L.form[0] - 1e-9 && f.h / f.b <= L.form[1] + 1e-9)) m = `${wo}: Form ${(f.h / f.b).toFixed(2)} ausserhalb ${L.form.join(' bis ')}`;
        // das Fenster bleibt auf dem Glas und ist so hoch wie dieses ohne Saum; kleiner wird es nur, wo der Bildwinkel begrenzt ist
        else if (!(f.b > 0 && f.h > 0 && f.b <= bMax + 1e-9 && f.h <= hMax + 1e-9)) m = `${wo}: das Fenster der Seite (${f.b.toFixed(3)} × ${f.h.toFixed(3)} m) ragt ueber das Glas des Monitors (${bMax.toFixed(3)} × ${hMax.toFixed(3)} m ohne Saum)`;
        // (auf einem Glas, das schmaler ist als das breiteste Fenster, begrenzt stattdessen die Breite)
        else if (!eng && Math.abs(f.h - hMax) > 1e-9 && Math.abs(f.b - bMax) > 1e-9) m = `${wo}: das Fenster der Seite ist ${f.b.toFixed(3)} × ${f.h.toFixed(3)} m bei Bildwinkel ${f.fov.toFixed(1)}°, das Glas des Monitors traegt ${bMax.toFixed(3)} × ${hMax.toFixed(3)} m — es nutzt weder dessen Hoehe noch dessen Breite`;
        else if (draussen(cam))
          m = `${wo}: die Kamera stuende bei (${cam.x.toFixed(2)}, ${cam.y.toFixed(2)}, ${cam.z.toFixed(2)}) ausserhalb des Leitstands oder naeher als ${RAND} m an Glas, Wand, Boden oder Decke`;
        else if (imVollen(cam) >= 0)
          m = `${wo}: die Kamera stuende bei (${cam.x.toFixed(2)}, ${cam.y.toFixed(2)}, ${cam.z.toFixed(2)}) in oder naeher als ${RAND} m an Pult oder Stuhl (HALL_LEIT.${id}.voll[${imVollen(cam)}])`;
        else if ((f.rect.r - f.rect.l) < 0.45 * (frei.r - frei.l) && (f.rect.b - f.rect.t) < 0.45 * (frei.b - frei.t)) m = `${wo}: der Schirm fuellt weniger als die Haelfte des freien Stuecks (${Math.round(f.rect.r - f.rect.l)} × ${Math.round(f.rect.b - f.rect.t)} px)`;
        if (m && !schlimm) schlimm = m;
      }
    if (schlimm) fail(schlimm);
  }
}
if (fitProben < MIN_FIT_PROBEN) fail(`[5] nur ${fitProben} Stellungen nachgerechnet, Klinke ${MIN_FIT_PROBEN}`);
if (fitEng < MIN_FIT_ENG) fail(`[5] nur ${fitEng} Stellungen mit begrenztem Bildwinkel, Klinke ${MIN_FIT_ENG}: Das Raster erreicht den Zweig nicht mehr, in dem das Fenster schrumpft`);
if (gedreht < MIN_GEDREHT) fail(`[5] nur ${gedreht} Halle(n) mit gedrehtem oder geneigtem Monitor, Klinke ${MIN_GEDREHT}: Der Zweig, in dem die Kamera nicht suedlich des Monitors steht, liefe leer`);
say(`    ${fitProben} Stellungen in ${hallen} Halle(n) nachgerechnet (Klinke ${MIN_FIT_PROBEN}), davon ${fitEng} mit begrenztem Bildwinkel (Klinke ${MIN_FIT_ENG}); ${gedreht} Halle(n) mit gedrehtem oder geneigtem Monitor (Klinke ${MIN_GEDREHT}), ${vollQuader} Quader, in die die Kamera nie geraet`);

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
    // Der letzte Wunsch gilt (zwei Review-Runden an PR #355, im Browser nur mit
    // 3D nachzustellen): Jede Stelle, die den Wunsch aendert, zaehlt ihn, und
    // wer gewartet hat, fragt nach, bevor er faehrt. Die Datei der Buehne
    // bearbeiten mehrere Straenge; faellt eine der Zeilen bei einem Merge
    // heraus, faehrt die Kamera wieder gegen den Wunsch, und kein Bild zeigt es.
    [vSrc, /\n\s+place: \(name\) => \{ placeWish\+\+;/, 'place zaehlt den Wunsch der Seite nicht mehr (placeWish++): nach dem Warten fuehre auch ein ueberholter Wunsch los'],
    [vSrc, /placeWish\+\+;\s*(?:\/\/[^\n]*\n\s*)*if \(post\) leitLeave\(true\);/, 'ein Schiffswechsel zaehlt nicht mehr als neuer Wunsch (placeWish++ vor leitLeave(true) in showShip): ein wartender Wunsch fuehre nach dem Wechsel allein in den Leitstand, und „Schiffsfeld“ holte die Kamera nicht zurueck'],
    [vSrc, /await hallSettled;\s*if \(!leitScreen \|\| wish !== placeWish\) return false;/, 'leitGo wartet nicht mehr auf die Halle oder fragt danach nicht nach dem Wunsch: ?ort=leit fiele an einer langsamen Leitung still aufs Feld zurueck'],
    [vSrc, /while \(trip\) await trip\.done;\s*(?:\/\/[^\n]*\n\s*)*if \(wish !== placeWish\) return false;/, 'leitGo fragt nach dem Warten auf eine Fahrt nicht mehr nach dem Wunsch: „Leitstand, Schiffsfeld“ waehrend der Rueckfahrt fuehre wieder hinauf'],
    [vSrc, /if \(me\.state === 'hin' && !\(await me\.arrived\)\) return false;\s*(?:\/\/[^\n]*\n\s*)*if \(wish !== placeWish\) return false;/, 'leitLeave fragt nach der Ankunft nicht mehr nach dem Wunsch: „Schiffsfeld, Leitstand“ waehrend der Hinfahrt fuehre wieder herunter'],
    // Lage der Halle im Modellraum: [8] rechnet mit hallOrigin nach, wo der
    // Monitor des Leitstands steht. Das gilt nur, solange die Buehne das
    // Modell mit derselben Rechnung setzt.
    [vSrc, /const c = h\.room\.center, o = hallSpot\(h\), O = hallOrigin\(h\);\s*model\.position\.set\(-o\[0\], -c\[1\], -o\[2\]\);/, 'loadRealHall setzt das Modell der Halle nicht mehr mit hallSpot und hallOrigin: [8] maesse den Monitor des Leitstands an einer anderen Stelle nach, als die Buehne ihn zeigt'],
    [vSrc, /if \(O\) \{\s*model\.position\.y = -O\[1\];/, 'loadRealHall setzt den Boden der Halle nicht mehr nach hallOrigin: [8] maesse den Monitor des Leitstands in einer anderen Hoehe nach, als die Buehne ihn zeigt'],
    [cSrc, /if \(!ok && my === ortTok && state\.ort === 'leit'/, 'der Controller laesst auch die Antwort auf einen ueberholten Wunsch aufs Feld zurueckstellen (ortTok in applyOrt): „Leitstand, Schiffsfeld, Leitstand“ waehrend der Rueckfahrt endete auf dem Feld'],
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

/* ---------- [8] Monitor im Modell ---------- */
say('[8] Monitor: Glas im ausgelieferten Modell, wo HALL_LEIT es nennt; Marke der Blende, wo der Monitor sie zeigt');
let glasHallen = 0, glasFlaeche = 0, glasDreiecke = 0, glasFern = 0;
const glasOhne = [];
if (viewer?.HALL_LEIT) {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const draco3d = (await import('draco3d')).default;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const TOL = 0.015; // m: HALL_LEIT nennt Zentimeter, das Modell Millimeter
  // Die Hallen, wie die Seiten sie der Buehne geben (hg-stage, opts.hall): Raum, Bodenhoehe, Einrichtung
  const HALLEN = new Map();
  for (const page of PAGES) {
    let cfg = null;
    try { cfg = JSON.parse(/<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(page.html ?? '')?.[1] ?? 'null'); } catch { /* unten */ }
    const erste = cfg?.opts?.hall ?? null;
    if (!erste?.id) { fail(`[8] ${page.file}: keine Halle in der StageConfig (#hg-stage, opts.hall) — die Lage des Leitstands ist nicht nachzumessen`); continue; }
    // dazu die Hallen fester Groesse (halls: je Stufe eine), in die die Buehne umbaut
    for (const hall of [erste, ...Object.values(cfg.halls ?? {})]) {
      if (!hall?.id) continue;
      const alt = HALLEN.get(hall.id), lage = JSON.stringify([hall.room, hall.floor, hall.furniture?.url, hall.url]);
      if (alt && alt.lage !== lage) fail(`[8] ${page.file}: die Halle ${hall.id} steht anders als in ${alt.file} (Raum, Boden, Modell oder Einrichtung) — die Sprachen zeigten den Monitor an verschiedenen Stellen`);
      else if (!alt) HALLEN.set(hall.id, { hall, lage, file: page.file });
    }
  }
  for (const [id, L] of Object.entries(viewer.HALL_LEIT)) {
    const S = L.schirm, B = L.bank, hall = HALLEN.get(id)?.hall;
    // Eine Halle, die dieser Bau nicht ausliefert (ihr Modell liegt noch nicht im Repo), ist hier nicht
    // nachzumessen: genannt, nicht FEHLER. Dass keine verloren geht, haelt die Klinke MIN_GLAS_HALLEN.
    if (!hall) { glasOhne.push(id); continue; }
    // Wo der Monitor steht: in der Einrichtung der Halle (bank: die Monitore des Pults, Halle von
    // Revel & York) oder im Modell der Halle selbst (schirm.mat: das Material seines Glases)
    if (!B && !S.mat) { fail(`[8] HALL_LEIT.${id} nennt weder die Monitore des Pults (bank) noch das Material des Glases im Modell der Halle (schirm.mat): das Terminal stuende frei im Raum statt auf einem Monitor`); continue; }
    if (B && !hall.furniture?.url) { fail(`[8] ${id}: die Seite nennt keine Einrichtung der Halle (hg-stage, opts.hall.furniture) — ohne sie gibt es keinen Monitor fuer das Terminal`); continue; }
    const quelle = B ? hall.furniture.url : hall.url;
    if (!quelle) { fail(`[8] ${id}: die Seite nennt das Modell der Halle nicht (hg-stage, url) — der Monitor des Terminals ist nicht nachzumessen`); continue; }
    const rel = String(quelle).replace(/^\//, '').replace(/[?#].*$/, ''), file = join(DIST, rel);
    if (!existsSync(file)) { fail(`[8] dist/${rel} fehlt: ohne ${B ? 'die Einrichtung' : 'das Modell'} der Halle gibt es keinen Monitor fuer das Terminal`); continue; }
    let MAT;
    try { MAT = B ? /monitors/i : new RegExp(S.mat, 'i'); } catch { fail(`[8] HALL_LEIT.${id}.schirm.mat (${S.mat}) ist kein Muster fuer ein Material`); continue; }
    let doc;
    try { doc = await io.read(file); } catch (e) { fail(`[8] dist/${rel} laesst sich nicht lesen (${e.message})`); continue; }
    // alle Dreiecke des Monitor-Materials im Modellraum
    const tri = [];
    for (const node of doc.getRoot().listNodes()) for (const prim of node.getMesh()?.listPrimitives() ?? []) {
      if (!MAT.test(prim.getMaterial()?.getName() ?? '')) continue;
      const m = node.getWorldMatrix(), pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), v = [0, 0, 0];
      const at = (i) => { pos.getElement(i, v); return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]; };
      const n = idx ? idx.getCount() : pos.getCount();
      for (let i = 0; i + 2 < n; i += 3) tri.push([0, 1, 2].map((k) => at(idx ? idx.getScalar(i + k) : i + k)));
    }
    if (!tri.length) { fail(`[8] dist/${rel}: kein Teil mit dem Material der Monitore (${MAT}) — ${B ? 'das Pult des Leitstands traegt keine Schirme mehr' : 'die Halle traegt diesen Bildschirm nicht mehr'}, das Terminal stuende frei im Raum`); continue; }
    // Lage der Halle im Modellraum: wie die Buehne das Modell setzt (hallOrigin
    // aus Raum, Schiffsfeld und Bodenhoehe), NICHT aus den Monitoren selbst.
    // Bis zum Review an PR #365 stand hier die Mitte der Monitore gegen die
    // Mitte von bank: Eine Halle, die als Ganzes anders steht (HALL_SHIFT.field
    // 4 → 0, floor 1 → 2, beides vorgefuehrt), wanderte damit mit, und alles
    // Folgende bestand weiter, waehrend die Buehne das Bild neben den Monitor
    // legt und es nur in der Konsole meldet.
    const ab = viewer.hallOrigin?.(hall);
    if (!Array.isArray(ab) || !ab.every(Number.isFinite)) { fail(`[8] ${id}: die Buehne nennt den Ursprung der Halle nicht (hallOrigin; Raum ${JSON.stringify(hall.room?.center ?? null)}, Boden ${hall.floor ?? '—'}) — ohne Bodenhoehe im Manifest lotet sie erst am geladenen Modell, und der Monitor ist hier nicht nachzumessen`); continue; }
    let fern = 0;
    if (B) {
      const lo = [0, 1, 2].map((k) => Math.min(...tri.flat().map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...tri.flat().map((p) => p[k])));
      const soll = [B.x, B.y, B.z], mass = (k) => `${(hi[k] - lo[k]).toFixed(3)} m statt ${(soll[k][1] - soll[k][0]).toFixed(2)} m`;
      const schief = [0, 1, 2].filter((k) => Math.abs(hi[k] - lo[k] - (soll[k][1] - soll[k][0])) > 2 * TOL);
      if (schief.length) { fail(`[8] dist/${rel}: die Monitore des Pults messen ${schief.map((k) => `${'xyz'[k]} ${mass(k)}`).join(', ')} (HALL_LEIT.${id}.bank) — das Pult ist ein anderes, die Lage des Glases (schirm) neu vermessen`); continue; }
      const mitte = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2 - ab[k]), sollM = soll.map((r) => (r[0] + r[1]) / 2);
      fern = Math.hypot(...mitte.map((v, k) => v - sollM[k]));
      if (fern > 2 * TOL) { fail(`[8] ${id}: die Monitore des Pults stehen im ausgelieferten Modell bei x ${mitte[0].toFixed(3)}, y ${mitte[1].toFixed(3)}, z ${mitte[2].toFixed(3)} (Hallenmeter, Mitte), HALL_LEIT.${id}.bank nennt x ${sollM[0].toFixed(3)}, y ${sollM[1].toFixed(3)}, z ${sollM[2].toFixed(3)} — das Bild des Terminals stuende ${fern.toFixed(2)} m neben seinem Monitor; die Lage der Halle pruefen (Schiffsfeld, HALL_SHIFT.field, floor) oder HALL_LEIT neu vermessen`); continue; }
    }
    // das Glas: dorthin gewandt, wohin HALL_LEIT es nennt (leitAchsen: ohne Angaben nach Sueden, +z),
    // in der Ebene des Schirms, innerhalb seines Rechtecks. Gerechnet in den Achsen des Monitors:
    // quer (u), am Glas hinauf (v), aus dem Glas heraus (w), um die Mitte, die HALL_LEIT nennt.
    const { X, Y, Z } = viewer.leitAchsen(S), M = [S.x + ab[0], S.y + ab[1], S.z + ab[2]];
    const lokal = (p) => { const q = [p[0] - M[0], p[1] - M[1], p[2] - M[2]]; return [q[0] * X[0] + q[1] * X[1] + q[2] * X[2], q[0] * Y[0] + q[1] * Y[1] + q[2] * Y[2], q[0] * Z[0] + q[1] * Z[1] + q[2] * Z[2]]; };
    let fl = 0, n = 0;
    const r = { u: [Infinity, -Infinity], v: [Infinity, -Infinity] };
    for (const [a, b, c] of tri) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0], len = Math.hypot(nx, ny, nz);
      if (!(len > 1e-10) || (nx * Z[0] + ny * Z[1] + nz * Z[2]) / len < 0.95) continue;
      const q = [a, b, c].map(lokal);
      if (q.some((p) => Math.abs(p[2]) > TOL)) continue;
      const mu = (q[0][0] + q[1][0] + q[2][0]) / 3, mv = (q[0][1] + q[1][1] + q[2][1]) / 3;
      if (Math.abs(mu) > S.b / 2 + 2 * TOL || Math.abs(mv) > S.h / 2 + 2 * TOL) continue;
      fl += len / 2; n++;
      for (const p of q) { r.u[0] = Math.min(r.u[0], p[0]); r.u[1] = Math.max(r.u[1], p[0]); r.v[0] = Math.min(r.v[0], p[1]); r.v[1] = Math.max(r.v[1], p[1]); }
    }
    const wohin = S.dreh || S.neig ? `um ${S.dreh ?? 0}° gedrehtes, um ${S.neig ?? 0}° geneigtes` : 'nach Sueden gewandtes';
    if (!n) { fail(`[8] ${id}: bei (${S.x}, ${S.y}, ${S.z}) traegt ${B ? 'das Pult' : 'die Halle'} kein ${wohin} Glas (HALL_LEIT.${id}.schirm) — das Bild des Terminals hinge in der Luft, oder es staenden wieder zwei Schirme hintereinander`); continue; }
    const kanten = [[r.u[0], -S.b / 2], [r.u[1], S.b / 2], [r.v[0], -S.h / 2], [r.v[1], S.h / 2]];
    if (kanten.some(([ist, sollK]) => Math.abs(ist - sollK) > TOL)) { fail(`[8] ${id}: das Glas des Monitors reicht im Modell quer von ${r.u[0].toFixed(3)} bis ${r.u[1].toFixed(3)} und am Glas hinauf von ${r.v[0].toFixed(3)} bis ${r.v[1].toFixed(3)} (m um die Mitte, die HALL_LEIT.${id}.schirm nennt), dort steht ${(-S.b / 2).toFixed(3)} bis ${(S.b / 2).toFixed(3)} und ${(-S.h / 2).toFixed(3)} bis ${(S.h / 2).toFixed(3)} — das Bild des Terminals laege neben dem Glas`); continue; }
    if (!(fl >= 0.97 * S.b * S.h && fl <= 1.01 * S.b * S.h)) { fail(`[8] ${id}: das Glas misst im Modell ${fl.toFixed(3)} m², HALL_LEIT.${id}.schirm nennt ${S.b} × ${S.h} m (${(S.b * S.h).toFixed(3)} m²) — die Flaeche ist nicht mehr eine geschlossene Scheibe`); continue; }
    if (!(S.ecke >= 0 && S.ecke <= Math.min(S.b, S.h) / 4)) { fail(`[8] HALL_LEIT.${id}.schirm.ecke ${S.ecke} m passt nicht zu einem Glas von ${S.b} × ${S.h} m`); continue; }
    glasHallen++; glasFlaeche += fl; glasDreiecke += n; glasFern = Math.max(glasFern, fern);
  }
  // Die Blende beginnt mit der Marke an der Stelle, an der der Monitor sie in Ruhe zeigt
  const M = viewer.LEIT_MARKE;
  if (!(M?.b > 0 && M?.y > 0)) fail('[8] dist/assets/hangar-viewer.js liefert LEIT_MARKE nicht');
  else for (const page of PAGES) {
    const css = /\.hgx-term__mark\{([^}]*)\}/.exec(page.html)?.[1] ?? '';
    const top = /(?:^|;)top:([\d.]+)%/.exec(css)?.[1], breit = /(?:^|;)width:([\d.]+)cqw/.exec(css)?.[1];
    if (!css) fail(`[8] ${page.file}: der Stil der Marke (.hgx-term__mark) fehlt`);
    else if (!(Math.abs(+top / 100 - M.y) < 1e-6 && Math.abs(+breit / 100 - M.b) < 1e-6 && /(?:^|;)left:50%/.test(css))) fail(`[8] ${page.file}: die Marke der Blende steht bei top ${top ?? '—'} %, Breite ${breit ?? '—'} cqw; der Monitor der Halle zeigt sie bei ${+(M.y * 100).toFixed(2)} % der Hoehe und ${+(M.b * 100).toFixed(2)} % der Breite des Fensters (LEIT_MARKE) — beim Hinsetzen spraenge sie`);
  }
}
if (glasHallen < MIN_GLAS_HALLEN) fail(`[8] nur ${glasHallen} Halle(n) mit nachgemessenem Monitor, Klinke ${MIN_GLAS_HALLEN}`);
say(`    ${glasHallen} Halle(n) nachgemessen (Klinke ${MIN_GLAS_HALLEN}): ${glasDreiecke} Dreiecke Glas, ${glasFlaeche.toFixed(3)} m², Monitore hoechstens ${(glasFern * 1000).toFixed(0)} mm neben HALL_LEIT.bank (erlaubt 30 mm)${glasOhne.length ? `; NICHT nachgemessen, weil dieser Bau die Halle nicht ausliefert: ${glasOhne.join(', ')}` : ''}`);

if (fehler.length) {
  console.error(`\nverify-hangar-orte: ${fehler.length} FEHLER`);
  for (const f of fehler) console.error(`  · ${f}`);
  process.exit(1);
}
console.log('\nverify-hangar-orte: ALLE ZUSICHERUNGEN ERFUELLT ✓');
