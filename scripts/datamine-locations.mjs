// datamine-locations.mjs — Fundort-Ebene 100% aus den Spieldateien, node-nativ ueber
// den DataCore-Reader (KEIN unp4k/unforge, KEIN scmdb). Kette:
//   HarvestableProviderPreset (Location) -> harvestables[].harvestable
//     -> HarvestablePreset.entityClass -> EntityClassDefinition(MineableRock)
//       -> Components[].composition -> MineableComposition.compositionArray -> element/max%
// Baut element->locations (VOLLSTAENDIG, nach eff sortiert) + bodies (Reverse) aus
// EINER aggregierten Menge, damit sich beide Sichten nicht widersprechen koennen.
// Je (Element, Fundort, Methode): chance = Summe der Deposit-Wahrscheinlichkeiten,
// maxShare = hoechster Massenanteil, eff = Erwartungswert des Anteils.
//
// Aufruf: node scripts/datamine-locations.mjs [--p4k <Data.p4k>] [--verify]
// Ausgabe: assets/mining-locations-gamefiles.json (Zwischenprodukt fuer build-mining-db).
import { writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'mining-locations-gamefiles.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const VERIFY = argv.includes('--verify');

const norm = (s) => (s || '').replace(/\\/g, '/');
const gnorm = (g) => String(g || '').toLowerCase().replace(/[^0-9a-f]/g, '');
const cleanMat = (n) => { const m = { aluminium: 'Aluminum', sileron: 'Stileron', carinitepure: 'Carinite' }; n = String(n || '').toLowerCase(); return m[n] || (n.charAt(0).toUpperCase() + n.slice(1)); };
const matFromFile = (f) => cleanMat(basename(norm(f), '.xml').replace(/^minableelement_(fps|groundvehicle)_/, '').replace(/_(ore|raw)$/, ''));

const p4kPath = argOf('--p4k') ?? DEFAULT_P4K;
const t0 = Date.now();
const p4k = openP4k(p4kPath);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
p4k.close();
const db = openDataCore(dcb);
console.log(`DataCore v${db.version}: ${db.records.length} Records (${Date.now() - t0} ms)`);

/* ---- Indizes ---- */
const matByGuid = new Map();      // MineableElement.id -> material
const compByGuid = new Map();     // MineableComposition.id -> [{el, max}]
const hpresetEntity = new Map();  // HarvestablePreset.id -> entityClass.__ref
const entityComp = new Map();     // EntityClassDefinition(mineable).id -> composition.__ref
const SKIP = /template|test|flowstone|vlklimpet/i;

for (const r of db.records) {
  const sn = db.structs[r.structIndex]?.name;
  const f = norm(r.fileName);
  if (sn === 'MineableElement' && /mining\/mineableelements\//i.test(f)) {
    matByGuid.set(gnorm(r.id), matFromFile(r.fileName));
  } else if (sn === 'MineableComposition' && /mining\/rockcompositionpresets\//i.test(f)) {
    const o = db.readRecord(r, { maxDepth: 4 });
    compByGuid.set(gnorm(r.id), (o.compositionArray || []).map((p) => ({ el: gnorm(p.mineableElement?.__ref), max: p.maxPercentage })));
  } else if (sn === 'HarvestablePreset' && /harvestable\/harvestablepresets\//i.test(f)) {
    const o = db.readRecord(r, { maxDepth: 2 });
    if (o.entityClass?.__ref) hpresetEntity.set(gnorm(r.id), gnorm(o.entityClass.__ref));
  }
}
// mineable-Entities: composition-__ref tief im Components-Baum suchen
const deepComp = (x, seen = { v: null }) => { if (seen.v || !x || typeof x !== 'object') return seen.v; if (x.composition?.__ref) { seen.v = gnorm(x.composition.__ref); return seen.v; } for (const v of Object.values(x)) { deepComp(v, seen); if (seen.v) break; } return seen.v; };
for (const r of db.records) {
  if (db.structs[r.structIndex]?.name !== 'EntityClassDefinition' || !/entities\/mineable\//i.test(norm(r.fileName))) continue;
  if (SKIP.test(norm(r.fileName))) continue;
  const comp = deepComp(db.readRecord(r, { maxDepth: 8 }));
  if (comp) entityComp.set(gnorm(r.id), comp);
}
const resolveParts = (hRef) => { const ec = hpresetEntity.get(gnorm(hRef)); if (!ec) return null; const comp = entityComp.get(ec); return comp ? compByGuid.get(comp) : null; };
console.log(`  Indizes: ${matByGuid.size} Elemente, ${compByGuid.size} Kompositionen, ${hpresetEntity.size} Presets, ${entityComp.size} Rock-Entities`);

/* ---- Location-Namen (kuratiert, wie zuvor) ---- */
const MINING = { SpaceShip_Mineables: 'ship', SpaceShip_Mineables_Rare: 'ship', FPS_Mineables: 'fps', GroundVehicle_Mineables: 'roc', Harvestables: 'harvest' };
// Kuratierte hpp_-Preset -> Anzeigename (Starmap-Zuordnung; nicht rein im Mining-
// DataCore). Stanton nach SC-Kanon, Pyro-Monde per Fingerprint gegen die Alt-DB bestätigt.
const LOC_NAMES = {
  hpp_stanton1: 'Hurston', hpp_stanton1a: 'Arial', hpp_stanton1b: 'Aberdeen', hpp_stanton1c: 'Magda', hpp_stanton1d: 'Ita',
  hpp_stanton2a: 'Cellin', hpp_stanton2b: 'Daymar', hpp_stanton2c: 'Yela', hpp_stanton2c_belt: 'Yela Asteroid Belt',
  hpp_stanton3a: 'Lyria', hpp_stanton3b: 'Wala',
  hpp_stanton4: 'microTech', hpp_stanton4a: 'Calliope', hpp_stanton4b: 'Clio', hpp_stanton4c: 'Euterpe',
  hpp_pyro1: 'Pyro I', hpp_pyro2: 'Pyro II (Monox)', hpp_pyro3: 'Pyro III (Bloom)', hpp_pyro4: 'Pyro IV', hpp_pyro6: 'Pyro VI (Terminus)',
  hpp_pyro5a: 'Pyro V-a (Ignis)', hpp_pyro5b: 'Pyro V-b (Vatra)', hpp_pyro5c: 'Pyro V-c (Adir)', hpp_pyro5d: 'Pyro V-d (Fairo)', hpp_pyro5e: 'Pyro V-e (Fuego)', hpp_pyro5f: 'Pyro V-f (Vuur)',
};
function locName(recName, file) {
  let n = (recName || basename(file, '.xml')).replace(/^HarvestableProviderPreset\./, '');
  const raw = n; const low = n.toLowerCase();
  if (LOC_NAMES[low]) return LOC_NAMES[low];
  const M = { hpp_aaronhalo: 'Aaron Halo', asteroidcluster_low_yield: 'Asteroid Cluster (Low Yield)', asteroidcluster_medium_yield: 'Asteroid Cluster (Medium Yield)', hpp_lagrange_occupied: 'Lagrange (Occupied)', hpp_nyx_keegerbelt: 'Keeger Belt', hpp_nyx_glaciemring: 'Glaciem Ring', hpp_pyro_akirocluster: 'Akiro Cluster', hpp_pyro_deepspaceasteroids: 'Pyro Deep Space Asteroids' };
  if (M[low]) return M[low];
  let m;
  if ((m = /^hpp_lagrange_([a-g])$/.exec(low))) return 'Lagrange ' + m[1].toUpperCase();
  if ((m = /^hpp_pyro_warm0?(\d)$/.exec(low))) return 'Pyro Belt (Warm ' + m[1] + ')';
  if ((m = /^hpp_pyro_cool0?(\d)$/.exec(low))) return 'Pyro Belt (Cool ' + m[1] + ')';
  return raw;
}
const sysFromPath = (p) => (/[\\/]system[\\/](stanton|pyro|nyx)[\\/]/i.exec(p) || [])[1];
const typeFromPath = (p) => { if (/asteroidcluster/i.test(p)) return 'cluster'; if (/lagrange/i.test(p)) return 'lagrange'; if (/asteroidfield/i.test(p)) return 'belt'; return 'planet'; };

/* ---- Provider-Presets -> element -> Fundorte + Bodies (Reverse) + Methoden ----
   Je (Element, Fundort, Methode) werden ALLE beitragenden Deposits aggregiert:
     chance   = Summe der Auftrittswahrscheinlichkeiten. Ein Ort spawnt oft mehrere
                Rock-Typen, die dasselbe Element fuehren; sie schliessen sich innerhalb
                der Gruppe gegenseitig aus, also addieren sich ihre Wahrscheinlichkeiten.
     maxShare = hoechster Massenanteil ueber diese Deposits ("bis X %").
     eff      = Erwartungswert des Anteils = Summe(chance_i * max_i)/100. Das ist die
                Groesse, die Fundorte tatsaechlich rangiert.
   Vorher wurde stattdessen EIN Deposit ausgewaehlt — die Element-Sicht nach eff, die
   Body-Sicht nach chance. Das ergab zwei widersprechende Wahrheiten fuer dasselbe Paar
   und eine systematisch zu niedrige chance (nur ein Deposit statt aller). */
const agg = new Map();   // mat|system|body|mining -> Aggregat
let nLoc = 0, nUnresolved = 0, nZeroProb = 0;
const matMethods = {};              // material -> Set(mining)
for (const r of db.records) {
  if (db.structs[r.structIndex]?.name !== 'HarvestableProviderPreset') continue;
  const f = norm(r.fileName);
  const sys = sysFromPath(f); if (!sys) continue;
  const system = { stanton: 'Stanton', pyro: 'Pyro', nyx: 'Nyx' }[sys];
  const name = locName(r.name, f);
  const rawLow = String(r.name || '').toLowerCase();
  const type = /_belt\b/.test(rawLow) ? 'belt' : /hpp_(?:stanton|pyro)\d+[a-z]/.test(rawLow) ? 'moon' : typeFromPath(f);
  nLoc++;
  const o = db.readRecord(r, { maxDepth: 4 });
  for (const g of o.harvestableGroups || []) {
    const mining = MINING[g.groupName]; if (!mining) continue;
    const els = (g.harvestables || []).map((h) => ({ h: gnorm(h.harvestable?.__ref), rp: h.relativeProbability || 0 })).filter((e) => e.h);
    const tot = els.reduce((s, e) => s + e.rp, 0); if (!tot) continue;
    for (const e of els) {
      const parts = resolveParts(e.h);
      if (!parts) { nUnresolved++; continue; }
      const depositPct = (e.rp / tot) * 100;
      if (depositPct <= 0) { nZeroProb++; continue; }  // Deposit mit rp=0 spawnt nie
      // Ein Element kann in DERSELBEN Komposition mehrfach stehen (mehrere
      // compositionArray-Eintraege auf dasselbe mineableElement). Seine
      // Auftrittswahrscheinlichkeit darf pro Deposit trotzdem nur EINMAL zaehlen —
      // sonst summiert sich chance ueber 100 (gemessen: Daymar 104,3 %).
      const perEl = new Map();
      for (const part of parts) {
        const mat = matByGuid.get(part.el); if (!mat) continue;
        perEl.set(mat, Math.max(perEl.get(mat) ?? 0, part.max));
      }
      for (const [mat, maxPct] of perEl) {
        (matMethods[mat] ??= new Set()).add(mining);
        const k = `${mat}|${system}|${name}|${mining}`;
        const cur = agg.get(k) || { material: mat, location: name, system, type, mining, chance: 0, maxShare: 0, eff: 0, deposits: 0 };
        cur.chance += depositPct;
        cur.maxShare = Math.max(cur.maxShare, maxPct);
        cur.eff += depositPct * (maxPct / 100);
        cur.deposits++;
        agg.set(k, cur);
      }
    }
  }
}
// Rundung erst NACH der Aggregation — sonst summieren sich Rundungsfehler auf.
// maxShare auf 1 Nachkommastelle: die Rohwerte sind Floats (z. B. 74.30000305175781),
// frueher auf ganze Zahlen gerundet, was Praezision ohne Not verworfen hat.
const r1 = (n) => +n.toFixed(1);
// NICHT auf 100 kappen: chance > 100 waere ein Rechenfehler, und eine stille Kappung
// wuerde ihn verstecken statt melden. Innerhalb einer Gruppe summieren sich die
// Deposit-Wahrscheinlichkeiten auf 100, also ist jede Teilmenge davon <= 100.
const overflow = [];
for (const v of agg.values()) {
  if (v.chance > 100.05) overflow.push(`${v.material} @ ${v.location} (${v.mining}): ${v.chance.toFixed(1)} %`);
  v.chance = r1(v.chance); v.maxShare = r1(v.maxShare); v.eff = r1(v.eff);
}
if (overflow.length) {
  console.error(`FEHLER: ${overflow.length} Aggregat(e) mit chance > 100 %:`);
  for (const s of overflow.slice(0, 10)) console.error('  ' + s);
  process.exit(1);
}

const TYPE_PREF = { belt: 0, cluster: 1, lagrange: 2, planet: 3, moon: 4, cave: 5, event: 6, special: 7 };
const cmp = (a, b) => (b.eff - a.eff) || ((TYPE_PREF[a.type] ?? 9) - (TYPE_PREF[b.type] ?? 9)) || a.location.localeCompare(b.location);

// BEIDE Sichten stammen aus derselben aggregierten Menge — sie koennen sich damit
// nicht mehr widersprechen. Frueher wurden sie getrennt aufgebaut (elemLoc/bodyFull)
// und zusaetzlich die Element-Sicht auf Top-5 je System gekappt; dadurch fehlte dort
// knapp die Haelfte aller (Element, Fundort)-Paare.
const all = [...agg.values()];
const byMat = new Map();
const byBody = new Map();
for (const v of all) {
  (byMat.get(v.material) ?? byMat.set(v.material, []).get(v.material)).push(v);
  const bk = `${v.system}|${v.location}`;
  (byBody.get(bk) ?? byBody.set(bk, { system: v.system, body: v.location, type: v.type, mats: [] }).get(bk)).mats.push(v);
}

const locFields = (x) => ({ location: x.location, system: x.system, type: x.type, mining: x.mining, chance: x.chance, maxShare: x.maxShare, eff: x.eff });
function allLocs(mat) { return (byMat.get(mat) || []).slice().sort(cmp).map(locFields); }

const outMats = [...byMat.keys()].sort();
console.log(`Fundorte: ${nLoc} Provider-Presets, ${outMats.length} Elemente mit Fundorten`);
console.log(`  Paare (Element x Fundort x Methode): ${all.length}, davon aus mehreren Deposits: ${all.filter((v) => v.deposits > 1).length}`);
if (nUnresolved) console.log(`  ! ${nUnresolved} Deposit(s) ohne aufloesbare Komposition uebersprungen`);

const bodies = [...byBody.values()].map((b) => ({
  system: b.system, body: b.body, type: b.type,
  minerals: b.mats.slice().sort((x, y) => (y.chance - x.chance) || x.material.localeCompare(y.material))
    .map((v) => ({ name: v.material, chance: v.chance, maxShare: v.maxShare, eff: v.eff, mining: v.mining })),
}));
const out = { source: 'Star Citizen Data.p4k -> Game2.dcb (DataCore v8, node-nativ) — eigene Extraktion, kein scmdb', chain: 'providerpreset -> harvestablepreset -> mineablerock -> composition -> element', counts: { locations: nLoc, elements: outMats.length, bodies: bodies.length, pairs: all.length }, elements: outMats.map((m) => ({ material: m, methods: [...(matMethods[m] || [])], locations: allLocs(m) })), bodies };
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`Geschrieben: ${OUT}`);

/* ---- Gegenprobe gegen scmdb 4.9 ----
   Beide Seiten werden IDENTISCH aggregiert (Chance summiert, Anteil maximiert, je
   Deposit pro Element nur EIN Beitrag) und ueber die volle Menge verglichen.
   Zwei Fassungen sind hier schon gescheitert, beide durch eine Asymmetrie:
   - Die erste leitete scmdb mit derselben "bestes Deposit"-Auswahl ab und verglich
     nur die Top-5 je System — sie pruefte die eigene Kappung gegen sich selbst.
   - Die zweite deduplizierte nur UNSERE Seite und liess die Vergleichsseite jeden
     compositionArray-Eintrag zaehlen. Ergebnis: 31 von 33 Elementen als abweichend
     gemeldet, samt und sonders Fehlalarm (nachgeprueft an scmdb.net selbst, 6/6
     Stichproben gleich). Eine Gegenprobe, die auf beiden Seiten anders rechnet,
     misst ihre eigene Asymmetrie — nicht die Daten.
   Verglichen wird ein Multiset aus (System, Chance, Anteil), nicht ueber Fundort-Namen:
   scmdb benennt Orte anders als unsere kuratierte Starmap-Zuordnung, und es fasst
   Cluster/Lagrange/Guertel zusammen, wo wir einzeln fuehren. */
if (VERIFY) {
  const BASE = 'https://scmdb.net/data';
  const H = { 'User-Agent': 'sc-patch-archiv fan site (non-commercial)', Accept: 'application/json' };
  const getJSON = async (u) => { const r = await fetch(u, { headers: H }); if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`); return r.json(); };
  const versions = await getJSON(`${BASE}/versions.json`);
  const live = versions.find((v) => /-live/i.test(v.version));
  const data = await getJSON(`${BASE}/mining_data-${live.version}.json`);
  console.log(`\nVERIFY gegen scmdb ${live.version} …`);
  const sAgg = new Map(); // element|location -> {system, chance, maxShare}
  for (const loc of data.locations || []) for (const grp of loc.groups || []) {
    const tot = (grp.deposits || []).reduce((s, d) => s + (d.relativeProbability || 0), 0); if (!tot) continue;
    for (const d of grp.deposits || []) {
      const comp = data.compositions[d.compositionGuid]; if (!comp?.parts) continue;
      const dp = (d.relativeProbability || 0) / tot * 100;
      /* ⚠⚠ Auch HIER je Deposit pro Element deduplizieren — exakt wie oben auf
         unserer Seite. Ohne das zaehlte die Gegenprobe die Wahrscheinlichkeit
         eines Elements so oft, wie es in der Komposition steht (57 der 249
         Kompositionen fuehren eines mehrfach, z. B. RareShipMineables_Beryl mit
         11,7 % + 88,3 %). Sie meldete dadurch 31 von 33 Elementen als abweichend
         — alles Fehlalarm: scmdb.net zeigt in seiner Oberflaeche exakt unsere
         Werte (Beryl @ Aaron Halo 18,0 %, Ice @ Clio 40,0 %). */
      const perEl = new Map();
      for (const p of comp.parts) {
        const en = cleanMat(String(p.elementName || '').replace(/\s*\((?:Ore|Raw|Pure)\)\s*$/i, '').trim()); if (!en) continue;
        perEl.set(en, Math.max(perEl.get(en) ?? 0, p.maxPercent ?? 0));
      }
      for (const [en, mx] of perEl) {
        const k = `${en}|${loc.locationName}`;
        const cur = sAgg.get(k) || { element: en, system: loc.system, location: loc.locationName, chance: 0, maxShare: 0 };
        cur.chance += dp;
        cur.maxShare = Math.max(cur.maxShare, mx);
        sAgg.set(k, cur);
      }
    }
  }
  /* NICHT auf 100 kappen. Die fruehere Kappung war kein Schutz, sondern die
     Tarnung des Zaehlfehlers darueber: eine Wahrscheinlichkeit, die gekappt
     werden MUSS, ist falsch gerechnet. Bleibt eine ueber 100, ist das ein
     Befund und gehoert gemeldet — wie auf unserer Seite auch. */
  const sOver = [];
  for (const v of sAgg.values()) {
    if (v.chance > 100.05) sOver.push(`${v.element} @ ${v.location ?? '?'}: ${v.chance.toFixed(1)} %`);
    v.chance = r1(v.chance); v.maxShare = r1(v.maxShare);
  }
  if (sOver.length) console.log(`  ! Vergleichsseite: ${sOver.length} Aggregat(e) ueber 100 % — ${sOver.slice(0, 3).join(', ')}`);
  const sByMat = new Map();
  for (const v of sAgg.values()) (sByMat.get(v.element) ?? sByMat.set(v.element, []).get(v.element)).push(v);
  const key = (l) => `${l.system}:${l.chance}:${l.maxShare}`;
  const sig = (arr) => arr.map(key).sort().join(',');
  /* Multiset-Differenz statt Gleichheit. scmdb fuehrt Orte, die es aus den
     Spieldaten NICHT ableiten kann und selbst als Schaetzung kennzeichnet
     ("Based on personal guesstimate, not game data" — Breaker Stations, Nyx),
     dazu Hoehlen-Zuordnungen ohne Record und Deposits mit Wahrscheinlichkeit 0.
     Sind unsere Eintraege darin restlos enthalten, ist das kein Widerspruch,
     sondern eine Obermenge — und muss von einer echten Wertabweichung
     unterscheidbar bleiben, sonst ertrinkt der eine Befund im Rauschen. */
  const fehlt = (vonArr, inArr) => {
    const zaehl = new Map();
    for (const l of inArr) zaehl.set(key(l), (zaehl.get(key(l)) || 0) + 1);
    const out = [];
    for (const l of vonArr) { const k = key(l); const n = zaehl.get(k) || 0; if (n > 0) zaehl.set(k, n - 1); else out.push(l); }
    return out;
  };
  /* Vorgefuehrt rot am 15.08.2026: Beryls erster Fundort um 7 Punkte verfaelscht
     -> "identisch 25, scmdb-Obermenge 7, echte Abweichung 1". Die Unterscheidung
     erkennt also einen falschen WERT, ohne an den 7 Zusatzorten haengenzubleiben. */
  let ok = 0, ober = 0, diff = 0; const oberDet = [], details = [];
  for (const m of outMats) {
    const s = sByMat.get(m); if (!s) continue;
    const meins = byMat.get(m) || [];
    if (sig(meins) === sig(s)) { ok++; continue; }
    const unsereFehlenDort = fehlt(meins, s);   // haben wir, scmdb nicht -> echter Widerspruch
    const nurBeiScmdb = fehlt(s, meins);        // hat scmdb zusaetzlich
    if (!unsereFehlenDort.length) {
      ober++;
      if (oberDet.length < 8) oberDet.push(`    ${m}: +${nurBeiScmdb.map((l) => `${l.system} ${l.chance} %${l.location ? ' (' + l.location + ')' : ''}`).join(', ')}`);
    } else {
      diff++;
      if (details.length < 10) details.push(`  ${m}:\n    game : ${sig(meins)}\n    scmdb: ${sig(s)}`);
    }
  }
  console.log(`  (System, Chance, Anteil)-Multiset ueber ALLE Fundorte: identisch ${ok}, scmdb-Obermenge ${ober}, echte Abweichung ${diff}`);
  if (oberDet.length) { console.log('  scmdb fuehrt zusaetzliche Fundorte (Schaetzung/Hoehle/Wahrscheinlichkeit 0 — kein Widerspruch):'); console.log(oberDet.join('\n')); }
  if (details.length) { console.log('  ECHTE Abweichungen:'); console.log(details.join('\n')); }
}
