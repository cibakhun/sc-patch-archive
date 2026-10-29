// Alle Hangar-Schiffe mit Werkslack und Fahrwerk (.planning/notes/
// hangar-alle-schiffe.md, Teil B): baut jedes Schiff aus dem Rohbestand über
// scripts/build-hangar-assets.mjs (--kind ships --ships <slug>), Schiff für
// Schiff in der Reihenfolge des Auftrags, und hält den Stand in
// .cache/hangar-src/alle-stand.json (ein neuer Lauf setzt dort fort).
//
// Je Schiff höchstens 16 MB (GLB plus neu in der Ablage); darüber in dieser
// Folge: Innenraum weg, auch hinter dem Glas, Farbkarten 512 px, WebP-Qualität
// 72, stärker dezimiert.
//
// --kind interior (.planning/notes/hangar-innenleben.md): begehbare Innenräume,
// public/hangar/interior/<slug>.glb, Stand in alle-innen.json; Stufen gegen
// die 16 MB: Farbkarten 512 px, WebP-Qualität 72, stärker dezimiert.
//
// Usage: node scripts/build-hangar-alle.mjs [--kind interior] [--max <n>] [--only a,b] [--redo]
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const MAX = Number(arg('--max') ?? Infinity);
const ONLY = arg('--only')?.split(',') ?? null;
const REDO = argv.includes('--redo');
const INNER = arg('--kind') === 'interior', KIND = INNER ? 'interior' : 'ships';
const ROOT = new URL('../', import.meta.url);
const f = (p) => fileURLToPath(new URL(p, ROOT));
const STAND = f(`.cache/hangar-src/${INNER ? 'alle-innen' : 'alle-stand'}.json`);
const MANIFEST = f('src/data/hangar-assets.json');
const POOL = f('public/hangar/tex/');
const RAW = f('.cache/hangar-src/ships/');
const LIMIT = 16 * 1048576;

// Reihenfolge: die zehn bisherigen, dann die genannten, dann nach Länge, Bodenfahrzeuge zuletzt
const FIRST = ['drak-corsair', 'rsi-zeus-es', 'misc-prospector', 'aegs-sabre', 'crus-intrepid', 'drak-vulture', 'anvl-c8x-pisces-expedition', 'orig-400i', 'anvl-carrack', 'rsi-polaris'];
const vehicles = new Map(JSON.parse(readFileSync(f('src/data/vehicles.json'), 'utf8')).vehicles.map((v) => [v.id, v]));
const manifest0 = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const have = Object.keys(manifest0.ships || {});
const raw = readdirSync(RAW).filter((x) => x.endsWith('.glb')).map((x) => x.slice(0, -4));
const rest = raw.filter((s) => !have.includes(s) && !FIRST.includes(s));
// Bodenfahrzeuge wie in HangarApp.astro: auch die Gravlev-Räder (Krisz 25.10.2026)
const ground = (s) => vehicles.get(s)?.isSpaceship === false || vehicles.get(s)?.isGravlev === true;
rest.sort((a, b) => (ground(a) - ground(b)) || ((vehicles.get(a)?.lengthM ?? 999) - (vehicles.get(b)?.lengthM ?? 999)) || a.localeCompare(b));
// Innenräume: zuerst die fünf, an denen die Cloud das Einsteigen baut, dann die Web-Schiffe
const FIRST_INNER = ['gama-railen', 'misc-freelancer', 'drak-cutlass-black', 'anvl-carrack', 'rsi-constellation-andromeda'];
const order = (ONLY ?? (INNER ? [...FIRST_INNER, ...have] : [...have, ...FIRST.filter((s) => raw.includes(s)), ...rest])).filter((s, i, all) => all.indexOf(s) === i && raw.includes(s));

const stand = existsSync(STAND) ? JSON.parse(readFileSync(STAND, 'utf8')) : {};
const poolFiles = () => new Map(readdirSync(POOL).map((x) => [x, statSync(`${POOL}${x}`).size]));
// Stufe 2 (.planning/notes/hangar-cockpit-hohl.md): auch der Innenraum hinter
// dem Glas, bevor Karten kleiner werden
const NG = { HANGAR_SHIP_NO_INTERIOR: '1', HANGAR_SHIP_NO_GLASS_INTERIOR: '1' };
const STEPS = [{}, { HANGAR_SHIP_NO_INTERIOR: '1' }, NG, { ...NG, HANGAR_SHIP_TEX: '512' }, { ...NG, HANGAR_SHIP_TEX: '512', HANGAR_SHIP_Q: '72' },
  // über den Auftrag hinaus: stärker dezimieren (build-hangar-assets.mjs, HANGAR_SHIP_ERR)
  { ...NG, HANGAR_SHIP_TEX: '512', HANGAR_SHIP_Q: '72', HANGAR_SHIP_ERR: '1' },
  { ...NG, HANGAR_SHIP_TEX: '256', HANGAR_SHIP_Q: '72', HANGAR_SHIP_ERR: '1' }];
if (INNER) STEPS.splice(0, STEPS.length, {}, { HANGAR_SHIP_TEX: '512' }, { HANGAR_SHIP_TEX: '512', HANGAR_SHIP_Q: '72' }, { HANGAR_SHIP_TEX: '512', HANGAR_SHIP_Q: '72', HANGAR_SHIP_ERR: '1' }, { HANGAR_SHIP_TEX: '256', HANGAR_SHIP_Q: '72', HANGAR_SHIP_ERR: '1' });
let done = 0;
for (const slug of order) {
  if (done >= MAX) break;
  if (!REDO && stand[slug]?.ok && stand[slug].rawMtime === statSync(`${RAW}${slug}.glb`).mtimeMs) continue;
  const before = poolFiles();
  const t0 = Date.now();
  let entry = null, size = 0, step = 0, err = null;
  for (step = 0; step < STEPS.length; step++) {
    // Stufe 0 ohne mitgebrachte HANGAR_SHIP_*, sonst nennt step nicht, wie gebaut wurde
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^HANGAR_SHIP_/.test(k)));
    const r = spawnSync(process.execPath, ['--max-old-space-size=28000', f('scripts/build-hangar-assets.mjs'), '--kind', KIND, '--ships', slug, '--only', slug, '--force'], { env: { ...env, ...STEPS[step] }, encoding: 'utf8', maxBuffer: 1 << 28 });
    entry = JSON.parse(readFileSync(MANIFEST, 'utf8'))[KIND]?.[slug] ?? null;
    if (r.status !== 0 || !entry) { err = (r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | '); break; }
    const after = poolFiles();
    const fresh = [...after].filter(([k]) => !before.has(k)).reduce((a, [, b]) => a + b, 0);
    size = entry.bytes + fresh;
    if (size <= LIMIT || step === STEPS.length - 1) break;
    // Bilder des verworfenen Versuchs aus der Ablage, sonst zählen sie beim nächsten mit
    for (const [k] of after) if (!before.has(k)) unlinkSync(`${POOL}${k}`);
  }
  const s = Math.round((Date.now() - t0) / 1000);
  stand[slug] = err ? { ok: false, error: err, s } : {
    ok: true, rawMtime: statSync(`${RAW}${slug}.glb`).mtimeMs, bytes: entry.bytes, fresh: size - entry.bytes, total: size, over16: size > LIMIT,
    step: Math.min(step, STEPS.length - 1), tris: entry.tris, images: entry.pool?.images ?? null, interiorDropped: entry.interiorDropped ?? null,
    gear: !!entry.gear, gearWhy: entry.gear ? null : entry.gearCheck?.why ?? null, s,
    ...(INNER ? { containers: entry.containers, trisRaw: entry.trisInterior, lights: entry.lights?.length ?? 0, spots: entry.spots?.length ?? 0, inHull: entry.inHull?.ok ?? null, inHullWhy: entry.inHull?.why ?? null } : {}),
  };
  writeFileSync(STAND, JSON.stringify(stand, null, 1));
  done++;
  const x = stand[slug];
  if (INNER && x.ok) { console.log(`${slug.padEnd(34)} ${(x.total / 1048576).toFixed(1).padStart(5)} MB (GLB ${(x.bytes / 1048576).toFixed(1)}, neu ${(x.fresh / 1048576).toFixed(1)})  ${x.trisRaw} -> ${x.tris} Dr.  Stufe ${x.step}  ${x.containers} Container  ${x.lights} Lichter  ${x.spots} Punkte  im Rumpf ${x.inHull ? 'ja' : `NEIN (${x.inHullWhy})`}  ${s} s`); continue; }
  console.log(x.ok ? `${slug.padEnd(34)} ${(x.total / 1048576).toFixed(1).padStart(5)} MB (GLB ${(x.bytes / 1048576).toFixed(1)}, neu ${(x.fresh / 1048576).toFixed(1)})  ${String(x.tris).padStart(7)} Dr.  Stufe ${x.step}  Innenraum ${x.interiorDropped ? 'weg' : 'ja'}  gear ${x.gear ? 'ja' : `nein (${x.gearWhy})`}  ${s} s` : `${slug}: FEHLER ${x.error}`);
}
const ok = Object.values(stand).filter((x) => x.ok);
console.log(`Stand: ${ok.length} gebaut, ${Object.values(stand).filter((x) => !x.ok).length} Fehler, GLB ${(ok.reduce((a, x) => a + x.bytes, 0) / 1048576).toFixed(0)} MB, neu in der Ablage ${(ok.reduce((a, x) => a + x.fresh, 0) / 1048576).toFixed(0)} MB`);
