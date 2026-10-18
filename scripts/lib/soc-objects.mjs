// Leser für die Objekte einer CryEngine-.soc (Star Citizen, socpak-Inhalt),
// die StarBreaker im socpak-Export nicht oder nur ohne Lage ausgibt.
//
// Eine .soc ist eine Chunk-Datei (CrCh): Zahl der Chunks bei +8, Tabelle bei
// +12, je Eintrag 16 Byte (Typ, Version, Größe, Versatz). Der Chunk 0x10010
// („IncludedObjects“) beginnt mit 256-Byte-Pfadtabellen — erst die
// Geometrien (.cgf/.cga), dann die Materialien — und enthält danach die
// Objektsätze:
//   Typ 1 (Brush, 208 Byte): u32 1 | 6 double Weltbox | u32 | u32 | u16
//     cgf-Index (+60) | u16 | 12 double Zeilenmatrix 3×4 im Container-Raum
//     (+64; Spalten = lokale Achsen samt Maßstab, letzte Spalte = Lage) | …
//     | u16 Material-Überschreibung (+170, 0xffff = Material der .cgf)
//   Typ 0x10 (Decal, 132 Byte): u32 0x10 | 6 double Weltbox | u32 | u32 |
//     u32 | 4 double Drehung (x, y, z, w; +64) | 3 double Lage (+96) |
//     double Halbmaß (+120) | u32, untere 16 Bit Materialindex (+128)
// Container-Raum: Z oben; glTF = (x, z, −y). Die Weltbox liegt im Raum der
// ganzen Spielwelt; ihr Versatz zum Container-Raum folgt aus einem Decal
// (Box-Mitte = Lage + Versatz).
import { inflateRawSync } from 'node:zlib';

export function readZip(buf) {
  const files = new Map();
  let eocd = buf.length - 22;
  while (eocd > 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  let p = buf.readUInt32LE(eocd + 16);
  const n = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nl);
    const data = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(data, data + csize);
    files.set(name, () => (method === 8 ? inflateRawSync(raw) : raw));
    p += 46 + nl + xl + cl;
  }
  return files;
}

export function chunks(b) {
  if (b.toString('latin1', 0, 4) !== 'CrCh') return [];
  const cnt = b.readUInt32LE(8), tab = b.readUInt32LE(12), out = [];
  for (let i = 0; i < cnt; i++) { const o = tab + i * 16; out.push({ type: b.readUInt32LE(o), size: b.readUInt32LE(o + 8), off: b.readUInt32LE(o + 12) }); }
  return out;
}

const GEO = /\.(cgf|cga|cdf|chr|skin)$/i;
const validBox = (box, flat = false) => box.every((v) => Number.isFinite(v) && Math.abs(v) < 1e7)
  && box[0] < box[3] && box[1] < box[4] && (flat ? box[2] <= box[5] : box[2] < box[5]);

export function socObjects(b) {
  const inc = chunks(b).find((c) => c.type === 0x10010);
  if (!inc) return { cgfs: [], materials: [], brushes: [], decals: [] };
  const c0 = inc.off, c1 = inc.off + inc.size;
  const name = (o) => b.toString('latin1', o, o + 256).split('\0')[0];
  const isName = (t) => /^[\x20-\x7e]{4,}$/.test(t);
  let cg0 = 0;
  for (let o = c0; o < c1; o += 4) if (GEO.test(name(o)) && !isName(name(o - 256))) { cg0 = o; break; }
  const cgfs = []; for (let o = cg0; cg0 && isName(name(o)); o += 256) cgfs.push(name(o));
  const materials = [];
  for (let o = c0; o < c1 - 256; o += 4) {
    const t = name(o);
    if (isName(t) && !GEO.test(t) && /^(materials|objects)\//i.test(t) && !(isName(name(o - 256)) && !GEO.test(name(o - 256)))
      && isName(name(o + 256)) && !GEO.test(name(o + 256))) {
      for (let p = o; isName(name(p)); p += 256) materials.push(name(p));
      break;
    }
  }
  const brushes = [], decals = [];
  // ein Decal reicht bis o + 132, das letzte darf genau an der Chunkgrenze enden
  for (let o = c0; o <= c1 - 132; o += 4) {
    const t = b.readUInt32LE(o);
    if (t !== 1 && t !== 0x10) continue;
    const box = [0, 1, 2, 3, 4, 5].map((k) => b.readDoubleLE(o + 4 + k * 8));
    if (t === 1) {
      if (o + 208 > c1 || !validBox(box, true)) continue;
      const cgf = cgfs[b.readUInt16LE(o + 60)];
      if (!cgf) continue;
      const m = [...Array(12)].map((_, k) => b.readDoubleLE(o + 64 + k * 8));
      if (m.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e6)) continue;
      const mi = b.readUInt16LE(o + 170);
      brushes.push({ cgf, m, box, material: mi === 0xffff ? null : materials[mi] ?? null });
    } else {
      if (!validBox(box)) continue;
      const q = [0, 1, 2, 3].map((k) => b.readDoubleLE(o + 64 + k * 8));
      if (Math.abs(Math.hypot(...q) - 1) > 1e-3) continue;
      const pos = [0, 1, 2].map((k) => b.readDoubleLE(o + 96 + k * 8));
      decals.push({ material: materials[b.readUInt32LE(o + 128) & 0xffff] ?? null, q, pos, half: b.readDoubleLE(o + 120), box });
    }
  }
  return { cgfs, materials, brushes, decals };
}

// Versatz Weltbox -> Container-Raum aus den Decals (Median)
export function worldOffset(decals) {
  if (!decals.length) return null;
  const d = decals.map((x) => [0, 1, 2].map((i) => (x.box[i] + x.box[i + 3]) / 2 - x.pos[i]));
  const med = (a) => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  return [0, 1, 2].map((i) => med(d.map((v) => v[i])));
}
