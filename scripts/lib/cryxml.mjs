// CryXmlB-Leser — das Binär-XML der CryEngine, wie es in der Data.p4k liegt.
//
// WOFÜR: Die Fahrzeug-Implementierungen (Data/Scripts/Entities/Vehicles/
// Implementations/Xml/<SHIP>.xml) stehen NICHT im DataCore. Dort — und nur dort
// — hängen die Item-Ports mit ihren zulässigen Größen, die Fracht-Gitter und die
// Bauteil-Trefferpunkte. Ohne diesen Leser bleiben genau die Felder Fremddaten.
//
// FORMAT (little endian, hinter der Signatur "CryXmlB\0" 9 × uint32):
//   fileSize, nodeTableOffset, nodeCount, attributeTableOffset, attributeCount,
//   childTableOffset, childCount, stringTableOffset, stringDataSize
// Node (28 B): tag, content, attrCount(u16), childCount(u16), parent,
//              firstAttribute, firstChild, reserved
// Attribut (8 B): key, value — beides Offsets in die String-Tabelle.
// Die Tabellen liegen lückenlos hintereinander; das prüft parse() als Gegenprobe
// und wirft lieber, als halb geratene Bäume zurückzugeben.

const SIG = 'CryXmlB\0';

/** Ein Knoten: { tag, content, attr: {…}, children: [] } */
export function parseCryXml(buf) {
  return parseNodes(buf)[0];
}

/**
 * Kompatibilitaetsform: das FLACHE Knotenfeld statt nur der Wurzel, und die
 * Attribute zusaetzlich kleingeschrieben unter `attrs`.
 *
 * Hintergrund: dieselbe Lib entstand am 03.08.2026 zweimal parallel — einmal
 * hier (Fahrzeug-Katalog, Phase 01.4) und einmal fuer
 * scripts/datamine-ship-components.mjs. Beim Zusammenfuehren gewann diese
 * Fassung, weil nur sie applyModification() traegt (ohne das erben 315p/325a/
 * 350r die Werte der 300i). Damit der andere Verbraucher unveraendert weiter
 * funktioniert, liefert diese Form genau seine Erwartung. Neue Verbraucher
 * nehmen parseCryXml() + findAll().
 */
export function parseCryXmlNodes(buf) {
  const nodes = parseNodes(buf);
  for (const n of nodes) {
    n.attrs = {};
    for (const [k, v] of Object.entries(n.attr)) n.attrs[k.toLowerCase()] = v;
  }
  return nodes;
}

function parseNodes(buf) {
  if (buf.length < 8 + 36 || buf.subarray(0, 8).toString('latin1') !== SIG)
    throw new Error('cryxml: keine CryXmlB-Signatur');

  let p = 8;
  const u32 = () => { const v = buf.readUInt32LE(p); p += 4; return v; };
  const fileSize = u32();
  const nodeOff = u32(), nodeCount = u32();
  const attrOff = u32(), attrCount = u32();
  const childOff = u32(), childCount = u32();
  const strOff = u32(), strSize = u32();

  // Gegenprobe: die vier Tabellen müssen die Datei exakt füllen. Stimmt das
  // nicht, ist es eine andere Variante (z. B. big endian) und jeder Wert, den
  // wir lesen, wäre Müll.
  if (fileSize !== buf.length
    || nodeOff + nodeCount * 28 !== childOff
    || childOff + childCount * 4 !== attrOff
    || attrOff + attrCount * 8 !== strOff
    || strOff + strSize !== fileSize)
    throw new Error(`cryxml: Tabellen-Layout unplausibel (size ${fileSize}/${buf.length})`);

  // String-Tabelle: nullterminierte Strings, adressiert per Offset ab strOff.
  const strCache = new Map();
  const str = (off) => {
    if (off === 0xffffffff) return '';
    const hit = strCache.get(off);
    if (hit !== undefined) return hit;
    const start = strOff + off;
    if (start >= fileSize) return '';
    let end = buf.indexOf(0, start);
    if (end < 0 || end > fileSize) end = fileSize;
    const s = buf.toString('utf8', start, end);
    strCache.set(off, s);
    return s;
  };

  const nodes = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) {
    const b = nodeOff + i * 28;
    nodes[i] = {
      tag: str(buf.readUInt32LE(b)),
      content: str(buf.readUInt32LE(b + 4)),
      attr: {},
      children: [],
      _ac: buf.readUInt16LE(b + 8),
      _cc: buf.readUInt16LE(b + 10),
      _fa: buf.readUInt32LE(b + 16),
      _fc: buf.readUInt32LE(b + 20),
    };
  }
  for (const n of nodes) {
    for (let a = 0; a < n._ac; a++) {
      const b = attrOff + (n._fa + a) * 8;
      n.attr[str(buf.readUInt32LE(b))] = str(buf.readUInt32LE(b + 4));
    }
    for (let c = 0; c < n._cc; c++) {
      const idx = buf.readUInt32LE(childOff + (n._fc + c) * 4);
      if (idx < nodeCount) n.children.push(nodes[idx]);
    }
    delete n._ac; delete n._cc; delete n._fa; delete n._fc;
  }
  return nodes;
}

/** Alle Knoten mit passendem Tag (case-insensitiv), Tiefensuche. */
export function findAll(node, tag, out = []) {
  if (!node) return out;
  if (node.tag.toLowerCase() === tag.toLowerCase()) out.push(node);
  for (const c of node.children) findAll(c, tag, out);
  return out;
}

/**
 * Wie findAll, überspringt aber die <Modification>-Blöcke. Die beschreiben
 * Varianten, sind also KEIN Teil des Fahrzeugs — wer Parts oder Ports zählt,
 * darf sie nicht mitzählen.
 */
export function findAllLive(node, tag, out = []) {
  if (!node || node.tag.toLowerCase() === 'modification') return out;
  if (node.tag.toLowerCase() === tag.toLowerCase()) out.push(node);
  for (const c of node.children) findAllLive(c, tag, out);
  return out;
}

/**
 * Variante auf den Basisbaum anwenden.
 *
 * Varianten haben keine eigene XML: die 315p, 325a und 350r teilen sich
 * ORIG_300i.xml und unterscheiden sich nur über <Modification name="…">.
 * Darin zeigt jedes <Elem idRef="…" name="…" value="…"> auf einen Knoten mit
 * passendem id-Attribut und überschreibt dort EIN Attribut; `skipPart="1"`
 * entfernt den Knoten ganz. Ohne diesen Schritt bekommen alle Varianten die
 * Werte des Basisschiffs (350r: 8700 statt 2400 Hüllen-HP).
 *
 * Mutiert den übergebenen Baum — der Aufrufer muss je Fahrzeug frisch parsen.
 * Liefert die Zahl der angewandten Änderungen, oder null wenn es die Variante
 * nicht gibt (dann hat der Aufrufer einen Namen geraten).
 */
export function applyModification(root, modName) {
  if (!modName) return 0;
  const mod = findAll(root, 'Modification')
    .find((m) => (m.attr.name || '').toLowerCase() === String(modName).toLowerCase());
  if (!mod) return null;

  const byId = new Map();
  (function w(n) { if (n.attr.id && !byId.has(n.attr.id)) byId.set(n.attr.id, n); n.children.forEach(w); })(root);

  const skip = new Set();
  let applied = 0;
  for (const e of findAll(mod, 'Elem')) {
    const target = byId.get(e.attr.idRef);
    if (!target || !e.attr.name) continue;
    if (e.attr.name.toLowerCase() === 'skippart') { if (e.attr.value === '1') skip.add(target); applied++; continue; }
    // Die Modifikation schreibt "maxsize", die Basis "maxSize" — case-insensitiv treffen,
    // sonst steht am Ende beides im Knoten und der Leser nimmt das falsche.
    const key = Object.keys(target.attr).find((k) => k.toLowerCase() === e.attr.name.toLowerCase()) ?? e.attr.name;
    target.attr[key] = e.attr.value;
    applied++;
  }
  if (skip.size) (function w(n) { n.children = n.children.filter((c) => !skip.has(c)); n.children.forEach(w); })(root);
  return applied;
}

/** Erster Knoten mit passendem Tag. */
export function findOne(node, tag) {
  return findAll(node, tag)[0] ?? null;
}

/** Zahl aus einem Attribut, oder null (nie 0 als „nicht gesetzt"). */
export function num(node, key) {
  const v = node?.attr?.[key];
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
