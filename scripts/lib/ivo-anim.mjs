// Figurenanimationen im IVO-Format (.caf einzeln, .dba als Datenbank) für
// die Hangar-Crew. Dieselben Blöcke wie in ivo-caf.mjs (Fahrwerk, Tore),
// dazu die Lesarten, die Menschen-Animationen brauchen: Drehung 0x80
// (4 × f32), Zeit 0x00 (u8 je Schlüssel) und Controller ohne Zeitspur
// (Zeitversatz 0: ein Schlüssel je Bild). ivo-caf.mjs bleibt, wie es ist —
// die Fahrwerks- und Torbilder sind gegen sie abgeglichen.
//
// .caf: Chunk 0x4733C6ED (u16 Bilder/s bei +4, u32 Bildzahl bei +0x10),
//   Chunk 0xA9496CB5: u32 Größe, dann Blöcke.
// .dba: Chunk 0xF7351608 (Metadaten: u32 Zahl, je 48 B mit u16 Bilder/s bei
//   +8, u16 Controller bei +10, u32 letztes Bild bei +0x14; danach auf 8 B
//   ausgerichtet die Namen, nullterminiert, in Blockfolge), Chunk 0x194FBC50:
//   u32 Größe, dann die Blockköpfe hintereinander (Versätze zeigen über das
//   Chunkende hinaus in die Schlüsseldaten).
// Block: "#caf"/"#dba", u16 Knochen n, u16 0xAA55, u32, n × u32 Knochen-Hash
//   (CRC32 des Namens), n × 24 B Controller (u16 Drehschlüssel, u16 Format,
//   u32 Zeitversatz, u32 Datenversatz, dasselbe für die Lage; Versätze ab
//   Controllerbeginn). Format: Bit 0–3 Zeit, Bit 8–15 Werte.
// Werte: Lage relativ zum Elternknochen, CryEngine-Achsen (Z oben), Drehung
// als Quaternion (x, y, z, w).
const FLT_MAX = 3.0e38;

function chunkTable(b) {
  if (b.toString('latin1', 0, 4) !== '#ivo') throw new Error('kein IVO');
  const n = b.readUInt32LE(8), tab = b.readUInt32LE(12), out = [];
  for (let i = 0; i < n; i++) { const o = tab + i * 16; out.push({ type: b.readUInt32LE(o) >>> 0, off: Number(b.readBigUInt64LE(o + 8)) }); }
  out.sort((a, c) => a.off - c.off);
  out.forEach((c, i) => { c.end = out[i + 1]?.off ?? b.length; });
  return out;
}

function times(b, p, count, fmt) {
  const tf = fmt & 0x0f;
  if (tf === 0) return Array.from({ length: count }, (_, k) => b[p + k]);
  if (tf === 1) return Array.from({ length: count }, (_, k) => b.readUInt16LE(p + k * 2));
  if (tf === 2) {
    const start = b.readUInt16LE(p), end = b.readUInt16LE(p + 2), out = [];
    for (let f = start; f <= end && out.length < count; f++) { const bit = f - start; if (b[p + 4 + (bit >> 3)] & (1 << (bit & 7))) out.push(f); }
    if (out.length === count) return out;
    // Bitfeld passt nicht zur Schlüsselzahl: gleichmäßig über den Bereich
    return Array.from({ length: count }, (_, k) => (count < 2 ? start : start + ((end - start) * k) / (count - 1)));
  }
  return Array.from({ length: count }, (_, k) => k);
}

function rotations(b, p, count, fmt) {
  const rf = fmt >> 8;
  if (rf === 0x80) return Array.from({ length: count }, (_, k) => [0, 1, 2, 3].map((i) => b.readFloatLE(p + k * 16 + i * 4)));
  // 0x82 (und unbekannt): 48-Bit-Quaternion, Index der größten Komponente in Bit 46–47
  return Array.from({ length: count }, (_, k) => {
    const d = p + k * 6;
    const s0 = b.readUInt16LE(d), s1 = b.readUInt16LE(d + 2), s2 = b.readUInt16LE(d + 4);
    const v = s0 + s1 * 65536 + s2 * 4294967296;
    const idx = s2 >> 14, q = [0, 0, 0, 0];
    let sum = 0, sh = 1;
    for (let c = 0; c < 4; c++) {
      if (c === idx) continue;
      const raw = Math.floor(v / sh) % 32768;
      q[c] = raw / 23170 - Math.SQRT1_2; sum += q[c] * q[c]; sh *= 32768;
    }
    q[idx] = Math.sqrt(Math.max(0, 1 - sum));
    return q;
  });
}

function positions(b, p, count, fmt) {
  const df = fmt >> 8;
  if (df === 0xc0) return Array.from({ length: count }, (_, k) => [0, 1, 2].map((i) => b.readFloatLE(p + k * 12 + i * 4)));
  const sc = [0, 1, 2].map((i) => b.readFloatLE(p + i * 4)), off = [0, 1, 2].map((i) => b.readFloatLE(p + 12 + i * 4));
  if (df === 0xc1) return Array.from({ length: count }, (_, k) => [0, 1, 2].map((i) => off[i] + b.readUInt16LE(p + 24 + (k * 3 + i) * 2) * (Math.abs(sc[i]) < FLT_MAX ? sc[i] : 0)));
  if (df === 0xc2) {
    const live = [0, 1, 2].filter((i) => Math.abs(sc[i]) < FLT_MAX);
    return Array.from({ length: count }, (_, k) => [0, 1, 2].map((i) => { const j = live.indexOf(i); return j < 0 ? off[i] : off[i] + b.readUInt16LE(p + 24 + (j * count + k) * 2) * sc[i]; }));
  }
  return null;
}

function block(b, o) {
  const n = b.readUInt16LE(o + 4);
  const channels = new Map();
  for (let i = 0; i < n; i++) {
    const hash = b.readUInt32LE(o + 12 + i * 4) >>> 0;
    const c = o + 12 + n * 4 + i * 24;
    const rk = b.readUInt16LE(c), rf = b.readUInt16LE(c + 2), rto = b.readUInt32LE(c + 4), rdo = b.readUInt32LE(c + 8);
    const pk = b.readUInt16LE(c + 12), pf = b.readUInt16LE(c + 14), pto = b.readUInt32LE(c + 16), pdo = b.readUInt32LE(c + 20);
    const ch = {};
    if (rk) ch.rot = { times: rto ? times(b, c + rto, rk, rf) : times(b, 0, rk, 0xff), values: rotations(b, c + rdo, rk, rf), format: rf };
    if (pk) { const v = positions(b, c + pdo, pk, pf); if (v) ch.pos = { times: pto ? times(b, c + pto, pk, pf) : times(b, 0, pk, 0xff), values: v, format: pf }; }
    channels.set(hash, ch);
  }
  return { size: 12 + n * 28, channels };
}

function blocks(b, from, to) {
  const out = [];
  let o = from;
  if (b.readUInt32LE(o) > 0 && b.toString('latin1', o, o + 4) !== '#caf' && b.toString('latin1', o, o + 4) !== '#dba') o += 4;
  while (o + 12 <= Math.min(b.length, to + 16)) {
    const sig = b.toString('latin1', o, o + 4);
    if (sig !== '#caf' && sig !== '#dba') break;
    const r = block(b, o);
    out.push(r.channels);
    o += r.size;
  }
  return out;
}

// -> [{ name, fps, frames, channels: Map(Hash -> { rot?, pos? }) }]
export function readAnimations(buf, name = null) {
  const cs = chunkTable(buf);
  const caf = cs.find((c) => c.type === 0xa9496cb5);
  if (caf) {
    const info = cs.find((c) => c.type === 0x4733c6ed);
    const fps = info ? buf.readUInt16LE(info.off + 4) : 30;
    const frames = info ? buf.readUInt32LE(info.off + 0x10) : null;
    return blocks(buf, caf.off, caf.end).map((channels) => ({ name, fps: fps || 30, frames, channels }));
  }
  const data = cs.find((c) => c.type === 0x194fbc50), meta = cs.find((c) => c.type === 0xf7351608);
  if (!data) throw new Error('weder #caf noch #dba');
  const list = [];
  if (meta) {
    const n = buf.readUInt32LE(meta.off);
    let p = meta.off + 4 + n * 48;
    p = meta.off + Math.ceil((p - meta.off) / 8) * 8;
    while (p < meta.end && buf[p] === 0) p++;
    for (let i = 0; i < n; i++) {
      const e = meta.off + 4 + i * 48;
      let q = p; while (q < meta.end && buf[q] !== 0) q++;
      list.push({ name: buf.toString('latin1', p, q), fps: buf.readUInt16LE(e + 8) || 30, controllers: buf.readUInt16LE(e + 10), frames: buf.readUInt32LE(e + 0x14) });
      p = q + 1;
    }
  }
  return blocks(buf, data.off, buf.length).map((channels, i) => ({ name: list[i]?.name ?? `anim_${i}`, fps: list[i]?.fps ?? 30, frames: list[i]?.frames ?? null, channels }));
}
