---
phase: 05-bauteil-kennwerte-auf-den-crafting-karten
verified: 2026-08-07T01:20:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 5: Bauteil-Kennwerte auf den Crafting-Karten — Verifikationsbericht

**Phasenziel:** Wer die Crafting-Datenbank durchblättert, erkennt auf der Karte selbst,
womit er es zu tun hat — Größe, Grade und Ton stehen dort, statt erst nach einem Klick
in der Detailansicht aufzutauchen. Was die Karte zeigt, stimmt mit dem Spiel überein;
wo eine Angabe fehlt, bleibt die Stelle leer statt geraten.
**Verifiziert:** 2026-08-07
**Status:** passed
**Re-Verifikation:** Nein — Erstverifikation

Alle folgenden Nachweise wurden selbst ausgeführt (nicht aus den SUMMARY.md-Dateien
übernommen): `npm run build`, `node --test tests/e2e/crafting-specs.test.js`,
`npm run verify:crafting`, `npm run audit:site`, `npm run verify`, direkte
Byte-/Gzip-Messungen und Grep-Auszählungen gegen das frisch gebaute `dist/`.

## Zielerreichung

### Beobachtbare Wahrheiten (7 Erfolgskriterien aus ROADMAP.md)

| # | Kriterium | Status | Beleg |
|---|---|---|---|
| 1 | Größe und Grade auf jeder Blueprint-Karte, für die es die Angabe gibt (~98 % bei Vehiclegear) | ✓ VERIFIED | `class="cbp__spec"` = 1514 in beiden Sprachseiten; `npm run verify:crafting` Block 8: Größe 1513, Grade 1513, Selbstkonsistenz 1514+80=1594 hält. Block 6: Powerplant 71/75, Cooler 71/75, Shield 62/62, Radar 55/60, Quantumdrive 57/57 — durchgehend im ~95-98 %-Bereich, exakt den Zielzahlen der Erkundung entsprechend |
| 2 | Ton auf allen tonführenden Bauteil-Karten; Schiffswaffen aus dem Kategorie-Pfad statt `game.class` | ✓ VERIFIED | `class="tone"` = 496 in beiden Sprachseiten (400 aus `game.class` + 96 aus Pfad, Block 8/9). `toneFromWeaponCategoryPath()` in `src/lib/crafting.ts:258-262` liest explizit das 3. Kategoriesegment nach `Vehiclegear/Weapons`; Block 7: 96/96 Schiffswaffen, 0 Abweichungen. Stichprobe `AD4B Ballistic Gatling` → Ton „Ballistic" bei leerem `game.class`, in dist/ bestätigt |
| 3 | Kein leerer/geratener Chip bei fehlender Angabe, insbesondere Armour und Ammo | ✓ VERIFIED | `blueprintSpecs()` (`src/lib/crafting.ts:271-282`) gibt `null` zurück, wenn size/grade/tone alle `null` sind — kein Chip wird ohne Wert gerendert. Block 5: 913 Armour-Blueprints geprüft, 0 mit Ton. Eigene Stichprobe: keine der 10 kollidierenden Karten trägt irgendeinen Chip (siehe #4) |
| 4 | Die 15 gleichnamigen Blueprints einzeln geprüft; keiner zeigt fremde Werte | ✓ VERIFIED | `COLLIDING_NAMES` in `src/lib/crafting.ts:224-239` datengetrieben (Vergleich des gesamten `item_stats`-Objekts); `grep -ci "main powerplant" src/lib/crafting.ts` = 0, keine Handliste irgendwo im Repo gefunden. Eigene Extraktion aus `dist/topics/crafting.html` UND `dist/de/topics/crafting.html`: alle 10 Karten der 5 gesperrten Gruppen (`antium core jet` ×2, `broadspec` ×2, `main powerplant` ×2, `serac` ×2, `stellate` ×2) ohne `cbp__spec`; Gegenprobe `BroadSpec-Go`/`BroadSpec-Max` (eigenständige Namen) tragen ihre Chips normal |
| 5 | DE und EN gleichermaßen, ein Körper | ✓ VERIFIED | `src/pages/topics/crafting.astro` und `src/pages/de/topics/crafting.astro` sind je 15-Zeilen-Hüllen, beide rendern `<CraftingApp lang={...} />` aus derselben `src/components/CraftingApp.astro`. Zählwerte in beiden gebauten Seiten identisch: 1514/1514 Chip-Reihen, 496/496 Ton-Chips, 8/8 `cdb-size`, 4/4 `cdb-grade` |
| 6 | Größe und Grade filterbar, nicht nur sichtbar | ✓ VERIFIED | `.cdb-fgroup`-Blöcke mit `cdb-size`(×8)/`cdb-grade`(×4)-Checkboxen in `CraftingApp.astro:321-339`, datengetrieben aus `sizeCounts`/`gradeCounts`. `assets/crafting-app.js` hebt die Chip-Werte im `cards.forEach`-Block ins Dataset (Zeile 102-114) und wertet `state.sizes`/`state.grades` in `matches()` aus (Zeile 540-543). e2e-Test bestätigt 8/4 Checkboxen mit den korrekten Werten in beiden Sprachen |
| 7 | Statisch ausgeliefert, kein nennenswerter Seitengewichtszuwachs | ✓ VERIFIED | Eigene Messung: EN roh 835973→934893 (+98920 B), gzip 65614→69851 (+4237 B); DE roh 835024→933947 (+98923 B), gzip 65940→70150 (+4210 B). Beide unter dem selbstgesetzten Deckel (<112640 B roh, <15360 B gzip) |

**Score:** 7/7 Kriterien verifiziert

### Automatisierte Nachweise — selbst ausgeführt

| Prüfung | Kommando | Ergebnis |
|---|---|---|
| Build | `npm run build` | Exit 0, 17365 Seiten |
| e2e-Test | `node --test tests/e2e/crafting-specs.test.js` | Exit 0, **45/45 pass** (4 Suiten) |
| Datengatter | `npm run verify:crafting` | Exit 0, alle 9 Prüfblöcke unauffällig |
| Site-Audit | `npm run audit:site` | Exit 0, 0 FEHLER, 4 vorbestehende A11y-Warnungen (Account/Pilot-Seiten, nicht phasenbezogen) |
| Referenz-Integrität | `npm run verify` | Exit 0, 816195 lokale Referenzen aufgelöst |
| Provenienz-Check | `grep -io "data\.p4k\|datacore\|scmdb\|datamined" dist/topics/crafting.html dist/de/topics/crafting.html` | 0 Treffer in beiden Dateien |

### Zähl-Gegenprobe (unabhängig aus `dist/` extrahiert)

| Kennzahl | EN | DE | Ziel |
|---|---|---|---|
| `class="cbp"` (Karten gesamt) | 1594 | — | 1594 |
| `class="cbp__spec"` (Chip-Reihen) | 1514 | 1514 | 1514 |
| `class="tone"` (Ton-Chips) | 496 | 496 | 496 |
| 1514 + 80 (ohne Angabe) | 1594 | 1594 | 1594 ✓ hält |
| `class="cdb-size"` | 8 | 8 | 8 |
| `class="cdb-grade"` | 4 | 4 | 4 |

### Kollisionssperre — eigene Extraktion aus dist/

Direkt aus `dist/topics/crafting.html` und `dist/de/topics/crafting.html` per Skript
extrahiert (Kartenname → Vorhandensein von `cbp__spec`), unabhängig vom Test-Code:

| Karte | EN chiplos | DE chiplos |
|---|---|---|
| Antium Core Jet (×2) | ja/ja | ja/ja |
| BroadSpec (×2) | ja/ja | ja/ja |
| Main Powerplant (×2) | ja/ja | ja/ja |
| Serac (×2) | ja/ja | ja/ja |
| Stellate (×2) | ja/ja | ja/ja |
| BroadSpec-Go (Gegenprobe) | trägt Chips | trägt Chips |
| BroadSpec-Max (Gegenprobe) | trägt Chips | trägt Chips |

Alle 10 Karten der 5 gesperrten Namensgruppen sind in beiden Sprachfassungen
tatsächlich chiplos; die abgrenzenden, nur namensähnlichen Blueprints (`BroadSpec-Go`,
`BroadSpec-Max`) tragen ihre Chips normal. Deckt sich mit dem 05-03-Sichtprüfungsbefund.

### Datengrundlage der Sperre — kein Handeintrag

- `grep -ci "main powerplant" src/lib/crafting.ts` → **0**
- `grep -rn "main powerplant|antium core jet|stellate|serac|broadspec" src/ scripts/ assets/` (außer Test/COLLIDING_NAMES-Kommentar) → **0 Treffer**
- `COLLIDING_NAMES` (`src/lib/crafting.ts:224-239`) wird bei jedem Build aus `item_stats`-Signaturen (`stableStringify`, schlüsselsortiert, rekursiv) abgeleitet — kein Name steht hart im Code

### Mirror-Konsistenz `scripts/verify-crafting-specs.mjs` ↔ `src/lib/crafting.ts`

Gelesen und zeilenweise verglichen: `blueprintSpecs()`, `COLLIDING_NAMES`,
`toneFromWeaponCategoryPath()`, `stableStringify()` sowie die gespiegelte
`hasGradeSemantics()` (aus `src/lib/items.ts:363-365`) sind in beiden Dateien
identisch. Der Spiegel-Grund (Node kann `.ts`-Dateien mit extensionlosen relativen
Importen nicht direkt laden) ist im Skriptkopf dokumentiert — bewusster, begründeter
Workaround, keine stillschweigende Kopie.

### Erforderliche Artefakte

| Artefakt | Erwartet | Status | Details |
|---|---|---|---|
| `src/lib/crafting.ts` (`blueprintSpecs`, `COLLIDING_NAMES`, `toneFromWeaponCategoryPath`) | Einzige Datenquelle für Größe/Grade/Ton | ✓ VERIFIED | Gelesen, Logik nachvollzogen, im Gatter gespiegelt und übereinstimmend |
| `src/components/CraftingApp.astro` (Chip-Markup + Filtergruppen) | Ein Körper für DE+EN | ✓ VERIFIED | `ul.cbp__spec`, `.cdb-fgroup`(Größe/Grade), aus `cardsData`/`blueprintSpecs()` gerendert |
| `assets/crafting-app.js` (Filter-Hydration) | Chip-Werte ins Dataset heben, Filterlogik | ✓ VERIFIED | Codepfad im `cards.forEach`-Block bestätigt, `state.sizes`/`state.grades` in `matches()` |
| `tests/e2e/crafting-specs.test.js` | Dist-Nachweis | ✓ VERIFIED | 45/45 Tests laufen tatsächlich gegen `dist/`, nicht nur behauptet |
| `scripts/verify-crafting-specs.mjs` | Dauergatter | ✓ VERIFIED | Exit 0, 9 Prüfblöcke, dokumentierter Spiegel-Workaround |

### Wirkverbindungen (Key Links)

| Von | Nach | Über | Status |
|---|---|---|---|
| `src/lib/crafting.ts:blueprintSpecs()` | `src/components/CraftingApp.astro:cardsData` | direkter Funktionsaufruf (`sp`-Feld) | WIRED |
| `cardsData` (Astro, Server) | HTML-Markup `ul.cbp__spec` | Template-Rendering | WIRED |
| gebautes HTML (`cbp__spec`-Chips) | `assets/crafting-app.js` (`state.sizes/grades`) | DOM-Auslesen im `cards.forEach` vor dem DB-Fetch | WIRED |
| `state.sizes/state.grades` | `matches()`-Filterlogik | Objektabgleich | WIRED |
| `src/pages/topics/crafting.astro` + `src/pages/de/topics/crafting.astro` | `src/components/CraftingApp.astro` | `<CraftingApp lang={...}/>`, identischer Import | WIRED |

### Nebenwirkungen auf angrenzende Renderer — geprüft, nichts gebrochen

- `dist/crafting.html` (CraftingHub, EN) und `dist/de/crafting.html` (DE) bauen und sind
  substantiell (22720 / 23033 Byte) — kein leerer Stub.
- `dist/crafting/main-powerplant.html` (BlueprintDetail einer gesperrten Namensgruppe)
  baut mit 19485 Byte — kollisionsbetroffene Items brechen die Detailseite nicht.
- Gesamtbuild: 17365 Seiten, Exit 0; `npm run verify` bestätigt 816195 aufgelöste
  Referenzen — keine toten Links durch die neuen Chip-/Filter-Markup-Änderungen.
- Diff-Stat der gesamten Phase (`git diff --stat bf51077..HEAD`) zeigt ausschließlich
  die erwarteten Dateien (`src/lib/crafting.ts`, `src/components/CraftingApp.astro`,
  `assets/crafting-app.js`, `scripts/verify-crafting-specs.mjs`,
  `tests/e2e/crafting-specs.test.js`, `package.json`, Planungsdokumente) — kein
  Übergriff auf `src/components/CraftingListing.astro`, `BlueprintDetail.astro`,
  `CraftingHub.astro` oder den Item Finder (Scope-Fence eingehalten).

### Requirements Coverage

| Requirement | Quelle | Beschreibung | Status | Beleg |
|---|---|---|---|---|
| CRAFT-01 | 05-01, 05-02 | Größe/Grade auf jeder Karte mit Angabe | ✓ SATISFIED | siehe Kriterium 1 |
| CRAFT-02 | 05-01, 05-02 | Ton, Schiffswaffen aus Kategorie-Pfad | ✓ SATISFIED | siehe Kriterium 2 |
| CRAFT-03 | 05-01, 05-02 | Kein geratener/leerer Chip, 15 Dubletten geprüft | ✓ SATISFIED | siehe Kriterien 3+4 |
| CRAFT-04 | 05-03 | Größe/Grade filterbar | ✓ SATISFIED | siehe Kriterium 6 |

Keine verwaisten Requirements — REQUIREMENTS.md führt für Phase 5 exakt CRAFT-01..04,
alle vier in mindestens einem Plan referenziert.

### Anti-Pattern-Scan

Geprüfte Dateien: `src/lib/crafting.ts`, `src/components/CraftingApp.astro`,
`assets/crafting-app.js`, `scripts/verify-crafting-specs.mjs`,
`tests/e2e/crafting-specs.test.js`.

Keine Treffer für `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` oder Platzhaltertext. Die
einzigen `placeholder`-Treffer sind legitime HTML-`placeholder`-Attribute an
Suchfeldern (`cdb-search`, `cdb-res-search`), unabhängig von dieser Phase.

### Befund außerhalb der 7 Erfolgskriterien (worth flagging)

**`npm run verify:crafting` läuft in keinem routinemäßigen Schritt.** Weder
`npm run build`, `npm run verify`, `npm run audit:site` noch der einzige
GitHub-Workflow (`.github/workflows/build.yml`, ruft nur `npm run build` und
`node scripts/_verify.mjs` auf) führen das Datengatter aus. `grep -rn
"verify:crafting"` außerhalb der `.planning/`-Dokumente findet nur den
`package.json`-Skripteintrag selbst. Das Dauergatter ist damit technisch vorhanden
und nachweislich scharf (Gegentest belegt Exit 1 bei ausgehängter Sperre), aber
es ist ein Skript, an das sich ein Mensch erinnern muss aufzurufen — keiner der
7 Erfolgskriterien verlangt CI-Einbindung, deshalb ist dies kein Gap gegen das
Phasenziel, aber ein Risiko für künftige, unbemerkte Regressionen (z. B. nach
einem künftigen Datamine-Lauf, der neue Namenskollisionen einführt). Empfehlung:
`verify:crafting` in `npm run verify` oder den Build-Workflow aufnehmen — außerhalb
des Scope dieser Phase, daher hier nur dokumentiert, nicht als Gap gewertet.

### Human Verification Required

Keine offenen Punkte. Die visuelle/Kontrast-Prüfung (Aufgabe 2 aus Plan 05-03,
`checkpoint:human-verify`) wurde bereits während der Ausführung durchgeführt und
mit „CHECKPOINT FREIGEGEBEN" abgeschlossen (DOM- und `getComputedStyle`-Messung
gegen den gebauten `dist/`-Stand dieses Worktrees, da Screenshots in dieser Umgebung
nicht kompositieren). Die dort dokumentierten Werte (Kontrast 13,79/5,71 dunkel,
16,26/7,27 hell — beide über WCAG AA 4,5:1; Filter 1594→32(S4)→0(S4+D)→1594; kein
horizontaler Überlauf bei 360 px) sind plausibel und stehen im Einklang mit den hier
unabhängig nachgerechneten Zählwerten und der CSS-Regel `.cbp__spec li.tone{color:var(--accent-2)...}`.
Keine neue, unbeantwortete visuelle Frage identifiziert.

### Gaps Summary

Keine. Alle 7 Erfolgskriterien der ROADMAP sind durch eigenständig ausgeführte
Build-, Test-, Gatter- und Grep-Nachweise gegen das gebaute `dist/` bestätigt — nicht
nur durch die Zahlen aus den SUMMARY.md-Dateien übernommen. Die einzige nennenswerte
Beobachtung (Datengatter nicht in CI/Build verdrahtet) liegt außerhalb der definierten
Erfolgskriterien und wird als Empfehlung, nicht als Gap, dokumentiert.

---

*Verifiziert: 2026-08-07*
*Verifier: Claude (gsd-verifier)*
