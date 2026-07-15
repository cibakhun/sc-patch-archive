// DataCore-Reader (Game2.dcb) — node-nativ, ohne externe Tools.
//
// Hintergrund: Die Mission-Definitionen liegen ausschliesslich in der DataCore-
// Blob `Data/Game2.dcb` im p4k. Bisher brauchte das Repo dafuer unp4k+unforge
// (siehe Kopf von datamine-mining.mjs) — externe .NET-Builds, die auf Patch-Day
// jedes Mal neu besorgt werden mussten. Dieser Reader parst das Format direkt in
// Node, analog zu extract-hardpoints.mjs (das die .cga-Bones selbst liest).
//
// Format v8 (validiert gegen Game2.dcb aus LIVE 4.8.x; Layout-Referenz:
// StarBreaker `crates/starbreaker-datacore`, MIT — dort als Rust-Struct-Defs
// dokumentiert, hier nach JS portiert):
//
//   Header (120 B) -> Definitionstabellen -> Wert-Pools -> StringTable1
//   -> StringTable2 -> Instanzdaten
//
// Zwei Stringtabellen: #1 haelt Dateinamen + String-/Locale-/Enum-WERTE,
// #2 haelt NAMEN (Struct-, Property-, Record-, Enum-Options-Namen). Die beiden
// zu verwechseln ist der klassische Fehler — Offsets landen dann im falschen
// Block und liefern scheinbar plausible, aber abgeschnittene Strings.
//
// v6 -> v8: Record wuchs 32 -> 36 B (neues `tag_offset` zwischen fileName und
// structIndex). Beide Versionen werden gelesen.

const HEADER_SIZE = 120;

// DataType (prop.dataType)
export const DT = {
  Boolean: 0x01, SByte: 0x02, Int16: 0x03, Int32: 0x04, Int64: 0x05,
  Byte: 0x06, UInt16: 0x07, UInt32: 0x08, UInt64: 0x09, String: 0x0a,
  Single: 0x0b, Double: 0x0c, Locale: 0x0d, Guid: 0x0e, EnumChoice: 0x0f,
  Class: 0x10, StrongPointer: 0x110, WeakPointer: 0x210, Reference: 0x310,
};
// ConversionType (prop.conversionType)
export const CT = { Attribute: 0, ComplexArray: 1, SimpleArray: 2, ClassArray: 3 };

const INLINE_SIZE = {
  [DT.Boolean]: 1, [DT.SByte]: 1, [DT.Byte]: 1,
  [DT.Int16]: 2, [DT.UInt16]: 2,
  [DT.Int32]: 4, [DT.UInt32]: 4, [DT.EnumChoice]: 4, [DT.Single]: 4,
  [DT.String]: 4, [DT.Locale]: 4,
  [DT.Int64]: 8, [DT.UInt64]: 8, [DT.Double]: 8,
  [DT.StrongPointer]: 8, [DT.WeakPointer]: 8,
  [DT.Guid]: 16, [DT.Reference]: 20,
  [DT.Class]: 0, // variabel — Groesse kommt aus der Struct-Definition
};

const HEX = [];
for (let i = 0; i < 256; i++) HEX.push(i.toString(16).padStart(2, '0'));
const guidHex = (buf, o) => {
  let s = '';
  for (let i = 0; i < 16; i++) s += HEX[buf[o + i]];
  return s;
};
const NULL_GUID = '00000000000000000000000000000000';

export function openDataCore(data) {
  if (data.length < HEADER_SIZE) throw new Error('DataCore: Datei kuerzer als Header');
  let o = 0;
  const u32 = () => { const v = data.readUInt32LE(o); o += 4; return v; };
  const i32 = () => { const v = data.readInt32LE(o); o += 4; return v; };

  u32(); // magic
  const version = u32();
  if (version !== 6 && version !== 8) throw new Error(`DataCore: Version ${version} nicht unterstuetzt (nur 6/8)`);
  u32(); u32(); // reserved

  const C = {};
  for (const n of ['struct', 'prop', 'enum', 'dataMapping', 'record', 'bool', 'int8', 'int16',
    'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'single', 'double', 'guid',
    'string', 'locale', 'enumV', 'strong', 'weak', 'reference', 'enumOption']) C[n] = i32();
  const textLength = u32();
  const textLength2 = u32();
  if (o !== HEADER_SIZE) throw new Error(`DataCore: Header-Groesse ${o} != ${HEADER_SIZE}`);

  const RECORD_SIZE = version >= 8 ? 36 : 32;
  // Reihenfolge der Sektionen == Lesereihenfolge (NICHT die Reihenfolge der
  // Counts im Header — dort steht bool vor int8, gelesen wird int8 zuerst).
  const SECTIONS = [
    ['struct', 16], ['prop', 12], ['enum', 8], ['dataMapping', 8], ['record', RECORD_SIZE],
    ['int8', 1], ['int16', 2], ['int32', 4], ['int64', 8],
    ['uint8', 1], ['uint16', 2], ['uint32', 4], ['uint64', 8],
    ['bool', 1], ['single', 4], ['double', 8], ['guid', 16],
    ['string', 4], ['locale', 4], ['enumV', 4],
    ['strong', 8], ['weak', 8], ['reference', 20], ['enumOption', 4],
  ];
  const off = {};
  for (const [name, size] of SECTIONS) {
    off[name] = o;
    o += C[name] * size;
    if (o > data.length) throw new Error(`DataCore: Sektion ${name} laeuft ueber das Dateiende`);
  }
  const st1Off = o; o += textLength;
  const st2Off = o; o += textLength2;
  const instOff = o;
  if (instOff > data.length) throw new Error('DataCore: Stringtabellen laufen ueber das Dateiende');

  const st1 = data.subarray(st1Off, st1Off + textLength);
  const st2 = data.subarray(st2Off, st2Off + textLength2);
  const instance = data.subarray(instOff);

  // Stringtabellen: nullterminiert, per Byte-Offset adressiert. Cache, weil
  // dieselben Namen zigtausendfach aufgeloest werden.
  const mkResolver = (tbl) => {
    const cache = new Map();
    return (rel) => {
      if (rel < 0 || rel >= tbl.length) return '';
      let v = cache.get(rel);
      if (v === undefined) {
        let e = tbl.indexOf(0, rel);
        if (e < 0) e = tbl.length;
        v = tbl.toString('utf8', rel, e);
        cache.set(rel, v);
      }
      return v;
    };
  };
  const resolveString = mkResolver(st1);  // Dateinamen + Werte
  const resolveString2 = mkResolver(st2); // Namen

  /* ---- Definitionstabellen ---- */
  const structs = new Array(C.struct);
  for (let i = 0; i < C.struct; i++) {
    const p = off.struct + i * 16;
    structs[i] = {
      name: resolveString2(data.readInt32LE(p)),
      parent: data.readInt32LE(p + 4),
      attrCount: data.readUInt16LE(p + 8),
      firstAttr: data.readUInt16LE(p + 10),
      size: data.readUInt32LE(p + 12),
    };
  }
  const props = new Array(C.prop);
  for (let i = 0; i < C.prop; i++) {
    const p = off.prop + i * 12;
    props[i] = {
      name: resolveString2(data.readInt32LE(p)),
      structIndex: data.readUInt16LE(p + 4),
      dataType: data.readUInt16LE(p + 6),
      conversionType: data.readUInt16LE(p + 8),
    };
  }
  const enums = new Array(C.enum);
  for (let i = 0; i < C.enum; i++) {
    const p = off.enum + i * 8;
    enums[i] = {
      name: resolveString2(data.readInt32LE(p)),
      valueCount: data.readUInt16LE(p + 4),
      firstValue: data.readUInt16LE(p + 6),
    };
  }
  const records = new Array(C.record);
  for (let i = 0; i < C.record; i++) {
    const p = off.record + i * RECORD_SIZE;
    const tagOff = version >= 8 ? data.readInt32LE(p + 8) : -1;
    const base = version >= 8 ? p + 12 : p + 8;
    records[i] = {
      name: resolveString2(data.readInt32LE(p)),
      fileName: resolveString(data.readInt32LE(p + 4)),
      tag: version >= 8 ? resolveString2(tagOff) : '',
      structIndex: data.readInt32LE(base),
      id: guidHex(data, base + 4),
      instanceIndex: data.readUInt16LE(base + 20),
      structSize: data.readUInt16LE(base + 22),
    };
  }

  /* ---- Instanz-Offsets: pro dataMapping fortlaufend ---- */
  const instanceOffsets = new Array(C.struct).fill(0);
  const instanceCounts = new Array(C.struct).fill(0);
  {
    let running = 0;
    for (let i = 0; i < C.dataMapping; i++) {
      const p = off.dataMapping + i * 8;
      const count = data.readUInt32LE(p);
      const si = data.readInt32LE(p + 4);
      if (si < 0 || si >= C.struct) continue;
      instanceOffsets[si] = running;
      instanceCounts[si] = count;
      running += count * structs[si].size;
    }
    if (running > instance.length) {
      throw new Error(`DataCore: Instanzdaten zu kurz (brauche ${running}, habe ${instance.length}) — Layout stimmt nicht`);
    }
  }

  /* ---- Property-Ketten (Eltern zuerst) + Byte-Offsets je Position ---- */
  const propChain = new Array(C.struct);
  const propOffsets = new Array(C.struct);
  for (let si = 0; si < C.struct; si++) {
    const chain = [];
    // Eltern-Kette einsammeln, dann von der Wurzel her anhaengen
    const lineage = [];
    for (let cur = si, guard = 0; cur !== -1 && guard < 256; guard++) {
      lineage.push(cur);
      cur = structs[cur].parent;
    }
    for (let k = lineage.length - 1; k >= 0; k--) {
      const s = structs[lineage[k]];
      for (let a = 0; a < s.attrCount; a++) chain.push(s.firstAttr + a);
    }
    propChain[si] = chain;
    const offs = new Array(chain.length);
    let running = 0;
    for (let k = 0; k < chain.length; k++) {
      offs[k] = running;
      const pr = props[chain[k]];
      if (pr.conversionType !== CT.Attribute) running += 8; // count + firstIndex
      else if (pr.dataType === DT.Class) running += structs[pr.structIndex]?.size ?? 0;
      else running += INLINE_SIZE[pr.dataType] ?? 0;
    }
    propOffsets[si] = offs;
  }

  /* ---- Wert-Pool-Zugriffe ---- */
  const poolStr = (i) => resolveString(data.readInt32LE(off.string + i * 4));
  const poolLocale = (i) => resolveString(data.readInt32LE(off.locale + i * 4));
  const poolEnum = (i) => resolveString(data.readInt32LE(off.enumV + i * 4));
  const poolPtr = (base, i) => ({ structIndex: data.readInt32LE(base + i * 8), instanceIndex: data.readInt32LE(base + i * 8 + 4) });
  const poolRef = (i) => ({ instanceIndex: data.readInt32LE(off.reference + i * 20), recordId: guidHex(data, off.reference + i * 20 + 4) });

  const recordById = new Map();
  for (const r of records) if (!recordById.has(r.id)) recordById.set(r.id, r);
  const structByName = new Map();
  for (let i = 0; i < structs.length; i++) if (!structByName.has(structs[i].name)) structByName.set(structs[i].name, i);

  /* ---- Instanz lesen ---- */
  // opts.maxDepth begrenzt die Rekursion; StrongPointer-Graphen sind tief und
  // teils zyklisch (Loadouts zeigen auf Loadouts). opts.follow(name,depth) darf
  // Aeste abschneiden, damit ein Record nicht das halbe DataCore aufzieht.
  function readInstance(structIndex, instanceIndex, opts = {}) {
    const maxDepth = opts.maxDepth ?? 12;
    const seen = new Set();
    const readRef = opts.readRef ?? false;

    function rd(si, ii, depth) {
      const sd = structs[si];
      if (!sd || sd.size === 0) return null;
      const base = instanceOffsets[si] + ii * sd.size;
      if (base < 0 || base + sd.size > instance.length) return null;
      const key = si * 0x100000000 + ii;
      if (seen.has(key)) return { __cycle: sd.name };
      seen.add(key);
      const out = {};
      const chain = propChain[si], offs = propOffsets[si];
      for (let k = 0; k < chain.length; k++) {
        const pr = props[chain[k]];
        const at = base + offs[k];
        out[pr.name] = pr.conversionType === CT.Attribute
          ? rdAttr(pr, at, depth)
          : rdArray(pr, at, depth);
      }
      seen.delete(key);
      return out;
    }

    function rdAttr(pr, at, depth) {
      switch (pr.dataType) {
        case DT.Boolean: return instance[at] !== 0;
        case DT.SByte: return instance.readInt8(at);
        case DT.Int16: return instance.readInt16LE(at);
        case DT.Int32: return instance.readInt32LE(at);
        case DT.Int64: return Number(instance.readBigInt64LE(at));
        case DT.Byte: return instance.readUInt8(at);
        case DT.UInt16: return instance.readUInt16LE(at);
        case DT.UInt32: return instance.readUInt32LE(at);
        case DT.UInt64: return Number(instance.readBigUInt64LE(at));
        case DT.Single: return instance.readFloatLE(at);
        case DT.Double: return instance.readDoubleLE(at);
        case DT.String: case DT.Locale: case DT.EnumChoice:
          return resolveString(instance.readInt32LE(at));
        case DT.Guid: {
          const g = guidHex(instance, at);
          return g === NULL_GUID ? null : g;
        }
        case DT.Class:
          return depth >= maxDepth ? null : rdInline(pr.structIndex, at, depth + 1);
        case DT.StrongPointer: {
          const si = instance.readInt32LE(at), ii = instance.readInt32LE(at + 4);
          if (si === -1 || ii === -1 || depth >= maxDepth) return null;
          if (opts.follow && !opts.follow(pr.name, depth)) return null;
          return rd(si, ii, depth + 1);
        }
        case DT.WeakPointer: {
          const si = instance.readInt32LE(at), ii = instance.readInt32LE(at + 4);
          if (si === -1 || ii === -1) return null;
          return { __weak: structs[si]?.name ?? si, __instance: ii };
        }
        case DT.Reference: {
          const ii = instance.readInt32LE(at);
          const gid = guidHex(instance, at + 4);
          return mkRef(gid, ii, depth);
        }
        default: return null;
      }
    }

    // Class-Attribute liegen INLINE im Elternpuffer, nicht im Instanz-Pool.
    function rdInline(si, at, depth) {
      const sd = structs[si];
      if (!sd) return null;
      const out = {};
      const chain = propChain[si], offs = propOffsets[si];
      for (let k = 0; k < chain.length; k++) {
        const pr = props[chain[k]];
        const a = at + offs[k];
        out[pr.name] = pr.conversionType === CT.Attribute ? rdAttr(pr, a, depth) : rdArray(pr, a, depth);
      }
      return out;
    }

    function mkRef(gid, ii, depth) {
      if (gid === NULL_GUID) return null;
      const target = recordById.get(gid);
      if (!target) return { __ref: gid };
      if (!readRef || depth >= maxDepth) {
        return { __ref: gid, name: target.name, fileName: target.fileName };
      }
      return rd(target.structIndex, target.instanceIndex, depth + 1);
    }

    function rdArray(pr, at, depth) {
      const count = instance.readInt32LE(at);
      const first = instance.readInt32LE(at + 4);
      if (count <= 0 || first < 0 || count > 1e6) return [];
      const out = new Array(count);
      for (let n = 0; n < count; n++) {
        const idx = first + n;
        switch (pr.dataType) {
          case DT.Boolean: out[n] = data[off.bool + idx] !== 0; break;
          case DT.SByte: out[n] = data.readInt8(off.int8 + idx); break;
          case DT.Int16: out[n] = data.readInt16LE(off.int16 + idx * 2); break;
          case DT.Int32: out[n] = data.readInt32LE(off.int32 + idx * 4); break;
          case DT.Int64: out[n] = Number(data.readBigInt64LE(off.int64 + idx * 8)); break;
          case DT.Byte: out[n] = data.readUInt8(off.uint8 + idx); break;
          case DT.UInt16: out[n] = data.readUInt16LE(off.uint16 + idx * 2); break;
          case DT.UInt32: out[n] = data.readUInt32LE(off.uint32 + idx * 4); break;
          case DT.UInt64: out[n] = Number(data.readBigUInt64LE(off.uint64 + idx * 8)); break;
          case DT.Single: out[n] = data.readFloatLE(off.single + idx * 4); break;
          case DT.Double: out[n] = data.readDoubleLE(off.double + idx * 8); break;
          case DT.String: out[n] = poolStr(idx); break;
          case DT.Locale: out[n] = poolLocale(idx); break;
          case DT.EnumChoice: out[n] = poolEnum(idx); break;
          case DT.Guid: { const g = guidHex(data, off.guid + idx * 16); out[n] = g === NULL_GUID ? null : g; break; }
          // ClassArray: der Index adressiert direkt die Instanz des Prop-Structs
          case DT.Class: out[n] = depth >= maxDepth ? null : rd(pr.structIndex, idx, depth + 1); break;
          case DT.StrongPointer: {
            const ptr = poolPtr(off.strong, idx);
            out[n] = (ptr.structIndex === -1 || ptr.instanceIndex === -1 || depth >= maxDepth)
              ? null
              : (opts.follow && !opts.follow(pr.name, depth)) ? null : rd(ptr.structIndex, ptr.instanceIndex, depth + 1);
            break;
          }
          case DT.WeakPointer: {
            const ptr = poolPtr(off.weak, idx);
            out[n] = (ptr.structIndex === -1 || ptr.instanceIndex === -1)
              ? null
              : { __weak: structs[ptr.structIndex]?.name ?? ptr.structIndex, __instance: ptr.instanceIndex };
            break;
          }
          case DT.Reference: { const r = poolRef(idx); out[n] = mkRef(r.recordId, r.instanceIndex, depth); break; }
          default: out[n] = null;
        }
      }
      return out;
    }

    return rd(structIndex, instanceIndex, 0);
  }

  const readRecord = (rec, opts) => readInstance(rec.structIndex, rec.instanceIndex, opts);

  // Vererbung: "ist si ein Nachfahre von name?"
  const structNameChain = (si) => {
    const out = [];
    for (let cur = si, guard = 0; cur !== -1 && guard < 256; guard++) { out.push(structs[cur].name); cur = structs[cur].parent; }
    return out;
  };

  return {
    version, counts: C, structs, props, enums, records,
    resolveString, resolveString2, readInstance, readRecord,
    recordById, structByName, structNameChain, instanceOffsets, instanceCounts,
    enumOptionName: (i) => resolveString2(data.readInt32LE(off.enumOption + i * 4)),
    enumValues: (enumDef) => {
      const out = [];
      for (let i = 0; i < enumDef.valueCount; i++) out.push(resolveString2(data.readInt32LE(off.enumOption + (enumDef.firstValue + i) * 4)));
      return out;
    },
    stats: { textLength, textLength2, instanceBytes: instance.length, recordSize: RECORD_SIZE },
  };
}
