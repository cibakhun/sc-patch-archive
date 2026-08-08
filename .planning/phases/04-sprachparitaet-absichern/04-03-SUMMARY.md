---
phase: 04-sprachparitaet-absichern
plan: 03
subsystem: testing
tags: [i18n, build-gate, astro, theme, css-generator, dockerfile]

requires:
  - phase: 04-sprachparitaet-absichern
    provides: "04-02: npm run verify:sync meldet 0 unerklaerte Abweichungen ueber alle 8678 Paare, Exit 0 — Handover-Bedingung fuer das Scharfschalten erfuellt"
provides:
  - "scripts/verify-theme-gen.mjs — THEME-02-Waechter (npm run verify:theme): ruft die drei echten `npm run theme`-Generatoren gegen eine Ablagekopie unter os.tmpdir() auf, vergleicht die erzeugten Bloecke A/B normalisiert gegen den Bestand, veraendert den Arbeitsbaum nie"
  - "assets/theme.css — Kopfkommentar richtiggestellt (Marke HANDGEPFLEGT): der Hellmodus-Block dort ist von Hand abgeleitet, kein Generator fasst die Datei an"
  - "scripts/build-light-overrides.mjs — zwei echte, vorbestehende Bugs behoben (stripTrailingRootRules() loeschte einen gueltigen generierten Block, topLevelRules() zaehlte Klammern in Kommentaren mit) plus ein Schutz gegen doppelte Wahrheiten (Rule 2: keine automatische Hell-Entsprechung fuer Selektoren mit bereits handgeschriebenem Gegenstueck)"
  - "src/components/pilot/PilotPage.astro, src/components/account/ProfileCard.astro — stale, durch die Generator-Bugs entstandene Duplikat-Farben aus dem generierten Block entfernt; die kuratierten Handwerte gewinnen wieder"
  - "Dockerfile — verify:sync und verify:theme haengen jetzt blockierend in der RUN-Kette hinter verify:layers (D-03 'dann scharf' vollzogen)"
  - "SYNC-01, SYNC-02, THEME-02 in REQUIREMENTS.md auf Complete, je mit dem TOR benannt"
affects: []

tech-stack:
  added: []
  patterns:
    - "Ablagekopie-Waechter: ein Pruefskript, das ein Codemod-Skript real ausfuehrt, MUSS gegen eine Kopie unter os.tmpdir() laufen (execFileSync mit umgelenktem cwd), nie gegen den Arbeitsbaum — Vorbild fuer jeden kuenftigen Waechter, der einen schreibenden Generator prueft"
    - "EXCLUSIONS mit Zombie-Waechter (zweites Vorkommen nach scripts/lib/sync-exclusions.mjs): eine benannte, begruendete Ausnahme fuer einen Fall, der KEINE Handaenderung ist (hier: vorbestehende fehlende Generator-Abdeckung), abgesichert dagegen, dass die Ausnahme unbemerkt ihren Anlass verliert"

key-files:
  created:
    - scripts/verify-theme-gen.mjs
  modified:
    - assets/theme.css
    - scripts/build-light-overrides.mjs
    - src/components/pilot/PilotPage.astro
    - src/components/account/ProfileCard.astro
    - package.json
    - Dockerfile
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/WINDOWS.md

key-decisions:
  - "Zwei echte Bugs in build-light-overrides.mjs behoben statt umgangen (Rule 1): der Task verlangt ausdruecklich, die ECHTEN Generatoren laufen zu lassen — dieser Lauf deckte auf, dass stripTrailingRootRules() einen gueltigen generierten Hellmodus-Block loeschte (PilotPage.astro) und topLevelRules() an einem Kommentar zerbrach, der ueber CSS-Syntax redet (ArmorSets.astro). Beide Fixes sind minimal (Kommentare/Randfall ueberspringen), aendern keine Ableitungsregel."
  - "Ein Schutz ergaenzt (Rule 2): keine automatische Hell-Entsprechung mehr fuer einen Selektor, der bereits eine handgeschriebene ':root[data-theme=light] <sel>'-Regel im selben <style>-Block traegt. Ohne den Schutz haette der reparierte Generator kuratierte Werte (ArmorSets --rar-*, PilotPage .pp-badge--verified, ProfileCard .rsi-verified-badge/.vp-copy*) per Quellreihenfolge stillschweigend ueberschrieben — eine 'zweite Wahrheit', die die betroffenen Quellkommentare bereits ausdruecklich vermeiden wollten."
  - "ShipsOverview.astro's fehlende Hell-Entsprechung fuer .fcard__status.fr NICHT nachgezogen: es ist eine echte, aber vorbestehende Luecke (Phase 6/7), keine Handaenderung an einem bestehenden Block. THEME-02 prueft 'wird ein erzeugter Block von Hand veraendert', nicht Vollstaendigkeit. Eine neue Hellmodus-Farbe ist eine sichtbare Aenderung und verdient eine eigene Sichtpruefung — als benannte EXCLUSIONS-Ausnahme (mit Zombie-Waechter) gehalten und als offener Punkt an WINDOWS.md uebergeben, statt sie stillschweigend in diesem Waechter-Plan mitzuziehen."
  - "assets/theme.css NICHT unter die Generator-Glob gebracht: eine echte Verhaltensaenderung an npm run theme, ausdruecklich nicht Gegenstand dieser Phase (04-RESEARCH.md Annahme A2). Stattdessen die Kopfangabe richtiggestellt (Marke HANDGEPFLEGT) und der Waechter benennt die Datei ausdruecklich als Luecke."
  - "Die <human-check>-Sichtprobe aus Task 3 (79-Item-Beschreibungsluecke, Hellmodus-Palette der Startseite) wurde bewusst NICHT vom Executor durchgefuehrt — dieselbe Praezedenz wie Phasen 1.2/2/3: braucht menschliches Urteil im Browser, als WINDOWS.md-Eintrag (id 8) an den Betreiber zurueckgegeben. Phase 4 bleibt deshalb 'In Progress', nicht 'Complete'."

requirements-completed: [SYNC-01, THEME-02]

coverage:
  - id: D1
    description: "verify-theme-gen.mjs fuehrt die drei echten npm-run-theme-Generatoren gegen eine Ablagekopie unter os.tmpdir() aus und meldet 0 unerklaerte Abweichungen der erzeugten Bloecke A/B gegen den Bestand"
    requirement: "THEME-02"
    verification:
      - kind: integration
        ref: "node scripts/verify-theme-gen.mjs — 230 Dateien, 80 mit erzeugten Bloecken, 0 unerklaerte Abweichungen, Arbeitsbaum danach leer, Zombie-Waechter gruen"
        status: pass
      - kind: integration
        ref: "Negativkontrolle: --bg in einem Block A von Hand auf #ff0000 geaendert -> Exit 1, Meldung nennt Datei+Block+erste abweichende Zeile; git checkout -- danach git status leer"
        status: pass
      - kind: unit
        ref: "node -e Probelauf build-light-palettes.mjs --dry -- 64 Dateien, alle unter src/"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zwei vorbestehende Bugs in build-light-overrides.mjs behoben (stripTrailingRootRules loeschte einen gueltigen Block, topLevelRules zerbrach an einem Kommentar), plus Schutz gegen doppelte Wahrheiten; PilotPage.astro/ProfileCard.astro von den dadurch entstandenen stale Duplikaten bereinigt"
    verification:
      - kind: integration
        ref: "Scratch-Pipeline (copy-src.mjs -> alle drei Generatoren -> test-theme-diff.mjs) vor/nach dem Fix: 3 echte Abweichungen -> 0; git status -- src/ assets/ nach jedem Testlauf leer"
        status: pass
    human_judgment: false
  - id: D3
    description: "assets/theme.css Kopfkommentar richtiggestellt (Marke HANDGEPFLEGT), kein CSS-Wert veraendert"
    requirement: "THEME-02"
    verification:
      - kind: unit
        ref: "node -e Kopf-Check aus 04-03-PLAN.md Task 2 <verify> — HANDGEPFLEGT vorhanden, Suchbereich src/** genannt"
        status: pass
      - kind: unit
        ref: "node -e Hellmodus-Bloecke unveraendert vorhanden: 7"
        status: pass
    human_judgment: false
  - id: D4
    description: "verify:sync und verify:theme haengen blockierend in der Dockerfile-RUN-Kette; alle neun Tore laufen auf dem committeten Stand gruen"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "node -e Kettenpruefung — beide Tore stehen in derselben RUN-Zeile hinter verify:layers"
        status: pass
      - kind: integration
        ref: "Nachweislauf: test:e2e 234/234, _verify 813441 Verweise, verify:vendor, audit:csp 10/10, verify:crafting, verify:typo 6/6, verify:layers 6/6, verify:sync (8678 Paare, 0 Rest), verify:theme (0 Abweichungen)"
        status: pass
    human_judgment: false
  - id: D5
    description: "<human-check>-Sichtprobe (79-Item-Beschreibungsluecke, Hellmodus-Palette Startseite, DE+EN, beide Farbmodi)"
    human_judgment: true
    rationale: "Braucht ein menschliches Urteil im Browser ('sieht die Karte angebrochen aus?', 'ist die Palette unveraendert?'); kein Skript kann das entscheiden. Als WINDOWS.md id 8 an den Betreiber zurueckgegeben, Phase 4 bleibt bis dahin 'In Progress'."

duration: 65min
completed: 2026-08-09
status: complete
---

# Phase 4 Plan 3: THEME-02-Waechter, Herkunftsangabe richtiggestellt, beide Tore scharf Summary

**`npm run verify:theme` laesst die drei echten `npm run theme`-Generatoren gegen eine Ablagekopie unter `os.tmpdir()` laufen und meldet 0 unerklaerte Abweichungen — der vorgeschriebene ECHTE Lauf deckte dabei zwei vorbestehende Bugs in `build-light-overrides.mjs` auf (behoben), und beide neuen Tore (`verify:sync`, `verify:theme`) haengen jetzt blockierend in der Dockerfile-Kette.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-08-09T00:58:00Z
- **Completed:** 2026-08-09T01:46:16Z
- **Tasks:** 3/3 completed
- **Files modified:** 9

## Accomplishments

- **THEME-02-Waechter gebaut** (`scripts/verify-theme-gen.mjs`, `npm run verify:theme`): kopiert alle 230
  `.astro`-Dateien unter `src/` nach `os.tmpdir()`, fuehrt dort die drei echten Generatoren
  (`build-light-palettes.mjs`, `tokenize-theme-colors.mjs`, `build-light-overrides.mjs`) in der Reihenfolge
  von `npm run theme` aus und vergleicht die erzeugten Bloecke A (Hellmodus-Palette) und B
  (Hell-Entsprechungen) normalisiert gegen den Bestand. Der Kopf traegt die Pflicht-Abdeckungserklaerung:
  deckt Bloecke A/B ueber `src/**` ab, NICHT `assets/theme.css` (kein Generator fasst die Datei an), und
  meldet den `tokenize-theme-colors`-Rest (4 Deklarationen/3 Dateien, `SiteNav.astro`) informativ bei jedem
  Lauf frisch gemessen statt eingefroren.
- **Zwei echte, vorbestehende Bugs in `build-light-overrides.mjs` gefunden und behoben** — der vom Task
  vorgeschriebene ECHTE Lauf (nicht simuliert) deckte sie auf:
  - `stripTrailingRootRules()` loeschte den GUELTIGEN generierten hellen Zwilling, wenn ein `<style>`-Block
    NUR aus der dunklen Palette plus ihrem hellen Zwilling bestand (`src/components/pilot/PilotPage.astro`,
    dessen Paletten-`<style>` von seinem restlichen Seiten-CSS getrennt ist). Guard ergaenzt: eine Zeile
    unmittelbar nach der Hellmodus-Marke ist die JETZIGE Palette, kein Rueckstand eines kaputten Laufs.
  - `topLevelRules()` zaehlte Klammern INNERHALB von Kommentaren mit — der Quellkommentar in
    `src/components/ArmorSets.astro` redet woertlich ueber CSS-Syntax (`":root{}"-Block"` als Prosa), dessen
    Klammernpaar riss die naechste echte Regel (`.dp {...}`) mitten entzwei. Kommentare werden jetzt als
    undurchsichtige Spannen uebersprungen (Fix in beiden betroffenen Scan-Schleifen).
  - Zusaetzlicher Schutz (Rule 2): keine automatische Hell-Entsprechung mehr fuer einen Selektor, der
    bereits eine handgeschriebene `:root[data-theme='light'] <sel>`-Regel im selben `<style>`-Block traegt.
    Ohne den Schutz haette der reparierte Generator kuratierte Werte still ueberschrieben — genau die
    "zweite Wahrheit", die `ArmorSets.astro`s eigener Kommentar bereits ausdruecklich vermeiden wollte.
- **Zwei Dateien bereinigt** (Folge der Bugfixes): `PilotPage.astro` (zwei stale Duplikat-Zeilen fuer
  `.pp-badge--verified`/`.pp-badge--verified svg` entfernt — die generierten Werte hatten die
  handgeschriebenen `#15803d` bisher per Quellreihenfolge zu `#046a34` uebersteuert) und `ProfileCard.astro`
  (der komplette, nun redundante Hell-Entsprechungen-Block entfernt — alle drei Selektoren
  `.rsi-verified-badge`/`.vp-copy__done`/`.vp-copy.copied` hatten bereits handgeschriebene Gegenstuecke).
  Kein CSS-WERT wurde neu erfunden, nur die stille Doppelfuehrung entfernt.
- **Eine benannte, begruendete Ausnahme** (`EXCLUSIONS` in `verify-theme-gen.mjs`, Vorbild
  `scripts/lib/sync-exclusions.mjs`, mit Zombie-Waechter): `ShipsOverview.astro` definiert
  `.fcard__status.fr{color:#5ad19a}` ("Flight Ready"-Marke aus Phase 6/7) ohne je durch
  `build-light-overrides.mjs` gelaufen zu sein — eine echte, aber VORBESTEHENDE Luecke, keine
  Handaenderung an einem bestehenden Block. Nicht stillschweigend nachgezogen (eine neue Hellmodus-Farbe
  ist eine sichtbare Aenderung und verdient eine eigene Sichtpruefung), sondern als offener Punkt an
  `.planning/WINDOWS.md` (id 7) uebergeben.
- **Negativkontrolle ausgefuehrt und bestanden**: `--bg` in einem Block A (`src/pages/index.astro`) von
  Hand auf `#ff0000` geaendert — `node scripts/verify-theme-gen.mjs` meldet Exit 1, nennt Datei, Blockart
  und die erste abweichende Zeile beider Seiten; `git checkout --` stellt den sauberen Stand wieder her
  (`git status --porcelain` danach leer).
- **`assets/theme.css`s falsche Herkunftsangabe richtiggestellt** (Task 2): der Kopfkommentar behauptete,
  der `:root[data-theme="light"]`-Block sei "Erzeugt von scripts/build-light-palettes.mjs" — falsch, kein
  Generator fasst die Datei an (04-RESEARCH.md Fund 2). Kopf traegt jetzt die Marke HANDGEPFLEGT, nennt den
  tatsaechlichen Suchbereich der Generatoren (`src/**`) und haelt fest, dass `npm run verify:theme` diesen
  Block nicht abdeckt. Kein CSS-Wert geaendert (7 Hellmodus-Bloecke unveraendert vorhanden). Die
  Generator-Glob wurde bewusst NICHT erweitert (04-RESEARCH.md Annahme A2, offene Frage 2).
- **Beide Tore scharf geschaltet** (Task 3): `Dockerfile` haengt `verify:sync` und `verify:theme` an die
  bestehende `RUN`-Kette, hinter `verify:layers`, mit Begruendung im Erklaerungsblock (derselbe Ausfallmodus
  wie `verify:typo`/`verify:layers` — eine Abweichung bricht nichts Sichtbares). Nachweislauf: alle neun
  Tore auf dem committeten Stand gruen (siehe Task Commits unten fuer die Zahlen). Ab jetzt entsteht kein
  Auslieferungsimage mehr bei gerissener Sprachparitaet oder einem handgeaenderten Hellmodus-Block.
- **REQUIREMENTS.md**: SYNC-01, SYNC-02, THEME-02 auf Complete, je mit dem TOR benannt statt der Absicht
  (SYNC-01 ist eine Arbeitsdisziplin, ihr Nachweis ist ausdruecklich der blockierende Rueckhalt).
  **ROADMAP.md**: Phase 4 mit drei ausgefuehrten Plaenen (Status bleibt "In Progress", siehe unten).

## Task Commits

1. **Task 1: Der THEME-02-Waechter — die echten Generatoren gegen eine Ablagekopie, normalisiert verglichen** - `b140b18` (feat)
2. **Task 2: Die Herkunftsangabe in assets/theme.css richtigstellen** - `0f5d46f` (docs)
3. **Task 3: Beide Tore scharf schalten und die Phase bilanzieren** - `61462e1` (feat)

**Plan metadata:** siehe Abschluss-Commit dieses SUMMARY.

## Files Created/Modified

- `scripts/verify-theme-gen.mjs` - NEU: THEME-02-Waechter, Ablagekopie + normalisierter Vergleich + EXCLUSIONS + Zombie-Waechter
- `scripts/build-light-overrides.mjs` - zwei Bugfixes (`stripTrailingRootRules`, `topLevelRules`) plus Schutz gegen doppelte Wahrheiten
- `src/components/pilot/PilotPage.astro` - stale Duplikat-Farben aus dem generierten Block entfernt
- `src/components/account/ProfileCard.astro` - redundanten generierten Block vollstaendig entfernt
- `assets/theme.css` - Kopfkommentar richtiggestellt, Marke HANDGEPFLEGT
- `package.json` - neuer Eintrag `verify:theme`
- `Dockerfile` - `verify:sync` und `verify:theme` an die RUN-Kette angehaengt
- `.planning/REQUIREMENTS.md` - SYNC-01, SYNC-02, THEME-02 auf Complete
- `.planning/ROADMAP.md` - Phase 4 mit drei ausgefuehrten Plaenen
- `.planning/WINDOWS.md` - zwei neue Eintraege (ShipsOverview-Luecke, ausstehende Sichtprobe)

## Decisions Made

- **Zwei echte Generator-Bugs behoben statt umgangen** (Rule 1): der Task verlangt ausdruecklich den
  ECHTEN Lauf; eine Ausnahme fuer die dadurch sichtbaren Bugs waere ein Waechter gewesen, der eine bekannte
  Fehlfunktion des zu pruefenden Werkzeugs wegdefiniert statt sie zu beheben.
- **Schutz gegen doppelte Wahrheiten ergaenzt** (Rule 2): eine Korrektheits-/Datenintegritaetsluecke, die
  kuratierte Farbwerte per Quellreihenfolge stillschweigend ueberschrieben haette.
- **ShipsOverview.astro's Luecke NICHT nachgezogen**: echte, aber vorbestehende Abdeckungsluecke aus einer
  frueheren Phase, keine Handaenderung — als benannte Ausnahme gehalten und an WINDOWS.md uebergeben statt
  unangekuendigt eine neue, sichtbare Hellmodus-Farbe einzufuehren.
- **Generator-Glob nicht erweitert**: `assets/theme.css` bleibt bewusst ausserhalb des automatisierten
  Suchbereichs (04-RESEARCH.md Annahme A2) — nur die Kopfangabe wurde korrigiert.
- **Sichtprobe an den Betreiber zurueckgegeben**: dieselbe Praezedenz wie Phasen 1.2/2/3 — Phase 4 bleibt
  "In Progress", nicht "Complete", bis die `<human-check>`-Sichtprobe erfolgt ist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `stripTrailingRootRules()` loeschte einen gueltigen generierten Hellmodus-Block**
- **Found during:** Task 1 (vorgeschriebener echter Lauf der drei Generatoren gegen die Ablagekopie)
- **Issue:** Besteht ein `<style>`-Block NUR aus der dunklen Palette plus dem generierten hellen Zwilling
  (kein weiterer Selektor danach), behandelte die Selbstheilungs-Funktion die letzte Zeile (den gueltigen
  hellen Zwilling) als vermeintlichen Rueckstand eines fruehen kaputten Laufs und loeschte sie, ohne sie
  neu zu erzeugen — gefunden an `src/components/pilot/PilotPage.astro`.
- **Fix:** Guard ergaenzt: eine `:root[...]`-Zeile, die UNMITTELBAR der aktuellen Hellmodus-Marke folgt,
  wird nicht mehr als Rueckstand behandelt.
- **Files modified:** `scripts/build-light-overrides.mjs`
- **Verification:** Scratch-Pipeline vor/nach dem Fix — `PilotPage.astro`s Block A stimmt danach mit dem
  Bestand ueberein (vorher fehlte die Regel komplett, nur der Kommentar blieb).
- **Committed in:** `b140b18` (Task 1 commit)

**2. [Rule 1 - Bug] `topLevelRules()` zaehlte Klammern innerhalb von Kommentaren mit**
- **Found during:** Task 1 (derselbe echte Lauf)
- **Issue:** Ein Kommentar, der ueber CSS-Syntax redet (`src/components/ArmorSets.astro`: `"Bewusst NICHT
  in einem :root{}-Block: ..."`), enthielt literale `{`/`}`-Zeichen als Prosa. Der zeichenweise
  Tiefenzaehler kannte keine Kommentare und schloss/oeffnete an diesen Zeichen, wodurch die naechste echte
  Regel (`.dp {...}`) mitten entzwei riss — die "Selektor"-Zeile der Folgeregel bestand danach aus
  Kommentarresten statt aus `.dp`.
- **Fix:** Kommentare werden in beiden Scan-Schleifen (Selektor-Suche UND Body-Klammerabgleich) als
  undurchsichtige Spannen uebersprungen, bevor ihre Zeichen die Tiefe beeinflussen.
- **Files modified:** `scripts/build-light-overrides.mjs`
- **Verification:** Scratch-Pipeline vor/nach dem Fix — `ArmorSets.astro` erscheint danach in keiner
  Abweichungsliste mehr (vorher garbled Selektor-Text im generierten Ausgang).
- **Committed in:** `b140b18` (Task 1 commit)

**3. [Rule 2 - Missing Critical] Schutz gegen doppelte, widerspruechliche Hell-Entsprechungen**
- **Found during:** Task 1, nach Behebung der beiden obigen Bugs — der reparierte Generator wollte fuer
  `.dp` (ArmorSets), `.pp-badge--verified` (PilotPage) und `.rsi-verified-badge`/`.vp-copy*` (ProfileCard)
  jeweils eine ZWEITE, automatisch aus `paperVersion()` abgeleitete Hell-Entsprechung anhaengen, obwohl
  bereits eine handgeschriebene `:root[data-theme='light'] <sel>`-Regel existierte. Die generierte Regel
  haette per Quellreihenfolge (gleiche Spezifitaet, spaeter im Dokument) gewonnen und den kuratierten Wert
  stillschweigend ueberschrieben — bei PilotPage.astro war das bereits VOR diesem Fix der Fall
  (`.pp-badge--verified` zeigte `#046a34` statt des beabsichtigten `#15803d`).
- **Fix:** Vor der Regelerzeugung wird je `<style>`-Block die Menge bereits vorhandener
  `:root[data-theme='light'] <sel>`-Selektoren erhoben; ein Treffer ueberspringt die automatische Erzeugung
  fuer diesen Selektor.
- **Files modified:** `scripts/build-light-overrides.mjs`; Folgeaenderung an `src/components/pilot/PilotPage.astro`
  (zwei stale Duplikat-Zeilen entfernt) und `src/components/account/ProfileCard.astro` (kompletter,
  jetzt redundanter Block entfernt)
- **Verification:** Scratch-Pipeline nach dem Fix — 0 unerklaerte Abweichungen ueber alle 230 Dateien
  (bis auf die eine benannte ShipsOverview-Ausnahme); `git diff` zeigt fuer beide bereinigten Dateien
  ausschliesslich die entfernten Duplikat-Zeilen, keine sonstige Aenderung.
- **Committed in:** `b140b18` (Task 1 commit)

---

**Total deviations:** 3 (2 Bugfixes, 1 ergaenzter Schutz) — alle in `scripts/build-light-overrides.mjs`,
direkt durch den vom Task vorgeschriebenen echten Generatorlauf entdeckt.
**Impact on plan:** Kein Scope-Creep — alle drei Funde sind eine direkte Konsequenz von Task 1s eigener
Vorgabe ("die echten Generatoren aufrufen, statt ihre Ableitungsregeln nachzubauen"). Keine Ableitungsregel
(Farbmathematik, `LIGHT_RULES`) wurde angefasst; alle Fixes sind Kommentar-/Randfall-Robustheit.

## Known Stubs

Keine — `ShipsOverview.astro`s fehlende Hell-Entsprechung ist keine unfertige Kernfunktion dieses Plans,
sondern eine benannte, begruendete Ausnahme fuer eine vorbestehende Luecke aus einer frueheren Phase (siehe
Decisions Made). Als offener Punkt in `.planning/WINDOWS.md` (id 7) gehalten, nicht als Stub in diesem Plan.

## Issues Encountered

**Selbstverursachter Zwischenfall, aufgetreten und behoben waehrend der Untersuchung dieser Bugs:** ein
Test-Kommando (`node scripts/build-light-palettes.mjs --cwd`) lief versehentlich ohne `--dry`/`--only` und
ohne umgelenktes Arbeitsverzeichnis gegen den ECHTEN Arbeitsbaum, wodurch 64 `.astro`-Dateien um je eine
Leerzeile veraendert wurden (dieselbe, in 04-RESEARCH.md dokumentierte Whitespace-Nichtidempotenz). Sofort
bemerkt (git status vor dem naechsten Schritt geprueft), vollstaendig per `git checkout --` auf die exakte
Dateiliste zurueckgesetzt und durch einen erneuten `git status --porcelain`-Leerlauf bestaetigt, bevor
weitergearbeitet wurde. Kein Restschaden; Anlass fuer die im Skript selbst verankerte Regel, Generatoren
ausschliesslich per `execFileSync` mit explizit gesetztem `cwd` aufzurufen, nie ueber ein bare CLI-Kommando.

## User Setup Required

None - keine externe Dienstkonfiguration noetig.

## Next Phase Readiness

Alle drei Erfolgskriterien der Roadmap sind maschinell belegt: `npm run verify:sync` und `npm run
verify:theme` laufen wiederholbar, schlagen bei echter Drift nachweislich fehl (beide Negativkontrollen
ausgefuehrt und bestanden — `verify:sync` in Plan 01, `verify:theme` in diesem Plan), und beide haengen
jetzt blockierend im Dockerfile. Phase 4 ist damit technisch fertig (3/3 Plaene), bleibt aber "In Progress"
bis die `<human-check>`-Sichtprobe aus Task 3 (WINDOWS.md id 8) durchgefuehrt ist — dieselbe Praezedenz wie
bei den Phasen 1.2, 2 und 3. Kein Blocker fuer nachfolgende Phasen.

---
*Phase: 04-sprachparitaet-absichern*
*Completed: 2026-08-09*

## Self-Check: PASSED

- FOUND: `scripts/verify-theme-gen.mjs`
- FOUND: `assets/theme.css`
- FOUND: `scripts/build-light-overrides.mjs`
- FOUND: `src/components/pilot/PilotPage.astro`
- FOUND: `src/components/account/ProfileCard.astro`
- FOUND: `Dockerfile`
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: `.planning/ROADMAP.md`
- FOUND: `.planning/WINDOWS.md`
- FOUND commit: `b140b18` (feat(04-03): verify:theme-gen — THEME-02-Waechter gegen Ablagekopie, zwei echte Generator-Bugs behoben)
- FOUND commit: `0f5d46f` (docs(04-03): assets/theme.css — Herkunftsangabe des Hellmodus-Blocks richtiggestellt)
- FOUND commit: `61462e1` (feat(04-03): verify:sync und verify:theme scharf geschaltet — D-03 vollzogen)
