// CryXmlB-Reader — binaeres XML-Format, in dem CIG die Implementierungs-XMLs der
// Fahrzeuge ablegt (Scripts/Entities/Vehicles/Implementations/Xml/<SCHIFF>.xml
// im p4k). Eigener Parser statt externer .NET-Werkzeuge (unp4k/StarFab) —
// dieselbe Begruendung wie bei p4k.mjs und datacore.mjs: externe Tools muessten
// bei jedem Patch neu besorgt werden, ein node-nativer Reader nicht.
//
// Format (per Spike vom 03.08.2026 entziffert, siehe 05-RESEARCH.md
// "## Code Examples"): Kopf ab Offset 12, alles LE-uint32:
//   12 nodeTablePos, 16 nodeCount, 20 attrTablePos, 24 attrCount,
//   28 childTablePos, 32 childCount, 36 stringTablePos.
// Knoten sind 28 Byte (tagOff, contentOff, u16 attrCount, u16 childCount,
// parent, firstAttr, firstChild, reserved), Attribute 8 Byte (keyOff,
// valueOff), die Kindtabelle je 4 Byte ein Knotenindex. Strings sind
// nullterminiert und relativ zur Stringtabelle adressiert.
//
// PITFALL 2 (Recherche 03.08.2026): die Attribut-SCHLUESSEL selbst sind
// uneinheitlich gross-/kleingeschrieben (`minSize`/`maxSize` vs.
// `minsize`/`maxsize`, je nach Schiff) — zusaetzlich zu den bereits bekannten
// uneinheitlichen Portnamen. Ein case-sensitiver Zugriff uebersieht dadurch
// systematisch die Haelfte der Ports. Deshalb werden die Attribut-Keys beim
// Indizieren durchgaengig kleingeschrieben abgelegt (siehe unten).
import { readFileSync } from 'node:fs';

/**
 * Parst einen CryXmlB-Buffer in ein flaches Knotenfeld.
 * @param {Buffer} buf rohe CryXmlB-Bytes (z.B. aus p4k.extract())
 * @returns {Array<{tag:string, content:string, attrs:Record<string,string>, children:object[]}>}
 *   flaches Knotenfeld; jeder Knoten traegt seine direkten Kinder bereits als
 *   Referenzen in `children` (Baum-Navigation ohne Index-Nachschlagen noetig)
 */
export function parseCryXml(buf) {
  if (buf.toString('latin1', 0, 7) !== 'CryXmlB') throw new Error('kein CryXmlB (Signatur fehlt)');

  const nodeTablePos = buf.readUInt32LE(12);
  const nodeCount = buf.readUInt32LE(16);
  const attrTablePos = buf.readUInt32LE(20);
  const attrCount = buf.readUInt32LE(24);
  const childTablePos = buf.readUInt32LE(28);
  const childCount = buf.readUInt32LE(32);
  const strTablePos = buf.readUInt32LE(36);

  const str = (rel) => {
    const a = strTablePos + rel;
    if (a < 0 || a >= buf.length) return '';
    let e = buf.indexOf(0, a);
    if (e < 0) e = buf.length;
    return buf.toString('utf8', a, e);
  };

  const attrsAll = [];
  for (let i = 0; i < attrCount; i++) {
    const o = attrTablePos + i * 8;
    attrsAll.push([str(buf.readUInt32LE(o)), str(buf.readUInt32LE(o + 4))]);
  }

  const childRefs = [];
  for (let i = 0; i < childCount; i++) childRefs.push(buf.readUInt32LE(childTablePos + i * 4));

  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    const o = nodeTablePos + i * 28;
    nodes.push({
      tag: str(buf.readUInt32LE(o)),
      content: str(buf.readUInt32LE(o + 4)),
      attrCount: buf.readUInt16LE(o + 8),
      childCount: buf.readUInt16LE(o + 10),
      parent: buf.readUInt32LE(o + 12),
      firstAttr: buf.readUInt32LE(o + 16),
      firstChild: buf.readUInt32LE(o + 20),
      attrs: {},
      children: [],
    });
  }

  for (const n of nodes) {
    // Attribut-KEYS lowercased indizieren -- Pitfall 2: minSize/maxSize vs
    // minsize/maxsize je nach Schiff, sonst verliert man die Haelfte der Ports.
    for (let i = 0; i < n.attrCount; i++) {
      const a = attrsAll[n.firstAttr + i];
      if (a) n.attrs[a[0].toLowerCase()] = a[1];
    }
    for (let i = 0; i < n.childCount; i++) {
      const c = nodes[childRefs[n.firstChild + i]];
      if (c) n.children.push(c);
    }
  }

  return nodes;
}

// Nur fuer manuelle Proben von der Kommandozeile: node scripts/lib/cryxml.mjs <datei.xml>
if (process.argv[1] && process.argv[1].endsWith('cryxml.mjs') && process.argv[2]) {
  const nodes = parseCryXml(readFileSync(process.argv[2]));
  console.log(`${nodes.length} Knoten geparst`);
}
