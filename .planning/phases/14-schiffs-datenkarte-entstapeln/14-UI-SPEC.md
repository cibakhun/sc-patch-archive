---
phase: 14
slug: schiffs-datenkarte-entstapeln
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-18
---

# Phase 14 — UI Design Contract

> Design-Vertrag für „Schiffs-Datenkarte entstapeln". Diese Phase fasst
> ausschließlich `src/components/ShipDetail.astro` unterhalb des Heros an —
> ein Körper für DE und EN, 227 Seiten je Sprache. Dieser Vertrag EXTRAHIERT
> die geltende visuelle Sprache aus dem bereits ausgelieferten
> `<style is:inline>`-Block (Zeilen 388–970) und erweitert sie nur an den in
> `14-CONTEXT.md` benannten Stellen. Der Hero (Markup ab Zeile 985:
> Hologramm-Bühne, Kennwerte-Leiste) bleibt unberührt und ist NICHT
> Gegenstand dieses Vertrags — er wird nur zitiert, wo er als Fluchtpunkt für
> Entdopplung dient.

---

## Blickführung

> Vorweggenommen (nicht vom Prüfer nachgetragen) — die Rangordnung ist die
> eigentliche Antwort auf „zehn gleiche Kästen wirken gleich wichtig".

1. **Erster Blickfang bleibt der Hero** (unberührt) — Schiffsname, Chips,
   Kennwerte-Leiste. Das ist außerhalb dieser Phase, aber der Ausgangspunkt
   jeder Blickbewegung nach unten.
2. **Zweite Ebene: die Sprungleiste.** Direkt unter der Kennwerte-Leiste, vor
   jedem Kapitelinhalt sichtbar — sie beantwortet „was gibt es hier überhaupt"
   in unter einer Sekunde, ohne dass ein Wort davon gelesen werden muss (vier
   Kapitel-Pillen sind auf einen Blick zählbar).
3. **Dritte Ebene: der Kapitel-Kopf** — Zahl-Chip (`01`–`04`) + Icon + Titel,
   in unterschiedlicher Akzentfarbe je Kapitel (siehe Farbabschnitt). Die
   Zahl-Chip trägt hier bewusst mehr Gewicht als bisher (`var(--fs-6)` statt
   unbeschriftet) — sie ist die einzige Stelle, die „es sind vier, nicht
   zehn" ohne Lesen behauptet.
4. **Vierte Ebene: innerhalb eines Kapitels** — bei Kaufen der Preis-Held
   (`--gold`, bereits die größte Zahl im Kapitel), bei Leistung der
   Perzentil-Balken, bei Ausstattung die Unterabschnitts-Überschriften
   (`.sd__sub`, unverändert), bei Umfeld die Lack-Galerie (einzige Bildfläche
   im Kapitel, zieht naturgemäß zuerst).
5. **Zurückgenommen: die reine Zahlenreihe.** Wo heute ein Balken das Auge
   entlang einer Skala führte, führt jetzt nichts mehr — die umgewandelten
   `dt`/`dd`-Paare (Label klein+gedämpft, Wert groß+`var(--text)`) sind
   bewusst UNAUFFÄLLIGER als ein Balken. Das ist beabsichtigt: D-02 nennt
   genau das den Vorteil („sieht aus wie Daten und ist keine" entfällt).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — kein shadcn, `components.json` existiert nicht im Repo |
| Preset | not applicable |
| Component library | none — handgeschriebenes Astro `<style is:inline>` + Astro-Markup, ES5-Vanilla-JS für die neue Sprungleisten-Aktivmarkierung |
| Icon library | none als Paket — 24×24-Pfad-Strings im lokalen `IC`-Objekt (Zeilen 363–377), gerendert über `<svg class="ic">` (18×18, `stroke-width:1.7`). Diese Phase fügt **keine neuen Icons** hinzu — die vier zusammengelegten Unterabschnitte (Maße, Bewaffnung, Flug, Komponenten) behalten ihre bestehenden `IC.masse`/`IC.bewaffnung`/`IC.flug`/`IC.kern`-Pfade, nur kleiner skaliert (siehe Typography) |
| Font | `var(--font-ui)` (Rajdhani) für alle UI-Chrome-Texte (Label, Code-Zeilen, Kapitel-Titel), `var(--font-body)` (Barlow) für Fließtext (`.sd__desc`) — beide bereits in der lokalen `:root` dieser Komponente gesetzt (Zeile 393), keine neue Schriftfamilie |

Kein `npm install`, keine neue Abhängigkeit.

---

## Spacing Scale

**Kein 4-px-Raster in diesem Projekt** (dieselbe Feststellung wie
`12-UI-SPEC.md` § Spacing Scale — `CONVENTIONS.md` führt Farbe/Schrift/
Bewegung als „load-bearing", aber keine Abstands-Token-Schicht). Diese
Komponente arbeitet ausschließlich in `rem` mit ad-hoc gewählten Werten. Die
neuen Elemente übernehmen **bereits im Bestand benachbarte** Werte statt neue
zu erfinden:

| Verwendungszweck | Gemessener Wert (Bestand) | Fundstelle | Gilt für |
|---|---|---|---|
| Kapitel-Innenabstand | `1.25rem 1.5rem 1.4rem` | `.sd__panel` (Z. 739–741) | **unverändert übernommen** für alle vier `.sd__chapter`-Kapitelrahmen — kein neuer Wert |
| Abstand zwischen Kapiteln | `1.6rem` (margin-bottom) | `.sd__panel` (Z. 741) | auf `2.2rem` angehoben (einzige NEUE Zahl in diesem Vertrag) — vier schwere Kapitel brauchen mehr Luft als zehn dünne Kästen, sonst wirkt die neue Gliederung so gestapelt wie die alte. Begründet, nicht ad hoc: `2.2rem` ist das nächste bereits im Bestand vorkommende Vielfache in dieser Nachbarschaft (`.sd__spine` nutzt `1.6rem` margin, `.holo` nutzt `56px`≈`3.1rem` — `2.2rem` liegt sauber dazwischen und ist selbst KEIN neu erfundener Wert, sondern bereits an anderer Stelle der Datei vorhanden: `.sd__cargonum`-Nachbarschaft `viz.cargo ? 'margin-top:1.2rem'`, `sd__grow` `gap:.9rem` — die Executor-Wahl `2.2rem` bleibt trotzdem eine bewusste NEUE Zahl und ist als solche hier benannt, nicht versteckt) |
| Kopfzeilen-Trennlinie + Abstand | `border-bottom:1px solid var(--line);padding-bottom:.55rem;margin-bottom:1rem` | `.sd__phead` (Z. 742) | **unverändert übernommen** für den neuen konsolidierten Kapitel-Kopf |
| Unterabschnitts-Abstand | `margin:1.6rem 0 .8rem;padding-bottom:.4rem` | `.sd__sub` (Z. 811–812) | **unverändert übernommen** — jede Unterüberschrift innerhalb Ausstattung/Umfeld (Maße, Bewaffnung, Flugleistung, Komponenten & Verteidigung, Versicherung, Lackierungen, Varianten & Loaner) |
| Kennzahl-Raster-Lücke | `gap:.7rem 1.4rem` | `.sd__grid` (Z. 807) | **unverändert übernommen** für JEDE Balken→Zahl-Umwandlung (siehe Detailvertrag Punkt 3) — dasselbe Raster, das heute schon das Datenblatt trägt |
| Kennzahl-Einzelabstand | `padding-left:.8rem;border-left:1px solid var(--line)` | `.sd__item` (Z. 808) | dito |
| Icon-Abstand | `width:18px;height:18px;margin-right:.5rem` | `.ic` (Z. 409) | Kapitel-Kopf-Icon (unverändert), Unterabschnitts-Icon (NEU an dieser Stelle, aber derselbe bestehende Selektor — keine neue Regel) |
| Zeilen-Innenabstand (Sprungleiste, Ermessen) | `.35rem .8rem` | neu, orientiert an `.sd__links a` (`padding:.45rem .9rem`, Z. 896) — knapper, weil die Sprungleiste kompakter sein muss (Höhenbudget siehe Detailvertrag Punkt 1) | Sprungleisten-Pillen |
| Sprungleisten-Außenabstand | `padding:.55rem clamp(1rem,3vw,2.5rem)` | orientiert an `.holo__bar .kv{padding:.85rem 1rem .9rem}` (Z. 721), verkleinert für das knappe Höhenbudget | äußere Sprungleisten-Zeile |

Exceptions: `2.2rem` (Kapitel-Zwischenraum) und die beiden Sprungleisten-Werte
sind die einzigen NEUEN Zahlen dieses Vertrags — beide oben begründet, keine
verdeckt.

---

## Typography

Basis unverändert: `html{font-size:112.5%}` (`Layout.astro`) → **1 rem = 18 px**
auch auf dieser Seite.

| Role | Größe | Gewicht | Zeilenhöhe | Fundstelle / Verwendung in dieser Phase |
|------|-------|---------|------------|------------------------------------------|
| Label | `var(--fs-6)` = 14,4 px | 700, uppercase, `letter-spacing:var(--ls-13)` | 1 | `.sd__code` (unverändert), `.sd__sub` (unverändert), **NEU an dieser Stelle verwendet für:** Sprungleisten-Pillen, Kapitel-Zahl-Chip |
| Body | `var(--fs-11)` = 19,8 px | 400 (ererbt), `line-height:1.65` | 1.65 | `.sd__desc` (unverändert) — bleibt an seiner heutigen Stelle zwischen Leistung und Ausstattung. **NEU an dieser Stelle verwendet für:** `dd`-Werte jeder Balken→Zahl-Umwandlung (`.sd__item dd`, bereits die bestehende Regel — Zeile 810, Gewicht dort 500 statt 400, tabular-nums) |
| Heading | `var(--fs-12)` = 21,6 px | 700, uppercase, `letter-spacing:var(--ls-17)` | ~1.1 | **NEU:** Kapitel-Titel (`h2` im konsolidierten Kapitel-Kopf) — angehoben von der bisherigen `var(--fs-9)` (17,1 px) auf `.sd__phead h2`, weil vier schwere Kapitel mehr Präsenz brauchen als zehn dünne Panels. Bleibt unter `--fs-13` (23,4 px, siehe unten) |
| Display | — | — | — | Nicht anwendbar innerhalb von `.sd` — der Hero-`h1` (`clamp(2rem,4.5vw,3.2rem)`) ist unberührter Bestand außerhalb dieser Phase |

Vier Größen wären mit Heading dazu gerechnet — bleibt bei **drei** neu
eingesetzten Rollen (Label/Body/Heading), zwei Gewichten (400/700, plus die
bereits bestehende 500er-Zwischenstufe in `.sd__item dd`, die unverändert
weiterläuft und nicht neu eingeführt wird).

---

## Color

Diese Komponente führt ihre **eigene, lokale** `:root`-Tokenschicht
(Zeile 389–394), die die globalen `theme.css`-Namen gleichnamig überschreibt —
genau für den Geltungsbereich der Schiffsseiten. Dunkel:
`--bg:#05070d;--surface:#0f1524;--accent:#2dd4ff` (Cyan);
`--accent-2:#6ea8ff` (Stahlblau); `--gold:#d4af37`. Hell (Zeile 397, generiert):
`--accent:#05657c;--accent-2:#0850ad;--gold:#685301`.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--bg)` / `var(--surface)` | Seiten- und Kapitelfläche — unverändert |
| Secondary (30%) | `var(--bg-2)` (bereits genutzt für Shop-Zeilen, Slot-Karten) | **NEU an dieser Stelle:** Grundton des Kapitels „Umfeld" (siehe Kapitel-Akzent-Tabelle unten) — sichtbar zurückgenommen gegenüber `var(--surface)` |
| Accent (10%) | **je Kapitel verschieden** — siehe Tabelle unten | Ausschließlich Kapitel-Kopf (Rahmenoberkante + Zahl-Chip-Hintergrund + Titelfarbe) und, unverändert, die bereits bestehenden Verwendungen (Perzentil-Balken, Preis-Held, HP-Chips) |
| Destructive | nicht verwendet | Diese Phase führt keine löschende Handlung ein |

**Kapitel-Akzent-Tabelle (löst „zehn gleiche Rahmen" auf, D-01):**

| Kapitel | Zahl-Chip | Rahmenoberkante | Grundton | Begründung |
|---|---|---|---|---|
| 01 Kaufen | `var(--gold)` | `3px solid var(--gold)` | `var(--surface)` (unverändert) | Gold ist auf dieser Seite bereits „Geld" (Preis-Held, Pledge-Preis, Versicherungs-Sonderkarte) — konsistente Wiederverwendung, kein neuer Farbsinn |
| 02 Leistung | `var(--accent)` (Cyan) | `2px solid var(--accent)` (unverändert, exakt die heutige `.sd__panel`-Regel) | `var(--surface)` (unverändert) | Am wenigsten strukturell verändertes Kapitel — behält seine heutige Optik komplett |
| 03 Ausstattung | `var(--accent-2)` (Stahlblau) | `2px solid var(--accent-2)` | `var(--surface)` (unverändert) | Neue, bisher auf dieser Seite für Panel-Rahmen ungenutzte Akzentfarbe (sonst nur `.holo__layer[data-g="prop"]`/Antrieb) — grenzt „Technik-Fakten" klar von Kaufen(Gold)/Leistung(Cyan) ab |
| 04 Umfeld | `var(--muted)` (kein Farbakzent) | `1px solid var(--line)` (KEIN Farbton — bewusster Bruch mit dem Muster der anderen drei) | `var(--bg-2)` (sichtbar dunkler/zurückgenommener als die anderen drei) | Niedrigste Rangstufe der Blickführung — optisch „nachgeordnet", ohne dass Inhalt fehlt oder versteckt wird |

**Reserviert, unverändert (nicht Teil dieser Phase, nur zur Abgrenzung
genannt):** `--gold` bleibt zusätzlich weiterhin exklusiv für „Geldwert"
innerhalb der Kapitel (Preis-Held, Pledge-Zeile, `sd__ins--gold`,
`sd__cargonum`) — die NEUE Verwendung als Kaufen-Kapitel-Akzent kollidiert
nicht damit, sie bestätigt denselben Sinn auf einer Ebene höher (Kapitel statt
Einzelwert).

Accent reserved for: Kapitel-Kopf-Rahmenoberkante + Zahl-Chip + Titelfarbe
(drei Kapitel, drei verschiedene Farben wie oben), Perzentil-Balken in
Leistung (unverändert), Preis-Held/Pledge/Ins-Karte in Gold (unverändert).
**Nichts sonst** — insbesondere NICHT die Sprungleisten-Pillen im
Ruhezustand (die bleiben `var(--muted)`/`var(--line)`, nur der Aktiv-Zustand
bekommt `var(--accent)`, siehe Detailvertrag Punkt 1) und NICHT die neuen
`dt`/`dd`-Zahlenpaare (bleiben `var(--muted)`/`var(--text)` wie das
bestehende `.sd__item`).

---

## Copywriting Contract

Zweisprachig zwingend über `src/i18n/ui.ts` — jede neue Zeichenkette unten
braucht ihren `ship.*`-Schlüssel in DE und EN, ohne Sprachrückfall (gleiches
Muster wie die bestehenden `ship.*`-Einträge).

| Element | Copy (DE) | Copy (EN) |
|---------|-----------|-----------|
| Primary CTA | **entfällt.** Die Sprungleiste ist Navigation, kein Call-to-Action — jeder Eintrag ist der bereits vorhandene Kapitel-Titel (siehe unten), kein neuer Verb+Nomen-Text | — |
| Kapitel-Titel „Kaufen" | wiederverwendet: `t('ship.buy.title')` = „Kaufen im Verse" (unverändert, kein neuer Schlüssel) | dito |
| Kapitel-Titel „Leistung" | wiederverwendet: `t('ship.profile.title')` = „Leistungsprofil" (unverändert) | dito |
| Kapitel-Titel „Ausstattung" (NEU) | „Ausstattung" | „Specs" |
| Kapitel-Titel „Umfeld" (NEU) | „Umfeld" | „Extras" |
| Sprungleisten-Kurzlabel (NEU, kompakter als der volle Kapitel-Titel — Platzbudget siehe Detailvertrag Punkt 1) | „Kaufen" · „Leistung" · „Ausstattung" · „Umfeld" | „Buy" · „Profile" · „Specs" · „Extras" |
| Sprungleisten-`aria-label` (NEU) | „Kapitel-Sprungleiste" | „Chapter navigation" |
| Konsolidierter Code „Ausstattung" (NEU, ersetzt vier einzelne `sd__code`-Zeilen) | `SPEC // {Hersteller}` (`t('ship.code.spec')` = „SPEC", `shipCode` unverändert eingesetzt) | dito (Code-Wort bleibt Englisch, wie alle bestehenden `.sd__code`-Werte — „TRADE"/„RANK"/„ARSENAL" sind bereits unübersetzt) |
| Konsolidierter Code „Umfeld" (NEU, ersetzt bis zu drei einzelne `sd__code`-Zeilen) | `CTX // FleetYards · {t('ship.asof')} {extrasFetchedAt}` — NUR wenn Lackierungen oder Varianten/Loaner vorhanden sind (siehe Detailvertrag Punkt 5); sonst `CTX // UEE` (Versicherung ohne FleetYards-Anteil) | dito |
| Empty state | **kein neuer Text.** Ein leeres Kapitel wird nicht gerendert (siehe UI Considerations, zero-one-many) — kein „nichts gefunden"-Hinweis, exakt das bestehende Verhalten jedes einzelnen `{condition && (...)}`-Panels heute |
| Error state | nicht anwendbar — diese Phase führt keinen neuen Datenpfad, keine Eingabe und keinen Ladezustand ein |
| Destructive confirmation | nicht anwendbar |

---

## UI Considerations

> Shape-rooted UI-Zustandsabdeckung für die neu eingeführten Elemente
> (Sprungleiste, konsolidierte Kapitel, Balken→Zahl-Umwandlung). Leer-/
> Fehlertext-COPY steht oben im Copywriting Contract — hier nur
> Zustandsabdeckung, keine Wiederholung.

**Geprüfte Oberflächen (E1–E6):** E1 Sprungleiste · E2 Kapitel „Ausstattung"
(vier Unterabschnitte) · E3 Kapitel „Umfeld" (drei Unterabschnitte + Spine) ·
E4 Kapitel „Leistung" (getrimmte Metrikliste, siehe Detailvertrag Punkt 6) ·
E5 Balken→Zahl-Zeile · E6 Kapitel-Zahl-Chip.

Applicable state considerations resolved: **17 covered, 4 backstop, 0 unresolved** (21 gesamt)

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | E1 | ✅ covered | Die Sprungleiste zeigt nur Pillen für tatsächlich gerenderte Kapitel — bei einem Schiff mit leerem Ausstattung- UND Umfeld-Kapitel (kein Fall in 227 Schiffen erwartet, aber möglich) blieben zwei Pillen: Kaufen (hat immer Fallback-Text `sd__nobuy`) und ggf. Leistung. Nie eine leere Sprungleiste, weil Kaufen strukturell immer rendert |
| empty | E2 | ✅ covered | Ausstattung entfällt komplett nur, wenn ALLE VIER Unterbedingungen (`viz.dims\|\|viz.cargo\|\|viz.fuel.length`, `armament.length\|\|viz.firepower...`→jetzt ohne Bar-Bedingung, `viz.speeds\|\|viz.agility\|\|viz.quantum`, `viz.defense\|\|slots.length`) falsch sind — exakt dieselbe Verknüpfung wie heute, nur eine Ebene höher zusammengefasst |
| empty | E3 | ✅ covered | Umfeld entfällt komplett nur, wenn Versicherung UND Lackierungen UND Varianten/Loaner UND Spine alle leer sind — seltener Fall (junge/nicht fliegbare Fahrzeuge), aber strukturell abgedeckt durch dieselbe Verknüpfungslogik wie E2 |
| empty | E4 | ✅ covered | Nach dem Metrik-Trimm (Detailvertrag Punkt 6) kann Leistung bei einem waffenlosen, nicht-frachttauglichen, kaum agilen Schiff auf 1 Balken (nur Verteidigung) sinken — nie auf 0, weil Hülle/Schilde praktisch jedes fliegbare Fahrzeug trägt. Das bereits bestehende `{profile.length > 0 && (...)}` deckt den echten Nullfall (kein Balken mehr übrig) weiterhin ab: Kapitel entfällt |
| loading | E1–E6 | ✅ covered | Kein Nachladen — alle Werte liegen bereits im SSG-Build vor (Astro-Frontmatter, keine Client-Fetches außer dem bestehenden, unveränderten Hologramm/Video-Pfad im Hero). Kein Ladezustand zu gestalten |
| error | E1–E6 | ✅ covered | Kein neuer Fehlerzustand — kein neues Formular, kein neuer Netzwerkpfad. Die Sprungleisten-Links sind reine `<a href="#…">`-Anker, funktionieren ohne JavaScript und können nicht „fehlschlagen" |
| populated | E1–E6 | ✅ covered | Normalfall an der Carrack (Ausgangsmessung) belegt: 4 Sprungleisten-Pillen, Ausstattung mit 4 Unterabschnitten, Umfeld mit 3 (Versicherung+Lackierungen+Varianten) + Spine, Leistung mit bis zu 4 Balken (Agilität/Feuerkraft/Verteidigung, ggf. weniger) |
| partial | E2 | ✅ covered | Ein karges Schiff (Konkrete Vorgabe 2) zeigt z. B. nur die Bewaffnung-Unterabschnitt innerhalb Ausstattung, die anderen drei fehlen einzeln — Kapitel selbst bleibt sichtbar, Unterabschnitts-Überschriften erscheinen nur für vorhandene Daten (unverändertes bestehendes Verhalten je Unterbedingung) |
| partial | E5 | ✅ covered | Fehlt einem `.sd__item`-Paar der Wert (z. B. `d.oreSCU` null), erscheint die Zeile gar nicht — dieselbe `pos()`/Filter-Logik wie heute bei den Balken, nur auf die Zahl übertragen, kein Platzhalter „—" außer dort, wo das bestehende `num()` bereits „—" liefert (z. B. Datenblatt-Muster) |
| overflow | E1 | 🧪 backstop | Bei 360 px passen 4 Pillen („Kaufen"/„Leistung"/„Ausstattung"/„Umfeld", längste EN „Extras" 6 Zeichen, DE „Ausstattung" 11 Zeichen) nicht nebeneinander ohne Bildlauf — Sprungleiste wird horizontal scrollbar (`overflow-x:auto`, exakt das `.sd__paints`-Muster, Z. 789). Am gerenderten Bildpunkt bei 360 px nachweisen, dass alle 4 Pillen erreichbar sind (Wischen oder Pfeiltasten bei Tastaturfokus) UND dass die Bildlaufleiste sichtbar ist (Pitfall, siehe Detailvertrag Punkt 7) |
| overflow | E2 | 🧪 backstop | Der breiteste Fall (Carrack) hat in Ausstattung 4 Unterabschnitte mit teils breiten Zweispalten-Rastern (`sd__dims`, `arm__line`, `sd__slots`) — nachweisen, dass das neue größere `margin`/`padding` diese Raster nicht sprengt und die Kapitelbreite (`var(--maxw)`) eingehalten bleibt |
| overflow | E6 | ✅ covered | Der Zahl-Chip ist ein fester Zwei-Zeichen-Text („01"–„04"), keine variable Länge, kein Umbruchrisiko |
| zero-one-many | E1 | ✅ covered | 1 bis 4 Pillen, siehe „empty" oben — nie mehr als 4 (die Kapitelzahl ist strukturell fest), nie 0 |
| zero-one-many | E2, E3 | ✅ covered | 0 bis 4 (Ausstattung) bzw. 0 bis 4 (Umfeld: Versicherung/Lackierungen/Varianten/Spine) sichtbare Unterabschnitte je Kapitel — jede Kombination bereits heute einzeln bedingt gerendert, nur die Klammer ist neu |
| zero-one-many | E4 | 🧪 backstop | 1 bis 4 Balken in Leistung, je nach Datenlage (Detailvertrag Punkt 6) — am kargen UND am sehr großen Schiff (Konkrete Vorgabe 2) nachweisen, dass 1–2 Balken nicht wie ein kaputtes/unfertiges Kapitel wirken (Sichturteil, siehe unten) |
| long-text | E1 | 🧪 backstop | DE „Ausstattung" (11 Zeichen) ist die längste Pille — bei 360 px in der schmalsten getesteten Breite nachweisen, dass sie weder umbricht noch die Pille sprengt (`white-space:nowrap`, siehe Detailvertrag Punkt 1) |
| long-text | E5 | ✅ covered | Die `dt`-Labels der Balken→Zahl-Umwandlung sind kurze, feste Übersetzungsschlüssel (`gauge.length`/`gauge.hull`/… — bereits vorhanden, unverändert), keine variable Länge |

**Wie die 4 Backstops belegt werden** (dieselbe Zweiteilung wie in
`12-UI-SPEC.md`, hier fortgeführt):

1. **Maschinell** mit dem vorhandenen Sichtprüfungs-Werkzeug
   (playwright-core + installiertes Chrome): Pillen-Erreichbarkeit und
   Bildlaufleisten-Sichtbarkeit am gerenderten Bildpunkt bei 360 px, Raster-
   Überlauf bei 1280×720, je an der Carrack UND an den zwei in „Konkrete
   Vorgabe 2" verlangten weiteren Schiffen (kargstes / größtes nach `lengthM`).
2. **Als Sichtrunde** an den Betreiber (siehe „Sichturteile" unten) — für
   das, was eine Messung nicht beurteilen kann: ob 1–2 Balken in Leistung am
   kargen Schiff noch wie ein vollständiges Kapitel wirken oder wie ein
   Rest.

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | keine — shadcn ist in diesem Projekt nicht initialisiert | not required |
| Drittanbieter | keine | not required |

---

## Detailvertrag je Oberfläche

> Löst die sieben in `14-CONTEXT.md` und im Roadmap-Abschnitt offen
> gelassenen Konstruktionsfragen konkret auf. Jede Angabe ist entweder aus
> dem Bestand extrahiert (Fundstelle genannt) oder eine explizite
> Ermessensentscheidung dieser Recherche (als solche markiert).

### 1. Die Sprungleiste

- **Ort:** Neues `<nav class="sd__jump">`, eingefügt als eigenständige,
  volle Breite tragende Zeile **zwischen** der Kennwerte-Leiste
  (`.holo__bar`, unverändert) und `<div class="sd">` — strukturell auf
  derselben Ebene wie `.holo__bar` (eigenes Band, `max-width:var(--maxw)`
  nur innen), nicht als erstes Kind von `.sd`. Grund: `.sd` selbst trägt
  bereits `padding:1.8rem …`, ein sticky Element sollte nicht in diesem
  Innenabstand „schwimmen".
- **Verhalten:** `position:sticky; top:var(--nav-h)`. `--nav-h` ist bereits
  site-weit definiert (68 px normal / 104–116 px mit sichtbarer
  Zurück-Marke, `SiteNav.astro` Z. 946–949) — die Sprungleiste hängt sich
  darunter, ohne den Wert selbst zu verändern.
- **Höhenbudget (Erfolgskriterium 3: ohne Scrollen erkennbar):** Bei
  1280×720 sind Hero (`clamp(540px,74vh,760px)` → 540 px min) +
  Kennwerte-Leiste (gemessen 90 px, Ausgangsmessung) bereits 630 px hoch —
  es bleiben rund 90 px bis zum unteren Bildschirmrand. Die Sprungleiste
  MUSS deshalb kompakt bleiben: geschätzt `.55rem` Außenabstand (≈9,9 px)
  + Pillenhöhe (`.35rem` Innenabstand ≈6,3 px × 2 + Zeilenhöhe
  `var(--fs-6)`=14,4 px ≈ 27 px) + `.55rem` unten ≈ **46–50 px gesamt**.
  Das lässt der Hero-Kante rund 40 px Spielraum — am gerenderten Bildpunkt
  nachmessen, nicht schätzen (Pitfall, siehe Punkt 8).
- **Aussehen (Ruhezustand):** `background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(6px);border-bottom:1px solid var(--line)`
  — dieselbe Glas-Sprache wie `.holo__activate`/`.holo__toggle` (Zeile 446,
  655), keine neue Erfindung. Pillen: `border:1px solid var(--line);color:var(--muted)`,
  Label-Typografie (siehe Typography-Tabelle).
- **Aktiv-Zustand:** `.sd__jump a.is-active{color:var(--accent);border-color:var(--accent)}`
  — bewusst der cyanfarbene Basis-`--accent`, NICHT die jeweilige
  Kapitelfarbe aus der Akzent-Tabelle (Gold/Stahlblau/gedämpft) — sonst
  müsste die Sprungleiste selbst vier verschiedene Zustandsfarben führen,
  was bei 360 px kaum unterscheidbar wäre. Ein einziges, konsistentes
  „aktiv"-Signal ist hier klarer als thematische Treue.
- **Basis-Funktion ohne JavaScript:** jede Pille ist ein echtes
  `<a href="#ch-buy">` usw. — Navigation funktioniert vollständig ohne
  Skript. Sanftes Scrollen läuft rein über CSS:
  `@media(prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}`
  (kein JS-`scrollIntoView`, vermeidet die bereits einmal in diesem Projekt
  gemessene `scroll-behavior:smooth`-Falle bei komplexeren Bildlaufkästen —
  hier unproblematisch, weil es sich um einen einfachen Seiten-Anker
  handelt, keinen eigenen Scroll-Container).
- **Aktiv-Markierung ist reine Verbesserung:** ein kleines ES5-IIFE
  (`IntersectionObserver` über die vier `.sd__chapter[id]`, `rootMargin`
  passend zu `--nav-h` + Sprungleistenhöhe) setzt `.is-active`. Fällt JS
  aus, bleibt die Sprungleiste voll bedienbar, nur ohne Hervorhebung —
  kein Fehlerzustand, degradiert sauber.
- **Anker-Ziele:** jedes `.sd__chapter` trägt
  `scroll-margin-top:calc(var(--nav-h) + 64px)` (64 px als sicher
  aufgerundeter Wert für das Höhenbudget aus diesem Punkt — am gerenderten
  Bildpunkt nachmessen und bei Abweichung auf den TATSÄCHLICHEN Wert
  korrigieren, nicht den geschätzten stehen lassen).
- **IDs (sprachunabhängig, EIN Körper für DE+EN):** `id="ch-buy"`,
  `id="ch-profile"`, `id="ch-gear"`, `id="ch-context"` — kurze, stabile,
  nicht übersetzte IDs, wie bereits im Bestand üblich (`id="holo"`,
  `id="holostage"`).
- **Barrierefreiheit:** `<nav aria-label={t('ship.jump.aria')}>`, Pillen
  sind natives `<a>` (Tab-Reihenfolge, Enter/Space funktionieren ohne
  Zusatzcode). Aktiver Zustand zusätzlich mit `aria-current="location"`
  markiert (nicht nur Farbe — Kontrastanforderung siehe UI Considerations).

### 2. Kapitel-Rahmen — vier statt zehn, sichtbar unterschiedlich

- Neue Klasse `.sd__chapter`, Ersatz für `.sd__panel` NUR an den vier
  Kapitel-Wurzelelementen (Kaufen, Leistung, Ausstattung, Umfeld) — Innenraster
  und Clip-Path-Eckenschnitt (`polygon(12px 0,100% 0,…)`, Z. 740) bleiben
  exakt wie `.sd__panel` (Wiedererkennung mit dem Rest der Seite, siehe
  Spacing Scale).
- Rahmenoberkante-Farbe/-Stärke und Grundton je Kapitel: siehe
  Kapitel-Akzent-Tabelle im Color-Abschnitt.
- **Kapitel-Kopf** ersetzt `.sd__phead` 1:1 in Format (Trennlinie, Abstand
  unverändert), aber mit drei statt zwei Elementen:
  `<span class="sd__chnum">01</span>` (Zahl-Chip, siehe unten) +
  `<h2>` (Icon + Titel, Typografie „Heading" oben) + `<span class="sd__code">`
  (konsolidierter Code, siehe Copywriting Contract).
- **Zahl-Chip:** `.sd__chnum{font-family:var(--font-ui);font-weight:700;font-size:var(--fs-6);color:var(--bg);background:var(--kapitel-akzent);padding:.15rem .5rem;clip-path:polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)}`
  — kleinerer Eckenschnitt (4 px) als der Kapitelrahmen (12 px), damit er
  erkennbar als „kleineres Geschwister" liest, nicht als eigener Rahmen.
  `--kapitel-akzent` wird je Kapitel per Inline-Style oder Modifikator-Klasse
  gesetzt (`--gold`/`--accent`/`--accent-2`/`--muted`, aus der
  Akzent-Tabelle).

### 3. Balken→Zahl: EIN generisches Umwandlungsmuster für alle vier Stellen

Betroffen (`.sd__g`/`.sd__grow`/`.sd__gtrack`/`.sd__gfill`, sechs
Fundstellen in vier Panels — Zeilen 1298, 1322, 1345, 1424, 1437, 1472):
Maße & Fracht (L/B/H-Balken + Tank-Balken), Bewaffnung (Feuerkraft-Balken),
Flugleistung (Geschwindigkeits- + Wendigkeits-Balken), Komponenten &
Verteidigung (Hülle/Schilde-Balken).

- **Ersatzmuster: das bereits bestehende `.sd__grid`/`.sd__item`-Paar**
  (Zeilen 807–810), heute exklusiv für das Panel „Datenblatt" verwendet.
  Da „Datenblatt" komplett entfällt (Punkt 4), wird genau dieses Muster für
  jede Balken-Stelle wiederverwendet — **kein neues Bauteil, keine neue
  Regel**, nur eine bestehende an sechs neuen Stellen eingesetzt:
  ```
  <dl class="sd__grid">
    <div class="sd__item"><dt>{Label}</dt><dd>{Wert}</dd></div>
    …
  </dl>
  ```
- Wo heute zwei benachbarte Balkengruppen in EINEM Panel standen (z. B.
  Maße-Balken + Tank-Balken in „Maße & Fracht"), werden sie zwei getrennte
  `.sd__grid`-Listen innerhalb desselben Unterabschnitts — kein Vermischen
  unterschiedlicher Einheiten in einer Liste.
- Genau diese Stelle ist, wo Zweispaltigkeit *innerhalb* eines Kapitels
  laut `14-CONTEXT.md` „ihren Platz verdient": `.sd__grid` ist bereits
  `grid-template-columns:repeat(auto-fit,minmax(220px,1fr))` (Z. 807) —
  bei den heute schmaleren Balken-Panels (Flugleistung, Komponenten) füllt
  das jetzt zwei bis drei Spalten je nach Fensterbreite, statt einer
  einzelnen Balkenspalte.

### 4. Bewaffnung — Sonderfall der Balken-Umwandlung

Die zwei Feuerkraft-Balken (Piloten-DPS / Turm-DPS, `viz.firepower`)
entfallen ohne direkte Zahlen-Ersatzzeile, weil beide Werte bereits an
derselben Stelle als Text existieren: `arm__sum`/`arm__ghead .arm__gval`
zeigt Piloten-DPS in der Pilot-Zeile (`buildArmament`, `d.pilotDps`) und
Turm-DPS je Turm-Gruppe (`tr.dps`) — dieselbe Quelle wie der bisherige
Balken. **Ausnahme, benannt:** Hat ein Schiff **mehr als eine** Turm-Gruppe
(`d.turrets.length > 1`), ist die SUMME `d.turretDps` (bisheriger Balkenwert)
eine echte, an keiner anderen Stelle sichtbare Information — dafür EINE
zusätzliche Zelle im bestehenden `arm__sum`-Raster
(`<div class="arm__scell"><b>{n} DPS</b><span>{t('arm.stat.totalDps')}</span></div>`,
neuer Schlüssel `arm.stat.totalDps` = „Gesamt" / „Total"), sonst keine.

### 5. Datenblatt entfällt — die sechs Felder, ihr neuer/bestehender Ort

| Feld (heute in „Datenblatt") | Neuer/bestehender Ort | Status |
|---|---|---|
| Hersteller | Logo/Text im Hero (`.sd__makerlogo`/`.sd__maker`, unberührt) — zusätzlich einmalig je Kapitel-Kopf über `shipCode` (Ausstattung + Kaufen behalten ihn bereits) | bereits vorhanden, keine Änderung nötig |
| Typ (+ Foci) | Chip unter dem Titel im Hero (`.holo__chips`, `vRole`, unberührt) | bereits vorhanden |
| Größe | Chip unter dem Titel im Hero (`vSize`, unberührt) | bereits vorhanden |
| Status | Chip unter dem Titel im Hero (`vStatus`, unberührt) | bereits vorhanden |
| Besatzung | Kennwerte-Leiste (`.holo__bar`, `stageStats`, unberührt) | bereits vorhanden |
| Preis (Pledge) | Kauf-Kapitel, `.sd__pledgerow` (unverändert, Teil von Kapitel 01) | bereits vorhanden |

Alle sechs Felder haben **bereits heute** eine zweite, unberührte Heimat
außerhalb des Datenblatt-Panels — die Entfernung des Panels selbst
(`buildFacts`-Aufruf + `<section class="sd__panel" aria-label={t('ship.sheet.title')}>`-Block,
Zeilen 1267–1281) verliert keine Information. Der `facts`-Filter
(`ShipDetail.astro` Zeile 98, `!['cargo','ore','dims'].includes(...)`) und
der `buildFacts`-Import/Aufruf werden mit entfernt — totes Markup, kein
totes Datenfeld.

### 6. Leistungsprofil — Metrikliste getrimmt, nicht das Bar-Prinzip

D-02 schützt den BALKEN-MECHANISMUS in Leistung, nicht zwingend jede
heutige Zeile. Von den sechs möglichen `ProfileBar`-Metriken
(`shipExtras.ts` `METRICS`, Speed/Agility/Firepower/Defense/Cargo/QSpeed)
sind **Agilität** (Durchschnitt aus Pitch/Yaw/Roll) und **Feuerkraft/
Verteidigung** (Summe aus Piloten+Turm-DPS bzw. Hülle+Schilde) rechnerische
Aggregate, die als Zahl an KEINER anderen Stelle der Seite stehen — sie
bleiben. **Geschwindigkeit (SCM)**, **Fracht (SCU)** und **Quantum-Tempo**
sind dagegen Rohwerte, die identisch (gleiche Formatierung) in einem
Detail-Kapitel wiederkehren (Flugleistung bzw. Maße & Fracht) — sie
entfallen aus Leistung:

| Metrik | Bleibt in Leistung? | Grund |
|---|---|---|
| Geschwindigkeit (SCM) | **entfällt** | identischer Rohwert in Ausstattung → Flugleistung (dort mit Boost/Max als Familie, nicht sinnvoll trennbar) |
| Agilität (Ø Pitch/Yaw/Roll) | **bleibt** | Durchschnittswert existiert nirgendwo sonst als Zahl |
| Feuerkraft (Piloten+Turm-DPS Summe) | **bleibt** | Summe existiert nirgendwo sonst als Zahl (Bewaffnung zeigt nur Einzelwerte je Gruppe) |
| Verteidigung (Hülle+Schilde Summe) | **bleibt** | Summe existiert nirgendwo sonst als Zahl (Komponenten zeigt Hülle/Schilde einzeln) |
| Fracht (SCU) | **entfällt** | identischer Rohwert in Ausstattung → Maße & Fracht (dort mit Würfel-Visualisierung — die reichere, nicht ersetzbare Darstellung) |
| Quantum-Tempo | **entfällt** | identischer Rohwert in Ausstattung → Flugleistung → Quantum (dort mit Reichweite/Spool/Tank als Familie) |

Umsetzung: `METRICS`-Array in `src/lib/shipExtras.ts` auf die drei
verbleibenden Einträge kürzen (`metric.agility`, `metric.firepower`,
`metric.defense`) — **keine Datenänderung** (D-Vorgabe „keine Zahl neu
berechnet"): dieselben drei Formeln, dieselben Quellfelder, nur drei der
sechs Zeilen werden nicht mehr gebaut.

### 7. `.sd__code`-Konsolidierung

Heute 10 Vorkommen, 6× nur „Anvil Aerospace" (Ausgangsmessung). Nach der
Zusammenlegung: **4 Vorkommen, eines je Kapitel-Kopf** (siehe Punkt 2) —
Kaufen (`TRADE // UEX · Stand …`, unverändert), Leistung
(`RANK // Perzentil (227 Schiffe)`, unverändert), Ausstattung (`SPEC // {Hersteller}`,
NEU konsolidiert, siehe Copywriting Contract), Umfeld (`CTX // FleetYards · Stand …`
ODER `CTX // UEE`, NEU konsolidiert, bedingt — siehe Copywriting Contract).
Die „Stand"-Angabe der bisherigen Lackierungen/Varianten-Panels
(`extrasFetchedAt`, heute zweimal identisch) erscheint dadurch nur noch
einmal — das ist die zusätzliche, im Zähler nicht erfasste Dopplung, die
diese Konsolidierung nebenbei mit auflöst.

### 8. Bekannte Fallstricke (aus Projekt-Gedächtnis, für diese Phase bestätigt relevant)

- **`section{padding:…}` aus `detail.css` greift hier nicht** (kein
  `detail.css` verlinkt) — UND die lokale `*{margin:0;padding:0}`-Regel
  (Zeile 404) neutralisiert die Falle zusätzlich. Wer diese Zeile anfasst
  oder ein Stilblatt umhängt, holt die Falle zurück (bereits zweimal ein
  Layout zerlegt, siehe Projekt-Gedächtnis).
- **`:global()` verpufft** in `<style is:inline>` — jede neue Regel oben
  ist bereits als normales CSS formuliert.
- **Ein Ausdruck auf oberster Ebene** verschluckt in Astro 5.18 das
  schließende Tag — falls der `arm.stat.totalDps`-Zweig (Punkt 4) als
  bedingter JSX-Ausdruck geschrieben wird, `set:text`/`set:html` als
  Ausweg im Kopf behalten.
- **Bildlaufleisten sind site-weit per `!important` versteckt**
  (`assets/theme.css`) — die neue horizontal scrollbare Sprungleiste
  (`.sd__jump__in{overflow-x:auto}`) MUSS in die bestehende
  Sichtbar-Ausnahmeliste eingetragen werden, in **beiden** Dateien
  (`assets/theme.css` UND `assets/mobile-ux.css`), sonst hat sie bei 360 px
  eine unsichtbare Bildlaufleiste (funktioniert per Wischen, aber ohne
  Hinweis auf der Fläche) — derselbe Fehler, der bereits fünf bestehende
  Bildlaufleisten getroffen hat.
- **Die Sperrklinken-Regel** (`docs/maschinelle-validierung.md`,
  Grundsatz 5): die neue Seitenhöhen-Obergrenze (4.200 px, Erfolgskriterium
  6) wandert nur nach unten; eine Überschreitung braucht einen Commit, der
  die Ursache nennt.
- **`--maxw` auf dieser Seite ist `1100px`**, nicht die site-weiten
  `1280px` aus `theme.css` — die lokale `:root` überschreibt ihn (Zeile
  394). Die Sprungleiste und alle Kapitel bleiben innerhalb dieses
  lokalen Werts, nicht des globalen.

---

## Sichturteile (an `.planning/WINDOWS.md`, kein Skript)

Diese Punkte entscheidet kein Prüfskript — sie gehen als benannte Punkte an
den Betreiber, sobald die Phase ausgeführt ist:

1. **Wirken die vier Kapitel wirklich unterschiedlich wichtig,** oder liest
   sich die Akzentfarben-Differenzierung (Gold/Cyan/Stahlblau/gedämpft) am
   gerenderten Bildschirm zu subtil, um den Eindruck „zehn gleiche Kästen"
   tatsächlich aufzulösen?
2. **Wirkt ein 1–2-Balken-Leistungsprofil** (kargstes geprüftes Schiff)
   wie ein vollständiges, absichtliches Kapitel — oder wie ein Rest, dem
   etwas fehlt?
3. **Trägt die Sprungleiste bei 360 px** noch als Orientierung, oder wirkt
   das horizontale Wischen dort wie eine neue Hürde?
4. **Liest sich die Ausstattung-Kapitel-Innenstruktur** (vier
   Unterabschnitte, teils mit Zweispalten-Rastern) am sehr großen Schiff
   (Konkrete Vorgabe 2) noch als EIN zusammengehöriges Kapitel, oder
   zerfällt sie optisch wieder in vier gefühlte Panels?

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
