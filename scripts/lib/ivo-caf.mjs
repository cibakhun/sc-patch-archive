// Leser für Star-Citizen-Animationen im IVO-Format (.caf).
//
// Datei: "#ivo", u32 Version, u32 Chunkzahl, u32 Tabellenversatz; Tabelle je
// Chunk 16 Byte (u32 Typ, u32 Version, u64 Versatz). Der Info-Chunk
// 0x4733C6ED trägt bei +4 (relativ zum Chunk) Bilder/s und bei +0x10 die
// Bildzahl (so auch im Extraktor gelesen). Der Animations-Chunk 0xA9496CB5:
//   "#caf" | u16 Knochenzahl n | u16 | u32 | n × u32 Knochen-Hash (CRC32
//   des Knochennamens) | n × 24 Byte Controller:
//     u16 Drehschlüssel, u16 Format, u32 Zeitversatz, u32 Datenversatz,
//     u16 Positionsschlüssel, u16 Format, u32 Zeitversatz, u32 Datenversatz
//   (Versätze relativ zum Anfang des 24-Byte-Controllers).
// Format: unteres Byte = Zeitformat, oberes = Datenformat.
//   Zeit 0x41: u16 Bildnummer je Schlüssel
//   Zeit 0x42: u16 Anfang, u16 Ende, dann Bitfeld über die Bilder (Schlüssel
//              an jedem gesetzten Bit)
//   Position 0xC0: float x, y, z je Schlüssel
//   Position 0xC2: Kopf 3 float Skalierung, 3 float Versatz; Achsen mit
//              Skalierung FLT_MAX sind konstant (= Versatz), die übrigen
//              tragen je Schlüssel ein u16: Wert = Versatz + u16 · Skalierung;
//              die Kanäle liegen nacheinander (erst alle Schlüssel des ersten
//              laufenden Kanals, dann des nächsten)
//   Position 0xC1: derselbe Kopf, dann je Schlüssel drei u16 für x, y, z
//              (verschränkt, auch konstante Kanäle)
//   Beide Lesarten belegt am Fahrwerk (.dba): letztes Bild von extend =
//   erstes von compress, 79 von 79 Positionen.
//   Zeit 0x40: keine lesbare Zeitspur (der Versatz zeigt teils in fremde
//              Daten); Anfang und Ende der Werte sind trotzdem gültig
//   Drehung 0x82: 48-Bit-Quaternion je Schlüssel (6 Byte, „SmallTree48Bit“):
//              als 48-Bit-Zahl gelesen tragen Bit 46–47 den Index der
//              größten Komponente (x, y, z, w = 0…3), die drei übrigen
//              stehen in Reihenfolge zu je 15 Bit ab Bit 0:
//              Komponente = (Wert − 16383) / 23170,475 (= 16383·√2); die
//              größte = √(1 − Summe der Quadrate).
// Lage im Raum des Elternknochens, CryEngine-Achsen (Z oben).
import { crc32 } from 'node:zlib';

const FLT_MAX = 3.0e38;

function chunks(b) {
  if (b.toString('latin1', 0, 4) !== '#ivo') throw new Error('kein IVO');
  const n = b.readUInt32LE(8), tab = b.readUInt32LE(12), out = [];
  for (let i = 0; i < n; i++) { const o = tab + i * 16; out.push({ type: b.readUInt32LE(o), off: Number(b.readBigUInt64LE(o + 8)) }); }
  return out;
}

function times(b, p, count, fmt) {
  const tf = fmt & 0xff;
  if (tf === 0x41 || tf === 0x01) return [...Array(count)].map((_, k) => b.readUInt16LE(p + k * 2));
  if (tf === 0x42 || tf === 0x02) {
    const start = b.readUInt16LE(p), end = b.readUInt16LE(p + 2), out = [];
    for (let f = start; f <= end && out.length < count; f++) { const bit = f - start; if (b[p + 4 + (bit >> 3)] & (1 << (bit & 7))) out.push(f); }
    return out;
  }
  return null;
}

function positions(b, p, count, fmt) {
  const df = fmt >> 8;
  if (df === 0xc0) return [...Array(count)].map((_, k) => [0, 1, 2].map((i) => b.readFloatLE(p + k * 12 + i * 4)));
  // 0xC1: derselbe Kopf, dann je Schlüssel drei u16 (alle Kanäle, verschränkt).
  // Belegt am Fahrwerk: letztes Bild von extend = erstes von compress.
  if (df === 0xc1) {
    const sc = [0, 1, 2].map((i) => b.readFloatLE(p + i * 4)), off = [0, 1, 2].map((i) => b.readFloatLE(p + 12 + i * 4));
    return [...Array(count)].map((_, k) => [0, 1, 2].map((i) => off[i] + b.readUInt16LE(p + 24 + (k * 3 + i) * 2) * (sc[i] < FLT_MAX ? sc[i] : 0)));
  }
  if (df === 0xc2) {
    const sc = [0, 1, 2].map((i) => b.readFloatLE(p + i * 4)), off = [0, 1, 2].map((i) => b.readFloatLE(p + 12 + i * 4));
    const live = [0, 1, 2].filter((i) => sc[i] < FLT_MAX);
    return [...Array(count)].map((_, k) => [0, 1, 2].map((i) => {
      const j = live.indexOf(i);
      // Kanäle nacheinander (erst alle Schlüssel von y, dann von z), nicht verschränkt:
      // am Prospector-Fahrwerk ergibt nur das glatte Kurven
      return j < 0 ? off[i] : off[i] + b.readUInt16LE(p + 24 + (j * count + k) * 2) * sc[i];
    }));
  }
  return null;
}

function rotations(b, p, count, fmt) {
  if ((fmt >> 8) !== 0x82) return null;
  return [...Array(count)].map((_, k) => {
    const d = p + k * 6;
    const v = BigInt(b.readUInt16LE(d)) | (BigInt(b.readUInt16LE(d + 2)) << 16n) | (BigInt(b.readUInt16LE(d + 4)) << 32n);
    const idx = Number(v >> 46n);
    const q = [0, 0, 0, 0];
    let sh = 0n, sum = 0;
    for (let c = 0; c < 4; c++) { if (c === idx) continue; q[c] = (Number((v >> sh) & 0x7fffn) - 16383) / 23170.475; sh += 15n; sum += q[c] * q[c]; }
    q[idx] = Math.sqrt(Math.max(0, 1 - sum));
    return q;
  });
}

export function readCaf(buf, boneNames = []) {
  const cs = chunks(buf);
  const info = cs.find((c) => c.type === 0x4733c6ed), anim = cs.find((c) => c.type === 0xa9496cb5);
  const fps = info ? buf.readUInt16LE(info.off + 4) : null, frames = info ? buf.readUInt32LE(info.off + 0x10) : null;
  const o = anim.off;
  if (buf.toString('latin1', o, o + 4) !== '#caf') throw new Error('kein #caf');
  return { fps, frames, bones: readBlock(buf, o, boneNames) };
}

// Animations-Datenbank (.dba, $TracksDatabase der .chrparams): Chunk
// 0x194FBC50 trägt nacheinander Blöcke „#dba“, jeder aufgebaut wie der
// #caf-Block oben (Knochenzahl, Hashes, 24-Byte-Controller, Versätze relativ
// zum Controller). Am Dateiende stehen die Pfade der .caf, aus denen die
// Datenbank gebaut ist, in derselben Reihenfolge wie die Blöcke (Prospector:
// front_compress, front_extend, left_compress, …).
export function readDba(buf, boneNames = []) {
  if (buf.toString('latin1', 0, 4) !== '#ivo') throw new Error('kein IVO');
  const at = [];
  for (let p = buf.indexOf('#dba'); p >= 0; p = buf.indexOf('#dba', p + 4)) if (buf.readUInt16LE(p + 6) === 0xaa55) at.push(p);
  const names = [...buf.toString('latin1').matchAll(/[\w/.-]+\.caf(?=\0)/gi)].map((m) => m[0]);
  return at.map((o, i) => ({ name: names[i] ?? null, bones: readBlock(buf, o, boneNames) }));
}

function readBlock(buf, o, boneNames) {
  const n = buf.readUInt16LE(o + 4);
  const byHash = new Map();
  for (const nm of boneNames) for (const v of [nm, nm.toLowerCase()]) byHash.set(crc32(Buffer.from(v)) >>> 0, nm);
  const bones = [];
  for (let i = 0; i < n; i++) {
    const hash = buf.readUInt32LE(o + 12 + i * 4);
    const p = o + 12 + n * 4 + i * 24;
    const rk = buf.readUInt16LE(p), rf = buf.readUInt16LE(p + 2);
    const pk = buf.readUInt16LE(p + 12), pf = buf.readUInt16LE(p + 14), pto = buf.readUInt32LE(p + 16), pdo = buf.readUInt32LE(p + 20);
    const rto = buf.readUInt32LE(p + 4), rdo = buf.readUInt32LE(p + 8);
    const pos = pk ? { times: times(buf, p + pto, pk, pf), values: positions(buf, p + pdo, pk, pf), format: pf.toString(16) } : null;
    const rq = rk ? rotations(buf, p + rdo, rk, rf) : null;
    const rot = rk ? { keys: rk, times: times(buf, p + rto, rk, rf), values: rq, format: rf.toString(16), decoded: !!rq } : null;
    bones.push({ hash: hash.toString(16), name: byHash.get(hash) ?? null, pos, rot });
  }
  return bones;
}

// Drehung eines Kanals zum Bild f (normiertes lineares Mischen, kürzester Weg)
export function sampleRot(ch, f) {
  const t = ch.times, v = ch.values;
  const mix = (a, b, w) => { const d = a.reduce((s, x, i) => s + x * b[i], 0) < 0 ? -1 : 1; const q = a.map((x, i) => x + (d * b[i] - x) * w); const n = Math.hypot(...q) || 1; return q.map((x) => x / n); };
  if (f <= t[0]) return v[0];
  for (let k = 1; k < t.length; k++) if (f <= t[k]) return mix(v[k - 1], v[k], (f - t[k - 1]) / (t[k] - t[k - 1] || 1));
  return v[v.length - 1];
}

// Wert eines Positionskanals zum Bild f (linear zwischen Schlüsseln)
export function sample(ch, f) {
  const t = ch.times, v = ch.values;
  if (f <= t[0]) return v[0];
  for (let k = 1; k < t.length; k++) if (f <= t[k]) { const a = (f - t[k - 1]) / (t[k] - t[k - 1] || 1); return v[k].map((x, i) => v[k - 1][i] + (x - v[k - 1][i]) * a); }
  return v[v.length - 1];
}
