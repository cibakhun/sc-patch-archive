// Lampen einer Halle, die im Spiel in Ruhe dunkel sind.
//
// Eine Lampe des Spiels trägt mehrere Zustände: defaultState (Ruhe),
// auxiliaryState, emergencyState. Hat der Ruhezustand keine Stärke, ist die
// Lampe aus, bis das Spiel sie schaltet: die Warnleuchten an den
// Frachtaufzügen, die Strahler in der Grube unter der Plattform des
// Schiffsaufzugs, das Notlicht. Der Export schreibt trotzdem jede Lampe einer
// gewöhnlichen Lichtgruppe als Lichtknoten „<Gruppe>-NNN“ (NNN = Stelle der
// Lampe in der Gruppe) und nimmt für eine Lampe ohne Stärke im Ruhezustand den
// nächsten Zustand mit Stärke, erst auxiliary, dann emergency. So brannten in
// der Large-Halle (util-lrgtop) 86 Lampen, die das Spiel in Ruhe dunkel zeigt
// (gemessen 15.11.2026): 76 der 677 der Hallengruppe (50 Strahler in der
// Grube, 6 Drehlichter am Boden, 10 Notlichter, 6 Hololichter, 4 weitere) und
// je Frachtaufzug 5 von 60 (zwei Drehlichter, zwei Blinker, das rote Licht der
// Kabine).
//
// Die Regel steht in drei Schritten, jeder ohne die Spieldateien prüfbar
// (tests/e2e/hall-ruhe.test.js):
//   ruheDunkel  liest je Container die Lichtgruppen aus seinen Entities und
//               hält sie gegen das Protokoll seines Exports. Jede Lampe jeder
//               exportierten Gruppe muss dort mit genau der Stärke stehen, die
//               der Export nach der Regel oben nimmt; sonst ist die Stelle in
//               der Gruppe nicht die Nummer des Lichtknotens, und der Schritt
//               bricht ab, statt die falschen Lampen zu nennen. Ganz fehlen
//               darf dem Protokoll nur eine Gruppe, die an einem Knochen hängt.
//   ruheTeile   nennt die Container einer Halle, die Lampen beitragen, und wie
//               oft jeder in ihr steht.
//   ruheListe   legt sie zusammen (<halle>.ruhe.json, schreibt der Extraktor
//               neben das Modell: hallRuhe in hall-kinder.mjs).
//   ruheRegel   liest die Liste für den Build, ruheZaehler lässt dort die
//               Lampen weg (hallLights) und hält fest, dass jeder genannte
//               Lichtknoten genau so oft im Modell steht, wie die Liste sagt.
// Was davon in der ausgelieferten Lampendatei ankommt, prüft
// verify:hangar-hallen [3].
// Gruppen, die an einem Knochen hängen, lässt der Export ganz weg; für sie
// gilt dieselbe Regel in anhangLampen (hall-kinder.mjs).
import { lichtZeile } from './hall-lights.mjs';

/** Name des Lichtknotens der Lampe an Stelle i ihrer Gruppe, wie der Export ihn schreibt. @param {string} gruppe @param {number} i */
export const lampenName = (gruppe, i) => `${gruppe}-${String(i).padStart(3, '0')}`;

const attr = (s, k) => (s.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
// zwei Stärken gleich: die Entities nennen 0.30000001, das Protokoll 0.3
const gleich = (a, b) => Math.abs(a - b) <= 1e-4 * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Die Lichtgruppen eines Containers und ihre Lampen, die in Ruhe dunkel sind.
 * @param {string} xml Entities des Containers (XML aus seiner .soc)
 * @param {string[]} zeilen Lichtzeilen aus dem Protokoll seines Exports
 * @returns {{ gruppen: Record<string, { lampen: number, dunkel: number[], auxiliary: number, emergency: number }>, ohneExport: { gruppe: string, lampen: number }[] }}
 *   gruppen: je exportierter Gruppe die Zahl ihrer Lampen, die Stellen der
 *   dunklen und wie viele davon der Export mit welchem Zustand schrieb;
 *   ohneExport: Gruppen an einem Knochen, deren Namen keine Zeile des
 *   Protokolls trägt (eine gewöhnliche Gruppe ohne Zeile bricht ab).
 */
export function ruheDunkel(xml, zeilen) {
  const proto = new Map();
  for (const z of zeilen) {
    const l = lichtZeile(z);
    if (!l) continue;
    if (!proto.has(l.name)) proto.set(l.name, []);
    proto.get(l.name).push(l.intensity);
  }
  const gruppen = {}, ohneExport = [];
  for (const m of xml.matchAll(/<Entity\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Entity>)/g)) {
    const lampen = [...(m[2] ?? '').matchAll(/<Light\b([^>]*)>([\s\S]*?)<\/Light>/g)];
    if (!lampen.length) continue;
    const gruppe = attr(m[1], 'Name');
    if (!gruppe) throw new Error(`eine Lichtgruppe mit ${lampen.length} Lampen trägt keinen Namen`);
    if (Object.hasOwn(gruppen, gruppe) || ohneExport.some((g) => g.gruppe === gruppe)) throw new Error(`Lichtgruppe ${gruppe} steht zweimal im Container, ihre Lichtknoten wären nicht zu unterscheiden`);
    const erwartet = new Set(lampen.map((_, i) => lampenName(gruppe, i)));
    const imExport = [...erwartet].filter((n) => proto.has(n)).length;
    // Zeilen, die den Namen der Gruppe mit einer Nummer tragen und keinen ihrer
    // Lichtknoten nennen: eine Nummer über die Gruppe hinaus (lg_a-005 bei fünf
    // Lampen) oder anders geschrieben (lg_a-0 statt lg_a-000). Der Rest muss
    // rein aus Ziffern bestehen: lg_a-001-000 gehört der Gruppe lg_a-001.
    const fremd = [...proto.keys()].filter((n) => n.startsWith(`${gruppe}-`) && /^\d+$/.test(n.slice(gruppe.length + 1)) && !erwartet.has(n));
    // Weggelassen hat der Export eine Gruppe nur, wenn keine Zeile ihren Namen
    // trägt UND sie an einem Knochen hängt (nur das ist nachgemessen). Steht der
    // Name im Protokoll nur mit Nummern, die sie nicht hat, zählt oder schreibt
    // der Export anders als die Stelle in der Gruppe: Das fällt unten durch.
    // Fehlt eine gewöhnliche Gruppe dem Protokoll ganz, ist es unvollständig,
    // oder der Export nennt sie anders; ihre dunklen Lampen blieben ungenannt.
    if (!imExport && !fremd.length) {
      const haengt = [attr(m[1], 'EntityClass'), attr(m[1], 'AttachmentType')];
      if (haengt[0] !== 'LightGroupObjectAttach' || haengt[1] !== 'CharacterBone') throw new Error(`Lichtgruppe ${gruppe}: ${lampen.length} Lampen in den Entities, keine Zeile im Protokoll des Exports, und sie hängt an keinem Knochen (${haengt.map((x) => x ?? 'ohne Angabe').join(' / ')}); weggelassen wird nur eine LightGroupObjectAttach an einem CharacterBone. Das Protokoll ist unvollständig, oder der Export nennt die Gruppe anders`);
      ohneExport.push({ gruppe, lampen: lampen.length });
      continue;
    }
    if (imExport !== lampen.length || fremd.length) throw new Error(`Lichtgruppe ${gruppe}: ${lampen.length} Lampen in den Entities, ${imExport} davon im Protokoll des Exports${fremd.length ? `, dazu ${fremd.length} Zeile(n) mit ihrem Namen und einer Nummer, die keiner ihrer Lichtknoten trägt (${fremd.slice(0, 3).join(', ')})` : ''}; die Stelle in der Gruppe ist dann nicht die Nummer des Lichtknotens`);
    const dunkel = [];
    let auxiliary = 0, emergency = 0;
    lampen.forEach((l, i) => {
      const name = lampenName(gruppe, i), wo = `${name} (${attr(l[1], 'Name') ?? 'ohne Namen'})`;
      const staerke = (k) => {
        const s = l[2].match(new RegExp(`<${k}\\b([^>]*?)\\/?>`));
        if (!s) throw new Error(`${wo}: ohne ${k}`);
        const v = Number(attr(s[1], 'intensity'));
        if (attr(s[1], 'intensity') === undefined || !Number.isFinite(v) || v < 0) throw new Error(`${wo}: ${k} intensity="${attr(s[1], 'intensity') ?? ''}" ist keine Stärke`);
        return v;
      };
      const d = staerke('defaultState'), a = staerke('auxiliaryState'), e = staerke('emergencyState');
      const steht = proto.get(name);
      if (steht.length !== 1) throw new Error(`${wo}: ${steht.length} Zeilen im Protokoll des Exports, erwartet ist genau eine`);
      const nimmt = d > 0 ? d : a > 0 ? a : e;
      if (!gleich(steht[0], nimmt)) throw new Error(`${wo}: das Protokoll des Exports nennt die Stärke ${steht[0]}, nach den Entities wäre es ${nimmt} (Ruhe ${d}, auxiliary ${a}, emergency ${e}); die Stelle in der Gruppe ist nicht die Nummer des Lichtknotens, oder der Export wählt den Zustand anders als nachgemessen`);
      if (d > 0) return;
      dunkel.push(i);
      if (a > 0) auxiliary++; else if (e > 0) emergency++;
    });
    gruppen[gruppe] = { lampen: lampen.length, dunkel, auxiliary, emergency };
  }
  return { gruppen, ohneExport };
}

/**
 * Welche Container einer Halle Lampen beitragen und wie oft: die Halle selbst
 * und jedes eingehängte Kind. Ein Kind, von dem nur einzelne Netze stehen
 * (kinder.nur), trägt keine Lichter bei; seine eigenen Kinder schon.
 * @param {string} halle Kennung der Halle
 * @param {{ id: string, stellen: unknown[], kinder?: any[] }[]} [baum] Plan der Kinder, wie hallKinder ihn liest
 * @param {string[]} [nur] Kennungen der Kinder mit einer Regel in kinder.nur
 * @returns {{ id: string, exemplare: number, kind: any }[]} kind: der Eintrag des Plans, null für die Halle
 */
export function ruheTeile(halle, baum = [], nur = []) {
  const teile = new Map([[halle, { id: halle, exemplare: 1, kind: null }]]);
  const geh = (liste, mal) => {
    for (const c of liste) {
      const exemplare = mal * c.stellen.length;
      if (!nur.includes(c.id)) {
        if (c.id === halle) throw new Error(`der Kind-Container ${c.id} heißt wie die Halle`);
        if (!teile.has(c.id)) teile.set(c.id, { id: c.id, exemplare: 0, kind: c });
        teile.get(c.id).exemplare += exemplare;
      }
      geh(c.kinder ?? [], exemplare);
    }
  };
  geh(baum, 1);
  return [...teile.values()];
}

/**
 * Die Liste einer Halle aus ihren Containern (<halle>.ruhe.json).
 * @param {{ id: string, exemplare: number, gruppen: Record<string, { lampen: number, dunkel: number[] }> }[]} teile
 *   je Container: Kennung, wie oft er in der Halle steht, seine Gruppen (ruheDunkel)
 * @returns {{ v: 1, weg: number, gruppen: Record<string, { container: string, exemplare: number, lampen: number, dunkel: number[] }> }}
 *   weg: so viele Lichtknoten der Halle sind in Ruhe dunkel (mit allen Exemplaren)
 */
export function ruheListe(teile) {
  const gruppen = {}, wo = new Map();
  for (const t of teile) {
    if (!(Number.isInteger(t.exemplare) && t.exemplare > 0)) throw new Error(`${t.id}: ${t.exemplare} Exemplare ist keine Zahl ab 1`);
    for (const [g, r] of Object.entries(t.gruppen)) {
      // Der Build verbindet über den Namen des Lichtknotens: Dieselbe Gruppe in zwei Containern träfe beide
      if (wo.has(g)) throw new Error(`Lichtgruppe ${g} steht in ${wo.get(g)} und in ${t.id}; der Name ihrer Lichtknoten sagt nicht, welche gemeint ist`);
      wo.set(g, t.id);
      if (r.dunkel.length) gruppen[g] = { container: t.id, exemplare: t.exemplare, lampen: r.lampen, dunkel: [...r.dunkel] };
    }
  }
  return { v: 1, weg: Object.values(gruppen).reduce((n, g) => n + g.dunkel.length * g.exemplare, 0), gruppen };
}

/**
 * Liest die Liste einer Halle und prüft ihre Form.
 * @param {unknown} liste Inhalt von <halle>.ruhe.json
 * @returns {{ weg: number, namen: Map<string, number>, gruppen: Record<string, number[]> }}
 *   namen: Name des Lichtknotens -> so oft steht er in der Halle;
 *   gruppen: je Gruppe die Stellen der dunklen Lampen (so trägt die Lampendatei sie)
 */
export function ruheRegel(liste) {
  const L = /** @type {any} */ (liste);
  if (!L || L.v !== 1 || !L.gruppen || typeof L.gruppen !== 'object' || Array.isArray(L.gruppen)) throw new Error('die Liste der in Ruhe dunklen Lampen hat nicht die Form { v: 1, weg, gruppen }');
  const namen = new Map(), gruppen = {};
  for (const [g, r] of Object.entries(L.gruppen)) {
    const heil = r && Number.isInteger(r.exemplare) && r.exemplare > 0 && Number.isInteger(r.lampen) && Array.isArray(r.dunkel) && r.dunkel.length > 0
      && r.dunkel.every((i, k) => Number.isInteger(i) && i >= 0 && i < r.lampen && (k === 0 || i > r.dunkel[k - 1]));
    if (!heil) throw new Error(`Lichtgruppe ${g}: der Eintrag in der Liste der in Ruhe dunklen Lampen ist nicht heil (exemplare ab 1, lampen, dunkel als steigende Stellen unter lampen, nicht leer)`);
    for (const i of r.dunkel) namen.set(lampenName(g, i), r.exemplare);
    gruppen[g] = [...r.dunkel];
  }
  const weg = [...namen.values()].reduce((n, x) => n + x, 0);
  if (L.weg !== weg) throw new Error(`die Liste der in Ruhe dunklen Lampen nennt ${L.weg} Lichtknoten, ihre Gruppen ergeben ${weg}`);
  return { weg, namen, gruppen };
}

/**
 * Zählt beim Bau mit, welche Lichtknoten des Modells wegbleiben. Jeder in der
 * Liste genannte Name muss genau so oft im Modell stehen, wie sie sagt: Trifft
 * einer seltener (die Liste stammt aus einem anderen Export) oder öfter (ein
 * fremder Lichtknoten heißt gleich), blieben die falschen Lampen weg.
 * @param {{ namen: Map<string, number> }} regel aus ruheRegel
 * @returns {{ dunkel: (name: string) => boolean, pruefe: (was: string) => void }}
 *   dunkel: bleibt dieser Lichtknoten weg (zählt den Treffer);
 *   pruefe: nach dem letzten Knoten, bricht ab, wenn ein Name nicht aufgeht
 */
export function ruheZaehler(regel) {
  const treffer = new Map();
  return {
    dunkel: (name) => {
      if (!regel.namen.has(name)) return false;
      treffer.set(name, (treffer.get(name) ?? 0) + 1);
      return true;
    },
    pruefe: (was) => {
      const daneben = [...regel.namen].filter(([n, soll]) => (treffer.get(n) ?? 0) !== soll);
      if (daneben.length) throw new Error(`${was} passt nicht zum Modell: ${daneben.length} von ${regel.namen.size} genannten Lichtknoten stehen nicht so oft darin wie in der Liste (${daneben.slice(0, 4).map(([n, soll]) => `${n} ${treffer.get(n) ?? 0} statt ${soll}`).join(', ')}); Halle mit dem Extraktor neu holen`);
    },
  };
}
