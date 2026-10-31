/* CRLF-sicheres Ersetzen mit lautem Abbruch.
   ⚠⚠ Am 31.08.2026 sind zwei Reparaturen STILL fehlgeschlagen, weil der
   Suchtext LF trug und die Datei CRLF (CLAUDE.md: „`.` trifft kein `\r`").
   Der Build lief danach grün — er hatte ja nichts zu tun. Erst die
   Nachmessung fand denselben Fehler ein zweites Mal.
   ⚠⚠ Und einmal hat ein Python-Heredoc `\2039` als OKTAL gelesen
   (\203 + '9') und ein Steuerzeichen ins CSS geschrieben. Darum stehen
   Suchen und Ersetzen hier in einer JSON-Datei, nicht in der Kommandozeile.

   node .planning/sketches/tools/ersetze.mjs auftrag.json
     [{ "datei": "…", "suche": "…", "ersatz": "…" }, …]                    */
import { readFileSync, writeFileSync } from 'node:fs';
const auftraege = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const a of auftraege) {
  const roh = readFileSync(a.datei, 'utf8');
  const crlf = /\r\n/.test(roh);
  const flach = roh.replace(/\r\n/g, '\n');
  const suche = a.suche.replace(/\r\n/g, '\n');
  const n = flach.split(suche).length - 1;
  if (n !== 1) { console.error(`FEHLER ${a.datei}: Suchtext ${n}x gefunden, erwartet 1x`); process.exit(1); }
  const neu = flach.replace(suche, a.ersatz.replace(/\r\n/g, '\n'));
  writeFileSync(a.datei, crlf ? neu.replace(/\n/g, '\r\n') : neu, 'utf8');
  console.log(`  ok ${a.datei}  (${crlf ? 'CRLF' : 'LF'} erhalten)`);
}
