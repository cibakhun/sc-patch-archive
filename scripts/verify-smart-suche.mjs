/* ============================================================
   verify-smart-suche.mjs  (Krisz 27.11.2026)

   „können wir bei items dieses smart search was wir bei den schiffen schon
   haben in der hangar?“ (Krisz, 27.11.2026). Seitdem teilen sich der
   Schiffsfinder im Hangar und die Suche der Items-Werkbank einen Suchkern,
   assets/smart-suche.js. Der Hangar importiert ihn statisch
   (hangar-overview.js: from './smart-suche.js'), die Werkbank laedt ihn mit
   import(C.sucheUrl). Beides hat eine Falle, die kein Test im Pruefstand
   sieht: CSS und JS unter fester Adresse haelt der Rand einen Tag (siehe
   src/lib/assetVersion.ts). Ein Import ohne Versionsadresse bekommt nach
   einem Deploy die ALTE Datei zum NEUEN Hangar, und die Werkbank faellt
   still auf die alte Teilstueck-Suche zurueck, wenn ihre Adresse ins Leere
   zeigt. Dieses Tor prueft den gebauten Stand:

   [1] Frische: jeder relative Import (statisch oder import('./x.js')) in
       dist/assets/*.js steht auf JEDER Seite, die das importierende Skript
       laedt, in der Import-Map mit der Versionsadresse /assets/x.js?v=<hash>,
       und der Hash passt zum Inhalt in dist/. Die Import-Map steht vor dem
       ersten Modul der Seite (danach greift sie nicht).
   [2] Werkbank: C.sucheUrl beider Sprachen zeigt auf eine Datei in dist/
       mit passendem Hash, und es ist dieselbe Datei wie die des Hangars.
   [3] Exporte: was der Hangar (import { … } from './smart-suche.js') und
       die Werkbank (SU.x, m.x) vom Kern nutzen, exportiert die gebaute
       Datei als Funktion.
   [4] Vokabular der Werkbank (C.suche): beide Sprachen gleich; jedes Blatt
       des Kategoriebaums (ausser „Allgemein“) wird mit deutschem UND
       englischem Namen erkannt; jede Kategorie eines Eintrags steht im Baum
       (sonst Zombie); jede Gruppe ausser „Sonstiges“ wird erkannt; kein
       Wort hat gefaltet zwei Bedeutungen (sonst entscheidet still die
       Reihenfolge der Arten). Jedes deutsche Wort fuer einen englischen
       Namensteil (C.suche.nick, „gewehr“ -> „rifle“) ist selbst kein
       Begriff (sonst nie erreicht), und sein Ziel steht als Wort in
       mindestens einem Item-Namen des Katalogs (sonst findet es nichts).

   Selbstauskunft: Importe, Seiten mit Import-Map, Sprachen, Exporte,
   Eintraege und Woerter des Vokabulars; Klinken darunter. Im Live-Bau
   fehlt der Hangar (hangar-switch): [1] zaehlt dann 0 Hangar-Seiten, und
   seine Klinke gilt nur im Vorschau-Bau.

   Kein git, kein Netz, kein Kindprozess: alles aus dist/.

       node scripts/verify-smart-suche.mjs [--dist <ordner>]
   ============================================================ */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { hangarImArtefakt } from './lib/hangar-switch.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const i = argv.indexOf('--dist');
const DIST = i >= 0 && argv[i + 1] ? resolve(argv[i + 1]) : resolve(ROOT, 'dist');
if (!existsSync(DIST)) { console.error(`verify:smart-suche: ${DIST} fehlt — erst npm run build.`); process.exit(2); }
const MIT_HANGAR = hangarImArtefakt(DIST);
const t0 = Date.now();

/* ---------- Klinken (gemessen 27.11.2026 am Vorschau-Bau) ----------
 * Etwas unter dem Messwert; nach oben nachziehen, nach unten nur per Commit
 * mit Ursache. */
const KLINKE = {
  hangarSeiten: 2, // Seiten, die hangar-overview.js laden (hangar.html, de/hangar.html); nur Vorschau
  sprachen: 2, // Werkbank-Seiten mit C.sucheUrl und C.suche
  exporte: 7, // vom Kern genutzte Namen, Hangar und Werkbank zusammen (7; jeder fehlende ist ohnehin FEHLER)
  kat: 65, // Kategorie-Eintraege (69)
  blaetter: 65, // Blaetter des Baums, mit beiden Namen erkannt (68)
  grp: 9, // Gruppen (9)
  woerter: 290, // verschiedene gefaltete Woerter aller Arten (308)
  nick: 22, // deutsche Woerter fuer englische Namensteile, mit Umschrift (24)
};

const fehler = [];
const de = (n) => n.toLocaleString('de-DE');
const hash = (pfad) => createHash('sha1').update(readFileSync(pfad)).digest('hex').slice(0, 8);
const distPfad = (url) => join(DIST, decodeURIComponent(url.replace(/[?#].*$/, '')));
// Dieselbe Faltung wie fold() im Kern (die gebaute Datei wird in [3] geladen).
let fold = null;

/* ---------- [1] Frische der relativen Importe ---------- */
const ASSETS = join(DIST, 'assets');
const IMPORT_RE = /\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]|\bimport\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;
const importe = []; // { von: '/assets/a.js', ziel: '/assets/b.js' }
for (const f of readdirSync(ASSETS)) {
  if (!f.endsWith('.js')) continue;
  const code = readFileSync(join(ASSETS, f), 'utf8');
  const von = `/assets/${f}`;
  for (const m of code.matchAll(IMPORT_RE)) {
    const ziel = new URL(m[1] || m[2], `https://x${von}`).pathname;
    if (!importe.some((x) => x.von === von && x.ziel === ziel)) importe.push({ von, ziel });
  }
}
const importMap = (html) => {
  const m = /<script type="importmap"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  try { return { at: m.index, imports: JSON.parse(m[1]).imports || {} }; } catch (e) { return { at: m.index, kaputt: e.message, imports: {} }; }
};
function* seiten(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* seiten(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}
const zahl = { importe: importe.length, seitenMitImport: 0, hangarSeiten: 0, sprachen: 0, exporte: 0, kat: 0, blaetter: 0, grp: 0, woerter: 0, nick: 0 };
const imp = importe.map((x) => ({ ...x, nadel: Buffer.from(x.von) }));
if (imp.length) {
  for (const p of seiten(DIST)) {
    const buf = readFileSync(p);
    const treffer = imp.filter((x) => buf.indexOf(x.nadel) >= 0);
    if (!treffer.length) continue;
    const html = buf.toString('utf8');
    const seite = p.slice(DIST.length + 1);
    zahl.seitenMitImport++;
    if (treffer.some((x) => x.von === '/assets/hangar-overview.js')) zahl.hangarSeiten++;
    const map = importMap(html);
    const modul = html.search(/<script[^>]*type="module"/);
    if (!map) { fehler.push(`[1] ${seite}: laedt ${treffer[0].von}, das ${treffer[0].ziel} importiert, aber hat keine Import-Map — der Rand liefert ${treffer[0].ziel} bis zu einen Tag alt`); continue; }
    if (map.kaputt) { fehler.push(`[1] ${seite}: Import-Map ist kein JSON (${map.kaputt})`); continue; }
    if (modul >= 0 && map.at > modul) fehler.push(`[1] ${seite}: Import-Map steht hinter dem ersten Modul und greift nicht`);
    for (const x of treffer) {
      const soll = existsSync(distPfad(x.ziel)) ? `${x.ziel}?v=${hash(distPfad(x.ziel))}` : null;
      const ist = map.imports[x.ziel];
      if (!soll) fehler.push(`[1] ${seite}: ${x.von} importiert ${x.ziel}, das fehlt in dist/`);
      else if (!ist) fehler.push(`[1] ${seite}: Import-Map ohne ${x.ziel} (importiert von ${x.von}) — ohne Versionsadresse liefert der Rand die alte Datei`);
      else if (ist !== soll) fehler.push(`[1] ${seite}: Import-Map zeigt ${x.ziel} auf ${ist}, der Inhalt in dist/ hat ${soll}`);
    }
  }
}

/* ---------- [2] Adresse des Kerns in der Werkbank ---------- */
const KERN = '/assets/smart-suche.js';
const cfgVon = (seite) => {
  const p = join(DIST, seite);
  if (!existsSync(p)) return null;
  const s = readFileSync(p, 'utf8');
  const a = s.indexOf('window.__WZI=');
  if (a < 0) return null;
  const b = s.indexOf('</script>', a);
  try { return JSON.parse(s.slice(a + 'window.__WZI='.length, b).replace(/;\s*$/, '')); } catch { return null; }
};
const cfg = {};
for (const [lang, seite] of [['de', 'de/items.html'], ['en', 'items.html']]) {
  const C = cfgVon(seite);
  if (!C) { fehler.push(`[2] ${seite}: keine Konfiguration der Werkbank (window.__WZI) gefunden`); continue; }
  if (!C.sucheUrl) { fehler.push(`[2] ${seite}: C.sucheUrl fehlt — die Werkbank sucht ohne Erkennung`); continue; }
  if (!C.suche) { fehler.push(`[2] ${seite}: C.suche fehlt — die Werkbank kennt kein Vokabular`); continue; }
  const pfad = distPfad(C.sucheUrl);
  const v = /[?&]v=([0-9a-f]{8})\b/.exec(C.sucheUrl);
  if (C.sucheUrl.replace(/[?#].*$/, '') !== KERN) fehler.push(`[2] ${seite}: C.sucheUrl ${C.sucheUrl} ist nicht der Kern des Hangars (${KERN})`);
  else if (!existsSync(pfad)) fehler.push(`[2] ${seite}: C.sucheUrl ${C.sucheUrl} fehlt in dist/`);
  else if (!v) fehler.push(`[2] ${seite}: C.sucheUrl ${C.sucheUrl} ohne Versionsadresse (?v=<hash>)`);
  else if (v[1] !== hash(pfad)) fehler.push(`[2] ${seite}: C.sucheUrl traegt v=${v[1]}, der Inhalt in dist/ hat ${hash(pfad)}`);
  cfg[lang] = C;
  zahl.sprachen++;
}

/* ---------- [3] Exporte des Kerns ---------- */
const genutzt = new Map(); // Name -> wer
const merke = (n, wer) => { if (!genutzt.has(n)) genutzt.set(n, new Set()); genutzt.get(n).add(wer); };
const hangarJs = join(ASSETS, 'hangar-overview.js');
if (existsSync(hangarJs)) {
  const code = readFileSync(hangarJs, 'utf8');
  const m = /import\s*\{([^}]*)\}\s*from\s*['"]\.\/smart-suche\.js['"]/.exec(code);
  if (!m) fehler.push('[3] hangar-overview.js importiert den Kern nicht (import { … } from \'./smart-suche.js\') — sucht der Hangar mit einer eigenen Kopie?');
  else for (const n of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) merke(n, 'Hangar');
} else if (MIT_HANGAR) fehler.push('[3] dist/assets/hangar-overview.js fehlt im Vorschau-Bau');
const werkbankJs = join(ASSETS, 'items-werkbank.js');
if (!existsSync(werkbankJs)) fehler.push('[3] dist/assets/items-werkbank.js fehlt');
else {
  const code = readFileSync(werkbankJs, 'utf8');
  for (const m of code.matchAll(/\bSU\.(\w+)/g)) merke(m[1], 'Werkbank');
  const lade = /import\(C\.sucheUrl\)\.then\(function \((\w+)\) \{([\s\S]*?)\n\s*\}\)/.exec(code);
  if (!lade) fehler.push('[3] items-werkbank.js laedt den Kern nicht ueber import(C.sucheUrl).then(function (m) { … })');
  else for (const m of lade[2].matchAll(new RegExp(`\\b${lade[1]}\\.(\\w+)\\(`, 'g'))) merke(m[1], 'Werkbank');
}
const kernPfad = join(DIST, KERN);
if (!existsSync(kernPfad)) fehler.push(`[3] ${KERN} fehlt in dist/`);
else {
  const kern = await import(pathToFileURL(kernPfad).href);
  fold = kern.fold;
  for (const [n, wer] of genutzt) {
    zahl.exporte++;
    if (typeof kern[n] !== 'function') fehler.push(`[3] ${[...wer].join(' und ')} ${wer.size > 1 ? 'nutzen' : 'nutzt'} ${n}, der gebaute Kern exportiert es nicht als Funktion`);
  }
}

/* ---------- [4] Vokabular der Werkbank ---------- */
const ARTEN = ['kat', 'grp', 'art', 'pk', 'sel', 'sys'];
if (cfg.de && cfg.en && fold) {
  if (JSON.stringify(cfg.de.suche) !== JSON.stringify(cfg.en.suche)) fehler.push('[4] das Vokabular der deutschen und der englischen Werkbank weicht ab — es soll fuer beide Sprachen gleich sein');
  const V = cfg.de.suche;
  for (const k of ARTEN) if (!Array.isArray(V[k]) || !V[k].length) fehler.push(`[4] C.suche.${k} ist leer`);
  // Ein gefaltetes Wort, eine Bedeutung.
  const bedeutung = new Map();
  for (const k of ARTEN) {
    for (const e of V[k] || []) {
      for (const w of e.w) {
        const f = fold(w);
        if (!f) { fehler.push(`[4] ${k}:${e.k} hat ein leeres Wort`); continue; }
        const b = `${k}:${e.k}`;
        if (!bedeutung.has(f)) bedeutung.set(f, new Set());
        bedeutung.get(f).add(b);
      }
    }
  }
  for (const [f, b] of bedeutung) if (b.size > 1) fehler.push(`[4] „${f}“ meint ${[...b].join(' und ')} — erkannt wird still das erste; ein Wort darf nur eine Bedeutung haben`);
  zahl.woerter = bedeutung.size;
  zahl.kat = (V.kat || []).length;
  zahl.grp = (V.grp || []).length;
  // Jedes Blatt mit beiden Namen, keine Kategorie ausserhalb des Baums.
  const blaetter = (baum) => baum.flatMap((g) => g.b.filter((b) => b.k !== g.r).map((b) => [b.k, b.n]));
  const nameDe = new Map(blaetter(cfg.de.baum)), nameEn = new Map(blaetter(cfg.en.baum));
  const woerterJe = new Map();
  for (const e of V.kat || []) {
    for (const c of e.c || [e.k]) {
      if (!nameDe.has(c)) fehler.push(`[4] kat:${e.k} meint ${c}, das im Kategoriebaum nicht (mehr) steht`);
      if (!woerterJe.has(c)) woerterJe.set(c, new Set());
      for (const w of e.w) woerterJe.get(c).add(fold(w));
    }
  }
  for (const [c, n] of nameDe) {
    const ws = woerterJe.get(c) || new Set();
    const ne = nameEn.get(c);
    let ok = true;
    if (!ws.has(fold(n))) { ok = false; fehler.push(`[4] Kategorie ${c}: der deutsche Name „${n}“ wird nicht erkannt`); }
    if (ne == null) { ok = false; fehler.push(`[4] Kategorie ${c} fehlt im englischen Baum`); }
    else if (!ws.has(fold(ne))) { ok = false; fehler.push(`[4] Kategorie ${c}: der englische Name „${ne}“ wird nicht erkannt`); }
    if (ok) zahl.blaetter++;
  }
  // Jede Gruppe ausser „Sonstiges“ (Absicht: „other“ ist ein Allerweltswort).
  for (const g of cfg.de.baum) {
    if (g.r === 'Other') continue;
    if (!(V.grp || []).some((e) => e.k === g.r)) fehler.push(`[4] Gruppe ${g.r} („${g.n}“) wird nicht erkannt`);
  }
  for (const e of V.grp || []) if (!cfg.de.baum.some((g) => g.r === e.k)) fehler.push(`[4] grp:${e.k} steht nicht im Kategoriebaum`);
  // Deutsche Woerter fuer englische Namensteile.
  const nick = V.nick || {};
  if (!Object.keys(nick).length) fehler.push('[4] C.suche.nick ist leer — „gewehr“ findet keine Rifles');
  else {
    const kat = join(DIST, cfg.de.dbUrl ? cfg.de.dbUrl.replace(/[?#].*$/, '') : '/assets/universal-items.json');
    const namensWoerter = new Set();
    if (!existsSync(kat)) fehler.push(`[4] Katalog ${kat} fehlt — die Ziele von C.suche.nick sind nicht pruefbar`);
    else for (const it of JSON.parse(readFileSync(kat, 'utf8')).items || []) for (const w of fold(it.name).split(/[^a-z0-9]+/)) if (w) namensWoerter.add(w);
    for (const [w, ziel] of Object.entries(nick)) {
      zahl.nick++;
      if (bedeutung.has(fold(w))) fehler.push(`[4] nick „${w}“ ist zugleich ein Begriff (${[...bedeutung.get(fold(w))].join(', ')}) und wird nie als Namensteil gelesen`);
      if (namensWoerter.size && !namensWoerter.has(fold(ziel))) fehler.push(`[4] nick „${w}“ -> „${ziel}“: kein Item-Name im Katalog enthaelt das Wort „${ziel}“`);
    }
  }
}

/* ---------- Selbstauskunft ---------- */
console.log(`verify:smart-suche — Bau ${DIST} (${MIT_HANGAR ? 'Vorschau, mit Hangar' : 'live, ohne Hangar'}; ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
console.log(`[1] ${zahl.importe} relative Importe in dist/assets (${importe.map((x) => `${x.von.slice(8)} → ${x.ziel.slice(8)}`).join(', ') || '—'}), ${zahl.seitenMitImport} Seiten laden sie, davon ${zahl.hangarSeiten} Hangar-Seiten`);
console.log(`[2] ${zahl.sprachen} Werkbank-Seiten mit Kern-Adresse und Vokabular`);
console.log(`[3] ${zahl.exporte} genutzte Namen des Kerns: ${[...genutzt.keys()].sort().join(', ')}`);
console.log(`[4] ${zahl.kat} Kategorie-Eintraege, ${zahl.blaetter} Blaetter mit beiden Namen, ${zahl.grp} Gruppen, ${de(zahl.woerter)} Woerter, ${zahl.nick} deutsche Woerter fuer englische Namensteile`);
for (const [k, min] of Object.entries(KLINKE)) {
  if (k === 'hangarSeiten' && !MIT_HANGAR) continue;
  if ((zahl[k] ?? 0) < min) fehler.push(`nur ${de(zahl[k] ?? 0)} bei „${k}“ (Klinke ${de(min)}) — prueft das Tor noch, oder fehlt dem Bau ein Teil der Suche?`);
}

if (fehler.length) {
  for (const f of fehler.slice(0, 20)) console.error(`FEHLER ${f}`);
  if (fehler.length > 20) console.error(`… und ${fehler.length - 20} weitere`);
  console.error(`\nverify:smart-suche: ${fehler.length} FEHLER — der geteilte Suchkern kommt nicht frisch an, oder die Werkbank erkennt nicht, was sie erkennen soll.`);
  process.exit(1);
}
console.log('\nverify:smart-suche gruen — Hangar und Werkbank laden denselben Suchkern unter seiner Versionsadresse, und das Vokabular erkennt jede Kategorie in beiden Sprachen.');
