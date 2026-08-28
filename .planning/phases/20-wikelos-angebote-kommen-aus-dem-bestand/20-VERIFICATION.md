---
phase: 20-wikelos-angebote-kommen-aus-dem-bestand
verified: 2026-08-28T12:48:59Z
status: human_needed
score: 4/4 Erfolgskriterien verifiziert (mit einer dokumentierten Robustheitseinschraenkung bei Kriterium 3)
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Register id 55 (D-02) entscheiden: welcher der fuenf/sechs unkuratierten Vertraege (u.a. 'Wikelo Arrive to System') erscheint ueberhaupt als Tauschkarte, und mit welchem Bild/welcher Ausstattung?"
    expected: "Betreiber-Sichturteil am laufenden Spiel, dokumentiert als Nachtrag in assets/wikelo-curated.json und Schliessung von WINDOWS.md id 55"
    why_human: "Kein Skript darf 'echtes Angebot vs. Werkstattrest' entscheiden — von der Sonde bereits ausdruecklich als unaufloesbar markiert"
  - test: "Register id 56 (D-03) entscheiden: welcher ATLS-Farb-/Zusatzauftrag (OrangeNGrey, WhiteNGreen, IKTI vs. IKTI_GEO) traegt welchen Namen und welches Bild?"
    expected: "Betreiber-Sichturteil am laufenden Spiel, dokumentiert als Nachtrag in assets/wikelo-curated.json und Schliessung von WINDOWS.md id 56"
    why_human: "Zuordnungssonde meldet die vier Faelle namentlich als Kollision statt zu raten — genau wie vom Plan verlangt"
  - test: "Register id 57 (unrun-verify) am ausgelieferten staging-Stand pruefen: vier Sichtbloecke (Anzeigenamen, Bild-Platzhalter, Filter-Pillen, berichtigte Quellenangabe), je DE+EN, beide Farbmodi, 1920x1080 UND 1280x720"
    expected: "Karten lesen sich weiterhin als Angebot (nicht als Katalogzeile), Platzhalter-Reihe wirkt nicht als Luecke, Filter-Trefferzahlen stimmen mit der Selbstauskunft ueberein, Quellenangabe liest sich korrekt"
    why_human: "'Liest sich noch als Angebot' und 'wirkt als Luecke' sind visuelle Werturteile, kein Skript kann sie treffen"
  - test: "CR-01 (20-REVIEW.md): Stufe 2 der Zuordnungssonde (scripts/probes/wikelo-kuration-zuordnung.mjs, schluesselAufloesen()) prueft Eindeutigkeit nur PRO SCHLUESSEL, nicht ueber den gesamten Stufenlauf — ein Vertrag mit mehreren Schluesseln (Titel + mehrere Rewardnamen) kann zwei Handeintraegen gleichzeitig zugeordnet werden, ohne als Kollision erkannt zu werden. Im Code unveraendert bestaetigt (Zeilen ~140-152, kein genutzteVertraege/genutzteHandIdx-Tracking)."
    expected: "Entweder den im Review vorgeschlagenen Fix uebernehmen, oder die Einschraenkung bewusst als getrackte Schuld ins Broken-Windows-Register aufnehmen — nicht stillschweigend liegen lassen"
    why_human: "Betrifft die tatsaechliche Korrektheitsgarantie der Zuordnungssonde bei kuenftigen Neu-Laeufen; der HEUTE ausgelieferte Datenstand (59/69-Bijektion, 3 benannte Kollisionen) ist read-only nachgemessen korrekt, das Risiko ist zukuenftig, nicht rueckwirkend"
  - test: "CR-02 (20-REVIEW.md): build-wikelo-trades.mjs uebernimmt contractCount/orderLineCount (Zeilen 98-99) ungeprueft aus dem Selbstauskunfts-Feld game.counts der gitignoreten wikelo-gamefiles.json, statt sie gegen game.contracts (bereits vollstaendig geladen) gegenzurechnen. Genau diese beiden Felder speisen die Sperrklinke aus Erfolgskriterium 3. Im Code unveraendert bestaetigt."
    expected: "Entweder die im Review vorgeschlagene Gegenrechnung (game.contracts.length / Summe der orders.length) einbauen, oder bewusst als getrackte Schuld ins Register aufnehmen"
    why_human: "Die Sperrklinke funktioniert HEUTE nachweislich (rot vorgefuehrt in Plan 03, hier erneut gruen bestaetigt) — aber sie schuetzt nur gegen einen Ruckgang von game.counts, nicht gegen eine Abweichung zwischen game.counts und der tatsaechlich verarbeiteten Vertragsmenge. Ob das als hinreichend gilt oder nachgebessert werden muss, ist eine Risikoabwaegung fuer den Betreiber, keine Ja/Nein-Pruefung"
gaps: []
---

# Phase 20: Wikelos Angebote kommen aus dem Bestand — Verifikationsbericht

**Phase-Ziel:** `scripts/datamine-wikelo.mjs` liest die Tauschangebote aus den Spieldateien — 69 Vertraege, 68 mit vollstaendiger Gegenleistung, 285 Warenposten. Die Seite soll davon lesen statt an der handgepflegten `wikelo-trades.json` zu haengen.
**Verifiziert:** 2026-08-28T12:48:59Z
**Status:** human_needed
**Re-Verifikation:** Nein — Erstverifikation

## Zusammenfassung

Alle vier ROADMAP-Erfolgskriterien sind im Code und an unabhaengig selbst ausgefuehrten Torlaeufen nachweisbar erfuellt — nicht nur behauptet. Die Wikelo-Seite liest Angebote und Mengen tatsaechlich aus dem maschinellen Bestand, behaelt Bilder/Ausstattung/Reputationstext aus der kuratierten Overlay-Datei, Register-Eintrag id 51 ist mit einer beleghaltigen Begruendung geschlossen, zwei Sperrklinken fangen nachweislich einen Rueckgang, und `npm run build && npm run gate` lief in dieser Verifikation selbst zweimal durch (normal und mit `STAGING=1`), beide Male 23/23 gruen.

Der Status ist trotzdem `human_needed`, aus zwei unabhaengigen Gruenden:

1. Die Phase selbst hat bewusst drei Sichtrunden-Punkte offen gelassen (WINDOWS.md id 55, 56, 57) — genau wie in den SUMMARYs dokumentiert, ist Phase 20 „technisch vollstaendig, aber nicht Complete markiert". Das ist kein Verifikationsfehler, sondern korrekt umgesetzte Eskalation von Sichturteilen, die kein Skript treffen darf.
2. `20-REVIEW.md` fuehrt zwei CRITICAL-Befunde (CR-01, CR-02), die im aktuellen Code unveraendert bestaetigt sind (nachgeprueft per Quelltext-Lesen, nicht nur SUMMARY-Zitat) und weder behoben noch im Broken-Windows-Register erfasst wurden. CR-02 betrifft direkt die Datenquelle der Erfolgskriterium-3-Sperrklinke — die Klinke funktioniert nachweislich heute, ihre Grundlage ist aber nicht gegen die tatsaechlich verarbeitete Vertragsmenge abgesichert. Das faellt keinem Torlauf auf, weil `entryCount` und `contractCount` im aktuellen Datenstand zufaellig uebereinstimmen (69 = 69) — genau die Beobachtung, die der Code-Review selbst macht.

## Goal Achievement

### Observable Truths (die vier ROADMAP-Erfolgskriterien)

| # | Erfolgskriterium | Status | Beleg |
|---|---|---|---|
| 1 | Die Wikelo-Seite zeigt Angebote und Mengen aus dem Bestand, nicht aus der Handliste — behaelt Bilder, Ausstattung, Reputationstext | ✓ VERIFIED | `assets/wikelo-trades.json` (69 Eintraege, `mats`/`favor` aus `wikelo-gamefiles.json` via `build-wikelo-trades.mjs`), `assets/wikelo-curated.json` (59 Eintraege mit `img`/`comps`/`rep`/`cat`/`name`); `src/components/topics/wikelo-emporium.astro` `TRADES.map` liest `t.mats`, `t.favor`, `t.img`, `t.comps`, `t.rep` unveraendert; selbst gebauter `dist/topics/wikelo-emporium.html` und `dist/de/...` enthalten je 69× `class="wk-tc"`, `wk-atls` vorhanden (kuratiertes Bild rendert) |
| 2 | Register id 51 (Wikelo-Verzug) ist geschlossen: die Kennung wandert mit dem Datenlauf, nicht mit einer Sichtung | ✓ VERIFIED | `.planning/WINDOWS.md` id 51 `status: "fixed"`, `reason` nennt CL 12519617, 69, 285 und verweist auf id 55/56 woertlich; selbst ausgefuehrtes `node scripts/verify-datastand.mjs`: „maschinelle Datenstaende gelesen — Soll: 7 Ist: 7 / handgepflegte — Soll: 0 Ist: 0", Zeile „Wikelo: CL 12519617 Klinke 12519617", Abstand 0, Begleitdatei-Deckung „Wikelo: entryCount 69 Laenge 69" |
| 3 | Eine Klinke faengt einen Rueckgang der Vertragszahl | ✓ VERIFIED (mit Einschraenkung, siehe Human Verification / CR-02) | `scripts/lib/metrics-baseline.mjs`: `wikeloVertraege` (min 69, Toleranz 2%), `wikeloWarenposten` (min 285, Toleranz 2%); selbst ausgefuehrtes `node scripts/verify-metrics.mjs`: `wikeloVertraege >= 67 Ist 69`, `wikeloWarenposten >= 279 Ist 285`, Bijektion 24/24, 0 ohne Anlass; Plan-03-SUMMARY zitiert drei woertliche Rot-Meldungen (Klinke 67/279/12519617), von mir nicht erneut reproduziert (kostet einen manuellen Feldeingriff), aber Schwellenrechnung `Math.floor(69*0.98)=67` und `Math.floor(285*0.98)=279` im Code nachvollzogen und stimmig. **Einschraenkung:** `contractCount`/`orderLineCount` in `assets/wikelo-trades.meta.json` stammen ungeprueft aus dem Selbstauskunfts-Feld `game.counts` der gitignoreten `wikelo-gamefiles.json` (CR-02, im Code bestaetigt unveraendert) statt aus einer Gegenrechnung gegen `game.contracts` — die Klinke schuetzt damit gegen einen Rueckgang von `game.counts`, nicht nachweisbar gegen eine Abweichung zwischen `game.counts` und der tatsaechlich verarbeiteten Menge |
| 4 | `npm run build && npm run gate` gruen, normal UND mit `STAGING=1` | ✓ VERIFIED | Selbst ausgefuehrt (nicht nur aus SUMMARY uebernommen): `npm run build && npm run gate` → „23 von 23 Schritten gruen … Tor GRUEN"; `STAGING=1 npm run build && npm run gate` → „23 von 23 Schritten gruen … Tor GRUEN"; `npm run gate:data` → `verify:items` OK, `verify:vehicles` rot wegen fehlender lokaler `src/data/vehicles-gamefiles.json` — bestaetigt als vorbestehender, phasenfremder Befund (unabhaengig von Wikelo, betrifft Fahrzeugdaten) |

**Score:** 4/4 Erfolgskriterien mit Kommando und Zahl belegt (nicht behauptet); Kriterium 3 traegt eine dokumentierte, unbehobene Robustheitsluecke (CR-02).

### Required Artifacts

| Artefakt | Erwartung | Status | Details |
|---|---|---|---|
| `scripts/build-wikelo-trades.mjs` | Merge-Skript Bestand+Kuration | ✓ VERIFIED | Existiert, laeuft, Selbstauskunft (69/285/239/46/1→52) bestaetigt gegen aktuellen Datenstand |
| `assets/wikelo-curated.json` | kuratierte Overlay-Datei, keyed by Vertrags-id | ✓ VERIFIED | 59 Eintraege, jeder mit `basis`, keiner mit `mats`/`favor` |
| `assets/wikelo-trades.json` | 69 Karten aus dem Bestand | ✓ VERIFIED | 69 Eintraege, 239 Materialzeilen, 46 Favor, 52 mit Bild |
| `assets/wikelo-trades.meta.json` | Meta-Felder inkl. `patch`/`contractCount`/`orderLineCount`/`entryCount` | ✓ VERIFIED (Datenquelle mit Einschraenkung CR-02) | `gameVersion` 4.10.0-live.12519617, `patch` 4.10.0, `entryCount` 69, `contractCount` 69, `orderLineCount` 285, `curatedCount` 59; `reviewedVersion`/`reviewedAt` korrekt entfernt (Plan 03) |
| `.planning/phases/20-.../COVERAGE.md` | begruendete „keine externe API"-Erklaerung | ✓ VERIFIED | Datei existiert, Deklarationszeile + Begruendung vorhanden |
| `scripts/probes/wikelo-kuration-zuordnung.mjs` | dreistufige Zuordnungssonde | ✓ VERIFIED, mit bestaetigtem CR-01-Defekt | Existiert, `--hand`/`--schreiben` implementiert, kein Schreibzugriff ohne `--schreiben`; `schluesselAufloesen()` prueft Eindeutigkeit nachweislich nur pro Schluessel, nicht ueber die gesamte Stufe (Code gelesen, Fix aus Review nicht uebernommen) |
| `scripts/lib/metrics-baseline.mjs` | zwei neue Klinken | ✓ VERIFIED | `wikeloVertraege`/`wikeloWarenposten`, `anlass` nennt id 51 + CL 12519617 |
| `scripts/verify-metrics.mjs` | zwei neue Ableser gegen committetes Artefakt | ✓ VERIFIED | Liest `assets/wikelo-trades.meta.json`, kein Treffer auf `wikelo-gamefiles.json` im Quelltext |
| `scripts/verify-datastand.mjs` | Wikelo als 7. maschineller Datenstand | ✓ VERIFIED | `STANDS`-Zeile `Wikelo`, `KLINKEN.Wikelo = 12519617`, `HANDPFLEGE` leer, Zusicherung 1 auf 7/0 |
| `src/components/topics/wikelo-emporium.astro` | berichtigte Quellenangabe, `dataVersion` aus `patch` | ✓ VERIFIED | Zeile 221 `dataVersion={TRADES_META.patch}`; Absatz Zeile 341 ohne `4.8.1`, mit `TRADES.length` und `TRADES_META.patch`; `wikelotrades.com` bleibt nur fuer Bild/Ausstattung/Reputationstext genannt |

### Key Link Verification

| Von | Nach | Via | Status | Details |
|---|---|---|---|---|
| `wikelo-gamefiles.json` (`counts.contracts`/`counts.orderLines`) | `wikelo-trades.meta.json` (`contractCount`/`orderLineCount`) | `build-wikelo-trades.mjs` Zeilen 98-99 | ⚠️ WIRED, aber ungeprueft | Direkte Uebernahme ohne Gegenrechnung gegen `game.contracts` (CR-02) |
| `wikelo-trades.meta.json` (`contractCount`/`orderLineCount`) | `KLINKEN` in `metrics-baseline.mjs` | `ABLESER` in `verify-metrics.mjs` | ✓ WIRED | Bijektion 24/24 bestaetigt, Ableser liest committetes Artefakt |
| `wikelo-curated.json` (`trades.<id>`) | `wikelo-trades.json` (`img`/`comps`/`rep`/`cat`/`name`) | `build-wikelo-trades.mjs` | ✓ WIRED | end-to-end bis zur gerenderten Karte bestaetigt (`dist/topics/wikelo-emporium.html` enthaelt `wk-atls`) |
| `wikelo-trades.meta.json` (`patch`) | `TopicFacts dataVersion` + Quellen-Absatz | `wikelo-emporium.astro` | ✓ WIRED | beide Stellen lesen `TRADES_META.patch`, `4.8.1` im ausgelieferten Text nicht mehr vorhanden |
| `wikelo-trades.meta.json` (`entryCount`) | `verify-datastand.mjs` Zusicherung 7 | Begleitdatei-Pruefung | ✓ WIRED | „Wikelo: entryCount 69 Laenge 69" |
| Handbestand (git-Historie) | `wikelo-curated.json` (`trades.<id>`) | Zuordnungssonde | ✓ WIRED, mit bestaetigtem CR-01-Defekt | Delivered-Stand read-only nachgemessen korrekt (59/69-Bijektion, 3 Kollisionen benannt); Stufe-2-Logik im Code haelt die eigene Eindeutigkeitsgarantie fuer kuenftige Laeufe nicht ein |
| unzuordenbare Faelle | `WINDOWS.md` statt Automatik | manuelle Registrierung | ✓ WIRED | id 55 (D-02, 6 Faelle) und id 56 (D-03, 4 Faelle) korrekt und namentlich eingetragen |

### Data-Flow Trace (Level 4)

| Artefakt | Datenvariable | Quelle | Echte Daten | Status |
|---|---|---|---|---|
| `wikelo-emporium.astro` `TRADES.map` | `TRADES` (Import aus `wikelo-trades.json`) | `build-wikelo-trades.mjs` ← `wikelo-gamefiles.json` + `wikelo-curated.json` | Ja — 69 Karten, Mengen individuell unterschiedlich, kein Static-Fallback | ✓ FLOWING |
| `TopicFacts dataVersion` | `TRADES_META.patch` | `wikelo-trades.meta.json` | Ja — `4.10.0`, aus `gameVersion`-Regex | ✓ FLOWING |
| `verify-metrics.mjs` Ableser | `contractCount`/`orderLineCount` | `wikelo-trades.meta.json` ← ungeprueft aus `game.counts` | Teilweise — Wert ist real, aber nicht gegen `game.contracts` gegengerechnet | ⚠️ STATIC (Selbstauskunft ungeprueft uebernommen, CR-02) |

### Behavioral Spot-Checks

| Verhalten | Kommando | Ergebnis | Status |
|---|---|---|---|
| `verify-metrics.mjs` reisst unter der Klinke (67/279) | im Plan-03-SUMMARY woertlich dokumentiert, hier nicht erneut ausgeloest | Meldungen im SUMMARY zitiert, Schwellenformel `Math.floor(x*0.98)` im Code nachgerechnet und stimmig | ✓ PASS (dokumentiert, nicht in dieser Sitzung reproduziert) |
| `verify-metrics.mjs` laeuft heute gruen | `node scripts/verify-metrics.mjs` | „ALLE ZUSICHERUNGEN ERFUELLT", 24/24 gelesen | ✓ PASS |
| `verify-datastand.mjs` laeuft heute gruen, 7 maschinell/0 handgepflegt | `node scripts/verify-datastand.mjs` | „OK — 7 maschinell + 0 handgepflegt … 0 Warnungen" | ✓ PASS |
| `audit-site.mjs` 0 Datenherkunft-Funde | `node scripts/audit-site.mjs` | „Datenherkunft: 17450 Seiten + 19 JS + 13 JSON geprueft, 0 Fund(e)" | ✓ PASS |
| gebaute Seite zeigt 69 Karten, DE+EN, ohne `4.8.1` | eigener Build + Node-Pruefung gegen `dist/topics/wikelo-emporium.html`/`dist/de/...` | 69/69 Karten je Sprache, `4.8.1` nicht vorhanden, `patch`-Wert vorhanden, `wikelotrades.com` vorhanden | ✓ PASS |
| `npm run build && npm run gate` gruen | selbst ausgefuehrt | 23/23, Tor GRUEN | ✓ PASS |
| `STAGING=1 npm run build && npm run gate` gruen | selbst ausgefuehrt | 23/23, Tor GRUEN | ✓ PASS |
| `npm run gate:data` — nur vorbestehender Befund | selbst ausgefuehrt | `verify:items` OK, `verify:vehicles` rot (fehlende lokale `vehicles-gamefiles.json`, phasenfremd) | ✓ PASS (als bekannt bestaetigt) |

### Requirements Coverage

Keine REQ-IDs fuer Phase 20 vermerkt (`REQUIREMENTS.md` fuehrt D-01..D-04 nur in ROADMAP-Form, kein REQ-Eintrag verweist auf Phase 20 oder Wikelo). `requirements: []` in allen vier Plan-Frontmatter ist damit korrekt, kein verwaister Requirement gefunden.

### Anti-Patterns Found

| Datei | Zeile | Muster | Schwere | Wirkung |
|---|---|---|---|---|
| `scripts/probes/wikelo-kuration-zuordnung.mjs` | `schluesselAufloesen()`, ~Zeile 140-152 | CR-01 (Code-Review): Eindeutigkeitspruefung nur pro Schluessel, nicht ueber die gesamte Stufe — ein Vertrag mit mehreren Schluesseln (Titel + mehrere Rewardnamen) kann zwei Handeintraegen gleichzeitig zugeteilt werden, ohne als Kollision erkannt zu werden | 🛑 CRITICAL (laut Review), unbehoben, nicht im Register erfasst | Betrifft kuenftige Neu-Laeufe der Sonde, nicht den heute ausgelieferten Datenstand (read-only nachgemessen korrekt) |
| `scripts/build-wikelo-trades.mjs` | Zeilen 98-99 | CR-02 (Code-Review): `contractCount`/`orderLineCount` ungeprueft aus `game.counts` uebernommen statt gegen `game.contracts` gegengerechnet — genau die Werte, die die Erfolgskriterium-3-Klinke absichert | 🛑 CRITICAL (laut Review), unbehoben, nicht im Register erfasst | Klinke funktioniert heute (69=69 zufaellig deckungsgleich mit `entryCount`), schuetzt aber nicht nachweisbar gegen eine kuenftige Divergenz zwischen Selbstauskunft und echter Verarbeitungsmenge |
| `scripts/build-wikelo-trades.mjs` | Zeilen 61-72 | WR-01 (Code-Review, Warning): keine Laufzeitpruefung `o.max >= o.min` | ⚠️ WARNING | keine unmittelbare Auswirkung, Beobachtung statt Zusicherung |
| `scripts/build-wikelo-trades.mjs` | Zeilen 80, 84-85 | WR-02 (Code-Review, Warning): Truthy- statt `!= null`-Pruefung bei `cur.get`/`cur.comps`/`cur.rep` | ⚠️ WARNING | tritt im aktuellen Datenstand nicht auf |
| `scripts/probes/wikelo-kuration-zuordnung.mjs` | Zeilen 170-172 | IN-01 (Code-Review, Info): STOPWORDS-only Handeintraege werden ohne Diagnosezaehler uebersprungen | ℹ️ INFO | kein Zuordnungsfehler |

Keine `TBD`/`FIXME`/`XXX`-Marker in den von dieser Phase veraenderten Dateien gefunden.

### Human Verification Required

Siehe YAML-Frontmatter `human_verification` — fuenf Punkte: die drei vom Projekt selbst bereits als offen erkannten Sichtrunden-Punkte (WINDOWS.md id 55, 56, 57) plus die zwei unbehobenen CRITICAL-Befunde aus `20-REVIEW.md` (CR-01, CR-02), die weder gefixt noch explizit als getrackte Schuld ins Register aufgenommen wurden.

### Gaps Summary

Keine der vier ROADMAP-Erfolgskriterien ist verfehlt — alle sind mit selbst ausgefuehrten Kommandos und Zahlen belegt, nicht nur aus SUMMARY.md uebernommen. Die Einstufung `human_needed` statt `passed` hat zwei Gruende, die beide keine Ruecknahme der Phase verlangen, sondern eine bewusste Entscheidung des Betreibers:

1. Die Phase hat selbst drei Sichtrunden-Punkte offen gelassen (korrekt, plangemaess).
2. Zwei CRITICAL-Befunde aus dem Code-Review sind im Code unveraendert vorhanden und wurden weder behoben noch im Broken-Windows-Register erfasst — das ist eine Luecke im „Liefern"-Prozess dieser Phase (Review-Status `issues_found` wurde nicht auf `resolved` gebracht und die verbleibenden Punkte auch nicht bewusst als Schuld verbucht), auch wenn die ausgelieferte Funktionalitaet dadurch heute nicht sichtbar falsch ist.

---

*Verifiziert: 2026-08-28T12:48:59Z*
*Verifier: Claude (gsd-verifier)*
