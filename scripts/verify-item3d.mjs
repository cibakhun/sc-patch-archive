/* ============================================================
   verify-item3d.mjs — steht „In 3D ansehen“ genau dort, wo es hingehoert?

   Items in 3D (Krisz 22.11.2026) zeigt echte Spielmodelle und gehoert
   deshalb wie der Hangar nur in den Vorschau-Bau (src/lib/item3d.ts,
   Begruendung in scripts/lib/hangar-switch.mjs). Die Modelle liegen im
   eigenen Speicher, src/data/item-3d.json nennt je Item die Datei.
   Dieses Tor prueft am gebauten Artefakt:

     Live-Bau (dist/build.json staging:false)
       [1] keine Seite traegt den 3D-Dialog oder nennt die Ablage
     Vorschau-Bau (staging:true)
       [2] die Liste ist wohlgeformt: Dateiname mit Inhaltskennung,
           Groesse plausibel, Ablage https und mit / am Ende; der Name ist
           die Id des Items oder eine fruehere, die per 301 auf das Item
           umzieht (nginx/umzuege.conf)
       [3] jede Item-Seite (EN und DE) eines Items aus der Liste traegt
           genau einen Dialog, und der zeigt auf genau diese Datei unter
           der Ablage; keine andere Item-Seite traegt einen
       [4] jede Blueprint-Seite traegt genau dann einen Dialog, wenn ihr
           Ergebnis-Item (data-bp-item) ein Modell hat, und zwar mit genau
           dieser Datei
       [5] der Betrachter und sein Umgebungslicht liegen in dist/
       [6] Items-Werkbank (Krisz 26.11.2026): jede ihrer Seiten traegt genau
           einen Dialog ohne festes Modell, der auf die Modell-Liste zeigt
           (data-i3d-liste, ebenso die Seiten-Einstellung i3dListe), und
           sonst keine Seite; dist/hangar-item3d.json ist genau die Liste
           mit der Ablage dieses Baus, und ihre Kennung ?v= passt zum Inhalt
     Im Live-Bau gehoert auch die Modell-Liste nicht in dist/ ([1]).

   Selbstauskunft: wie viele Seiten gelesen und wie viele mit Dialog
   gefunden wurden, mit Klinken. Kein git, kein Netz, kein Kindprozess —
   liest nur dist/, die Liste und nginx/umzuege.conf.

     node scripts/verify-item3d.mjs [--dist <Ordner>]
   ============================================================ */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { VORSCHAU_DIST_FILES } from './lib/vorschau-seiten.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DIST = arg('--dist') ? resolve(arg('--dist')) : resolve(ROOT, 'dist');
const LISTE = resolve(ROOT, 'src/data/item-3d.json');

// Klinken (nur nach oben; nach unten nur per Commit mit Ursache).
const MIN_ITEMSEITEN = 11000; // gelesene Item-Seiten EN+DE (22.11.2026: 11 642)
const MIN_MODELLE = 2900;      // Eintraege der Liste (23.11.2026: 2 422 Ruestungsteile; mit Waffen und Aufsaetzen 2 971)
const MIN_SEITEN = 18500;      // HTML-Seiten im Vorschau-Bau ausser der Werkbank, die [6] durchsucht (26.11.2026: 19 044)
// Blueprint-Seiten EN+DE, die ihr Ergebnis-Item nennen (23.11.2026: 3 246 von
// 3 252; ohne Item nur Scraper-Module und ein Antrieb ohne eigene Item-Seite).
// Attribut und Dialog haengen am selben linkedItem in BlueprintDetail.astro;
// verliert eine Seite ihr Item, faellt sie hier auf statt still durchzugehen.
const MIN_BP_MIT_ITEM = 3200;
// Seiten der Items-Werkbank (EN und DE). Zieht sie nach der Abnahme nach
// /items.html um, faellt sie aus der Vorschau-Liste, und [6] reisst, bis
// diese Stelle die neuen Seiten nennt.
const WERKBANK_SEITEN = VORSCHAU_DIST_FILES.filter((f) => /(?:^|\/)items-werkbank\.html$/.test(f));
const LISTE_DATEI = 'hangar-item3d.json';

const fehler = [];
const fail = (m) => fehler.push(m);

const stempel = resolve(DIST, 'build.json');
if (!existsSync(stempel)) {
  console.error('verify-item3d: dist/build.json fehlt — erst bauen (npm run build).');
  process.exit(1);
}
// Ohne eindeutigen Stempel waehlte das Tor womoeglich den falschen Zweig
// (ein Vorschau-Bau ohne Betrachter bestuende dann als Live-Bau).
const stagingWert = JSON.parse(readFileSync(stempel, 'utf8')).staging;
if (typeof stagingWert !== 'boolean') {
  console.error(`verify-item3d: dist/build.json nennt staging=${JSON.stringify(stagingWert)} statt true/false — Stempel kaputt, neu bauen.`);
  process.exit(1);
}
const vorschau = stagingWert;
const liste = JSON.parse(readFileSync(LISTE, 'utf8'));
// Ein Probebau darf die Ablage umlenken (ITEM3D_BASE, src/lib/item3d.ts);
// dann muss das Tor mit demselben Wert laufen.
const basisRoh = process.env.ITEM3D_BASE || liste.base;
const BASIS = basisRoh.endsWith('/') ? basisRoh : `${basisRoh}/`;
const eintraege = Object.entries(liste.items ?? {});
console.log(`verify-item3d: ${vorschau ? 'Vorschau-Bau — 3D-Knopf, wo es ein Modell gibt' : 'Live-Bau — kein 3D-Knopf'}, ${eintraege.length} Modelle in der Liste, Ablage ${BASIS}`);

const DIALOG = /<dialog\b[^>]*\bdata-i3d\b[^>]*>/g;
const MODELL = /\sdata-i3d-model="([^"]*)"/;
const dialoge = (html) => [...html.matchAll(DIALOG)].map((m) => MODELL.exec(m[0])?.[1] ?? '');
// Relativ zu dist/, immer mit / getrennt (auch unter Windows); die Item-ID
// ist der Dateiname ohne .html.
const ordnerHtml = (rel) => {
  const d = join(DIST, rel);
  return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => `${rel}/${f}`) : [];
};
const idVon = (s) => basename(s, '.html');
const BP_ITEM = /\sdata-bp-item="([^"]*)"/g;

const itemSeiten = [...ordnerHtml('items'), ...ordnerHtml('de/items')];
const bpSeiten = [...ordnerHtml('crafting'), ...ordnerHtml('de/crafting')];
let mitDialog = 0;
let bpMitDialog = 0;

// Alle HTML-Seiten unter dir, rekursiv, als absolute Pfade.
const alle = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) alle(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
};

if (!vorschau) {
  // [1] — ueber ALLE Seiten, nicht nur Items und Blueprints.
  const host = new URL(liste.base).host;
  let gelesen = 0;
  let treffer = 0;
  for (const p of alle(DIST)) {
    gelesen++;
    const html = readFileSync(p, 'utf8');
    if (DIALOG.test(html) || html.includes(host)) {
      treffer++;
      if (treffer <= 10) fail(`[1] ${p.slice(DIST.length + 1)} traegt den 3D-Dialog oder nennt ${host}`);
    }
    DIALOG.lastIndex = 0;
  }
  if (treffer > 10) fail(`[1] … und ${treffer - 10} weitere Seiten`);
  if (existsSync(join(DIST, LISTE_DATEI))) fail(`[1] dist/${LISTE_DATEI} (Modell-Liste der Werkbank) gehoert nicht in den Live-Bau`);
  console.log(`  [1] ${gelesen} Seiten gelesen: ${treffer} mit 3D-Dialog oder Ablage; Modell-Liste ${existsSync(join(DIST, LISTE_DATEI)) ? 'DA' : 'nicht da'}`);
} else {
  // [2]
  // Ablage: https, Wurzelpfad, ohne Zugangsdaten, Query oder Fragment — sonst
  // landete der angehaengte Dateiname nicht im Pfad.
  let basisOk = false;
  try {
    const u = new URL(liste.base);
    basisOk = u.protocol === 'https:' && u.pathname === '/' && !u.username && !u.password && !u.search && !u.hash && u.href === liste.base;
  } catch { /* basisOk bleibt false */ }
  if (!basisOk) fail(`[2] Ablage ${liste.base}: erwartet https://<host>/ ohne Pfad, Zugangsdaten, Query oder Fragment`);
  // Eine Datei darf auch eine fruehere Adresse ihres Items tragen, aber nur,
  // wenn nginx/umzuege.conf genau diese Adresse auf das Item umleitet: so
  // heissen die Modelle nach dem Zusammenlegen gleichnamiger Items (IA C8,
  // scripts/namen-zusammenfuehren.mjs: lynx-legs-2 -> lynx-legs), bis der
  // naechste Massenlauf sie unter der neuen Id ablegt. Eine Datei unter
  // fremdem Namen ohne Umzug bleibt ein Fehler.
  const frueher = new Map(); // id -> fruehere Ids laut Umzug
  for (const z of readFileSync(resolve(ROOT, 'nginx/umzuege.conf'), 'utf8').split('\n')) {
    const m = /^\/items\/([a-z0-9-]+)\.html \/items\/([a-z0-9-]+)\.html;$/.exec(z.trim());
    if (m) frueher.set(m[2], [...(frueher.get(m[2]) ?? []), m[1]]);
  }
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let unterFrueheremNamen = 0;
  const dateien = new Map();
  for (const [id, e] of eintraege) {
    if (!Array.isArray(e) || e.length !== 2) { fail(`[2] ${id}: Eintrag ist nicht [Datei, KB]`); continue; }
    const [datei, kb] = e;
    const passt = (x) => new RegExp(`^m/${esc(x)}\\.[0-9a-f]{8}\\.glb$`).test(datei);
    if (!passt(id)) {
      if ((frueher.get(id) ?? []).some(passt)) unterFrueheremNamen++;
      else fail(`[2] ${id}: Datei ${datei} — erwartet m/${id}.<8 Hexzeichen>.glb (oder eine fruehere Adresse des Items, die nginx/umzuege.conf auf /items/${id}.html umleitet)`);
    }
    if (!(kb > 0 && kb < 20480)) fail(`[2] ${id}: ${kb} KB ist nicht plausibel (0 bis 20 MB)`);
    dateien.set(id, BASIS + datei);
  }
  console.log(`  [2] ${eintraege.length} Eintraege geprueft, davon ${unterFrueheremNamen} unter einer frueheren Adresse des Items (Umzug in nginx/umzuege.conf)`);

  // [3]
  let ohneSeite = 0;
  for (const s of itemSeiten) {
    const id = idVon(s);
    const gefunden = dialoge(readFileSync(join(DIST, s), 'utf8'));
    const soll = dateien.get(id);
    if (gefunden.length) mitDialog++;
    if (soll && gefunden.length !== 1) fail(`[3] ${s}: ${gefunden.length} 3D-Dialoge, erwartet genau einer`);
    else if (soll && gefunden[0] !== soll) fail(`[3] ${s}: Dialog zeigt auf ${gefunden[0] || '(nichts)'}, erwartet ${soll}`);
    else if (!soll && gefunden.length) fail(`[3] ${s}: 3D-Dialog ohne Eintrag in src/data/item-3d.json`);
  }
  const seitenIds = new Set(itemSeiten.map(idVon));
  for (const [id] of eintraege) if (!seitenIds.has(id)) ohneSeite++;
  console.log(`  [3] ${itemSeiten.length} Item-Seiten gelesen: ${mitDialog} mit 3D-Dialog (Soll ${2 * (eintraege.length - ohneSeite)}), ${ohneSeite} Modelle ohne eigene Item-Seite`);
  if (mitDialog !== 2 * (eintraege.length - ohneSeite)) fail(`[3] ${mitDialog} Item-Seiten mit Dialog, erwartet ${2 * (eintraege.length - ohneSeite)} (EN und DE je Modell mit Seite)`);

  // [4] Die Seite nennt ihr Ergebnis-Item (data-bp-item); daraus folgt, ob
  // und welches Modell hier stehen muss.
  let bpMitItem = 0;
  let bpSoll = 0;
  const bpOhneItem = [];
  for (const s of bpSeiten) {
    const html = readFileSync(join(DIST, s), 'utf8');
    const gefunden = dialoge(html);
    const items = [...html.matchAll(BP_ITEM)].map((m) => m[1]);
    if (items.length > 1) { fail(`[4] ${s}: ${items.length}× data-bp-item, erwartet hoechstens eins`); continue; }
    if (items.length) bpMitItem++;
    else bpOhneItem.push(s);
    const soll = items.length ? dateien.get(items[0]) : undefined;
    if (soll) bpSoll++;
    if (gefunden.length) bpMitDialog++;
    if (soll && (gefunden.length !== 1 || gefunden[0] !== soll))
      fail(`[4] ${s}: ${gefunden.length} 3D-Dialog(e) mit ${gefunden.join(', ') || '(nichts)'}, erwartet genau einen mit ${soll}`);
    else if (!soll && gefunden.length)
      fail(`[4] ${s}: 3D-Dialog, aber ${items.length ? `das Ergebnis-Item ${items[0]} hat kein Modell in der Liste` : 'kein Ergebnis-Item (data-bp-item)'}`);
  }
  // Nennt keine Seite mehr ihr Item, liefe [4] leer — das waere kein Befund, sondern Blindheit.
  if (bpSeiten.length && !bpMitItem) fail('[4] keine Blueprint-Seite nennt ihr Ergebnis-Item (data-bp-item) — BlueprintDetail.astro geaendert?');
  else if (bpMitItem < MIN_BP_MIT_ITEM) fail(`[4] ${bpMitItem} Blueprint-Seiten nennen ihr Ergebnis-Item, Klinke ${MIN_BP_MIT_ITEM} — Zuordnung Blueprint -> Item verloren?`);
  console.log(`  [4] ${bpSeiten.length} Blueprint-Seiten gelesen, ${bpMitItem} mit Ergebnis-Item (Klinke ${MIN_BP_MIT_ITEM}): ${bpMitDialog} mit 3D-Dialog (Soll ${bpSoll})`);
  if (bpOhneItem.length) console.log(`      ohne Ergebnis-Item (${bpOhneItem.length}): ${bpOhneItem.slice(0, 8).join(', ')}${bpOhneItem.length > 8 ? ' …' : ''}`);

  // [5]
  for (const f of ['assets/hangar-item3d.js', 'vendor/three/addons/environments/RoomEnvironment.js'])
    if (!existsSync(join(DIST, f))) fail(`[5] dist/${f} fehlt — ohne ihn bleibt der Dialog leer`);
  console.log('  [5] Betrachter und Umgebungslicht in dist/ nachgesehen');

  // [6] Werkbank: ein Dialog fuer alle Items, das Modell kommt aus der Liste.
  const listePfad = join(DIST, LISTE_DATEI);
  let listeKennung = null;
  if (!existsSync(listePfad)) fail(`[6] dist/${LISTE_DATEI} fehlt — die Werkbank faende kein Modell (src/hangar-routes/hangar-item3d.json.ts)`);
  else {
    const roh = readFileSync(listePfad, 'utf8');
    listeKennung = createHash('sha1').update(roh).digest('hex').slice(0, 8);
    let l = null;
    try { l = JSON.parse(roh); } catch { fail(`[6] dist/${LISTE_DATEI} ist kein JSON`); }
    if (l) {
      if (l.base !== BASIS) fail(`[6] dist/${LISTE_DATEI} nennt die Ablage ${l.base}, erwartet ${BASIS}`);
      const ist = Object.entries(l.items ?? {});
      const anders = ist.filter(([id, e]) => JSON.stringify(e) !== JSON.stringify(liste.items?.[id])).map(([id]) => id);
      if (ist.length !== eintraege.length || anders.length)
        fail(`[6] dist/${LISTE_DATEI}: ${ist.length} Eintraege, ${anders.length} abweichend (${anders.slice(0, 5).join(', ')}), erwartet genau src/data/item-3d.json (${eintraege.length})`);
    }
  }
  const LISTE_ATTR = /\sdata-i3d-liste="([^"]*)"/;
  const CFG_LISTE = /"i3dListe":"([^"]*)"/;
  let werkbankMitDialog = 0;
  for (const s of WERKBANK_SEITEN) {
    const p = join(DIST, s);
    if (!existsSync(p)) { fail(`[6] dist/${s} fehlt — Werkbank nicht gebaut?`); continue; }
    const html = readFileSync(p, 'utf8');
    const tags = [...html.matchAll(DIALOG)].map((m) => m[0]);
    if (tags.length !== 1) { fail(`[6] ${s}: ${tags.length} 3D-Dialoge, erwartet genau einer`); continue; }
    if (MODELL.test(tags[0])) fail(`[6] ${s}: der Dialog traegt ein festes Modell; die Werkbank setzt es erst beim Oeffnen`);
    const url = LISTE_ATTR.exec(tags[0])?.[1];
    const soll = `/${LISTE_DATEI}?v=${listeKennung}`;
    if (!url) fail(`[6] ${s}: Dialog ohne data-i3d-liste — die Werkbank wuesste nicht, welche Items ein Modell haben`);
    else if (listeKennung && url !== soll) fail(`[6] ${s}: data-i3d-liste="${url}", erwartet ${soll} (Kennung passt nicht zum Inhalt der Liste)`);
    const cfg = CFG_LISTE.exec(html)?.[1];
    if (cfg !== url) fail(`[6] ${s}: Seiten-Einstellung i3dListe=${cfg ?? '(fehlt)'} passt nicht zum Dialog (${url ?? '(nichts)'})`);
    if (url && cfg === url) werkbankMitDialog++;
  }
  // Sonst traegt keine Seite in dist/ die Liste, auch keine in Unterordnern
  // (Item-, Blueprint-Seiten und alle uebrigen).
  let durchsucht = 0;
  const fremd = [];
  for (const p of alle(DIST)) {
    const s = p.slice(DIST.length + 1).split(sep).join('/');
    if (WERKBANK_SEITEN.includes(s)) continue;
    durchsucht++;
    const html = readFileSync(p, 'utf8');
    if (html.includes('data-i3d-liste') && LISTE_ATTR.test(html)) fremd.push(s);
  }
  for (const s of fremd.slice(0, 5)) fail(`[6] ${s}: Dialog mit Modell-Liste ausserhalb der Werkbank`);
  if (fremd.length > 5) fail(`[6] … und ${fremd.length - 5} weitere Seiten mit Modell-Liste`);
  if (durchsucht < MIN_SEITEN) fail(`[6] nur ${durchsucht} andere Seiten durchsucht, Klinke ${MIN_SEITEN} — dist/ unvollstaendig?`);
  if (!WERKBANK_SEITEN.length) fail('[6] keine Werkbank-Seite in scripts/lib/vorschau-seiten.mjs — umgezogen? Dann hier die neuen Seiten nennen');
  console.log(`  [6] ${WERKBANK_SEITEN.length} Werkbank-Seiten gelesen: ${werkbankMitDialog} mit 3D-Dialog und Modell-Liste (Soll ${WERKBANK_SEITEN.length}), Liste ${listeKennung ? `?v=${listeKennung}` : 'fehlt'}; ${durchsucht} andere Seiten durchsucht, ${fremd.length} davon mit Liste`);

  if (eintraege.length < MIN_MODELLE) fail(`Liste: ${eintraege.length} Modelle, Klinke ${MIN_MODELLE}`);
}

if (itemSeiten.length < MIN_ITEMSEITEN) fail(`gelesen: ${itemSeiten.length} Item-Seiten, Klinke ${MIN_ITEMSEITEN} — unvollstaendiger Bau?`);
console.log(`  Selbstauskunft: ${itemSeiten.length} Item-Seiten (Klinke ${MIN_ITEMSEITEN}), ${bpSeiten.length} Blueprint-Seiten, ${eintraege.length} Modelle (Klinke ${MIN_MODELLE})`);

if (fehler.length) {
  console.error(`\nFEHLER: ${fehler.length}`);
  for (const m of fehler) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('verify-item3d: ALLE ZUSICHERUNGEN ERFUELLT ✓');
