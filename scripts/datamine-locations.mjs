// Voll-Extraktion der Fundort-Ebene aus den Spieldateien (kein scmdb):
// providerpresets(Location) -> harvestablepresets -> rock(MineableParams) -> composition -> element/max%.
// Baut element->locations (eff-Ranking top-5/System) wie scmdbs Modell und validiert dagegen.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, basename, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2];
if (!ROOT) { console.error('Usage: node scripts/datamine-locations.mjs <EXTRACT_DATA_DIR> [--verify]'); process.exit(2); }
const REC = join(ROOT, 'libs', 'foundry', 'records');
const MODEL = resolve(__dirname, '..', 'assets', 'mining-model.json');
const OUT = resolve(__dirname, '..', 'assets', 'mining-locations-gamefiles.json');
const attr = (s, a) => { const m = new RegExp(`\\b${a}="([^"]*)"`).exec(s); return m ? m[1] : undefined; };
function walk(d) { const o = []; for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) o.push(...walk(p)); else if (e.name.endsWith('.xml')) o.push(p); } return o; }

// Indizes
const rockByRef = new Map(); // entityClass ref -> {composition, sig}
for (const p of walk(join(REC, 'entities', 'mineable'))) {
  const xml = readFileSync(p, 'utf8'); const ref = attr(xml, '__ref'); if (!ref) continue;
  const mp = /<MineableParams\b[^>]*composition="([^"]+)"/.exec(xml);
  const sigBlk = /<SSCSignatureSystemBaseSignatureParams>[\s\S]*?<\/SSCSignatureSystemBaseSignatureParams>/.exec(xml);
  let sig = null; if (sigBlk) { const v = [...sigBlk[0].matchAll(/value="([\d.]+)"/g)].map((m) => +m[1]).filter((x) => x > 0); sig = v[0] ?? null; }
  if (mp) rockByRef.set(ref, { composition: mp[1], sig });
}
const hpresetByRef = new Map();
for (const p of walk(join(REC, 'harvestable', 'harvestablepresets'))) { const xml = readFileSync(p, 'utf8'); const ref = attr(xml, '__ref'); const ec = attr(xml, 'entityClass'); if (ref && ec) hpresetByRef.set(ref, ec); }
const compByRef = new Map();
for (const p of walk(join(REC, 'mining', 'rockcompositionpresets'))) { const xml = readFileSync(p, 'utf8'); const ref = attr(xml, '__ref'); if (!ref) continue; compByRef.set(ref, [...xml.matchAll(/<MineableCompositionPart\b[^>]*>/g)].map((m) => ({ el: attr(m[0], 'mineableElement'), max: +attr(m[0], 'maxPercentage') }))); }
const matByRef = new Map();
const edir = join(REC, 'mining', 'mineableelements');
for (const f of readdirSync(edir)) { if (!f.endsWith('.xml')) continue; const xml = readFileSync(join(edir, f), 'utf8'); const ref = attr(xml, '__ref'); if (!ref) continue; let n = f.replace('.xml', '').replace(/^minableelement_(fps|groundvehicle)_/, '').replace(/_(ore|raw)$/, ''); const map = { aluminium: 'Aluminum', sileron: 'Stileron', carinitepure: 'Carinite' }; matByRef.set(ref, map[n] || (n[0].toUpperCase() + n.slice(1))); }
const resolveParts = (hguid) => { const ec = hpresetByRef.get(hguid); if (!ec) return null; const rock = rockByRef.get(ec); if (!rock) return null; return compByRef.get(rock.composition) || null; };

const MINING = { SpaceShip_Mineables: 'ship', SpaceShip_Mineables_Rare: 'ship', FPS_Mineables: 'fps', GroundVehicle_Mineables: 'roc', Harvestables: 'harvest' };
// Location-Name aus Preset ableiten (Datei-/Recordname -> lesbarer Name)
function locName(recName, file) {
  let n = recName || basename(file, '.xml');
  const raw = n;
  n = n.replace(/^HarvestableProviderPreset\./, '');
  const low = n.toLowerCase();
  const M = {
    hpp_aaronhalo: 'Aaron Halo', asteroidcluster_low_yield: 'Asteroid Cluster (Low Yield)', asteroidcluster_medium_yield: 'Asteroid Cluster (Medium Yield)',
    hpp_lagrange_occupied: 'Lagrange (Occupied)', hpp_nyx_keegerbelt: 'Keeger Belt', hpp_nyx_glaciemring: 'Glaciem Ring',
    hpp_pyro_akirocluster: 'Akiro Cluster', hpp_pyro_deepspaceasteroids: 'Pyro Deep Space Asteroids',
  };
  if (M[low]) return M[low];
  let m;
  if ((m = /^hpp_lagrange_([a-g])$/.exec(low))) return 'Lagrange ' + m[1].toUpperCase();
  if ((m = /^hpp_pyro_warm0?(\d)$/.exec(low))) return 'Pyro Belt (Warm ' + m[1] + ')';
  if ((m = /^hpp_pyro_cool0?(\d)$/.exec(low))) return 'Pyro Belt (Cool ' + m[1] + ')';
  return raw; // planets/moons (hpp_stantonN...) -> via Fingerprint validiert, Name später gemappt
}
const sysFromPath = (p) => (/[\\/]system[\\/](stanton|pyro|nyx)[\\/]/i.exec(p) || [])[1];
const typeFromPath = (p, name) => { if (/asteroidcluster/i.test(p)) return 'cluster'; if (/lagrange/i.test(p)) return 'lagrange'; if (/asteroidfield/i.test(p)) return 'belt'; return 'planet'; };

// Provider-Presets parsen -> element -> [{location,system,type,abundance,eff}]
const elemLoc = {}; // material -> Map(locKey -> {location,system,type,abundance,eff})
const providerDir = join(REC, 'harvestable', 'providerpresets', 'system');
let nLoc = 0;
for (const p of walk(providerDir)) {
  const xml = readFileSync(p, 'utf8');
  const sys = sysFromPath(p); if (!sys) continue;
  const system = { stanton: 'Stanton', pyro: 'Pyro', nyx: 'Nyx' }[sys];
  const recName = (/<HarvestableProviderPreset\.([^\s]+)/.exec(xml) || [])[1];
  const name = locName(recName, p);
  const type = typeFromPath(p, name);
  nLoc++;
  for (const g of xml.matchAll(/<HarvestableElementGroup\b[^>]*groupName="([^"]+)"[^>]*>([\s\S]*?)<\/HarvestableElementGroup>/g)) {
    const mining = MINING[g[1]]; if (!mining) continue; // skip Salvage_*
    const els = [...g[2].matchAll(/<HarvestableElement\b[^>]*>/g)].map((m) => ({ h: attr(m[0], 'harvestable'), rp: +attr(m[0], 'relativeProbability') })).filter((e) => e.h);
    const tot = els.reduce((s, e) => s + (e.rp || 0), 0); if (!tot) continue;
    for (const e of els) {
      const parts = resolveParts(e.h); if (!parts) continue;
      const depositPct = (e.rp / tot) * 100;
      for (const part of parts) {
        const mat = matByRef.get(part.el); if (!mat) continue;
        const ab = Math.round(part.max); const eff = depositPct * (part.max / 100);
        (elemLoc[mat] ??= new Map());
        const k = name + '|' + system;
        const cur = elemLoc[mat].get(k);
        if (!cur || cur.eff < eff) elemLoc[mat].set(k, { location: name, system, type, mining, abundance: ab, eff });
      }
    }
  }
}

// eff-Ranking top-5/System (wie fetch-scmdb-model.mjs)
const TYPE_PREF = { belt: 0, cluster: 1, lagrange: 2, planet: 3, moon: 4, cave: 5, event: 6, special: 7 };
const cmp = (a, b) => (b.eff - a.eff) || ((TYPE_PREF[a.type] ?? 9) - (TYPE_PREF[b.type] ?? 9)) || a.location.localeCompare(b.location);
function topLocs(mat) { const all = [...(elemLoc[mat]?.values() || [])]; const bySys = {}; for (const x of all) (bySys[x.system] ??= []).push(x); const out = []; for (const s of Object.keys(bySys)) out.push(...bySys[s].sort(cmp).slice(0, 5)); return out.sort(cmp); }

console.log(`Locations geparst: ${nLoc} | Elemente mit Fundorten: ${Object.keys(elemLoc).length}`);

// Validierung gegen scmdb: pro Element die Menge {system+abundance} der Top-Locations vergleichen
// (Location-NAME kann bei Planeten abweichen -> daher Vergleich per (system,abundance)-Multiset)
const model = JSON.parse(readFileSync(MODEL, 'utf8'));
let ok = 0, diff = 0; const details = [];
for (const el of model.elements) {
  if (!el.material || !elemLoc[el.material]) continue;
  const mine = topLocs(el.material);
  const sig = (arr) => arr.map((l) => `${l.system}:${l.abundance}`).sort().join(',');
  const a = sig(mine), b = sig(el.locations || []);
  if (a === b) ok++; else { diff++; if (details.length < 12) details.push(`${el.material}:\n   game : ${mine.map((l) => l.location + '(' + l.system + ',' + l.abundance + ')').join(', ')}\n   scmdb: ${(el.locations || []).map((l) => l.location + '(' + l.system + ',' + l.abundance + ')').join(', ')}`); }
}
console.log(`\nValidierung (system+abundance-Multiset der Top-5/System): OK ${ok}, abweichend ${diff}`);
if (details.length) console.log(details.join('\n'));

// Ausgabe: element -> game-extrahierte Fundorte (eff-Ranking top-5/System)
const outMats = Object.keys(elemLoc).sort();
const out = { source: 'Star Citizen Data.p4k (unp4k+unforge) — eigene Extraktion, kein scmdb', chain: 'providerpreset -> harvestablepreset -> mineablerock(MineableParams) -> composition -> element', counts: { locations: nLoc, elements: outMats.length }, elements: outMats.map((m) => ({ material: m, locations: topLocs(m) })) };
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`\nGeschrieben: ${OUT} (${outMats.length} Elemente, ${nLoc} Locations)`);
