// verify-sprache.mjs — jede gebaute Seite spricht ihre eigene Sprache.
//
// WARUM ES DEN GIBT: Am 04.11.2026 zeigten alle 231 deutschen Schiffsseiten
// ihr Leistungsprofil, Quantum, Versicherung und Kaufpreise auf Englisch und
// im englischen Zahlformat ("Claim time", "Expedite cost 2,335 aUEC",
// "1,508,220 aUEC"), 284 deutsche Seiten insgesamt trugen englische
// Oberflaechentexte, die englische Patch-Seite 4.10.0 ein deutsches
// "EIGENER RAUM". Kein Tor hat das gesehen:
//   - verify:sync vergleicht die GERUESTFORM der Sprachpaare, nicht den Text;
//   - audit:site prueft nur das lang-Attribut von <html>;
//   - die Typen (lang: Locale) schuetzen nichts, weil kein Tor tsc faehrt.
// Ursache war eine Klasse, kein Einzelfall: Helfer mit stiller
// Standardsprache (`lang: Locale = DEFAULT_LOCALE`). Bei der Sprachumkehr
// (EN wurde Standard, DE bekam /de/) kippte jeder Aufruf, der sich auf den
// Standard verliess, still ins Englische.
//
// Geprueft wird (FEHLER, ausser Regel 2 — Grundsatz 3: die Handlungs-
// anweisung "uebersetzen" bzw. "Sprache durchreichen" ist immer richtig):
//   1  Kein mehrwortiger Katalogtext der anderen Sprache auf einer Seite
//      (DE-Seite zeigt "Claim time", EN-Seite zeigt "Spieler je Instanz").
//   2  WARNUNG: deutsches Einzelwort aus dem Katalog auf einer EN-Seite
//      ("RAUM", "unbestätigt"). Nur WARNUNG, weil ein Einzelwort auch
//      Englisch sein kann ("Station", "Torso") — dann waere "uebersetzen"
//      falsch. Solche Woerter stehen als benannte Ausnahme da, damit die
//      Liste im Normalzustand leer ist; Zombie-Waechter wie ueblich.
//      Die Gegenrichtung fehlt bewusst: die Spieldaten sind englisch, und
//      "Legs", "Medium", "Industrial" stehen auf deutschen Seiten zu Recht.
//   3  Zahlen im Format der eigenen Sprache (eindeutige Formen, siehe
//      scripts/lib/textregeln.mjs).
//   4  Kein Katalogschluessel als sichtbarer Text ("ship.sheet.title").
//   5  Kein englisches Doppelwort ("The The Butcher Helmet").
//   6  Quelle: kein Text-Helfer und keine Komponente unter src/ legt eine
//      Standardsprache fest (`lang = 'en'`, `lang: Locale = DEFAULT_LOCALE`).
//      Wer die Sprache nicht bekommt, soll laut scheitern (assertLocale in
//      src/i18n/ui.ts), nicht still Englisch liefern.
//   7  Kein deutsches Funktionswort ("und", "nicht", "gefunden" …) auf einer
//      EN-Seite — fuer Text, den kein Katalog kennt, weil er fest im Markup
//      steht ("0 Items gefunden" auf /topics/crafting.html). Wortliste und
//      Messung in scripts/lib/textregeln.mjs.
//   8  Datum im Format der eigenen Sprache ("9. Oktober 2026" auf einer
//      EN-Seite, "March 26, 2026" auf einer DE-Seite).
//   9  Dezimalzahl im Format der eigenen Sprache: als ganze Textstelle
//      ("0.01 SCU", "8.75 m", "+0.5" auf einer DE-Seite) und, mit Einheit
//      dahinter, auch mitten im Text ("L 20 m · B 15 m · H 6.5 m").
//  11  Kein interner Bezeichner aus den Spieldaten im sichtbaren Text
//      ("PU_Delivery_Local_…", "RR_P3_L2"). Stellen, fuer die es noch
//      keinen Anzeigenamen gibt, stehen als benannte Ausnahmen da
//      (INTERN_AUSNAHMEN, Zombie-Waechter) und werden je Lauf gezaehlt.
//      Eingeklappte "Technische Details" (details.md__tech) sind der
//      vereinbarte Ort fuer interne Namen und zaehlen nicht.
//  10  Kein deutsches Wort mit Umlaut oder ß und kein deutsches Bedienwort
//      ("Bild", "abspielen", "suchen") auf einer EN-Seite. Eigennamen mit
//      Umlaut stehen als benannte Ausnahme da (Zombie-Waechter).
//   Regeln 8-11 kamen am 04.11.2026 mit der Inhaltsvalidierung der Werkzeuge
//   dazu; sie stehen in scripts/lib/textregeln.mjs und gelten in
//   verify:clienttext genauso fuer den Text, den die Skripte schreiben.
//   Text in einem Element mit eigenem lang-Attribut der anderen Sprache
//   (z. B. der deutsche Zweitname auf einer EN-Item-Seite) zaehlt nicht.
//
// Schiene A: liest dist/, src/ und die i18n-Kataloge. Kein git, kein Netz;
// einziger Kindprozess ist esbuilds Dienst beim Buendeln der Kataloge
// (scripts/lib/textregeln.mjs).
//
//   node scripts/verify-sprache.mjs [--dist <ordner>]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ladeKataloge, sprachMengen, textStellen, textStellenMitOrt, norm, rohschluesselRe, findeRohschluessel, INTERN_RE, ohneTechnischeDetails,
  ZAHL_EN_AUF_DE_RE, ZAHL_DE_AUF_EN_RE, DOPPELWORT_EN_RE, DE_FUNKTIONSWORT_RE,
  DATUM_DE_AUF_EN_RE, DATUM_EN_AUF_DE_RE, DEZIMAL_EN_AUF_DE_RE, DEZIMAL_DE_AUF_EN_RE, DE_UMLAUTWORT_RE, DE_WORT_EN_RE,
} from './lib/textregeln.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const dIdx = argv.indexOf('--dist');
const DIST = dIdx >= 0 && argv[dIdx + 1] ? resolve(argv[dIdx + 1]) : resolve(ROOT, 'dist');
if (!existsSync(DIST)) { console.error(`${DIST} fehlt — erst npm run build.`); process.exit(2); }

// Klinken (Grundsatz 5): gemessen am 04.11.2026 auf dem Live-Bau: 17.756
// Seiten, 3,24 Mio. Textstellen, 668 + 520 mehrwortige Katalogtexte je nur
// einer Sprache, 165 Quelldateien mit Sprachbezug.
const MIN_SEITEN = 17_000;
const MIN_STELLEN = 3_000_000;
const MIN_MEHRWORT = 1_000;
const MIN_QUELLEN = 120;

// Benannte Ausnahmen fuer Regel 2 (Grundsatz 6): deutsche Katalogwoerter,
// die zugleich englische Woerter sind. Trifft eine nichts mehr, reisst das
// Tor (Zombie-Waechter).
const WORT_AUSNAHMEN = [
  {
    wort: 'Torso',
    anlass: 'auch Englisch: Kategoriename der Spieldaten (Armour / Torso) in Brotkrume und Kategoriekarte der Item-Seiten; die Oberflaeche nennt den Slot "Core".',
  },
  {
    wort: 'Station',
    anlass: 'auch Englisch: Spaltenkopf der Raffinerie- und Mining-Tabellen und ein Item-Name in der Liste "Other".',
  },
];

// Benannte Ausnahmen fuer Regel 10: Eigennamen mit Umlaut auf EN-Seiten.
const UMLAUT_AUSNAHMEN = [
  {
    wort: 'Schlossstraße',
    anlass: 'Strassenname der Anbieteranschrift in Impressum und Datenschutzerklaerung — eine Anschrift wird nicht uebersetzt.',
  },
];

/* Regel 11, interner Bezeichner im sichtbaren Text: offene Stellen, an
   denen die Seite bisher keinen Anzeigenamen hat (Staging-Abnahme
   04.11.2026). Jede haengt an einem Bereich und einer Stelle im Markup;
   wer die Anzeige behebt, streicht die Ausnahme im selben Commit (sonst
   reisst der Zombie-Waechter). Neue Fundstellen sind FEHLER. */
const INTERN_AUSNAHMEN = [
  {
    name: 'Missionen, Angebote-Spalte "Eintrag"',
    bereich: /^\/(?:de\/)?missionen\//,
    ort: /<td\b[^>]*>\s*<code class="md__code"[^>]*>$/,
    anlass: 'der interne Angebotsname ist bisher die einzige Bezeichnung je Zeile; Anzeige offen (Staging-Abnahme 04.11.2026)',
  },
  {
    name: 'Missionen, Orte ohne Anzeigenamen',
    bereich: /^\/(?:de\/)?missionen\//,
    ort: /<li class="md__tag"[^>]*>$|<td class="md__dim md__places"[^>]*>$/,
    anlass: 'Orte, fuer die die Spieldaten nur einen internen Code haben (RR_P3_L2_CLINIC); Anzeige offen (Staging-Abnahme 04.11.2026)',
  },
  {
    name: 'Schiffe, Bauteil ohne Anzeigenamen',
    bereich: /^\/(?:de\/)?schiffe\//,
    ort: /class="sd__slothead"[\s\S]*<div class="n"[^>]*>$/,
    anlass: 'Platzhalter-Bauteile des Spiels ohne Namen (RADR_GNRP_S03_Idris_TEMP, Idris-M/P, Javelin); Anzeige offen (Staging-Abnahme 04.11.2026)',
  },
];
const fIntern = [];
const internOffen = new Map(INTERN_AUSNAHMEN.map((a) => [a, 0]));

const fehler = [];
const zeige = (liste, titel, cap = 12) => {
  if (!liste.length) return;
  const zaehl = new Map();
  for (const f of liste) zaehl.set(f, (zaehl.get(f) || 0) + 1);
  console.log(`\n== FEHLER ${titel}: ${liste.length} Stelle(n) ==`);
  for (const [f, n] of [...zaehl].slice(0, cap)) console.log(`   ${f}${n > 1 ? `   (${n}×)` : ''}`);
  if (zaehl.size > cap) console.log(`   … +${zaehl.size - cap} weitere`);
};

/* ---------- Kataloge ---------- */
let kat;
try {
  kat = await ladeKataloge(ROOT);
} catch (err) {
  console.error('FEHLER: die i18n-Kataloge liessen sich nicht laden — die Pruefung kann nicht urteilen.');
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
}
const M = sprachMengen(kat);
const ROHSCHLUESSEL_RE = rohschluesselRe(M.praefixe);
// Katalogschluessel, die nie ein Wort sind (camelCase, mit Unterstrich oder
// Punkt) — steht so einer als ganzer Text da, hat ein Nachschlagen versagt.
const SCHLUESSEL_GANZ = new Set([...M.schluessel].filter((k) => /[A-Z_.]/.test(k) && /^[a-z]/.test(k)));

/* ---------- 1-5: gebaute Seiten ---------- */
const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
};
const seiten = walk(DIST);
const rel = (f) => '/' + f.slice(DIST.length + 1).replaceAll('\\', '/');

const fMehrwort = [], fWort = [], fZahl = [], fSchluessel = [], fDoppel = [], fFunktion = [], fDatum = [], fDezimal = [], fDeWort = [];
const stelle = (t, m, vor = 30, nach = 30) => t.slice(Math.max(0, m.index - vor), m.index + m[0].length + nach);
const benutzt = new Set();
let stellen = 0, gelesen = 0;
for (const f of seiten) {
  const page = rel(f);
  // Onepager sind eigenstaendige EN-Artefakte ohne Sprachpaar (wie audit:site).
  if (page.startsWith('/onepager/')) continue;
  gelesen++;
  const de = page === '/de.html' || page.startsWith('/de/');
  const fremd = de ? 'en' : 'de';
  // Blattelemente, die ausdruecklich die andere Sprache tragen, sind erlaubt.
  const html = readFileSync(f, 'utf8').replace(new RegExp(`<(\\w+)\\b[^>]*\\slang="${fremd}"[^>]*>[^<]*</\\1>`, 'g'), ' ');
  const mehrwortFremd = de ? M.mehrwortNurEn : M.mehrwortNurDe;
  const zahlRe = de ? ZAHL_EN_AUF_DE_RE : ZAHL_DE_AUF_EN_RE;
  for (const roh of textStellen(html)) {
    stellen++;
    const t = norm(roh);
    if (mehrwortFremd.has(t)) fMehrwort.push(`${page}: ${de ? 'EN' : 'DE'} „${t}"`);
    else if (!de && M.wortNurDe.has(t)) {
      const ausn = WORT_AUSNAHMEN.find((a) => a.wort === t);
      if (ausn) benutzt.add(ausn);
      else fWort.push(`${page}: „${t}"`);
    }
    const z = zahlRe.exec(t);
    if (z) fZahl.push(`${page}: „${z[0]}" in „${t.slice(Math.max(0, z.index - 30), z.index + z[0].length + 20)}"`);
    const k = findeRohschluessel(t, ROHSCHLUESSEL_RE);
    if (k) fSchluessel.push(`${page}: „${k[0]}" in „${t.slice(0, 120)}"`);
    else if (SCHLUESSEL_GANZ.has(t)) fSchluessel.push(`${page}: „${t}"`);
    if (!de) {
      const dw = DOPPELWORT_EN_RE.exec(t);
      if (dw) fDoppel.push(`${page}: „${t.slice(Math.max(0, dw.index - 20), dw.index + dw[0].length + 40)}"`);
      const fw = DE_FUNKTIONSWORT_RE.exec(t);
      if (fw && !mehrwortFremd.has(t)) fFunktion.push(`${page}: „${fw[0]}" in „${t.slice(0, 120)}"`);
      const dw2 = DE_UMLAUTWORT_RE.exec(t) || DE_WORT_EN_RE.exec(t);
      if (dw2 && !mehrwortFremd.has(t)) {
        const ausn = UMLAUT_AUSNAHMEN.find((a) => a.wort === dw2[0]);
        if (ausn) benutzt.add(ausn);
        else fDeWort.push(`${page}: „${dw2[0]}" in „${stelle(t, dw2, 40, 50)}"`);
      }
    }
    const dt = (de ? DATUM_EN_AUF_DE_RE : DATUM_DE_AUF_EN_RE).exec(t);
    if (dt) fDatum.push(`${page}: „${dt[0]}" in „${stelle(t, dt)}"`);
    const dz = (de ? DEZIMAL_EN_AUF_DE_RE : DEZIMAL_DE_AUF_EN_RE).exec(t);
    if (dz) fDezimal.push(`${page}: „${dz[0]}"${dz[0] === t ? '' : ` in „${stelle(t, dz)}"`}`);
  }
  for (const { t: roh, ort } of textStellenMitOrt(ohneTechnischeDetails(html))) {
    const t = norm(roh);
    const i = INTERN_RE.exec(t);
    if (!i) continue;
    const ausn = INTERN_AUSNAHMEN.find((a) => a.bereich.test(page) && a.ort.test(ort));
    if (ausn) internOffen.set(ausn, internOffen.get(ausn) + 1);
    else fIntern.push(`${page}: „${i[0]}" in „${stelle(t, i, 30, 30)}"`);
  }
}

/* ---------- 6: Quelle ohne stille Standardsprache ---------- */
// Parameter (`lang: Locale = DEFAULT_LOCALE`, `lang = 'en'`) und
// Props-Destrukturierung (`const { lang = 'en' } = Astro.props`). Kommentare
// zaehlen nicht.
const STANDARD_RE = /\blang\s*(?::\s*[\w'"| ]+?)?\s*=\s*(?:DEFAULT_LOCALE|'en'|'de'|"en"|"de")\s*[,)}]/;
const quellen = [];
const walkSrc = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walkSrc(p);
    else if (/\.(astro|ts)$/.test(e.name)) quellen.push(p);
  }
};
walkSrc(resolve(ROOT, 'src'));
const fQuelle = [];
let quellenMitSprache = 0;
for (const q of quellen) {
  const code = readFileSync(q, 'utf8').replace(/\r\n?/g, '\n');
  if (!/\blang\b/.test(code)) continue;
  quellenMitSprache++;
  const ohneKommentar = code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'));
  ohneKommentar.forEach((zeile, i) => {
    if (STANDARD_RE.test(zeile) && !/[=!]==?\s*['"]?(?:en|de)/.test(zeile.replace(STANDARD_RE, ''))) {
      fQuelle.push(`${q.slice(ROOT.length + 1).replaceAll('\\', '/')}:${i + 1}: ${zeile.trim().slice(0, 110)}`);
    }
  });
}

/* ---------- Bilanz ---------- */
console.log(`verify:sprache — ${DIST.slice(ROOT.length + 1) || DIST}`);
console.log(`Seiten: ${gelesen.toLocaleString('de-DE')} gelesen (Klinke ${MIN_SEITEN.toLocaleString('de-DE')}), Textstellen: ${stellen.toLocaleString('de-DE')} (Klinke ${MIN_STELLEN.toLocaleString('de-DE')})`);
console.log(`Kataloge: ${kat.namen.join(', ')} — ${M.mehrwortNurEn.size} mehrwortige Texte nur EN, ${M.mehrwortNurDe.size} nur DE, ${M.wortNurDe.size} Einzelwoerter nur DE, ${M.praefixe.size} Schluesselpraefixe (Klinke ${MIN_MEHRWORT} mehrwortig)`);
console.log(`Quelle: ${quellen.length} Dateien unter src/, ${quellenMitSprache} mit Sprachbezug (Klinke ${MIN_QUELLEN})`);
console.log(`Ausnahmen Regel 2: ${WORT_AUSNAHMEN.length} benannt, Regel 10: ${UMLAUT_AUSNAHMEN.length} benannt — ${benutzt.size} in Gebrauch`);

if (gelesen < MIN_SEITEN) fehler.push(`nur ${gelesen} Seiten gelesen (Klinke ${MIN_SEITEN})`);
if (stellen < MIN_STELLEN) fehler.push(`nur ${stellen} Textstellen (Klinke ${MIN_STELLEN})`);
if (M.mehrwortNurEn.size + M.mehrwortNurDe.size < MIN_MEHRWORT) fehler.push(`nur ${M.mehrwortNurEn.size + M.mehrwortNurDe.size} mehrwortige Katalogtexte (Klinke ${MIN_MEHRWORT})`);
if (quellenMitSprache < MIN_QUELLEN) fehler.push(`nur ${quellenMitSprache} Quelldateien mit Sprachbezug (Klinke ${MIN_QUELLEN})`);
for (const a of [...WORT_AUSNAHMEN, ...UMLAUT_AUSNAHMEN]) if (!benutzt.has(a)) fehler.push(`Zombie-Ausnahme „${a.wort}": trifft nichts mehr — raus damit`);
for (const [a, n] of internOffen) if (!n) fehler.push(`Zombie-Ausnahme „${a.name}" (Regel 11): trifft nichts mehr — raus damit`);

zeige(fMehrwort, '1 Katalogtext der anderen Sprache');
if (fWort.length) {
  console.log(`\n== WARNUNG 2 deutsches Katalogwort auf EN-Seite: ${fWort.length} Stelle(n) — uebersetzen, oder als englisches Wort in WORT_AUSNAHMEN benennen ==`);
  for (const f of [...new Set(fWort)].slice(0, 12)) console.log(`   ${f}`);
}
zeige(fZahl, '3 Zahl im Format der anderen Sprache');
zeige(fSchluessel, '4 Katalogschluessel statt Text');
zeige(fDoppel, '5 englisches Doppelwort');
zeige(fQuelle, '6 stille Standardsprache in der Quelle (assertLocale statt Vorgabe)');
zeige(fFunktion, '7 deutsches Funktionswort auf EN-Seite (fester Text im Markup?)');
zeige(fDatum, '8 Datum im Format der anderen Sprache');
zeige(fDezimal, '9 Dezimalzahl im Format der anderen Sprache (toLocaleString / num(v, lang))');
zeige(fDeWort, '10 deutsches Wort auf EN-Seite (Umlaut oder Bedienwort)');
zeige(fIntern, '11 interner Bezeichner im sichtbaren Text (Anzeigenamen statt Spieldaten-Schluessel)');
console.log(`\n11 interne Bezeichner, offen und benannt (keine FEHLER, Schulden): ${[...internOffen].map(([a, n]) => `${a.name} ${n.toLocaleString('de-DE')}`).join(' · ')}`);
for (const f of fehler) console.log(`\n== FEHLER ${f} ==`);

const summe = fMehrwort.length + fZahl.length + fSchluessel.length + fDoppel.length + fQuelle.length + fFunktion.length + fDatum.length + fDezimal.length + fDeWort.length + fIntern.length + fehler.length;
if (summe) {
  console.log(`\nverify:sprache ROT — ${summe} Befund(e).`);
  process.exit(1);
}
console.log('\nverify:sprache gruen — jede Seite in ihrer Sprache, Zahlen und Daten im eigenen Format, keine Rohschluessel, keine stille Standardsprache.');
