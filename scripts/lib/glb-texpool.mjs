// Gemeinsame Texturablage der Hangar-Schiffe (.planning/notes/hangar-alle-schiffe.md).
//
// Ein Schiff-GLB trägt seine Bilder eingebettet. Viele davon sind in jedem
// Schiff dieselben (Schichten, Decals, Lackkanäle): bei den zehn Web-Schiffen
// am 25.10.2026 71,4 MB eingebettet, 17,4 MB davon verschieden. poolGlb()
// zieht jedes eingebettete Bild in eine Datei <inhalt>.<endung> der Ablage und
// lässt im GLB nur den Verweis (images[].uri, relativ zum GLB). Verlustfrei:
// die Bildbytes bleiben gleich, Geometrie und JSON bis auf die Bildeinträge
// auch. Der Name der Bilddatei ist ihr Inhalt, ein Bild liegt also einmal in
// der Ablage, egal wie viele Schiffe es nutzen, und die URL ist unveränderlich.
// GLTFLoader löst die URI gegen den Ordner des GLB auf; gltf-transform
// (NodeIO.read mit Pfad) und die Tore, die nur den JSON-Teil lesen, gehen
// unverändert.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const JSON_CHUNK = 0x4e4f534a, BIN_CHUNK = 0x004e4942;
const EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/ktx2': 'ktx2' };
export const POOL_NAME = /^[0-9a-f]{16}\.(webp|png|jpg|ktx2)$/;

export function readGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67 || buf.readUInt32LE(4) !== 2) throw new Error('kein GLB 2.0');
  let json = null, bin = null;
  for (let at = 12; at < buf.length;) {
    const len = buf.readUInt32LE(at), type = buf.readUInt32LE(at + 4);
    const body = buf.subarray(at + 8, at + 8 + len);
    if (type === JSON_CHUNK) json = JSON.parse(body.toString('utf8'));
    else if (type === BIN_CHUNK && !bin) bin = body;
    at += 8 + len;
  }
  if (!json) throw new Error('GLB ohne JSON-Teil');
  return { json, bin };
}

export function writeGlb(json, bin) {
  const pad = (b, fill) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), fill)]) : b);
  const j = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const b = bin && bin.length ? pad(bin, 0) : null;
  const total = 12 + 8 + j.length + (b ? 8 + b.length : 0);
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(j.length, 12); out.writeUInt32LE(JSON_CHUNK, 16); j.copy(out, 20);
  if (b) { const at = 20 + j.length; out.writeUInt32LE(b.length, at); out.writeUInt32LE(BIN_CHUNK, at + 4); b.copy(out, at + 8); }
  return out;
}

// Jeder Schlüssel "bufferView" im JSON außer im Feld bufferViews selbst
// (Accessoren, Sparse, Bilder, KHR_draco_mesh_compression, …).
function remapViews(node, map, path = '') {
  if (Array.isArray(node)) { node.forEach((x, i) => remapViews(x, map, `${path}[${i}]`)); return; }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (k === 'bufferView' && typeof v === 'number') {
      if (!map.has(v)) throw new Error(`${path}.bufferView ${v} zeigt auf ein ausgelagertes Bild`);
      node[k] = map.get(v);
    } else remapViews(v, map, `${path}.${k}`);
  }
}

// buf: GLB. poolDir: Ordner der Ablage auf der Platte. uriPrefix: Weg vom
// Ordner des GLB zur Ablage, z. B. '../tex/'. Liefert das neue GLB und je
// Bild { file, bytes, fresh } (fresh: neu in der Ablage).
export function poolGlb(buf, { poolDir, uriPrefix }) {
  const { json, bin } = readGlb(buf);
  const views = json.bufferViews ?? [];
  const moved = new Set(), images = [];
  for (const img of json.images ?? []) {
    if (img.bufferView === undefined) continue;
    const v = views[img.bufferView];
    if ((v.buffer ?? 0) !== 0) throw new Error(`Bild ${img.name ?? ''} liegt nicht im eingebetteten Puffer`);
    const ext = EXT[img.mimeType];
    if (!ext) throw new Error(`Bild ${img.name ?? ''}: Typ ${img.mimeType} unbekannt`);
    const bytes = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const file = `${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.${ext}`;
    const target = join(poolDir, file);
    const fresh = !existsSync(target);
    if (fresh) { mkdirSync(poolDir, { recursive: true }); writeFileSync(target, bytes); }
    else if (statSync(target).size !== bytes.length) throw new Error(`Ablage ${file}: gleicher Name, andere Größe`);
    images.push({ file, bytes: bytes.length, fresh });
    moved.add(img.bufferView);
    delete img.bufferView;
    img.uri = uriPrefix + file;
  }
  if (!moved.size) return { glb: buf, images, before: buf.length, after: buf.length };
  // Puffer ohne die Bilder neu packen, jede Ansicht auf 4 Byte ausgerichtet
  const map = new Map(), keep = [], parts = [];
  let at = 0;
  views.forEach((v, i) => {
    if (moved.has(i)) return;
    if ((v.buffer ?? 0) !== 0) throw new Error(`bufferView ${i} liegt nicht im eingebetteten Puffer`);
    const pad = (4 - (at % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); at += pad; }
    parts.push(bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
    map.set(i, keep.length);
    keep.push({ ...v, byteOffset: at });
    at += v.byteLength;
  });
  const rest = { ...json };
  delete rest.bufferViews;
  remapViews(rest, map);
  rest.bufferViews = keep;
  const newBin = Buffer.concat(parts);
  rest.buffers = [{ ...json.buffers[0], byteLength: newBin.length }, ...(json.buffers ?? []).slice(1)];
  const glb = writeGlb(rest, newBin);
  return { glb, images, before: buf.length, after: glb.length };
}

// Datei an Ort und Stelle umstellen (bereits umgestellte bleiben, wie sie sind).
export function poolGlbFile(file, opts) {
  const buf = readFileSync(file);
  const r = poolGlb(buf, opts);
  if (r.glb !== buf) writeFileSync(file, r.glb);
  return r;
}

// Bildverweise eines GLB auf die Ablage (Dateinamen).
export function poolRefs(buf, uriPrefix) {
  const { json } = readGlb(buf);
  return (json.images ?? []).filter((i) => typeof i.uri === 'string' && i.uri.startsWith(uriPrefix)).map((i) => i.uri.slice(uriPrefix.length));
}

// Verwaiste Bilder der Ablage entfernen: alles, was kein GLB in glbDirs nennt.
export function prunePool(poolDir, glbDirs, uriPrefix) {
  const used = new Set();
  for (const d of glbDirs) for (const f of existsSync(d) ? readdirSync(d).filter((x) => x.endsWith('.glb')) : []) {
    for (const r of poolRefs(readFileSync(join(d, f)), uriPrefix)) used.add(r);
  }
  const removed = [];
  for (const f of existsSync(poolDir) ? readdirSync(poolDir) : []) {
    if (POOL_NAME.test(f) && !used.has(f)) { removed.push(f); unlinkSync(join(poolDir, f)); }
  }
  return { used: used.size, removed };
}
