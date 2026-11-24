// BC7 (BPTC) entpacken, ohne fremde Werkzeuge; decodeLevel in dds-bc.mjs
// ruft es für BC7-Bilder. Vorher fielen solche Bilder im Item-Bäcker still weg
// (u. a. Tarnmuster-Aufdrucke der Waffen, 342 Rüstungsbilder). Gegen Pillows
// Entpacker geprüft: 2048 Zufallsblöcke über alle Modi und Teilungen gleich.
// Ausgabe wie decodeLevel: { w, h, data: Float32Array RGBA 0..1 }.

// Modus: Teilmengen, Teilungsbits, Drehbits, Indexwahlbit, Farb-/Alphabits,
// P-Bits je Endpunkt / je Teilmenge, Indexbits, zweite Indexbits
const MODES = [
  { ns: 3, pb: 4, rb: 0, isb: 0, cb: 4, ab: 0, epb: 1, spb: 0, ib: 3, ib2: 0 },
  { ns: 2, pb: 6, rb: 0, isb: 0, cb: 6, ab: 0, epb: 0, spb: 1, ib: 3, ib2: 0 },
  { ns: 3, pb: 6, rb: 0, isb: 0, cb: 5, ab: 0, epb: 0, spb: 0, ib: 2, ib2: 0 },
  { ns: 2, pb: 6, rb: 0, isb: 0, cb: 7, ab: 0, epb: 1, spb: 0, ib: 2, ib2: 0 },
  { ns: 1, pb: 0, rb: 2, isb: 1, cb: 5, ab: 6, epb: 0, spb: 0, ib: 2, ib2: 3 },
  { ns: 1, pb: 0, rb: 2, isb: 0, cb: 7, ab: 8, epb: 0, spb: 0, ib: 2, ib2: 2 },
  { ns: 1, pb: 0, rb: 0, isb: 0, cb: 7, ab: 7, epb: 1, spb: 0, ib: 4, ib2: 0 },
  { ns: 2, pb: 6, rb: 0, isb: 0, cb: 5, ab: 5, epb: 1, spb: 0, ib: 2, ib2: 0 },
];
const row = (s) => s.split('').map(Number);
const P2 = [
  '0011001100110011', '0001000100010001', '0111011101110111', '0001001100110111', '0000000100010011', '0011011101111111', '0001001101111111', '0000000100110111',
  '0000000000010011', '0011011111111111', '0000000101111111', '0000000000010111', '0001011111111111', '0000000011111111', '0000111111111111', '0000000000001111',
  '0000100011101111', '0111000100000000', '0000000010001110', '0111001100010000', '0011000100000000', '0000100011001110', '0000000010001100', '0111001100110001',
  '0011000100010000', '0000100010001100', '0110011001100110', '0011011001101100', '0001011111101000', '0000111111110000', '0111000110001110', '0011100110011100',
  '0101010101010101', '0000111100001111', '0101101001011010', '0011001111001100', '0011110000111100', '0101010110101010', '0110100101101001', '0101101010100101',
  '0111001111001110', '0001001111001000', '0011001001001100', '0011101111011100', '0110100110010110', '0011110011000011', '0110011010011001', '0000011001100000',
  '0100111001000000', '0010011100100000', '0000001001110010', '0000010011100100', '0110110010010011', '0011011011001001', '0110001110011100', '0011100111000110',
  '0110110011001001', '0110001100111001', '0111111010000001', '0001100011100111', '0000111100110011', '0011001111110000', '0010001011101110', '0100010001110111',
].map(row);
const P3 = [
  '0011001102212222', '0001001122112221', '0000200122112211', '0222002200110111', '0000000011221122', '0011001100220022', '0022002211111111', '0011001122112211',
  '0000000011112222', '0000111111112222', '0000111122222222', '0012001200120012', '0112011201120112', '0122012201220122', '0011011211221222', '0011200122002220',
  '0001001101121122', '0111001120012200', '0000112211221122', '0022002200221111', '0111011102220222', '0001000122212221', '0000001101220122', '0000110022102210',
  '0122012200110000', '0012001211222222', '0110122112210110', '0000011012211221', '0022110211020022', '0110011020022222', '0011012201220011', '0000200022112221',
  '0000000211221222', '0222002200120011', '0011001200220222', '0120012001200120', '0000111122220000', '0120120120120120', '0120201212010120', '0011220011220011',
  '0011112222000011', '0101010122222222', '0000000021212121', '0022112200221122', '0022001100220011', '0220122102201221', '0101222222220101', '0000212121212121',
  '0101010101012222', '0222011102220111', '0002111200021112', '0000211221122112', '0222011101110222', '0002111211120002', '0110011001102222', '0000000021122112',
  '0110011022222222', '0022001100110022', '0022112211220022', '0000000000002112', '0002000100020001', '0222122202221222', '0101222222222222', '0111201122012220',
].map(row);
const A2 = [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 2, 8, 2, 2, 8, 8, 15, 2, 8, 2, 2, 8, 8, 2, 2,
  15, 15, 6, 8, 2, 8, 15, 15, 2, 8, 2, 2, 2, 15, 15, 6, 6, 2, 6, 8, 15, 15, 2, 2, 15, 15, 15, 15, 15, 2, 2, 15];
const A3a = [3, 3, 15, 15, 8, 3, 15, 15, 8, 8, 6, 6, 6, 5, 3, 3, 3, 3, 8, 15, 3, 3, 6, 10, 5, 8, 8, 6, 8, 5, 15, 15,
  8, 15, 3, 5, 6, 10, 8, 15, 15, 3, 15, 5, 15, 15, 15, 15, 3, 15, 5, 5, 5, 8, 5, 10, 5, 10, 8, 13, 15, 12, 3, 3];
const A3b = [15, 8, 8, 3, 15, 15, 3, 8, 15, 15, 15, 15, 15, 15, 15, 8, 15, 8, 15, 3, 15, 8, 15, 8, 3, 15, 6, 10, 15, 15, 10, 8,
  15, 3, 15, 10, 10, 8, 9, 10, 6, 15, 8, 15, 3, 6, 6, 8, 15, 3, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 3, 15, 15, 8];
const W = { 2: [0, 21, 43, 64], 3: [0, 9, 18, 27, 37, 46, 55, 64], 4: [0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64] };
const interp = (a, b, w) => ((64 - w) * a + w * b + 32) >> 6;

// ein Block (16 B ab o) -> 16 × RGBA (0..255) in px
export function bc7Block(buf, o, px) {
  let pos = 0;
  const bits = (n) => {
    let v = 0;
    for (let i = 0; i < n; i++, pos++) v |= ((buf[o + (pos >> 3)] >> (pos & 7)) & 1) << i;
    return v;
  };
  let mode = 0;
  while (mode < 8 && !bits(1)) mode++;
  if (mode === 8) { px.fill(0); return; }
  const M = MODES[mode];
  const part = bits(M.pb), rot = bits(M.rb), isel = bits(M.isb);
  const n = M.ns * 2;
  const ep = Array.from({ length: n }, () => [0, 0, 0, 255]);
  for (let c = 0; c < 3; c++) for (let i = 0; i < n; i++) ep[i][c] = bits(M.cb);
  if (M.ab) for (let i = 0; i < n; i++) ep[i][3] = bits(M.ab);
  let cb = M.cb, ab = M.ab;
  if (M.epb) { for (let i = 0; i < n; i++) { const p = bits(1); for (let c = 0; c < 4; c++) if (c < 3 || M.ab) ep[i][c] = (ep[i][c] << 1) | p; } cb++; if (ab) ab++; }
  else if (M.spb) { for (let s = 0; s < M.ns; s++) { const p = bits(1); for (const i of [s * 2, s * 2 + 1]) for (let c = 0; c < 3; c++) ep[i][c] = (ep[i][c] << 1) | p; } cb++; }
  const ex = (v, b) => { v <<= 8 - b; return v | (v >> b); };
  for (const e of ep) { for (let c = 0; c < 3; c++) e[c] = ex(e[c], cb); if (ab) e[3] = ex(e[3], ab); }
  const sub = M.ns === 1 ? null : M.ns === 2 ? P2[part] : P3[part];
  const anchor = (k) => k === 0 || (M.ns === 2 && k === A2[part]) || (M.ns === 3 && (k === A3a[part] || k === A3b[part]));
  const i1 = new Uint8Array(16), i2 = new Uint8Array(16);
  for (let k = 0; k < 16; k++) i1[k] = bits(anchor(k) ? M.ib - 1 : M.ib);
  if (M.ib2) for (let k = 0; k < 16; k++) i2[k] = bits(k === 0 ? M.ib2 - 1 : M.ib2);
  for (let k = 0; k < 16; k++) {
    const s = sub ? sub[k] : 0, a = ep[s * 2], b = ep[s * 2 + 1];
    let r, g, bl, al;
    if (M.ib2) {
      const [ci, cbits, ai, abits] = isel ? [i2[k], M.ib2, i1[k], M.ib] : [i1[k], M.ib, i2[k], M.ib2];
      const wc = W[cbits][ci], wa = W[abits][ai];
      r = interp(a[0], b[0], wc); g = interp(a[1], b[1], wc); bl = interp(a[2], b[2], wc); al = interp(a[3], b[3], wa);
    } else {
      const w = W[M.ib][i1[k]];
      r = interp(a[0], b[0], w); g = interp(a[1], b[1], w); bl = interp(a[2], b[2], w); al = M.ab ? interp(a[3], b[3], w) : 255;
    }
    if (rot === 1) [r, al] = [al, r]; else if (rot === 2) [g, al] = [al, g]; else if (rot === 3) [bl, al] = [al, bl];
    px[k * 4] = r; px[k * 4 + 1] = g; px[k * 4 + 2] = bl; px[k * 4 + 3] = al;
  }
}

// Stufe eines mit readDds gelesenen BC7-Bildes entpacken
export function decodeBc7Level(dds, level = 0) {
  const L = dds.levels.find((x) => x.level === level) ?? dds.levels[0];
  const { w, h, data: b } = L;
  const out = new Float32Array(w * h * 4), bw = Math.max(1, Math.ceil(w / 4)), bh = Math.max(1, Math.ceil(h / 4));
  const px = new Uint8Array(64);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    bc7Block(b, (by * bw + bx) * 16, px);
    for (let k = 0; k < 16; k++) {
      const x = bx * 4 + (k & 3), y = by * 4 + (k >> 2);
      if (x >= w || y >= h) continue;
      const q = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out[q + c] = px[k * 4 + c] / 255;
    }
  }
  return { w, h, data: out };
}
