// p4k-Reader (Star-Citizen-Archiv Data.p4k) — Zip64-Container mit zstd-Payload.
//
// Herausgeloest aus extract-hardpoints.mjs, das dieselbe Mechanik inline hat:
// EOCD -> Zip64-Locator -> Zip64-EOCD -> Central Directory (~437 MiB, 1,35 Mio
// Eintraege) -> Local Header -> zstd/store/AES.
//
// Bewusst NICHT in extract-hardpoints.mjs zurueckportiert: das Skript ist
// verifizierter, funktionierender Code (Hardpoint-Extraktion mm-genau gegen
// StarFab validiert) — ein Refactor daran haette echtes Regressionsrisiko ohne
// Gegenwert. Neue Extraktoren nutzen diese Lib.

import { openSync, readSync, fstatSync, existsSync, closeSync } from 'node:fs';
import { zstdDecompressSync } from 'node:zlib';
import { createDecipheriv } from 'node:crypto';

export const DEFAULT_P4K = process.env.SC_P4K ?? 'F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k';

// unp4k-Standardschluessel, Zero-IV (CIG verschluesselt nur wenige Eintraege)
const AES_KEY = Buffer.from([0x5e, 0x7a, 0x20, 0x02, 0x30, 0x2e, 0xeb, 0x1a, 0x3b, 0xb6, 0x17, 0xc3, 0x0f, 0xde, 0x1e, 0x47]);
const ZSTD_MAGIC = 0xfd2fb528;
const MAX_OUT = 2 * 1024 * 1024 * 1024;

export function openP4k(path = DEFAULT_P4K) {
  if (!existsSync(path)) throw new Error(`Data.p4k nicht gefunden: ${path} — SC_P4K setzen oder SC installieren.`);
  const fd = openSync(path, 'r');
  const size = fstatSync(fd).size;

  const readAt = (pos, len) => {
    const buf = Buffer.alloc(len);
    let done = 0;
    while (done < len) {
      const n = readSync(fd, buf, done, len - done, pos + done);
      if (n <= 0) throw new Error(`p4k: short read @${pos + done}`);
      done += n;
    }
    return buf;
  };

  // EOCD rueckwaerts im Tail suchen
  const tailLen = Math.min(131072, size);
  const tail = readAt(size - tailLen, tailLen);
  let eocd = -1;
  for (let i = tailLen - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50) { eocd = size - tailLen + i; break; }
  }
  if (eocd < 0) throw new Error('p4k: kein EOCD gefunden');
  const loc = readAt(eocd - 20, 20);
  if (loc.readUInt32LE(0) !== 0x07064b50) throw new Error('p4k: kein Zip64-Locator');
  const z64 = readAt(Number(loc.readBigUInt64LE(8)), 56);
  const cdSize = Number(z64.readBigUInt64LE(40));
  const cdOff = Number(z64.readBigUInt64LE(48));
  const entryCount = Number(z64.readBigUInt64LE(32));

  // Central Directory am Stueck lesen (jedes Byte wird ueberschrieben -> allocUnsafe)
  const cd = Buffer.allocUnsafe(cdSize);
  {
    const CHUNK = 64 * 1024 * 1024;
    let done = 0;
    while (done < cdSize) {
      const n = readSync(fd, cd, done, Math.min(CHUNK, cdSize - done), cdOff + done);
      if (n <= 0) throw new Error('p4k: short CD read');
      done += n;
    }
  }

  // Eintraege scannen; `filter` faellt auf die rohen Namens-Bytes, damit nicht
  // 1,35 Mio Strings dekodiert werden muessen.
  function entries(match) {
    const re = match instanceof RegExp ? match : null;
    const out = [];
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
      const nameEnd = p + 46 + nameLen;
      const name = cd.toString('utf8', p + 46, nameEnd);
      if (!re || re.test(name)) {
        // Zip64-Extra: 32-Bit-Ueberlaeufe aufloesen
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
        out.push({ name, method, csize, usize, lho });
      }
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  function extract(e) {
    const lh = readAt(e.lho, 30 + 1024);
    if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error(`p4k: kein Local Header fuer ${e.name}`);
    const nameLen = lh.readUInt16LE(26);
    const extraLen = lh.readUInt16LE(28);
    const raw = readAt(e.lho + 30 + nameLen + extraLen, e.csize);
    if (raw.length >= 4 && (raw.readUInt32LE(0) >>> 0) === ZSTD_MAGIC) return zstdDecompressSync(raw, { maxOutputLength: MAX_OUT });
    if (e.method === 0) return raw;
    const dec = createDecipheriv('aes-128-cbc', AES_KEY, Buffer.alloc(16));
    dec.setAutoPadding(false);
    const padded = Buffer.concat([raw, Buffer.alloc((16 - (raw.length % 16)) % 16)]);
    const plain = Buffer.concat([dec.update(padded), dec.final()]);
    if (plain.length >= 4 && (plain.readUInt32LE(0) >>> 0) === ZSTD_MAGIC) return zstdDecompressSync(plain, { maxOutputLength: MAX_OUT });
    return plain;
  }

  // Genau einen Eintrag holen; wirft, wenn es keinen oder mehrdeutig viele gibt.
  function read(match) {
    const es = entries(match);
    if (!es.length) throw new Error(`p4k: kein Eintrag fuer ${match}`);
    return extract(es[0]);
  }

  return { path, size, entryCount, cdSize, entries, extract, read, close: () => closeSync(fd) };
}
