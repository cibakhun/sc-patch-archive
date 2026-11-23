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
           Groesse plausibel, Ablage https und mit / am Ende
       [3] jede Item-Seite (EN und DE) eines Items aus der Liste traegt
           genau einen Dialog, und der zeigt auf genau diese Datei unter
           der Ablage; keine andere Item-Seite traegt einen
       [4] Blueprint-Seiten mit Dialog zeigen nur auf Dateien der Liste
       [5] der Betrachter und sein Umgebungslicht liegen in dist/

   Selbstauskunft: wie viele Seiten gelesen und wie viele mit Dialog
   gefunden wurden, mit Klinken. Kein git, kein Netz, kein Kindprozess —
   liest nur dist/ und die Liste.

     node scripts/verify-item3d.mjs [--dist <Ordner>]
   ============================================================ */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DIST = arg('--dist') ? resolve(arg('--dist')) : resolve(ROOT, 'dist');
const LISTE = resolve(ROOT, 'src/data/item-3d.json');

// Klinken (nur nach oben; nach unten nur per Commit mit Ursache).
const MIN_ITEMSEITEN = 11000; // gelesene Item-Seiten EN+DE (22.11.2026: 11 642)
const MIN_MODELLE = 0;         // Eintraege der Liste; steigt mit dem ersten Hochladen

const fehler = [];
const fail = (m) => fehler.push(m);

const stempel = resolve(DIST, 'build.json');
if (!existsSync(stempel)) {
  console.error('verify-item3d: dist/build.json fehlt — erst bauen (npm run build).');
  process.exit(1);
}
const vorschau = JSON.parse(readFileSync(stempel, 'utf8')).staging === true;
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
const ordnerHtml = (rel) => {
  const d = join(DIST, rel);
  return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => join(rel, f)) : [];
};

const itemSeiten = [...ordnerHtml('items'), ...ordnerHtml('de/items')];
const bpSeiten = [...ordnerHtml('crafting'), ...ordnerHtml('de/crafting')];
let mitDialog = 0;
let bpMitDialog = 0;

if (!vorschau) {
  // [1] — ueber ALLE Seiten, nicht nur Items und Blueprints.
  const alle = (dir, out = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) alle(p, out);
      else if (e.name.endsWith('.html')) out.push(p);
    }
    return out;
  };
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
  console.log(`  [1] ${gelesen} Seiten gelesen: ${treffer} mit 3D-Dialog oder Ablage`);
} else {
  // [2]
  if (!/^https:\/\/[^/]+\/$/.test(liste.base)) fail(`[2] Ablage ${liste.base}: erwartet https://<host>/`);
  const dateien = new Map();
  for (const [id, e] of eintraege) {
    if (!Array.isArray(e) || e.length !== 2) { fail(`[2] ${id}: Eintrag ist nicht [Datei, KB]`); continue; }
    const [datei, kb] = e;
    if (!new RegExp(`^m/${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[0-9a-f]{8}\\.glb$`).test(datei))
      fail(`[2] ${id}: Datei ${datei} — erwartet m/${id}.<8 Hexzeichen>.glb`);
    if (!(kb > 0 && kb < 20480)) fail(`[2] ${id}: ${kb} KB ist nicht plausibel (0 bis 20 MB)`);
    dateien.set(id, BASIS + datei);
  }
  console.log(`  [2] ${eintraege.length} Eintraege geprueft`);

  // [3]
  let ohneSeite = 0;
  for (const s of itemSeiten) {
    const id = s.replace(/^(?:de\/)?items\//, '').replace(/\.html$/, '');
    const gefunden = dialoge(readFileSync(join(DIST, s), 'utf8'));
    const soll = dateien.get(id);
    if (gefunden.length) mitDialog++;
    if (soll && gefunden.length !== 1) fail(`[3] ${s}: ${gefunden.length} 3D-Dialoge, erwartet genau einer`);
    else if (soll && gefunden[0] !== soll) fail(`[3] ${s}: Dialog zeigt auf ${gefunden[0] || '(nichts)'}, erwartet ${soll}`);
    else if (!soll && gefunden.length) fail(`[3] ${s}: 3D-Dialog ohne Eintrag in src/data/item-3d.json`);
  }
  const seitenIds = new Set(itemSeiten.map((s) => s.replace(/^(?:de\/)?items\//, '').replace(/\.html$/, '')));
  for (const [id] of eintraege) if (!seitenIds.has(id)) ohneSeite++;
  console.log(`  [3] ${itemSeiten.length} Item-Seiten gelesen: ${mitDialog} mit 3D-Dialog (Soll ${2 * (eintraege.length - ohneSeite)}), ${ohneSeite} Modelle ohne eigene Item-Seite`);
  if (mitDialog !== 2 * (eintraege.length - ohneSeite)) fail(`[3] ${mitDialog} Item-Seiten mit Dialog, erwartet ${2 * (eintraege.length - ohneSeite)} (EN und DE je Modell mit Seite)`);

  // [4]
  const erlaubt = new Set(dateien.values());
  for (const s of bpSeiten) {
    const gefunden = dialoge(readFileSync(join(DIST, s), 'utf8'));
    if (gefunden.length) bpMitDialog++;
    if (gefunden.length > 1) fail(`[4] ${s}: ${gefunden.length} 3D-Dialoge, hoechstens einer`);
    for (const u of gefunden) if (!erlaubt.has(u)) fail(`[4] ${s}: Dialog zeigt auf ${u || '(nichts)'}, das steht nicht in der Liste`);
  }
  console.log(`  [4] ${bpSeiten.length} Blueprint-Seiten gelesen: ${bpMitDialog} mit 3D-Dialog`);

  // [5]
  for (const f of ['assets/hangar-item3d.js', 'vendor/three/addons/environments/RoomEnvironment.js'])
    if (!existsSync(join(DIST, f))) fail(`[5] dist/${f} fehlt — ohne ihn bleibt der Dialog leer`);
  console.log('  [5] Betrachter und Umgebungslicht in dist/ nachgesehen');

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
