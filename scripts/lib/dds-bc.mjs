// DDS lesen und Blockformate entpacken (BC1, BC3, BC4, BC5), ohne fremde
// Werkzeuge. Star Citizen teilt große Bilder: die .dds trägt Kopf und die
// kleinsten Stufen, jede .dds.N genau eine größere Stufe (größeres N =
// größere Stufe). Welche Stufe ein Teil ist, ergibt sich aus seiner Größe.
//
// Kopf: "DDS ", 124 B (Höhe +12, Breite +16, Stufen +28, FourCC +84);
// FourCC "DX10" bringt 20 B mehr (DXGI-Format +128).
// DXGI: 71/72 BC1, 77/78 BC3, 80 BC4 UNORM, 81 BC4 SNORM, 83 BC5 UNORM,
// 84 BC5 SNORM. BC7 (98/99) liest es nicht.
const FOURCC = { DXT1: 'bc1', DXT3: 'bc2', DXT5: 'bc3', ATI1: 'bc4', BC4U: 'bc4', BC4S: 'bc4s', ATI2: 'bc5', BC5U: 'bc5', BC5S: 'bc5s' };
const DXGI = { 71: 'bc1', 72: 'bc1', 77: 'bc3', 78: 'bc3', 80: 'bc4', 81: 'bc4s', 83: 'bc5', 84: 'bc5s', 98: 'bc7', 99: 'bc7' };
const BLOCK = { bc1: 8, bc2: 16, bc3: 16, bc4: 8, bc4s: 8, bc5: 16, bc5s: 16, bc7: 16 };

const levelBytes = (fmt, w, h) => Math.max(1, Math.ceil(w / 4)) * Math.max(1, Math.ceil(h / 4)) * BLOCK[fmt];

// head: Inhalt der .dds; parts: { N: Inhalt der .dds.N } (fehlende erlaubt)
// -> { width, height, format, levels: [{ level, w, h, data }] } (größte zuerst)
// Der abgetrennte Alphakanal (.dds.a, Teile .dds.Na) hat denselben Kopf ohne
// die vier Bytes "DDS ".
export function readDds(head, parts = {}) {
  if (head.toString('latin1', 0, 4) !== 'DDS ') {
    if (head.readUInt32LE(0) !== 124) throw new Error('kein DDS');
    head = Buffer.concat([Buffer.from('DDS '), head]);
  }
  const height = head.readUInt32LE(12), width = head.readUInt32LE(16), count = Math.max(1, head.readUInt32LE(28));
  const cc = head.toString('latin1', 84, 88);
  let format = FOURCC[cc], off = 128;
  if (cc === 'DX10') { format = DXGI[head.readUInt32LE(128)]; off = 148; }
  if (!format) throw new Error(`DDS-Format ${cc === 'DX10' ? head.readUInt32LE(128) : cc}`);
  const dims = Array.from({ length: count }, (_, l) => [Math.max(1, width >> l), Math.max(1, height >> l)]);
  const levels = [];
  // Teile: jede Größe passt zu genau einer Stufe
  for (const buf of Object.values(parts)) {
    const l = dims.findIndex(([w, h]) => levelBytes(format, w, h) === buf.length);
    if (l >= 0) levels.push({ level: l, w: dims[l][0], h: dims[l][1], data: buf });
  }
  // Rest der .dds: die kleinsten Stufen, größte zuerst, bis zum Ende
  let rest = head.length - off, first = count;
  for (let l = count - 1, sum = 0; l >= 0; l--) {
    sum += levelBytes(format, ...dims[l]);
    if (sum > rest) break;
    if (sum === rest) { first = l; break; }
  }
  for (let l = first, p = off; l < count; l++) {
    const n = levelBytes(format, ...dims[l]);
    if (!levels.some((x) => x.level === l)) levels.push({ level: l, w: dims[l][0], h: dims[l][1], data: head.subarray(p, p + n) });
    p += n;
  }
  levels.sort((a, b) => a.level - b.level);
  return { width, height, format, levels };
}

function bc1Block(b, o, out, stride, x0, y0, w, h, alphaFree = true) {
  const c0 = b.readUInt16LE(o), c1 = b.readUInt16LE(o + 2), bits = b.readUInt32LE(o + 4);
  const rgb = (c) => [((c >> 11) & 31) * 255 / 31, ((c >> 5) & 63) * 255 / 63, (c & 31) * 255 / 31];
  const a = rgb(c0), c = rgb(c1), pal = [[...a, 255], [...c, 255]];
  if (c0 > c1 || !alphaFree) {
    pal.push([0, 1, 2].map((i) => (2 * a[i] + c[i]) / 3).concat(255), [0, 1, 2].map((i) => (a[i] + 2 * c[i]) / 3).concat(255));
  } else pal.push([0, 1, 2].map((i) => (a[i] + c[i]) / 2).concat(255), [0, 0, 0, 0]);
  for (let k = 0; k < 16; k++) {
    const x = x0 + (k & 3), y = y0 + (k >> 2);
    if (x >= w || y >= h) continue;
    const p = pal[(bits >>> (2 * k)) & 3], q = (y * stride + x) * 4;
    out[q] = p[0]; out[q + 1] = p[1]; out[q + 2] = p[2]; out[q + 3] = p[3];
  }
}

// ein BC4-Kanal: 8 B -> 16 Werte (0..1 bzw. -1..1)
function bc4Block(b, o, signed) {
  const r = (i) => (signed ? Math.max(-127, (b[o + i] << 24) >> 24) / 127 : b[o + i] / 255);
  const a0 = r(0), a1 = r(1), pal = [a0, a1];
  const raw0 = signed ? (b[o] << 24) >> 24 : b[o], raw1 = signed ? (b[o + 1] << 24) >> 24 : b[o + 1];
  if (raw0 > raw1) for (let i = 1; i < 7; i++) pal.push(((7 - i) * a0 + i * a1) / 7);
  else { for (let i = 1; i < 5; i++) pal.push(((5 - i) * a0 + i * a1) / 5); pal.push(signed ? -1 : 0, 1); }
  const lo = b.readUInt32LE(o + 2) >>> 0, hi = b.readUInt16LE(o + 6);
  const out = new Float32Array(16);
  for (let k = 0; k < 16; k++) {
    const bit = 3 * k;
    const idx = bit < 30 ? (lo >>> bit) & 7 : bit === 30 ? ((lo >>> 30) | (hi << 2)) & 7 : (hi >>> (bit - 32)) & 7;
    out[k] = pal[idx];
  }
  return out;
}

// Eine Stufe entpacken -> { w, h, data: Float32Array RGBA } (0..1, SNORM -1..1)
export function decodeLevel(dds, level = 0) {
  const L = dds.levels.find((x) => x.level === level) ?? dds.levels[0];
  const { w, h, data: b } = L, f = dds.format;
  const out = new Float32Array(w * h * 4), bw = Math.max(1, Math.ceil(w / 4)), bh = Math.max(1, Math.ceil(h / 4));
  const tmp = new Uint8ClampedArray(w * h * 4);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const o = (by * bw + bx) * BLOCK[f];
    if (f === 'bc1') bc1Block(b, o, tmp, w, bx * 4, by * 4, w, h);
    else if (f === 'bc3') {
      bc1Block(b, o + 8, tmp, w, bx * 4, by * 4, w, h, false);
      const al = bc4Block(b, o, false);
      for (let k = 0; k < 16; k++) { const x = bx * 4 + (k & 3), y = by * 4 + (k >> 2); if (x < w && y < h) tmp[(y * w + x) * 4 + 3] = al[k] * 255; }
    } else if (f === 'bc4' || f === 'bc4s' || f === 'bc5' || f === 'bc5s') {
      const s = f.endsWith('s'), two = f.startsWith('bc5');
      const r = bc4Block(b, o, s), g = two ? bc4Block(b, o + 8, s) : null;
      for (let k = 0; k < 16; k++) {
        const x = bx * 4 + (k & 3), y = by * 4 + (k >> 2);
        if (x >= w || y >= h) continue;
        const q = (y * w + x) * 4;
        out[q] = r[k]; out[q + 1] = g ? g[k] : r[k]; out[q + 2] = g ? 0 : r[k]; out[q + 3] = 1;
      }
    } else throw new Error(`Format ${f} wird nicht entpackt`);
  }
  if (f === 'bc1' || f === 'bc3') for (let i = 0; i < out.length; i++) out[i] = tmp[i] / 255;
  return { w, h, data: out };
}
