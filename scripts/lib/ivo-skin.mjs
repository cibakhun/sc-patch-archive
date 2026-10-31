// Leser für Star-Citizen-Netze mit Skin-Gewichten im IVO-Format (.skin/.skinm).
//
// .skin trägt die Knochentafel des Teils (Chunk 0xC2011111, Lesart wie in
// ivo-skeleton.mjs), den Materialnamen (0x83353333) und einen Kopf
// (0x92914444); die Geometrie steht in der .skinm im Chunk 0xB8757777:
//   u32 Flags | 76 B Netzinfo | 88 B Füllung | n × 48 B Teilnetz | Zusatzworte
//   | Datenströme bis zum Ende
// Netzinfo: u32 flags2, u32 Ecken, u32 Indizes, u32 Teilnetze, u32,
//   3 f32 Modell-min, 3 f32 Modell-max, 3 f32 Skalierungs-min, 3 f32
//   Skalierungs-max, u32 Eckformat, u32 Zahl der Zusatzworte.
// Teilnetz: u16 Material, u16 Knoten, u32 erster Index, u32 Indizes,
//   u32 erste Ecke, u32 Seitenbasis (zu jedem Index addieren), u32 Ecken,
//   f32 Radius, 3 f32 Mitte, 2 u32.
// Datenstrom: u32 Typ, u32 Elementgröße, Elemente (Ecken bzw. Indizes),
//   danach auf 8 Byte aufgefüllt; ein Typ 0 ist Füllung.
//   0x91329AE9 Ecken: 16 B (3 × SNorm-i16 Lage, u16, BGRA, 2 × half UV)
//              oder 20 B (3 × f32 Lage, BGRA, 2 × half UV)
//   0xEECDC168 Indizes (u16 oder u32)
//   0x9CF3F615 Normale, u32 gepackt (15-15-1-1)
//   0x38A581FE 12 B: Normale 3 × f32; 4 B: zweite UV
//   0xEE057252 Tangente und Bitangente, 2 × u32 gepackt
//   0xB95E9A1B Tangentenquaternion 4 × SNorm-i16
//   0x677C7B23 Gewichte 12 B: 4 × u16 Knochen (Index in die Tafel der .skin),
//              4 × u8 Gewicht (Summe 255)
//   0x6ECA3708 Gewichte 24 B: 8 × u16 Knochen, 8 × u8 Gewicht
// SNorm-Lage: v / 32767 · max(halbe Ausdehnung, 1) + Mitte der
// Skalierungsbox. Alles in CryEngine-Achsen (Z oben, Meter), Lage im Raum
// der Bindehaltung (Modellraum).
import { readSkeleton } from './ivo-skeleton.mjs';

function chunkTable(b) {
  if (b.toString('latin1', 0, 4) !== '#ivo') throw new Error('kein IVO');
  const n = b.readUInt32LE(8), tab = b.readUInt32LE(12), out = [];
  for (let i = 0; i < n; i++) { const o = tab + i * 16; out.push({ type: b.readUInt32LE(o) >>> 0, ver: b.readUInt32LE(o + 4), off: Number(b.readBigUInt64LE(o + 8)) }); }
  return out;
}

const half = (h) => {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
};
const unit = (v) => {
  const x = ((v & 0x7fff) - 0x3fff) / 16383, y = (((v >>> 15) & 0x7fff) - 0x3fff) / 16383;
  let z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  if ((v >>> 30) & 1) z = -z;
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

// Knochentafel der .skin (Namen in Reihenfolge der Gewichts-Indizes)
export function readSkinBones(skinBuf) {
  return readSkeleton(skinBuf);
}

export function readSkinMesh(skinmBuf) {
  const c = chunkTable(skinmBuf).find((x) => x.type === 0xb8757777);
  if (!c) throw new Error('kein Skin-Netz (0xB8757777)');
  const b = skinmBuf;
  let p = c.off;
  const flags = b.readUInt32LE(p); p += 4;
  const nV = b.readUInt32LE(p + 4), nI = b.readUInt32LE(p + 8), nS = b.readUInt32LE(p + 12);
  const f3 = (o) => [0, 1, 2].map((k) => b.readFloatLE(o + k * 4));
  const info = { flags, flags2: b.readUInt32LE(p), vertices: nV, indices: nI, submeshes: nS, modelMin: f3(p + 20), modelMax: f3(p + 32), min: f3(p + 44), max: f3(p + 56), extra: b.readUInt32LE(p + 72) };
  p += 76 + 88;
  const subs = [];
  for (let i = 0; i < nS; i++, p += 48) {
    subs.push({ mat: b.readUInt16LE(p), node: b.readUInt16LE(p + 2), firstIndex: b.readUInt32LE(p + 4), numIndices: b.readUInt32LE(p + 8), firstVertex: b.readUInt32LE(p + 12), pageBase: b.readUInt32LE(p + 16), numVertices: b.readUInt32LE(p + 20) });
  }
  p += info.extra * 4;
  const pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), col = new Uint8Array(nV * 4);
  let idx = null, nor = null, tan = null, joints = null, weights = null, uv2 = null, influences = 0;
  const seen = [];
  const end = b.length;
  while (p + 8 <= end) {
    const type = b.readUInt32LE(p) >>> 0;
    if (type === 0) { p += 4; continue; }
    const size = b.readUInt32LE(p + 4); p += 8;
    const start = p;
    seen.push(type.toString(16));
    if (type === 0x91329ae9 || type === 0xb3a70d5e) {
      for (let v = 0; v < nV; v++) {
        const o = p + v * size;
        if (size === 16) {
          for (let k = 0; k < 3; k++) {
            const s = b.readInt16LE(o + k * 2) / 32767, he = Math.max((info.max[k] - info.min[k]) / 2, 1), ce = (info.max[k] + info.min[k]) / 2;
            pos[v * 3 + k] = s * he + ce;
          }
          col.set([b[o + 10], b[o + 9], b[o + 8], b[o + 11]], v * 4);
          uv[v * 2] = half(b.readUInt16LE(o + 12)); uv[v * 2 + 1] = half(b.readUInt16LE(o + 14));
        } else if (size === 20) {
          for (let k = 0; k < 3; k++) pos[v * 3 + k] = b.readFloatLE(o + k * 4);
          col.set([b[o + 14], b[o + 13], b[o + 12], b[o + 15]], v * 4);
          uv[v * 2] = half(b.readUInt16LE(o + 16)); uv[v * 2 + 1] = half(b.readUInt16LE(o + 18));
        } else throw new Error(`Eckgröße ${size}`);
      }
      p += nV * size;
    } else if (type === 0xeecdc168) {
      idx = new Uint32Array(nI);
      for (let i = 0; i < nI; i++) idx[i] = size === 2 ? b.readUInt16LE(p + i * 2) : b.readUInt32LE(p + i * 4);
      p += nI * size;
    } else if (type === 0x9cf3f615) {
      nor = new Float32Array(nV * 3);
      for (let v = 0; v < nV; v++) nor.set(unit(b.readUInt32LE(p + v * 4)), v * 3);
      p += nV * size;
    } else if (type === 0x38a581fe) {
      if (size === 12) { nor = new Float32Array(nV * 3); for (let v = 0; v < nV * 3; v++) nor[v] = b.readFloatLE(p + v * 4); }
      else if (size === 4) { uv2 = new Float32Array(nV * 2); for (let v = 0; v < nV * 2; v++) uv2[v] = half(b.readUInt16LE(p + v * 2)); }
      p += nV * size;
    } else if (type === 0xee057252 && size === 8) {
      // Tangente und Bitangente gepackt; Normale = Tangente × Bitangente · Vorzeichen
      tan = new Float32Array(nV * 4);
      const nn = new Float32Array(nV * 3);
      for (let v = 0; v < nV; v++) {
        const a = b.readUInt32LE(p + v * 8), c2 = b.readUInt32LE(p + v * 8 + 4);
        const t = unit(a), s = unit(c2), sg = a & 0x80000000 ? -1 : 1;
        let nx = (t[1] * s[2] - t[2] * s[1]) * sg, ny = (t[2] * s[0] - t[0] * s[2]) * sg, nz = (t[0] * s[1] - t[1] * s[0]) * sg;
        const l = Math.hypot(nx, ny, nz) || 1;
        nn.set([nx / l, ny / l, nz / l], v * 3);
        tan.set([t[0], t[1], t[2], sg], v * 4);
      }
      if (!nor) nor = nn;
      p += nV * size;
    } else if ((type === 0xb95e9a1b || type === 0xee057252) && size === 8) {
      tan = new Float32Array(nV * 4);
      const nn = new Float32Array(nV * 3);
      for (let v = 0; v < nV; v++) {
        const [x, y, z, w] = [0, 1, 2, 3].map((k) => b.readInt16LE(p + v * 8 + k * 2) / 32767);
        let n = [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)];
        if (w < 0) n = n.map((q) => -q);
        const t = [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)];
        const ln = Math.hypot(...n) || 1, lt = Math.hypot(...t) || 1;
        nn.set(n.map((q) => q / ln), v * 3);
        tan.set([...t.map((q) => q / lt), w >= 0 ? 1 : -1], v * 4);
      }
      if (!nor) nor = nn;
      p += nV * size;
    } else if ((type === 0x677c7b23 && size === 12) || (type === 0x6eca3708 && size === 24)) {
      const k = size === 12 ? 4 : 8;
      influences = k;
      joints = new Uint16Array(nV * k); weights = new Uint8Array(nV * k);
      for (let v = 0; v < nV; v++) {
        const o = p + v * size;
        for (let j = 0; j < k; j++) { joints[v * k + j] = b.readUInt16LE(o + j * 2); weights[v * k + j] = b[o + k * 2 + j]; }
      }
      p += nV * size;
    } else {
      if (p + nV * size > end) break;
      p += nV * size;
    }
    const r = (p - start) % 8;
    if (r && p + (8 - r) <= end) p += 8 - r;
  }
  if (!idx) throw new Error('keine Indizes');
  for (const s of subs) if (s.pageBase) for (let i = s.firstIndex; i < s.firstIndex + s.numIndices; i++) idx[i] += s.pageBase;
  return { info, subs, pos, uv, uv2, col, nor, tan, idx, joints, weights, influences, streams: seen };
}

// Materialname der .skin (Pfad der .mtl ohne Endung)
export function readSkinMaterial(skinBuf) {
  const c = chunkTable(skinBuf).find((x) => x.type === 0x83353333);
  if (!c) return null;
  const s = skinBuf.toString('latin1', c.off, Math.min(skinBuf.length, c.off + 512));
  return (s.match(/[\x20-\x7e]{3,}/) || [null])[0];
}
