# Phase 4: Sprachparität absichern - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning
**Source:** discuss-phase-Lauf vom 08.08.2026, drei Entscheidungen vom Betreiber.

<domain>
## Phase Boundary

Ein **wiederholbarer Prüfschritt** belegt, dass die deutsche und die englische Fassung jeder Seite
strukturell deckungsgleich sind — und **schlägt fehl**, sobald eine Fassung nachträglich
auseinanderläuft. Dazu ein Wächter für THEME-02: der generierte Hellmodus-Block darf nicht von
Hand verändert werden.

**Ausdrücklich NICHT in dieser Phase:** Übersetzungsqualität, Wortwahl, Textlängen. Es geht um
Struktur und Gestaltung, nicht um Sprache. Ebenso nicht: die vollständige Zusammenführung der
Seitenpaare zu je EINEM Körper — das steht als SYNC-04 nach v2 in `REQUIREMENTS.md` § Out of Scope.

</domain>

<measured_state>
## Gemessener Ist-Zustand (08.08.2026)

**Der Befund in CONCERNS.md ist veraltet.** Er beschreibt `/precision-jump` mit 147 gegen 93
Zeilen — ein deutscher Besucher bekam die Fassung vor dem Umbau. Heute:

| Seitenpaar | EN | DE | Unterschied |
|---|---|---|---|
| precision-jump | 72 | 68 | **4** *(war 147/93)* |
| datenschutz | 256 | 273 | 17 |
| downloads | 376 | 384 | 8 |
| evolution | 385 | 381 | 4 |
| index | 367 | 368 | 1 |

Die Körper-Zusammenlegungen der Phasen 1.2, 2 und 3 haben das weitgehend geheilt. Der größte
Ausreißer sind 17 Zeilen.

**Seitenpaare:** 70 EN, 69 DE. Die einzige Seite ohne Gegenstück ist `404.astro` — richtig so,
eine Fehlerseite gibt es einmal. **69 echte Paare, keine Lücke.**

⚠ Messfalle beim Erheben: PowerShells `Test-Path` behandelt `[slug]` in den dynamischen
Routendateien als Platzhalter-Zeichenklasse und meldete sechs Paare fälschlich als fehlend.
`-LiteralPath` verwenden.

**Was schon existiert** — vier Tore vergleichen bereits je 8.678 gebaute Seitenpaare, aber jedes
nur auf seine eigenen Marker:

| Tor | vergleicht |
|---|---|
| `verify:fx` | Umschalter-Klasse, `data-fx`, Ereignisname |
| `verify:help` | `data-tool-id`, `data-help`, Hilfe-Klasse |
| `verify:typo` | Skalen-Token |
| `verify:layers` | **kein Paarvergleich** |

Vier Spezialisten, kein Allgemeiner. Genau diese Lücke schließt die Phase.

</measured_state>

<decisions>
## Implementation Decisions

- **D-01: Der Maßstab ist ein STRUKTUR-FINGERABDRUCK.** Aus jeder gebauten Seite wird die
  Gerüstform gezogen — Abfolge der Element-Typen und Klassen, **ohne Textinhalte** — und die
  beiden Fingerabdrücke müssen übereinstimmen. Das fängt fehlende Abschnitte, vertauschte
  Reihenfolge und einseitige Umbauten, und verträgt zugleich unterschiedlich lange Übersetzungen,
  weil Text nicht eingeht. Bewusst nicht gewählt: reine Zählungen (übersehen vertauschte
  Reihenfolge) und Fingerabdruck-plus-Stil (zu viele Fehlalarme, wo Unterschiede gewollt sind).
- **D-02: Das Tor gilt für ALLE 69 Paare**, nicht nur für die in diesem Meilenstein angefassten.
  Die Roadmap formuliert enger, aber der Meilenstein hat inzwischen fast alle angefasst — und ein
  Tor, das nur eine Teilmenge bewacht, lädt die Restmenge zum Auseinanderdriften ein. Eine
  gepflegte Ausnahmeliste würde außerdem niemand pflegen.
- **D-03: Erst beheben, dann scharf.** Was der erste Lauf an echten Unterschieden findet, wird in
  dieser Phase behoben; danach hängt das Tor blockierend im Dockerfile. Bewusst nicht gewählt:
  eine Sperrklinke wie in Phase 2, die den Ist-Stand einfriert — hier soll der Bestand sauber
  sein, nicht nur eingefroren. — **Reversibility:** reversible — der Umfang der Behebung hängt vom
  ersten Messergebnis ab; fällt er unerwartet groß aus, ist das ein Befund für den Betreiber.
- **D-04: THEME-02 bekommt einen eigenen Wächter.** „Kein generierter
  `:root[data-theme='light']`-Block wird von Hand verändert" ist eine andere Art von Parität als
  der Seitenvergleich, gehört aber zu dieser Phase. Der Wächter muss erkennen, ob der Block noch
  dem entspricht, was `npm run theme` erzeugen würde.

### Claude's Discretion
- Wie der Fingerabdruck genau gebildet wird (Element-Typen, Klassen, Verschachtelungstiefe,
  Reihenfolge) und wie er normalisiert wird
- Welche Unterschiede als legitim gelten und deshalb aus dem Vergleich fallen — die Liste muss
  begründet und benannt sein, nicht stillschweigend
- Ob der THEME-02-Wächter eigenständig läuft oder Teil desselben Skripts wird
- Ob die vier bestehenden Paarvergleiche unverändert bleiben oder auf den neuen Fingerabdruck
  aufsetzen — sie dürfen dabei nicht schwächer werden

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` § „Phase 4" — Ziel und die drei Erfolgskriterien
- `.planning/REQUIREMENTS.md` — SYNC-01, SYNC-02, THEME-02; dazu § Out of Scope, wo SYNC-04
  (vollständige Zusammenführung) ausdrücklich nach v2 verschoben ist
- `.planning/codebase/CONCERNS.md` § „Class A" — der Befund, mit veralteten Zahlen (siehe
  `<measured_state>`)
- `scripts/verify-fx.mjs`, `verify-help.mjs`, `verify-typo-motion.mjs` — drei erprobte
  Paarvergleiche; ihre Paarungslogik ist der Ausgangspunkt, nicht neu zu erfinden
- `scripts/verify-layers.mjs` — das jüngste Tor, Vorbild für Registry und Vollständigkeitswächter
- Die drei Theme-Generatoren (`npm run theme`) — für D-04 muss man wissen, was sie erzeugen

</canonical_refs>

<code_context>
## Existing Code Insights

### Wiederverwendbar
- **Die Paarungslogik** steckt schon dreifach in den bestehenden Toren, inklusive der
  Sicherung „weniger als 60 Paare gefunden = die Paarung ist kaputt". Ein vierter eigener
  Paarungscode wäre eine vierte Fehlerquelle.
- **`scripts/verify-layers.mjs`** zeigt das Muster für Vollständigkeit: ein Wächter, der den
  GEBAUTEN Stand absucht und fehlschlägt, wenn etwas ohne Registry-Eintrag auftaucht.
- **Der Dockerfile-Kette** hängen bereits `verify:typo` und `verify:layers` an — der Platz für ein
  fünftes Tor ist vorbereitet.

### Fallen (dokumentiert, nicht neu zu entdecken)
- ⚠ **`Test-Path` ohne `-LiteralPath` verschluckt `[slug]`-Routen** (siehe `<measured_state>`).
- ⚠ **Astro zieht `<style>`-Blöcke in gehashte Bündel unter `dist/_astro/*.css`** — ein
  Vergleich, der nur `dist/**/*.html` liest, sieht die Gestaltung nicht. Phase 2 ist genau
  darüber gestolpert.
- ⚠ **`Select-String` findet auf sehr langen Zeilen (minifiziertes HTML) teils nichts** — für
  gebauten Stand ripgrep nehmen.
- ⚠ **CRLF**: ein `.` in einem regulären Ausdruck matcht keinen Wagenrücklauf. In Phase 3 hat ein
  verirrtes `\r` eine zeilenweise Massenänderung dazu gebracht, ein `</style>` mitzulöschen —
  **und der Build lief trotzdem durch**. Vor zeilenweisen Mustern `\r\n?` normalisieren.
- ⚠ **`assets/theme.css` ist GENERIERT** — für D-04 ist das der Gegenstand, nicht die Falle: der
  Wächter muss vergleichen, nicht ändern.

### Der wahrscheinlichste Stolperstein
Ein Struktur-Fingerabdruck ist schnell zu streng. Legitime Unterschiede, die KEIN Fehlalarm sein
dürfen: `lang`-Attribut, `hreflang`-Verweise, Pfade mit `/de/`-Präfix, unterschiedlich viele
Zeilenumbrüche im Fließtext, und Seiten, auf denen bewusst nur eine Sprachfassung etwas zeigt.
Die Ausnahmeliste gehört benannt und begründet in den Plan — eine stillschweigende Ausnahme ist
dasselbe wie ein blindes Tor.

</code_context>

<specifics>
## Specific Ideas

- Erfolgskriterium 2 lautet wörtlich: „Der Prüfschritt schlägt fehl, wenn eine Sprachfassung
  nachträglich auseinanderläuft." Das ist eine **Negativkontrolle** und kein Nebensatz — sie
  gehört ausgeführt und im Commit belegt. Drei Tore dieses Projekts wurden so bewiesen; das eine,
  das niemand geprüft hatte, war blind.
- Der Betreiber hat „erst beheben, dann scharf" gewählt statt einzufrieren. Ein Planer, der beim
  ersten Fund auf eine Sperrklinke ausweicht, hat die Entscheidung überschrieben — es sei denn,
  der Fund ist so groß, dass er als Befund zurückgeht.

</specifics>

<deferred>
## Deferred Ideas

- **SYNC-04 — die vollständige Zusammenführung aller Seitenpaare zu je EINEM Körper.** Steht in
  `REQUIREMENTS.md` § Out of Scope, ausdrücklich nach v2 verschoben. Wäre die eigentliche Lösung
  der Ursache; diese Phase baut den Wächter, nicht den Umbau.
- Übersetzungsqualität und Wortwahl prüfen — anderer Gegenstand, andere Werkzeuge.

</deferred>

---

*Phase: 4-sprachparitaet-absichern*
*Context gathered: 2026-08-08*
