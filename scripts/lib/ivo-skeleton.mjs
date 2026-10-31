// Skelett einer IVO-.chr (Star Citizen): Chunk 0xC201973C (COMPILED_BONES,
// v0x901), Layout wie in scripts/extract-hardpoints.mjs:
//   Header 48 B: u32 Knochenzahl, u32 Größe der Namenstabelle, …
//   je Knochen 16 B: u32 controllerId (CRC32 des Namens), u16, u16, i16 Eltern, …
//   Namenstabelle (nullterminiert)
//   je Knochen 28 B relativ zum Eltern (qx qy qz qw tx ty tz, float)
//   je Knochen 28 B im Modellraum
//
// v0x900 (Fahrwerks-.chr): u32 Knochenzahl, dann je Knochen 68 B: u32
// controllerId, u32, i32 Eltern, relativ (q 16 B, t 12 B), Modellraum (q, t);
// danach die Namen, über controllerId = CRC32(Name) zugeordnet.
import { crc32 } from 'node:zlib';
export function readSkeleton(buf) {
  if (buf.toString('latin1', 0, 4) !== '#ivo') throw new Error('kein IVO');
  const n = buf.readUInt32LE(8), tab = buf.readUInt32LE(12);
  let off = null, ver = 0;
  for (let i = 0; i < n; i++) { const p = tab + i * 16; const t = buf.readUInt32LE(p) >>> 0; if (t === 0xc201973c || t === 0xc2011111) { off = Number(buf.readBigUInt64LE(p + 8)); ver = buf.readUInt32LE(p + 4); } }
  if (off == null) throw new Error('kein Skelett-Chunk');
  if (ver === 0x900) {
    const count = buf.readUInt32LE(off);
    let p = off + 4;
    const q4 = (o) => [0, 1, 2, 3].map((j) => buf.readFloatLE(o + j * 4)), t3 = (o) => [0, 1, 2].map((j) => buf.readFloatLE(o + j * 4));
    const bones = [];
    for (let i = 0; i < count; i++, p += 68) bones.push({ id: buf.readUInt32LE(p) >>> 0, parent: buf.readInt32LE(p + 8), rel: { q: q4(p + 12), t: t3(p + 28) }, world: { q: q4(p + 40), t: t3(p + 56) } });
    const byId = new Map(bones.map((b) => [b.id, b]));
    for (const m of buf.toString('latin1', p).matchAll(/[\x21-\x7e]{2,}(?=\0)/g)) { const b = byId.get(crc32(Buffer.from(m[0])) >>> 0) || byId.get(crc32(Buffer.from(m[0].toLowerCase())) >>> 0); if (b && !b.name) b.name = m[0]; }
    return bones;
  }
  if (ver !== 0x901) throw new Error(`Skelett-Version 0x${ver.toString(16)}`);
  const count = buf.readUInt32LE(off), strTab = buf.readUInt32LE(off + 4);
  let p = off + 48;
  const bones = [];
  for (let i = 0; i < count; i++) { bones.push({ id: buf.readUInt32LE(p) >>> 0, parent: buf.readInt16LE(p + 8) }); p += 16; }
  let s = p, k = 0;
  for (let q = p; q < p + strTab && k < count; q++) if (buf[q] === 0) { bones[k++].name = buf.toString('latin1', s, q); s = q + 1; }
  p += strTab;
  const tr = () => { const v = [0, 1, 2, 3, 4, 5, 6].map((j) => buf.readFloatLE(p + j * 4)); p += 28; return { q: v.slice(0, 4), t: v.slice(4) }; };
  for (const b of bones) b.rel = tr();
  for (const b of bones) b.world = tr();
  return bones;
}

// 4×4 (spaltenweise) aus Quaternion (x, y, z, w) und Lage
export function trs(q, t) {
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, t[0], t[1], t[2], 1];
}
