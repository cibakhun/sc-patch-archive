// JSON fuer den Einsatz IN einem <script>-Element — die eine Stelle, an der
// Baudaten als JSON in eine Seite gehen:
//   <script type="application/json" … set:html={jsonForScript(x)} />
//   <script type="application/ld+json" set:html={jsonForScript(ld)} />
//   <script is:inline set:html={`window.__X=${jsonForScript(cfg)};`} />
//
// Warum nicht einfach JSON.stringify: der HTML-Parser beendet ein Skript beim
// ersten `</script`, auch wenn das mitten in einem JSON-String steht — und die
// Strings kommen zum Teil aus Fremdquellen (Schiffsliste, Preise, Datenlauf).
// `<` wird deshalb zu `<` — fuer JSON.parse und fuer JavaScript dasselbe
// Zeichen, fuer den HTML-Parser kein Tag-Anfang mehr. Damit ist auch `<!--`
// erledigt. U+2028/U+2029 (Zeilen-/Absatztrenner) werden ebenfalls als Escape
// geschrieben: in JavaScript vor ES2019 beendeten sie String-Literale, und als
// Escape sind sie in jedem Kontext eindeutig.
//
// Ausserhalb von Strings kann JSON.stringify keines der drei Zeichen erzeugen;
// jede Ersetzung landet also in einem String und aendert seinen Wert nicht.
// Fuer Daten ohne die drei Zeichen ist die Ausgabe Byte fuer Byte die von
// JSON.stringify. verify:script-json haelt das fest (Quelle und dist/).
//
// Die Regex-Literale schreiben U+2028/U+2029 bewusst als Escape (\u2028), nie
// als rohes Zeichen — ein rohes Zeichen ist im Quelltext unsichtbar.
export function jsonForScript(value: unknown): string {
  const s = JSON.stringify(value);
  // JSON.stringify(undefined) ist undefined; set:html={undefined} rendert
  // nichts — '' haelt genau diese Ausgabe bei.
  if (s === undefined) return '';
  return s.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
