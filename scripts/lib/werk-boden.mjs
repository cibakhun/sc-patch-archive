/* ============================================================
   werk-boden.mjs — Lage der Arbeitsplätze am Boden der Werkhalle
   (WERK_BODEN im Viewer): steht jedes Stück auf dem Boden der Garage oder
   auf einem anderen seiner Zone, steckt keines in einer Wand, unter dem
   Vorbau oder in einem anderen, und bleiben Grube und Einfahrt frei?

   WARUM ES DAS GIBT (23.11.2026, Runde 6 der Hangar-Politur): Die
   Werkhalle stand bis dahin leer um das Fahrzeug (Krisz 22.11.2026: „alles
   noch sehr alpha vibey“). Der Viewer stellt jedes Stück so hin, wie der
   Block es nennt, ohne Grundriss: Die Garage hat 780 000 Dreiecke, und die
   Buchten an den Seiten liegen unter einem Vorbau in 2,44 m Höhe, die
   Seitenstreifen 12 cm tiefer als das Mittelfeld. Dass trotzdem nichts
   schwebt, versinkt oder in der Wand steckt, prüft verify:hangar-hall [18]
   mit den Funktionen hier am Modell der Garage in dist/.

   Ein Stück ist ein Quader wie in hall-deko.mjs: Mitte der Grundfläche c
   [x, z] in Hallenmetern, Drehung a um y (Bogenmaß, wie makeRotationY),
   halbe Breite hx und halbe Tiefe hz, Unterkante y und Oberkante top.

   Reine Funktionen: kein Dateizugriff, kein Netz.
   ============================================================ */
import { ueberdeckung, pruefeLage, hallImQuader, bodenUnter } from './hall-deko.mjs';

/** so viel der Messpunkte unter einem Stück am Boden muss Boden auf seiner Unterkante tragen */
export const BODEN_ANTEIL = 0.8;
/** so weit darf der Boden unter einem Stück von seiner Unterkante abweichen, m */
export const BODEN_TOL = 0.03;

/**
 * Stücke aus dem Block WERK_BODEN.
 * @param {{ zonen: { name: string, glieder: [string, number, number, number, number][] }[] }} block
 * @param {(node: string) => { size: number[], mitte?: number[] } | null} masse  Maße [x, y, z] des Knotens im Satz
 *   und die Mitte seiner Grundfläche im eigenen Rahmen (mitte [x, z]; ohne: im Ursprung)
 * @returns {{ stuecke: object[], ohne: string[] }}
 */
export function werkBodenStuecke(block, masse) {
  const stuecke = [], ohne = [];
  for (const zn of block?.zonen ?? []) {
    (zn.glieder ?? []).forEach(([node, x, unten, z, r], i) => {
      const m = masse(node);
      if (!m) { ohne.push(node); return; }
      const a = (r * Math.PI) / 180, [mx, mz] = m.mitte ?? [0, 0];
      // Mitte der Grundfläche: Ursprung des Knotens auf (x, z), sein Rahmen gedreht wie makeRotationY(a)
      const c = [x + mx * Math.cos(a) + mz * Math.sin(a), z - mx * Math.sin(a) + mz * Math.cos(a)];
      stuecke.push({ name: `${zn.name}/${i + 1} ${node.replace(/^prop_/, '')}`, node, zone: zn.name, c, a, hx: m.size[0] / 2, hz: m.size[2] / 2, y: unten, top: unten + m.size[1], auf: false, fahrzeug: false });
    });
  }
  return { stuecke, ohne };
}

/**
 * Lage der Stücke gegen die Garage, untereinander und zu Grube und Einfahrt.
 * @param {object[]} stuecke  aus werkBodenStuecke
 * @param {object} o
 * @param {object} o.boden     hallenRaster nur mit Flächen der Garage, die nach oben zeigen (Boden, Stufen)
 * @param {object} o.alle      hallenRaster mit allen Dreiecken der Garage über dem Boden
 * @param {(node: string) => Float32Array|undefined} o.oben  tragende Flächen je Knoten (knotenFlaechen)
 * @param {{ c: number[], a: number, hx: number, hz: number }[]} o.frei  Flächen, die frei bleiben (Grube, Einfahrt), mit name
 * @param {{ x: number[], z: number[] }} o.raum  Innenraum der Garage in Hallenmetern
 * @returns {{ inWand: string[], schwebt: string[], ineinander: string[], imWeg: string[], draussen: string[], zahlen: object }}
 */
export function pruefeWerkBoden(stuecke, { boden, alle, oben, frei = [], raum }) {
  const inWand = [], imWeg = [], draussen = [];
  let amBoden = 0;
  for (const m of stuecke) {
    // am Boden: unter dem Stück trägt die Garage auf seiner Unterkante; sonst liegt es auf einem anderen
    const b = bodenUnter(m, m.y, boden, { tol: BODEN_TOL });
    m.auf = b.auf < BODEN_ANTEIL * b.von;
    if (!m.auf) amBoden++;
    const n = hallImQuader(m, m.y + BODEN_TOL, m.top, alle);
    if (n) inWand.push(`${m.name} (${n} Dreiecke der Garage im Stück)`);
    for (const f of frei) if (ueberdeckung(m, f) > 0.01) imWeg.push(`${m.name} in ${f.name}`);
    const ex = Math.abs(Math.cos(m.a)) * m.hx + Math.abs(Math.sin(m.a)) * m.hz, ez = Math.abs(Math.sin(m.a)) * m.hx + Math.abs(Math.cos(m.a)) * m.hz;
    if (raum && !(m.c[0] - ex >= raum.x[0] && m.c[0] + ex <= raum.x[1] && m.c[1] - ez >= raum.z[0] && m.c[1] + ez <= raum.z[1])) draussen.push(m.name);
  }
  // getragen und nicht ineinander, mit der Rechnung der Hallendeko (Zone für Zone); anders als
  // dort zählt jedes Paar, auch zwei niedrige (Reifen, Rollbrett, Eimer stehen fest am Boden)
  const L = pruefeLage(stuecke, { oben, feld: null, spur: { laenge: 0, rand: 0 }, flach: 0 });
  return { inWand, schwebt: L.schwebt, ineinander: L.ineinander, imWeg, draussen, zahlen: { stuecke: stuecke.length, amBoden, getragen: L.zahlen.getragen, gestapelt: L.zahlen.gestapelt, paare: L.zahlen.paare } };
}
