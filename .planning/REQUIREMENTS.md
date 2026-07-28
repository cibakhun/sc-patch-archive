# Requirements: VerseBase — UI-/Design-Feinschliff

**Defined:** 2026-07-28
**Core Value:** Spielgenaue Daten, direkt aus den Spieldateien gewonnen — wenn die Zahlen nicht stimmen, ist die Seite wertlos.

> Milestone-Kontext: Das Produkt ist gebaut und live. Dieser Meilenstein betrifft
> ausschließlich die Oberfläche. Der Bestand ist in `.planning/PROJECT.md` unter
> „Validated" verzeichnet und wird hier nicht wiederholt.

## v1 Requirements

### Wortmarke & Kopfleiste

- [ ] **MARK-01**: Beim ungescrollten Aufruf der Startseite steht die Überschrift „VerseBase" oben mittig im Hero
- [ ] **MARK-02**: Beim ungescrollten Aufruf der Startseite ist die Wortmarke in der Kopfleiste nicht sichtbar
- [ ] **MARK-03**: Beim Runterscrollen wandert die Hero-Überschrift scroll-verknüpft in Position und Größe der Kopfleisten-Wortmarke — als stetiger Verlauf, nicht als harter Umschaltpunkt
- [ ] **MARK-04**: Nach abgeschlossener Wandlung trägt die Kopfleiste den Schriftzug und dieser bleibt ein Verweis auf die Startseite mit `aria-label`
- [ ] **MARK-05**: Auf allen Seiten ohne Hero ist die Kopfleisten-Wortmarke unverändert sofort sichtbar
- [ ] **MARK-06**: Die Wandlung erzeugt keinen Layout-Sprung — animiert werden ausschließlich `transform` und `opacity`
- [ ] **MARK-07**: Unter 580 px Breite zeigt die Kopfleiste weiterhin nur das Monogramm, wie bisher
- [ ] **MARK-08**: Die Wandlung läuft in der deutschen und der englischen Startseite identisch

### Bewegung & Zugänglichkeit

- [ ] **MOTN-01**: Bei `prefers-reduced-motion: reduce` entfällt die scroll-verknüpfte Bewegung; Überschrift und Kopfleiste bleiben in jedem Scroll-Zustand lesbar und bedienbar
- [ ] **MOTN-02**: Jede Seite hat genau eine sichtbare `h1`
- [ ] **MOTN-03**: Der Effekt hängt am bestehenden Scroll-Listener in `SiteNav.astro`; es kommt kein zweiter globaler Scroll-Listener hinzu
- [ ] **MOTN-04**: Die Wandlung läuft ruckelfrei — die Arbeit pro Bild bleibt auf Compositor-Eigenschaften beschränkt

### Farbmodi

- [ ] **THEME-01**: Die Wandlung ist in Hell- und Dunkelmodus gleichwertig lesbar — sowohl über dem Hero-Foto als auch über der Seitenfläche
- [ ] **THEME-02**: Kein generierter `:root[data-theme="light"]`-Block wird von Hand verändert; Hellwerte entstehen über `npm run theme`

### Typografie & Bewegungsbild

- [ ] **TYPO-01**: Schriftgrade und Laufweiten der Kopfleiste und der Startseite folgen einer gemeinsamen Skala statt seitenlokaler Einzelwerte
- [ ] **TYPO-02**: Übergangsdauern und Beschleunigungskurven sind über die Startseite hinweg vereinheitlicht
- [ ] **TYPO-03**: Kopfleiste und Startseite lesen sich als ein zusammenhängendes Bewegungsbild, nicht als zwei unabhängige Zustände

### Überlagerungen

- [ ] **LAYER-01**: Die in `CONCERNS.md` als Class B verzeichneten dekorativen Überlagerungen über Text sind abgetragen
- [ ] **LAYER-02**: Text über Bildmotiven erreicht in beiden Farbmodi einen belegten Kontrastwert

### Sprachparität

- [ ] **SYNC-01**: Jede Änderung an einer Startseiten- oder Layout-Datei trifft die EN- und die DE-Fassung im selben Arbeitsschritt
- [ ] **SYNC-02**: Ein Prüfschritt belegt für die geänderten Seitenpaare, dass Struktur und Stil deckungsgleich sind — nicht nur die Absicht

## v2 Requirements

### Sprachparität

- **SYNC-03**: Ein Build- oder Audit-Schritt vergleicht alle 67 EN/DE-Seitenpaare automatisch und schlägt bei Struktur-Drift fehl
- **SYNC-04**: Die von Hand gedoppelte Seiten-Chrome der driftenden Paare (`precision-jump`, DE-Konto-Seiten) ist in gemeinsame Komponenten zusammengeführt

### Typografie & Bewegungsbild

- **TYPO-04**: Die vereinheitlichte Skala gilt über die Startseite hinaus für alle handgebauten Seiten

## Out of Scope

| Feature | Reason |
|---------|--------|
| Serverseitige Renderlogik | Statisches Astro-Build hinter nginx — geht nur als Supabase Edge Function |
| Ausbau der Datamine-Pipeline | Dieser Meilenstein ist ausdrücklich Oberfläche, nicht Daten |
| Konto-, Community- und Discord-Funktionen | Bestand bleibt, wird in diesem Meilenstein aber nicht vorangetrieben |
| CSS-Framework oder Bundler für `assets/` | Handgeschriebenes CSS/JS ist bewusste Entscheidung, nicht Altlast |
| Redesign einzelner Patch-Seiten | Jede Patch-Seite hat absichtlich ihre eigene Design-Welt |
| Vollständige Zusammenführung aller 67 Seitenpaare | Zu groß für diesen Meilenstein — als SYNC-04 nach v2 verschoben |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MARK-01 | Phase 1 | Pending |
| MARK-02 | Phase 1 | Pending |
| MARK-03 | Phase 1 | Pending |
| MARK-04 | Phase 1 | Pending |
| MARK-05 | Phase 1 | Pending |
| MARK-06 | Phase 1 | Pending |
| MARK-07 | Phase 1 | Pending |
| MARK-08 | Phase 1 | Pending |
| MOTN-01 | Phase 1 | Pending |
| MOTN-02 | Phase 1 | Pending |
| MOTN-03 | Phase 1 | Pending |
| MOTN-04 | Phase 1 | Pending |
| THEME-01 | Phase 1 | Pending |
| TYPO-01 | Phase 2 | Pending |
| TYPO-02 | Phase 2 | Pending |
| TYPO-03 | Phase 2 | Pending |
| LAYER-01 | Phase 3 | Pending |
| LAYER-02 | Phase 3 | Pending |
| SYNC-01 | Phase 4 | Pending |
| SYNC-02 | Phase 4 | Pending |
| THEME-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-28*
*Last updated: 2026-07-28 after initial definition*
