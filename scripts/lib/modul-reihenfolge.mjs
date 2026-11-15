// Liest der Lauf eines Moduls eine Konstante der obersten Ebene, bevor er sie erklärt hat?
//
// Anlass (15.11.2026, PR #371): In scripts/extract-hangar-sources.mjs stand eine neue Konstante hinter der
// Hallenschleife, die auf oberster Ebene läuft und auf hallDecals wartet. Funktionen sind von Anfang an da,
// const und let erst an ihrer Zeile: Der erste Aufruf hätte den Auszug mit „Cannot access … before
// initialization“ abgebrochen. Der Auszug läuft nur am Rechner mit den Quelldateien, kein Tor fährt ihn;
// gefunden hat es das Review. Diese Prüfung liest den Syntaxbaum und fährt nichts.
//
// Die Regel, je Erklärung E (const, let, class) der obersten Ebene: Keine Anweisung, die VOR E läuft, darf
// E lesen, und sie darf keine Funktion nennen, die E liest (auch nicht über weitere Funktionen). Gelesen
// wird nach Namen, ohne Geltungsbereiche: Ein gleichnamiger Parameter in einer Funktion zählt mit. Das ist
// zu streng statt zu milde, und ein Fund nennt Zeile und Weg, damit er sich nachprüfen lässt.
import ts from 'typescript';

/**
 * @param {string} text Quelltext eines Moduls
 * @returns {{ fehler: string[], erklaerungen: number, funde: { name: string, zeile: number, lauf: number, weg: string[] }[] }}
 *   funde: name wird in Zeile `zeile` erklärt, die Anweisung in Zeile `lauf` läuft davor und erreicht ihn über `weg`.
 */
export function zuFruehGelesen(text) {
  const sf = ts.createSourceFile('modul.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const zeile = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const fehler = (sf.parseDiagnostics ?? []).map((d) => `Zeile ${sf.getLineAndCharacterOfPosition(d.start ?? 0).line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
  // Namen, die ein Knoten liest: jeder Bezeichner, der kein Gliedname (a.NAME) und kein Schlüssel ({ NAME: … }) ist
  const liest = (n) => {
    const out = new Set();
    const geh = (k) => {
      if (ts.isIdentifier(k)) {
        const e = k.parent;
        const nurName = (ts.isPropertyAccessExpression(e) && e.name === k) || (ts.isPropertyAssignment(e) && e.name === k)
          || (ts.isMethodDeclaration(e) && e.name === k) || (ts.isBindingElement(e) && e.propertyName === k);
        if (!nurName) out.add(k.text);
      }
      ts.forEachChild(k, geh);
    };
    geh(n);
    return out;
  };
  const bindet = (name, out) => {
    if (ts.isIdentifier(name)) out.push(name.text);
    else for (const el of name.elements) if (!ts.isOmittedExpression(el)) bindet(el.name, out);
    return out;
  };
  const istFunktion = (n) => !!n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));
  // Was es auf oberster Ebene gibt: Funktionen (ihr Rumpf läuft erst beim Aufruf), Erklärungen (ab ihrer
  // Stelle da) und alles, was an seiner Stelle sofort läuft
  const funktionen = new Map(), erklaerungen = [], laeufe = [];
  sf.statements.forEach((st, i) => {
    if (ts.isImportDeclaration(st)) return;
    if (ts.isFunctionDeclaration(st)) { if (st.name && st.body) funktionen.set(st.name.text, liest(st.body)); return; }
    if (ts.isClassDeclaration(st)) {
      if (st.name) erklaerungen.push({ i, namen: [st.name.text], zeile: zeile(st) });
      return;
    }
    if (ts.isVariableStatement(st)) {
      const fest = (st.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) !== 0;
      for (const d of st.declarationList.declarations) {
        const namen = bindet(d.name, []);
        if (fest) erklaerungen.push({ i, namen, zeile: zeile(d) });
        if (istFunktion(d.initializer) && ts.isIdentifier(d.name)) funktionen.set(d.name.text, liest(d.initializer));
        else if (d.initializer) laeufe.push({ i, liest: liest(d.initializer), zeile: zeile(d) });
      }
      return;
    }
    laeufe.push({ i, liest: liest(st), zeile: zeile(st) });
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
      if (l.i >= e.i) continue;
      const trifft = [...l.liest].find((n) => weg.has(n));
      if (trifft) funde.push({ name: weg.get(trifft).at(-1), zeile: e.zeile, lauf: l.zeile, weg: weg.get(trifft) });
    }
  }
  return { fehler, erklaerungen: erklaerungen.length, funde };
}
