// Kind-Container einer Halle.
//
// Ein Container des Spiels nennt in seiner <name>.xml weitere Container, die an
// einer Stelle eingehängt werden (<Child external="1" name pos rot>). Der
// socpak-Export folgt diesen Einträgen nicht: Die Halle kommt ohne ihre
// Frachtaufzüge, und an deren Stelle steht in den Längswänden ein Loch von
// 48 x 32 m bis unter den Boden. Hier wird nichts nachgebaut, nur eingehängt:
// der Export des Kindes an die Stelle, die die Halle selbst nennt.
//
// Lage: Jeder Export hat genau eine Wurzel „CryEngine_Z_up“ (dreht Z oben nach
// Y oben), darunter liegt alles im Raum des Containers, Achsen wie im Spiel.
// pos und rot (w, x, y, z) des Eintrags gelten in genau diesem Raum, also
// kommt der Halter unter die Wurzel der Halle und braucht keine Umrechnung.
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition } from '@gltf-transform/functions';
import { readCaf } from './ivo-caf.mjs';

const WURZEL = 'CryEngine_Z_up';

// Die Einträge einer Container-XML: nur fremde Container (external="1").
// Fehlt pos oder rot, steht das Kind im Ursprung und ungedreht (so liest es
// auch das Spiel); ist eine Angabe da, aber keine Zahlenreihe, bricht es ab.
export function kinderAusXml(xml) {
  const out = [];
  for (const m of xml.matchAll(/<Child\b([^>]*?)\/?>/g)) {
    const at = (k) => (m[1].match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
    const name = (at('name') ?? '').replace(/\\/g, '/');
    if (at('external') !== '1' || !/\.socpak$/i.test(name)) continue;
    const zahlen = (k, n, leer) => {
      const s = at(k);
      if (s === undefined || s === '') return leer;
      const v = s.split(',').map(Number);
      if (v.length !== n || !v.every(Number.isFinite)) throw new Error(`${name}: ${k}="${s}" ist keine Reihe aus ${n} Zahlen`);
      return v;
    };
    out.push({ name, label: at('label') ?? '', pos: zahlen('pos', 3, [0, 0, 0]), rot: zahlen('rot', 4, [1, 0, 0, 0]) });
  }
  return out;
}

// Die eine Wurzel eines Exports; alles andere wäre ein Aufbau, den dieses
// Einhängen nicht kennt.
export function wurzelVon(doc, was = 'Export') {
  const szenen = doc.getRoot().listScenes();
  const oben = szenen.length === 1 ? szenen[0].listChildren() : [];
  if (oben.length !== 1 || oben[0].getName() !== WURZEL) throw new Error(`${was}: erwartet ist eine Szene mit der einen Wurzel ${WURZEL}, gefunden ${szenen.length} Szene(n), Wurzeln ${oben.map((n) => n.getName()).join(', ') || 'keine'}`);
  return oben[0];
}

const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const schub = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const tris = (mesh) => mesh.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0);

// Teilbaum noch einmal: neue Knoten, dieselben Netze und Lichter (ein zweites
// Exemplar desselben Kindes kostet so keine zweite Geometrie in der Datei).
function klon(doc, node) {
  const n = doc.createNode(node.getName()).setMatrix(node.getMatrix()).setMesh(node.getMesh()).setExtras(structuredClone(node.getExtras()));
  for (const e of node.listExtensions()) n.setExtension(e.extensionName, e);
  for (const c of node.listChildren()) n.addChild(klon(doc, c));
  return n;
}

// Hängt den Export src an jede Stelle aus stellen ({ pos, rot }) in room ein.
// Je Stelle ein Halter „kind_<name>_<nr>“ unter der Wurzel der Halle. Liefert,
// was dazukam (je Stelle gleich viel).
export function kindEinhaengen(room, src, stellen, name) {
  if (!stellen.length) throw new Error(`${name}: keine Stelle genannt`);
  const ziel = wurzelVon(room, 'Halle');
  const quelle = wurzelVon(src, name);
  if (quelle.getMatrix().some((v, i) => Math.abs(v - ziel.getMatrix()[i]) > 1e-6)) throw new Error(`${name}: die Wurzel ${WURZEL} dreht anders als die der Halle`);
  const map = mergeDocuments(room, src);
  const szene = map.get(src.getRoot().listScenes()[0]);
  const wurzel = map.get(quelle);
  const teile = wurzel.listChildren();
  const halter = stellen.map((s, i) => {
    const q = Math.hypot(...s.rot);
    if (Math.abs(q - 1) > 1e-3) throw new Error(`${name}: rot ${s.rot.join(',')} ist keine Drehung (Betrag ${q.toFixed(4)})`);
    const h = room.createNode(`kind_${name}_${i + 1}`).setTranslation(s.pos).setRotation([s.rot[1] / q, s.rot[2] / q, s.rot[3] / q, s.rot[0] / q]).setExtras({ kind: name, stelle: i + 1 });
    ziel.addChild(h);
    return h;
  });
  let knoten = 0, dreiecke = 0, lichter = 0;
  const zaehle = (n) => { knoten++; if (n.getMesh()) dreiecke += tris(n.getMesh()); if (n.getExtension('KHR_lights_punctual')) lichter++; n.listChildren().forEach(zaehle); };
  for (const t of teile) {
    zaehle(t);
    for (const h of halter.slice(1)) h.addChild(klon(room, t));
    halter[0].addChild(t);
  }
  szene.dispose();
  wurzel.dispose();
  return { stellen: stellen.length, knoten, dreiecke, lichter };
}

// Stellt die Knoten, deren Netz das Muster trifft, um versatz weiter, im Raum
// des Netzes (dort, wo der Knochen der .cga fährt). Liefert die Zahl.
export function kindLage(doc, muster, versatz) {
  let n = 0;
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getMesh() || !muster.test(node.getMesh().getName())) continue;
    node.setMatrix(mul(node.getMatrix(), schub(...versatz)));
    n++;
  }
  return n;
}

// Hängt einen Baum von Kindern ein, von innen nach außen: erst die Kinder
// des Kindes, dann es selbst. kinder: [{ id, name, stellen, kinder }].
// lese(c) liefert den Export des Kindes als Dokument, zeilen(c) seine
// Lichtzeilen. lagen: [{ muster, versatz, knoten }], knoten wird hier
// hochgezählt. Gestellt wird ein Kind, BEVOR seine eigenen Kinder dazukommen:
// die sind schon gestellt, und danach träfe das Muster sie ein zweites Mal.
// mal: wie oft der Elterncontainer am Ende in der Halle steht.
// Liefert die Lichtzeilen in der Reihenfolge der Exemplare; liste bekommt
// je Kind einen Berichtseintrag.
export async function kinderBaumEinhaengen(doc, kinder, { lese, zeilen = () => [], lagen = [], liste = [], melde = () => {} }, ebene = 0, mal = 1) {
  const lichter = [];
  for (const c of kinder) {
    const src = await lese(c);
    const exemplare = mal * c.stellen.length;
    for (const l of lagen) l.knoten += kindLage(src, l.muster, l.versatz) * exemplare;
    const innen = await kinderBaumEinhaengen(src, c.kinder ?? [], { lese, zeilen, lagen, liste, melde }, ebene + 1, exemplare);
    const r = kindEinhaengen(doc, src, c.stellen, c.id);
    const eigene = [...zeilen(c), ...innen];
    for (let i = 0; i < c.stellen.length; i++) lichter.push(...eigene);
    liste.push({ id: c.id, container: c.name, ebene, exemplare, stellen: c.stellen, jeExemplar: { knoten: r.knoten, dreiecke: r.dreiecke, lichtknoten: r.lichter, lichtzeilen: eigene.length } });
    melde(`  Kind ${c.id}: ${c.stellen.length} Stelle(n) ${ebene ? 'in seinem Elterncontainer' : 'in der Halle'}, ${exemplare} Exemplar(e), je ${r.dreiecke} Dreiecke, ${r.knoten} Knoten, ${r.lichter} Lichtknoten${c.kinder?.length ? ' (mit seinen eigenen Kindern)' : ''}`);
  }
  return lichter;
}

// ─── Der Schritt im Extraktor (h.kinder) ─────────────────────────────────
// h.kinder.folge: Muster auf den Containernamen; nur diese Kinder folgen, auf
// jeder Ebene (das Aufzugsmodul hängt seinerseits Plattform und Kabine ein).
// Alle anderen werden gezählt und genannt, damit keines still fehlt.
// h.kinder.lage: Teile, die der Export in der Grundlage ihrer .cga zeigt, im
// Spiel aber anders ruhen (Tor des Frachtaufzugs: offen, solange die Plattform
// oben steht). Die Lage ist das letzte Bild der genannten Spur am genannten
// Knochen, gelesen aus der .caf; gestellt wird nur, wenn jedes Netz der .cga
// an diesem Knochen hängt und die Spur ihn nicht dreht.
// Jedes Kind wird einmal exportiert (Stufe und Schalter wie die Halle, mit
// Lichtprotokoll) und an jede Stelle gehängt, die sein Elterncontainer nennt.
// Ergebnis: file (Halle mit Kindern), hall/<halle>.lights-src.txt (Zeilen der
// Halle und je Exemplar die des Kindes; der Build verbindet über den Namen),
// Bericht hall/<halle>.kinder.json.
// w: Werkzeug des Extraktors { SRC, FORCE, STARBREAKER, sb, listFiles, readZip, lichtZeilen, schalter }.
export async function hallKinder(h, file, w) {
  const { SRC, FORCE, STARBREAKER, sb, listFiles, readZip, lichtZeilen, schalter } = w;
  const RAW = `${SRC}hall-kinder/`;
  mkdirSync(RAW, { recursive: true });
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ende = (name) => name.replace(/\\/g, '/').split('/').slice(-2);
  const kennung = (name) => ende(name)[1].replace(/\.socpak$/i, '');
  const folgt = (name) => h.kinder.folge.some((re) => re.test(name));
  const kurz = (f) => f.slice(SRC.length);

  // <name>.xml eines Containers aus seinem socpak
  const xmlVon = (name) => {
    const [dir, base] = ende(name);
    sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/]${esc(dir)}[\\\\/]${esc(base)}$`]);
    const pak = listFiles(RAW).find((f) => f.toLowerCase().endsWith(`/${dir}/${base}`.toLowerCase()));
    if (!pak) throw new Error(`${dir}/${base} steht nicht in der Data.p4k`);
    const zip = readZip(readFileSync(pak));
    const key = [...zip.keys()].find((k) => k.replace(/\\/g, '/').toLowerCase() === `${kennung(name)}.xml`.toLowerCase());
    if (!key) throw new Error(`${base}: ohne ${kennung(name)}.xml`);
    const b = zip.get(key)();
    if (b.toString('latin1', 0, 7) !== 'CryXmlB') return b.toString('utf8');
    const t = `${RAW}${kennung(name)}.container`;
    writeFileSync(`${t}.cryxml`, b);
    rmSync(`${t}.xml`, { force: true });
    spawnSync(STARBREAKER, ['cryxml', 'convert', `${t}.cryxml`, `${t}.xml`]);
    if (!existsSync(`${t}.xml`)) throw new Error(`${base}: ${kennung(name)}.xml lässt sich nicht wandeln`);
    return readFileSync(`${t}.xml`, 'utf8');
  };

  // Plan: der Baum der Kinder, die folgen, je Container mit seinen Stellen
  const ausgelassen = {};
  const plan = (name, tiefe) => {
    if (tiefe > 4) throw new Error(`${kennung(name)}: Kind-Container tiefer als vier Ebenen`);
    const gruppen = new Map();
    for (const c of kinderAusXml(xmlVon(name))) {
      const id = kennung(c.name);
      if (!folgt(c.name)) { ausgelassen[id] = (ausgelassen[id] || 0) + 1; continue; }
      if (!gruppen.has(id)) gruppen.set(id, { id, name: c.name, glb: `${RAW}${id}-lod${h.lod}.glb`, licht: `${RAW}${id}-lod${h.lod}.lights-src.txt`, stellen: [] });
      gruppen.get(id).stellen.push({ pos: c.pos, rot: c.rot, label: c.label });
    }
    return [...gruppen.values()].map((g) => ({ ...g, kinder: plan(g.name, tiefe + 1) }));
  };
  const baum = plan(h.socpak, 0);
  const alle = new Map();
  const sammle = (liste) => { for (const c of liste) { alle.set(c.id, c); sammle(c.kinder); } };
  sammle(baum);
  if (!alle.size) throw new Error(`kein Kind-Container trifft ${h.kinder.folge.map(String).join(', ')} (genannt: ${Object.keys(ausgelassen).join(', ') || 'keiner'})`);

  for (const c of alle.values()) {
    if (!FORCE && existsSync(c.glb) && existsSync(c.licht)) { console.log(`  = ${kurz(c.glb)}`); continue; }
    const [dir, base] = ende(c.name);
    const t = Date.now();
    const r = sb(['socpak', 'export', `${dir}\\${base}`, c.glb, ...schalter(h.lod)], { log: true });
    writeFileSync(c.licht, lichtZeilen(r.log).join('\n') + '\n');
    console.log(`  + ${kurz(c.glb)}  (${((Date.now() - t) / 1000).toFixed(0)} s)`);
  }

  const eigeneLichter = `${RAW}${h.key}.lights-src.txt`;
  if (!existsSync(eigeneLichter)) throw new Error(`${kurz(eigeneLichter)} fehlt (das Lichtprotokoll des Rohexports): mit --force neu exportieren`);
  const bericht = `${SRC}hall/${h.key}.kinder.json`;
  const konfig = JSON.stringify({ folge: h.kinder.folge.map(String), lage: h.kinder.lage ?? [] });
  const quellen = [h.raw, eigeneLichter, ...[...alle.values()].flatMap((c) => [c.glb, c.licht])];
  if (!FORCE && existsSync(file) && existsSync(bericht) && JSON.parse(readFileSync(bericht, 'utf8')).konfig === konfig && quellen.every((q) => statSync(q).mtimeMs <= statSync(file).mtimeMs)) {
    console.log(`  = ${kurz(file)}  (Kinder eingehängt)`);
    return;
  }

  // Ruhelagen aus den Spuren des Spiels
  const lagen = (h.kinder.lage ?? []).map((l) => {
    sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/]${esc(l.cga)}\\.(cga|chrparams)$`]);
    const files = listFiles(RAW);
    const cga = files.find((f) => f.toLowerCase().endsWith(`/${l.cga}.cga`.toLowerCase()));
    const chr = files.find((f) => f.toLowerCase().endsWith(`/${l.cga}.chrparams`.toLowerCase()));
    if (!cga || !chr) throw new Error(`Lage ${l.cga}: .cga oder .chrparams steht nicht in der Data.p4k`);
    const dump = spawnSync(STARBREAKER, ['nmc', 'dump', cga], { encoding: 'utf8', maxBuffer: 1 << 28 }).stdout || '';
    const nodes = [...dump.matchAll(/\[\s*(\d+)\] (\S+) parent=(\S+) geom=(\d+)/g)].map((m) => ({ index: Number(m[1]), name: m[2], parent: m[3] === 'root' ? null : Number(m[3]), geom: Number(m[4]) }));
    const amKnochen = (n) => { for (let k = n; k; k = nodes.find((x) => x.index === k.parent)) if (k.name === l.knochen) return true; return false; };
    const netze = nodes.filter((n) => n.geom === 0);
    const lose = netze.filter((n) => !amKnochen(n));
    if (!netze.length || lose.length) throw new Error(`Lage ${l.cga}: ${netze.length ? `Netz ${lose.map((n) => n.name).join(', ')} hängt nicht am Knochen ${l.knochen}, das Netz müsste erst geteilt werden` : 'kein Netz im Knotenbaum erkannt'}`);
    const x2 = `${chr}.xml`;
    rmSync(x2, { force: true });
    spawnSync(STARBREAKER, ['cryxml', 'convert', chr, x2]);
    const liste = existsSync(x2) ? readFileSync(x2, 'utf8') : readFileSync(chr, 'utf8');
    const a = [...liste.matchAll(/<Animation name="([^"$#][^"]*)" path="([^"]+)"/g)].find((m) => m[1] === l.spur);
    if (!a) throw new Error(`Lage ${l.cga}: die .chrparams nennt keine Spur ${l.spur}`);
    sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/]${esc(a[2])}$`]);
    const caf = listFiles(RAW).find((f) => f.toLowerCase().endsWith(`/${a[2].toLowerCase()}`));
    if (!caf) throw new Error(`Lage ${l.cga}: ${a[2]} steht nicht in der Data.p4k`);
    const b = readCaf(readFileSync(caf), nodes.map((n) => n.name)).bones.find((x) => x.name === l.knochen);
    const versatz = b?.pos?.values?.at(-1);
    if (!versatz) throw new Error(`Lage ${l.cga}: Spur ${l.spur} trägt keine Lage für ${l.knochen}`);
    const dreht = b.rot?.values?.some((q) => q.some((v, i) => Math.abs(v - b.rot.values[0][i]) > 1e-4));
    if (dreht) throw new Error(`Lage ${l.cga}: Spur ${l.spur} dreht ${l.knochen}; gestellt wird nur ein Versatz`);
    return { ...l, caf: a[2], versatz: versatz.map((v) => Math.round(v * 10000) / 10000), muster: new RegExp(`(^|[\\\\/])${esc(l.cga)}\\.cga$`, 'i'), knoten: 0 };
  });

  const zeilen = (f) => readFileSync(f, 'utf8').split('\n').filter((z) => z.trim());
  const liste = [];
  const room = await io.read(h.raw);
  const vorher = { knoten: room.getRoot().listNodes().length, netze: room.getRoot().listMeshes().length };
  const lichter = await kinderBaumEinhaengen(room, baum, { lese: (c) => io.read(c.glb), zeilen: (c) => zeilen(c.licht), lagen, liste, melde: (m) => console.log(m) });
  for (const l of lagen) if (!l.knoten) throw new Error(`Lage ${l.cga}: kein eingehängtes Kind trägt dieses Netz, der Eintrag ist ohne Anlass`);
  await room.transform(unpartition());
  await io.write(file, room);
  const alleZeilen = [...zeilen(eigeneLichter), ...lichter];
  writeFileSync(`${SRC}hall/${h.key}.lights-src.txt`, alleZeilen.join('\n') + '\n');
  writeFileSync(bericht, JSON.stringify({ konfig, kinder: liste, ausgelassen, lagen: lagen.map(({ muster, ...l }) => l), lichtzeilen: { halle: alleZeilen.length - lichter.length, kinder: lichter.length } }, null, 1));
  console.log(`  Kinder eingehängt: ${room.getRoot().listNodes().length - vorher.knoten} Knoten und ${room.getRoot().listMeshes().length - vorher.netze} Netze dazu, ${lichter.length} Lichtzeilen zu ${alleZeilen.length - lichter.length} der Halle; gestellt: ${lagen.map((l) => `${l.cga} um ${l.versatz.join(',')} (${l.spur}, ${l.knoten} Knoten)`).join('; ') || 'nichts'}`);
  console.log(`  nicht eingehängt (kein Muster in kinder.folge): ${Object.entries(ausgelassen).map(([k, n]) => `${k} ${n}`).join(', ') || 'keiner'}`);
}
