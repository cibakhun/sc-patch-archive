// Hardpoint-Positions-Extraktion aus den lokalen Spieldateien (Data.p4k).
//
// Hintergrund: KEINE Community-API liefert die echten 3D-Positionen der
// verbauten Komponenten (Wiki-API "position" ist ein nie gefülltes String-
// Label; scunpacked/ScDataDumper lesen nur DataCore-XML, die Transforms
// liegen aber als Helper-Bones in der kompilierten Geometrie (.cga)).
// Dieser Extraktor liest sie direkt aus dem p4k: Zip64-Central-Directory
// -> Schiffs-.cga (zstd, Node-nativ) -> #ivo COMPILED_BONES-Chunk ->
// hardpoint_*-Helper mit Welt-Transform in Metern (schiffslokal).
//
// Koordinaten-Konvention (CryEngine/StarEngine, validiert an Corsair+Gladius):
//   +X = Steuerbord, +Y = Bug (vorn), +Z = oben; Einheit Meter; Origin ~Schiffsmitte.
//   Validierung: Haupttriebwerke achtern, Radar im Bug, L/R-Paare spiegeln in X,
//   Parent-Chain-Rekomposition == gespeicherte Welt-Transforms (< 5e-6 m).
//
// Usage:  node scripts/extract-hardpoints.mjs            (Patch-Day-Buildstep)
//         SC_P4K=<pfad> node scripts/extract-hardpoints.mjs
// Output: src/data/ship-hardpoints.json (committeter Snapshot — die Live-Site
//         liest nie das p4k; nur abgeleitete Koordinaten landen im Repo).
import { openSync, readSync, fstatSync, existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { zstdDecompressSync } from 'node:zlib';
import { createDecipheriv } from 'node:crypto';

const P4K = process.env.SC_P4K ?? 'F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k';
const OUT = new URL('../src/data/ship-hardpoints.json', import.meta.url);
const VEHICLES = new URL('../src/data/vehicles.json', import.meta.url);

if (!existsSync(P4K)) {
  console.error(`Data.p4k nicht gefunden: ${P4K} — SC_P4K setzen oder SC installieren.`);
  process.exit(1);
}

/* ---------- p4k lesen (Zip64) ---------- */
const fd = openSync(P4K, 'r');
const p4kSize = fstatSync(fd).size;

function readAt(pos, len) {
  const buf = Buffer.alloc(len);
  let done = 0;
  while (done < len) {
    const n = readSync(fd, buf, done, len - done, pos + done);
    if (n <= 0) throw new Error(`short read @${pos + done}`);
    done += n;
  }
  return buf;
}

// EOCD -> Zip64-Locator -> Zip64-EOCD -> Central Directory
console.log(`p4k: ${P4K} (${(p4kSize / 2 ** 30).toFixed(1)} GiB)`);
const tailLen = Math.min(131072, p4kSize);
const tail = readAt(p4kSize - tailLen, tailLen);
let eocd = -1;
for (let i = tailLen - 22; i >= 0; i--) {
  if (tail.readUInt32LE(i) === 0x06054b50) { eocd = p4kSize - tailLen + i; break; }
}
if (eocd < 0) throw new Error('kein EOCD — kein Zip?');
const loc = readAt(eocd - 20, 20);
if (loc.readUInt32LE(0) !== 0x07064b50) throw new Error('kein Zip64-Locator');
const z64 = readAt(Number(loc.readBigUInt64LE(8)), 56);
const cdSize = Number(z64.readBigUInt64LE(40));
const cdOff = Number(z64.readBigUInt64LE(48));
console.log(`central directory: ${(cdSize / 2 ** 20).toFixed(0)} MiB, ${z64.readBigUInt64LE(32)} Einträge — scanne .cga …`);

// allocUnsafe: die Schleife überschreibt garantiert jedes Byte (short read wirft)
const cd = Buffer.allocUnsafe(cdSize);
{
  const CHUNK = 64 * 1024 * 1024;
  let done = 0;
  while (done < cdSize) {
    const n = readSync(fd, cd, done, Math.min(CHUNK, cdSize - done), cdOff + done);
    if (n <= 0) throw new Error('short CD read');
    done += n;
  }
}

// alle .cga-Einträge einsammeln (Fahrzeug-Geometrie; Skeleton/Bones inklusive)
const cgas = [];
{
  let p = 0;
  while (p + 46 <= cdSize) {
    if (cd.readUInt32LE(p) !== 0x02014b50) break;
    const method = cd.readUInt16LE(p + 10);
    let csize = cd.readUInt32LE(p + 20);
    let usize = cd.readUInt32LE(p + 24);
    const nameLen = cd.readUInt16LE(p + 28);
    const extraLen = cd.readUInt16LE(p + 30);
    const commentLen = cd.readUInt16LE(p + 32);
    let lho = cd.readUInt32LE(p + 42);
    // Namen erst grob filtern (Bytes), dann dekodieren — spart ~1.3M Decodes
    const nameEnd = p + 46 + nameLen;
    if (nameLen > 4 && cd[nameEnd - 4] === 0x2e /* . */) {
      const c1 = cd[nameEnd - 3] | 32, c2 = cd[nameEnd - 2] | 32, c3 = cd[nameEnd - 1] | 32;
      if (c1 === 0x63 && c2 === 0x67 && c3 === 0x61 /* cga */) {
        const name = cd.toString('utf8', p + 46, nameEnd);
        // Zip64-Extra: 32-bit-Überläufe auflösen
        let ep = nameEnd;
        const eend = ep + extraLen;
        while (ep + 4 <= eend) {
          const id = cd.readUInt16LE(ep);
          const sz = cd.readUInt16LE(ep + 2);
          if (id === 0x0001) {
            let q = ep + 4;
            if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(q)); q += 8; }
            if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(q)); q += 8; }
            if (lho === 0xffffffff) { lho = Number(cd.readBigUInt64LE(q)); q += 8; }
          }
          ep += 4 + sz;
        }
        cgas.push({ name, method, csize, usize, lho });
      }
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
}
console.log(`.cga-Dateien im p4k: ${cgas.length}`);

/* ---------- Slug -> .cga-Datei auflösen ---------- */
// Wiki-Slugs sind bereits maker-geprefixt (drak-corsair) und die cga-Basenamen
// folgen demselben Schema (DRAK_Corsair.cga) -> Normalisierung matcht direkt.
const base = (n) => n.slice(n.lastIndexOf('\\') + 1).replace(/\.cga$/i, '');
const norm = (s) => s.toLowerCase().replace(/_/g, '-');
// Schadens-/LOD-/Wrack-Varianten sind keine Quell-Geometrie
const JUNK = /_(dmg|damage|wreck|debris|broken|lod\d*|proxy|shadow|interior_?props?)($|_)/i;

const byNorm = new Map();
for (const e of cgas) {
  if (JUNK.test(base(e.name))) continue;
  const k = norm(base(e.name));
  const cur = byNorm.get(k);
  // bei Basename-Kollision gewinnt der Eintrag unter Spaceships/GroundVehicles
  if (!cur || /\\(spaceships|groundvehicles)\\/i.test(e.name) && !/\\(spaceships|groundvehicles)\\/i.test(cur.name)) {
    byNorm.set(k, e);
  }
}

// bekannte Abweichungen Wiki-Slug <-> Datei-Name (Wortstellung/Umbenennungen,
// geteilte Rümpfe bei Serien — empirisch gegen den 4.8-p4k-Bestand ermittelt)
const SLUG_ALIAS = {
  'anvl-c8-pisces': 'anvl-pisces',
  'anvl-c8r-pisces': 'anvl-pisces',
  'anvl-c8x-pisces-expedition': 'anvl-pisces',
  'anvl-lightning-f8c': 'anvl-lightning-f8',
  'anvl-lightning-f8c-exec': 'anvl-lightning-f8',
  'krig-l22-alphawolf': 'krig-l22-alpha-wolf',
  // P72 teilt das Kruger-P-Airframe mit der P52 (eigene cga existiert nicht)
  'krig-p72-archimedes': 'krig-p52-merlin',
  'krig-p72-archimedes-emerald': 'krig-p52-merlin',
  // 100er-/300er-Serie: eine Hull-cga pro Serie
  'orig-125a': 'orig-100i',
  'orig-135c': 'orig-100i',
  'orig-315p': 'orig-300i',
  'orig-325a': 'orig-300i',
  'orig-350r': 'orig-300i',
  // Greycat MDC/MTC teilen die MXC-Plattform
  'grin-mdc': 'grin-mxc',
  'grin-mtc': 'grin-mxc',
  // Hornet Mk2: ANVL_Hornet_F7A.cga IST das Mk2-Airframe (Mk1 liegt separat
  // als ANVL_Hornet_F7A_MK1.cga); zivile Mk2 ohne eigene Hull -> F7A-Mk2-Hull
  'anvl-hornet-f7c-mk2': 'anvl-hornet-f7a',
  'anvl-hornet-f7cr-mk2': 'anvl-hornet-f7a',
  'anvl-hornet-f7cs-mk2': 'anvl-hornet-f7a',
  'anvl-hornet-f7cm-mk2-heartseeker': 'anvl-hornet-f7cm-mk2',
};

// Kandidaten-Schlüssel für einen Slug: exakt -> Token-Drop (Varianten-Basis)
// -> Familien-Suche (gleiche ersten zwei Tokens). Die eigentliche Auswahl
// trifft ein Qualitäts-Gate, das jeden Kandidaten wirklich parst — so kann
// nie wieder eine Sitz-/Tür-/Antennen-cga "gewinnen".
// Tiers: 1 = exakt/Alias, 2 = Token-Drop (Varianten-Basis), 3 = Familie.
// Frühere Tiers sind verwandtschaftlich näher und gewinnen bei Brauchbarkeit —
// so landet die Harbinger auf der Vanguard-Basis statt auf der Hoplite-cga.
function candidateKeys(slug) {
  const s = SLUG_ALIAS[slug] ?? slug;
  const keys = [];
  const seen = new Set();
  const push = (k, tier) => { if (k && byNorm.has(k) && !seen.has(k)) { seen.add(k); keys.push({ key: k, tier }); } };
  push(s, 1);
  const toks = s.split('-');
  for (let n = toks.length - 1; n >= 2; n--) push(toks.slice(0, n).join('-'), 2);
  if (toks.length >= 2) {
    const fam = `${toks[0]}-${toks[1]}`;
    const famKeys = [...byNorm.keys()]
      .filter((k) => k === fam || k.startsWith(fam + '-'))
      .sort((a, b) => a.length - b.length); // kürzester Name ≈ Rumpf, Teile sind länger
    for (const k of famKeys.slice(0, 10)) push(k, 3);
  }
  return keys;
}

/* ---------- Entry extrahieren (zstd / store / AES+zstd) ---------- */
function extractEntry(e) {
  const lh = readAt(e.lho, 30 + 1024);
  if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error('local header sig');
  const nameLen = lh.readUInt16LE(26);
  const extraLen = lh.readUInt16LE(28);
  const raw = readAt(e.lho + 30 + nameLen + extraLen, e.csize);
  if ((raw.readUInt32LE(0) >>> 0) === 0xfd2fb528) {
    return zstdDecompressSync(raw, { maxOutputLength: 1024 * 1024 * 1024 });
  }
  if (e.method === 0) return raw;
  // seltene AES-Einträge (unp4k-Standardschlüssel, Zero-IV), danach zstd
  const key = Buffer.from([0x5e, 0x7a, 0x20, 0x02, 0x30, 0x2e, 0xeb, 0x1a, 0x3b, 0xb6, 0x17, 0xc3, 0x0f, 0xde, 0x1e, 0x47]);
  const dec = createDecipheriv('aes-128-cbc', key, Buffer.alloc(16));
  dec.setAutoPadding(false);
  const padded = Buffer.concat([raw, Buffer.alloc((16 - (raw.length % 16)) % 16)]);
  return zstdDecompressSync(Buffer.concat([dec.update(padded), dec.final()]), { maxOutputLength: 1024 * 1024 * 1024 });
}

/* ---------- COMPILED_BONES parsen (#ivo, Chunk 0xC201973C) ---------- */
// Layout v0x901 (validiert; StarBreaker known_types.rs als Doku):
//   Header 48 B: u32 boneCount, u32 stringTableSize, …
//   boneCount × 16 B: u32 controllerId, u16 limbId, u16 numChildren, i16 parent, …
//   Nulltermininierte Namenstabelle (stringTableSize B)
//   boneCount × 28 B relative (qx qy qz qw tx ty tz, float)
//   boneCount × 28 B WELT-Transforms — direkt die schiffslokalen Positionen.
function parseBones(buf) {
  const magic = buf.toString('latin1', 0, 4);
  if (magic !== '#ivo') return { err: `magic:${magic}` };
  const nChunks = buf.readUInt32LE(8);
  const tab = buf.readUInt32LE(12);
  let chunkOff = null, chunkVer = 0, hullOff = null;
  for (let i = 0; i < nChunks; i++) {
    const p = tab + i * 16;
    const type = buf.readUInt32LE(p) >>> 0;
    if (type === 0xc201973c || type === 0xc2011111) {
      chunkVer = buf.readUInt32LE(p + 4);
      chunkOff = Number(buf.readBigUInt64LE(p + 8));
    } else if (type === 0x92914444) {
      hullOff = Number(buf.readBigUInt64LE(p + 8));
    }
  }
  if (chunkOff == null) return { err: 'no-bones-chunk' };
  if (chunkVer !== 0x901) return { err: `ver:0x${chunkVer.toString(16)}` };

  // Hull-AABB: Chunk 0x92914444 trägt bei +24 min/max des Modells (empirisch,
  // gegen reale Schiffsmaße validiert: Corsair 31/53/26 vs. 30/53/25 m)
  let hull = null;
  if (hullOff != null && hullOff + 48 <= buf.length) {
    const v = [0, 1, 2, 3, 4, 5].map((k) => buf.readFloatLE(hullOff + 24 + 4 * k));
    const ext = [v[3] - v[0], v[4] - v[1], v[5] - v[2]];
    if (v.every((x) => Number.isFinite(x) && Math.abs(x) < 5000) && ext.every((e) => e > 0.5 && e < 1200)) {
      hull = [[v[0], v[1], v[2]], [v[3], v[4], v[5]]];
    }
  }

  let p = chunkOff;
  const count = buf.readUInt32LE(p);
  const strTab = buf.readUInt32LE(p + 4);
  if (count === 0 || count > 100000) return { err: `count:${count}` };
  p += 48;
  const parents = new Array(count);
  for (let i = 0; i < count; i++) {
    parents[i] = buf.readInt16LE(p + 8);
    p += 16;
  }
  const names = [];
  {
    let start = p;
    for (let q = p; q < p + strTab && names.length < count; q++) {
      if (buf[q] === 0) { names.push(buf.toString('latin1', start, q)); start = q + 1; }
    }
  }
  p += strTab;
  p += count * 28; // relative Transforms überspringen
  const nodes = new Array(count);
  for (let i = 0; i < count; i++) {
    nodes[i] = {
      name: names[i] ?? `?${i}`,
      parent: parents[i],
      x: buf.readFloatLE(p + 16),
      y: buf.readFloatLE(p + 20),
      z: buf.readFloatLE(p + 24),
    };
    p += 28;
  }
  return { nodes, hull };
}

/* ---------- Hardpoints klassifizieren ---------- */
// Kategorien, die das Datenblatt/der Holo-Viewer kennt. Reihenfolge = Priorität.
const KINDS = [
  ['quantum', /quantum_?drive|hardpoint_quantum(?!_fuel)/i],
  ['power', /power_?plant/i],
  ['shield', /shield_?gen/i],
  ['cooler', /cooler/i],
  ['radar', /radar/i],
  ['fuel', /fuel_?(tank|intake|port)|quantum_fuel|hydrogen/i],
  ['thruster_main', /(main_?thruster|thruster_main|engine(?!er))/i],
  ['thruster_retro', /retro/i],
  ['thruster_vtol', /vtol/i],
  ['thruster_mav', /thruster/i], // Rest der Thruster = Manövrierdüsen
  ['turret', /turret/i],
  ['missile', /missile|torpedo|bomb/i],
  ['weapon', /weapon|_gun(_|$)|cannon/i],
  ['countermeasure', /counter_?measure|cm_?launcher/i],
];
// Neben-Hardpoints sind KEINE verbauten Kern-Komponenten: Steuerpanels
// (controller_cooler), Cockpit-/Gunner-Sensoren (cockpit_radar, radar_gunner),
// Turm-Zielradare (radar_turret_*). Extern gegen die SC-Wiki-Loadouts
// abgeglichen — ohne diese Filterung zählt der Corsair 4 statt 1 Radar.
const CORE_KIND = new Set(['power', 'shield', 'cooler', 'quantum', 'radar']);
const SECONDARY_HP = /controller|cockpit|gunner|co[_-]?pilot|_screen|screen|remote_|_turret_/i;
function kindOf(name) {
  if (!/^hardpoint/i.test(name)) return null;
  for (const [k, re] of KINDS) {
    if (!re.test(name)) continue;
    // Kern-Komponenten nur als PRIMÄRES Mount zählen (Datenblatt-Loadout)
    if (CORE_KIND.has(k) && SECONDARY_HP.test(name)) return null;
    return k;
  }
  return null; // Türen, Sitze, Lampen, Landing Gear … — nicht relevant
}

/* ---------- Hauptlauf ---------- */
const catalog = JSON.parse(readFileSync(VEHICLES, 'utf8'));
const ships = {};
const failed = [];
let extracted = 0;

const CORE_KINDS = new Set(['power', 'shield', 'cooler', 'quantum', 'radar']);
// Parse-Cache: Serien teilen sich eine Hull-cga (Idris, Connie, 300er …)
const parseCache = new Map();
function parsedFor(e) {
  if (!parseCache.has(e.name)) {
    try {
      parseCache.set(e.name, parseBones(extractEntry(e)));
    } catch (err) {
      parseCache.set(e.name, { err: `extract:${err.message}` });
    }
  }
  return parseCache.get(e.name);
}
// Qualität eines Kandidaten: Kern-Komponenten zählen am meisten, dann
// Hardpoints überhaupt, dann Skeleton-Größe. Sitz-/Tür-cgas landen bei ~0.
function scoreParsed(parsed) {
  if (parsed.err) return { score: -1, core: 0, hp: 0 };
  let hp = 0, core = 0;
  for (const n of parsed.nodes) {
    const k = kindOf(n.name);
    if (!k) continue;
    hp++;
    if (CORE_KINDS.has(k)) core++;
  }
  const score = core * 100 + Math.min(hp, 40) + Math.min(parsed.nodes.length, 400) / 100;
  return { score, core, hp };
}

for (const v of catalog.vehicles) {
  // pro Tier: bester Kandidat MIT Kern-Komponenten gewinnt sofort; brauchbare
  // Kandidaten ohne Kern (ATLS & Co.) werden als Fallback gemerkt — es gewinnt
  // dann der Fallback aus dem frühesten Tier.
  let best = null;
  let fallback = null;
  let curTier = 0;
  for (const { key, tier } of candidateKeys(v.id)) {
    if (best && tier > curTier) break; // Tier fertig + Treffer mit Kern -> stopp
    curTier = tier;
    const e = byNorm.get(key);
    const parsed = parsedFor(e);
    const q = scoreParsed(parsed);
    // Gate: ein echter Rumpf hat ein nennenswertes Skeleton und Hardpoints
    if (parsed.err || parsed.nodes.length < 30 || q.hp < 1) continue;
    if (q.core > 0) {
      if (!best || (best.tier === tier && q.score > best.q.score)) best = { key, tier, e, parsed, q };
    } else if (!fallback) {
      fallback = { key, tier, e, parsed, q };
    }
  }
  best = best ?? fallback;
  if (!best) {
    // erwartbar für Konzeptschiffe ohne Spieldateien
    failed.push({ id: v.id, name: v.name, status: v.statusEn ?? v.statusDe, reason: 'no-cga' });
    continue;
  }
  const hit = { e: best.e, how: best.key === v.id ? 'exact' : (SLUG_ALIAS[v.id] === best.key ? `alias:${best.key}` : `shared:${best.key}`) };
  const { nodes } = best.parsed;
  // Bounding-Box über ALLE Nodes (Kalibrier-Referenz fürs Mesh-Mapping)
  const bbox = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (const n of nodes) {
    bbox[0][0] = Math.min(bbox[0][0], n.x); bbox[0][1] = Math.min(bbox[0][1], n.y); bbox[0][2] = Math.min(bbox[0][2], n.z);
    bbox[1][0] = Math.max(bbox[1][0], n.x); bbox[1][1] = Math.max(bbox[1][1], n.y); bbox[1][2] = Math.max(bbox[1][2], n.z);
  }
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const hp = [];
  for (const n of nodes) {
    const k = kindOf(n.name);
    if (!k) continue;
    hp.push({ n: n.name, k, p: [r3(n.x), r3(n.y), r3(n.z)] });
  }
  ships[v.id] = {
    cga: hit.e.name.replace(/\\/g, '/'),
    match: hit.how,
    bones: nodes.length,
    bbox: bbox.map((c) => c.map(r3)),
    /** echte Hull-AABB aus der Geometrie (Kalibrier-Anker fürs Mesh-Mapping) */
    hull: best.parsed.hull ? best.parsed.hull.map((c) => c.map(r3)) : null,
    hp,
  };
  extracted++;
  const core = hp.filter((h) => CORE_KINDS.has(h.k)).length;
  console.log(`  ${v.id.padEnd(38)} ${String(nodes.length).padStart(4)} nodes, ${String(hp.length).padStart(3)} hp (${core} core) [${hit.how}]`);
}

/* ---------- Report + Snapshot ---------- */
console.log(`\nextrahiert: ${extracted}/${catalog.vehicles.length}`);
if (failed.length) {
  console.log(`fehlgeschlagen/ohne Spieldateien: ${failed.length}`);
  for (const f of failed) console.log(`  - ${f.id} (${f.reason}${f.status ? `, ${f.status}` : ''})`);
}
if (extracted < 50) {
  console.error('unter 50 Schiffen — Snapshot wird NICHT überschrieben (Fail-safe).');
  process.exit(1);
}

// Build-Kennung aus dem LIVE-Ordner, wenn greifbar
let build = null;
try {
  const mf = P4K.replace(/Data\.p4k$/i, 'build_manifest.id');
  if (existsSync(mf)) {
    const j = JSON.parse(readFileSync(mf, 'utf8'));
    build = j?.Data?.RequestedP4ChangeNum ? `${j.Data.Branch ?? ''}@${j.Data.RequestedP4ChangeNum}` : (j?.Data?.Branch ?? null);
  }
} catch { /* optional */ }

const snapshot = {
  fetchedAt: new Date().toISOString().slice(0, 10),
  source: 'Lokale Spieldateien (Data.p4k, COMPILED_BONES-Helper der Schiffs-.cga) — nur abgeleitete Koordinaten, keine Assets',
  build,
  axes: 'CryEngine schiffslokal, Meter: +X Steuerbord, +Y Bug, +Z oben',
  count: extracted,
  ships,
};
await writeFile(OUT, JSON.stringify(snapshot) + '\n', 'utf8');
console.log(`\nwrote src/data/ship-hardpoints.json (${extracted} Schiffe, build ${build ?? '?'})`);
