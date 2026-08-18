/* ============================================================
   shipcard-exclusions.mjs — benannte Ausnahmen fuer verify-shipcard.mjs.

   Vorbild: scripts/lib/sync-exclusions.mjs. Derselbe Warnsatz gilt hier:
   eine Ausnahme OHNE Begruendungstext (reason) ist eine Luecke, kein
   Ausschluss. verify-shipcard.mjs selbst traegt KEINE Ausnahme im eigenen
   Skriptkoerper — jede Sonderregel steht benannt und begruendet hier.

   Beim Anlegen (Welle 1, 14-01-PLAN.md) enthaelt diese Liste genau ZWEI
   Eintraege. Weitere entstehen ERST aus dem `--report`-Berichtslauf in
   Welle 4 (14-04-PLAN.md) und NICHT auf Verdacht — eine Ausnahme auf
   Vorrat, die auf kein einziges Vorkommen trifft, reisst sofort den
   Zombie-Waechter (Zusicherung 8 in verify-shipcard.mjs).

   Zwei Modi:
     - 'exclude-region' — eine ganze Region (ein direktes Kind von div.sd,
       bzw. ein per sd__sub abgetrennter Unterabschnitt davon) faellt
       VOR dem Zaehlen komplett aus Zusicherung 6 heraus. match(regionHtml)
       prueft die rohe HTML-Zeichenkette dieser Region.
     - 'ignored-units' — ein Zahl+Einheit-Muster, das ABSICHTLICH nicht im
       festen Einheitenvorrat von verify-shipcard.mjs (Meter, SCU, m/s,
       km/s, HP, DPS) steht. Diese Ausnahme filtert nichts aktiv (der feste
       Vorrat schliesst diese Einheiten schon per Konstruktion aus) —
       sie DOKUMENTIERT den Anlass UND wird vom Skript aktiv auf jeder
       Seite nachgezaehlt (units[].source), damit der Zombie-Waechter eine
       echte Zahl statt einer Behauptung pruefen kann: verschwaende jede
       dieser Einheiten aus dem gebauten Bestand, wuerde das hier auffallen.
   ============================================================ */

export const EXCLUSIONS = [
  {
    id: 'X-sd-simgrid',
    mode: 'exclude-region',
    /* Prueft die rohe Region-HTML auf die Klasse sd__simgrid (Raster fuer
       aehnliche Schiffe) — Klassenlisten-Treffer, kein Volltext-Zufall. */
    match: (regionHtml) => /class="[^"]*\bsd__simgrid\b[^"]*"/.test(regionHtml),
    reason:
      'Der Block mit dem Raster fuer aehnliche Schiffe (ShipDetail.astro, Abschnitt "AEHNLICHE ' +
      'SCHIFFE", Klasse sd__simgrid) zeigt Kennwerte wie Laenge/Groesse FREMDER Schiffe — nicht ' +
      'des Schiffs, dessen Seite gerade geprueft wird. Ohne diesen Ausschluss meldet Zusicherung 6 ' +
      'einen Alarm, sobald ein zufaellig gleich langes Nachbarschiff in der Vorschlagsliste auftaucht ' +
      '(z. B. wenn die eigene Laenge 126 m zufaellig auch bei einem AEHNLICHEN Schiff in der Liste ' +
      'steht) — das ist keine Doppelung im Sinne von D-03, sondern zwei verschiedene Schiffe mit ' +
      'zufaellig demselben Wert. Ein Fehlalarm dieser Art ist teurer als eine Luecke (Grundsatz 3, ' +
      'docs/maschinelle-validierung.md). Verschwindet die Klasse sd__simgrid aus dem Markup (z. B. ' +
      'weil der Aehnliche-Schiffe-Block umbenannt wird), trifft diese Ausnahme auf keine Region mehr ' +
      'zu, und der Zombie-Waechter (Zusicherung 8) meldet sie.',
  },
  {
    id: 'X-einheiten-ausserhalb-des-vorrats',
    mode: 'ignored-units',
    /* Jede dieser Einheiten wird von verify-shipcard.mjs aktiv auf jeder
       Region nachgezaehlt (nicht als Doppelungs-Kandidat, nur als
       Zombie-Beleg) — `source` ist der Regex-Quelltext, `flags` immer 'g'. */
    units: [
      { label: 'aUEC (Preiszeilen)', source: '\\d[\\d.,]*\\s?aUEC\\b' },
      { label: '°/s (Grad je Sekunde)', source: '\\d[\\d.,]*\\s?°/s\\b' },
      { label: 'Gm (Gigameter, Quantum-Reichweite)', source: '\\d[\\d.,]*\\s?Gm\\b' },
      { label: 's (Sekunden, Spool-Zeit)', source: '\\d[\\d.,]*\\s?s\\b(?![a-zA-Z])' },
      { label: 'min (Minuten, Versicherungs-Claim)', source: '\\d[\\d.,]*\\s?min\\b(?![a-zA-Z])' },
    ],
    reason:
      'Der feste Einheitenvorrat aus Zusicherung 6 (Meter, SCU, Meter je Sekunde, Kilometer je ' +
      'Sekunde, HP, DPS) ist bewusst klein gehalten — diese fuenf Einheiten stehen absichtlich ' +
      'NICHT darin: aUEC-Preiszeilen wiederholen sich betriebsbedingt ueber mehrere Verkaufsstellen ' +
      '(Kaufen-im-Verse-Panel, kein Datenfehler); Grad je Sekunde, Gigameter, Sekunden und Minuten ' +
      'kommen je Seite nur GENAU EINMAL vor (Agilitaets-Rohwert, Quantum-Reichweite, Spool-Zeit, ' +
      'Versicherungs-Claim) und tragen deshalb keine Doppelungsgeschichte, die dieses Tor beurteilen ' +
      'soll. Ein Aufnehmen in den Vorrat wuerde entweder taeglich Fehlalarm erzeugen (aUEC) oder nie ' +
      'etwas finden (die vier Einzelwerte) — beides ist teurer als der Ausschluss (Grundsatz 3). ' +
      'Verschwaende einer dieser Werte site-weit ganz aus dem gebauten Bestand, faende ihn keine der ' +
      'fuenf Muster mehr, und der Zombie-Waechter (Zusicherung 8) meldet die Ausnahme.',
  },
];
