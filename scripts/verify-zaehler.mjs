/* ============================================================
   verify-zaehler.mjs — Schiene A: wo die Reichweitenmessung laeuft und
   welche Adresse sie zu sehen bekommt.

   Gegen das ARTEFAKT (dist/), nicht gegen die Quelle: ob eine Seite den
   Zaehler laedt, entscheidet erst der Build (Layout.astro, Prop
   `analytics`). Kein Netz, kein git, kein Kindprozess — liest dist/ als
   Text und fuehrt das ausgelieferte vbZaehlen in node:vm aus.

   Anlass (29.10.2026): Konto- und Anmeldeseiten nehmen Passwoerter
   entgegen, und nach Discord-Anmeldung, Wiederherstellungslink oder
   Discord-Verbindung traegt ihre Adresse Anmeldedaten im Fragment. Auf
   diesen Seiten laeuft seither kein Skript eines Nebenhosts, und auf allen
   anderen geht die Adresse ohne Abfrage und ohne Fragment an den Zaehler.

   Sechs Zusicherungen, jede mit Soll/Ist-Zeile:

     1  Jede Layout-Seite laedt den Zaehler — ausser den benannten
        Ausnahmen unten (KEIN_ZAEHLER). Eine Layout-Seite ohne Zaehler
        und ohne Eintrag ist entweder ein `analytics={false}` ohne Anlass
        oder ein verlorener Tag; beides gehoert geklaert.
     2  Zombie-Waechter: jede Ausnahme gibt es in dist/, und sie laedt
        den Zaehler NICHT. Verschwindet die Seite oder laedt sie ihn
        wieder, hat der Eintrag seinen Anlass verloren.
     3  Pfadregel: keine Seite unter account/ bzw. de/account/ (samt
        account.html, de/account.html) laedt den Zaehler — auch eine
        neue, noch nicht eingetragene nicht. Laedt eine Kontoseite sonst
        ein Skript von einem fremden Host, meldet das Tor eine WARNUNG
        (blockt nicht: ein Pruefdienst gegen Massenregistrierung kann
        dort gewollt sein, das entscheidet ein Mensch).
     4  Jeder Zaehler-Tag traegt data-exclude-hash="true" und
        data-exclude-search="true", nennt in data-before-send einen Haken,
        und dieselbe Seite definiert ihn inline (window.<name> = …).
        Fehlt der Haken, schickt Umami ungefiltert. Seit 29.10.2026
        ausserdem: das Skript kommt vom EIGENEN Ursprung (src beginnt mit
        "/", die gepinnte Kopie unter public/vendor/zaehler/), und
        data-host-url nennt das https-Ziel der Zaehlung.
     5  Jede verschiedene Fassung des Hakens aus dem gebauten Stand laeuft
        in node:vm: Abfrage und Fragment verschwinden aus url und
        referrer, als volle Adresse wie als reiner Pfad (aeltere Umami-
        Fassungen schicken nur den Pfad), eine Adresse ohne beides kommt
        unveraendert durch, ein Aufruf ohne url/referrer wirft nicht
        (ein Wurf im Haken legt die Zaehlung still), und mit dem
        Widerspruchs-Cookie vb_noanalytics=1 liefert er null.
     6  Die gepinnte Kopie des Zaehlers: die Datei, auf die der Tag zeigt,
        liegt in dist/, ihr Rumpf passt zur Pruefsumme im Kopf
        (scripts/vendor-umami.mjs schreibt beide — eine Abweichung heisst
        Handarbeit an fremdem Code), und sie laeuft in node:vm mit dem
        Haken der Seite: genau ein POST an <data-host-url>/api/send mit
        der Website-Kennung und einer Adresse ohne Abfrage und Fragment;
        kein einziger mit Widerspruchs-Cookie und keiner auf einem
        fremden Hostnamen (Vorschau, data-domains). Seit 10.11.2026
        ausserdem: kein Skript der Messung (Zaehler-Kopie, Ereignis-
        Skript) liegt unter einem Pfad, den eine Werbeblocker-Standardliste
        sperrt (BLOCKER_MUSTER) — sonst laedt es bei deren Nutzern gar
        nicht, und die Zahlen fehlen still.

   Den Zaehler erkennt das Tor am Umami-Merkmal `data-website-id`, nicht
   am Host — zieht das Skript auf einen anderen Host um, bleibt das Tor
   gueltig. Layout-Seiten erkennt es an der theme-color-Zeile, die nur
   Layout.astro schreibt (bis 02.11.2026 trug sie noch data-dark/
   data-light fuer den Hellmodus; den gibt es seither nicht mehr).

   Kopfzeile: geprueftes Artefakt, Zahl der Seiten, Layout-Seiten,
   Zaehler-Tags, Ausnahmen und ausgefuehrten Haken-Fassungen. Untergrenzen
   als Sperrklinken — sie duerfen nur nach OBEN wandern (Grundsatz 5).

     node scripts/verify-zaehler.mjs
   ============================================================ */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { EREIGNISSE, WERKZEUG_SEITEN, EINMAL, FILTER, EXTERN, EXTERN_HOSTS } from './lib/ereignisse.mjs';

const DIST = 'dist';

// Untergrenzen. Stand 29.10.2026 (Build bf31efe + diese Aenderung):
// 18.222 Seiten, davon 17.755 Layout-Seiten, 17.745 mit Zaehler,
// 11 Ausnahmen, 1 Fassung des Hakens. Die Seitenklinke liegt knapp unter
// der Gesamtklinke von verify:metrics (seitenGesamt 17.466 − 2 %): sie
// soll nicht die Seitenzahl bewachen (das tut verify:metrics), sondern
// melden, wenn die Erkennung der Layout-Seiten oder des Tags leerlaeuft.
const MIN_LAYOUT_SEITEN = 17000;
const MIN_ZAEHLER_SEITEN = 17000;
const MIN_HAKEN_FASSUNGEN = 1;
const MIN_ZAEHLER_KOPIEN = 1;
// Pfadmuster, die verbreitete Werbeblocker-Listen fuer Umami fuehren
// (EasyPrivacy, Stand 10.11.2026: `/umami/script.js`, `/umami.js`,
// `||umami.*/script.js`). Anlass: Bis 10.11.2026 lag die Kopie unter
// /vendor/umami/script.js; bei Nutzern von uBlock Origin, AdGuard und Co.
// lud der Zaehler seit dem Live-Gang am 31.10. gar nicht. Geprueft wird
// das Wort im ganzen Pfad, nicht nur die heutigen Muster: jede Liste, die
// Umami kennt, sucht nach ihm. Gilt fuer Zaehler-Kopie und Ereignis-Skript.
const BLOCKER_MUSTER = [
  { re: /umami/i, liste: 'EasyPrivacy sperrt /umami/script.js und /umami.js (Standardliste von uBlock Origin, AdGuard und Co.)' },
];
// [7] Messereignisse, Stand 06.11.2026 (Build der Ereignis-Aenderung):
// 17.741 Seiten laden assets/ereignisse.js (= alle mit Zaehler), 112 Marken
// in 10 Werkzeugen (88 Filter, 22 Rechner, 2 Kopieren; Evolution hat keine
// Bedienelemente), 21 Laeufe (Liste gegen SOLL + 20 Proben). Rechner-Marken
// 14 -> 22 mit der Review-Korrektur: in der Raffinerie sitzen sie an den
// Feldern, die die Vorschau neu rechnen, statt am ganzen Formular, dazu der
// Zuruecksetzen-Knopf im Precision-Jump-Rechner.
const MIN_EREIGNIS_SEITEN = 17000;
const MIN_EREIGNIS_MARKEN = 112;
// 11.11.2026 (Ereignis extern): 8 Proben mehr, 32 Laeufe.
const MIN_EREIGNIS_PROBEN = 32;
// Melde-Links (data-ev-melden, „Falschen Wert melden“ im Datenstand), Stand
// 06.11.2026 (Build der Melde-Aenderung): 17.190 Detailseiten (Items,
// Blueprints, Schiffe, Missionen, je DE und EN). Knapp darunter, ein Datenlauf
// darf ein paar Seiten streichen.
const MIN_MELDE_MARKEN = 17000;
// Ziel-Marken data-ev-extern (Ereignis extern), Stand 11.11.2026: der
// Stripe-Knopf der Unterstuetzen-Seite, DE und EN.
const MIN_EXTERN_MARKEN = 2;

// Seiten OHNE Zaehler, je mit Anlass. Wer `analytics={false}` setzt,
// traegt die Seite hier ein; faellt der Anlass weg, reisst [2]. Auch
// Seiten ohne Layout.astro (eigenes Dokument) stehen hier, wenn sie
// Anmeldedaten entgegennehmen: fuer sie gilt der Zombie-Waechter genauso,
// damit niemand ihnen den Zaehler von Hand nachtraegt.
const KONTO = 'Konto-Dashboard: Ruecksprung nach "Discord verbinden" und Bestaetigungslinks landen hier, die Seite traegt die Sitzung';
const LOGIN = 'Anmeldung: Passwortfeld, Ruecksprung der Discord-Anmeldung und Ziel der Bestaetigungslinks';
const REGISTER = 'Registrierung: Passwortfeld, Discord-Anmeldung startet hier';
const RESET = 'Passwort vergessen: Teil des Anmeldeablaufs, fordert den Wiederherstellungslink an';
const UPDATE = 'Neues Passwort: Ziel des Wiederherstellungslinks, Passwortfeld';
const KEIN_ZAEHLER = [
  { seite: 'account.html', anlass: KONTO },
  { seite: 'de/account.html', anlass: KONTO },
  { seite: 'account/login.html', anlass: LOGIN },
  { seite: 'de/account/login.html', anlass: LOGIN },
  { seite: 'account/register.html', anlass: REGISTER },
  { seite: 'de/account/register.html', anlass: REGISTER },
  { seite: 'account/reset.html', anlass: RESET },
  { seite: 'de/account/reset.html', anlass: RESET },
  { seite: 'account/update-password.html', anlass: UPDATE },
  { seite: 'de/account/update-password.html', anlass: UPDATE },
  {
    seite: 'gate.html',
    anlass: 'Torseite der Vorschau: Anmeldung mit Passwortfeld und Ruecksprung der Discord-Anmeldung (eigenes Dokument, ohne Layout.astro)',
  },
];

const KONTO_PFAD = /^(?:de\/)?account(?:\.html$|\/)/;
// Skript mit absoluter oder protokollrelativer Adresse = fremder Host
// (eigene Skripte bindet der Build mit /_astro/… bzw. /assets/… ein).
const FREMDES_SKRIPT = /<script\b[^>]*\ssrc="((?:https?:)?\/\/[^"]+)"/g;
const LAYOUT_MERKMAL = /<meta name="theme-color" content="/;
const ZAEHLER_TAG = /<script\b[^>]*\sdata-website-id="[^"]*"[^>]*>/g;
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

if (!existsSync(DIST)) {
  console.error('verify-zaehler: dist/ fehlt. Erst `npm run build` — dieses Tor prueft den GEBAUTEN Stand, nicht die Quelle.');
  process.exit(1);
}

function artefakt() {
  const robots = join(DIST, 'robots.txt');
  if (!existsSync(robots)) return 'dist/ ohne robots.txt (unvollstaendiger Build?)';
  return /^Disallow:\s*\/\s*$/m.test(readFileSync(robots, 'utf8')) ? 'dist/ — Vorschau-Build (STAGING=1)' : 'dist/ — Live-Build';
}

const fehler = [];
const fail = (msg) => fehler.push(msg);

/* ---------- Bestand einlesen ---------- */
const seiten = [];
(function walk(dir, rel) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(join(dir, e.name), r);
    else if (e.name.endsWith('.html')) seiten.push(r);
  }
})(DIST, '');
seiten.sort();

const ausnahmeNach = new Map(KEIN_ZAEHLER.map((a) => [a.seite, a]));
const hakenFassungen = new Map(); // Quelltext -> erste Seite
const zaehlerKopien = new Map();  // src ohne Abfrage -> { seite, tag, haken }
let layoutSeiten = 0, zaehlerSeiten = 0, zaehlerTags = 0;
const layoutOhneZaehler = [];
const kontoMitZaehler = [];
const kontoFremdeSkripte = [];
const tagMaengel = [];

const INLINE_SKRIPT = /<script\b(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;
const EREIGNIS_TAG = /<script\b[^>]*\ssrc="(\/assets\/ereignisse\.js[^"]*)"/;
const EREIGNIS_MARKE = /\sdata-ev-(filter|rechnung|kopieren)(?:="([^"]*)")?/g;
const EREIGNIS_AUFRUF = /vbEreignis\(\s*['"]([^'"]*)['"]/g;
// „Falschen Wert melden“: <a … data-ev-melden> im Datenstand der Detailseiten.
const MELDE_MARKE = /<a\b[^>]*\sdata-ev-melden\b[^>]*>/g;
// Detailseiten wie DETAIL_PFADE in assets/ereignisse.js (Pfad ohne /de).
const DETAIL_SEITE = /^(?:items|crafting|schiffe|missionen)\/[^/]+\.html$/;
const meldeMarken = [];
// Ereignis extern: Ziel-Marken und Links nach draussen (Host wie der Browser
// ihn liest, ohne www.) auf gezaehlten Seiten.
const EXTERN_MARKE = /\sdata-ev-extern(?:="([^"]*)")?/g;
const EXTERN_LINK = /<a\b[^>]*?\shref="(?:https?:)?\/\/([^/"?#:]+)/gi;
const externMarken = [];
const externLinks = new Map(); // Host ohne www. -> Zahl der Links
let externLinksGesamt = 0;
let ereignisSeiten = 0;
const zaehlerOhneEreignis = [];
const ereignisOhneZaehler = [];
const ereignisVorZaehler = [];
const ereignisSkripte = new Map(); // src ohne Abfrage -> erste Seite
const ereignisMarken = [];
const ereignisAufrufe = [];

for (const s of seiten) {
  const html = readFileSync(join(DIST, s), 'utf8');
  const layout = LAYOUT_MERKMAL.test(html);
  const tags = html.match(ZAEHLER_TAG) ?? [];
  if (layout) layoutSeiten++;
  if (tags.length) zaehlerSeiten++;
  zaehlerTags += tags.length;

  if (layout && !tags.length && !ausnahmeNach.has(s)) layoutOhneZaehler.push(s);
  if (tags.length && KONTO_PFAD.test(s)) kontoMitZaehler.push(s);
  if (KONTO_PFAD.test(s))
    for (const [, src] of html.matchAll(FREMDES_SKRIPT)) kontoFremdeSkripte.push(`${s}: ${src}`);

  // [7] Messereignisse: Skript-Tag, Markierungen, Aufrufe
  const evTag = EREIGNIS_TAG.exec(html);
  if (evTag) ereignisSeiten++;
  if (tags.length && !evTag) zaehlerOhneEreignis.push(s);
  if (evTag && !tags.length) ereignisOhneZaehler.push(s);
  if (evTag && tags.length && html.indexOf(tags[0]) > evTag.index) ereignisVorZaehler.push(s);
  if (evTag && !ereignisSkripte.has(evTag[1].split('?')[0])) ereignisSkripte.set(evTag[1].split('?')[0], s);
  for (const m of html.matchAll(EREIGNIS_MARKE)) ereignisMarken.push({ seite: s, art: m[1], wert: m[2] ?? null, gezaehlt: tags.length > 0 });
  for (const m of html.matchAll(EREIGNIS_AUFRUF)) ereignisAufrufe.push({ wo: s, name: m[1] });
  for (const m of html.matchAll(EXTERN_MARKE)) externMarken.push({ seite: s, wert: m[1] ?? null, gezaehlt: tags.length > 0 });
  if (tags.length)
    for (const m of html.matchAll(EXTERN_LINK)) {
      const h = m[1].toLowerCase().replace(/^www\./, '');
      externLinks.set(h, (externLinks.get(h) ?? 0) + 1);
      externLinksGesamt++;
    }
  // href wie der Browser ihn liest: Astro schreibt & als &#38;, andere als &amp;.
  for (const m of html.matchAll(MELDE_MARKE)) meldeMarken.push({ seite: s, href: (/\shref="([^"]*)"/.exec(m[0])?.[1] ?? null)?.replace(/&(?:amp|#38|#x26);/gi, '&') ?? null, gezaehlt: tags.length > 0 });

  for (const tag of tags) {
    const maengel = [];
    if (attr(tag, 'data-exclude-hash') !== 'true') maengel.push('data-exclude-hash="true" fehlt');
    if (attr(tag, 'data-exclude-search') !== 'true') maengel.push('data-exclude-search="true" fehlt');
    const haken = attr(tag, 'data-before-send');
    if (!haken) maengel.push('data-before-send fehlt');
    else {
      const def = new RegExp(`\\bwindow\\.${haken.replace(/[^\w$]/g, '')}\\s*=`);
      const quelle = [...html.matchAll(INLINE_SKRIPT)].map((m) => m[1]).find((js) => def.test(js));
      if (!quelle) maengel.push(`die Seite definiert den Haken window.${haken} nicht — Umami schickt dann ungefiltert`);
      else if (!hakenFassungen.has(quelle)) hakenFassungen.set(quelle, { seite: s, name: haken });
      const src = attr(tag, 'src') ?? '';
      if (!/^\/(?!\/)/.test(src))
        maengel.push(`src="${src}" — das Zaehlskript kommt vom eigenen Ursprung (gepinnte Kopie public/vendor/zaehler/zaehler.js, siehe scripts/vendor-umami.mjs), nicht von einem fremden Host`);
      else if (quelle && !zaehlerKopien.has(src.split('?')[0])) zaehlerKopien.set(src.split('?')[0], { seite: s, tag, haken: quelle });
    }
    if (!/^https:\/\/[^/"]+\/?$/.test(attr(tag, 'data-host-url') ?? ''))
      maengel.push('data-host-url fehlt oder ist keine https-Adresse ohne Pfad — Umami schickte die Zaehlung an den eigenen Ursprung');
    if (maengel.length) tagMaengel.push(`${s}: ${maengel.join('; ')}`);
  }
}

console.log('\n=== verify-zaehler: Reichweitenmessung gegen den gebauten Stand (Schiene A) ===');
console.log(`Geprueftes Artefakt: ${artefakt()}`);
console.log(
  `Seiten: ${seiten.length}   Layout-Seiten: ${layoutSeiten}   mit Zaehler: ${zaehlerSeiten} (${zaehlerTags} Tag(s))   ` +
    `Ausnahmen: ${KEIN_ZAEHLER.length}   Haken-Fassungen: ${hakenFassungen.size}`,
);

/* ---- [1] Jede Layout-Seite zaehlt, ausser den benannten Ausnahmen ---- */
console.log('\n[1] Jede Layout-Seite laedt den Zaehler, ausser den benannten Ausnahmen');
console.log(`    Layout-Seiten ohne Zaehler und ohne Eintrag — Soll: 0   Ist: ${layoutOhneZaehler.length}`);
for (const s of layoutOhneZaehler.slice(0, 20))
  fail(`${s}: Layout-Seite ohne Zaehler und ohne Eintrag in KEIN_ZAEHLER — entweder mit Anlass eintragen (Seite nimmt Anmeldedaten entgegen) oder analytics={false} entfernen`);
if (layoutOhneZaehler.length > 20) fail(`… und ${layoutOhneZaehler.length - 20} weitere Layout-Seiten ohne Zaehler`);

/* ---- [2] Zombie-Waechter ---- */
console.log('\n[2] Zombie-Waechter: jede Ausnahme existiert und laedt den Zaehler nicht');
let zombies = 0;
for (const a of KEIN_ZAEHLER) {
  if (!a.anlass || a.anlass.trim().length < 10) { zombies++; fail(`${a.seite}: Ausnahme ohne Anlass`); continue; }
  const p = join(DIST, a.seite);
  if (!existsSync(p)) { zombies++; fail(`${a.seite}: Ausnahme, aber die Seite gibt es in dist/ nicht mehr — Eintrag entfernen`); continue; }
  const html = readFileSync(p, 'utf8');
  if ((html.match(ZAEHLER_TAG) ?? []).length) { zombies++; fail(`${a.seite}: steht als Ausnahme (${a.anlass}), laedt den Zaehler aber — analytics={false} ist verloren gegangen`); }
}
console.log(`    Ausnahmen: ${KEIN_ZAEHLER.length}   Zombies — Soll: 0   Ist: ${zombies}`);

/* ---- [3] Pfadregel fuer Kontoseiten ---- */
console.log('\n[3] Pfadregel: keine Kontoseite laedt den Zaehler');
const kontoSeiten = seiten.filter((s) => KONTO_PFAD.test(s));
console.log(`    Kontoseiten in dist/: ${kontoSeiten.length}   davon mit Zaehler — Soll: 0   Ist: ${kontoMitZaehler.length}`);
for (const s of kontoMitZaehler)
  fail(`${s}: Kontoseite laedt den Zaehler — im Seitenkopf analytics={false} setzen und die Seite in KEIN_ZAEHLER eintragen`);
const kontoOhneEintrag = kontoSeiten.filter((s) => !ausnahmeNach.has(s));
for (const s of kontoOhneEintrag)
  fail(`${s}: Kontoseite ohne Eintrag in KEIN_ZAEHLER — mit Anlass eintragen`);
console.log(`    Skripte fremder Hosts auf Kontoseiten (WARNUNG, blockt nicht): ${kontoFremdeSkripte.length}`);
for (const w of kontoFremdeSkripte.slice(0, 10))
  console.log(`    WARNUNG ${w} — laeuft neben Passwortfeld und Sitzung; gewollt? Sonst entfernen`);
if (kontoFremdeSkripte.length > 10) console.log(`    WARNUNG … und ${kontoFremdeSkripte.length - 10} weitere`);

/* ---- [4] Attribute und Haken an jedem Tag ---- */
console.log('\n[4] Jeder Zaehler-Tag: Fragment und Abfrage ausgeschlossen, Haken definiert');
console.log(`    Tags: ${zaehlerTags}   mangelhaft — Soll: 0   Ist: ${tagMaengel.length}`);
for (const m of tagMaengel.slice(0, 20)) fail(m);
if (tagMaengel.length > 20) fail(`… und ${tagMaengel.length - 20} weitere mangelhafte Tags`);

/* ---- [5] Der ausgelieferte Haken, ausgefuehrt ---- */
console.log('\n[5] Der ausgelieferte Haken schneidet Abfrage und Fragment ab (node:vm)');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
function fahre(quelle, name, cookie = '') {
  const ctx = {
    navigator: { webdriver: false, userAgent: UA },
    screen: { width: 1920, height: 1080 },
    document: { referrer: 'https://example.org/', cookie },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(quelle, ctx, { timeout: 1000 });
  const fn = ctx[name];
  if (typeof fn !== 'function') throw new Error(`window.${name} ist nach dem Ausfuehren keine Funktion`);
  return (daten) => fn('event', daten);
}
let hakenGeprueft = 0;
for (const [quelle, { seite, name }] of hakenFassungen) {
  hakenGeprueft++;
  let haken;
  try { haken = fahre(quelle, name); } catch (e) { fail(`${seite}: Haken laesst sich nicht ausfuehren — ${e.message}`); continue; }
  const probe = (titel, daten, pruefe) => {
    let r;
    try { r = haken(structuredClone(daten)); } catch (e) { fail(`${seite}: ${titel} — der Haken wirft (${e.message}); ein Wurf legt die Zaehlung still`); return; }
    const m = pruefe(r);
    if (m) fail(`${seite}: ${titel} — ${m}`);
  };
  probe(
    'volle Adresse mit Abfrage und Fragment',
    { url: 'https://verse-base.com/schiffe/probe.html?v=1&code=2#abschnitt&x=1', referrer: 'https://verse-base.com/account/login.html?confirmed=1#y=2', website: 'w' },
    (r) =>
      !r ? 'liefert null fuer einen normalen Aufruf'
        : r.url !== 'https://verse-base.com/schiffe/probe.html' ? `url bleibt "${r.url}"`
        : r.referrer !== 'https://verse-base.com/account/login.html' ? `referrer bleibt "${r.referrer}"`
        : null,
  );
  probe(
    'reiner Pfad mit Abfrage und Fragment',
    { url: '/schiffe/probe.html?token_hash=1&type=x#abschnitt', referrer: '/archiv.html#y', website: 'w' },
    (r) =>
      !r ? 'liefert null fuer einen normalen Aufruf'
        : r.url !== '/schiffe/probe.html' ? `url bleibt "${r.url}"`
        : r.referrer !== '/archiv.html' ? `referrer bleibt "${r.referrer}"`
        : null,
  );
  probe(
    'Adresse ohne Abfrage und Fragment',
    { url: 'https://verse-base.com/support.html', referrer: '', website: 'w' },
    (r) => (!r ? 'liefert null fuer einen normalen Aufruf' : r.url !== 'https://verse-base.com/support.html' ? `url wird zu "${r.url}"` : null),
  );
  probe('Aufruf ohne url/referrer', { website: 'w', name: 'probe' }, () => null);
  try {
    const r = fahre(quelle, name, 'vb_theme=dark; vb_noanalytics=1')({ url: 'https://verse-base.com/support.html', website: 'w' });
    if (r !== null && r !== undefined && r !== false)
      fail(`${seite}: mit Widerspruchs-Cookie vb_noanalytics=1 liefert der Haken trotzdem Daten — die Datenschutzseite verspricht, dass dann nichts gezaehlt wird`);
  } catch (e) { fail(`${seite}: Haken wirft mit Widerspruchs-Cookie (${e.message})`); }
}
console.log(`    Haken-Fassungen ausgefuehrt: ${hakenGeprueft}   je 5 Proben`);

/* ---- [6] Die gepinnte Kopie des Zaehlers, ausgefuehrt ---- */
console.log('\n[6] Gepinnte Zaehler-Kopie: Pruefsumme und Lauf in node:vm');
const sha256 = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
const KOPF_ENDE = ' * --- Ende des Kopfes --- */\n';
async function zaehle(quelle, haken, tag, src, { href, cookie = '', referrer = '' }) {
  const u = new URL(href);
  const aufrufe = [];
  const attrs = new Map([...tag.matchAll(/\s([a-z][a-z0-9-]*)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const ctx = {
    navigator: { webdriver: false, userAgent: UA, language: 'de-DE' },
    screen: { width: 1920, height: 1080 },
    location: { hostname: u.hostname, href: u.href, origin: u.origin },
    history: { pushState() {}, replaceState() {} },
    localStorage: { getItem: () => null },
    URL, setTimeout, clearTimeout,
  };
  ctx.document = {
    referrer, cookie, title: 'Probe', readyState: 'complete', addEventListener() {},
    currentScript: { src: `${u.origin}${src}`, getAttribute: (n) => attrs.get(n) ?? null },
  };
  ctx.window = ctx;
  ctx.top = ctx;
  // Netz gibt es hier nicht: der Stub nimmt den Aufruf nur entgegen.
  ctx.fetch = async (ziel, opts) => { aufrufe.push({ ziel: String(ziel), opts }); return { json: async () => ({}) }; };
  vm.createContext(ctx);
  vm.runInContext(haken, ctx, { timeout: 1000 });
  vm.runInContext(quelle, ctx, { timeout: 1000 });
  await new Promise((r) => setTimeout(r, 30));
  return { aufrufe, attrs };
}
let kopienGeprueft = 0;
for (const [src, { seite, tag, haken }] of zaehlerKopien) {
  const datei = join(DIST, src);
  if (!existsSync(datei)) { fail(`${seite}: Zaehler-Tag zeigt auf ${src}, die Datei fehlt in dist/ — Umami laedt nicht`); continue; }
  kopienGeprueft++;
  // Pruefsumme ueber LF-Zeilenenden: ein Windows-Checkout mit
  // core.autocrlf=true liefert die Datei mit CRLF aus, der Inhalt ist derselbe.
  const text = readFileSync(datei, 'utf8').replace(/\r\n?/g, '\n');
  const teil = text.indexOf(KOPF_ENDE);
  const soll = /Rumpf-sha256:\s*([0-9a-f]{64})/.exec(teil < 0 ? '' : text.slice(0, teil))?.[1];
  const rumpf = teil < 0 ? '' : text.slice(teil + KOPF_ENDE.length);
  const fassung = /Fassung:\s*(\S+)/.exec(text)?.[1] ?? '?';
  if (!soll) fail(`${src}: Kopf mit Rumpf-sha256 fehlt — die Kopie nur mit scripts/vendor-umami.mjs erneuern`);
  else if (sha256(rumpf) !== soll) fail(`${src}: Rumpf passt nicht zur Pruefsumme im Kopf (von Hand geaendert?) — mit scripts/vendor-umami.mjs neu erzeugen, Diff lesen`);
  let lauf;
  try {
    lauf = await zaehle(rumpf || text, haken, tag, src, {
      href: 'https://verse-base.com/schiffe/probe.html?code=1&type=x#access_token=geheim',
      referrer: 'https://example.org/suche?q=1#x',
    });
  } catch (e) { fail(`${src}: laeuft in node:vm nicht (${e.message})`); continue; }
  const ziel = `${(lauf.attrs.get('data-host-url') ?? '').replace(/\/$/, '')}/api/send`;
  console.log(`    ${src} (${fassung}, ${rumpf.length} Zeichen Rumpf): Aufrufe ${lauf.aufrufe.length} -> ${lauf.aufrufe.map((a) => a.ziel).join(', ') || '—'}`);
  if (lauf.aufrufe.length !== 1) fail(`${src}: Seitenaufruf erzeugt ${lauf.aufrufe.length} Zaehl-Aufrufe, Soll genau 1`);
  for (const a of lauf.aufrufe) {
    let body = null;
    try { body = JSON.parse(a.opts?.body ?? ''); } catch { /* unten */ }
    const p = body?.payload ?? {};
    if (a.ziel !== ziel) fail(`${src}: zaehlt an ${a.ziel}, Soll ${ziel} (data-host-url)`);
    if (a.opts?.method !== 'POST') fail(`${src}: Zaehl-Aufruf mit Methode ${a.opts?.method}, Soll POST`);
    if (p.website !== lauf.attrs.get('data-website-id')) fail(`${src}: Website-Kennung "${p.website}" statt der aus data-website-id`);
    if (typeof p.url !== 'string' || /[?#]/.test(p.url)) fail(`${src}: url "${p.url}" traegt Abfrage oder Fragment`);
    if (typeof p.referrer === 'string' && /[?#]/.test(p.referrer)) fail(`${src}: referrer "${p.referrer}" traegt Abfrage oder Fragment`);
  }
  const still = [
    ['Widerspruchs-Cookie', { href: 'https://verse-base.com/support.html', cookie: 'vb_noanalytics=1' }],
    ['fremder Hostname (Vorschau)', { href: 'https://staging.verse-base.com/support.html' }],
  ];
  for (const [titel, opt] of still) {
    try {
      const r = await zaehle(rumpf || text, haken, tag, src, opt);
      console.log(`      ${titel}: Aufrufe — Soll: 0   Ist: ${r.aufrufe.length}`);
      if (r.aufrufe.length) fail(`${src}: ${titel} — der Zaehler schickt trotzdem (${r.aufrufe[0].ziel})`);
    } catch (e) { fail(`${src}: ${titel} — laeuft in node:vm nicht (${e.message})`); }
  }
}
console.log(`    Zaehler-Kopien geprueft: ${kopienGeprueft}   je 3 Laeufe`);
// Pfade der Messung gegen Werbeblocker-Muster: ein gesperrter Pfad laesst
// den Zaehler bei deren Nutzern gar nicht laden, keine Seite merkt etwas.
const messPfade = [...new Set([...zaehlerKopien.keys(), ...ereignisSkripte.keys()])];
const gesperrt = messPfade.flatMap((pfad) => BLOCKER_MUSTER.filter((m) => m.re.test(pfad)).map((m) => ({ pfad, m })));
console.log(`    Mess-Skripte gegen Werbeblocker-Muster: ${messPfade.length} Pfad(e) (${messPfade.join(', ') || '—'}), ${BLOCKER_MUSTER.length} Muster   gesperrt — Soll: 0   Ist: ${gesperrt.length}`);
for (const { pfad, m } of gesperrt)
  fail(`${pfad}: Pfad trifft das Werbeblocker-Muster ${m.re} (${m.liste}) — bei deren Nutzern laedt das Skript nicht, Seitenaufrufe und Ereignisse fehlen still; Datei neutral benennen (Zaehler: ZIEL in scripts/vendor-umami.mjs und der Tag in Layout.astro)`);

/* ---- [7] Messereignisse: Liste, Markierungen, Lauf in node:vm ---- */
console.log('\n[7] Messereignisse: nur die freigegebene Liste, nur feste Werte (scripts/lib/ereignisse.mjs)');
// 7.1 Jede gezaehlte Seite laedt assets/ereignisse.js, nach dem Zaehler; keine andere.
console.log(`    Seiten mit Ereignis-Skript: ${ereignisSeiten}   Zaehler ohne Ereignis-Skript — Soll: 0   Ist: ${zaehlerOhneEreignis.length}   Ereignis-Skript ohne Zaehler — Soll: 0   Ist: ${ereignisOhneZaehler.length}   vor dem Zaehler — Soll: 0   Ist: ${ereignisVorZaehler.length}`);
for (const s of zaehlerOhneEreignis.slice(0, 10)) fail(`${s}: laedt den Zaehler, aber nicht assets/ereignisse.js — Layout.astro bindet beide gemeinsam ein`);
for (const s of ereignisOhneZaehler.slice(0, 10)) fail(`${s}: laedt assets/ereignisse.js ohne Zaehler — auf Seiten ohne Zaehler (Konto, Anmeldung) laeuft auch keine Messung`);
for (const s of ereignisVorZaehler.slice(0, 10)) fail(`${s}: assets/ereignisse.js steht vor dem Zaehler-Tag — beide laden mit defer in Reihenfolge, window.umami muss zuerst da sein`);

// 7.2 Markierungen: nur freigegebene Filternamen, nur auf Werkzeugseiten, jeder Name in Gebrauch.
const seiteZuWerkzeug = (s) => WERKZEUG_SEITEN['/' + s.replace(/^de\//, '')] ?? null;
const filterSet = new Set(FILTER);
const benutzteFilter = new Set();
const werkzeugeMitMarke = new Set();
let markenFehler = 0;
for (const m of ereignisMarken) {
  const wz = seiteZuWerkzeug(m.seite);
  if (!m.gezaehlt) continue; // Konto-Seiten laden kein Ereignis-Skript: die Marke ist dort stumm, und das ist gewollt
  if (!wz) { markenFehler++; if (markenFehler <= 10) fail(`${m.seite}: data-ev-${m.art} auf einer Seite, die kein Werkzeug ist — assets/ereignisse.js beachtet Marken nur auf den Seiten aus WERKZEUG_SEITEN, die Marke waere tot`); continue; }
  werkzeugeMitMarke.add(wz);
  if (m.art === 'filter') {
    if (!m.wert || !filterSet.has(m.wert)) { markenFehler++; if (markenFehler <= 10) fail(`${m.seite}: data-ev-filter="${m.wert ?? ''}" steht nicht in FILTER (scripts/lib/ereignisse.mjs) — das Ereignis wuerde verworfen; Namen nur mit Freigabe ergaenzen`); continue; }
    benutzteFilter.add(m.wert);
  } else if (m.wert !== null && m.wert !== '') {
    markenFehler++; if (markenFehler <= 10) fail(`${m.seite}: data-ev-${m.art}="${m.wert}" — diese Marke traegt keinen Wert`);
  }
}
const ungenutzt = FILTER.filter((f) => !benutzteFilter.has(f));
for (const f of ungenutzt) fail(`FILTER "${f}" steht in der Liste, aber an keinem Bedienelement — Eintrag ohne Anlass entfernen (Zombie)`);
console.log(`    Marken: ${ereignisMarken.length} (${ereignisMarken.filter((m) => m.art === 'filter').length} Filter, ${ereignisMarken.filter((m) => m.art === 'rechnung').length} Rechnung, ${ereignisMarken.filter((m) => m.art === 'kopieren').length} Kopieren)   Werkzeuge mit Marke: ${werkzeugeMitMarke.size} von ${Object.keys(WERKZEUG_SEITEN).length}   Filternamen in Gebrauch: ${benutzteFilter.size} von ${FILTER.length}   fehlerhaft — Soll: 0   Ist: ${markenFehler}`);
// 7.2b Melde-Links: nur auf Detailseiten (sonst schickt ereignisse.js nichts,
// die Marke waere tot), href auf das Feedback-Formular derselben Sprache mit
// genau dem eigenen Pfad als ?wert= (das Formular nimmt nur solche Pfade).
let meldeFehler = 0;
const meldeSeiten = new Set();
for (const m of meldeMarken) {
  const ohneDe = m.seite.replace(/^de\//, '');
  const soll = `${m.seite.startsWith('de/') ? '/de' : ''}/feedback.html?wert=/${m.seite}`;
  if (!DETAIL_SEITE.test(ohneDe)) { meldeFehler++; if (meldeFehler <= 10) fail(`${m.seite}: data-ev-melden auf einer Seite, die keine Detailseite ist — assets/ereignisse.js sendet wert-melden nur von Item-, Blueprint-, Schiffs- und Missionsseiten`); continue; }
  if (!m.gezaehlt) { meldeFehler++; if (meldeFehler <= 10) fail(`${m.seite}: Melde-Link auf einer Seite ohne Zaehler`); continue; }
  if (meldeSeiten.has(m.seite)) { meldeFehler++; if (meldeFehler <= 10) fail(`${m.seite}: mehr als ein Melde-Link`); continue; }
  meldeSeiten.add(m.seite);
  if (m.href !== soll) { meldeFehler++; if (meldeFehler <= 10) fail(`${m.seite}: Melde-Link zeigt auf ${JSON.stringify(m.href)}, Soll ${JSON.stringify(soll)} — eigener Pfad, Formular derselben Sprache`); }
}
console.log(`    Melde-Links: ${meldeMarken.length} auf ${meldeSeiten.size} Detailseiten   fehlerhaft — Soll: 0   Ist: ${meldeFehler}`);
// 7.2c Ereignis extern: Ziel-Marken nur mit freigegebenem Ziel und nur auf
// gezaehlten Seiten; jeder Host in EXTERN_HOSTS hat einen Link im gebauten
// Stand (sonst Eintrag ohne Anlass), und jedes Ziel ausser „sonst“ ist ueber
// einen Host oder eine Marke erreichbar.
const externSet = new Set(EXTERN);
let externFehler = 0;
for (const m of externMarken) {
  if (!m.wert || !externSet.has(m.wert) || m.wert === 'sonst') { externFehler++; if (externFehler <= 10) fail(`${m.seite}: data-ev-extern="${m.wert ?? ''}" ist kein freigegebenes Ziel (EXTERN in scripts/lib/ereignisse.mjs, ohne „sonst“) — das Ereignis wuerde verworfen`); continue; }
  if (!m.gezaehlt) { externFehler++; if (externFehler <= 10) fail(`${m.seite}: data-ev-extern auf einer Seite ohne Zaehler — die Marke waere tot`); }
}
const hostOhneLink = Object.keys(EXTERN_HOSTS).filter((h) => !externLinks.has(h));
for (const h of hostOhneLink) fail(`EXTERN_HOSTS nennt ${h}, aber keine gezaehlte Seite verlinkt dorthin — Eintrag ohne Anlass entfernen (Zombie) oder der Link ist verloren gegangen`);
for (const [h, z] of Object.entries(EXTERN_HOSTS)) {
  if (h !== h.toLowerCase() || /^www\./.test(h)) fail(`EXTERN_HOSTS: "${h}" — Hosts klein und ohne www. eintragen, assets/ereignisse.js vergleicht so`);
  if (!externSet.has(z) || z === 'sonst') fail(`EXTERN_HOSTS: ${h} -> "${z}" ist kein Ziel aus EXTERN (ohne „sonst“)`);
}
const erreichbar = new Set([...Object.values(EXTERN_HOSTS), ...externMarken.map((m) => m.wert)]);
for (const z of EXTERN.filter((z) => z !== 'sonst' && !erreichbar.has(z))) fail(`EXTERN nennt das Ziel "${z}", aber kein Host und keine Marke fuehrt dorthin — Eintrag ohne Anlass (Zombie)`);
const proZiel = {};
for (const [h, n] of externLinks) { const z = EXTERN_HOSTS[h] ?? 'sonst'; proZiel[z] = (proZiel[z] ?? 0) + n; }
console.log(`    Links nach draussen auf gezaehlten Seiten: ${externLinksGesamt} (${EXTERN.map((z) => `${z} ${proZiel[z] ?? 0}`).join(', ')})   Ziel-Marken data-ev-extern: ${externMarken.length}   Hosts ohne Link — Soll: 0   Ist: ${hostOhneLink.length}   fehlerhafte Marken — Soll: 0   Ist: ${externFehler}`);
// Jede Werkzeugseite gibt es (beide Sprachen) und sie zaehlt.
for (const p of Object.keys(WERKZEUG_SEITEN)) {
  for (const s of [p.slice(1), `de${p}`]) {
    const datei = join(DIST, s);
    if (!existsSync(datei)) { fail(`WERKZEUG_SEITEN nennt ${p}, aber ${s} fehlt in dist/ — Eintrag ohne Anlass (Zombie) oder verlorene Seite`); continue; }
    if (!EREIGNIS_TAG.test(readFileSync(datei, 'utf8'))) fail(`${s}: Werkzeugseite ohne assets/ereignisse.js`);
  }
}

// 7.3 Jeder Aufruf von vbEreignis im gebauten Stand nennt ein freigegebenes Ereignis.
const assetsDir = join(DIST, 'assets');
if (existsSync(assetsDir))
  for (const f of readdirSync(assetsDir).filter((f) => f.endsWith('.js') && f !== 'ereignisse.js'))
    for (const m of readFileSync(join(assetsDir, f), 'utf8').matchAll(EREIGNIS_AUFRUF)) ereignisAufrufe.push({ wo: `assets/${f}`, name: m[1] });
const fremdeAufrufe = ereignisAufrufe.filter((a) => !Object.prototype.hasOwnProperty.call(EREIGNISSE, a.name));
const aufrufNamen = new Set(ereignisAufrufe.map((a) => a.name));
console.log(`    Aufrufe von vbEreignis: ${ereignisAufrufe.length} an ${new Set(ereignisAufrufe.map((a) => a.wo)).size} Stellen (${[...aufrufNamen].sort().join(', ') || '—'})   nicht freigegeben — Soll: 0   Ist: ${fremdeAufrufe.length}`);
for (const a of fremdeAufrufe.slice(0, 10)) fail(`${a.wo}: vbEreignis('${a.name}') — kein freigegebenes Ereignis`);
for (const n of ['suche-offen', 'suche-treffer']) if (!aufrufNamen.has(n)) fail(`kein Aufruf von vbEreignis('${n}') im gebauten Stand — die Suche meldet ihr Ereignis nicht mehr`);

// 7.4 Die ausgelieferte Datei, ausgefuehrt mit dem gepinnten Zaehler und dem Haken der Seite.
let probenGelaufen = 0;
const [zSrc, zKopie] = [...zaehlerKopien][0] ?? [];
const [eSrc] = [...ereignisSkripte][0] ?? [];
if (!zSrc || !eSrc || !existsSync(join(DIST, eSrc))) {
  fail(`[7] ohne Lauf: ${!zSrc ? 'keine Zaehler-Kopie' : `assets/ereignisse.js fehlt in dist/ (${eSrc ?? 'kein Tag'})`}`);
} else {
  const zText = readFileSync(join(DIST, zSrc), 'utf8').replace(/\r\n?/g, '\n');
  const zTeil = zText.indexOf(KOPF_ENDE);
  const zRumpf = zTeil < 0 ? zText : zText.slice(zTeil + KOPF_ENDE.length);
  const eQuelle = readFileSync(join(DIST, eSrc), 'utf8');
  const zAttrs = new Map([...zKopie.tag.matchAll(/\s([a-z][a-z0-9-]*)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const STANDARD = new Set(['website', 'screen', 'language', 'title', 'hostname', 'url', 'referrer', 'tag', 'id', 'name', 'data']);

  async function seite({ pfad, html = '', cookie = '', host = 'verse-base.com' }) {
    const u = new URL(`https://${host}${pfad}?code=geheim#access_token=x`);
    const { window: lw, document: doc } = parseHTML(`<!doctype html><html><head><title>Gladius Probe-Item</title></head><body>${html}</body></html>`);
    const posts = [];
    const ctx = {
      navigator: { webdriver: false, userAgent: UA, language: 'de-DE' },
      screen: { width: 1920, height: 1080 },
      location: { hostname: u.hostname, href: u.href, origin: u.origin, pathname: u.pathname },
      history: { pushState() {}, replaceState() {} },
      localStorage: { getItem: () => null },
      URL, setTimeout, clearTimeout, Promise, Object, JSON,
    };
    Object.defineProperty(doc, 'cookie', { value: cookie, configurable: true });
    Object.defineProperty(doc, 'referrer', { value: 'https://example.org/suche?q=gladius', configurable: true });
    // 'loading': kein automatischer Seitenaufruf, nur die Ereignisse zaehlen
    Object.defineProperty(doc, 'readyState', { value: 'loading', configurable: true });
    Object.defineProperty(doc, 'currentScript', { value: { src: `${u.origin}${zSrc}`, getAttribute: (n) => zAttrs.get(n) ?? null }, configurable: true });
    ctx.document = doc;
    ctx.window = ctx;
    ctx.top = ctx;
    ctx.fetch = async (ziel, opts) => { posts.push({ ziel: String(ziel), opts }); return { json: async () => ({}) }; };
    vm.createContext(ctx);
    vm.runInContext(zKopie.haken, ctx, { timeout: 1000 });
    vm.runInContext(zRumpf, ctx, { timeout: 1000 });
    Object.defineProperty(doc, 'currentScript', { value: null, configurable: true });
    vm.runInContext(eQuelle, ctx, { timeout: 1000 });
    const ereignis = (typ, el, echt = true) => {
      const ev = new lw.Event(typ, { bubbles: true });
      if (echt) Object.defineProperty(ev, 'isTrusted', { value: true });
      el.dispatchEvent(ev);
    };
    const warte = () => new Promise((r) => setTimeout(r, 20));
    const gesendet = () => posts.map((p) => { try { return JSON.parse(p.opts?.body ?? ''); } catch { return null; } });
    return { ctx, doc, posts, ereignis, warte, gesendet };
  }

  // Die Liste in der Datei gegen das SOLL
  {
    const { ctx } = await seite({ pfad: '/support.html' });
    const liste = ctx.vbEreignis?.liste;
    const wzs = ctx.vbEreignis?.werkzeugSeiten;
    probenGelaufen++;
    if (!liste) fail(`${eSrc}: window.vbEreignis.liste fehlt — die Liste ist nicht pruefbar`);
    else {
      const istObj = Object.fromEntries(Object.keys(liste).sort().map((n) => [n, Object.fromEntries(Object.keys(liste[n]).sort().map((k) => [k, liste[n][k].split(/\s+/).filter(Boolean).sort()]))]));
      const sollObj = Object.fromEntries(Object.keys(EREIGNISSE).sort().map((n) => [n, Object.fromEntries(Object.keys(EREIGNISSE[n]).sort().map((k) => [k, [...EREIGNISSE[n][k]].sort()]))]));
      if (JSON.stringify(istObj) !== JSON.stringify(sollObj)) {
        for (const n of new Set([...Object.keys(istObj), ...Object.keys(sollObj)]))
          if (JSON.stringify(istObj[n]) !== JSON.stringify(sollObj[n]))
            fail(`${eSrc}: Ereignis "${n}" weicht vom SOLL ab — Datei ${JSON.stringify(istObj[n] ?? null)}, SOLL ${JSON.stringify(sollObj[n] ?? null)} (scripts/lib/ereignisse.mjs)`);
      }
    }
    if (JSON.stringify(wzs ?? null) !== JSON.stringify(WERKZEUG_SEITEN)) fail(`${eSrc}: WERKZEUG_SEITEN weicht vom SOLL ab — Datei ${JSON.stringify(wzs ?? null)}`);
    const exh = ctx.vbEreignis?.externHosts;
    if (JSON.stringify(exh ?? null) !== JSON.stringify(EXTERN_HOSTS)) fail(`${eSrc}: EXTERN_HOSTS weicht vom SOLL ab — Datei ${JSON.stringify(exh ?? null)}`);
  }

  // Proben: [Titel, Seite, Handlung, erwartete Ereignisse]
  const MAIN = (inner) => `<header><nav><a id="nav" href="/schiffe/aegs-gladius.html">Gladius</a><a id="login" href="/account/login.html">Login</a></nav></header><main>${inner}</main>`;
  const PROBEN = [
    ['suche-offen auf einer Item-Seite, zweimal', { pfad: '/items/probe-item.html' }, (p) => { p.ctx.vbEreignis('suche-offen'); p.ctx.vbEreignis('suche-offen'); },
      [{ name: 'suche-offen', data: { seite: 'item' }, url: '/items/' }]],
    ['suche-treffer auf /de/schiffe.html', { pfad: '/de/schiffe.html' }, (p) => p.ctx.vbEreignis('suche-treffer', { art: 'item', platz: '4-10' }),
      [{ name: 'suche-treffer', data: { art: 'item', platz: '4-10' }, url: '/de/schiffe.html' }]],
    ['suche-treffer mit fremder Art (Name statt Art)', { pfad: '/schiffe.html' }, (p) => p.ctx.vbEreignis('suche-treffer', { art: 'Gladius', platz: '1-3' }), []],
    ['suche-treffer mit Zusatzfeld Suchbegriff', { pfad: '/schiffe.html' }, (p) => p.ctx.vbEreignis('suche-treffer', { art: 'item', platz: '1-3', q: 'gladius' }), []],
    ['suche-treffer ohne Platz', { pfad: '/schiffe.html' }, (p) => p.ctx.vbEreignis('suche-treffer', { art: 'item' }), []],
    ['unbekanntes Ereignis', { pfad: '/schiffe.html' }, (p) => p.ctx.vbEreignis('suche-begriff', { q: 'gladius' }), []],
    ['Klick Item -> Schiff im Inhalt', { pfad: '/items/probe-item.html', html: MAIN('<a id="z" href="/schiffe/aegs-gladius.html"><span id="t">Gladius</span></a>') },
      (p) => p.ereignis('click', p.doc.getElementById('t')), [{ name: 'weiter-detail', data: { seite: 'item', ziel: 'schiff' }, url: '/items/' }]],
    ['Klick Schiff -> Werkzeug mit ?Parameter', { pfad: '/de/schiffe/aegs-gladius.html', html: MAIN('<a id="z" href="/de/fracturing.html?mineral=quantainium">Bruch</a>') },
      (p) => p.ereignis('click', p.doc.getElementById('z')), [{ name: 'weiter-werkzeug', data: { seite: 'schiff', werkzeug: 'fracturing' }, url: '/de/schiffe/' }]],
    ['Klick in der Navigation einer Detailseite', { pfad: '/items/probe-item.html', html: MAIN('') }, (p) => p.ereignis('click', p.doc.getElementById('nav')), []],
    ['Klick ohne echte Bedienung (programmatisch)', { pfad: '/items/probe-item.html', html: MAIN('<a id="z" href="/schiffe/aegs-gladius.html">G</a>') }, (p) => p.ereignis('click', p.doc.getElementById('z'), false), []],
    ['Anmelden aus der Navigation eines Werkzeugs', { pfad: '/missionen.html', html: MAIN('') }, (p) => p.ereignis('click', p.doc.getElementById('login')),
      [{ name: 'anmeldung-einstieg', data: { von: 'missionen', ziel: 'anmelden' }, url: '/missionen.html' }]],
    ['Filter: zwei Bedienungen, ein Ereignis', { pfad: '/missionen.html', html: MAIN('<select id="a" data-ev-filter="typ"></select><input id="b" data-ev-filter="suche">') },
      (p) => { p.ereignis('change', p.doc.getElementById('a')); p.ereignis('input', p.doc.getElementById('b')); }, [{ name: 'filter', data: { werkzeug: 'missionen', filter: 'typ' }, url: '/missionen.html' }]],
    ['Filter aus ?Parametern (programmatisch)', { pfad: '/missionen.html', html: MAIN('<select id="a" data-ev-filter="typ"></select>') }, (p) => p.ereignis('change', p.doc.getElementById('a'), false), []],
    ['Filtername ausserhalb der Liste', { pfad: '/missionen.html', html: MAIN('<select id="a" data-ev-filter="auftraggeber-name"></select>') }, (p) => p.ereignis('change', p.doc.getElementById('a')), []],
    ['Filter-Marke auf einer Detailseite', { pfad: '/items/probe-item.html', html: MAIN('<select id="a" data-ev-filter="typ"></select>') }, (p) => p.ereignis('change', p.doc.getElementById('a')), []],
    ['Rechnung: Klick in den Rechner, zweimal', { pfad: '/fracturing.html', html: MAIN('<div data-ev-rechnung><button id="b">S</button><select id="s"></select></div>') },
      (p) => { p.ereignis('click', p.doc.getElementById('b')); p.ereignis('change', p.doc.getElementById('s')); }, [{ name: 'rechnung', data: { werkzeug: 'fracturing' }, url: '/fracturing.html' }]],
    ['Klick auf eine Auswahlliste im Rechner (noch keine Bedienung)', { pfad: '/fracturing.html', html: MAIN('<div data-ev-rechnung><select id="s"></select></div>') }, (p) => p.ereignis('click', p.doc.getElementById('s')), []],
    ['Kopieren', { pfad: '/precision-jump.html', html: MAIN('<button id="k" data-ev-kopieren>Kopieren</button>') }, (p) => p.ereignis('click', p.doc.getElementById('k')),
      [{ name: 'kopieren-teilen', data: { werkzeug: 'sprung' }, url: '/precision-jump.html' }]],
    ['Wert melden von einer Item-Seite', { pfad: '/de/items/probe-item.html', html: MAIN('<a id="m" href="/de/feedback.html?wert=/de/items/probe-item.html" data-ev-melden>Falschen Wert melden</a>') },
      (p) => p.ereignis('click', p.doc.getElementById('m')), [{ name: 'wert-melden', data: { seite: 'item' }, url: '/de/items/' }]],
    ['Wert melden von einer Werkzeugseite (keine Detailseite)', { pfad: '/refinery.html', html: MAIN('<a id="m" href="/feedback.html?wert=/refinery.html" data-ev-melden>Report</a>') },
      (p) => p.ereignis('click', p.doc.getElementById('m')), []],
    ['Feedback-Link ohne Melde-Marke von einer Detailseite', { pfad: '/schiffe/aegs-gladius.html', html: MAIN('<a id="m" href="/feedback.html">Feedback</a>') },
      (p) => p.ereignis('click', p.doc.getElementById('m')), []],
    ['Discord-Einladung im Fuss einer Item-Seite', { pfad: '/de/items/probe-item.html', html: MAIN('') + '<footer><a id="d" href="https://discord.gg/abc"><span id="t">Discord</span></a></footer>' },
      (p) => p.ereignis('click', p.doc.getElementById('t')), [{ name: 'extern', data: { seite: 'item', ziel: 'discord' }, url: '/de/items/' }]],
    ['YouTube mit www. und Pfad von einer Patch-Seite', { pfad: '/patches/sc-4-0-0.html', html: MAIN('<a id="y" href="https://www.youtube.com/watch?v=geheim" target="_blank">Video</a>') },
      (p) => p.ereignis('click', p.doc.getElementById('y')), [{ name: 'extern', data: { seite: 'sonst', ziel: 'youtube' }, url: '/patches/sc-4-0-0.html' }]],
    ['UEX aus einem Werkzeug', { pfad: '/item-finder.html', html: MAIN('<a id="x" href="https://uexcorp.space/items/info/name/probe">UEX</a>') },
      (p) => p.ereignis('click', p.doc.getElementById('x')), [{ name: 'extern', data: { seite: 'werkzeug', ziel: 'uex' }, url: '/item-finder.html' }]],
    ['unbekannter Host (nur „sonst“, keine Adresse)', { pfad: '/datenschutz.html', html: MAIN('<a id="x" href="https://policies.example.org/privacy">P</a>') },
      (p) => p.ereignis('click', p.doc.getElementById('x')), [{ name: 'extern', data: { seite: 'sonst', ziel: 'sonst' }, url: '/datenschutz.html' }]],
    ['Stripe-Knopf mit Ziel-Marke', { pfad: '/de/support.html', html: MAIN('<button id="s" type="button" data-ev-extern="spende"><span id="t">Mit 5 € unterstützen</span></button>') },
      (p) => p.ereignis('click', p.doc.getElementById('t')), [{ name: 'extern', data: { seite: 'sonst', ziel: 'spende' }, url: '/de/support.html' }]],
    ['Ziel-Marke mit fremdem Ziel', { pfad: '/support.html', html: MAIN('<button id="s" type="button" data-ev-extern="stripe">Pay</button>') },
      (p) => p.ereignis('click', p.doc.getElementById('s')), []],
    ['mailto-Link', { pfad: '/support.html', html: MAIN('<a id="m" href="mailto:info@example.org">Mail</a>') }, (p) => p.ereignis('click', p.doc.getElementById('m')), []],
    ['Link nach draussen ohne echte Bedienung (programmatisch)', { pfad: '/support.html', html: MAIN('<a id="d" href="https://discord.gg/abc">D</a>') },
      (p) => p.ereignis('click', p.doc.getElementById('d'), false), []],
    ['Widerspruchs-Cookie', { pfad: '/items/probe-item.html', cookie: 'vb_noanalytics=1', html: MAIN('<a id="z" href="/schiffe/aegs-gladius.html">G</a><a id="d" href="https://discord.gg/abc">D</a>') },
      (p) => { p.ctx.vbEreignis('suche-offen'); p.ereignis('click', p.doc.getElementById('z')); p.ereignis('click', p.doc.getElementById('d')); }, []],
    ['fremder Hostname (Vorschau)', { pfad: '/items/probe-item.html', host: 'staging.verse-base.com', html: MAIN('<a id="z" href="/schiffe/aegs-gladius.html">G</a><a id="d" href="https://discord.gg/abc">D</a>') },
      (p) => { p.ctx.vbEreignis('suche-offen'); p.ereignis('click', p.doc.getElementById('z')); p.ereignis('click', p.doc.getElementById('d')); }, []],
  ];
  for (const [titel, opt, handlung, soll] of PROBEN) {
    let p;
    try {
      p = await seite(opt);
      handlung(p);
      await p.warte();
    } catch (e) { fail(`[7] Probe "${titel}": laeuft nicht (${e.message})`); continue; }
    probenGelaufen++;
    const ist = p.gesendet();
    if (ist.length !== soll.length) {
      fail(`[7] Probe "${titel}": ${ist.length} Ereignis(se) gesendet, Soll ${soll.length}${ist.length ? ` — ${ist.map((b) => b?.payload?.name).join(', ')}` : ''}`);
      continue;
    }
    soll.forEach((e, i) => {
      const b = ist[i] ?? {};
      const pl = b.payload ?? {};
      const m = [];
      if (b.type !== 'event') m.push(`Typ "${b.type}"`);
      if (pl.name !== e.name) m.push(`Name "${pl.name}" statt "${e.name}"`);
      if (JSON.stringify(pl.data) !== JSON.stringify(e.data)) m.push(`Daten ${JSON.stringify(pl.data)} statt ${JSON.stringify(e.data)}`);
      if (pl.url !== e.url) m.push(`url "${pl.url}" statt "${e.url}"`);
      if (pl.title !== '') m.push(`Seitentitel "${pl.title}" geht mit`);
      if (pl.referrer !== '') m.push(`Herkunft "${pl.referrer}" geht mit`);
      const fremd = Object.keys(pl).filter((k) => !STANDARD.has(k));
      if (fremd.length) m.push(`fremde Felder ${fremd.join(', ')}`);
      if (m.length) fail(`[7] Probe "${titel}": ${m.join('; ')}`);
    });
  }
  console.log(`    ${eSrc} mit ${zSrc} ausgefuehrt: ${probenGelaufen} Laeufe (Liste gegen SOLL + ${PROBEN.length} Proben, davon ${PROBEN.filter((x) => !x[3].length).length} mit Soll 0)   EINMAL je Seitenaufruf: ${EINMAL.join(', ')}`);
}

/* ---- Selbstauskunft + Klinken ---- */
console.log('\nSelbstauskunft');
console.log(`    Layout-Seiten: ${layoutSeiten} (Klinke ${MIN_LAYOUT_SEITEN})   mit Zaehler: ${zaehlerSeiten} (Klinke ${MIN_ZAEHLER_SEITEN})   Haken-Fassungen: ${hakenGeprueft} (Klinke ${MIN_HAKEN_FASSUNGEN})   Zaehler-Kopien: ${kopienGeprueft} (Klinke ${MIN_ZAEHLER_KOPIEN})`);
if (layoutSeiten < MIN_LAYOUT_SEITEN)
  fail(`nur ${layoutSeiten} Layout-Seiten erkannt, Klinke ${MIN_LAYOUT_SEITEN} — die theme-color-Zeile aus Layout.astro hat sich geaendert oder der Build ist unvollstaendig; Ursache klaeren, nicht die Klinke senken`);
if (zaehlerSeiten < MIN_ZAEHLER_SEITEN)
  fail(`nur ${zaehlerSeiten} Seiten mit Zaehler, Klinke ${MIN_ZAEHLER_SEITEN} — der Tag ist verloren gegangen oder hat sein data-website-id verloren`);
if (hakenGeprueft < MIN_HAKEN_FASSUNGEN)
  fail(`keine Fassung des Hakens ausgefuehrt — ohne Probe ist [5] nicht gelaufen`);
if (kopienGeprueft < MIN_ZAEHLER_KOPIEN)
  fail(`keine Zaehler-Kopie ausgefuehrt — ohne Lauf ist [6] nicht gelaufen`);
console.log(`    Seiten mit Ereignis-Skript: ${ereignisSeiten} (Klinke ${MIN_EREIGNIS_SEITEN})   Ereignis-Marken: ${ereignisMarken.length} (Klinke ${MIN_EREIGNIS_MARKEN})   Ereignis-Laeufe: ${probenGelaufen} (Klinke ${MIN_EREIGNIS_PROBEN})   Melde-Links: ${meldeSeiten.size} (Klinke ${MIN_MELDE_MARKEN})   Ziel-Marken extern: ${externMarken.length} (Klinke ${MIN_EXTERN_MARKEN})`);
if (externMarken.length < MIN_EXTERN_MARKEN)
  fail(`nur ${externMarken.length} Ziel-Marken data-ev-extern, Klinke ${MIN_EXTERN_MARKEN} — der Stripe-Knopf der Unterstuetzen-Seite hat seine Marke verloren, Spenden ueber Stripe zaehlen dann nicht; Ursache klaeren, nicht die Klinke senken`);
if (ereignisSeiten < MIN_EREIGNIS_SEITEN)
  fail(`nur ${ereignisSeiten} Seiten laden assets/ereignisse.js, Klinke ${MIN_EREIGNIS_SEITEN} — der Tag in Layout.astro ist verloren gegangen`);
if (ereignisMarken.length < MIN_EREIGNIS_MARKEN)
  fail(`nur ${ereignisMarken.length} Ereignis-Marken (data-ev-*) im gebauten Stand, Klinke ${MIN_EREIGNIS_MARKEN} — ein Werkzeug hat seine Filter- oder Rechner-Marken verloren; Ursache klaeren, nicht die Klinke senken`);
if (meldeSeiten.size < MIN_MELDE_MARKEN)
  fail(`nur ${meldeSeiten.size} Detailseiten mit Melde-Link, Klinke ${MIN_MELDE_MARKEN} — der Link „Falschen Wert melden“ ist im Datenstand verloren gegangen; Ursache klaeren, nicht die Klinke senken`);
if (probenGelaufen < MIN_EREIGNIS_PROBEN)
  fail(`nur ${probenGelaufen} Ereignis-Laeufe, Klinke ${MIN_EREIGNIS_PROBEN} — [7] ist nicht vollstaendig gelaufen`);

if (fehler.length) {
  console.error(`\nverify-zaehler: ${fehler.length} FEHLER\n`);
  for (const f of fehler) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\nverify-zaehler: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
