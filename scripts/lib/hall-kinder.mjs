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
import { ALL_EXTENSIONS, KHRLightsPunctual } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition } from '@gltf-transform/functions';
import { readCaf } from './ivo-caf.mjs';
import { ruheDunkel, ruheListe, ruheTeile } from './hall-ruhe.mjs';

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
// Drehungen als Quaternion w, x, y, z (so nennt sie die .soc): a mal b, und v gedreht um q
const qMal = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
const qDreh = (q, v) => { const [w, x, y, z] = q, [a, b, c] = v, tx = 2 * (y * c - z * b), ty = 2 * (z * a - x * c), tz = 2 * (x * b - y * a); return [a + w * tx + (y * tz - z * ty), b + w * ty + (z * tx - x * tz), c + w * tz + (x * ty - y * tx)]; };
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

// Was von den eingehängten Kindern im Modell steht: je Kennung die Halter
// (kindEinhaengen: „kind_<Kennung>_<Nr>“ mit extras.kind), unter denen
// Dreiecke hängen, und diese Dreiecke (mit den eigenen Kindern eines Kindes,
// die zusätzlich unter ihrer Kennung zählen). Der Build zählt damit am
// Rohmodell der Halle, solange die Halter im Baum stehen, und schreibt die
// Zahl ins Manifest; verify:hangar-hallen hält sie über einer Klinke. Ein
// Halter ohne Dreieck zählt nicht: Er stünde im Baum, und in der Wand bliebe
// das Loch. Anlass: die Türen der Personenaufzüge und der Abgabe-Nische der
// Large-Halle; fielen sie wieder weg, zeigte es keine andere Zahl deutlich.
export function kinderBestand(doc) {
  const je = new Map();
  let exemplare = 0;
  for (const n of doc.getRoot().listNodes()) {
    const k = n.getExtras()?.kind, kopf = `kind_${k}_`;
    if (typeof k !== 'string' || !k || !n.getName().startsWith(kopf) || !/^\d+$/.test(n.getName().slice(kopf.length))) continue;
    let t = 0;
    n.traverse((c) => { if (c.getMesh()) t += tris(c.getMesh()); });
    if (!t) continue;
    const e = je.get(k) ?? { exemplare: 0, tris: 0 };
    e.exemplare++; e.tris += t; exemplare++;
    je.set(k, e);
  }
  return { exemplare, je: Object.fromEntries([...je].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) };
}

// Knoten einer .cga, wie „nmc dump“ sie nennt: Index, Name, Elternknoten, Art
// (geom 0 = Netz) und Lage im Raum der Datei (bone_to_world, drei Zeilen zu vier
// Zahlen, die vierte ist der Ort). b2w ist null, wenn die Zeilen fehlen.
export function nmcKnoten(dump) {
  const out = [];
  for (const m of dump.matchAll(/\[\s*(\d+)\] (\S+) parent=(\S+) geom=(\d+)[^\n]*((?:\r?\n\s*b2w\[\d\] = \[[^\]]*\])*)/g)) {
    const reihen = [...m[5].matchAll(/b2w\[\d\] = \[([^\]]*)\]/g)].map((z) => z[1].split(',').map(Number));
    const ganz = reihen.length === 3 && reihen.every((z) => z.length === 4 && z.every(Number.isFinite));
    out.push({ index: Number(m[1]), name: m[2], parent: m[3] === 'root' ? null : Number(m[3]), geom: Number(m[4]), b2w: ganz ? reihen : null });
  }
  return out;
}

// Um wie viel ein Netz am Knochen gestellt wird. Die Spur nennt die Lage des
// Knochens im Raum seines Elternknotens (so setzt sie auch das Fahrwerk,
// applyPose in landing-gear.mjs), nicht den Weg ab der Ruhelage: Gestellt wird
// um (letzter Wert − Ruhelage). Bis 15.11.2026 galt der letzte Wert selbst;
// das stimmt nur, wenn der Knochen im Ursprung ruht (so das Tor des
// Frachtaufzugs: Ruhelage 0/0/0, letzter Wert 0/0/6), sonst zählte die
// Ruhelage doppelt (Befund von CodeRabbit an PR #371, siebte Runde).
// kindLage schiebt im Raum des Netzes: Ist der Knochen oder einer seiner
// Elternknoten gedreht oder ein Knoten ohne lesbare Lage, bricht es ab,
// statt zu raten. Ein gedrehtes Netz geht nur, wenn seine Drehung den
// Versatz nicht ändert (so das Tor des Frachtaufzugs der XL-Halle: Das Netz
// des 25-m-Tors steht um 180° um die Hochachse gedreht im 30-m-Tor, das Tor
// fährt senkrecht; im Raum des Netzes ist der Weg derselbe).
export function spurVersatz(knoten, knochen, werte) {
  const k = knoten.find((n) => n.name === knochen);
  if (!k) throw new Error(`der Knotenbaum nennt keinen Knochen ${knochen}`);
  if (!werte?.length) throw new Error(`die Spur trägt keine Lage für ${knochen}`);
  const kette = [];
  for (let n = k; n; n = knoten.find((x) => x.index === n.parent)) kette.push(n);
  const gerade = (n) => n.b2w && [0, 1, 2].every((r) => [0, 1, 2].every((c) => Math.abs(n.b2w[r][c] - (r === c ? 1 : 0)) < 1e-4));
  const netze = knoten.filter((n) => n.geom === 0);
  const schief = [...new Set([...kette, ...netze.filter((n) => !n.b2w)])].filter((n) => !gerade(n));
  if (schief.length) throw new Error(`${schief.map((n) => n.name).join(', ')} ${schief.some((n) => !n.b2w) ? 'ohne lesbare Lage' : 'gedreht'}: gestellt wird nur ein Versatz in ungedrehten Knoten`);
  const ruhe = [0, 1, 2].map((i) => k.b2w[i][3] - (kette[1] ? kette[1].b2w[i][3] : 0));
  const versatz = werte.at(-1).map((v, i) => v - ruhe[i]);
  // im Raum des Netzes: R⁻¹ · versatz; gleich nur, wenn die Drehung ihn auf sich selbst abbildet
  const quer = netze.filter((n) => !gerade(n) && [0, 1, 2].some((c) => Math.abs([0, 1, 2].reduce((a, r) => a + n.b2w[r][c] * versatz[r], 0) - versatz[c]) > 1e-4));
  if (quer.length) throw new Error(`${quer.map((n) => n.name).join(', ')} gedreht, und die Drehung ändert den Versatz ${versatz.join(',')}: gestellt wird nur ein Versatz, den die Drehung des Netzes nicht ändert`);
  return { ruhe, versatz };
}

// Gilt das Eingehängte noch? Nur wenn Modell, Lichtprotokoll und Bericht da
// sind, der Bericht dieselben Regeln und denselben Plan nennt (konfig) und
// keine Quelle jünger ist als das Modell. Bis 15.11.2026 fragte die Regel
// nicht nach dem Lichtprotokoll: Fehlte es, blieb es weg, und der Bau las
// „missing“ (Befund von CodeRabbit an PR #371, siebte Runde). Ein Bericht,
// der sich nicht lesen lässt, gilt nicht (vorher brach der Lauf daran ab).
// w: { da(f), zeit(f), lies(f) }.
export function eingehaengtGilt({ force, modell, licht, bericht, konfig, quellen }, w = { da: existsSync, zeit: (f) => statSync(f).mtimeMs, lies: (f) => readFileSync(f, 'utf8') }) {
  if (force || ![modell, licht, bericht].every((f) => w.da(f))) return false;
  let alt;
  try { alt = JSON.parse(w.lies(bericht)).konfig; } catch { return false; }
  return alt === konfig && quellen.every((q) => w.zeit(q) <= w.zeit(modell));
}

// Schreibt das Eingehängte so, dass ein abgebrochener Lauf nie als fertig
// gilt: erst den alten Bericht weg, dann das Lichtprotokoll, dann das Modell,
// zuletzt den Bericht. Vorher kam das Modell zuerst: Brach der Lauf danach
// ab, war es jünger als jede Quelle, der alte Bericht nannte dieselbe
// Konfiguration, und der nächste Lauf ließ das alte Lichtprotokoll stehen.
export async function eingehaengtSchreiben({ berichtWeg, licht, modell, bericht }) {
  berichtWeg();
  licht();
  await modell();
  bericht();
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

// Lässt von einem Export nur stehen, was die Halle zeigt: die Netze, deren
// Name eines der Muster trifft. Alle anderen Netze und alle Lichter fallen
// weg, ebenso Knoten, die danach nichts mehr tragen. Anlass: die Aufzüge für
// Personen und die Abgabe-Nische der Large-Halle. Ihre Türen ruhen zu, die
// Kabine dahinter sieht niemand, und ihre Lampen leuchteten durch die Wand in
// das Lichtgitter der Halle. Liefert, was blieb und was fiel; trifft ein
// Muster kein Netz, bricht es ab (eine Regel ohne Anlass).
export function kindNur(doc, muster, name = 'Kind') {
  const wurzel = wurzelVon(doc, name);
  const treffer = muster.map(() => 0);
  const r = { netze: 0, dreiecke: 0, wegNetze: 0, wegDreiecke: 0, wegLichter: 0 };
  for (const node of doc.getRoot().listNodes()) {
    if (node.getExtension('KHR_lights_punctual')) { node.setExtension('KHR_lights_punctual', null); r.wegLichter++; }
    const mesh = node.getMesh();
    if (!mesh) continue;
    const i = muster.findIndex((re) => re.test(mesh.getName()));
    if (i < 0) { r.wegNetze++; r.wegDreiecke += tris(mesh); node.setMesh(null); continue; }
    treffer[i]++; r.netze++; r.dreiecke += tris(mesh);
  }
  const ohne = muster.filter((_, i) => !treffer[i]);
  if (ohne.length) throw new Error(`${name}: kein Netz trifft ${ohne.map(String).join(', ')}; die Auswahl ist ohne Anlass`);
  // leere Äste von den Blättern her
  const leer = (n) => { for (const c of n.listChildren()) leer(c); if (n !== wurzel && !n.getMesh() && !n.listChildren().length) n.dispose(); };
  leer(wurzel);
  for (const m of doc.getRoot().listMeshes()) if (!m.listParents().some((x) => x.propertyType === 'Node')) m.dispose();
  for (const l of doc.getRoot().listExtensionsUsed().flatMap((e) => (e.extensionName === 'KHR_lights_punctual' ? e.listProperties() : []))) if (!l.listParents().some((x) => x.propertyType === 'Node')) l.dispose();
  return r;
}

// ─── Lampen einer Lichtgruppe, die an einem Knochen hängt ────────────────
// Der Export schreibt die Lampen einer gewöhnlichen Lichtgruppe als
// Lichtknoten ins Modell. Hängt die Gruppe aber an einem Knochen eines
// Bauteils (EntityClass LightGroupObjectAttach, AttachmentType CharacterBone),
// lässt er sie ganz weg: Die Kabine des Frachtaufzugs kommt mit ihren
// Leuchten als Netz und ohne eine einzige Lampe (61 am Knochen anim_lift der
// Plattform), sie stand dunkel in der Wand. Hier werden diese Lampen aus den
// Entities des Containers gelesen und so in seinen Export gehängt, wie der
// Export es bei einer gewöhnlichen Gruppe selbst tut. Nachgemessen an den 60
// Lampen des Aufzugmoduls (15.11.2026, Ort und Achse je Lampe auf 0,0001):
// - Name „<Gruppe>-NNN“, NNN = Stelle der Lampe in der Gruppe
// - Ort und Drehung aus RelativeXForm (rotation = w, x, y, z); die Lampe
//   strahlt längs ihrer eigenen +X-Achse
// - Zustand defaultState; Farbe aus der Farbtemperatur (kelvinFarbe), wenn
//   useTemperature="1", sonst die genannte Farbe
// - Stärke im Modell = Stärke im Spiel mal 1500, Reichweite = lightRadius,
//   Projector = Spot mit halbem FOV als Kegel (innen 0,8 davon), alles
//   andere Punktlicht; den Typ des Spiels trägt die Lichtzeile
// Was für die angehängte Gruppe dazukommt: RelativeXForm gilt im Raum des
// Knochens, nicht der Gruppe (mit dem Ort der Gruppe läge jede Lampe 11 m
// neben ihrer Leuchte). Den Knochen nennt der Container nicht selbst. Er
// folgt aus der Gruppe: Die nennt ihre Lage im Container (Pos, Rotate, Scale)
// und ihren Versatz zum Knochen (ParentOffsetPos, -Rot, -Scale); Gruppe =
// Knochen mal Versatz, also Knochen = Gruppe mal Versatz⁻¹. Nachgemessen an
// den angehängten Gruppen der Hallen Small, Medium und Large (18.11.2026,
// Lampen bis 0,3 m an einer Leuchte des Modells): Schiffsplattform Small
// (Träger um 90° gedreht, Gruppe doppelt skaliert gegen einen doppelten
// Versatz) 23 von 25, Kabine Small (Knochen 4,5 m vor dem Ursprung des
// Bauteils) 18 von 32, Schiffsplattform Medium (Knochen 0,5 m unter dem
// Träger) 28 von 31; dieselben Lampen mit dem Ort des Trägers allein 1, 0
// und 0. An Large (Plattform 49 von 55, Kabine 28 von 61) ergibt der Knochen
// den Ort des Trägers, wie zuvor gerechnet. Ein skalierter Knochen ist nicht
// nachgemessen und bricht ab. Dieser Schritt prüft das Ergebnis, statt es zu
// glauben: anhangLampen rechnet, lampenEinhaengen prüft an den Leuchten des
// Modells (anLeuchte).
// Abweichung vom Export, mit Absicht: Eine Lampe, deren defaultState keine
// Stärke hat, bleibt aus. Der Export nimmt dann den Zustand auxiliary, und so
// brennen in der Halle fünf Warnleuchten des Moduls, die im Spiel in Ruhe
// dunkel sind.

// Farbe einer Farbtemperatur in Kelvin, wie der Export sie schreibt (Näherung
// von Tanner Helland; an 21 Lichtzeilen der Halle auf sechs Stellen gleich).
export function kelvinFarbe(k) {
  if (!(k > 0)) throw new Error(`Farbtemperatur ${k} ist keine positive Zahl`);
  const t = k / 100, teil = (v) => Math.min(255, Math.max(0, v)) / 255;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [teil(r), teil(g), teil(b)];
}

// Die Lampen der Lichtgruppe `gruppe` aus den Entities eines Containers
// (XML aus seiner .soc). Die Gruppe muss am Knochen `knochen` eines Bauteils
// hängen, das frei im Container steht (ohne eigenen Träger); alles andere ist
// nicht nachgemessen und bricht ab. Liefert die Lampen, die brennen (lampen,
// Ort und Drehung im Raum des Containers: RelativeXForm im Raum des Knochens),
// die Namen derer ohne Stärke (aus), das Netz des Trägers (traeger, Dateiname
// ohne Endung), seinen Ort (traegerOrt) und die Lage des Knochens (knochenOrt,
// knochenDreh = w, x, y, z).
export function anhangLampen(xml, { gruppe, knochen }) {
  const at = (s, k) => (s.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
  const ents = [...xml.matchAll(/<Entity\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Entity>)/g)].map((m) => ({ kopf: m[1], rumpf: m[2] ?? '' }));
  const treffer = ents.filter((e) => at(e.kopf, 'Name') === gruppe);
  if (treffer.length !== 1) throw new Error(`Lichtgruppe ${gruppe}: ${treffer.length} Entities dieses Namens, erwartet ist genau eine`);
  const { kopf, rumpf } = treffer[0];
  const haengt = [at(kopf, 'EntityClass'), at(kopf, 'AttachmentType'), at(kopf, 'AttachmentTarget')];
  if (haengt[0] !== 'LightGroupObjectAttach' || haengt[1] !== 'CharacterBone' || haengt[2] !== knochen) throw new Error(`Lichtgruppe ${gruppe}: erwartet ist eine LightGroupObjectAttach am Knochen ${knochen} (CharacterBone), gefunden ${haengt.map((x) => x ?? 'ohne Angabe').join(' / ')}`);
  const reihe = (s, n, was) => {
    const v = String(s ?? '').split(',').map(Number);
    if (s === undefined || v.length !== n || !v.every(Number.isFinite)) throw new Error(`${was}: "${s ?? ''}" ist keine Reihe aus ${n} Zahlen`);
    return v;
  };
  const eltern = ents.filter((e) => at(e.kopf, 'EntityCryGUID') !== undefined && at(e.kopf, 'EntityCryGUID') === at(kopf, 'ParentEntityCryGUID'));
  if (eltern.length !== 1) throw new Error(`Lichtgruppe ${gruppe}: der Träger (ParentEntityCryGUID) steht ${eltern.length} Mal im Container, erwartet ist genau einmal`);
  const t = eltern[0], tName = at(t.kopf, 'Name') ?? '?';
  if (at(t.kopf, 'ParentEntityCryGUID') !== undefined) throw new Error(`Lichtgruppe ${gruppe}: der Träger ${tName} hängt selbst an einem Bauteil (ParentEntityCryGUID); nachgemessen ist nur ein Träger, der frei im Container steht`);
  const traegerOrt = at(t.kopf, 'Pos') === undefined ? [0, 0, 0] : reihe(at(t.kopf, 'Pos'), 3, `${tName} Pos`);
  // Knochen = Gruppe mal Versatz⁻¹ (Drehungen w, x, y, z)
  const drehung = (k, was) => {
    const q = at(kopf, k) === undefined ? [1, 0, 0, 0] : reihe(at(kopf, k), 4, was), b = Math.hypot(...q);
    if (Math.abs(b - 1) > 1e-3) throw new Error(`${was} ${q.join(',')} ist keine Drehung (Betrag ${b.toFixed(4)})`);
    return q.map((v) => v / b);
  };
  const skala = (k, was) => { const s = at(kopf, k); if (s === undefined) return [1, 1, 1]; const v = String(s).split(','); return reihe(s, v.length === 1 ? 1 : 3, was).flatMap((x, i, a) => (a.length === 1 ? [x, x, x] : [x])); };
  const gSkala = skala('Scale', `${gruppe} Scale`), vSkala = skala('ParentOffsetScale', `${gruppe} ParentOffsetScale`);
  if (gSkala.some((v, i) => Math.abs(v / vSkala[i] - 1) > 1e-3)) throw new Error(`Lichtgruppe ${gruppe}: Scale ${gSkala.join(',')} gegen ParentOffsetScale ${vSkala.join(',')} ergibt einen skalierten Knochen; nachgemessen ist nur ein unskalierter`);
  const gDreh = drehung('Rotate', `${gruppe} Rotate`), vDreh = drehung('ParentOffsetRot', `${gruppe} ParentOffsetRot`);
  const gOrt = at(kopf, 'Pos') === undefined ? [0, 0, 0] : reihe(at(kopf, 'Pos'), 3, `${gruppe} Pos`), vOrt = at(kopf, 'ParentOffsetPos') === undefined ? [0, 0, 0] : reihe(at(kopf, 'ParentOffsetPos'), 3, `${gruppe} ParentOffsetPos`);
  let knochenDreh = qMal(gDreh, [vDreh[0], -vDreh[1], -vDreh[2], -vDreh[3]]);
  if (knochenDreh[0] < 0) knochenDreh = knochenDreh.map((v) => -v);
  if (Math.max(...knochenDreh.slice(1).map(Math.abs)) < 1e-5) knochenDreh = [1, 0, 0, 0];
  const ungedreht = knochenDreh.slice(1).every((v) => v === 0);
  // auf 0,1 mm: an Large ergibt das den Ort des Trägers genau (die Gruppe nennt -111,99999976 und einen Versatz von 0,00001)
  const knochenOrt = qDreh(knochenDreh, vOrt).map((v, k) => Math.round((gOrt[k] - v) * 1e4) / 1e4 + 0);
  const traeger = ((t.rumpf.match(/GlobalResourceGeometry" path="([^"]+)"/) || [])[1] ?? '').replace(/\\/g, '/').split('/').pop().replace(/\.\w+$/, '');
  const lampen = [], aus = [];
  [...rumpf.matchAll(/<Light\b([^>]*)>([\s\S]*?)<\/Light>/g)].forEach((l, i) => {
    const b = l[2], name = `${gruppe}-${String(i).padStart(3, '0')}`, wo = `${name} (${at(l[1], 'Name') ?? 'ohne Namen'})`;
    const teil = (k) => (b.match(new RegExp(`<${k}\\b([^>]*?)\\/?>`)) || [])[1];
    const comp = teil('EntityComponentLight'), zustand = b.match(/<defaultState\b([^>]*)>\s*<color\b([^>]*?)\/?>/), xf = teil('RelativeXForm');
    if (comp === undefined || !zustand || xf === undefined) throw new Error(`${wo}: ohne EntityComponentLight, defaultState mit Farbe oder RelativeXForm`);
    const zahl = (s, k) => { const v = Number(at(s ?? '', k)); if (at(s ?? '', k) === undefined || !Number.isFinite(v)) throw new Error(`${wo}: ${k}="${at(s ?? '', k) ?? ''}" ist keine Zahl`); return v; };
    const staerke = zahl(zustand[1], 'intensity');
    if (at(comp, 'active') !== '1' || !(staerke > 0)) { aus.push(name); return; }
    const typ = at(comp, 'lightType') ?? '', temp = at(comp, 'useTemperature') === '1', kelvin = zahl(zustand[1], 'temperature');
    const radius = zahl(teil('sizeParams'), 'lightRadius'), fov = typ === 'Projector' ? zahl(teil('projectorParams'), 'FOV') : null;
    if (!typ || !(radius > 0) || (fov !== null && !(fov > 0 && fov <= 180))) throw new Error(`${wo}: Typ „${typ}“, Reichweite ${radius}${fov === null ? '' : `, FOV ${fov}`} ergeben keine Lampe`);
    const dreh = reihe(at(xf, 'rotation'), 4, `${wo} rotation`), q = Math.hypot(...dreh);
    if (Math.abs(q - 1) > 1e-3) throw new Error(`${wo}: rotation ${dreh.join(',')} ist keine Drehung (Betrag ${q.toFixed(4)})`);
    const hier = reihe(at(xf, 'translation'), 3, `${wo} translation`), eigenDreh = dreh.map((v) => v / q);
    lampen.push({ name, eigen: at(l[1], 'Name') ?? '', typ, temp, kelvin, staerke, radius, fov, farbe: temp ? kelvinFarbe(kelvin) : ['r', 'g', 'b'].map((k) => zahl(zustand[2], k)), ort: (ungedreht ? hier : qDreh(knochenDreh, hier)).map((v, k) => v + knochenOrt[k]), dreh: ungedreht ? eigenDreh : qMal(knochenDreh, eigenDreh) });
  });
  if (!lampen.length) throw new Error(`Lichtgruppe ${gruppe}: keine Lampe mit Stärke im defaultState (${aus.length} ohne), der Eintrag ist ohne Anlass`);
  return { lampen, aus, traeger, traegerOrt, knochenOrt, knochenDreh };
}

// Die Zeile, die der Export für eine Lampe ins Protokoll schreibt; der Build
// verbindet sie über den Namen mit dem Lichtknoten (hallLights) und liest
// daraus Typ, Stärke und Reichweite des Spiels.
export const lampenZeile = (l) => `Light '${l.name}' type=${l.typ} useTemp=${l.temp} temperature=${l.kelvin} intensity=${l.staerke} radius=${l.radius} color=[${l.farbe.map((v) => +v.toFixed(8)).join(', ')}]`;

// Wie stark ein Lichtknoten gegenüber dem Spiel ist (am Export nachgemessen)
const LICHT_MAL = 1500;

// Hängt die Lampen (anhangLampen) als Lichtknoten in den Export doc, unter
// seine Wurzel, im Raum des Containers. Vorher die Probe am Modell: Wenigstens
// anLeuchte Lampen müssen bis auf `nah` Meter am Ursprung eines Netzknotens
// sitzen (eine Leuchte trägt ihre Lampe; an der Kabine sind es 24 von 57, mit
// dem Ort der Gruppe dazugerechnet keine). Sitzen weniger dort, gilt der Raum
// nicht mehr, in dem dieser Schritt die Angaben liest, und er bricht ab,
// statt Lampen neben ihre Leuchten zu hängen. Liefert die Lichtzeilen.
export function lampenEinhaengen(doc, lampen, { name = 'Kind', gruppe = 'anhang', anLeuchte = 0, nah = 0.3 } = {}) {
  const wurzel = wurzelVon(doc, name);
  const orte = [];
  const sammle = (n, m) => { const hier = mul(m, n.getMatrix()); if (n.getMesh()) orte.push(hier.slice(12, 15)); n.listChildren().forEach((c) => sammle(c, hier)); };
  wurzel.listChildren().forEach((c) => sammle(c, schub(0, 0, 0)));
  const anNetz = lampen.filter((l) => orte.some((o) => Math.hypot(o[0] - l.ort[0], o[1] - l.ort[1], o[2] - l.ort[2]) <= nah)).length;
  if (anNetz < anLeuchte) throw new Error(`${name}: nur ${anNetz} von ${lampen.length} Lampen der Gruppe ${gruppe} sitzen an einem Netzknoten (bis ${nah} m), erwartet sind wenigstens ${anLeuchte}; die Angaben gelten wohl in einem anderen Raum (Träger, Knochen oder Gruppe versetzt)`);
  const ext = doc.createExtension(KHRLightsPunctual);
  const halter = doc.createNode(`anhang_${gruppe}`).setExtras({ anhang: gruppe });
  wurzel.addChild(halter);
  for (const l of lampen) {
    const licht = ext.createLight(l.name).setType(l.typ === 'Projector' ? 'spot' : 'point').setColor(l.farbe).setIntensity(l.staerke * LICHT_MAL).setRange(l.radius);
    if (l.typ === 'Projector') { const aussen = (l.fov / 2) * Math.PI / 180; licht.setOuterConeAngle(aussen).setInnerConeAngle(aussen * 0.8); }
    halter.addChild(doc.createNode(l.name).setTranslation(l.ort).setRotation([l.dreh[1], l.dreh[2], l.dreh[3], l.dreh[0]]).setExtension('KHR_lights_punctual', licht));
  }
  return { lampen: lampen.length, anNetz, zeilen: lampen.map(lampenZeile) };
}

// Hängt die Lichtgruppen an, die an einem Knochen der Halle selbst hängen
// (Einträge in anhang ohne kind; die Schiffsplattform der Large-Halle trägt
// so ihre Landeleuchten). Vor den Kindern zu rufen: Die Probe an den Leuchten
// gilt dem eigenen Modell der Halle. Zählt exemplare auf 1, merkt anNetz und
// liefert die Lichtzeilen; Einträge mit kind bleiben, wie sie sind.
export function halleAnhang(room, anhang) {
  const zeilen = [];
  for (const a of anhang.filter((x) => x.kind === undefined)) {
    let r;
    try { r = lampenEinhaengen(room, a.lampen, { name: 'Halle', gruppe: a.gruppe, anLeuchte: a.anLeuchte }); } catch (e) { throw new Error(`anhang Halle: ${e.message}`); }
    a.exemplare = 1; a.anNetz = r.anNetz;
    zeilen.push(...r.zeilen);
  }
  return zeilen;
}

// Hängt einen Baum von Kindern ein, von innen nach außen: erst die Kinder
// des Kindes, dann es selbst. kinder: [{ id, name, stellen, kinder }].
// lese(c) liefert den Export des Kindes als Dokument, zeilen(c) seine
// Lichtzeilen. lagen: [{ muster, versatz, knoten }], knoten wird hier
// hochgezählt. Gestellt wird ein Kind, BEVOR seine eigenen Kinder dazukommen:
// die sind schon gestellt, und danach träfe das Muster sie ein zweites Mal.
// nur: [{ kind, muster: [RegExp], exemplare }] wählt bei dem genannten Kind
// aus (kindNur), ebenfalls bevor seine eigenen Kinder dazukommen; seine
// Lichtzeilen entfallen mit seinen Lichtern, exemplare wird hochgezählt.
// anhang: [{ kind, gruppe, lampen, anLeuchte, exemplare }] hängt bei dem
// genannten Kind die Lampen einer Lichtgruppe an, die der Export weglässt
// (lampenEinhaengen), ebenfalls bevor seine eigenen Kinder dazukommen: Die
// Probe an den Leuchten gilt nur seinem eigenen Modell. Ihre Zeilen stehen
// hinter denen des Kindes; nur und anhang am selben Kind widersprechen sich.
// mal: wie oft der Elterncontainer am Ende in der Halle steht.
// Liefert die Lichtzeilen in der Reihenfolge der Exemplare; liste bekommt
// je Kind einen Berichtseintrag.
export async function kinderBaumEinhaengen(doc, kinder, { lese, zeilen = () => [], lagen = [], nur = [], anhang = [], liste = [], melde = () => {} }, ebene = 0, mal = 1) {
  const lichter = [];
  for (const c of kinder) {
    const src = await lese(c);
    const exemplare = mal * c.stellen.length;
    for (const l of lagen) l.knoten += kindLage(src, l.muster, l.versatz) * exemplare;
    const regel = nur.find((n) => n.kind === c.id);
    const auswahl = regel ? kindNur(src, regel.muster, c.id) : null;
    if (regel) regel.exemplare += exemplare;
    const hang = anhang.filter((a) => a.kind === c.id);
    if (hang.length && regel) throw new Error(`${c.id}: nur und anhang am selben Kind widersprechen sich (nur lässt jedes Licht weg)`);
    const dazu = hang.map((a) => { a.exemplare += exemplare; return { gruppe: a.gruppe, ...lampenEinhaengen(src, a.lampen, { name: c.id, gruppe: a.gruppe, anLeuchte: a.anLeuchte }) }; });
    const innen = await kinderBaumEinhaengen(src, c.kinder ?? [], { lese, zeilen, lagen, nur, anhang, liste, melde }, ebene + 1, exemplare);
    const r = kindEinhaengen(doc, src, c.stellen, c.id);
    const eigene = [...(regel ? [] : zeilen(c)), ...dazu.flatMap((d) => d.zeilen), ...innen];
    for (let i = 0; i < c.stellen.length; i++) lichter.push(...eigene);
    liste.push({ id: c.id, container: c.name, ebene, exemplare, stellen: c.stellen, jeExemplar: { knoten: r.knoten, dreiecke: r.dreiecke, lichtknoten: r.lichter, lichtzeilen: eigene.length }, ...(auswahl ? { nur: auswahl } : {}), ...(dazu.length ? { anhang: dazu.map(({ zeilen: z, ...d }) => d) } : {}) });
    melde(`  Kind ${c.id}: ${c.stellen.length} Stelle(n) ${ebene ? 'in seinem Elterncontainer' : 'in der Halle'}, ${exemplare} Exemplar(e), je ${r.dreiecke} Dreiecke, ${r.knoten} Knoten, ${r.lichter} Lichtknoten${c.kinder?.length ? ' (mit seinen eigenen Kindern)' : ''}${auswahl ? `; nur ${auswahl.netze} Netz(e) behalten, ${auswahl.wegNetze} Netz(e) mit ${auswahl.wegDreiecke} Dreiecken und ${auswahl.wegLichter} Licht(er) weggelassen` : ''}${dazu.map((d) => `; ${d.lampen} Lampe(n) der Lichtgruppe ${d.gruppe} angehängt, ${d.anNetz} davon an einer Leuchte`).join('')}`);
  }
  return lichter;
}

// Der Plan als Kennung: welche Container (mit ihrem Namen im Spiel) in
// welcher Reihenfolge wo hängen, bis in die Tiefe. Was am Ort des
// Zwischenspeichers hängt (Pfade der Exporte), gehört nicht dazu. Der Bericht des Laufs trägt sie: Nennt die Container-XML
// ein Kind später an anderer Stelle, gedreht, ein weiteres oder eines nicht
// mehr, gilt das Eingehängte nicht mehr (an den Zeiten der Dateien ist das
// nicht zu sehen, der Export eines Kindes bleibt derselbe).
const planKern = (baum) => baum.map((c) => ({ id: c.id, name: c.name, stellen: c.stellen.map((s) => [...s.pos, ...s.rot].join(',')), kinder: planKern(c.kinder ?? []) }));
export const planKennung = (baum) => JSON.stringify(planKern(baum));
// Woran der Extraktor erkennt, dass das Eingehängte noch gilt (steht im
// Bericht hall/<halle>.kinder.json): die Regeln des Eintrags und der Plan.
export const kinderKonfig = (kinder, baum) => JSON.stringify({ folge: kinder.folge.map(String), lage: kinder.lage ?? [], ...(kinder.nur?.length ? { nur: kinder.nur } : {}), ...(kinder.anhang?.length ? { anhang: kinder.anhang } : {}), plan: planKennung(baum) });

// ─── Container aus der Data.p4k lesen ────────────────────────────────────
// Der socpak eines Containers ist ein ZIP: darin <name>.xml (seine Kinder)
// und eine oder mehrere .soc (seine Entities). Zwischenablage ist
// hall-kinder/ im Quellordner. w: Werkzeug des Extraktors
// { SRC, STARBREAKER, sb, listFiles, readZip, socEntitiesXml }.
export function containerLeser(w) {
  const { SRC, STARBREAKER, sb, listFiles, readZip, socEntitiesXml } = w;
  const RAW = `${SRC}hall-kinder/`;
  mkdirSync(RAW, { recursive: true });
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ende = (name) => name.replace(/\\/g, '/').split('/').slice(-2);
  const kennung = (name) => ende(name)[1].replace(/\.socpak$/i, '');

  // der socpak eines Containers (ein ZIP), aus der Data.p4k geholt
  const pakVon = (name) => {
    const [dir, base] = ende(name);
    if (base === undefined) throw new Error(`${name}: der Container steht ohne Ordner da, gelesen wird nur Ordner/Name.socpak`);
    sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/]${esc(dir)}[\\\\/]${esc(base)}$`]);
    const pak = listFiles(RAW).find((f) => f.toLowerCase().endsWith(`/${dir}/${base}`.toLowerCase()));
    if (!pak) throw new Error(`${dir}/${base} steht nicht in der Data.p4k`);
    return readZip(readFileSync(pak));
  };
  // <name>.xml eines Containers aus seinem socpak
  const xmlVon = (name) => {
    const base = ende(name)[1];
    const zip = pakVon(name);
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
  // die Entities eines Containers: XML aus jeder .soc seines socpak
  const entitiesVon = (name) => {
    const zip = pakVon(name);
    const socs = [...zip.keys()].filter((k) => /\.soc$/i.test(k));
    const xml = socs.map((k, i) => {
      const t = `${RAW}${kennung(name)}.entities${i || ''}`;
      rmSync(`${t}.xml`, { force: true });   // sonst gälte nach einer gescheiterten Wandlung die alte Fassung
      return socEntitiesXml(zip.get(k)(), t);
    }).join('\n');
    if (!xml.trim()) throw new Error(`${ende(name)[1]}: keine lesbaren Entities (${socs.length} .soc)`);
    return xml;
  };
  return { RAW, esc, ende, kennung, pakVon, xmlVon, entitiesVon };
}

// ─── Lampen, die im Spiel in Ruhe dunkel sind (h.ruhe) ───────────────────
// Schreibt hall/<halle>.ruhe.json neben das Modell (scripts/lib/hall-ruhe.mjs
// sagt, was darin steht und warum): je Lichtgruppe der Halle und ihrer
// eingehängten Kinder die Lampen ohne Stärke im Ruhezustand. Der Build lässt
// sie weg. Gelesen werden die Entities jedes Containers und das Protokoll
// seines Exports; passt eine Lampe nicht zu ihrer Zeile, bricht der Schritt
// ab. baum: der Plan der Kinder (hallKinder), leer für eine Halle ohne.
// Die Datei wird nur geschrieben, wenn sich ihr Inhalt ändert: Der Build zählt
// ihr Alter zu seinen Eingaben.
export function hallRuhe(h, w, baum = []) {
  const { SRC } = w;
  const { RAW, entitiesVon } = containerLeser(w);
  const zeilen = (f) => {
    if (!existsSync(f)) throw new Error(`${f.slice(SRC.length)} fehlt (das Lichtprotokoll des Exports): mit --force neu exportieren`);
    return readFileSync(f, 'utf8').split('\n').filter((z) => z.trim());
  };
  const teile = ruheTeile(h.key, baum, (h.kinder?.nur ?? []).map((n) => n.kind)).map((t) => {
    const name = t.kind ? t.kind.name : h.socpak, licht = t.kind ? t.kind.licht : h.kinder ? `${RAW}${h.key}.lights-src.txt` : `${SRC}hall/${h.key}.lights-src.txt`;
    try { return { id: t.id, exemplare: t.exemplare, ...ruheDunkel(entitiesVon(name), zeilen(licht)) }; } catch (e) { throw new Error(`ruhe ${t.id}: ${e.message}`); }
  });
  const liste = ruheListe(teile);
  const datei = `${SRC}hall/${h.key}.ruhe.json`, neu = JSON.stringify(liste, null, 1) + '\n';
  mkdirSync(`${SRC}hall`, { recursive: true });
  const gleich = existsSync(datei) && readFileSync(datei, 'utf8') === neu;
  if (!gleich) writeFileSync(datei, neu);
  const geprueft = teile.flatMap((t) => Object.values(t.gruppen));
  const ohne = teile.flatMap((t) => t.ohneExport.map((g) => `${g.gruppe} ${g.lampen}`));
  console.log(`  ${gleich ? '=' : '+'} ${datei.slice(SRC.length)}  in Ruhe dunkel: ${liste.weg} Lichtknoten (${Object.entries(liste.gruppen).map(([g, r]) => `${g} ${r.dunkel.length} von ${r.lampen}${r.exemplare > 1 ? ` je Exemplar, ${r.exemplare} Exemplare` : ''}`).join('; ') || 'keiner'}); geprüft: ${geprueft.reduce((n, g) => n + g.lampen, 0)} Lampen in ${geprueft.length} exportierten Lichtgruppen stehen mit der Stärke ihres Zustands im Protokoll; ohne Export (hängen an einem Knochen): ${ohne.join(', ') || 'keine'}`);
  return liste;
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
// h.kinder.nur: Kinder, von denen nur steht, was die Halle zeigt (kindNur):
// [{ kind: Kennung des Containers, netz: [Dateiname der .cga ohne Endung] }].
// Eine Regel, deren Kind nicht eingehängt wird, bricht ab.
// h.kinder.anhang: Lichtgruppen, die an einem Knochen hängen und die der
// Export deshalb weglässt (anhangLampen, lampenEinhaengen):
// [{ kind: Kennung des Containers, gruppe: Name der Lichtgruppe, knochen,
//    anLeuchte: so viele Lampen müssen an einem Netzknoten sitzen }].
// Ein Eintrag ohne kind meint die Halle selbst (die Lampen der
// Schiffsplattform). Ihre Lampen kommen dazu, bevor ein Kind eingehängt ist:
// Die Probe an den Leuchten gilt dem eigenen Modell der Halle. Ihre Zeilen
// stehen hinter denen der Halle, vor denen der Kinder.
// Jedes Kind wird einmal exportiert (Stufe und Schalter wie die Halle, mit
// Lichtprotokoll) und an jede Stelle gehängt, die sein Elterncontainer nennt.
// Ergebnis: file (Halle mit Kindern), hall/<halle>.lights-src.txt (Zeilen der
// Halle und je Exemplar die des Kindes; der Build verbindet über den Namen),
// Bericht hall/<halle>.kinder.json. Mit h.ruhe dazu hall/<halle>.ruhe.json
// (hallRuhe), auch wenn das Eingehängte noch gilt.
// w: Werkzeug des Extraktors { SRC, FORCE, STARBREAKER, sb, listFiles, readZip, socEntitiesXml, lichtZeilen, schalter }.
export async function hallKinder(h, file, w) {
  const { SRC, FORCE, STARBREAKER, sb, listFiles, lichtZeilen, schalter } = w;
  const { RAW, esc, ende, kennung, xmlVon, entitiesVon } = containerLeser(w);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const folgt = (name) => h.kinder.folge.some((re) => re.test(name));
  const kurz = (f) => f.slice(SRC.length);

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
  // Lampen, die im Spiel in Ruhe dunkel sind: eigene Liste neben dem Modell, vom Eingehängten unabhängig
  if (h.ruhe) hallRuhe(h, w, baum);
  const bericht = `${SRC}hall/${h.key}.kinder.json`, gemerkt = `${SRC}hall/${h.key}.lights-src.txt`;
  // gilt das Eingehängte noch: dieselben Regeln und derselbe Plan (kinderKonfig), keine Quelle jünger
  const konfig = kinderKonfig(h.kinder, baum);
  const quellen = [h.raw, eigeneLichter, ...[...alle.values()].flatMap((c) => [c.glb, c.licht])];
  if (eingehaengtGilt({ force: FORCE, modell: file, licht: gemerkt, bericht, konfig, quellen })) {
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
    const nodes = nmcKnoten(dump);
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
    if (!b?.pos?.values?.length) throw new Error(`Lage ${l.cga}: Spur ${l.spur} trägt keine Lage für ${l.knochen}`);
    let ruhe, versatz;
    try { ({ ruhe, versatz } = spurVersatz(nodes, l.knochen, b.pos.values)); } catch (e) { throw new Error(`Lage ${l.cga}: ${e.message}`); }
    const dreht = b.rot?.values?.some((q) => q.some((v, i) => Math.abs(v - b.rot.values[0][i]) > 1e-4));
    if (dreht) throw new Error(`Lage ${l.cga}: Spur ${l.spur} dreht ${l.knochen}; gestellt wird nur ein Versatz`);
    const rund = (v) => Math.round(v * 10000) / 10000 + 0;
    return { ...l, caf: a[2], ruhe: ruhe.map(rund), versatz: versatz.map(rund), muster: new RegExp(`(^|[\\\\/])${esc(l.cga)}\\.cga$`, 'i'), knoten: 0 };
  });

  const nur = (h.kinder.nur ?? []).map((n) => ({ kind: n.kind, netz: n.netz, muster: n.netz.map((x) => new RegExp(`(^|[\\\\/])${esc(x)}\\.(cga|cgf)$`, 'i')), exemplare: 0 }));
  // Lampen angehängter Lichtgruppen, aus den Entities des genannten Kindes
  const anhang = (h.kinder.anhang ?? []).map((a) => {
    const eigen = a.kind === undefined, wer = eigen ? 'Halle' : a.kind;
    const c = eigen ? null : alle.get(a.kind);
    if (!eigen && !c) throw new Error(`anhang ${a.kind}: kein eingehängtes Kind heißt so, der Eintrag ist ohne Anlass`);
    let r;
    try { r = anhangLampen(entitiesVon(eigen ? h.socpak : c.name), a); } catch (e) { throw new Error(`anhang ${wer}: ${e.message}`); }
    // fährt eine Ruhelage denselben Knochen, müssten die Lampen mitfahren
    const faehrt = lagen.find((l) => l.cga.toLowerCase() === r.traeger.toLowerCase() && l.knochen === a.knochen);
    if (faehrt) throw new Error(`anhang ${wer}: die Ruhelage ${faehrt.cga} stellt den Knochen ${a.knochen}, an dem die Lichtgruppe ${a.gruppe} hängt; die Lampen blieben stehen`);
    return { ...a, ...r, exemplare: 0 };
  });
  const zeilen = (f) => readFileSync(f, 'utf8').split('\n').filter((z) => z.trim());
  const liste = [];
  const room = await io.read(h.raw);
  // Lichtgruppen an einem Knochen der Halle selbst: vor den Kindern, die Probe an den Leuchten gilt ihrem eigenen Modell
  const eigene = halleAnhang(room, anhang);
  const vorher = { knoten: room.getRoot().listNodes().length, netze: room.getRoot().listMeshes().length };
  const lichter = await kinderBaumEinhaengen(room, baum, { lese: (c) => io.read(c.glb), zeilen: (c) => zeilen(c.licht), lagen, nur, anhang, liste, melde: (m) => console.log(m) });
  for (const n of nur) if (!n.exemplare) throw new Error(`nur ${n.kind}: kein eingehängtes Kind heißt so, der Eintrag ist ohne Anlass`);
  for (const l of lagen) if (!l.knoten) throw new Error(`Lage ${l.cga}: kein eingehängtes Kind trägt dieses Netz, der Eintrag ist ohne Anlass`);
  for (const a of anhang) if (!a.exemplare) throw new Error(`anhang ${a.kind ?? 'Halle'}: ${a.kind === undefined ? 'die Lampen der Halle wurden nicht angehängt' : 'das Kind steht im Plan, wurde aber nicht eingehängt'}`);
  await room.transform(unpartition());
  const alleZeilen = [...zeilen(eigeneLichter), ...eigene, ...lichter];
  await eingehaengtSchreiben({
    berichtWeg: () => rmSync(bericht, { force: true }),
    licht: () => writeFileSync(gemerkt, alleZeilen.join('\n') + '\n'),
    modell: () => io.write(file, room),
    bericht: () => writeFileSync(bericht, JSON.stringify({ konfig, kinder: liste, ausgelassen, lagen: lagen.map(({ muster, ...l }) => l), anhang: anhang.map(({ lampen, ...a }) => ({ ...a, lampen: lampen.length })), lichtzeilen: { halle: alleZeilen.length - lichter.length, kinder: lichter.length } }, null, 1)),
  });
  console.log(`  Kinder eingehängt: ${room.getRoot().listNodes().length - vorher.knoten} Knoten und ${room.getRoot().listMeshes().length - vorher.netze} Netze dazu, ${lichter.length} Lichtzeilen zu ${alleZeilen.length - lichter.length} der Halle; gestellt: ${lagen.map((l) => `${l.cga} um ${l.versatz.join(',')} (${l.spur}, ${l.knoten} Knoten)`).join('; ') || 'nichts'}`);
  for (const a of anhang) console.log(`  Lichtgruppe ${a.gruppe} am Knochen ${a.knochen} von ${a.traeger}${a.kind === undefined ? ` (Halle, Träger bei ${a.traegerOrt.join('/')}, ${a.anNetz} an einer Leuchte)` : ''}: ${a.lampen.length} Lampe(n) je Exemplar angehängt (${a.exemplare} Exemplare), ${a.aus.length} ohne Stärke im Ruhezustand ausgelassen`);
  console.log(`  nicht eingehängt (kein Muster in kinder.folge): ${Object.entries(ausgelassen).map(([k, n]) => `${k} ${n}`).join(', ') || 'keiner'}`);
}
