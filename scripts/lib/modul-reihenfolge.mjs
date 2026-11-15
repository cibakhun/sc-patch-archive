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
//     (const X = f() liest über f zu früh, const a = b, b = 1 liest b zu früh);
//   - ein Muster Glied für Glied: erst der berechnete Schlüssel, dann der Standardwert, dann gibt es den Namen
//     (const { a, b = a } = o ist richtig, const { b = a, a } = o liest a zu früh);
//   - von einer Klasse schon bei ihrer Erklärung: wovon sie erbt und die berechneten Namen ihrer Glieder (noch
//     bevor es ihren Namen gibt), dann die Anfangswerte statischer Felder und statische Blöcke. Dort gibt es
//     den Namen der Klasse schon, aber nur im Innern der Klasse: Für alles außerhalb (eine Funktion des
//     Moduls, die das statische Feld ruft) gibt es ihn erst, wenn auch die statischen Teile durch sind.
//     Methoden, Konstruktor und die Anfangswerte der Felder einer Instanz laufen erst, wenn jemand die Klasse
//     benutzt: Sie zählen wie eine Funktion. Auch ein statisches Feld kann die eigene Klasse benutzen (ihr
//     Name, this).
// Eine Funktion liest, was ihr Rumpf und die Standardwerte ihrer Parameter lesen. Eine Ausfuhrliste
// (export { X }) liest nichts.
// Gelesen wird nach Namen, ohne Geltungsbereiche: Liest eine Funktion einen eigenen gleichnamigen Namen (einen
// Parameter, eine Konstante in ihrem Rumpf), zählt das mit; die Stelle, die einen Namen erklärt oder nur
// trägt (Glied, Schlüssel, Sprungmarke, import.meta), ist dagegen kein Griff. Eine Funktion, die eine frühere
// Anweisung nur weiterreicht, gilt als gerufen, und wer eine Klasse benutzt, erreicht alles, was sie liest. Das
// ist zu streng statt zu milde, und ein Fund nennt Zeile und Weg, damit er sich nachprüfen lässt. Eine Stelle
// ist bewusst milde, damit Übliches kein Fund wird: In ihrem EIGENEN Anfangswert zählt der Rumpf einer dort
// geschriebenen Funktion nicht (const t = setTimeout(() => clearTimeout(t))), es sei denn, sie wird an Ort und
// Stelle gerufen ((() => …)(), nicht async und kein Generator). Ruft der Anfangswert sie anders sofort
// (const xs = [1].map(() => xs)), sieht die Prüfung das nicht.
// Was die Prüfung meldet und was der Lauf selbst tut, vergleicht tests/e2e/modul-reihenfolge.test.js Fall für
// Fall; jede Abweichung steht dort mit ihrem Grund.
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
  // Eine Funktion, die an Ort und Stelle gerufen wird: (() => …)(). Ein Generator läuft dabei noch nicht, eine
  // async-Funktion nur bis zu ihrem ersten await: Beide zählen hier nicht.
  const sofortGerufen = (k) => {
    if (!(ts.isArrowFunction(k) || ts.isFunctionExpression(k)) || k.asteriskToken || k.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) return false;
    let a = k;
    while (ts.isParenthesizedExpression(a.parent)) a = a.parent;
    return ts.isCallExpression(a.parent) && a.parent.expression === a;
  };
  // Steht in Knoten ein this, das beim Auswerten selbst gilt? tief: auch in Pfeilfunktionen darin. Eine andere
  // Funktion oder Klasse hat ihr eigenes this.
  const nenntThis = (knoten, tief) => {
    const geh = (k) => k.kind === ts.SyntaxKind.ThisKeyword
      || (!ts.isClassLike(k) && (!ts.isFunctionLike(k) || (ts.isArrowFunction(k) && (tief || sofortGerufen(k)))) && !!ts.forEachChild(k, geh));
    return knoten.some(geh);
  };
  // Namen, die Knoten lesen: jeder Bezeichner, der nicht nur ein Name ist (Glied a.NAME, Schlüssel { NAME: … },
  // Methode, Feld, Sprungmarke, import.meta) und nicht die Stelle, die einen Namen erklärt (Variable, Parameter,
  // Funktion, Klasse).
  // tief: auch in den Rümpfen der Funktionen und Klassen darin; sonst nur, was beim Auswerten selbst läuft.
  const erklaert = (e, k) => (ts.isVariableDeclaration(e) || ts.isBindingElement(e) || ts.isParameter(e) || ts.isFunctionDeclaration(e)
    || ts.isFunctionExpression(e) || ts.isClassDeclaration(e) || ts.isClassExpression(e)) && e.name === k;
  const nurName = (e, k) => (e.name === k && (ts.isPropertyAccessExpression(e) || ts.isPropertyAssignment(e) || ts.isMethodDeclaration(e)
    || ts.isPropertyDeclaration(e) || ts.isAccessor(e) || ts.isMetaProperty(e)))
    || (ts.isBindingElement(e) && e.propertyName === k)
    || ((ts.isLabeledStatement(e) || ts.isBreakOrContinueStatement(e)) && e.label === k);
  // Was die statischen Teile einer Klasse lesen, solange es ihren Namen nur im Innern gibt (flach): der eigene
  // Name ist dort kein Griff. Benutzen sie die Klasse selbst, erreichen sie, was ihre Glieder lesen.
  const statischLiest = (k, drin) => {
    const flach = liest(drin, false);
    const selbst = (k.name && flach.has(k.name.text)) || nenntThis(drin, false);
    return [...(selbst ? new Set([...flach, ...liest([k])]) : flach)].filter((n) => n !== k.name?.text);
  };
  const liest = (knoten, tief = true) => {
    const out = new Set();
    const geh = (k) => {
      if (ts.isIdentifier(k) && !nurName(k.parent, k) && !erklaert(k.parent, k)) out.add(k.text);
      if (!tief && ts.isClassLike(k)) {
        const s = klasseSofort(k);
        s.vorher.forEach(geh);
        for (const n of statischLiest(k, s.drin)) out.add(n);
        return;
      }
      if (!tief && ts.isFunctionLike(k) && !sofortGerufen(k)) return;
      ts.forEachChild(k, geh);
    };
    for (const k of knoten) geh(k);
    return out;
  };
  // Was ein Muster beim Zerlegen liest, in seiner Reihenfolge: je Glied erst der berechnete Schlüssel, dann
  // der Standardwert, dann gibt es seinen Namen. Was schon da ist, liest ein späteres Glied zu Recht.
  const musterLiest = (muster, tief, da = new Set(), out = new Set()) => {
    for (const el of muster.elements) {
      if (ts.isOmittedExpression(el)) continue;
      const vor = [];
      if (el.propertyName && ts.isComputedPropertyName(el.propertyName)) vor.push(el.propertyName.expression);
      if (el.initializer) vor.push(el.initializer);
      for (const n of liest(vor, tief)) if (!da.has(n)) out.add(n);
      if (ts.isIdentifier(el.name)) da.add(el.name.text); else musterLiest(el.name, tief, da, out);
    }
    return out;
  };
  const bindet = (name, out) => {
    if (ts.isIdentifier(name)) out.push(name.text);
    else for (const el of name.elements) if (!ts.isOmittedExpression(el)) bindet(el.name, out);
    return out;
  };
  const istFunktion = (n) => !!n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));
  // Was es auf oberster Ebene gibt: Funktionen und Klassen (ihr Rumpf läuft erst, wenn jemand sie benutzt),
  // Erklärungen (ab ihrer Stelle da) und alles, was an seiner Stelle sofort läuft. Stelle: Anweisung i, darin j.
  // Je Lauf: tief (was er liest und weiterreicht) gilt Erklärungen, die später stehen; flach (was beim
  // Auswerten selbst läuft) gilt der Erklärung an derselben Stelle, also dem eigenen Anfangswert
  const funktionen = new Map(), erklaerungen = [], laeufe = [];
  const lauf = (i, j, z, tief, flach) => laeufe.push({ i, j, tief: new Set(tief), flach: new Set(flach), zeile: z });
  sf.statements.forEach((st, i) => {
    if (ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) return;
    if (ts.isFunctionDeclaration(st)) { if (st.name && st.body) funktionen.set(st.name.text, liest([st])); return; }
    if (ts.isClassDeclaration(st)) {
      // Erbe und berechnete Namen, die statischen Teile und die Erklärung teilen sich eine Stelle: Den Namen
      // gibt es für das Modul erst, wenn alles davon durch ist
      const s = klasseSofort(st);
      if (s.vorher.length) lauf(i, 0, zeile(st), liest(s.vorher), liest(s.vorher, false));
      // this in einem statischen Teil ist die Klasse selbst: über ihren Namen, ohne Namen über das, was sie liest
      const selbst = nenntThis(s.drin, true) ? (st.name ? [st.name.text] : liest([st])) : [];
      if (s.drin.length) lauf(i, 0, zeile(st), [...liest(s.drin), ...selbst], statischLiest(st, s.drin));
      if (st.name) { erklaerungen.push({ i, j: 0, namen: [st.name.text], zeile: zeile(st) }); funktionen.set(st.name.text, liest([st])); }
      return;
    }
    if (ts.isVariableStatement(st)) {
      const fest = (st.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) !== 0;
      st.declarationList.declarations.forEach((d, j) => {
        if (fest) erklaerungen.push({ i, j, namen: bindet(d.name, []), zeile: zeile(d) });
        if (istFunktion(d.initializer) && ts.isIdentifier(d.name)) { funktionen.set(d.name.text, liest([d.initializer])); return; }
        const wert = d.initializer ? [d.initializer] : [], muster = !ts.isIdentifier(d.name);
        if (wert.length || muster) lauf(i, j, zeile(d), [...liest(wert), ...(muster ? musterLiest(d.name, true) : [])], [...liest(wert, false), ...(muster ? musterLiest(d.name, false) : [])]);
      });
      return;
    }
    lauf(i, 0, zeile(st), liest([st]), []);
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
      // davor: eine frühere Anweisung oder in derselben Anweisung eine frühere Stelle. An derselben Stelle
      // läuft der Anfangswert vor seiner Erklärung
      if (l.i > e.i || (l.i === e.i && l.j > e.j)) continue;
      const trifft = [...(l.i === e.i && l.j === e.j ? l.flach : l.tief)].find((n) => weg.has(n));
      if (trifft) funde.push({ name: weg.get(trifft).at(-1), zeile: e.zeile, lauf: l.zeile, weg: weg.get(trifft) });
    }
  }
  return { fehler, erklaerungen: erklaerungen.length, funde };
}
