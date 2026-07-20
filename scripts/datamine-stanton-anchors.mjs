// datamine-stanton-anchors.mjs — QT-Anker-Koordinaten 100% aus den Spieldateien.
//
// Die Welt-Positionen der Stanton-Körper, -Monde und -Lagrange-Punkte liegen als
// Object-Container-Platzierungen (OOC_*) im System-Container:
//   Data/ObjectContainers/PU/system/stanton/stantonsystem.socpak
//     -> entdata/<id>.entxml  (CryXmlB: Name "OOC_…", Pos "x,y,z" in Metern)
// Jede OOC_-Entität ist eine platzierte Container-Instanz; die betragsgrößte
// Koordinaten-Tripel ist ihre Welt-Position.
//
// Namensschema:
//   OOC_Stanton_<N>_<Body>       Planet          (1 Hurston … 4 microTech)
//   OOC_Stanton_<N><a-d>_<Moon>  Mond
//   OOC_Stanton<N>_L<1-5>        Lagrange-Punkt
//
// Ausgabe: assets/stanton-anchors-gamefiles.json — von src/data/precision-jump.ts
// als BODY_CENTRES + LAGRANGE_CENTRES genutzt. Aufruf:
//   node scripts/datamine-stanton-anchors.mjs [--p4k <Data.p4k>]
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'stanton-anchors-gamefiles.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

function readSocpak(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('socpak: kein EOCD');
  const files = {}; let p = buf.readUInt32LE(eocd + 16);
  while (p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50) {
    const method = buf.readUInt16LE(p + 10), cs = buf.readUInt32LE(p + 20);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42), nm = buf.toString('utf8', p + 46, p + 46 + nl);
    const lnl = buf.readUInt16LE(lho + 26), lxl = buf.readUInt16LE(lho + 28);
    const raw = buf.subarray(lho + 30 + lnl + lxl, lho + 30 + lnl + lxl + cs);
    files[nm] = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    p += 46 + nl + xl + cl;
  }
  return files;
}

// Kuratierte Zuordnung Spiel-Container -> Anker (Anzeigename + Struktur).
const PLANET = {
  1: { key: 'hurston', name: 'Hurston', lg: 'HUR' },
  2: { key: 'crusader', name: 'Crusader', lg: 'CRU' },
  3: { key: 'arcCorp', name: 'ArcCorp', lg: 'ARC' },
  4: { key: 'microTech', name: 'microTech', lg: 'MIC' },
};
const MOON = {
  '1a': { key: 'arial', name: 'Arial' }, '1b': { key: 'aberdeen', name: 'Aberdeen' }, '1c': { key: 'magda', name: 'Magda' }, '1d': { key: 'ita', name: 'Ita' },
  '2a': { key: 'cellin', name: 'Cellin' }, '2b': { key: 'daymar', name: 'Daymar' }, '2c': { key: 'yela', name: 'Yela' },
  '3a': { key: 'lyria', name: 'Lyria' }, '3b': { key: 'wala', name: 'Wala' },
  '4a': { key: 'calliope', name: 'Calliope' }, '4b': { key: 'clio', name: 'Clio' }, '4c': { key: 'euterpe', name: 'Euterpe' },
};

const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
const t0 = Date.now();
const files = readSocpak(p4k.read(/objectcontainers[\\/]pu[\\/]system[\\/]stanton[\\/]stantonsystem\.socpak$/i));
p4k.close();

// Welt-Position einer Entität = betragsgrößtes (x,y,z)-Tripel im CryXmlB-Blob.
function worldPos(txt) {
  const tris = [...txt.matchAll(/(-?\d{4,}(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)]
    .map((m) => ({ x: +m[1], y: +m[2], z: +m[3] }))
    .filter((v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z));
  if (!tris.length) return null;
  return tris.reduce((a, b) => (Math.hypot(b.x, b.y) > Math.hypot(a.x, a.y) ? b : a));
}

const bodies = {};
const lagrange = {};
for (const n of Object.keys(files)) {
  if (!/\.entxml$/i.test(n)) continue;
  const txt = files[n].toString('latin1');
  const name = /(OOC_Stanton[_A-Za-z0-9]+)/.exec(txt)?.[1];
  if (!name) continue;
  let m;
  if ((m = /^OOC_Stanton_(\d)_[A-Za-z]+$/.exec(name))) {
    const pl = PLANET[+m[1]]; const p = worldPos(txt); if (!pl || !p) continue;
    bodies[pl.key] = { name: pl.name, type: 'planet', x: p.x, y: p.y, z: p.z };
  } else if ((m = /^OOC_Stanton_(\d)([a-d])_[A-Za-z]+$/.exec(name))) {
    const mo = MOON[m[1] + m[2]]; const pl = PLANET[+m[1]]; const p = worldPos(txt); if (!mo || !p) continue;
    bodies[mo.key] = { name: mo.name, type: 'moon', parent: pl.key, x: p.x, y: p.y, z: p.z };
  } else if ((m = /^OOC_Stanton(\d)_L([1-5])$/.exec(name))) {
    const pl = PLANET[+m[1]]; const p = worldPos(txt); if (!pl || !p) continue;
    lagrange[`${pl.lg.toLowerCase()}L${m[2]}`] = { name: `${pl.lg}-L${m[2]}`, parent: pl.key, x: p.x, y: p.y, z: p.z };
  }
}

const out = {
  source: 'Star Citizen Data.p4k -> ObjectContainers/PU/system/stanton/stantonsystem.socpak (OOC_* Object-Container-Platzierungen) — eigene Extraktion',
  system: 'Stanton',
  units: 'm',
  counts: { bodies: Object.keys(bodies).length, lagrange: Object.keys(lagrange).length },
  bodies,
  lagrange,
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`Stanton-Anker (Spieldaten, ${Date.now() - t0} ms): ${out.counts.bodies} Körper, ${out.counts.lagrange} Lagrange`);
for (const k of ['hurston', 'crusader', 'arcCorp', 'microTech']) console.log(`  ${bodies[k].name.padEnd(10)} (${bodies[k].x}, ${bodies[k].y}, ${bodies[k].z})`);
console.log(`Geschrieben: ${OUT}`);
