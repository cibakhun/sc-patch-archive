// Komprimierte Zwillinge der Hangar-Bilder (KTX2/Basis, 13.11.2026).
//
// Krisz 13.11.2026: „es braucht viel zu viele Ressourcen um das Hangar laufen
// zu lassen und zu laden". Der größte Posten war der Grafikspeicher: jede
// Karte lag als RGBA8 bei der Grafikkarte, 4 Byte je Bildpunkt plus ein
// Drittel für die Mip-Stufen (Gladius, hohe Stufe: 1.507 MB Texturen). Die
// Probe am selben Tag (Halle + Gladius, vier Fassungen, Aufnahmen auf seiner
// RTX 3070 Ti) ergab mit komprimierten Texturen 516 MB, im Task-Manager
// 2,0 GB statt 1,0 GB Grafikspeicher, und er hat sich für Fassung D
// entschieden: Normal-Karten als UASTC (ETC1S machte auf dunklen, glatten
// Rumpfflächen blockige Flecken), alles andere als ETC1S mit Güte 128.
//
// Bauweise: Jedes Bild, das ein GLB unter public/hangar/ über eine Textur
// benutzt, bekommt einen Zwilling public/hangar/ktx/<kennung>.ktx2. Die
// Kennung ist der Inhalt des WebP (erste 16 Hex-Zeichen von SHA-256): bei
// Bildern der Ablage (/hangar/tex/, scripts/lib/glb-texpool.mjs) also der
// Dateiname, bei eingebetteten Bildern derselbe Hash über die Bytes im GLB.
// Kein GLB wird angefasst und es gibt kein Verzeichnis: der Viewer rechnet
// die Kennung selbst aus. Die WebP bleiben, wie sie sind; Telefone laden
// weiter sie (assets/hangar-viewer.js), und sie sind die Quelle der Zwillinge.
//
// Was der Viewer außer den Bildpunkten braucht, steht in den Schlüssel-Wert-
// Daten der KTX2-Datei (KV):
//   HGart     n = Normal-Karte (UASTC), c = Farbe (ETC1S, sRGB-Mips),
//             d = Daten (ETC1S, lineare Mips)
//   HGbau     Rezept (BAU). Der Viewer hängt es als ?v= an die URL, weil
//             /hangar/ ein Jahr unveränderlich gecacht wird (nginx): ändert
//             sich das Rezept, ändert sich jede URL.
//   HGwebp    Bytes des WebP. Der Ladebalken rechnet weiter in diesen Bytes
//             (src/data/hangar-assets.json kennt nur sie).
//   HGmittel  nur Grundfarben-Karten: Mittel je Kanal, linear, „r,g,b". Das
//             maß der Viewer bisher am ausgepackten Bild (imageMean, für
//             albedoFloor); ein komprimiertes Bild lässt sich nicht billig
//             zurücklesen. build-hangar-ktx misst es mit demselben Rechenweg
//             im Browser.
//
// Dieses Modul hat kein Netz, kein git und keinen Browser: Bestand und
// KV-Lesen laufen auch in Schiene A (verify:hangar-ktx gegen dist/).

import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

export const BAU = 'd1';
export const KTX_ORDNER = 'ktx';
export const KTX_NAME = /^[0-9a-f]{16}\.ktx2$/;
const POOL_URI = /^\.\.\/tex\/([0-9a-f]{16})\.webp$/;

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.glb')) out.push(p);
  }
  return out;
};

// Nur Kopf und JSON-Teil eines GLB lesen (die Schiffe sind zusammen 1,4 GB,
// ihr JSON wenige MB); bin(off, len) holt Bytes aus dem Binärteil nach.
function openGlb(file) {
  const fd = openSync(file, 'r');
  const head = Buffer.alloc(20);
  readSync(fd, head, 0, 20, 0);
  if (head.readUInt32LE(0) !== 0x46546c67 || head.readUInt32LE(16) !== 0x4e4f534a) { closeSync(fd); throw new Error(`${file}: kein GLB mit JSON-Teil vorn`); }
  const jl = head.readUInt32LE(12), jb = Buffer.alloc(jl);
  readSync(fd, jb, 0, jl, 20);
  const bin0 = 20 + jl + 8;
  return {
    json: JSON.parse(jb.toString('utf8')),
    bin: (off, len) => { const b = Buffer.alloc(len); readSync(fd, b, 0, len, bin0 + off); return b; },
    close: () => closeSync(fd),
  };
}

// Die ersten n Byte einer Datei (kürzer, wenn sie kleiner ist)
export function dateiAnfang(file, n) {
  const fd = openSync(file, 'r');
  try { const b = Buffer.alloc(n); return b.subarray(0, readSync(fd, b, 0, n, 0)); } finally { closeSync(fd); }
}

// Wofür ein Bild gebraucht wird: je Material die Plätze, die eine Textur
// tragen. Normal-Karten und Farben (sRGB) sind benannt, alles andere ist
// Daten. Erweiterungen: jeder Wert mit { index } ist eine Textur.
const SRGB_PLATZ = /^(baseColorTexture|emissiveTexture|diffuseTexture|specularColorTexture|sheenColorTexture|specularGlossinessTexture)$/;
const NORMAL_PLATZ = /^(normalTexture|clearcoatNormalTexture)$/;
function nutzung(json) {
  const use = new Map();   // Bildnummer -> Set('n' | 'c' | 'd' | 'grund')
  const note = (platz, ref) => {
    if (!ref || typeof ref !== 'object' || typeof ref.index !== 'number') return;
    const t = json.textures?.[ref.index];
    const src = t?.extensions?.EXT_texture_webp?.source ?? t?.source;
    if (src == null) return;
    const s = use.get(src) ?? use.set(src, new Set()).get(src);
    s.add(NORMAL_PLATZ.test(platz) ? 'n' : SRGB_PLATZ.test(platz) ? 'c' : 'd');
    if (platz === 'baseColorTexture') s.add('grund');
  };
  for (const m of json.materials ?? []) {
    for (const [k, v] of Object.entries(m.pbrMetallicRoughness ?? {})) note(k, v);
    for (const k of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) note(k, m[k]);
    for (const e of Object.values(m.extensions ?? {})) for (const [k, v] of Object.entries(e ?? {})) note(k, v);
  }
  return use;
}

// Bestand: alle Bilder, die ein GLB unter `hangar` über eine Textur benutzt.
// Liefert { bilder: Map<kennung, { art, grund, webp, lies(), in: Set<glb> }>,
// glbs, verweise, eingebettet, ablage, fehler: [text] }. lies() gibt die
// WebP-Bytes, lies(n) nur die ersten n. Die Art gilt je Kennung über alle
// Dateien: Normal-Karte vor Farbe vor Daten.
export function bestand(hangar) {
  const out = { bilder: new Map(), glbs: 0, verweise: 0, eingebettet: 0, ablage: 0, fehler: [] };
  for (const file of walk(hangar).sort()) {
    const rel = relative(hangar, file).split(sep).join('/');
    let g;
    try { g = openGlb(file); } catch (e) { out.fehler.push(e.message); continue; }
    out.glbs++;
    try {
      const use = nutzung(g.json);
      for (const [i, wozu] of use) {
        const def = g.json.images?.[i];
        if (!def) { out.fehler.push(`${rel}: Textur zeigt auf Bild ${i}, das es nicht gibt`); continue; }
        let id, webp, lies;
        if (def.bufferView === undefined) {
          const m = POOL_URI.exec(def.uri ?? '');
          if (!m) { out.fehler.push(`${rel}: Bild ${i} hat weder Puffer noch einen Verweis in die Ablage (${String(def.uri).slice(0, 60)})`); continue; }
          id = m[1];
          const p = join(hangar, 'tex', `${id}.webp`);
          try { webp = statSync(p).size; } catch { out.fehler.push(`${rel}: Bild ${i} zeigt auf tex/${id}.webp, die Datei fehlt`); continue; }
          lies = (n) => (n ? dateiAnfang(p, n) : readFileSync(p));
          out.ablage++;
        } else {
          if (def.mimeType !== 'image/webp') { out.fehler.push(`${rel}: eingebettetes Bild ${i} ist ${def.mimeType}, erwartet image/webp`); continue; }
          const v = g.json.bufferViews[def.bufferView];
          const bytes = g.bin(v.byteOffset ?? 0, v.byteLength);
          id = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
          webp = bytes.length;
          const off = v.byteOffset ?? 0, len = v.byteLength;
          lies = (n) => { const h = openGlb(file); try { return h.bin(off, n ? Math.min(n, len) : len); } finally { h.close(); } };
          out.eingebettet++;
        }
        out.verweise++;
        const b = out.bilder.get(id) ?? out.bilder.set(id, { art: 'd', grund: false, webp, lies, in: new Set() }).get(id);
        if (b.webp !== webp) out.fehler.push(`${rel}: Bild ${i} (${id}) hat ${webp} Bytes, dieselbe Kennung anderswo ${b.webp}`);
        if (wozu.has('n')) b.art = 'n'; else if (wozu.has('c') && b.art !== 'n') b.art = 'c';
        if (wozu.has('grund')) b.grund = true;
        b.in.add(rel);
      }
    } finally { g.close(); }
  }
  return out;
}

// --- KTX2 lesen und Schlüssel-Wert-Daten setzen ------------------------------
// Aufbau (KTX 2.0, Abschnitt 3): 12 Byte Kennung, neun uint32 (vkFormat,
// typeSize, Breite, Höhe, Tiefe, Lagen, Flächen, Stufen, Superkompression),
// dann der Index: dfd (Offset, Länge), kvd (Offset, Länge), sgd (Offset und
// Länge als uint64), dann je Stufe drei uint64 (Offset, Länge, entpackte
// Länge). Die KV-Daten liegen nach dem DFD; jeder Eintrag: uint32 Länge,
// Schlüssel, NUL, Wert, aufgefüllt auf 4 Byte.
const KENNUNG = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);

// buf: die Datei oder ihr Anfang (Kopf, Index, DFD und KV-Daten müssen darin
// liegen; die Zwillinge tragen sie in den ersten paar hundert Byte);
// groesse: Länge der ganzen Datei, gegen die die Stufen geprüft werden.
export function ktxKopf(buf, groesse = buf.length) {
  if (buf.length < 80 || !buf.subarray(0, 12).equals(KENNUNG)) return null;
  const u = (at) => buf.readUInt32LE(at);
  const k = { vkFormat: u(12), breite: u(20), hoehe: u(24), stufen: u(40), super: u(44), dfdOff: u(48), dfdLen: u(52), kvdOff: u(56), kvdLen: u(60), sgdOff: Number(buf.readBigUInt64LE(64)), sgdLen: Number(buf.readBigUInt64LE(72)) };
  if (k.stufen < 1 || k.stufen > 32 || k.kvdOff + k.kvdLen > buf.length || k.dfdOff + k.dfdLen > buf.length || 80 + 24 * k.stufen > buf.length || k.sgdOff + k.sgdLen > groesse) return null;
  k.kv = {};
  for (let at = k.kvdOff; at + 4 <= k.kvdOff + k.kvdLen;) {
    const len = u(at), body = buf.subarray(at + 4, at + 4 + len), nul = body.indexOf(0);
    if (nul < 0) return null;
    k.kv[body.subarray(0, nul).toString('utf8')] = body.subarray(nul + 1).toString('utf8').replace(/\0+$/, '');
    at += 4 + len + ((4 - (len % 4)) % 4);
  }
  // Stufe 0 ist die größte; ihre Bytes müssen in der Datei liegen
  k.ebenen = [];
  for (let i = 0; i < k.stufen; i++) {
    const off = Number(buf.readBigUInt64LE(80 + 24 * i)), len = Number(buf.readBigUInt64LE(88 + 24 * i));
    if (off + len > groesse) return null;
    k.ebenen.push({ off, len });
  }
  return k;
}

// Setzt die HG-Schlüssel neu (andere bleiben) und gibt die neue Datei zurück.
// Alles nach den KV-Daten rückt um die Längendifferenz; die Offsets im Index
// und in der Stufenliste wandern mit. Ausrichtung nach Norm: KV-Daten auf 4,
// Superkompressions-Daten auf 8, Stufen ohne Superkompression auf 4 (hier
// tragen alle Dateien Basis oder Zstandard, also 1).
export function ktxMitKv(buf, neu) {
  const k = ktxKopf(buf);
  if (!k) throw new Error('keine lesbare KTX2-Datei');
  if (k.super === 0) throw new Error('KTX2 ohne Superkompression: Stufen müssten ausgerichtet bleiben, das kann ktxMitKv nicht');
  const kv = { ...k.kv, ...neu };
  for (const [key, v] of Object.entries(kv)) if (v == null) delete kv[key];
  const teile = [];
  for (const key of Object.keys(kv).sort()) {
    const body = Buffer.concat([Buffer.from(key, 'utf8'), Buffer.from([0]), Buffer.from(String(kv[key]), 'utf8'), Buffer.from([0])]);
    const len = Buffer.alloc(4); len.writeUInt32LE(body.length);
    teile.push(len, body, Buffer.alloc((4 - (body.length % 4)) % 4));
  }
  const kvd = Buffer.concat(teile);
  const kvdOff = k.dfdOff + k.dfdLen;          // DFD endet auf 4 (seine Länge ist ein Vielfaches von 4)
  if (kvdOff % 4) throw new Error('DFD endet nicht auf einer 4-Byte-Grenze');
  const kopf = Buffer.from(buf.subarray(0, 80 + 24 * k.stufen));
  // was nach den KV-Daten kommt: SGD (auf 8 ausgerichtet), dann die Stufen
  const restAb = k.sgdLen ? k.sgdOff : Math.min(...k.ebenen.map((e) => e.off));
  const rest = buf.subarray(restAb);
  let neuAb = kvdOff + kvd.length;
  const fuell = k.sgdLen ? (8 - (neuAb % 8)) % 8 : 0;
  neuAb += fuell;
  const d = neuAb - restAb;
  kopf.writeUInt32LE(kvd.length ? kvdOff : 0, 56); kopf.writeUInt32LE(kvd.length, 60);
  if (k.sgdLen) kopf.writeBigUInt64LE(BigInt(k.sgdOff + d), 64);
  for (let i = 0; i < k.stufen; i++) kopf.writeBigUInt64LE(BigInt(k.ebenen[i].off + d), 80 + 24 * i);
  const out = Buffer.concat([kopf, buf.subarray(80 + 24 * k.stufen, kvdOff), kvd, Buffer.alloc(fuell), rest]);
  const probe = ktxKopf(out);
  if (!probe || probe.stufen !== k.stufen || probe.ebenen.some((e, i) => e.len !== k.ebenen[i].len)) throw new Error('KTX2 nach dem Umschreiben nicht mehr lesbar');
  return out;
}

export const ktxUrl = (id) => posix.join(KTX_ORDNER, `${id}.ktx2`);
