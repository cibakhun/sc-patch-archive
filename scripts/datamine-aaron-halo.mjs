// datamine-aaron-halo.mjs — Aaron-Halo-Geometrie 100% aus den Spieldateien.
//
// Die radiale Ausdehnung und die vertikale Dicke des Aaron-Halo sind im Spiel
// als Object-Container definiert (nicht bloß community-vermessen):
//   Data/ObjectContainers/PU/system/stanton/aaronhalo.socpak
//     -> aaronhalo.xml            (ObjectContainer: min/maxBounds, in Metern)
//     -> metadata/…gotopoint.xml  (CryXmlB: GoTo InnerEdge / Middle / OuterEdge)
//
// Ausgabe: assets/aaron-halo-gamefiles.json — von src/data/precision-jump.ts
// als game-sourced Referenz-Hülle genutzt (die feinen 10 Dichtebänder bleiben
// die cstone-Community-Vermessung, liegen aber innerhalb dieser Spiel-Grenzen).
//
// Aufruf: node scripts/datamine-aaron-halo.mjs [--p4k <Data.p4k>]
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'aaron-halo-gamefiles.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Minimaler Zip-Reader (Central Directory) für den socpak-Container.
function readSocpak(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('socpak: kein EOCD');
  const files = {};
  let p = buf.readUInt32LE(eocd + 16);
  while (p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50) {
    const method = buf.readUInt16LE(p + 10);
    const cs = buf.readUInt32LE(p + 20);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const nm = buf.toString('utf8', p + 46, p + 46 + nl);
    const lnl = buf.readUInt16LE(lho + 26), lxl = buf.readUInt16LE(lho + 28);
    const raw = buf.subarray(lho + 30 + lnl + lxl, lho + 30 + lnl + lxl + cs);
    files[nm] = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    p += 46 + nl + xl + cl;
  }
  return files;
}

const p4kPath = argOf('--p4k') ?? DEFAULT_P4K;
const t0 = Date.now();
const p4k = openP4k(p4kPath);
const pak = p4k.read(/objectcontainers[\\/]pu[\\/]system[\\/]stanton[\\/]aaronhalo\.socpak$/i);
p4k.close();
const files = readSocpak(pak);

// 1) ObjectContainer-Bounds (aaronhalo.xml, Klartext, Meter)
const xml = files[Object.keys(files).find((n) => /(^|\/)aaronhalo\.xml$/i.test(n))].toString('utf8');
const maxB = /maxBounds="([^"]+)"/.exec(xml)?.[1].split(',').map(Number) ?? [];
const minB = /minBounds="([^"]+)"/.exec(xml)?.[1].split(',').map(Number) ?? [];
const clInfo = /editorBuildChangelist="(\d+)"/.exec(xml)?.[1] ?? null;
const outerRadiusM = Math.abs(maxB[0]);        // radiale Ausdehnung in der Ebene
const halfThicknessM = Math.abs(maxB[2]);      // vertikale Halbdicke (Z)

// 2) GoTo-Punkte (CryXmlB): Pos-Strings "N,0,0" im Halo-Bereich, sortiert
const goto = Object.keys(files).find((n) => /gotopoint\.xml$/i.test(n));
const gbuf = files[goto].toString('latin1');
const edges = [...gbuf.matchAll(/(-?\d{9,})(?:\.\d+)?,0,0/g)]
  .map((m) => Number(m[1]))
  .filter((v) => v > 1.9e10 && v < 2.2e10);
const uniq = [...new Set(edges)].sort((a, b) => a - b);
const [innerEdgeM, middleM, outerEdgeM] = uniq;

const km = (m) => Math.round(m / 1000);
const out = {
  source: 'Star Citizen Data.p4k -> ObjectContainers/PU/system/stanton/aaronhalo.socpak (aaronhalo.xml bounds + gotopoint) — eigene Extraktion',
  editorBuildChangelist: clInfo,
  units: 'km',
  innerEdgeKm: km(innerEdgeM),
  middleKm: km(middleM),
  outerEdgeKm: km(outerEdgeM),
  outerRadiusKm: km(outerRadiusM),
  verticalHalfThicknessKm: km(halfThicknessM),
  raw: { minBoundsM: minB, maxBoundsM: maxB, gotoM: uniq },
};

writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`Aaron-Halo (Spieldaten, ${Date.now() - t0} ms):`);
console.log(`  Inner edge : ${out.innerEdgeKm.toLocaleString('en-US')} km`);
console.log(`  Middle     : ${out.middleKm.toLocaleString('en-US')} km`);
console.log(`  Outer edge : ${out.outerEdgeKm.toLocaleString('en-US')} km  (bounds ${out.outerRadiusKm.toLocaleString('en-US')} km)`);
console.log(`  Half-thick : ${out.verticalHalfThicknessKm.toLocaleString('en-US')} km`);
console.log(`Geschrieben: ${OUT}`);
