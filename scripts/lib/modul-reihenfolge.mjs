// Liest der Lauf eines Moduls eine Konstante der obersten Ebene, bevor er sie erklärt hat?
//
// Anlass (15.11.2026, PR #371): In scripts/extract-hangar-sources.mjs stand eine neue Konstante hinter der
// Hallenschleife, die auf oberster Ebene läuft und auf hallDecals wartet. Funktionen sind von Anfang an da,
// const und let erst an ihrer Zeile: Der erste Aufruf hätte den Auszug mit „Cannot access … before
// initialization“ abgebrochen. Der Auszug läuft nur am Rechner mit den Quelldateien, kein Tor fährt ihn;
// gefunden hat es das Review. Diese Prüfung liest den Syntaxbaum und fährt nichts.
//
// Die Regel, je Erklärung E (const, let, class) der obersten Ebene: Nichts, was VOR E läuft, darf E lesen,
// und es darf keine Funktion oder Klasse nennen, die E liest (auch nicht über weitere Funktionen). Was läuft:
//   - jede Anweisung an ihrer Stelle, der Anfangswert einer Erklärung vor der Erklärung selbst
//     (const X = f() liest über f zu früh, const a = b, b = 1 liest b zu früh), mit ihm die Standardwerte und
//     berechneten Schlüssel eines Musters (const { a = X } = o);
//   - von einer Klasse schon bei ihrer Erklärung: wovon sie erbt und die berechneten Namen ihrer Glieder (noch
//     bevor es ihren eigenen Namen gibt), dann die Anfangswerte statischer Felder und statische Blöcke.
//     Methoden, Konstruktor und die Anfangswerte der Felder einer Instanz laufen erst, wenn jemand die Klasse
//     benutzt: Sie zählen wie eine Funktion.
// Eine Funktion liest, was ihr Rumpf und die Standardwerte ihrer Parameter lesen. Eine Ausfuhrliste
// (export { X }) liest nichts.
// Gelesen wird nach Namen, ohne Geltungsbereiche: Liest eine Funktion einen eigenen gleichnamigen Namen (einen
// Parameter, eine Konstante in ihrem Rumpf), zählt das mit; die Stelle, die einen Namen erklärt, ist dagegen
// kein Griff. Eine Funktion, die eine frühere Anweisung nur weiterreicht, gilt als gerufen. Das ist zu streng
// statt zu milde, und ein Fund nennt Zeile und Weg, damit er sich nachprüfen lässt. Zwei Stellen sind bewusst
// milde, damit Übliches kein Fund wird:
//   - In ihrem EIGENEN Anfangswert zählt der Rumpf einer dort geschriebenen Funktion nicht
//     (const t = setTimeout(() => clearTimeout(t))). Ruft der Anfangswert sie doch sofort
//     (const xs = [1].map(() => xs)), sieht die Prüfung das nicht.
//   - In einem Muster darf ein Standardwert einen Namen desselben Musters lesen (const { a, b = a } = o). Steht
//     der gelesene Name erst dahinter (const { b = a, a } = o), sieht die Prüfung das nicht.
import ts from 'typescript';

/**
 * @param {string} text Quelltext eines Moduls
 * @returns {{ fehler: string[], erklaerungen: number, funde: { name: string, zeile: number, lauf: number, weg: string[] }[] }}
 *   funde: name wird in Zeile `zeile` erklärt, was in Zeile `lauf` läuft, läuft davor und erreicht ihn über `weg`.
 */
export function zuFruehGelesen(text) {
  const sf = ts.createSourceFile('modul.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const zeile = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const fehler = (sf.parseDiagnostics ?? []).map((d) => `Zeile ${sf.getLineAndCharacterOfPosition(d.start ?? 0).line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
  // Was eine Klasse bei ihrer Erklärung auswertet. vorher: bevor es ihren Namen gibt; drin: danach
  const klasseSofort = (k) => {
    const vorher = [], drin = [];
    for (const h of k.heritageClauses ?? []) for (const t of h.types) vorher.push(t.expression);
    for (const m of k.members) {
      if (m.name && ts.isComputedPropertyName(m.name)) vorher.push(m.name.expression);
      if (ts.isClassStaticBlockDeclaration(m)) drin.push(m.body);
      else if (ts.isPropertyDeclaration(m) && m.initializer && m.modifiers?.some((x) => x.kind === ts.SyntaxKind.StaticKeyword)) drin.push(m.initializer);
    }
    return { vorher, drin };
  };
  // Namen, die Knoten lesen: jeder Bezeichner, der kein Gliedname (a.NAME), kein Schlüssel ({ NAME: … }) und
  // nicht die Stelle ist, die einen Namen erklärt (Variable, Parameter, Funktion, Klasse).
  // tief: auch in den Rümpfen der Funktionen und Klassen darin; sonst nur, was beim Auswerten selbst läuft.
  const erklaert = (e, k) => (ts.isVariableDeclaration(e) || ts.isBindingElement(e) || ts.isParameter(e) || ts.isFunctionDeclaration(e)
    || ts.isFunctionExpression(e) || ts.isClassDeclaration(e) || ts.isClassExpression(e)) && e.name === k;
  const liest = (knoten, tief = true) => {
    const out = new Set();
    const geh = (k) => {
      if (ts.isIdentifier(k)) {
        const e = k.parent;
        const nurName = (ts.isPropertyAccessExpression(e) && e.name === k) || (ts.isPropertyAssignment(e) && e.name === k)
          || (ts.isMethodDeclaration(e) && e.name === k) || (ts.isPropertyDeclaration(e) && e.name === k)
          || (ts.isBindingElement(e) && e.propertyName === k);
        if (!nurName && !erklaert(e, k)) out.add(k.text);
      }
      if (!tief && ts.isClassLike(k)) { const s = klasseSofort(k); [...s.vorher, ...s.drin].forEach(geh); return; }
      if (!tief && ts.isFunctionLike(k)) return;
      ts.forEachChild(k, geh);
    };
    for (const k of knoten) geh(k);
    return out;
  };
  const bindet = (name, out) => {
    if (ts.isIdentifier(name)) out.push(name.text);
    else for (const el of name.elements) if (!ts.isOmittedExpression(el)) bindet(el.name, out);
    return out;
  };
  const istFunktion = (n) => !!n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));
  // Was es auf oberster Ebene gibt: Funktionen und Klassen (ihr Rumpf läuft erst, wenn jemand sie benutzt),
  // Erklärungen (ab ihrer Stelle da) und alles, was an seiner Stelle sofort läuft. Stelle: Anweisung i, darin j
  const funktionen = new Map(), erklaerungen = [], laeufe = [];
  const lauf = (i, j, knoten, z, dazu = []) => laeufe.push({ i, j, tief: new Set([...liest(knoten), ...dazu]), flach: new Set([...liest(knoten, false), ...dazu]), zeile: z });
  sf.statements.forEach((st, i) => {
    if (ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) return;
    if (ts.isFunctionDeclaration(st)) { if (st.name && st.body) funktionen.set(st.name.text, liest([st])); return; }
    if (ts.isClassDeclaration(st)) {
      const s = klasseSofort(st);
      if (s.vorher.length) lauf(i, 0, s.vorher, zeile(st));
      if (st.name) { erklaerungen.push({ i, j: 0, namen: [st.name.text], zeile: zeile(st) }); funktionen.set(st.name.text, liest([st])); }
      if (s.drin.length) lauf(i, 1, s.drin, zeile(st));
      return;
    }
    if (ts.isVariableStatement(st)) {
      const fest = (st.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) !== 0;
      st.declarationList.declarations.forEach((d, j) => {
        const namen = bindet(d.name, []);
        if (fest) erklaerungen.push({ i, j, namen, zeile: zeile(d) });
        if (istFunktion(d.initializer) && ts.isIdentifier(d.name)) { funktionen.set(d.name.text, liest([d.initializer])); return; }
        // ein Muster wertet seine Standardwerte und berechneten Schlüssel mit aus; die Namen desselben Musters
        // gelten dabei als schon da (siehe Kopf)
        const muster = ts.isIdentifier(d.name) ? [] : [...liest([d.name], false)].filter((n) => !namen.includes(n));
        if (d.initializer || muster.length) lauf(i, j, d.initializer ? [d.initializer] : [], zeile(d), muster);
      });
      return;
    }
    lauf(i, 0, [st], zeile(st));
  });
  const funde = [];
  for (const e of erklaerungen) {
    // Funktionen, die einen der Namen lesen, direkt oder über andere Funktionen; weg: wie sie ihn erreichen
    const weg = new Map(e.namen.map((n) => [n, [n]]));
    for (let neu = true; neu;) {
      neu = false;
      for (const [f, namen] of funktionen) {
        if (weg.has(f)) continue;
        const ueber = [...namen].find((n) => weg.has(n));
        if (ueber) { weg.set(f, [f, ...weg.get(ueber)]); neu = true; }
      }
    }
    for (const l of laeufe) {
      // davor: eine frühere Anweisung, oder in derselben nicht später (der Anfangswert läuft vor seiner Erklärung)
      if (l.i > e.i || (l.i === e.i && l.j > e.j)) continue;
      const trifft = [...(l.i === e.i ? l.flach : l.tief)].find((n) => weg.has(n));
      if (trifft) funde.push({ name: weg.get(trifft).at(-1), zeile: e.zeile, lauf: l.zeile, weg: weg.get(trifft) });
    }
  }
  return { fehler, erklaerungen: erklaerungen.length, funde };
}
