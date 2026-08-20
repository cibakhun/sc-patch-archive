/* ============================================================
   shipcard-exclusions.mjs — benannte Ausnahmen fuer verify-shipcard.mjs.

   Vorbild: scripts/lib/sync-exclusions.mjs. Derselbe Warnsatz gilt hier:
   eine Ausnahme OHNE Begruendungstext (reason) ist eine Luecke, kein
   Ausschluss. verify-shipcard.mjs selbst traegt KEINE Ausnahme im eigenen
   Skriptkoerper — jede Sonderregel steht benannt und begruendet hier.

   Beim Anlegen (Welle 1, 14-01-PLAN.md) enthaelt diese Liste genau ZWEI
   Eintraege. Weitere entstehen NICHT auf Verdacht, sondern erst, wenn ein
   Tor-Lauf einen echten, benennbaren Fund liefert — Welle 3 (14-03-PLAN.md,
   Task 2) hat bereits zwei foerdern muessen, weil der Balkenrueckbau selbst
   erste Kandidaten produziert hat. Eine Ausnahme auf Vorrat, die auf kein
   einziges Vorkommen trifft, reisst sofort den Zombie-Waechter (Zusicherung
   8 in verify-shipcard.mjs).

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
    id: 'X-ch-profile-aggregate',
    mode: 'exclude-region',
    /* Prueft die rohe Region-HTML des Kapitel-Wurzelelements auf id="ch-profile". */
    match: (regionHtml) => /\bid\s*=\s*"ch-profile"/.test(regionHtml),
    reason:
      '14-03-PLAN.md (Task 2, "Bewusste Ausnahme, benannt statt verschwiegen") haelt zwei Werte im ' +
      'Leistungsprofil-Kapitel ausdruecklich NICHT fuer Doppelungen: die Feuerkraft-Summe ' +
      '(Piloten-DPS + Turm-DPS) und die Verteidigungs-Summe (Huelle-HP + Schilde-HP). Beide sind ' +
      'rechnerische Aggregate, die als SUMME an keiner anderen Stelle der Seite stehen — Ausstattung ' +
      'zeigt Piloten- und Turm-DPS bzw. Huelle- und Schild-HP nur EINZELN. Bei Schiffen mit genau ' +
      'EINER Waffengruppe bzw. nur Huelle ODER nur Schilden ist die Summe zufaellig IDENTISCH mit dem ' +
      'einzelnen Wert (Beispiel: eine reine Pilotenwaffen-Fregatte ohne Tuerme hat Feuerkraft-Summe == ' +
      'Piloten-DPS) — das Zahl+Einheit-Token-Verfahren dieses Tors kann diesen Sonderfall nicht von ' +
      'einer echten Doppelung unterscheiden, weil es nur den TEXT vergleicht, nicht die Bedeutung. ' +
      'Nach dem Wegfall des Rohwerts bei Tempo/Fracht/Quantum-Tempo (14-UI-SPEC.md Detailvertrag ' +
      'Punkt 6) bleiben Feuerkraft und Verteidigung die EINZIGEN Zahlen+Einheit-Werte, die das ' +
      'Leistungsprofil-Kapitel noch sichtbar traegt — der Ausschluss der gesamten Region ist deshalb ' +
      'nicht breiter als noetig. Faellt das Leistungsprofil-Kapitel weg oder verliert es die id ' +
      '"ch-profile", trifft diese Ausnahme auf keine Region mehr zu, und der Zombie-Waechter ' +
      '(Zusicherung 8) meldet sie.',
  },
  {
    id: 'X-cargo-cube-legende',
    mode: 'exclude-region',
    /* Prueft die rohe HTML eines UNTERABSCHNITTS (nicht nur eines direkten
       Kindes von div.sd, siehe die generische Subpiece-Pruefung in
       verify-shipcard.mjs computeRegions()) auf die Wuerfel-Massstabs-
       Legende "■ = N SCU" unter dem Frachtraum-Piktogramm. */
    match: (regionHtml) => /■\s*=\s*\d/.test(regionHtml),
    reason:
      'Gefunden beim ersten Tor-Lauf gegen Task 2 (14-03-PLAN.md): rsi-salvation traegt sowohl einen ' +
      '1-SCU-Wasserstoff-Tank als auch einen 1-SCU-Quantum-Tank UND einen Frachtraum, dessen ' +
      'Wuerfel-Legende ("■ = 1 SCU") DENSELBEN Zahlentext traegt wie der Quantum-Treibstoff-Wert im ' +
      'Unterabschnitt Quantum-Reise. Die Legende beschreibt den MASSSTAB der Wuerfel-Anzeige ' +
      '(`viz.cargo.cubeVal`, eine Zweierpotenz zwischen 1 und 128) — nicht eine Eigenschaft des ' +
      'Schiffs, die anderswo stehen koennte, und ist deshalb bei JEDEM Schiff mit Frachtraum ein ' +
      'moeglicher Kandidat, nicht nur bei rsi-salvation (der Ausschluss greift folgerichtig auf allen ' +
      '206 Seiten mit Frachtraum, nicht nur auf dem einen Fund). Der Fund ist eine reine ' +
      'TEXT-Koinzidenz zwischen voellig unabhaengigen Groessen (Legenden-Massstab vs. Treibstoff-Tank ' +
      'bzw. — bei anderen Schiffen potenziell — die freie Beschreibung in sd__desc), keine Doppelung ' +
      'im Sinne von D-03 — dieselbe Klasse Fehlalarm wie X-sd-simgrid, nur innerhalb einer Seite statt ' +
      'zwischen Seiten. Der Ausschluss trifft NUR den Unterabschnitt "Maße & Fracht" (dort und nur ' +
      'dort steht die Legende), nicht das ganze Ausstattungs-Kapitel. Verschwindet die Wuerfel-Legende ' +
      'aus dem Markup, trifft diese Ausnahme auf keinen Unterabschnitt mehr zu, und der ' +
      'Zombie-Waechter (Zusicherung 8) meldet sie.',
  },
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
    id: 'X-holo-dims-hud',
    mode: 'exclude-region',
    /* Prueft die rohe Region-HTML (direktes Kind von section.holo) auf die
       Klasse holo__dims — die HUD-Kurzanzeige "L ... m · W ... m · H ... m"
       oben rechts auf der 3D-Buehne (ShipDetail.astro Z. 119/725/1219,
       `position:absolute`, dieselbe dekorative Chrome-Familie wie
       .holo__hud links daneben). */
    match: (regionHtml) => /class="[^"]*\bholo__dims\b[^"]*"/.test(regionHtml),
    reason:
      'Gefunden beim ersten Lauf gegen die in 16-02-PLAN.md Task 2 erweiterte Regionsbildung (section.holo neu ' +
      'aufgenommen). Die Planungsannahme in 16-02-PLAN.md ("section.holo traegt heute ... aber keine ' +
      'Zahl-plus-Einheit-Token") hat sich als falsch erwiesen: `.holo__dims` rendert exakt "L <Laenge> m · ' +
      'W <Breite> m · H <Hoehe> m" als HUD-Kurzreferenz DIREKT AUF der Buehne — dieselbe Zahl, die formal im ' +
      'Kapitel "Ausstattung" Unterabschnitt "Masse & Fracht" (ch-gear, unveraendert von dieser Phase, ' +
      '16-UI-SPEC.md Detailvertrag Punkt 9) steht. Es ist eine Kurzanzeige UNMITTELBAR AM visuellen Objekt, das ' +
      'sie beschreibt, kein zweiter Dateneintrag im Fliesstext — dieselbe Klasse Fehlalarm wie ' +
      'X-cargo-cube-legende (dort: Massstabs-Legende neben dem Frachtraum-Piktogramm; hier: Massangabe neben ' +
      'dem gerenderten Schiff), nur bei den Schiffs-Gesamtmassen statt bei der Wuerfel-Groesse der ' +
      'Frachtraum-Visualisierung. Ein Fehlalarm dieser Art ist teurer als eine Luecke (Grundsatz 3, ' +
      'docs/maschinelle-validierung.md). Verschwindet `.holo__dims` aus dem Markup oder verliert die Klasse, ' +
      'trifft diese Ausnahme auf keine Region mehr zu, und der Zombie-Waechter (Zusicherung 8) meldet sie.',
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
