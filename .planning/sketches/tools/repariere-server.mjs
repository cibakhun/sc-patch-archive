/* ⚠⚠ 31.08.2026: der Mini-Server in JEDEM Messwerkzeug schrieb den Header
   VOR dem Lesen der Datei:

       try { res.writeHead(200, …); res.end(await readFile(f)); }
       catch { res.writeHead(404); res.end('x'); }

   Wirft readFile (fehlende Datei, Verzeichnis), ist der 200er-Header
   schon raus, der catch-Zweig wirft ERR_HTTP_HEADERS_SENT, und der
   ganze Node-Prozess stirbt — MITTEN im Messlauf. Der Lauf endet
   dann ohne Schlusszeile, und wer nur `tail` liest, sieht einen leeren
   Abschnitt und haelt ihn fuer „nichts gefunden".
   Genau das ist zwei Laeufen ueber 784 Seiten passiert.

   Reparatur: erst lesen, dann Header schreiben.                        */

/* Einmalwerkzeug, am 31.08.2026 ueber alle Messwerkzeuge gelaufen:
   16 repariert, 19 waren schon in Ordnung. Der Rumpf ist entfernt, weil
   das Skript beim Lauf seinen EIGENEN Suchtext getroffen hat — der
   Merkzettel oben ist das, was bleibt. */
