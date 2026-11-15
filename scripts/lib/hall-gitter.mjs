// Lichtgitter einer Halle zurücklesen (verify:hangar-hallen [2] und [3]).
//
// Der Viewer rechnet das Licht der Spiellampen, die nicht echt brennen, und das Grundlicht der Halle auf ein
// Gitter (hallGitter in assets/hangar-viewer.js); die Bühne lädt es als zwei 3D-Texturen, der Hallenshader liest
// es als Streulicht. Ob das Grundlicht dort ankommt, las das Tor zuerst am Quelltext ab: hallGrund kommt in der
// Gitterfunktion vor, und loadHallLights reicht ihr die Halle durch. CodeRabbit am 15.11.2026 zu PR #380: Wer
// die Additionen ins Gitter streicht, lässt beide Ausdrücke stehen, und das Tor bleibt grün, während keine
// Fläche mehr Grundlicht bekommt. Seither rechnet das Tor das Gitter mit der Funktion des Viewers selbst und
// liest hier zurück, was in jeder Zelle steht.
//
// Aufbau eines Gitters, so wie hallGitter es liefert: res = [nx, ny, nz] Zellen, min = Ecke im Modellraum,
// a und b = je vier Halbfloat-Werte je Zelle (a: +x −x +y −y; b: +z −z, Rot und Blau der Lichtfarbe je
// Helligkeit), Zelle (i, j, k) an der Stelle (k·ny + j)·nx + i, j zählt die Schichten von unten.
import ts from 'typescript';

export const RICHTUNGEN = ['+x', '-x', '+y', '-y', '+z', '-z'];
const NAMEN = [...RICHTUNGEN, 'Lichtfarbe Rot', 'Lichtfarbe Blau'];
// Ein Halbfloat trägt zehn Stellen hinter der führenden Eins, und three.js schneidet beim Packen ab, statt zu
// runden: Der gelesene Wert liegt bis zu 2^-10 seines Betrags (0,98 ‰) unter dem gerechneten. Zwei solche
// Stufen Spiel; was das Grundlicht verfehlt oder verliert, liegt um Größenordnungen darüber.
export const TOL = 2e-3;

/**
 * Entpackt ein Gitter zu acht Zahlen je Zelle (sechs Richtungen, Rot und Blau der Lichtfarbe).
 * @param {any} g was hallGitter liefert
 * @param {(h: number) => number} halb Halbfloat zu Zahl (DataUtils.fromHalfFloat aus three)
 * @returns {{ w: Float32Array, res: number[], min: number[], N: number, used: number } | null} null: kein Gitter in dieser Form
 */
export function gitterWerte(g, halb) {
  const res = g?.res, ganz = Array.isArray(res) && res.length === 3 && res.every((n) => Number.isInteger(n) && n > 0);
  const N = ganz ? res[0] * res[1] * res[2] : 0;
  if (!N || !(g.a instanceof Uint16Array) || !(g.b instanceof Uint16Array) || g.a.length !== N * 4 || g.b.length !== N * 4) return null;
  if (!Array.isArray(g.min) || g.min.length !== 3 || !g.min.every(Number.isFinite)) return null;
  const w = new Float32Array(N * 8);
  for (let n = 0; n < N; n++) for (let s = 0; s < 4; s++) { w[n * 8 + s] = halb(g.a[n * 4 + s]); w[n * 8 + 4 + s] = halb(g.b[n * 4 + s]); }
  return { w, res: [...res], min: [...g.min], N, used: g.used };
}

const nah = (ist, soll) => Math.abs(ist - soll) <= TOL * Math.max(Math.abs(soll), 1e-3);

/**
 * Ein Gitter ohne Lampen gegen das Grundlicht, das die Halle in jeder Höhe haben soll: jede Zelle, alle sechs
 * Richtungen und die Lichtfarbe.
 * @param {{ w: Float32Array, res: number[], min: number[], N: number }} G entpacktes Gitter (gitterWerte)
 * @param {{ boden: number, hoehe: number, step: number, grund: (hoch: number) => ({ seite: number, oben: number, unten: number } | null), farbe: number[] }} o
 *   boden: Höhe des Bodens im Modellraum, hoehe: Höhe des Raums, step: Gitterweite, grund: das Grundlicht in
 *   der Höhe hoch (0 = Boden, 1 = Decke; hallGrund des Viewers), farbe: seine Farbe (linear, VOL_GRUND.farbe)
 * @returns {{ zellen: number, schichten: number, von: number, bis: number, reicht: boolean, ohneSoll: number,
 *   abweichungen: { was: string, zahl: number, schicht: number, ueberBoden: number, ist: number, soll: number }[] }}
 *   von, bis: Höhe der untersten und der obersten Schicht über dem Boden (m); reicht: Das Gitter deckt den Raum
 *   vom Boden bis zur Decke; ohneSoll: Schichten, für die grund nichts nennt; abweichungen: je Richtung bzw.
 *   Farbanteil, wie viele Werte neben dem Soll liegen, und der erste davon.
 */
export function grundImGitter(G, { boden, hoehe, step, grund, farbe }) {
  const [nx, ny, nz] = G.res, y0 = G.min[1];
  const hell = 0.2126 * farbe[0] + 0.7152 * farbe[1] + 0.0722 * farbe[2];
  const je = NAMEN.map((was) => ({ was, zahl: 0, schicht: -1, ueberBoden: 0, ist: 0, soll: 0 }));
  let ohneSoll = 0;
  for (let j = 0; j < ny; j++) {
    const ueber = y0 + j * step - boden, g = grund(ueber / hoehe);
    if (!g) { ohneSoll++; continue; }
    const soll = [g.seite, g.seite, g.oben, g.unten, g.seite, g.seite, farbe[0] / hell, farbe[2] / hell];
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const n = ((k * ny + j) * nx + i) * 8;
      for (let s = 0; s < 8; s++) {
        if (nah(G.w[n + s], soll[s])) continue;
        if (!je[s].zahl) Object.assign(je[s], { schicht: j, ueberBoden: ueber, ist: G.w[n + s], soll: soll[s] });
        je[s].zahl++;
      }
    }
  }
  const von = y0 - boden, bis = y0 + (ny - 1) * step - boden;
  return { zellen: G.N, schichten: ny, von, bis, reicht: ny >= 3 && von <= 0 && bis >= hoehe, ohneSoll, abweichungen: je.filter((e) => e.zahl) };
}

/**
 * Licht in einem Gitter: wie viele der Richtungswerte über null liegen, und der höchste.
 * @param {{ w: Float32Array, N: number }} G
 * @returns {{ ueberNull: number, hoechster: number }}
 */
export function gitterLicht(G) {
  let ueberNull = 0, hoechster = 0;
  for (let n = 0; n < G.N; n++) for (let s = 0; s < 6; s++) {
    const v = G.w[n * 8 + s];
    if (!(v === 0)) ueberNull++;
    if (v > hoechster) hoechster = v;
  }
  return { ueberNull, hoechster };
}

/**
 * Lampenlicht und Grundlicht im selben Gitter: In jeder Zelle und Richtung ist das Gitter mit beidem die Summe
 * aus dem Gitter nur mit den Lampen und dem nur mit dem Grundlicht. Ersetzt eines das andere (= statt +=, das
 * größere von beiden), fehlt die Summe dort, wo beide Licht haben.
 * @param {{ w: Float32Array, res: number[], N: number }} mit Lampen und Grundlicht
 * @param {{ w: Float32Array, res: number[], N: number }} nur dieselben Lampen ohne Grundlicht
 * @param {{ w: Float32Array, res: number[], N: number }} leer nur das Grundlicht
 * @returns {{ werte: number, abweichend: number, erstes: { was: string, mit: number, nur: number, leer: number } | null, staerker: number } | null}
 *   null: Die drei Gitter sind nicht gleich groß. staerker: Werte, an denen die Lampen allein mehr Licht haben
 *   als das Grundlicht (nur dort fiele auf, wenn das Grundlicht sie ersetzte).
 */
export function gitterDazu(mit, nur, leer) {
  if (mit.N !== nur.N || mit.N !== leer.N || mit.res.join() !== nur.res.join() || mit.res.join() !== leer.res.join()) return null;
  let abweichend = 0, staerker = 0, erstes = null;
  for (let n = 0; n < mit.N; n++) for (let s = 0; s < 6; s++) {
    const m = mit.w[n * 8 + s], l = nur.w[n * 8 + s], g = leer.w[n * 8 + s];
    if (l > g) staerker++;
    if (Math.abs(m - l - g) <= TOL * (m + l + g) + 1e-4) continue;
    if (!abweichend) erstes = { was: RICHTUNGEN[s], mit: m, nur: l, leer: g };
    abweichend++;
  }
  return { werte: mit.N * 6, abweichend, erstes, staerker };
}

/**
 * Die Naht, die am Quelltext bleibt: Die Bühne rechnet ihr Gitter mit derselben Funktion, die das Tor
 * nachrechnet, reicht ihr ihre Halle und lädt, was sie liefert. Gelesen wird der Syntaxbaum (wie
 * scripts/lib/buehnen-quellen.mjs): Ein Aufruf in einem Kommentar oder einer Zeichenkette ist keiner, einer
 * über mehrere Zeilen bleibt einer.
 * @param {string} text Quelltext des Viewers
 * @param {{ funktion?: string, rechner?: string }} [o] die Funktion der Bühne, die das Gitter lädt, und die Gitterfunktion
 * @returns {{ fehler: string[], aufrufe: { zeile: number, knoten: string, halle: boolean, genutzt: boolean }[] }}
 *   aufrufe: jeder Aufruf der Gitterfunktion im Rumpf.
 *   halle: Sein zweites Argument ist der erste Parameter der Funktion, also die Halle selbst und nicht ein Teil
 *   oder Nachbau von ihr. Ein gleichnamiger Parameter oder eine gleichnamige Erklärung zwischen Aufruf und
 *   Funktion (ein innerer Pfeil mit demselben Namen, const im selben Block) ist ein anderer Wert: dann nicht.
 *   genutzt: Sein Ergebnis wird gewartet, bekommt einen Namen (const x = await …), und beide Felder des Gitters
 *   (x.a und x.b) werden in der Funktion gelesen; gerechnet und verworfen zählt nicht.
 */
export function gitterAufrufe(text, { funktion = 'loadHallLights', rechner = 'hallGitter' } = {}) {
  const sf = ts.createSourceFile('viewer.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const zeileVon = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const fehler = (sf.parseDiagnostics ?? []).map((d) => `Zeile ${zeileVon(d.start ?? 0)}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
  /** @type {ts.FunctionDeclaration | null} */
  let fn = null;
  const such = (n) => {
    if (fn) return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === funktion && n.body) fn = n;
    else ts.forEachChild(n, such);
  };
  such(sf);
  if (!fn?.body) return { fehler: [...fehler, `die Funktion ${funktion} steht nicht im Text`], aufrufe: [] };
  const rumpf = fn.body, p0 = fn.parameters[0]?.name, halle = p0 && ts.isIdentifier(p0) ? p0.text : null;
  if (!halle) return { fehler: [...fehler, `${funktion} nimmt keine Halle als ersten Parameter`], aufrufe: [] };
  // Namen, die ein Muster bindet (h, { h }, [h], { x: h }, ...h)
  const namen = (b) => (ts.isIdentifier(b) ? [b.text] : ts.isObjectBindingPattern(b) || ts.isArrayBindingPattern(b) ? b.elements.flatMap((e) => (ts.isBindingElement(e) ? namen(e.name) : [])) : []);
  const erklaert = (liste, name) => !!liste && liste.declarations.some((d) => namen(d.name).includes(name));
  // bindet dieser Knoten den Namen neu, für alles, was in ihm steht?
  const bindet = (n, name) => {
    if (ts.isFunctionLike(n)) return n.parameters.some((p) => namen(p.name).includes(name)) || (ts.isFunctionExpression(n) && n.name?.text === name);
    if (ts.isBlock(n) || ts.isCaseClause(n) || ts.isDefaultClause(n)) return n.statements.some((st) => (ts.isVariableStatement(st) && erklaert(st.declarationList, name)) || ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name?.text === name));
    if (ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n)) return !!n.initializer && ts.isVariableDeclarationList(n.initializer) && erklaert(n.initializer, name);
    if (ts.isCatchClause(n)) return !!n.variableDeclaration && namen(n.variableDeclaration.name).includes(name);
    return false;
  };
  const verdeckt = (n, name) => {
    for (let e = n.parent; e; e = e.parent) {
      if (bindet(e, name)) return true;
      if (e === rumpf) return false;
    }
    return false;
  };
  // x.a und x.b irgendwo im Rumpf gelesen, mit demselben x (nicht neu gebunden)
  const liest = (erkl, name, feld) => {
    let ja = false;
    const geh = (n) => {
      if (ja) return;
      if (ts.isPropertyAccessExpression(n) && n.name.text === feld && ts.isIdentifier(n.expression) && n.expression.text === name) {
        // dieselbe Bindung: Vom Lesen aus gesehen bindet zuerst der Block, in dem die Erklärung steht
        const block = erkl.parent?.parent?.parent ?? null;
        for (let e = n.parent; e; e = e.parent) { if (bindet(e, name)) { ja = e === block; break; } if (e === rumpf) break; }
        if (ja) return;
      }
      ts.forEachChild(n, geh);
    };
    geh(rumpf);
    return ja;
  };
  const aufrufe = [];
  const geh = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === rechner) {
      const a = n.arguments[1], warten = n.parent, erkl = warten?.parent;
      const benannt = !!warten && ts.isAwaitExpression(warten) && !!erkl && ts.isVariableDeclaration(erkl) && erkl.initializer === warten && ts.isIdentifier(erkl.name);
      aufrufe.push({
        zeile: zeileVon(n.getStart(sf)), knoten: n.getText(sf),
        halle: !!a && ts.isIdentifier(a) && a.text === halle && !verdeckt(n, halle),
        genutzt: benannt && ['a', 'b'].every((feld) => liest(erkl, erkl.name.text, feld)),
      });
    }
    ts.forEachChild(n, geh);
  };
  geh(rumpf);
  return { fehler, aufrufe };
}
