// Items in 3D: backt ein Item (Rüstung, Waffe, Aufsatz) zu einem Web-Modell.
// Statisches Netz in Bindehaltung; je Kartensatz eine Farbkarte, eine
// Rauheits-/Metallkarte und eine Normalenkarte. Achsen wie im Viewer: Y oben,
// Blick nach +Z (CryEngine: Z oben, Blick +Y; x -> -x).
//
// Was der Bäcker an einem Material kennt, steht in scripts/lib/item3d-merkmale.mjs:
// Bildplätze werden nach ihrer Rolle in dieser Tabelle genommen, nie nach dem
// Dateinamen, und jedes Merkmal eines gezeichneten Teilmaterials geht als
// Befund ins Ergebnis. Ein Merkmal, das die Tabelle nicht kennt, hält das Item
// an (es kommt nicht in die Liste der Seite).
//
// Dateien kommen über einen „Anbieter“ (provider): entweder direkt aus der
// Data.p4k (Massenlauf) oder aus einem Rohordner (Probe). Siehe makeP4kProvider
// und makeDirProvider unten. Läuft auf dem Rechner mit Spielinstallation, nicht
// im Tor (Schiene C).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSkinMesh, readSkinMaterial } from '../lib/ivo-skin.mjs';
import { parseCryXml } from '../lib/cryxml.mjs';
import { readSkeleton } from '../lib/ivo-skeleton.mjs';
import { readDds, decodeLevel, levelBytes } from '../lib/dds-bc.mjs';
import { rolleVon, einordnen, aufdruckAufUv1, haelt, SHADER } from '../lib/item3d-merkmale.mjs';

// Pakete (sharp, gltf-transform, draco3d) aus dem Checkout; REPO lenkt um,
// wenn die Skripte als Kopie neben einem anderen Checkout laufen.
const REPO = process.env.REPO ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(join(REPO, 'package.json'));

// Format eines DDS-Kopfs, so wie readDds es nennt (bc1 … bc7, bc6h, r8,
// roh24 …), oder „?<Meldung>“, wenn readDds es nicht kennt.
export function ddsFormatOf(head) {
  try { return readDds(head).format; } catch (e) { return `?${e.message}`; }
}
const sharp = req('sharp');
const { Document, NodeIO } = await import(pathToFileURL(req.resolve('@gltf-transform/core')).href);
const { ALL_EXTENSIONS, KHRDracoMeshCompression, EXTTextureWebP, KHRTextureTransform } = await import(pathToFileURL(req.resolve('@gltf-transform/extensions')).href);
const { dedup, prune, draco } = await import(pathToFileURL(req.resolve('@gltf-transform/functions')).href);
const draco3d = req('draco3d');

// Backfassung: ändert sich, was gebacken wird, steigt sie, und der
// Massenlauf backt alles neu (Eingabe-Kennung).
// 4 (24.11.2026): Bildplätze nach der Merkmal-Tabelle statt nach Dateinamen;
// Glanzkarte und Glanz im Normalen-Alpha als Faktoren von Specular und
// Shininess; Illum-Aufdrucke (%DECAL) durchscheinend; Teilmaterial je Index
// mit Rückfall aufs eigene Material (vorher Löcher); fremdes Material an
// Anbauteilen verworfen; BC7 und unkomprimierte Bilder gelesen; feste
// Kachelung; Aufdrucke der 2. UV nur noch bei Waffen (decal_uv2); Abnutzung
// nur nach Wear des Items (dunkel zuerst); Schillern genähert; Schichtfarben
// mit demselben Spiegel-Metall-Wandler wie Illum; Palettenfarbe nach der
// Färbeart der Schicht (TintMode), Palette mal Tönung; Ausführung nach dem
// ganzen Tag am Record-Ende; Befunde je Item.
// 5: Teilnetz an Knoten 0 mitbewegt; Backgruppen nur bei gleichen Eingaben
// (Normale, Kachelung); versetzte Normalenkarte weggelassen statt verschoben;
// BC2 gelesen; unlesbare Mischkarte -> Grundschicht; Mipteile nach Breite
// gewählt; Schillern als geometrischer Median des Verlaufs.
// 6: Teilnetze mit verschiedenem Material auf denselben UV-Flächen in
// eigenen Sätzen; Abnutzungs- und Höhenkarte gehören zum Satz.
// Rückt gemeinsam mit der Tabelle (deren sha steht ebenfalls in der
// Eingabe-Kennung).
export const BAKE_VERSION = 6;
export const isWeapon = (item) => /^(WeaponPersonal|WeaponAttachment|Grenade|WeaponMining|Gadget)$/.test(item?.t ?? '');
export const norm = (p) => { let k = String(p).replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase(); if (!k.startsWith('data/')) k = `data/${k}`; return k; };

// ─── Anbieter ─────────────────────────────────────────────────────────────
// has(p) -> bool, read(p) -> Buffer|null,
// ddsParts(p, { alpha, maxW, headBuf }) -> { N: Buffer } (nur benötigte Stufen)
export function makeP4kProvider(p4k) {
  const index = new Map(), parts = new Map();
  for (const e of p4k.entries(/^Data[\\/](Objects|Materials|Textures)[\\/]/i)) {
    const k = e.name.replace(/\\/g, '/').toLowerCase();
    index.set(k, e);
    const m = k.match(/^(.*\.dds)\.(\d+a?|a)$/);
    if (m && m[2] !== 'a') { if (!parts.has(m[1])) parts.set(m[1], []); parts.get(m[1]).push(e); }
  }
  return {
    size: index.size,
    has: (p) => index.has(norm(p)),
    read: (p) => { const e = index.get(norm(p)); return e ? p4k.extract(e) : null; },
    // Kennung einer Quelle (CRC und Größe aus dem Archivverzeichnis, ohne zu
    // entpacken); „<x.dds>#teile“ bzw. „#a“: alle Mip-Teile des Bildes, je
    // Teil mit seiner Endung (zwei Teile, die ihren Inhalt tauschen, ändern
    // die Kennung)
    kennung(k) {
      const t = /^(.*)#(teile|a)$/.exec(k);
      if (t) return (parts.get(t[1]) ?? []).filter((e) => (t[2] === 'a') === /a$/i.test(e.name)).map((e) => `${e.name.slice(e.name.toLowerCase().lastIndexOf('.dds.') + 5)}:${e.crc}:${e.usize}`).sort().join(',') || '-';
      const e = index.get(k);
      return e ? `${e.crc}:${e.usize}` : '-';
    },
    ddsParts(p, { alpha = false, maxW = 1 << 14, headBuf } = {}) {
      const list = (parts.get(norm(p)) ?? []).filter((e) => alpha === /a$/i.test(e.name));
      const num = (e) => parseInt(e.name.slice(e.name.toLowerCase().lastIndexOf('.dds.') + 5), 10);
      // Breite jedes Teils nach seiner Größe (wie readDds die Stufen zuordnet),
      // nicht nach seinem Platz in der Liste: fehlt ein großer Teil, fiele
      // sonst der gewünschte heraus. Unbekannter Kopf: alle Teile.
      // Fällt jede Stufe bis maxW weg (Kopf ohne passende Stufe, kein Teil
      // klein genug), bleibt der kleinste Teil darüber, statt keine Stufe.
      let breite = () => null, kopfPasst = true;
      try {
        const d = readDds(headBuf);
        kopfPasst = d.levels.some((L) => L.w <= maxW);
        breite = (n) => { for (let l = 0; l < 16; l++) { const w = Math.max(1, d.width >> l), h = Math.max(1, d.height >> l); if (levelBytes(d.format, w, h) === n) return w; } return null; };
      } catch { /* Kopf unlesbar: readDds meldet es beim Laden */ }
      const out = {};
      let ersatz = null;
      for (const e of list) {
        const w = breite(e.usize);
        if (w !== null && w > maxW) { if (!ersatz || w < ersatz.w) ersatz = { e, w }; continue; }
        out[num(e)] = p4k.extract(e);
      }
      if (ersatz && !kopfPasst && !Object.keys(out).length) out[num(ersatz.e)] = p4k.extract(ersatz.e);
      return out;
    },
  };
}
export function makeDirProvider(raw) {
  const lower = new Map();
  (function walk(abs, rel) {
    for (const n of readdirSync(abs)) {
      const a = join(abs, n), r = rel ? `${rel}/${n}` : n;
      if (statSync(a).isDirectory()) walk(a, r); else lower.set(r.toLowerCase(), a);
    }
  })(join(raw, 'Data'), 'data');
  return {
    size: lower.size,
    has: (p) => lower.has(norm(p)),
    read: (p) => { const f = lower.get(norm(p)); return f ? readFileSync(f) : null; },
    kennung(k) {
      const t = /^(.*)#(teile|a)$/.exec(k);
      const st = (f) => { const x = statSync(f); return `${x.size}:${Math.round(x.mtimeMs)}`; };
      if (t) return [...lower].filter(([n]) => n.startsWith(`${t[1]}.`) && /\.\d+a?$/.test(n) && (t[2] === 'a') === n.endsWith('a')).map(([n, f]) => `${n.slice(t[1].length + 1)}:${st(f)}`).sort().join(',') || '-';
      const f = lower.get(k);
      return f ? st(f) : '-';
    },
    ddsParts(p, { alpha = false } = {}) {
      const pre = `${norm(p)}.`, out = {};
      for (const [k, f] of lower) {
        if (!k.startsWith(pre)) continue;
        const n = k.slice(pre.length);
        if (alpha ? /^\d+a$/.test(n) : /^\d+$/.test(n)) out[parseInt(n, 10)] = readFileSync(f);
      }
      return out;
    },
  };
}

// ─── kleine Helfer ────────────────────────────────────────────────────────
function parseTextXml(s) {
  const root = { tag: '#root', attr: {}, children: [] }, stack = [root];
  for (const m of s.matchAll(/<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g)) {
    const [, close, tag, attrs, self] = m;
    if (close) { stack.pop(); continue; }
    const node = { tag, attr: {}, children: [] };
    for (const a of attrs.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) node.attr[a[1]] = a[2];
    stack.at(-1).children.push(node);
    if (!self) stack.push(node);
  }
  return root.children[0];
}
const kid = (n, tag) => n?.children?.find((c) => c.tag === tag);
const kids = (n, tag) => n?.children?.filter((c) => c.tag === tag) ?? [];
function sample(im, u, v, out, o = 0) {
  const x = (u - Math.floor(u)) * im.w - 0.5, y = (v - Math.floor(v)) * im.h - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const X0 = ((x0 % im.w) + im.w) % im.w, X1 = (X0 + 1) % im.w, Y0 = ((y0 % im.h) + im.h) % im.h, Y1 = (Y0 + 1) % im.h;
  const d = im.data;
  for (let c = 0; c < 4; c++) {
    const a = d[(Y0 * im.w + X0) * 4 + c], b = d[(Y0 * im.w + X1) * 4 + c], e = d[(Y1 * im.w + X0) * 4 + c], f = d[(Y1 * im.w + X1) * 4 + c];
    out[o + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy;
  }
  return out;
}
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const f3 = (s, d = 1) => (s ? String(s).split(',').map(Number) : [d, d, d]);
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// Lage aus Quaternion (x, y, z, w) und Ort: aussen ∘ innen
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qrot = (q, v) => { const r = qmul(qmul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]); return [r[0], r[1], r[2]]; };
const composeXf = (outer, inner) => ({ q: qmul(outer.q, inner.q), t: qrot(outer.q, inner.t).map((x, i) => x + outer.t[i]) });

// Knotenbaum einer .cga (IVO-Chunk 0x70697FDA, „NodeMeshCombo"): Kopf 32 B
// (u32 bei 4 = Zahl der Knoten), danach je Knoten 208 B. Bei +32 und +80 je
// eine 3×4-Matrix (Zeilen: Basis + Ort); bei +148 u16 Elternknoten (0xFFFF =
// Wurzel). Teilnetze in der .cgam tragen den Knoten (sub.node); ihre Ecken
// stehen im Raum dieses Knotens. Geprüft gegen „starbreaker nmc dump“
// (nmc-probe.mjs). Liefert null ohne Chunk.
export const NMC_MATRIX = 80;
export function readNmc(buf) {
  if (!buf || buf.length < 16 || buf.toString('latin1', 0, 4) !== '#ivo') return null;
  const n = buf.readUInt32LE(8), tab = buf.readUInt32LE(12);
  let off = -1;
  for (let i = 0; i < n; i++) { const o = tab + i * 16; if (buf.readUInt32LE(o) >>> 0 === 0x70697fda) off = Number(buf.readBigUInt64LE(o + 8)); }
  if (off < 0) return null;
  const count = buf.readUInt32LE(off + 4);
  if (!count || off + 32 + count * 208 > buf.length) return null;
  const nodes = [];
  for (let k = 0; k < count; k++) {
    const b = off + 32 + k * 208;
    const mat = (at) => [0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => buf.readFloatLE(b + at + (r * 4 + c) * 4)));
    const par = buf.readUInt16LE(b + 148);
    nodes.push({ index: k, parent: par === 0xffff ? null : par, a: mat(32), b: mat(80), m: mat(NMC_MATRIX), name: null });
  }
  // Namen: hinter den Knoten, nullgetrennt; der Kopf nennt bei +20 ihre
  // Länge in Bytes. Gesucht wird der erste Anfang, ab dem genau so viele
  // Bezeichner mit dieser Gesamtlänge stehen.
  const lang = buf.readUInt32LE(off + 20), ende = Math.min(buf.length, off + 32 + count * 208 + 4096 + lang);
  for (let p = off + 32 + count * 208; p + lang <= ende; p++) {
    const teil = buf.toString('latin1', p, p + lang).split('\0');
    if (teil.length !== count + 1 || teil[count] !== '' || !teil.slice(0, count).every((t) => /^[\x21-\x7e]+$/.test(t))) continue;
    teil.slice(0, count).forEach((t, k) => { nodes[k].name = t; });
    break;
  }
  return nodes;
}
const isIdent = (m) => !m || [0, 1, 2].every((r) => [0, 1, 2, 3].every((c) => Math.abs(m[r][c] - (r === c ? 1 : 0)) < 1e-6));
const applyM = (m, v, w = 1) => [0, 1, 2].map((r) => m[r][0] * v[0] + m[r][1] * v[1] + m[r][2] * v[2] + (w ? m[r][3] : 0));
// 3×4-Matrix (Zeilen) → { q: [x, y, z, w], t }, wie die Knochen der .chr
const matXf = (m) => {
  const [[a, b, c], [d, e, f], [g, h, k]] = m;
  const tr = a + e + k;
  let q;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); q = [(h - f) * s, (c - g) * s, (d - b) * s, 0.25 / s]; }
  else if (a > e && a > k) { const s = 2 * Math.sqrt(1 + a - e - k); q = [0.25 * s, (b + d) / s, (c + g) / s, (h - f) / s]; }
  else if (e > k) { const s = 2 * Math.sqrt(1 + e - a - k); q = [(b + d) / s, 0.25 * s, (f + h) / s, (c - g) / s]; }
  else { const s = 2 * Math.sqrt(1 + k - a - e); q = [(c + g) / s, (f + h) / s, 0.25 * s, (d - b) / s]; }
  const l = Math.hypot(...q);
  return { q: q.map((x) => x / l), t: [m[0][3], m[1][3], m[2][3]] };
};

// Größenbeschränkter Zwischenspeicher (zuletzt benutzt bleibt)
class Lru {
  constructor(maxBytes) { this.max = maxBytes; this.map = new Map(); this.bytes = 0; }
  get(k) { if (!this.map.has(k)) return undefined; const v = this.map.get(k); this.map.delete(k); this.map.set(k, v); return v.val; }
  set(k, val, bytes) {
    if (this.map.has(k)) { this.bytes -= this.map.get(k).bytes; this.map.delete(k); }
    this.map.set(k, { val, bytes }); this.bytes += bytes;
    while (this.bytes > this.max && this.map.size > 1) { const [k0, v0] = this.map.entries().next().value; this.map.delete(k0); this.bytes -= v0.bytes; }
  }
}

// ─── Bäcker ───────────────────────────────────────────────────────────────
// refs: { guid: { name, data } } (Paletten-Records aus dem DataCore)
export async function createBaker({ provider, refs, tex = 1024, lod = 1, wearScale = 0.25, cacheMb = 400, log = () => {} }) {
  const TEX = tex;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  // Quellen des laufenden Items: jede Datei, die der Bau liest, auch aus dem
  // Zwischenspeicher. Der Massenlauf bildet daraus die Quellen-Kennung und
  // backt neu, sobald sich eine davon im Archiv ändert (Material, Bild, Netz),
  // nicht nur, wenn sich der Record ändert.
  const quellen = new Set();
  const quelle = (p) => { if (p) quellen.add(norm(p)); };
  const p0 = provider;
  provider = {
    ...p0,
    // auch Existenzfragen: kommt eine gesuchte Datei (LOD, Material,
    // Glanz) mit einem Patch dazu, ändert sich ihre Kennung von „-“
    has: (p) => { quelle(p); return p0.has(p); },
    read: (p) => { quelle(p); return p0.read(p); },
    ddsParts: (p, o) => { quellen.add(`${norm(p)}#${o?.alpha ? 'a' : 'teile'}`); return p0.ddsParts(p, o); },
  };
  const xmlCache = new Lru(64 * 1024 * 1024);
  const xml = (p) => {
    if (!p) return null;
    const k = norm(p);
    quelle(p); if (!/\.mtl$/i.test(p)) quelle(`${p}.mtl`);
    const c = xmlCache.get(k);
    if (c !== undefined) return c;
    let b = provider.read(p);
    if (!b && !/\.mtl$/i.test(p)) b = provider.read(`${p}.mtl`);
    let r = null;
    if (b) r = b.subarray(0, 8).toString('latin1') === 'CryXmlB\0' ? parseCryXml(b) : parseTextXml(b.toString('utf8'));
    xmlCache.set(k, r, b ? b.length * 2 : 64);
    return r;
  };
  const imgCache = new Lru(cacheMb * 1024 * 1024);
  // Zustand jedes benutzten Bildes im laufenden Item: Format (wie readDds es
  // nennt), „fehlt“ oder „?<Meldung>“ (Format unbekannt); dazu, ob das
  // Entpacken scheiterte. Daraus werden die Befunde „Format …“. Ein Fehler
  // bleibt stehen, auch wenn dasselbe Bild in anderer Größe gelang.
  let bilder = new Map();
  const schlecht = (z) => !!z && (!!z.kaputt || z.format === 'fehlt' || String(z.format).startsWith('?'));
  function merkeBild(base, zustand) { if (!schlecht(bilder.get(base))) bilder.set(base, zustand); }
  function lade(base, headName, alpha, maxW) {
    const head = provider.read(headName);
    if (!head) return { im: null, zustand: { format: 'fehlt' } };
    let format;
    try {
      const dds = readDds(head, provider.ddsParts(`${base}.dds`, { alpha, maxW, headBuf: head }));
      format = dds.format;
      // erste Stufe bis maxW; sonst die kleinste vorhandene
      const lv = dds.levels.find((l) => l.w <= maxW) ?? dds.levels.reduce((a, b) => (b.w < a.w ? b : a), dds.levels[0]);
      const im = decodeLevel(dds, lv.level);
      im.format = dds.format;
      return { im, zustand: { format } };
    } catch (e) {
      log(`  ! Bild ${headName}: ${e.message}`);
      return { im: null, zustand: format ? { format, kaputt: e.message } : { format: `?${e.message}` } };
    }
  }
  function texture(p, maxW = TEX) {
    const base = norm(p).replace(/\.(tif|png|dds|tga)$/i, '');
    const k = `${base}|${maxW}`;
    const c = imgCache.get(k);
    if (c !== undefined) { merkeBild(base, c.zustand); quelle(`${base}.dds`); quellen.add(`${base}.dds#teile`); return c.im; }
    const { im, zustand } = lade(base, `${base}.dds`, false, maxW);
    merkeBild(base, zustand);
    imgCache.set(k, { im, zustand }, im ? im.data.length * (im.data.BYTES_PER_ELEMENT ?? 1) : 64);
    return im;
  }
  // Glanz im Alphakanal der Normalenkarte (abgetrennt als .dds.a); ohne ihn
  // null (Ersatzglanz). Ist er da, aber nicht lesbar, steht das im Befund.
  function glossOf(p, maxW = 256) {
    const base = norm(p).replace(/\.(tif|png|dds|tga)$/i, '');
    const k = `${base}|a|${maxW}`;
    const c = imgCache.get(k);
    if (c !== undefined) { quelle(`${base}.dds.a`); quellen.add(`${base}.dds#a`); if (c.zustand) merkeBild(`${base}.a`, c.zustand); return c.im; }
    const { im, zustand } = provider.has(`${base}.dds.a`) ? lade(base, `${base}.dds.a`, true, maxW) : { im: null, zustand: null };
    if (zustand) merkeBild(`${base}.a`, zustand);
    imgCache.set(k, { im, zustand }, im ? im.data.length * (im.data.BYTES_PER_ELEMENT ?? 1) : 64);
    return im;
  }
  const layerCache = new Map();
  function layerOf(path) {
    const k = norm(path || '');
    // dieselben Kandidaten wie xml() (mit dem Rückfall auf „.mtl“), auch bei
    // einem Treffer im Zwischenspeicher
    if (path) { quelle(path); if (!/\.mtl$/i.test(path)) quelle(`${path}.mtl`); }
    if (layerCache.has(k)) return layerCache.get(k);
    let r = { diffuse: [0.5, 0.5, 0.5], spec: [0.04, 0.04, 0.04], shin: 128, missing: true };
    const x = path ? xml(path) : null;
    if (x) {
      const at = x.attr ?? {};
      const texs = kids(kid(x, 'Textures'), 'Texture');
      // Schichtmaterial: Farbe auf TexSlot1, Normalen samt Glanz (Alpha) auf
      // TexSlot2. Liegt eine Farbkarte nur auf einem anderen Platz, meldet
      // das der Befund „Schichtfarbe nicht auf TexSlot1“ (unbekannt, hält an).
      const t1 = texs.find((t) => t.attr.Map === 'TexSlot1')?.attr.File;
      const t2 = texs.find((t) => t.attr.Map === 'TexSlot2')?.attr.File;
      const farbeAnderswo = !t1 && texs.some((t) => /_diff/i.test(t.attr.File ?? ''));
      const pp = kid(x, 'PublicParams')?.attr ?? {};
      r = { diffuse: f3(at.Diffuse), spec: f3(at.Specular, 0.04), shin: Number(at.Shininess ?? 255), t1, t2, tintMode: Number(pp.TintMode ?? 1), missing: false, farbeAnderswo };
    }
    layerCache.set(k, r);
    return r;
  }

  // Material, wenn der Eintrag keins nennt: erst der Name im Netz selbst
  // (IVO-Kopf), dann <netz>.mtl und <netz>_01_01_01.mtl daneben.
  function mtlFromMesh(path) {
    if (!/\.(skin|cgf|cga)$/i.test(path)) {
      const guess = path.replace(/(_lod\d)?\.(cdf)$/i, '.mtl');
      return provider.has(guess) ? guess : '';
    }
    const dir = String(path).replace(/\\/g, '/').replace(/[^/]*$/, '');
    try {
      const head = provider.read(path);
      const name = head ? readSkinMaterial(head) : null;
      if (name) {
        const n = name.replace(/\\/g, '/').replace(/\.mtl$/i, '');
        for (const c of [`${n}.mtl`, `${dir}${n}.mtl`, `${dir}${n.split('/').pop()}.mtl`]) if (provider.has(c)) return c;
      }
    } catch { /* kein IVO-Kopf */ }
    for (const c of [path.replace(/(_lod\d)?\.(skin|cgf|cga)$/i, '.mtl'), path.replace(/(_lod\d)?\.(skin|cgf|cga)$/i, '_01_01_01.mtl')]) if (provider.has(c)) return c;
    return '';
  }
  // Rüstung: Weltgeometrie = Loot-Kiste; die getragene Fassung steht als
  // SubGeometry mit Tag „Male“ (sonst „Female“) samt Material und Palette.
  function variantOf(item) {
    const g = item.geo?.Geometry;
    const subs = g?.SubGeometry ?? [];
    const tag = (s) => (s.Tags || '').toLowerCase().split(/\s+/);
    const male = subs.find((s) => tag(s).includes('male'));
    const female = subs.find((s) => tag(s).includes('female'));
    // Ausführung: der Tag, auf den der Record-Name endet (…_black_gold01 ->
    // „Black_gold01“). Vorher zählte nur das letzte Wortstück („gold01“), und
    // Tags mit Unterstrich gingen verloren: Waffe in der Grundausführung.
    const rec = String(item.record || '').toLowerCase();
    let own = null, ownLen = 0;
    for (const s of subs) for (const t of tag(s)) if (t && t.length > ownLen && rec.endsWith(`_${t}`)) { own = s; ownLen = t.length; }
    // Rückfall: dieselben Buchstaben und Ziffern in anderer Reihenfolge der
    // Stücke (Record …_luminalia_red01, Tag „Luminalia01_red“)
    if (!own) {
      const zerl = (x) => `${x.replace(/[^a-z]/g, '')}|${x.replace(/[^0-9]/g, '')}`;
      const teile = rec.split('_');
      for (const s of subs) for (const t of tag(s)) {
        const n = t.split('_').length;
        if (t && /[a-z]/.test(t) && /\d/.test(t) && teile.length > n && zerl(teile.slice(-n).join('_')) === zerl(t)) own = s;
      }
    }
    const pick = male ?? own ?? female ?? g;
    // Endet der Record auf eine Ausführung (Buchstaben im letzten Stück, nicht
    // nur „_01“ wie die Grundausführung) und keine passt, obwohl das Netz
    // Ausführungen mit eigenem Material oder eigener Palette hat: Befund
    // „Ausführung nicht gefunden“ (hält an).
    const ANSICHT = /^(male|female|heldentity|inventorystoredentity|tabledisplay|hanging|fp|empty)$/;
    const offen = pick === g && /[a-z]/.test(rec.split('_').pop()) ? subs.filter((s) => (s.Geometry?.Material?.path || s.Geometry?.Palette?.RootRecord?.__ref) && !tag(s).some((t) => ANSICHT.test(t))).map((s) => s.Tags) : [];
    const G = pick?.Geometry;
    // Danach das Material am Eintrag selbst (Rucksack-Editionen: dieselbe
    // Geometrie, Farbe nur über geo.Material.Material), erst zuletzt der Netzkopf.
    let mtl = G?.Material?.path || g?.Geometry?.Material?.path || female?.Geometry?.Material?.path || item.geo?.Material?.Material?.path || '';
    const path = G?.Geometry?.path;
    if (!mtl && path) mtl = mtlFromMesh(path);
    // Palette: an der getragenen Fassung, sonst an der Hauptgeometrie oder am
    // Material des Eintrags (Rucksäcke: geo.Material.Palette)
    const hasRoot = (x) => (x?.RootRecord?.__ref ? x : null);
    const palette = hasRoot(G?.Palette) ?? hasRoot(G?.Material?.Palette) ?? hasRoot(g?.Geometry?.Palette) ?? hasRoot(g?.Geometry?.Material?.Palette) ?? hasRoot(item.geo?.Material?.Palette) ?? null;
    // Bringt der Eintrag selbst Farbe mit (Palette oder Material), ist die
    // Grundausführung mit ihr gewollt (Editionen ohne eigenen Tag)
    if (palette || item.geo?.Material?.Material?.path) offen.length = 0;
    return { path, mtl, palette, offen, wear: G?.Wear ?? 0, which: male ? 'male' : own ? 'own' : female ? 'female' : 'main' };
  }
  // Palette des Items. Die DefaultPalette mancher Materialien gilt im Spiel
  // nicht (Monolith „Shadowflux“: mit ihr oliv, im Spiel grau-blau); ohne
  // Palette behalten Schichten ihre Tönung (Befund „Palettenplatz ohne Palette“).
  function paletteOf(item) {
    const pal = variantOf(item).palette;
    const ref = pal?.RootRecord?.__ref;
    const root = ref ? refs[ref]?.data?.root : null;
    if (!root) return null;
    let node = root;
    for (const step of (pal.ChildPath || '').split('/').filter(Boolean)) node = node?.children?.find((ch) => ch?.name?.toLowerCase() === step.toLowerCase()) ?? node;
    const e = (x) => x?.tintColor && { tint: [x.tintColor.r, x.tintColor.g, x.tintColor.b].map((v) => toLin(v / 255)), spec: x.specColor ? [x.specColor.r, x.specColor.g, x.specColor.b].map((v) => toLin(v / 255)) : null, gloss: x.glossiness };
    return { name: ref && refs[ref].name, path: pal.ChildPath, a: e(node?.entryA), b: e(node?.entryB), c: e(node?.entryC) };
  }
  function geomOf(item) {
    const { path, mtl } = variantOf(item);
    if (!path) return [];
    if (/\.cdf$/i.test(path)) {
      const x = xml(path);
      const atts = [];
      const weapon = isWeapon(item);
      (function w(n) {
        if (!n) return;
        if (n.tag === 'Attachment' && /\.(skin|cgf|cga)$/i.test(n.attr.Binding ?? '')) {
          const a = n.attr;
          // Waffen: Patronen im Verschluss (CA_BONE auf …/ammo/…) zeigen nichts
          if (!(weapon && a.Type === 'CA_BONE' && /[\\/]ammo[\\/]/i.test(a.Binding))) {
            atts.push({ skin: a.Binding, mtl: mtl || a.Material || mtlFromMesh(a.Binding), own: a.Material || mtlFromMesh(a.Binding) || null, type: a.Type ?? null, bone: a.BoneName ?? null, relPos: a.RelPosition ?? null, relRot: a.RelRotation ?? null });
          }
        }
        for (const c of n.children ?? []) w(c);
      })(x);
      // Mehrere Anhänge: das Material der Variante kann einem Teil fremd sein
      // (Schaft, Visier, Anhänger mit eigenem Material). Bei einem einzelnen
      // Netz gilt das der Variante immer; der Materialname im Netzkopf ist
      // dort oft ein Überbleibsel (Stirling-Anzug trägt den eines Helms).
      if (atts.length > 1) for (const a of atts) a.mehrteilig = true;
      if (weapon && atts.some((a) => a.type === 'CA_BONE' && a.bone)) {
        const bones = bonesOf(item);
        for (const a of atts) {
          if (a.type !== 'CA_BONE' || !a.bone) continue;
          const bn = bones?.find((b) => b.name?.toLowerCase() === a.bone.toLowerCase());
          if (!bn) { a.xfFehlt = true; continue; }
          // RelRotation: w,x,y,z; Knochen: x,y,z,w (Modellraum der Bindehaltung)
          const rq = a.relRot ? String(a.relRot).split(',').map(Number) : [1, 0, 0, 0];
          const rel = { q: [rq[1], rq[2], rq[3], rq[0]], t: a.relPos ? String(a.relPos).split(',').map(Number) : [0, 0, 0] };
          a.xf = composeXf(bn.world, rel);
        }
      }
      const model = kid(x, 'Model')?.attr?.File;
      if (!atts.length && model && /\.cg[af]$/i.test(model)) {
        let m2 = mtl || kid(x, 'Model')?.attr?.Material || '';
        if (!m2) { const g2 = model.replace(/\.cg[af]$/i, '.mtl'); if (provider.has(g2)) m2 = g2; }
        // .cga mit eigenem Materialnamen im Kopf (CQ7, Pulverizer, Magazine)
        if (!m2) m2 = mtlFromMesh(model);
        atts.push({ skin: model, mtl: m2, own: kid(x, 'Model')?.attr?.Material || mtlFromMesh(model) || null });
      }
      return atts;
    }
    if (/\.(skin|cgf|cga)$/i.test(path)) return [{ skin: path, mtl: mtl || mtlFromMesh(path), own: mtlFromMesh(path) || null }];
    return [];
  }
  // Knochen der Waffe (Bindehaltung, Modellraum) aus der .chr ihrer .cdf
  function bonesOf(item) {
    const { path } = variantOf(item);
    if (!path || !/\.cdf$/i.test(path)) return null;
    const chr = kid(xml(path), 'Model')?.attr?.File;
    // .cga: Knoten aus dem Knotenbaum (Lage im Raum des Modells)
    if (chr && /\.cga$/i.test(chr)) {
      const nodes = readNmc(provider.read(chr));
      return nodes ? nodes.filter((n) => n.name).map((n) => ({ name: n.name, world: matXf(n.m) })) : null;
    }
    if (!chr || !/\.chr$/i.test(chr)) return null;
    try { const b = provider.read(chr); return b ? readSkeleton(b) : null; } catch (e) { log(`  ! Skelett ${chr}: ${e.message}`); return null; }
  }
  // Anhänge samt Kindern (Serienmagazin): jedes Kind am Knoten seines Ports,
  // mit eigener Palette.
  function allAtts(item, bau = () => {}) {
    const atts = geomOf(item);
    if (!item.kids?.length) return atts;
    const bones = bonesOf(item);
    for (const k of item.kids) {
      const bn = bones?.find((b) => b.name?.toLowerCase() === k.helper.toLowerCase());
      if (!bn) { log(`  ! Knoten ${k.helper} fehlt: ${k.record} bleibt weg`); bau('Bau Magazin fehlt'); continue; }
      const o = k.offset ?? {};
      const deg = Math.PI / 180, r = o.Rotation ?? {};
      // Versatz in Grad (x, y, z) und Metern; bei Waffen bisher immer null
      const cx = Math.cos((r.x ?? 0) * deg / 2), sx = Math.sin((r.x ?? 0) * deg / 2), cy = Math.cos((r.y ?? 0) * deg / 2), sy = Math.sin((r.y ?? 0) * deg / 2), cz = Math.cos((r.z ?? 0) * deg / 2), sz = Math.sin((r.z ?? 0) * deg / 2);
      const off = { q: qmul(qmul([0, 0, sz, cz], [0, sy, 0, cy]), [sx, 0, 0, cx]), t: [o.Position?.x ?? 0, o.Position?.y ?? 0, o.Position?.z ?? 0] };
      const base = composeXf(bn.world, off);
      const kitem = { id: `${item.id}~${k.port}`, t: 'WeaponAttachment', record: k.record, geo: k.geo };
      const kpal = paletteOf(kitem);
      for (const a of geomOf(kitem)) {
        a.xf = a.xf ? composeXf(base, a.xf) : base;
        a.pal = kpal;
        // Ohne eigene Palette trägt das Anbauteil die der Waffe (wie der
        // Hauptteil); als Näherung gemeldet, damit es im Befund sichtbar ist.
        a.palVomTraeger = !kpal;
        a.kind = k.port;
        atts.push(a);
      }
    }
    return atts;
  }
  function lodPath(skin, l) {
    if (!l) return skin;
    const p = skin.replace(/(_lod\d)?\.(skin|cga|cgf)$/i, `_lod${l}.$2`);
    return provider.has(p) ? p : skin;
  }
  // UV außerhalb von 0..1 (Zierleisten-Atlas, wiederholt) wird in die Kachel
  // zurückgelegt, wie der Sampler sie wiederholt; vorher fiel es weg, und die
  // Fläche blieb schwarz (Schaft der Killshot).
  // uv2/d2: Aufdruck der 2. UV; d2 nimmt je Texel deren Koordinate auf
  // (NaN, wo das Teilnetz keinen Aufdruck hat).
  function rasterUv(mask, S, uv, idx, id, uv2 = null, d2 = null) {
    for (let t = 0; t < idx.length; t += 3) {
      const Q = [0, 1, 2].map((k) => [uv[idx[t + k] * 2], uv[idx[t + k] * 2 + 1]]);
      const U2 = uv2 ? [0, 1, 2].map((k) => [uv2[idx[t + k] * 2], uv2[idx[t + k] * 2 + 1]]) : null;
      const u0 = Math.floor(Math.min(Q[0][0], Q[1][0], Q[2][0])), u1 = Math.ceil(Math.max(Q[0][0], Q[1][0], Q[2][0])) - 1;
      const v0 = Math.floor(Math.min(Q[0][1], Q[1][1], Q[2][1])), v1 = Math.ceil(Math.max(Q[0][1], Q[1][1], Q[2][1])) - 1;
      if (!Number.isFinite(u0 + u1 + v0 + v1) || (u1 - u0 + 1) * (v1 - v0 + 1) > 64) continue;
      for (let tu = u0; tu <= Math.max(u0, u1); tu++) for (let tv = v0; tv <= Math.max(v0, v1); tv++) rasterTri(mask, S, Q.map(([u, v]) => [(u - tu) * S, (v - tv) * S]), id, U2, d2);
    }
  }
  function rasterTri(mask, S, P, id, U2 = null, d2 = null) {
    {
      const [a, b, c] = P;
      const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxX = Math.min(S - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxY = Math.min(S - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      if (Math.abs(area) < 1e-9) return;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area;
        const w1 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) {
          const j = y * S + x;
          mask[j] = id;
          if (d2) {
            if (U2) { d2[j * 2] = w0 * U2[0][0] + w1 * U2[1][0] + w2 * U2[2][0]; d2[j * 2 + 1] = w0 * U2[0][1] + w1 * U2[1][1] + w2 * U2[2][1]; }
            else d2[j * 2] = NaN;
          }
        }
      }
    }
  }
  function dilate(rgba, mask, S, rounds = 6) {
    let m = mask.slice();
    for (let r = 0; r < rounds; r++) {
      const nm = m.slice();
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = y * S + x;
        if (m[i]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= S || Y >= S) continue;
          const j = Y * S + X;
          if (m[j]) { for (let c = 0; c < 4; c++) rgba[i * 4 + c] = rgba[j * 4 + c]; nm[i] = m[j]; break; }
        }
      }
      m = nm;
    }
  }
  // ─── Bildplätze und Merkmale eines Teilmaterials ──────────────────────
  // Rolle -> Datei, nach der Tabelle (scripts/lib/item3d-merkmale.mjs), nie
  // nach dem Dateinamen. $-Bilder der Engine (Paletten-Schablonen,
  // Bildschirminhalt) haben keine Datei und keine Rolle hier.
  function rollen(sx) {
    const shader = sx.attr?.Shader ?? '?';
    const r = {};
    for (const t of kids(kid(sx, 'Textures'), 'Texture')) {
      const f = t.attr.File ?? '';
      if (!f || f.startsWith('$')) continue;
      const ro = rolleVon(shader, t.attr.Map);
      if (ro && !(ro in r)) r[ro] = f;
    }
    return r;
  }
  // Feste Kachelung und fester Versatz des Platzes einer Rolle (<TexMod>);
  // null, wenn das Bild unverändert liegt. Bewegung (Oszillator) zählt nicht.
  function texModVon(sx, rolle) {
    const shader = sx.attr?.Shader ?? '?';
    const t = kids(kid(sx, 'Textures'), 'Texture').find((x) => x.attr.File && rolleVon(shader, x.attr.Map) === rolle);
    const a = kid(t, 'TexMod')?.attr;
    if (!a) return null;
    const n = (k, d) => (a[k] !== undefined && Number.isFinite(Number(a[k])) ? Number(a[k]) : d);
    const tm = { tu: n('TileU', 1), tv: n('TileV', 1), ou: n('OffsetU', 0), ov: n('OffsetV', 0) };
    return tm.tu === 1 && tm.tv === 1 && !tm.ou && !tm.ov ? null : tm;
  }
  // Arten der Bildbewegung eines <TexMod>; ein unbekannter Eintrag kommt
  // unter seinem eigenen Namen zurück (die Tabelle kennt ihn nicht: hält an).
  function texModArten(a, rolle) {
    const arten = new Set();
    for (const [k, v] of Object.entries(a)) {
      const x = Number(v);
      if (/^Tile[UV]$/.test(k)) { if (x !== 1) arten.add(/^normale/.test(rolle ?? '') ? 'KachelungNormale' : 'Kachelung'); }
      else if (/^Offset[UV]$/.test(k)) { if (x) arten.add(/^normale/.test(rolle ?? '') ? 'KachelungNormale' : 'Versatz'); }
      else if (/^Rotate[UVW]$/.test(k)) { if (x) arten.add('Drehung'); }
      else if (/^TexMod_[UVW]?(Rotate|Oscillator)/.test(k)) { if (x && !/Center$/.test(k)) arten.add('Bewegung'); }
      else arten.add(k);
    }
    return arten;
  }
  // Attribute ohne Bildwirkung oder anderswo erfasst: Name, Shader, Schalter
  // (StringGenMask; GenMask ist dieselbe Angabe als Zahl), Physik
  // (SurfaceType), Kanten- und Schattenschalter (MtlFlags), Eckenverformung
  // (vertModifType), Schicht-Ein/Aus des Editors (LayerAct), Vorlage.
  const AUSSER = new Set(['Name', 'Shader', 'StringGenMask', 'MtlFlags', 'SurfaceType', 'GenMask', 'vertModifType', 'LayerAct', 'MatTemplate']);
  const WERTE_BEKANNT = new Set(['Diffuse', 'Specular', 'Shininess', 'Emissive', 'Glow', 'Opacity', 'AlphaTest', 'MatSubTemplate']);
  // Merkmale (Schlüssel für einordnen()) eines gezeichneten Teilmaterials.
  // uv1: %DECALS mit Waffen-Aufdruck aus decal_uv2/ (Ausnahme der Tabelle).
  // palette: die des Items (oder des Anbauteils), für „Bau Palettenplatz“.
  function merkmaleVon(sx, waffe, palette) {
    const at = sx.attr ?? {};
    const S = at.Shader ?? '?';
    const flags = String(at.StringGenMask ?? '').split('%').filter(Boolean);
    const texs = kids(kid(sx, 'Textures'), 'Texture');
    const slot9 = texs.find((t) => t.attr.Map === 'TexSlot9')?.attr.File;
    const uv1 = S === 'LayerBlend_V2' && flags.includes('DECALS') && aufdruckAufUv1({ waffe, datei: slot9 });
    const q = (k) => (uv1 && (k === `${S} %DECALS` || k === `${S} TexSlot9`) ? `${k} | Waffe decal_uv2` : k);
    const out = new Set([`Shader ${S}`]);
    for (const f of flags) out.add(q(`${S} %${f}`));
    for (const t of texs) {
      if (!t.attr.File) continue;
      const platz = q(`${S} ${t.attr.Map}`);
      out.add(platz);
      // Bildbewegung zählt nur an Plätzen, die gebacken werden
      const tm = kid(t, 'TexMod')?.attr;
      if (tm && einordnen(platz).art === 'ja') for (const k of texModArten(tm, rolleVon(S, t.attr.Map))) out.add(`${S} TexMod ${k}`);
    }
    for (const k of Object.keys(at)) if (!AUSSER.has(k) && !WERTE_BEKANNT.has(k)) out.add(`${S} Wert ${k}`);
    const zahl = (k, d) => (at[k] === undefined || !Number.isFinite(Number(at[k])) ? d : Number(at[k]));
    if (f3(at.Emissive, 0).some((x) => x > 0) && zahl('Glow', 0) > 0) out.add(`${S} Wert Leuchten`);
    if (zahl('Opacity', 1) < 1) out.add(`${S} Wert Opacity`);
    if (zahl('AlphaTest', 0) > 0) out.add(`${S} Wert AlphaTest`);
    // Je Schicht: Färbeart (TintMode) und Palettenplatz. Ein Wert, den die
    // Tabelle nicht führt, hält das Item an, statt still wie Lack zu gelten.
    for (const l of kids(kid(sx, 'MatLayers'), 'Layer')) {
      const L = layerOf(l.attr.Path);
      if (L.farbeAnderswo) out.add('Bau Schichtfarbe nicht auf TexSlot1');
      if (!L.missing) out.add(`Bau Färbeart ${L.tintMode}`);
      const pt = String(l.attr.PaletteTint ?? '0').trim();
      if (pt === '0') continue;
      const e = /^[123]$/.test(pt) ? ['a', 'b', 'c'][Number(pt) - 1] : null;
      out.add(!e ? `Bau Palettenplatz ${pt}` : !palette ? 'Bau Palettenplatz ohne Palette' : !palette[e] ? 'Bau Palettenplatz ohne Eintrag' : `Bau Palettenplatz ${pt}`);
    }
    return { keys: [...out], uv1, flags };
  }
  const fmtCache = new Map();
  function fmtOf(file) {
    const base = norm(file).replace(/\.(tif|png|dds|tga)$/i, '');
    quelle(`${base}.dds`);
    if (fmtCache.has(base)) return fmtCache.get(base);
    const head = provider.read(`${base}.dds`);
    const f = head ? ddsFormatOf(head) : 'fehlt';
    fmtCache.set(base, f);
    return f;
  }

  // ─── Material eines Teilnetzes ───────────────────────────────────────
  // Teilmaterialien einer .mtl; ohne <SubMaterials> gilt die Datei selbst
  // für alle Teilnetze.
  function teile(x) {
    if (!x) return null;
    const list = kids(kid(x, 'SubMaterials'), 'Material');
    return { list, ganz: !list.length && x.attr?.Shader ? x : null };
  }
  const teilAn = (T, i) => (T ? (T.ganz ?? T.list[i] ?? null) : null);
  const nameVon = (sx) => String(sx?.attr?.Name ?? '').toLowerCase();
  // Stamm eines Materialnamens: ohne Ordner, .mtl, „_mat“ und Nummern am Ende
  const stamm = (p) => String(p ?? '').replace(/\\/g, '/').split('/').pop().toLowerCase().replace(/\.mtl$/, '').replace(/(_mat)?(_\d+)*$/, '');
  const stammtVon = (variante, eigen) => { const e = stamm(eigen); return !!e && stamm(variante).startsWith(e); };

  // CryEngine-Spiegelfarbe (Specular) samt Grundfarbe in Metall und Farbe
  // umrechnen, wie der Wandler von KHR_materials_pbrSpecularGlossiness: ein
  // Wert unter 4 % ist nichtmetallisch, volle Spiegelfarbe ist Metall in
  // dieser Farbe, dazwischen gleitend. Vorher galt ab 20 % alles als Metall.
  const DIEL = 0.04;
  const hellOf = (c) => Math.sqrt(0.299 * c[0] * c[0] + 0.587 * c[1] * c[1] + 0.114 * c[2] * c[2]);
  function specZuMetall(d, s) {
    const rest = 1 - Math.max(s[0], s[1], s[2]);
    const hs = hellOf(s), hd = hellOf(d);
    let m = 0;
    if (hs >= DIEL) {
      const b = (hd * rest) / (1 - DIEL) + hs - 2 * DIEL, c = DIEL - hs;
      m = Math.min(1, Math.max(0, (-b + Math.sqrt(Math.max(0, b * b - 4 * DIEL * c))) / (2 * DIEL)));
    }
    const ausD = d.map((x) => (x * rest) / (1 - DIEL) / Math.max(1 - m, 1e-6));
    const ausS = s.map((x) => (x - DIEL * (1 - m)) / Math.max(m, 1e-6));
    return [ausD.map((x, i) => Math.min(1, Math.max(0, x + (ausS[i] - x) * m * m))), m];
  }

  // Liefert { glb, tris, verts, sets, which, merk, halt, spiegel, … } oder { skipped }.
  // merk: { Merkmal: Dreiecke } aller gezeichneten Teilmaterialien und des
  // Baus; halt: ein Merkmal ist unbekannt oder ein Fehler (Liste lässt es weg).
  // zensus: nur die Merkmale, nichts backen (schnell, für Zählungen).
  async function bake(item, { zensus = false } = {}) {
    quellen.clear();
    const weapon = isWeapon(item);
    const merk = new Map();
    const bau = (k, tris = 0) => merk.set(k, (merk.get(k) ?? 0) + tris);
    const atts = weapon ? allAtts(item, bau) : geomOf(item);
    const v = variantOf(item);
    bilder = new Map();
    const diag = { path: v.path ?? null, mtl: v.mtl || null, which: v.which, wear: v.wear, atts: [] };
    if (v.offen?.length) { diag.offen = { record: item.record, tags: v.offen }; bau('Bau Ausführung nicht gefunden'); }
    if (!atts.length) return { skipped: `keine Geometrie (${v.path ?? '—'})`, diag };
    const pal = paletteOf(item);
    const wearAmt = v.wear * wearScale;
    const doc = new Document();
    const buf = doc.createBuffer();
    const scene = doc.createScene(item.id);
    const node = doc.createNode(item.id);
    scene.addChild(node);
    const mesh = doc.createMesh(item.id);
    node.setMesh(mesh);
    let tris = 0, verts = 0;
    const bakes = new Map(), plain = [], prims = [], decals = [];
    const benutzt = new Set(); // Bilder, die der Bau nimmt (Zählung: ihr Format)
    const fehlend = []; // Teilnetze ohne Material (Befund nach ihrem Anteil)
    for (const att of atts) {
      const skinP = lodPath(att.skin, lod);
      const meshFile = /\.skin$/i.test(skinP) ? skinP.replace(/\.skin$/i, '.skinm') : `${skinP}m`;
      const mb = provider.read(meshFile);
      const da = { mesh: meshFile, mtl: att.mtl ?? null, own: att.own ?? null, subs: [] };
      diag.atts.push(da);
      if (!mb) { log(`  ! Netz fehlt: ${meshFile}`); bau('Bau Netz fehlt'); continue; }
      const m = readSkinMesh(mb);
      const nV = m.info.vertices, P = new Float32Array(nV * 3), N = new Float32Array(nV * 3), UV = new Float32Array(nV * 2);
      if (att.xfFehlt) { log(`  ! Knochen ${att.bone} fehlt: ${att.skin} bleibt im Ursprung`); bau('Bau Knochen fehlt'); }
      // Material: das der Variante, solange es zu diesem Netz passt. Es passt
      // nicht, wenn es an den Plätzen, die beide haben, mehrheitlich andere
      // Teilnamen trägt als das eigene Material des Netzes UND nicht von ihm
      // abstammt (Dateiname der Variante beginnt mit dem Stamm des eigenen:
      // lh86_mat -> lh86_mat_white_01). Dann gehört es zu einem anderen Teil
      // (Waffen-Skin an Schaft, Visier, Griff) und das eigene gilt; geprüft
      // nur bei Modellen aus mehreren Anhängen (geomOf). Fehlt ihm
      // ein Platz, den das Netz braucht, kommt dieser aus dem eigenen
      // (vorher: Loch, z. B. Lynx-Arme).
      const A = teile(xml(att.mtl));
      const E = att.own && norm(att.own) !== norm(att.mtl || '') ? teile(xml(att.own)) : null;
      let haupt = A, rueck = E;
      if (att.mehrteilig && A && E && !A.ganz && !E.ganz && !stammtVon(att.mtl, att.own)) {
        const n = Math.min(A.list.length, E.list.length);
        let gleich = 0;
        for (let i = 0; i < n; i++) if (nameVon(A.list[i]) === nameVon(E.list[i])) gleich++;
        if (n && gleich * 2 < n) { haupt = E; rueck = null; da.fremd = true; }
      }
      if (!haupt && rueck) { haupt = rueck; rueck = null; }
      if (!haupt) log(`  ! Material fehlt: ${att.mtl || '—'} (${att.skin})`);
      // .cga aus mehreren Teilen: Ecken eines Teilnetzes stehen im Raum seines
      // Knotens; erst dessen Lage (bone_to_world), dann der Anhang.
      const knotenAn = /\.cga$/i.test(att.skin) ? new Int32Array(nV).fill(-1) : null;
      let nmc = null;
      if (knotenAn) {
        nmc = readNmc(provider.read(att.skin));
        for (const s of m.subs) {
          if (s.node == null) continue; // Knoten 0 ist gültig (Wurzel)
          const kn = nmc?.[s.node];
          if (!kn) { log(`  ! Knoten ${s.node} fehlt im Knotenbaum: ${att.skin}`); bau('Bau Knoten fehlt', s.numIndices / 3); continue; }
          if (isIdent(kn.m)) continue;
          for (let i = s.firstIndex; i < s.firstIndex + s.numIndices; i++) knotenAn[m.idx[i]] = s.node;
        }
      }
      for (let q = 0; q < nV; q++) {
        let px = m.pos[q * 3], py = m.pos[q * 3 + 1], pz = m.pos[q * 3 + 2];
        let nx = m.nor ? m.nor[q * 3] : 0, ny = m.nor ? m.nor[q * 3 + 1] : 0, nz = m.nor ? m.nor[q * 3 + 2] : 0;
        if (knotenAn && knotenAn[q] >= 0) { const M = nmc[knotenAn[q]].m; [px, py, pz] = applyM(M, [px, py, pz]); if (m.nor) [nx, ny, nz] = applyM(M, [nx, ny, nz], 0); }
        if (att.xf) { [px, py, pz] = qrot(att.xf.q, [px, py, pz]).map((x, i) => x + att.xf.t[i]); if (m.nor) [nx, ny, nz] = qrot(att.xf.q, [nx, ny, nz]); }
        P[q * 3] = -px; P[q * 3 + 1] = pz; P[q * 3 + 2] = py;
        if (m.nor) { N[q * 3] = -nx; N[q * 3 + 1] = nz; N[q * 3 + 2] = ny; }
        UV[q * 2] = m.uv[q * 2]; UV[q * 2 + 1] = m.uv[q * 2 + 1];
      }
      for (const s of m.subs) {
        const n3 = s.numIndices / 3;
        let sx = teilAn(haupt, s.mat);
        if (!sx && rueck) { sx = teilAn(rueck, s.mat); if (sx) bau('Bau Teilmaterial aus eigenem Material', n3); }
        if (da.fremd) bau('Bau fremdes Material verworfen', n3);
        const shader = sx?.attr?.Shader ?? '?';
        const name = sx?.attr?.Name ?? `sub${s.mat}`;
        da.subs.push({ mat: s.mat, name, shader, n: n3 });
        if (!sx) { fehlend.push({ n3, ohneDatei: !(haupt || rueck) }); continue; }
        // Schatten- und Stellvertreternetze zeichnet das Spiel nicht
        if (shader === 'NoDraw' || /proxy|_shadow/i.test(name)) { if (shader === 'NoDraw') bau('Shader NoDraw', n3); continue; }
        const mv = merkmaleVon(sx, weapon, att.pal ?? pal);
        if (att.palVomTraeger && pal && mv.keys.some((k) => /^Bau Palettenplatz \d/.test(k))) bau('Bau Palette vom Träger', n3);
        const flags = mv.flags;
        const T = SHADER[shader];
        const ts = rollen(sx);
        const layers = kids(kid(sx, 'MatLayers'), 'Layer');
        // Weg: Aufdrucke mit Schablone (Palettenlogo) und ohne Bild
        const schablone = shader === 'MeshDecal' && flags.some((f) => /^STENCIL_/.test(f));
        const istAufdruck = shader === 'MeshDecal' || (shader === 'Illum' && flags.includes('DECAL'));
        if (schablone || (istAufdruck && !ts.farbe)) {
          for (const k of mv.keys) bau(k, n3);
          if (!schablone) bau('Bau Aufdruck ohne Bild', n3);
          da.subs.at(-1).weg = 'aufdruck';
          continue;
        }
        for (const k of mv.keys) bau(k, n3);
        const I = new Uint32Array(s.numIndices);
        for (let i = 0; i < s.numIndices; i++) I[i] = m.idx[s.firstIndex + i];
        let agree = 0, faces = 0;
        for (let i = 0; i < I.length; i += 3) {
          const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
          const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
          const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          const vn = [0, 1, 2].map((k) => N[a + k] + N[b + k] + N[c + k]);
          const d = n[0] * vn[0] + n[1] * vn[1] + n[2] * vn[2];
          if (d) { faces++; if (d > 0) agree++; }
        }
        if (agree < faces / 2) for (let i = 0; i < I.length; i += 3) { const x = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = x; }
        tris += n3;
        // Weg je Shader (Tabelle): Schichtmaterial nach Mischkarte, ohne sie
        // nur Grundschicht 1; Illum und genäherte Shader mit Farbkarte nach
        // ihr; Aufdrucke durchscheinend obenauf; Glas getönt; sonst Grundfarbe.
        // Ein Satz teilt sich Bilder (Mischkarte bzw. Farbkarte, Normalenkarte,
        // Abnutzungs- und Höhenkarte) und ihre Kachelung: Teilnetze mit einer
        // anderen davon bekommen einen eigenen Satz, statt die des ersten zu
        // erben. Material je Teilnetz (Schichten, Werte, Glanzkarte) bleibt
        // im Satz getrennt; überlappen zwei verschiedene, teilt sie unten
        // die Überlappungsprüfung.
        const tmSig = (r) => { const tm = texModVon(sx, r); return tm ? [tm.tu, tm.tv, tm.ou, tm.ov].join(',') : ''; };
        let art = 'flach', key = null;
        if (shader === 'LayerBlend_V2' && layers.length) {
          if (ts.mischung) { art = 'schicht'; key = [ts.mischung, ts.normale ?? '', ts.abnutzung ?? '', ts.hal ?? '', ...['mischung', 'abnutzung', 'hal', 'normale'].map(tmSig)].join('|'); }
          else { art = 'ohneMischung'; key = `lb|${ts.normale ?? att.mtl ?? name}`; }
        } else if (istAufdruck) art = 'aufdruck';
        else if (shader === 'GlassPBR') art = 'glas';
        else if (ts.farbe && (shader === 'Illum' || (T && T.art !== 'ja'))) { art = 'farbe'; key = ['f', ts.farbe, ts.normale ?? '', tmSig('farbe'), tmSig('normale')].join('|'); }
        // Aufdruck der 2. UV: nur die Ausnahme der Tabelle (Waffe, decal_uv2)
        // liegt auf der 1. UV; sonst bleibt er weg (Befund %DECALS).
        const aufdruck = mv.uv1 ? kids(kid(sx, 'Textures'), 'Texture').find((t) => t.attr.Map === 'TexSlot9')?.attr.File : null;
        const prim = { P, N, UV, UV2: aufdruck ? UV : null, I, name, shader, ts, sx, key, art, aufdruck, pal: att.pal, nichtMetall: !!T && T.art !== 'ja' };
        da.subs.at(-1).art = art;
        prims.push(prim);
        if (art === 'aufdruck') { decals.push(prim); benutzt.add(ts.farbe); continue; }
        if (key) {
          if (!bakes.has(key)) bakes.set(key, { key, ts, art, subs: [] });
          bakes.get(key).subs.push(prim);
          for (const r of art === 'farbe' ? ['farbe', 'glanzfarbe', 'normale'] : ['mischung', 'abnutzung', 'normale', 'hal']) if (ts[r]) benutzt.add(ts[r]);
          if (aufdruck) benutzt.add(aufdruck);
          if (ts.schillern && /%IRIDESCENCE\b/.test(sx.attr.StringGenMask ?? '')) benutzt.add(ts.schillern);
          for (const l of layers) { const ly = layerOf(l.attr.Path); if (ly.t1) benutzt.add(ly.t1); }
        } else plain.push(prim);
      }
      verts += nV;
    }
    // Ein Satz schreibt alle Teilnetze in ein Bild. Liegen zwei Teilnetze mit
    // verschiedenem Material auf denselben UV-Flächen, kann das Bild dort nur
    // eins zeigen, und das spätere überschrieb das frühere (Prism
    // „Irradiated“: Metall, Kunststoff und Gummi auf denselben Flächen).
    // Solche Teilnetze bekommen einen eigenen Satz. Prüfraster 256; gezählt
    // wird nur, wo beide Flächen auch ringsum liegen (aneinanderstoßende
    // Inseln teilen sich sonst ihre Randtexel), und erst über 4 Texel.
    {
      const G = 256, neu = new Map(), sigs = new Map();
      let geteilt = 0;
      for (const [k, B] of bakes) {
        if (B.subs.length < 2) { neu.set(k, B); continue; }
        const teile = [];
        for (const p of B.subs) {
          const sig = JSON.stringify([{ ...p.sx.attr, Name: null }, p.sx.children, p.pal ?? null, p.aufdruck ?? null]);
          if (!sigs.has(sig)) sigs.set(sig, sigs.size + 1);
          const s = sigs.get(sig);
          const m = new Uint8Array(G * G);
          rasterUv(m, G, p.UV, p.I, 1);
          const innen = (a, j, v) => a[j - 1] === v && a[j + 1] === v && a[j - G] === v && a[j + G] === v;
          const passt = (t) => {
            let x = 0;
            for (let y = 1; y < G - 1; y++) for (let j = y * G + 1; j < y * G + G - 1; j++) {
              const o = t.besitz[j];
              if (m[j] && o && o !== s && innen(m, j, 1) && innen(t.besitz, j, o) && ++x > 4) return false;
            }
            return true;
          };
          let ziel = teile.find(passt);
          if (!ziel) teile.push((ziel = { besitz: new Uint32Array(G * G), subs: [] }));
          for (let j = 0; j < m.length; j++) if (m[j]) ziel.besitz[j] = s;
          ziel.subs.push(p);
        }
        teile.forEach((t, i) => { const kk = i ? `${k}#${i}` : k; neu.set(kk, { ...B, key: kk, subs: t.subs }); });
        geteilt += teile.length - 1;
      }
      bakes.clear();
      for (const [k, B] of neu) bakes.set(k, B);
      if (geteilt) diag.geteilt = geteilt;
    }
    // Teilnetz ohne Material: fehlt es im Modell. Unter 0,1 % der Dreiecke
    // (Splitter, Defiance-Helme: 7 von 9.000) ist das unsichtbar und genähert,
    // darüber ein Loch, das das Item anhält.
    const alle = tris + fehlend.reduce((a, f) => a + f.n3, 0);
    for (const f of fehlend) bau(f.ohneDatei ? 'Bau Material fehlt' : f.n3 / Math.max(1, alle) < 0.001 ? 'Bau Kleinteil ohne Material' : 'Bau Teilnetz ohne Material', f.n3);
    const befunde = () => Object.fromEntries([...merk.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    if (zensus) {
      for (const f of benutzt) bau(`Format ${fmtOf(f)}`);
      return { zensus: true, merk: befunde(), halt: haelt([...merk.keys()]), diag };
    }
    if (!prims.length) return { skipped: 'keine sichtbaren Teilnetze', diag, merk: befunde() };

    const matOf = new Map();
    let bi = 0, spiegel = 0, bedeckt = 0;
    const tmp = new Float32Array(4), tmpL = new Float32Array(4), tmpG = new Float32Array(4);
    // Abtasten mit fester Kachelung/Versatz des Platzes
    const samp = (im, tm, u, w, out) => (tm ? sample(im, u * tm.tu + tm.ou, w * tm.tv + tm.ov, out) : sample(im, u, w, out));
    // Kantenlänge, ab der ein gekacheltes Bild nur noch Mittelwert ist
    const groesse = (tm, S) => (tm ? Math.max(4, Math.round(S / Math.max(1, Math.abs(tm.tu), Math.abs(tm.tv)))) : S);
    for (const B of bakes.values()) {
      const S = TEX;
      const schicht = B.art === 'schicht', ohne = B.art === 'ohneMischung', farbeSet = B.art === 'farbe';
      const sx0 = B.subs[0].sx;
      const tmM = texModVon(sx0, 'mischung'), tmA = texModVon(sx0, 'abnutzung'), tmH = texModVon(sx0, 'hal'), tmN = texModVon(sx0, 'normale');
      // Mischkarte nicht lesbar (Befund „Format …“ bzw. „Bau Bild nicht
      // lesbar“): wie ohne Mischkarte nur die Grundschicht
      const blend = schicht ? texture(B.ts.mischung, groesse(tmM, S)) : null;
      const schichtAn = schicht && !!blend;
      const wear = !farbeSet && B.ts.abnutzung ? texture(B.ts.abnutzung, groesse(tmA, S)) : null;
      const hal = !farbeSet && B.ts.hal ? texture(B.ts.hal, groesse(tmH, S)) : null;
      // gekachelte oder versetzte Normalenkarte: weggelassen (Befund KachelungNormale)
      const ddn = B.ts.normale && !tmN ? texture(B.ts.normale, S) : null;
      const mask = new Uint16Array(S * S);
      const d2 = B.subs.some((p) => p.UV2) ? new Float32Array(S * S * 2).fill(NaN) : null;
      B.subs.forEach((p, i) => rasterUv(mask, S, p.UV, p.I, i + 1, p.UV2, d2));
      const col = new Float32Array(S * S * 4), orm = new Float32Array(S * S * 4);
      const prepared = B.subs.map((p) => {
        const at = p.sx.attr;
        const grund = { p, diffuse: f3(at.Diffuse), spec: f3(at.Specular, 0.04), shin: Number(at.Shininess ?? 128), fehlt: 0, n: 0 };
        if (farbeSet) {
          // Farbkarte mal Diffuse; Glanzkarte (TexSlot4) mal Specular; Glanz
          // im Alpha der Normalenkarte mal Shininess. Vorher galten Specular
          // und Shininess als Endwerte, und Glanzkarten fielen weg (Chrom).
          const tmF = texModVon(p.sx, 'farbe'), tmS = texModVon(p.sx, 'glanzfarbe');
          return {
            ...grund, tmF, tmS, tmN,
            farbe: texture(p.ts.farbe, groesse(tmF, S)),
            glanz: p.ts.glanzfarbe ? texture(p.ts.glanzfarbe, groesse(tmS, S)) : null,
            gloss: p.ts.normale ? glossOf(p.ts.normale, groesse(tmN, 512)) : null,
          };
        }
        const layers = kids(kid(p.sx, 'MatLayers'), 'Layer');
        const L = (nm) => layers.find((l) => l.attr.Name === nm);
        const mk = (l) => {
          if (!l) return null;
          const lay = layerOf(l.attr.Path);
          let tint = f3(l.attr.TintColor);
          const pt = Number(l.attr.PaletteTint ?? 0);
          const glossMul = Number(l.attr.GlossMult ?? 1);
          let diffuse = lay.diffuse, spec = lay.spec, shin = lay.shin;
          const PAL = p.pal ?? pal;
          const e = pt && PAL ? PAL[['a', 'b', 'c'][pt - 1]] : null;
          // Palette und Tönung (TintColor) wirken zusammen: die Palette gibt
          // die Farbe, die Tönung der Schicht dunkelt sie ab (dieselbe
          // Palettenfarbe in mehreren Schichten, je mit eigener Tönung).
          // Vorher ersetzte die Palette die Tönung, und Palettenflächen kamen
          // zu hell heraus (Oracle-Helm weiß statt dunkelgrau).
          // Färbeart der Schicht (TintMode, Tabelle „Bau Färbeart“): Metall (2)
          // färbt damit die Spiegelung; Lack und Stoff (1) die Grundfarbe, die
          // Spiegelung bleibt die der Schicht; Waffenstoff (0) nimmt dazu die
          // Spiegelung der Palette (Goldausgaben). Vorher galt die
          // Palettenspiegelung für jede Schicht: Lacke mit heller
          // Palettenspiegelung wurden Metall (Pembroke Graphite silbern).
          if (lay.tintMode === 2) { const f = e ? e.tint : [1, 1, 1]; spec = spec.map((x, i) => x * f[i] * tint[i]); tint = [1, 1, 1]; }
          else if (e) { diffuse = e.tint; if (lay.tintMode === 0 && e.spec) spec = e.spec; }
          if (e && Number.isFinite(e.gloss)) shin = e.gloss;
          const tiling = Number(l.attr.UVTiling ?? 1);
          let size = 8; while (size < 512 && size < (S / tiling) * 2) size *= 2;
          const tx = lay.t1 ? texture(lay.t1, size) : null, gloss = lay.t2 ? glossOf(lay.t2, size) : null;
          let nrm = [1, 1, 1];
          if (tx && e) { const mm = [0, 0, 0]; for (let k = 0; k < tx.w * tx.h; k++) for (let j = 0; j < 3; j++) mm[j] += toLin(tx.data[k * 4 + j]) / (tx.w * tx.h); nrm = mm.map((x) => 1 / Math.max(0.02, x)); }
          return { lay: { ...lay, tex: tx, gloss, diffuse, shin, norm: nrm }, tint, spec, glossMul, tiling, pt, path: l.attr.Path, fehlt: lay.missing };
        };
        // Mischkarte nicht lesbar: nur Grundschicht 1 und ihre Abnutzung
        // werden gezeichnet, also auch nur deren Bilder geladen (ein
        // unlesbares Bild einer ungenutzten Schicht hielte sonst das Item an)
        const nur1 = schicht && !schichtAn;
        const base = ['BaseLayer1', 'BaseLayer2', 'BaseLayer3', 'BaseLayer4'].map((n, i) => (nur1 && i > 0 ? null : mk(L(n))));
        const wr = ['WearLayer1', 'WearLayer2', 'WearLayer3', 'WearLayer4'].map((n, i) => (nur1 && i > 0 ? null : mk(L(n)) ?? base[i]));
        // Aufdruck (nur Waffen, decal_uv2): nichtmetallisch, Glanz aus
        // DiffuseDecalGloss (0..255 wie Shininess), auf der 1. UV
        let dec = null;
        if (p.UV2) {
          const im = texture(p.aufdruck, Math.min(S, 1024));
          if (im) {
            const pp = kid(p.sx, 'PublicParams')?.attr ?? {};
            const ds = f3(pp.DiffuseDecalSpec, 0.04);
            dec = { im, rough: 1 - Math.min(1, Number(pp.DiffuseDecalGloss ?? 64) / 255), metal: Math.min(1, Math.max(0, (lum(ds) - 0.08) / 0.12)) };
          }
        }
        // Schillern (%IRIDESCENCE): der Verlauf (TexSlot5) färbt im Spiel die
        // Spiegelung je nach Blickwinkel; genähert als die Farbe, der der
        // größte Teil des Verlaufs nahe ist (geometrischer Median), auf den
        // metallischen Flächen. Ohne Schillern wurde Atzkav „Igniter“ olivgold
        // statt orange; mit dem Mittel färbte ein schmales grünes Band den
        // ganzen Monolith „Shadowflux“ oliv statt grau-blau.
        let irid = null;
        if (p.ts.schillern && /%IRIDESCENCE\b/.test(p.sx.attr.StringGenMask ?? '')) {
          const g = texture(p.ts.schillern, 64);
          if (g) {
            const px = [];
            for (let k = 0; k < g.w * g.h; k++) px.push([0, 1, 2].map((j) => toLin(g.data[k * 4 + j])));
            let col = [0, 1, 2].map((j) => px.reduce((s, q) => s + q[j], 0) / px.length);
            for (let it = 0; it < 40; it++) { // Weiszfeld
              let w = 0; const a = [0, 0, 0];
              for (const q of px) { const d = Math.max(1e-5, Math.hypot(q[0] - col[0], q[1] - col[1], q[2] - col[2])); w += 1 / d; for (let j = 0; j < 3; j++) a[j] += q[j] / d; }
              col = a.map((x) => x / w);
            }
            const st = Number(kid(p.sx, 'PublicParams')?.attr?.IridescenceStrength ?? 1);
            irid = { col, s: Math.min(1, Math.max(0, Number.isFinite(st) ? st : 1)) };
          }
        }
        return { ...grund, base, wr, dec, irid };
      });
      const layerCol = (Ly, u, w) => {
        if (!Ly) return [0.5, 0.5, 0.5, 0, 0.6, 0];
        const l = Ly.lay;
        let c = [1, 1, 1];
        if (l.tex) { sample(l.tex, u * Ly.tiling, w * Ly.tiling, tmpL); c = [tmpL[0], tmpL[1], tmpL[2]].map((z, j) => Math.min(1.6, toLin(z) * l.norm[j])); }
        let g = 1;
        if (l.gloss) { sample(l.gloss, u * Ly.tiling, w * Ly.tiling, tmpG); g = tmpG[0]; }
        const d = l.diffuse.map((x, i) => x * Ly.tint[i] * c[i]);
        const mc = Ly.spec.map((x, i) => x * Ly.tint[i] * (l.tex ? Math.min(1, c[i] * 2) : 1));
        // Grund- und Spiegelfarbe der Schicht wie bei Illum umrechnen. Vorher
        // galt ab 20 % Spiegelung reines Metall in der Spiegelfarbe, und die
        // Farbe glänzender Palettenlacke ging verloren (Pembroke Graphite:
        // Gelb wurde Silber).
        const [out, met] = specZuMetall(d, mc);
        const smooth = Math.min(1, g * Ly.glossMul * (l.shin / 255));
        // 6.: Metall der Schicht ohne Tönung, für das Schillern (ein dunkel
        // getöntes Metall bleibt Metall und schillert im Spiel)
        const roh = Math.min(1, Math.max(0, (hellOf(l.spec) - 0.08) / 0.12));
        return [...out, met, 1 - smooth, roh];
      };
      const mix = (a, b, t) => a.map((z, j) => z + (b[j] - z) * t);
      // Schicht ohne Datei (oder ohne Eintrag): grau; gemessen wird, wie viel
      // Fläche sie nach der Mischkarte deckt.
      const leer = (Ly) => (!Ly || Ly.fehlt ? 1 : 0);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = y * S + x, id = mask[i];
        if (!id) continue;
        const q = prepared[id - 1];
        const u = (x + 0.5) / S, w = (y + 0.5) / S;
        let r;
        if (farbeSet) {
          let D = q.diffuse;
          if (q.farbe) { samp(q.farbe, q.tmF, u, w, tmp); D = [toLin(tmp[0]) * q.diffuse[0], toLin(tmp[1]) * q.diffuse[1], toLin(tmp[2]) * q.diffuse[2]]; }
          let Sp = q.spec;
          if (q.glanz) { samp(q.glanz, q.tmS, u, w, tmp); Sp = [toLin(tmp[0]) * q.spec[0], toLin(tmp[1]) * q.spec[1], toLin(tmp[2]) * q.spec[2]]; }
          let g = Math.min(1, q.shin / 255);
          if (q.gloss) { samp(q.gloss, q.tmN, u, w, tmpG); g *= Math.min(1, Math.max(0, tmpG[0])); }
          const [bc, met] = q.p.nichtMetall ? [D, 0] : specZuMetall(D, Sp);
          r = [...bc, met, 1 - g];
        } else {
          let wv = 0;
          // Abnutzungskarte: dunkel nutzt zuerst ab (Kanten, Kratzer), hell
          // bleibt; wie weit, sagt Wear des Items. Neue Items (Wear 0) zeigen
          // keine. Vorher galt hell als abgenutzt, und schon bei Wear 0 lag die
          // Abnutzungsschicht (oft blankes Metall) auf fast der halben
          // Fläche: Rüstungen silbern statt in Lackfarbe.
          if (wear && wearAmt > 0) {
            samp(wear, tmA, u, w, tmp);
            const hell = wear.format?.endsWith('s') ? (tmp[0] + 1) / 2 : tmp[0];
            wv = Math.min(1, Math.max(0, (1 - hell - (1 - wearAmt)) / 0.1));
          }
          q.n++;
          if (ohne || !schichtAn) {
            // nur Grundschicht 1 (und ihre Abnutzung)
            const a = layerCol(q.base[0], u, w);
            r = wv ? mix(a, layerCol(q.wr[0], u, w), wv) : a;
            q.fehlt += leer(q.base[0]);
          } else {
            samp(blend, tmM, u, w, tmp);
            const bl = [tmp[0], tmp[1], tmp[2]];
            const Ls = [0, 1, 2, 3].map((k) => { const a = layerCol(q.base[k], u, w); if (!wv) return a; return mix(a, layerCol(q.wr[k], u, w), wv); });
            r = mix(mix(mix(Ls[3], Ls[2], bl[2]), Ls[1], bl[1]), Ls[0], bl[0]);
            // Anteile der vier Schichten nach derselben Mischung
            const g0 = bl[0], g1 = bl[1] * (1 - bl[0]), g2 = bl[2] * (1 - bl[1]) * (1 - bl[0]), g3 = (1 - bl[2]) * (1 - bl[1]) * (1 - bl[0]);
            q.fehlt += g0 * leer(q.base[0]) + g1 * leer(q.base[1]) + g2 * leer(q.base[2]) + g3 * leer(q.base[3]);
          }
          // Schillern auf den Metallschichten (ungetönt gemessen): sonst fiel
          // es bei dunkel getöntem Metall weg (Custodian „Scorched“ schwarz)
          if (q.irid) { const k = q.irid.s * r[5]; for (let j = 0; j < 3; j++) r[j] += (q.irid.col[j] - r[j]) * k; r[3] = Math.max(r[3], k); }
          if (q.dec && d2) {
            const u2 = d2[i * 2], v2 = d2[i * 2 + 1];
            if (u2 === u2) {
              sample(q.dec.im, u2, v2, tmp);
              const a = Math.min(1, Math.max(0, tmp[3]));
              if (a > 0) {
                for (let j = 0; j < 3; j++) r[j] += (toLin(tmp[j]) - r[j]) * a;
                r[3] += (q.dec.metal - r[3]) * a;
                r[4] += (q.dec.rough - r[4]) * a;
              }
            }
          }
        }
        let ao = 1;
        if (hal) { samp(hal, tmH, u, w, tmp); ao = tmp[1]; }
        const rau = Math.min(1, Math.max(0.04, r[4]));
        bedeckt++; if (r[3] > 0.7 && rau < 0.25) spiegel++;
        col[i * 4] = toSrgb(Math.min(1, r[0])); col[i * 4 + 1] = toSrgb(Math.min(1, r[1])); col[i * 4 + 2] = toSrgb(Math.min(1, r[2])); col[i * 4 + 3] = 1;
        orm[i * 4] = ao; orm[i * 4 + 1] = rau; orm[i * 4 + 2] = r[3]; orm[i * 4 + 3] = 1;
      }
      for (const q of prepared) if (q.n && q.fehlt / q.n > 0.02) bau('Bau Schicht ohne Datei sichtbar', q.p.I.length / 3);
      dilate(col, mask, S); dilate(orm, mask, S);
      const to8 = (f) => { const b = Buffer.alloc(S * S * 4); for (let k = 0; k < b.length; k++) b[k] = Math.round(Math.min(1, Math.max(0, f[k])) * 255); return b; };
      const webp = async (rgba, qual) => sharp(to8(rgba), { raw: { width: S, height: S, channels: 4 } }).removeAlpha().webp({ quality: qual }).toBuffer();
      const colW = await webp(col, 88), ormW = await webp(orm, 85);
      let nrmW = null;
      if (ddn) {
        const n8 = Buffer.alloc(ddn.w * ddn.h * 3);
        for (let k = 0; k < ddn.w * ddn.h; k++) {
          const nx = ddn.data[k * 4], ny = ddn.data[k * 4 + 1];
          const sx = ddn.format?.endsWith('s') ? nx : nx * 2 - 1, sy = ddn.format?.endsWith('s') ? ny : ny * 2 - 1;
          const nz = Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy));
          n8[k * 3] = Math.round((sx * 0.5 + 0.5) * 255); n8[k * 3 + 1] = Math.round((-sy * 0.5 + 0.5) * 255); n8[k * 3 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        }
        nrmW = await sharp(n8, { raw: { width: ddn.w, height: ddn.h, channels: 3 } }).resize(Math.min(ddn.w, TEX), Math.min(ddn.h, TEX)).webp({ quality: 90 }).toBuffer();
      }
      const mkTex = (b, nm) => doc.createTexture(nm).setImage(b).setMimeType('image/webp');
      const ormT = mkTex(ormW, `orm${bi}`);
      const mat = doc.createMaterial(`set${bi}`).setBaseColorTexture(mkTex(colW, `col${bi}`)).setMetallicRoughnessTexture(ormT).setOcclusionTexture(ormT).setMetallicFactor(1).setRoughnessFactor(1);
      if (nrmW) mat.setNormalTexture(mkTex(nrmW, `nrm${bi}`));
      for (const p of B.subs) matOf.set(p, mat);
      bi++;
    }
    // Aufdrucke (MeshDecal, Illum %DECAL): Farbkarte samt Deckkraft,
    // durchscheinend obenauf, nichtmetallisch. Ohne Deckkraft im Bild wäre es
    // ein Rechteck auf dem Modell; dann bleibt er weg (Befund).
    const decalMat = new Map();
    for (const p of decals) {
      const tm = texModVon(p.sx, 'farbe');
      const k = `${norm(p.ts.farbe)}|${tm ? [tm.tu, tm.tv, tm.ou, tm.ov].join(',') : ''}|${p.sx.attr.Diffuse ?? ''}`;
      if (!decalMat.has(k)) {
        const im = texture(p.ts.farbe, Math.min(TEX, 1024));
        let mat = null;
        if (im) {
          let lo = 255, sum = 0;
          for (let j = 3; j < im.data.length; j += 4) { const a = im.data[j] * 255; if (a < lo) lo = a; sum += a; }
          const mean = sum / (im.data.length / 4);
          if (lo < 128 && mean < 240) {
            const b8 = Buffer.alloc(im.w * im.h * 4);
            for (let j = 0; j < b8.length; j++) b8[j] = Math.round(Math.min(1, Math.max(0, im.data[j])) * 255);
            const wb = await sharp(b8, { raw: { width: im.w, height: im.h, channels: 4 } }).webp({ quality: 88, alphaQuality: 90 }).toBuffer();
            const d = f3(p.sx.attr.Diffuse);
            mat = doc.createMaterial(`aufdruck${decalMat.size}`).setBaseColorTexture(doc.createTexture(`aufdruck${decalMat.size}`).setImage(wb).setMimeType('image/webp'))
              .setBaseColorFactor([...d.map((x) => Math.min(1, x / 0.58)), 1]).setAlphaMode('BLEND').setRoughnessFactor(0.55).setMetallicFactor(0);
            // feste Kachelung des Aufdrucks über KHR_texture_transform
            if (tm) mat.getBaseColorTextureInfo().setExtension('KHR_texture_transform', doc.createExtension(KHRTextureTransform).createTransform().setScale([tm.tu, tm.tv]).setOffset([tm.ou, tm.ov]));
          } else { log(`  ~ Aufdruck ohne Deckkraft: ${p.ts.farbe}`); }
        }
        decalMat.set(k, mat);
      }
      const mat = decalMat.get(k);
      if (mat) matOf.set(p, mat);
      else {
        const i = prims.indexOf(p); if (i >= 0) prims.splice(i, 1);
        tris -= p.I.length / 3;
        // Bild da, aber ohne Deckkraft: weggelassen; Bild nicht lesbar: der
        // Befund kommt aus dem Bildzustand (Format …)
        if (texture(p.ts.farbe, Math.min(TEX, 1024))) bau('Bau Aufdruck ohne Deckkraft', p.I.length / 3);
      }
    }
    // Ohne Karte: Grundfarbe; Glas getönt und durchscheinend; Specular und
    // Shininess wie bei der Farbkarte (genäherte Shader nichtmetallisch).
    // Schichtmaterial ohne Schichten: nur Grundfarbe (seine Werte sind
    // Faktoren der fehlenden Schichten).
    for (const p of plain) {
      const at = p.sx.attr;
      const d = f3(at.Diffuse), op = Number(at.Opacity ?? 1);
      const glas = p.art === 'glas';
      let met = 0, base = d, rau = 0.6;
      if (!glas && !p.nichtMetall && p.shader !== 'LayerBlend_V2') {
        [base, met] = specZuMetall(d, f3(at.Specular, 0.04));
        rau = Math.min(1, Math.max(0.04, 1 - Number(at.Shininess ?? 128) / 255));
      }
      const mat = doc.createMaterial(p.name).setBaseColorFactor([...base, glas ? Math.min(0.35, op) : 1]).setRoughnessFactor(glas ? 0.05 : rau).setMetallicFactor(met);
      if (glas) mat.setAlphaMode('BLEND');
      matOf.set(p, mat);
    }
    const accCache = new Map();
    for (const p of prims) {
      if (!accCache.has(p.P)) {
        accCache.set(p.P, {
          pos: doc.createAccessor().setArray(p.P).setType('VEC3').setBuffer(buf),
          nor: doc.createAccessor().setArray(p.N).setType('VEC3').setBuffer(buf),
          uv: doc.createAccessor().setArray(p.UV).setType('VEC2').setBuffer(buf),
        });
      }
      const a = accCache.get(p.P);
      mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', a.pos).setAttribute('NORMAL', a.nor).setAttribute('TEXCOORD_0', a.uv)
        .setIndices(doc.createAccessor().setArray(p.I).setType('SCALAR').setBuffer(buf)).setMaterial(matOf.get(p)));
    }
    // Bildzustände als Befunde: Format jedes benutzten Bildes; ließ sich ein
    // bekanntes Format nicht entpacken, ist das ein Fehler des Baus.
    for (const [base, z] of bilder) {
      if (!z) continue;
      if (z.kaputt && einordnen(`Format ${z.format}`).art === 'ja') bau('Bau Bild nicht lesbar');
      else bau(`Format ${z.format}`);
      if (z.format === 'fehlt') (diag.missingTex ??= []).push(base);
    }
    if (doc.getRoot().listTextures().length) doc.createExtension(EXTTextureWebP).setRequired(true);
    doc.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER, encodeSpeed: 5, decodeSpeed: 5 });
    await doc.transform(prune(), dedup(), draco());
    const glb = await io.writeBinary(doc);
    const hexOf = (e) => e?.tint && `#${e.tint.map((x) => Math.round(toSrgb(Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('')}`;
    const merkmale = befunde();
    return { glb, tris, verts, sets: bakes.size, which: v.which, palette: pal?.name ?? null, colors: pal ? [hexOf(pal.a), hexOf(pal.b), hexOf(pal.c)] : null, diag, merk: merkmale, halt: haelt(Object.keys(merkmale)), spiegel: bedeckt ? +(spiegel / bedeckt).toFixed(3) : 0, quellen: [...quellen].sort() };
  }
  return { bake, variantOf, cacheBytes: () => imgCache.bytes };
}

// ─── GLB zerlegen: Bilder als eigene Dateien (nach Inhalt benannt) ─────────
// -> { glb: Buffer (ohne Bilder, Bild-URIs "../t/<hash>.webp"), images: [{ hash, ext, data }] }
export function splitImages(glbBytes, hashOf, texPrefix = '../t/') {
  const buf = Buffer.from(glbBytes.buffer, glbBytes.byteOffset, glbBytes.byteLength);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const binStart = 20 + jsonLen + 8;
  const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));
  const images = [], imageViews = new Set();
  for (const im of json.images ?? []) {
    if (im.bufferView === undefined) continue;
    const bv = json.bufferViews[im.bufferView];
    const data = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    const ext = im.mimeType === 'image/png' ? 'png' : im.mimeType === 'image/jpeg' ? 'jpg' : 'webp';
    const hash = hashOf(data);
    images.push({ hash, ext, data });
    imageViews.add(im.bufferView);
    delete im.bufferView; delete im.mimeType;
    im.uri = `${texPrefix}${hash}.${ext}`;
  }
  const parts = [], keep = [];
  let off = 0;
  json.bufferViews.forEach((bv, i) => {
    if (imageViews.has(i)) return;
    const pad = (4 - (off % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
    parts.push(bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength));
    keep.push([i, { ...bv, byteOffset: off }]);
    off += bv.byteLength;
  });
  const newIndex = new Map(keep.map(([old], n) => [old, n]));
  json.bufferViews = keep.map(([, bv]) => bv);
  const re = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'bufferView' && typeof v === 'number') o[k] = newIndex.get(v);
      else re(v);
    }
  };
  re(json.accessors); re(json.meshes); // Draco: meshes[].primitives[].extensions.KHR_draco_mesh_compression.bufferView
  let newBin = Buffer.concat(parts);
  const binPad = (4 - (newBin.length % 4)) % 4;
  if (binPad) newBin = Buffer.concat([newBin, Buffer.alloc(binPad)]);
  json.buffers = [{ byteLength: newBin.length }];
  let jsonText = JSON.stringify(json);
  while (Buffer.byteLength(jsonText) % 4) jsonText += ' ';
  const jb = Buffer.from(jsonText);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jb.length + 8 + newBin.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  return { glb: Buffer.concat([head, ch(jb.length, 0x4e4f534a), jb, ch(newBin.length, 0x004e4942), newBin]), images };
}
