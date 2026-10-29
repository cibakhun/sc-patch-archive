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
   anderen geht die Adresse ohne Fragment an den Zaehler.

   Fuenf Zusicherungen, jede mit Soll/Ist-Zeile:

     1  Jede Layout-Seite laedt den Zaehler — ausser den benannten
        Ausnahmen unten (KEIN_ZAEHLER). Eine Layout-Seite ohne Zaehler
        und ohne Eintrag ist entweder ein `analytics={false}` ohne Anlass
        oder ein verlorener Tag; beides gehoert geklaert.
     2  Zombie-Waechter: jede Ausnahme gibt es in dist/, und sie laedt
        den Zaehler NICHT. Verschwindet die Seite oder laedt sie ihn
        wieder, hat der Eintrag seinen Anlass verloren.
     3  Pfadregel: keine Seite unter account/ bzw. de/account/ (samt
        account.html, de/account.html) laedt den Zaehler — auch eine
        neue, noch nicht eingetragene nicht.
     4  Jeder Zaehler-Tag traegt data-exclude-hash="true" und
        data-exclude-search="true", nennt in data-before-send einen Haken,
        und dieselbe Seite definiert ihn inline (window.<name> = …).
        Fehlt der Haken, schickt Umami ungefiltert.
     5  Jede verschiedene Fassung des Hakens aus dem gebauten Stand laeuft
        in node:vm: das Fragment verschwindet aus url und referrer, eine
        Adresse ohne Fragment kommt unveraendert durch, und ein Aufruf
        ohne url/referrer wirft nicht (ein Wurf im Haken legt die
        Zaehlung still).

   Den Zaehler erkennt das Tor am Umami-Merkmal `data-website-id`, nicht
   am Host — zieht das Skript auf einen anderen Host um, bleibt das Tor
   gueltig. Layout-Seiten erkennt es an der theme-color-Zeile mit
   data-dark, die nur Layout.astro schreibt (dieselbe Zeile liest
   tests/e2e/account-session.test.js).

   Kopfzeile: geprueftes Artefakt, Zahl der Seiten, Layout-Seiten,
   Zaehler-Tags, Ausnahmen und ausgefuehrten Haken-Fassungen. Untergrenzen
   als Sperrklinken — sie duerfen nur nach OBEN wandern (Grundsatz 5).

     node scripts/verify-zaehler.mjs
   ============================================================ */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

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
const LAYOUT_MERKMAL = /<meta name="theme-color"[^>]*\sdata-dark="/;
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
let layoutSeiten = 0, zaehlerSeiten = 0, zaehlerTags = 0;
const layoutOhneZaehler = [];
const kontoMitZaehler = [];
const tagMaengel = [];

const INLINE_SKRIPT = /<script\b(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;

for (const s of seiten) {
  const html = readFileSync(join(DIST, s), 'utf8');
  const layout = LAYOUT_MERKMAL.test(html);
  const tags = html.match(ZAEHLER_TAG) ?? [];
  if (layout) layoutSeiten++;
  if (tags.length) zaehlerSeiten++;
  zaehlerTags += tags.length;

  if (layout && !tags.length && !ausnahmeNach.has(s)) layoutOhneZaehler.push(s);
  if (tags.length && KONTO_PFAD.test(s)) kontoMitZaehler.push(s);

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
    }
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

/* ---- [4] Attribute und Haken an jedem Tag ---- */
console.log('\n[4] Jeder Zaehler-Tag: Fragment und Abfrage ausgeschlossen, Haken definiert');
console.log(`    Tags: ${zaehlerTags}   mangelhaft — Soll: 0   Ist: ${tagMaengel.length}`);
for (const m of tagMaengel.slice(0, 20)) fail(m);
if (tagMaengel.length > 20) fail(`… und ${tagMaengel.length - 20} weitere mangelhafte Tags`);

/* ---- [5] Der ausgelieferte Haken, ausgefuehrt ---- */
console.log('\n[5] Der ausgelieferte Haken schneidet das Fragment ab (node:vm)');
function fahre(quelle, name) {
  const ctx = {
    navigator: { webdriver: false, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' },
    screen: { width: 1920, height: 1080 },
    document: { referrer: 'https://example.org/' },
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
    'Adresse mit Fragment',
    { url: 'https://verse-base.com/schiffe/probe.html?v=1#abschnitt&x=1', referrer: 'https://verse-base.com/account/login.html#y=2', website: 'w' },
    (r) =>
      !r ? 'liefert null fuer einen normalen Aufruf'
        : r.url !== 'https://verse-base.com/schiffe/probe.html?v=1' ? `url bleibt "${r.url}"`
        : r.referrer !== 'https://verse-base.com/account/login.html' ? `referrer bleibt "${r.referrer}"`
        : null,
  );
  probe(
    'Adresse ohne Fragment',
    { url: 'https://verse-base.com/support.html', referrer: '', website: 'w' },
    (r) => (!r ? 'liefert null fuer einen normalen Aufruf' : r.url !== 'https://verse-base.com/support.html' ? `url wird zu "${r.url}"` : null),
  );
  probe('Aufruf ohne url/referrer', { website: 'w', name: 'probe' }, () => null);
}
console.log(`    Haken-Fassungen ausgefuehrt: ${hakenGeprueft}   je 3 Proben`);

/* ---- Selbstauskunft + Klinken ---- */
console.log('\nSelbstauskunft');
console.log(`    Layout-Seiten: ${layoutSeiten} (Klinke ${MIN_LAYOUT_SEITEN})   mit Zaehler: ${zaehlerSeiten} (Klinke ${MIN_ZAEHLER_SEITEN})   Haken-Fassungen: ${hakenGeprueft} (Klinke ${MIN_HAKEN_FASSUNGEN})`);
if (layoutSeiten < MIN_LAYOUT_SEITEN)
  fail(`nur ${layoutSeiten} Layout-Seiten erkannt, Klinke ${MIN_LAYOUT_SEITEN} — die theme-color-Zeile aus Layout.astro hat sich geaendert oder der Build ist unvollstaendig; Ursache klaeren, nicht die Klinke senken`);
if (zaehlerSeiten < MIN_ZAEHLER_SEITEN)
  fail(`nur ${zaehlerSeiten} Seiten mit Zaehler, Klinke ${MIN_ZAEHLER_SEITEN} — der Tag ist verloren gegangen oder hat sein data-website-id verloren`);
if (hakenGeprueft < MIN_HAKEN_FASSUNGEN)
  fail(`keine Fassung des Hakens ausgefuehrt — ohne Probe ist [5] nicht gelaufen`);

if (fehler.length) {
  console.error(`\nverify-zaehler: ${fehler.length} FEHLER\n`);
  for (const f of fehler) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\nverify-zaehler: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
