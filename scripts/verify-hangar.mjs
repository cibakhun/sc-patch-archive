/* ============================================================
   verify-hangar.mjs — Tor fuer die Hangar-Buchten (Schiene A).

   WARUM ES DEN GIBT: Die Ausstattung im Hangar ist ein Bau-Join aus fuenf
   Dateien (vehicles, holo-meshes, ship-loadouts, ship-hardpoints,
   universal-items), gerendert in 454 Buchtdokumente, die die Seite je Schiff
   holt (src/lib/hangar/bay.ts). Jeder Fehler eines Joins ist still: eine
   fehlende Bucht ist ein 404 nur fuer den, der genau dieses Schiff waehlt,
   eine falsche Achsregel setzt Marker in die Luft, ein gebrochener Item-Join
   laesst Zeilen ohne Zahlen. Die Seite baut trotzdem und sieht gut aus.
   Dieses Tor liest das ARTEFAKT (dist/), druckt jede Zahl und reisst bei
   gebrochenem Join oder unter einer Klinke. Kein git, kein Netz, keine
   Data.p4k, kein Kindprozess — schienenfaehig fuer Schiene A.

   ELF ZUSICHERUNGEN, jede mit Soll-/Ist-Zeile:
     1  Eine Id-Menge an vier Stellen, je Hangarseite: das Dock
        (li[data-id]), die Modellliste der Szene (#hg-stage, Form der
        StageConfig aus src/lib/hangar/stage.ts), die EN-Buchten, die
        DE-Buchten. Die Zahl selbst hat ihre Klinke in verify:metrics
        (seitenHangarBuchten), neben allen anderen Seitenzahlen.
     2  Buchtgestalt: main[data-bay-id] gleich Dateiname, genau die drei
        Regionen head, panel, marks und keine weitere (der Controller setzt
        nur diese ein), je Bucht ein Tab-Panel fuer genau die Tabs,
        die die Tab-Leiste der Hangarseite nennt (aus dist/hangar.html
        gelesen, keine eigene Liste), kein <style>, kein <script>, style= nur
        als Balkenbreite (die Kostenbremse: Buchten bleiben reines HTML).
     3  Marker am Rumpf, in zwei Haelften.
        3a Jedes data-p: drei endliche Zahlen in der data-box, je Achse um
           15 % (mindestens 1 m) erweitert; jede Zeile aus data-rows fuehrt
           den Port des Markers in data-ports und steht in seinem Tab. Faengt
           Punkte und Box, die verschieden umgerechnet wurden.
        3b Die Z-Ausdehnung der Box (glTF-Bugachse) liegt innerhalb 30 % der
           Schiffslaenge aus dem Dock (data-v unter len, aus vehicles.json,
           nicht aus der Hardpoint-Datei). Faengt eine falsche Achsregel,
           die Punkte UND Box verschiebt; die sieht 3a nicht.
     4  EN gleich DE je Schiff: Zeilen und Marker. verify:sync beweist schon
        die Elementfolge; diese Zeile nennt das Schiff.
     5  Zaehlungen gegen die Klinken (KLINKEN unten).
     6  Groessendeckel: groesste Bucht, Summe je Sprache.
     7  Viewer-Naht: dist/assets/hangar-viewer.js liefert project, focus und
        onFrame. Reisst sie, nennt die Meldung .planning/notes/hangar-naht.md.
     8  Import-Map vor dem ersten Modul-Skript auf beiden Hangarseiten: ein
        Modul-Skript davor laesst Chrome die Map verwerfen, und three.js
        laedt nicht mehr.
     9  Jede Vorlage, die der Controller verlangt, steht auf beiden Seiten.
        Die Ids kommen aus dem ausgelieferten Code selbst (jeder msg('…')-
        Aufruf in dist/assets/hangar-overview.js), nicht aus einer Liste
        hier: eine aus HangarPage.astro entfernte Vorlage hinterlaesst sonst
        still eine leere Stelle.
    10  Dock-Daten, so wie der Client sie liest. Jede Karte traegt data-v
        mit genau so vielen Werten, wie data-stats Schluessel nennt, jeder
        eine endliche Zahl oder '-'. data-stats nennt jede Zeile der
        Vergleichstabelle (#hgx-cmp-table tr[data-k], mindestens 13) und
        jede Sortieroption ausser dem Namen. Die Werte jeder Karte stimmen
        mit dem Ueberblick der EN-Bucht desselben Schiffs ueberein, fuer die
        Kennwerte, die er druckt. Sortierung, Vergleich und Flottenzeile
        rechnen nur mit data-v; eine verrutschte Folge vertauscht still
        Fracht und Besatzung, und Anzahl und Zahlform allein sehen das nicht.
    11  Jeder Port in data-ports und data-port der Buchten passt auf die
        Portregel des Controllers (PORT_RE, gelesen aus
        dist/assets/hangar-overview.js). Sonst verwirft parseState den
        tiefen Link ?hp= auf genau diesen Hardpoint still.

   VORGEFUEHRT ROT (die Meldungen stehen in den Commit-Botschaften):
     a  dist/hangar-bay/aegs-gladius.html nach dem Bauen loeschen   -> [1]
     b  toGltf() in src/lib/hangar/ports.ts auf (x, y, z), bauen    -> [3b]
        ([3a] und [5] bleiben gruen: Punkte, Box und Zahlen wandern
        gemeinsam — genau dafuer gibt es 3b)
     c  joinItem() in src/lib/hangar/bay.ts ohne Namensnormalisierung,
        bauen                                                       -> [5]
     d  in dist/hangar.html einer Karte einen Wert aus data-v nehmen  -> [10]
     e  in dist/hangar.html zwei Werte einer Karte tauschen          -> [10]
     f  in einer gebauten Bucht einen Port gross schreiben           -> [11]

     node scripts/verify-hangar.mjs            Tor
     node scripts/verify-hangar.mjs --report   nur Ist-Werte, kein Urteil
                                               (zum bewussten Anheben)
   ============================================================ */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORT = process.argv.includes('--report');

/* Klinken in der Bauform von scripts/lib/metrics-baseline.mjs. 'min' darf
   wachsen, nie fallen; Senken nur per Commit, der die Ursache nennt. 'max'
   ist ein Deckel. Startwerte aus dem ersten gebauten dist/ am 07.10.2026
   (Build mit 17.962 Seiten), nicht geschaetzt. */
const KLINKEN = [
  {
    id: 'slotZeilen', wert: 2410, regel: 'min', toleranzProzent: 2,
    anlass: 'Zeilen je (Art, Item, Groesse) ueber 223 Loadouts, EN. Atmet leicht mit jedem Datenlauf.',
  },
  {
    id: 'slotZeilenMitWerten', wert: 1980, regel: 'min', toleranzProzent: 2,
    anlass: 'Zeilen, deren Item per Name und Groesse Kennwerte findet (Details mit Werten). Ein gebrochener Item-Join faellt weit darunter.',
  },
  {
    id: 'marker', wert: 3389, regel: 'min', toleranzProzent: 2,
    anlass: '3.389 von 3.621 Loadout-Ports tragen einen Bone, keiner verteilt seine Items auf zwei Tabs. Faellt, wenn der Hardpoint-Join oder die Portnamen brechen.',
  },
  {
    id: 'schiffeMitWaffen', wert: 211, regel: 'min',
    anlass: '211 Schiffe zeigen mindestens eine Waffenzeile; 16 sind unbewaffnet oder ohne Loadout.',
  },
  {
    id: 'rumpfLaengeAufZ', wert: 200, regel: 'min', toleranzProzent: 2,
    anlass: 'Zusicherung 3b: bei 200 von 225 Schiffen mit bekannter Laenge liegt die Z-Ausdehnung der Rumpfbox innerhalb 30 % der Laenge aus vehicles.json. Eine falsche Achsregel drueckt die Zahl auf etwa 10. Toleranz, weil Rumpfbox und Wiki-Laenge aus verschiedenen Quellen stammen und ein einzelner Rumpf im Datenlauf kippen darf.',
  },
  {
    id: 'buchtMaxKB', wert: 48, regel: 'max',
    anlass: 'Kostenbremse: eine Bucht wird bei jedem Schiffswechsel geholt. Heute 20,5 KB (rsi-polaris, DE). Item-Beschreibungen oder Inline-CSS sprengen den Deckel.',
  },
  {
    id: 'buchtenSummeMB', wert: 4, regel: 'max',
    anlass: 'Kostenbremse fuer das Image und jedes Tor, das dist/ durchlaeuft (454 Dateien). Heute 3,09 MB DE.',
  },
];

const findings = [];
const fail = (msg) => findings.push(msg);
const say = (s = '') => console.log(s);
const sollIst = (soll, ist) => say(`    Soll: ${soll}   Ist: ${ist}`);

if (!existsSync(join(DIST, 'hangar.html'))) {
  console.error('verify-hangar: dist/hangar.html fehlt — erst `npm run build`.');
  process.exit(2);
}

const PAGES = [
  { lang: 'en', file: 'hangar.html' },
  { lang: 'de', file: 'de/hangar.html' },
].map((p) => ({ ...p, html: readFileSync(join(DIST, p.file), 'utf8') }));

const dockIds = (html) => [...html.matchAll(/<li data-id="([^"]+)"/g)].map((m) => m[1]);

// Die Modellliste der Seite: die StageConfig der Szene in #hg-stage
// (src/lib/hangar/stage.ts). Liefert die Ids, deren Eintrag die Form
// [glb, Werkslack oder null, Herstellerkuerzel] hat, und die Formfehler.
function stageModels(html) {
  const m = /<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return { ids: null, bad: ['kein #hg-stage'] };
  let cfg;
  try { cfg = JSON.parse(m[1]); } catch (e) { return { ids: null, bad: [`#hg-stage ist kein JSON (${e.message})`] }; }
  const bad = [];
  if (typeof cfg.viewer !== 'string' || !cfg.viewer.includes('hangar-viewer.js')) bad.push('viewer ist keine URL von hangar-viewer.js');
  if (!cfg.opts || typeof cfg.opts !== 'object') bad.push('opts fehlt');
  const ids = [];
  for (const [id, e] of Object.entries(cfg.models ?? {})) {
    const ok = Array.isArray(e) && e.length === 3 && typeof e[0] === 'string' && e[0] && (e[1] === null || typeof e[1] === 'string') && typeof e[2] === 'string';
    if (ok) ids.push(id); else bad.push(`models["${id}"] hat nicht die Form [glb, tex|null, maker]`);
  }
  return { ids, bad };
}

// Das Dock so gelesen, wie der Client es liest: data-stats und data-v je Karte.
function readDock(html) {
  const keys = (/id="hg-strip"[^>]*\sdata-stats="([^"]*)"/.exec(html)?.[1] ?? '').split(' ').filter(Boolean);
  const cards = [...html.matchAll(/<li data-id="([^"]+)"[^>]*\sdata-v="([^"]*)"/g)].map((m) => ({ id: m[1], v: m[2].split(' ') }));
  const figures = new Map(cards.map((c) => [c.id, Object.fromEntries(keys.map((k, i) => [k, c.v[i] === undefined || c.v[i] === '-' ? null : Number(c.v[i])]))]));
  return { keys, cards, figures };
}
const DOCK = { en: readDock(PAGES[0].html), de: readDock(PAGES[1].html) };

// Buchten per Regex gelesen, keine HTML-Bibliothek: wie audit-site.
const REGIONS = ['head', 'panel', 'marks'];
function parseBay(file, html) {
  const id = /<main class="hgx-baydoc" data-bay-id="([^"]+)"/.exec(html)?.[1] ?? null;
  const tabs = [...html.matchAll(/role="tabpanel" id="hgx-tp-([a-z]+)"/g)].map((m) => ({ tab: m[1], at: m.index }));
  const tabAt = (at) => {
    let t = null;
    for (const x of tabs) if (x.at < at) t = x.tab;
    return t;
  };
  const numbers = new Map([...html.matchAll(/<div class="hgx-d" id="hgx-d-([^"]+)" hidden>(<dl>)?/g)].map((m) => [m[1], !!m[2]]));
  const rows = [...html.matchAll(/<li class="hgx-slot" data-row="([^"]+)" data-kind="([^"]+)" data-ports="([^"]*)">/g)].map((m) => ({
    key: m[1], kind: m[2], ports: m[3].split(' ').filter(Boolean), tab: tabAt(m.index), numbers: numbers.get(m[1]) === true,
  }));
  const marks = [...html.matchAll(/<i class="hgx-mk" data-tab="([^"]+)" data-port="([^"]+)" data-rows="([^"]*)" data-p="([^"]*)">/g)].map((m) => ({
    tab: m[1], port: m[2], rows: m[3].split(' ').filter(Boolean), p: m[4].split(' ').map(Number),
  }));
  // Nur das Ueberblick-Panel: der Fracht-Tab traegt eigene hg-row-Zeilen (cargo, ore).
  const ovAt = html.indexOf('id="hgx-tp-overview"');
  const ovEnd = ovAt < 0 ? -1 : html.indexOf('role="tabpanel"', ovAt);
  const ovHtml = ovAt < 0 ? '' : html.slice(ovAt, ovEnd < 0 ? undefined : ovEnd);
  const overview = [...ovHtml.matchAll(/<div class="hg-row(?: is-na)?" data-k="([a-zA-Z0-9]+)"><dt>[^<]*<\/dt><dd>([^<]*)<\/dd>/g)].map((m) => ({ k: m[1], text: m[2] }));
  const box = (/data-box="([^"]*)"/.exec(html)?.[1] ?? '').split(' ').filter(Boolean).map(Number);
  const styleAttrs = [...html.matchAll(/\sstyle="([^"]*)"/g)].map((m) => m[1]);
  return {
    file, id, bytes: Buffer.byteLength(html),
    regions: [...html.matchAll(/\sdata-bay="([a-z]+)"/g)].map((m) => m[1]),
    tabs: tabs.map((x) => x.tab), rows, marks, overview,
    box: box.length === 6 ? box : null,
    styleTags: (html.match(/<style\b/g) || []).length,
    scriptTags: (html.match(/<script\b/g) || []).length,
    styleAttrs,
  };
}

function readBays(dir) {
  const abs = join(DIST, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter((n) => n.endsWith('.html')).sort()
    .map((n) => parseBay(`${dir}/${n}`, readFileSync(join(abs, n), 'utf8')))
    .map((b, i, all) => ({ ...b, name: all[i].file.replace(/^.*\//, '').replace(/\.html$/, '') }));
}
const BAYS = { en: readBays('hangar-bay'), de: readBays('de/hangar-bay') };
const bayIds = (lang) => new Set(BAYS[lang].map((b) => b.name));

say('\n[1] Eine Id-Menge: Dock, Modellliste, EN-Buchten, DE-Buchten (je Hangarseite)');
for (const page of PAGES) {
  const stage = stageModels(page.html);
  const places = {
    Dock: new Set(dockIds(page.html)),
    Modelle: new Set(stage.ids ?? []),
    'EN-Bucht': bayIds('en'),
    'DE-Bucht': bayIds('de'),
  };
  for (const b of stage.bad) fail(`[1] ${page.file}: ${b} — Vertrag: src/lib/hangar/stage.ts, .planning/notes/hangar-naht.md`);
  const all = new Set(Object.values(places).flatMap((s) => [...s]));
  const diffs = [];
  for (const id of [...all].sort()) {
    const missing = Object.entries(places).filter(([, s]) => !s.has(id)).map(([k]) => k);
    if (!missing.length) continue;
    const present = Object.keys(places).filter((k) => !missing.includes(k));
    diffs.push(`${id}: ${present.join(' und ')}, aber keine ${missing.join(', keine ')}`);
  }
  say(`    ${page.file}: ${Object.entries(places).map(([k, s]) => `${k} ${s.size}`).join(' · ')}`);
  sollIst('0 Abweichungen', diffs.length);
  for (const d of diffs.slice(0, 10)) say(`      ${d}`);
  for (const d of diffs) fail(`[1] ${page.file}: ${d}`);
}

say('\n[2] Buchtgestalt: Id = Datei, drei Regionen, Tabs der Seite, reines HTML');
const pageTabs = (html) => [...html.matchAll(/role="tab" id="hgx-tab-([a-z]+)"/g)].map((m) => m[1]).join(' ');
const refTabs = pageTabs(PAGES[0].html);
if (!refTabs) fail('[2] hangar.html traegt keine Tab-Leiste (role="tab" id="hgx-tab-…")');
if (pageTabs(PAGES[1].html) !== refTabs) fail(`[2] de/hangar.html nennt die Tabs "${pageTabs(PAGES[1].html)}" statt "${refTabs}"`);
let shapeBad = 0, shapeChecked = 0;
for (const lang of ['en', 'de']) {
  for (const b of BAYS[lang]) {
    shapeChecked++;
    const bad = [];
    if (b.id !== b.name) bad.push(`main[data-bay-id]="${b.id}" statt "${b.name}"`);
    // Jede Region genau einmal und keine weitere: eine Region, die der Controller nicht einsetzt, ist totes Gewicht je Abruf.
    if (b.regions.join(' ') !== REGIONS.join(' ')) bad.push(`Regionen "${b.regions.join(' ')}" statt "${REGIONS.join(' ')}"`);
    if (b.tabs.join(' ') !== refTabs) bad.push(`Tabs "${b.tabs.join(' ')}" statt "${refTabs}"`);
    if (b.styleTags || b.scriptTags) bad.push(`${b.styleTags}× <style>, ${b.scriptTags}× <script>`);
    const foreign = b.styleAttrs.filter((s) => !/^--w:\d+%$/.test(s));
    if (foreign.length) bad.push(`style= ausser Balkenbreite: "${foreign[0]}"`);
    if (bad.length) { shapeBad++; fail(`[2] ${b.file}: ${bad.join('; ')}`); }
  }
}
say(`    Tab-Folge: ${refTabs}`);
sollIst(`0 abweichende von ${shapeChecked} Buchten`, shapeBad);
if (!refTabs.includes('overview')) fail('[2] keine Bucht traegt ein Ueberblick-Panel');

say('\n[3a] Marker in der Rumpfbox und an einer Zeile, die ihren Port fuehrt (EN)');
let markTotal = 0;
const outside = [];
for (const b of BAYS.en) {
  const rowBy = new Map(b.rows.map((r) => [r.key, r]));
  for (const m of b.marks) {
    markTotal++;
    const where = `${b.name} ${m.port}`;
    if (m.p.length !== 3 || !m.p.every(Number.isFinite)) { outside.push(`${where}: data-p ist kein Punkt`); continue; }
    if (!b.box) { outside.push(`${where}: Bucht ohne data-box`); continue; }
    for (let a = 0; a < 3; a++) {
      const lo = b.box[a], hi = b.box[a + 3];
      const pad = Math.max(1, (hi - lo) * 0.15);
      if (m.p[a] < lo - pad || m.p[a] > hi + pad) { outside.push(`${where}: Achse ${'xyz'[a]} ${m.p[a]} ausserhalb ${lo}…${hi} (±${pad.toFixed(2)})`); break; }
    }
    if (!m.rows.length) outside.push(`${where}: Marker ohne Zeile`);
    for (const key of m.rows) {
      const r = rowBy.get(key);
      if (!r) outside.push(`${where}: Zeile ${key} fehlt`);
      else if (!r.ports.includes(m.port)) outside.push(`${where}: Zeile ${key} fuehrt den Port nicht`);
      else if (r.tab !== m.tab) outside.push(`${where}: Zeile ${key} steht in ${r.tab}, der Marker in ${m.tab}`);
    }
  }
}
say(`    Marker geprueft: ${markTotal}`);
sollIst('0 ausserhalb oder ohne Zeile', outside.length);
for (const o of outside.slice(0, 10)) say(`      ${o}`);
for (const o of outside) fail(`[3a] ${o}`);

say('\n[3b] Z-Ausdehnung der Rumpfbox gegen die Schiffslaenge aus dem Dock (data-v len, EN)');
let withLen = 0, alongZ = 0;
for (const b of BAYS.en) {
  const len = DOCK.en.figures.get(b.name)?.len ?? null;
  if (!(len > 0) || !b.box) continue;
  withLen++;
  const ez = b.box[5] - b.box[2];
  if (Math.abs(ez - len) / len <= 0.3) alongZ++;
}
say(`    Schiffe mit Laenge und Box: ${withLen}   davon Laenge entlang Z (±30 %): ${alongZ}`);
const ist = {
  rumpfLaengeAufZ: alongZ,
  marker: markTotal,
  slotZeilen: BAYS.en.reduce((n, b) => n + b.rows.length, 0),
  slotZeilenMitWerten: BAYS.en.reduce((n, b) => n + b.rows.filter((r) => r.numbers).length, 0),
  schiffeMitWaffen: BAYS.en.filter((b) => b.rows.some((r) => r.tab === 'weapons')).length,
};

say('\n[4] EN gleich DE je Schiff: Zeilen und Marker');
const deBy = new Map(BAYS.de.map((b) => [b.name, b]));
const parity = [];
for (const en of BAYS.en) {
  const de = deBy.get(en.name);
  if (!de) continue; // fehlt die DE-Bucht, meldet [1] das Schiff
  const sig = (b) => `${b.rows.map((r) => r.key).join(',')}|${b.marks.length}`;
  if (sig(en) !== sig(de)) parity.push(`${en.name}: EN ${en.rows.length} Zeilen/${en.marks.length} Marker, DE ${de.rows.length}/${de.marks.length}`);
}
say(`    Paare geprueft: ${BAYS.en.filter((b) => deBy.has(b.name)).length}`);
sollIst('0 Abweichungen', parity.length);
for (const p of parity.slice(0, 10)) say(`      ${p}`);
for (const p of parity) fail(`[4] ${p}`);

for (const lang of ['en', 'de']) {
  const sizes = BAYS[lang].map((b) => b.bytes);
  ist[`buchtMaxKB:${lang}`] = sizes.length ? Math.max(...sizes) / 1024 : 0;
  ist[`buchtenSummeMB:${lang}`] = sizes.reduce((a, b) => a + b, 0) / 1048576;
}
say('\n[5] Zaehlungen gegen die Klinken (EN; [4] haelt DE gleich)   [6] Groessendeckel je Sprache');
say(`    ${'Kennzahl'.padEnd(24)}${'Soll'.padStart(12)}${'Ist'.padStart(12)}`);
for (const k of KLINKEN) {
  const values = k.regel === 'max' ? ['en', 'de'].map((l) => [`${k.id} ${l.toUpperCase()}`, ist[`${k.id}:${l}`]]) : [[k.id, ist[k.id]]];
  for (const [label, v] of values) {
    const grenze = k.regel === 'max' ? k.wert : Math.floor(k.wert * (1 - (k.toleranzProzent ?? 0) / 100));
    const ok = k.regel === 'max' ? v <= grenze : v >= grenze;
    const shown = Number.isInteger(v) ? v : v.toFixed(2);
    say(`    ${label.padEnd(24)}${((k.regel === 'max' ? '<= ' : '>= ') + grenze).padStart(12)}${String(shown).padStart(12)}${ok ? '' : '   GERISSEN'}`);
    if (!ok) {
      fail(k.regel === 'max'
        ? `[6] ${label}: ${shown} ueber dem Deckel ${grenze} — Anlass: ${k.anlass}`
        : `[5] ${label}: ${v} liegt unter der Klinke ${grenze} (Baseline ${k.wert}${k.toleranzProzent ? `, Toleranz ${k.toleranzProzent} %` : ''}) — Ursache klaeren, nicht die Klinke senken. Anlass: ${k.anlass}`);
    }
  }
}

say('\n[7] Viewer-Naht: hangar-viewer.js liefert project, focus, onFrame');
const viewerFile = join(DIST, 'assets', 'hangar-viewer.js');
const viewer = existsSync(viewerFile) ? readFileSync(viewerFile, 'utf8') : '';
const api = viewer.slice(viewer.lastIndexOf('return {'));
const seam = ['project', 'focus', 'onFrame'].filter((n) => new RegExp(`\\b${n}\\b`).test(api));
sollIst('project, focus, onFrame', seam.join(', ') || '—');
if (seam.length !== 3) fail(`[7] dist/assets/hangar-viewer.js liefert nicht mehr ${['project', 'focus', 'onFrame'].filter((n) => !seam.includes(n)).join(', ')} — Absprache: .planning/notes/hangar-naht.md`);

say('\n[8] Import-Map vor dem ersten Modul-Skript (beide Hangarseiten)');
for (const page of PAGES) {
  const map = page.html.search(/<script\b[^>]*type="importmap"/);
  const mod = page.html.search(/<script\b[^>]*type="module"/);
  const ok = map >= 0 && (mod < 0 || map < mod);
  say(`    ${page.file}: Import-Map bei ${map}, erstes Modul-Skript bei ${mod}${ok ? '' : '   GERISSEN'}`);
  if (!ok) fail(`[8] ${page.file}: ${map < 0 ? 'keine Import-Map' : 'ein Modul-Skript steht vor der Import-Map'} — three.js laedt dann nicht`);
}

say('\n[9] Jede Vorlage aus msg(…) im Controller steht auf beiden Hangarseiten');
const ctrlFile = join(DIST, 'assets', 'hangar-overview.js');
const ctrl = existsSync(ctrlFile) ? readFileSync(ctrlFile, 'utf8') : '';
if (!ctrl) fail('[9] dist/assets/hangar-overview.js fehlt');
const msgIds = [...new Set([...ctrl.matchAll(/\bmsg\('([a-z-]+)'\)/g)].map((m) => m[1]))];
for (const page of PAGES) {
  const missing = msgIds.filter((id) => !page.html.includes(`data-msg="${id}"`));
  say(`    ${page.file}: ${msgIds.length - missing.length} von ${msgIds.length} (${msgIds.join(', ') || '—'})`);
  for (const id of missing) fail(`[9] ${page.file}: Vorlage data-msg="${id}" fehlt, der Controller verlangt sie`);
}
if (ctrl && !msgIds.length) fail('[9] keine msg(…)-Aufrufe im Controller gefunden — der Leser ist kaputt, nicht der Controller leer');

say('\n[10] Dock-Daten: data-v in der Folge von data-stats, gegen Vergleichstabelle, Sortierung und Ueberblick (beide Hangarseiten)');
// Zahl einer Zeile des EN-Ueberblicks ("1,944.5 DPS", "21 m", "1"); der Strich ist unbekannt.
const enNumber = (text) => (text.trim() === '–' ? null : Number(text.replace(/,/g, '').trim().split(' ')[0]));
const overviewBy = new Map(BAYS.en.map((b) => [b.name, b.overview]));
for (const page of PAGES) {
  const { keys, cards, figures } = DOCK[page.lang];
  const bad = cards.filter((c) => c.v.length !== keys.length || c.v.some((x) => x !== '-' && !Number.isFinite(Number(x))));
  const total = dockIds(page.html).length;
  const cmpHtml = /id="hgx-cmp-table">([\s\S]*?)<\/table>/.exec(page.html)?.[1] ?? '';
  const cmpKeys = [...cmpHtml.matchAll(/<tr data-k="([a-zA-Z0-9]+)"/g)].map((m) => m[1]);
  const sortHtml = /<select id="hgx-sort"[^>]*>([\s\S]*?)<\/select>/.exec(page.html)?.[1] ?? '';
  const sortKeys = [...sortHtml.matchAll(/<option value="([a-zA-Z0-9]+)"/g)].map((m) => m[1]).filter((k) => k !== 'name');
  const missing = [...new Set([...cmpKeys, ...sortKeys])].filter((k) => !keys.includes(k));
  // Anzahl und Zahlform sehen eine verrutschte Folge nicht; der Ueberblick
  // derselben Bucht nennt die Werte mit Namen.
  let compared = 0;
  const off = [];
  for (const c of cards) {
    for (const row of overviewBy.get(c.id) ?? []) {
      if (!keys.includes(row.k)) continue;
      compared++;
      const v = figures.get(c.id)[row.k];
      const want = v === null || v <= 0 ? null : v; // fuer 0 druckt der Ueberblick den Strich
      if (enNumber(row.text) !== want) off.push(`${c.id} ${row.k}: data-v ${v ?? '-'}, Ueberblick "${row.text}"`);
    }
  }
  say(`    ${page.file}: ${keys.length} Schluessel, ${cards.length} von ${total} Karten mit data-v, Vergleichstabelle ${cmpKeys.length} Zeilen, Sortierung ${sortKeys.length} Kennwerte, ${compared} Werte gegen den Ueberblick`);
  sollIst(`0 abweichende Karten, alle ${total} mit data-v, 0 fehlende Schluessel, 0 Werte neben dem Ueberblick`, `${bad.length} abweichend, ${total - cards.length} ohne, ${missing.length} fehlend, ${off.length} daneben`);
  for (const c of bad.slice(0, 10)) say(`      ${c.id}: ${c.v.length} Werte "${c.v.join(' ')}"`);
  for (const o of off.slice(0, 10)) say(`      ${o}`);
  for (const c of bad) fail(`[10] ${page.file}: Karte ${c.id} traegt ${c.v.length} Werte statt ${keys.length} oder einen, der keine Zahl ist — catalog.ts dockFigures`);
  if (cards.length !== total) fail(`[10] ${page.file}: ${total - cards.length} Karten ohne data-v`);
  if (!keys.length) fail(`[10] ${page.file}: das Dock nennt keine Schluessel (data-stats)`);
  if (cmpKeys.length < 13) fail(`[10] ${page.file}: die Vergleichstabelle hat ${cmpKeys.length} Zeilen, mindestens 13`);
  if (!compared) fail(`[10] ${page.file}: kein Wert gegen den Ueberblick geprueft — der Leser ist kaputt, nicht das Dock leer`);
  for (const k of missing) fail(`[10] ${page.file}: ${k} steht in der Vergleichstabelle oder der Sortierung, aber nicht in data-stats`);
  for (const o of off) fail(`[10] ${page.file}: ${o} — data-v und data-stats laufen auseinander (catalog.ts dockFigures)`);
}

say('\n[11] Jeder Port der Buchten passt auf PORT_RE des Controllers (EN und DE)');
const portRule = /const PORT_RE = \/(.+)\/([a-z]*);/.exec(ctrl);
if (!portRule) fail('[11] dist/assets/hangar-overview.js nennt keine PORT_RE mehr — der Leser ist kaputt oder die Regel ist umgezogen');
else {
  const rule = new RegExp(portRule[1], portRule[2]);
  let ports = 0;
  const wrong = [];
  for (const lang of ['en', 'de']) {
    for (const b of BAYS[lang]) {
      for (const p of new Set([...b.rows.flatMap((r) => r.ports), ...b.marks.map((m) => m.port)])) {
        ports++;
        if (!rule.test(p)) wrong.push(`${b.file}: "${p}"`);
      }
    }
  }
  say(`    Regel /${portRule[1]}/${portRule[2]}   Ports geprueft: ${ports}`);
  sollIst('0 Ports neben der Regel', wrong.length);
  for (const w of wrong.slice(0, 10)) say(`      ${w}`);
  for (const w of wrong) fail(`[11] ${w} passt nicht auf PORT_RE; parseState verwirft ?hp= mit diesem Port`);
  if (!ports) fail('[11] keine Ports gelesen');
}

say('\n[Selbstauskunft]');
say(`    Hangarseiten: ${PAGES.length}   Buchten: EN ${BAYS.en.length}, DE ${BAYS.de.length}   Zeilen EN: ${ist.slotZeilen}   Marker EN: ${ist.marker}`);

if (REPORT) {
  say('\n(--report: nur Ist-Werte, kein Urteil)\n');
  process.exit(0);
}
if (findings.length) {
  console.error(`\nverify-hangar: ${findings.length} FEHLER\n`);
  for (const f of findings.slice(0, 40)) console.error(`  · ${f}`);
  if (findings.length > 40) console.error(`  … +${findings.length - 40} weitere`);
  console.error('');
  process.exit(1);
}
say('\nverify-hangar: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
