// Quellen einer Bühne (verify:hangar [24]): jede Stelle im Rumpf einer Funktion, an der etwas von außen
// kommt (Leitung, Modul, Bild, Lader), und ob sie in den Klammern eines Aufrufs der Schutzfunktion steht.
//
// Gelesen wird der Syntaxbaum, nicht die Zeile (15.11.2026, PR #371). Die Zählung über Zeilen und Klammern
// ließ sich zweimal täuschen: erst nahm sie jedes lebt( weiter vorn auf der Zeile als Schutz, dann hielt
// eine Klammer in einer Zeichenkette den Schutz offen. Im Baum gibt es beides nicht: Zeichenketten,
// Kommentare und Muster sind keine Klammern und keine Quellen, und ein Aufruf über mehrere Zeilen bleibt
// einer. typescript ist ohnehin im Tor (verify:typen) und liest hier nur, ohne Typen.
import ts from 'typescript';

// Quellformen: der blanke Aufruf (kein Glied von etwas), import(…), new Image(…), und die Lader (x.load, x.loadAsync)
const NAMEN = new Set(['fetch', 'createImageBitmap']);
const GLIEDER = new Set(['load', 'loadAsync']);

/**
 * @param {string} text Quelltext des Moduls
 * @param {{ funktion?: string, schutz?: string }} [o] Name der Funktion, deren Rumpf zählt, und der Schutzfunktion
 * @returns {{ fehler: string[], quellen: { zeile: number, text: string, art: string, geschuetzt: boolean }[] }}
 *   fehler: warum der Text nicht (ganz) gelesen ist; dann ist die Liste keine Zählung.
 *   quellen: in der Reihenfolge des Texts; zeile ab 1, text die Zeile, in der die Quelle beginnt.
 */
export function buehnenQuellen(text, { funktion = 'initHangar', schutz = 'lebt' } = {}) {
  const sf = ts.createSourceFile('buehne.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const zeileVon = (pos) => sf.getLineAndCharacterOfPosition(pos).line;
  const fehler = (sf.parseDiagnostics ?? []).map((d) => `Zeile ${zeileVon(d.start ?? 0) + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
  let rumpf = null;
  const such = (n) => {
    if (rumpf) return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === funktion && n.body) rumpf = n.body;
    else ts.forEachChild(n, such);
  };
  such(sf);
  if (!rumpf) return { fehler: [...fehler, `die Funktion ${funktion} steht nicht im Text`], quellen: [] };
  const art = (n) => {
    if (ts.isCallExpression(n)) {
      const f = n.expression;
      if (f.kind === ts.SyntaxKind.ImportKeyword) return 'import';
      if (ts.isIdentifier(f) && NAMEN.has(f.text)) return f.text;
      if (ts.isPropertyAccessExpression(f) && GLIEDER.has(f.name.text)) return `.${f.name.text}`;
    }
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Image') return 'new Image';
    return null;
  };
  // in einem Argument eines Aufrufs der Schutzfunktion, wie tief auch immer. Was nur neben dem Aufruf steht
  // (lebt(x) ?? quelle, lebt(x).then(() => quelle)), steht in keinem seiner Argumente.
  const geschuetzt = (n) => {
    for (let kind = n, e = n.parent; e && kind !== rumpf; kind = e, e = e.parent) {
      if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === schutz && e.arguments.includes(kind)) return true;
    }
    return false;
  };
  const zeilen = text.split('\n'), quellen = [];
  const geh = (n) => {
    const a = art(n);
    if (a) { const z = zeileVon(n.getStart(sf)); quellen.push({ zeile: z + 1, text: zeilen[z] ?? '', art: a, geschuetzt: geschuetzt(n) }); }
    ts.forEachChild(n, geh);
  };
  geh(rumpf);
  return { fehler, quellen };
}
