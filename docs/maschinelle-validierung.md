# Maschinelle Validierung — Implementierungsplan

> **Referenzdokument.** Erhoben und gemessen am 09.08.2026 auf `46ba9e3`
> (= `origin/staging`, frischer Checkout: `npm ci` 8 s, `npm run build` 114 s,
> 17.361 gebaute Seiten). Jede Zahl in diesem Dokument stammt aus diesem
> Messlauf oder aus einer benannten Datei — nichts ist geschätzt.
> Das vollständige Messprotokoll steht im [Anhang](#anhang-messlauf-vom-09082026).

## 0) Auftrag und Kurzfassung

Anlass (Betreiber, 09.08.2026): Die Seite wird größer, nicht mehr alles ist von
Hand testbar, und die Qualität der KI-Ausgaben schwankt — bei vielen parallelen
Sitzungen ist das Gedächtnis des Betreibers die eine Ressource, die garantiert
reißt.

Der Kernbefund nach Inventur und Messlauf: **Es fehlt nicht an Prüfcode.**
Das Projekt besitzt ~7.300 Zeilen reine Prüflogik (17 verify-/audit-Skripte mit
4.438 Zeilen, dazu 2.847 Zeilen e2e-Tests samt Helfern und `_verify.mjs`), und
das Auslieferungs-Tor im [Dockerfile:66](../Dockerfile) ist die harte Variante,
die die meisten Projekte nicht haben: schlägt ein Prüfer fehl, entsteht kein
Image, und Coolify liefert weiter den letzten guten Stand.

Was fehlt, sind vier Dinge — jedes mit einem dokumentierten Vorfall als Beleg:

| Lücke | Beleg |
|---|---|
| **L1** Die Hälfte der Prüfer hängt an keinem Tor | Messlauf 09.08.: **2 der 9 losen Prüfer sind rot, ohne dass es jemand wusste** (`verify:mining`, `verify:items` — Details in § 2) |
| **L2** Kein Tor sieht den Browser | WINDOWS.md id 9: `verify:layers` meldete „344 Messungen, 0 unter der Marke", die Browser-Messung fand `.eyebrow` bei **1,74:1** — das Tor maß nicht falsch, es zählte die Stelle nicht auf |
| **L3** Datenläufe können den Bestand still verkleinern | `sync:item-prices` kostete einmal **−834 Items** (319 verloren Bezugsquellen); die Gegenregel („`collapsedNames` nach jedem Lauf prüfen") lebt im Gedächtnis, nicht im Tor |
| **L4** Der Weg vom grünen Tor zur ausgelieferten Seite ist blind | `cf58c76`: ein Tor riss in CI, **staging lieferte stundenlang unbemerkt den alten Stand aus**; an anderem Tag hing Coolify 20 Minuten nach „CI grün" |

Dazu eine fünfte, strukturelle Lücke: **L5** — Feature-Zweige (`claude/*`)
bekommen ihre erste maschinelle Rückmeldung erst beim Push auf `staging`.
Kein Workflow läuft auf Zweig-Pushes; eine Sitzung erfährt erst nach dem
Einbringen, ob sie das Tor reißt.

Der Plan darauf: **sieben Arbeitspakete W1–W7** (§ 5), zusammen grob 4–5
Arbeitstage, in einer Reihenfolge, bei der jedes Paket für sich lieferbar ist.
Nur eines davon (W5, Browser-Rauchtest) ist ein Neubau — alles andere ist
Verkabelung, Klinken und Formalisieren dessen, was schon da ist.

---

## 1) Was heute steht (gemessen)

### 1.1 Das Auslieferungs-Tor

Neun Prüfer laufen bei jedem Push auf `staging`/`main` im Docker-Build
([Dockerfile:66](../Dockerfile), via [deploy-staging.yml](../.github/workflows/deploy-staging.yml)
bzw. [deploy-image.yml](../.github/workflows/deploy-image.yml)). Gemessen am
09.08.2026, lokal, frischer Build — **alle grün, Kette gesamt ≈ 76 s**:

| Prüfer | prüft | Eingaben | Laufzeit |
|---|---|---|---|
| `test:e2e` | 234 Tests / 44 Suiten: Item-Finder-Verhalten (echte Inline-Skripte in `node:vm`), DB-Integrität, Crafting-Chips, FX-Gatter, Layer-Compositing, Sync-Fingerabdruck, Typo-Morph … | `dist/` + committete JSONs | 11,1 s |
| `verify` (`_verify.mjs`) | jede lokale `href`/`src`/`url()`/`data-img`/`data-lb` in `dist/` zeigt auf eine existierende Datei (~816k Verweise) | `dist/` | 12,5 s |
| `verify:vendor` | das handkopierte three.js entspricht der devDependency | `vendor/`, `node_modules` | 0,5 s |
| `audit:csp` | die CSP in `nginx/default.conf` deckt alles, was der Build wirklich lädt (10 externe Quellen) | `dist/` + nginx-Conf | 10,8 s |
| `verify:crafting` | Bauteil-Kennwerte der 1.594 Crafting-Karten stimmen mit den Spieldaten überein; gleichnamige, in Wahrheit verschiedene Blueprints bleiben gesperrt | committete JSONs | 1,3 s |
| `verify:typo` | Schrift-/Laufweiten-/Übergangsskala site-weit, 6 Zusicherungen, Sperrklinke ≥ 235.775 Token-Nutzungen | `dist/` + `src/` | 12,3 s |
| `verify:layers` | WCAG-AA-Kontrast an 25 Registry-Einträgen / 344 Messstellen (sharp-Pixelrechnung + Scrim/Raster-Compositing), 7 Zusicherungen inkl. Vollständigkeits- und Aufzählungswächter | `dist/` + `public/assets`-Bilder | 12,9 s |
| `verify:sync` | EN/DE-Gerüstgleichheit über alle 8.678 gebauten Seitenpaare; benannte Ausnahmen mit Zombie-Wächter | `dist/` | 12,0 s |
| `verify:theme` | kein erzeugter Hellmodus-Block ist von Hand verändert (Generatoren gegen tmp-Ablagekopie; `EXCLUSIONS` ist seit 09.08. **leer**) | `src/` + `assets/` | 1,7 s |

Daneben existieren drei weitere Verankerungen: die robots/noindex-Gegenprobe am
fertigen Image ([deploy-staging.yml:58](../.github/workflows/deploy-staging.yml)
— der Präzedenzfall für „das Image selbst prüfen", auf dem W5 aufbaut),
`nginx -t` im Dockerfile, und `pretest:e2e`
([scripts/_test-prereqs.mjs](../scripts/_test-prereqs.mjs)), das fehlende
Builds erklärt statt mit ENOENT zu sterben.

### 1.2 Die neun losen Prüfer

Alle vorhanden, alle nur von Hand aufrufbar — der letzte belegte Gesamtlauf vor
dem heutigen lag Tage und >300 Commits zurück. Messlauf 09.08.:

| Prüfer | Zeilen | prüft | Eingaben | heute | Laufzeit |
|---|---|---|---|---|---|
| `audit:site` | 589 | Publish-Audit über alle 17.361 Seiten: tote Links/Anker (inkl. nginx-Rewrite-Nachbildung), Sprachumschalter-Ziele, Sitemap↔Build, Platzhalter, Mojibake, **Datenherkunfts-Regel**, A11y-Basics, Seitengewichte | `dist/` | ✅ 0 FEHLER (4 WARNUNGEN, 30 INFOS) | 64,9 s |
| `verify:fx` | 168 | 7 Zusicherungen: Mauszeiger-Schein getilgt, FX-Umschalter-Vertrag, DE/EN-Parität über 8.678 Paare | `dist/` | ✅ 7/7 | 11,6 s |
| `verify:help` | 237 | 6 Zusicherungen: Hilfe-Mechanik kostenlos vor Klick, kein innerHTML-Pfad, DE/EN-Parität, 11/11 Werkzeuge (`--complete`) | `dist/` | ✅ 11/11 | 10,5 s |
| `verify:weapons` | 150 | Waffengrößen-Join über `cls` (nie Anzeigename), Summenprobe gegen Loadout, Physik-Grenze; druckt Selbstauskunft der Prüfmenge | committete JSONs | ✅ | 0,5 s |
| `verify:vehicle-roles` | 162 | Rollen-Momentaufnahme: Join-Rate-Sperrklinke `MIN_MATCHED = 223`, Konsistenz | committete JSONs | ✅ 223 | 0,4 s |
| `verify:mining` | 71 | Mining-Modell/DB-Invarianten, Klassennamen-Wachposten, `game_version`-Konsistenz; Client-Abgleich **best effort** (nur wenn `build_manifest.id` lokal existiert) | committete JSONs (+ lokaler Client, optional) | ❌ **ROT** | 0,5 s |
| `verify:items` | 136 | UEX-Live-Vollabgleich (23.705 Zeilen), Wiki-Stichprobe, tote-Locations-Audit | committete JSONs + **UEX/Wiki-Netz** | ❌ **ROT** | 13,4 s |
| `verify:vehicles` | 161 | Feld-für-Feld: frischer Extraktionslauf gegen committeten Katalog | `vehicles-gamefiles.json` (**unversioniert**, nur nach lokalem Datamine-Lauf) | — nicht lauffähig ohne frischen Lauf | — |
| `verify-hardpoints.mjs` | 128 | Hüllenmaße/Komponentenzahlen gegen unabhängige Quellen | committete JSONs (+ stale Scratchpad-Pfad für Teil C) | ⚠ „grün", aber **ohne Exit-Logik** — reiner Bericht; kein npm-Skript | 0,1 s |

Dazu: [audit-typo-motion.mjs](../scripts/audit-typo-motion.mjs) (236 Z.) ist
ein Erhebungswerkzeug der Phase 2, kein Prüfer — es bleibt bewusst ohne Tor.

### 1.3 Die zwei roten Befunde im Detail

**`verify:mining` (rot):** `game_version (4.9.0-live.12326004) stimmt nicht mit
dem installierten Client überein (4.9.0-live.12344265)`. Das ist ein **echter
Fund des Messlaufs**: CIG hat einen neuen Client-Build ausgerollt
(`12344265` > `12326004`), sämtliche game-sourced Daten der Seite (Mining,
Items, Crafting, Fahrzeuge — alle tragen `12326004`) sind einen Build hinterher,
und keine Maschine hat es gemeldet. Genau dafür existiert der Abgleich — er
läuft nur nie. (Konsequenz: Schiene B, § 3; Datenlauf-Playbook, W3.)

**`verify:items` (rot):** Exit 1 wegen 128 Orten, die UEX kennt und die
Wiki-Stichprobe nicht („Ort fehlt im Wiki"). Der Befund ist bei Ansicht
**Wiki-Verzug**, kein Fehler unserer Daten — die fehlenden Orte sind
überwiegend die neuen Nyx/Pyro-Gateways. Die scharfen Prüfteile (Join-Fehler,
tote Locations: 0) sind grün, die Preis-Drifts (26) sind erwartete Volatilität.
Ein Prüfer, der wegen der Trägheit einer *Fremdquelle* rot zieht, erzeugt genau
die Fehlalarm-Müdigkeit, vor der [audit-site.mjs:33](../scripts/audit-site.mjs)
warnt: „Wer zweimal einem FEHLER nachgeht, der keiner war, sieht beim dritten
Mal weg." (Konsequenz: Herabstufung dieser Klasse auf WARNUNG, W3.)

### 1.4 Was der Bestand an Prüf-Kultur bereits kodifiziert hat

Diese sechs Muster existieren im Code und werden in § 4 zu verbindlichen
Bauregeln für alles Neue:

1. **Negativkontrolle** — jedes Tor wurde vorgeführt rot gefahren, bevor es
   scharf ging (z. B. `02-07`: `--fs-10` testweise verstellt; `03-01`: Maske
   gestört; `04-01`: drei benannte Brüche). Hintergrund: `verify-help` meldete
   einmal grün, nachdem jedes `data-help` gelöscht war.
2. **Selbstauskunft der Prüfmenge** — [verify-weapon-sizes.mjs:26](../scripts/verify-weapon-sizes.mjs):
   ohne die sichtbare Zahl „wie viele geprüft" ist ein leerlaufender Wächter
   von einem echten nicht zu unterscheiden.
3. **Sperrklinken statt Momentwerte** — `MIN_MATCHED = 223`
   ([verify-vehicle-roles.mjs:27](../scripts/verify-vehicle-roles.mjs)),
   `MIN_TOKEN_USAGES = 235775` (verify-typo): Untergrenzen, die nur nach oben
   wandern; nach unten nur mit geklärter Ursache.
4. **Benannte Ausnahmen mit Zombie-Wächter** — `sync-exclusions.mjs`: jede
   Ausnahme nennt ihren Anlass; verliert sie ihn, reißt das Tor. `EXCLUSIONS`
   in verify-theme ist seit 09.08. leer — Ausnahmen sind Schulden, keine
   Dauerzustände.
5. **FEHLER blockt, WARNUNG nicht** — audit-site trennt scharf; die
   nginx-Rewrite-Nachbildung existiert allein, um Fehlalarme zu tilgen.
6. **Gegen `dist/` prüfen, nicht gegen die Quelle** — verify-fx/help/typo/
   layers/sync lesen den gebauten Stand; was der Build verschluckt (z. B.
   `:global()` in `is:inline`), fällt nur so auf.

---

## 2) Warum jetzt — die Beweiskette

Chronologisch, alles aus Repo/Registern belegbar:

- **07/2026, −834 Items:** `sync:item-prices` revertete den Katalog gegen eine
  stale externe `global.ini`; bemerkt Wochen später. Seitdem existiert die
  *Gedächtnis*-Dauerregel „`collapsedNames` prüfen" — Maschine: keine.
- **08.08.2026, cf58c76:** `verify:theme` rief `git` auf — im Container gibt es
  kein git, **jeder staging-Build riss**, und weil das Tor „Image entsteht
  nicht" bedeutet, lieferte staging still den Stand vom Vortag. Aufgefallen ist
  es erst bei einer Sichtprobe, die sich über alte Inhalte wunderte
  (WINDOWS.md id 8).
- **09.08.2026, WINDOWS id 9:** `verify:layers` (344 Messungen, „0 unter der
  Marke") übersah `.eyebrow` 1,74:1 im Hellmodus — gefunden durch die
  Browser-Pixelmessung der Sichtprüfung. Die Lücke lag in der **Aufzählung**,
  nicht in der Messung; der Fix brachte Zusicherung 7 (Aufzählungswächter) und
  eine vorgeführte Gegenprobe.
- **09.08.2026, dieser Messlauf:** 2 von 9 losen Prüfern rot (§ 1.3), darunter
  ein realer Patch-Verzug des gesamten Datenbestands.

Die Klasse „HTML korrekt, Browser macht trotzdem etwas anderes" ist zusätzlich
die am dichtesten dokumentierte Fallensammlung des Projekts — alles Vorfälle,
die **kein einziges heutiges Tor sehen kann**: `clip-path` über
`backdrop-filter` (840 ms Menü-Eintritt), `:global()` in `is:inline` still
verworfen, Astro verschluckt schließende Tags nach Top-Level-Ausdrücken,
`theme.css` killt jede Scrollbar mit `!important`, klebende Filterspalte ohne
`max-height`, stale `?v=`-Cache-Busts, Kontrast 1,74:1 trotz grünem Tor.

---

## 3) Zielbild: drei Schienen, ein Register

Jede Prüfstrecke gehört genau **einer Schiene** an. Die Zuordnung steht
maschinenlesbar in `scripts/lib/gate-registry.mjs` (neu, W1) und wird von
`verify:wiring` erzwungen — damit „ein Skript liegt lose herum" ab jetzt selbst
ein roter Befund ist.

**Schiene A — Auslieferungs-Tor.** Läuft bei jedem Push auf `staging`/`main`
im Docker-Build. Harte Umgebungsregeln (alle bereits bezahlt gelernt):
kein git (cf58c76), kein Netz zu UEX (IP-Sperre gegen Rechenzentren — 403
trotz Token), keine Data.p4k (158 GB, nur lokal), deterministisch, Budget.
→ heute 9 Prüfer, nach W2/W4 **16** (inkl. `verify:metrics`).

**Schiene B — Datenlauf-Tor.** Läuft lokal auf der Betreiber-Maschine, wo
Data.p4k, installierter Client und freier UEX-Zugang existieren — immer dann,
wenn Daten erneuert werden (Patch-Tag, `datamine:*`, `sync:*`).
→ `verify:items`, `verify:vehicles`, `verify:hardpoints`, die
`datamine-* --verify`-Crosschecks, `collapsedNames`-Klinke, Client-Abgleich.

**Schiene C — Deploy-Wächter.** Prüft nicht den Code, sondern die
**ausgelieferte Seite**: trägt sie den Stand, den CI gerade grün gebaut hat?
→ W6 (Build-Stempel + `check:staging`); der Browser-Rauchtest (W5) läuft
CI-seitig gegen das fertige Image und ist damit A und C zugleich.

| Prüfstrecke | Schiene | Begründung |
|---|---|---|
| test:e2e, verify, verify:vendor, audit:csp, verify:crafting, verify:typo, verify:layers, verify:sync, verify:theme | A (ist) | offline, committete Eingaben + dist |
| audit:site, verify:fx, verify:help, verify:weapons, verify:vehicle-roles, verify:mining, **verify:metrics** (neu) | A (W2/W4) | dito; verify:minings Client-Klausel ist best-effort und in CI still |
| **browser-smoke** (neu) | A/C (W5) | gegen das fertige Image im Workflow, vor dem Push |
| verify:items | B | UEX/Wiki-Netz; UEX aus GitHub Actions gesperrt |
| verify:vehicles | B | braucht frischen Extraktionslauf (unversionierte Zwischenstufe) |
| verify:hardpoints | B | Vergleichsdaten entstehen nur beim Extraktionslauf |
| collapsedNames-Klinke (neu in gate:data) | B | Kennzahl existiert nur in der unversionierten Zwischenstufe `assets/items-gamefiles.json` |
| **check:staging / check:live** (neu) | C (W6) | fragt die ausgelieferte Seite |
| audit-typo-motion | — | Erhebungswerkzeug, benannte Registry-Ausnahme |

---

## 4) Verbindliche Bauregeln für jedes Tor

Destillat aus § 1.4 plus Umgebungsregeln. **Jedes Arbeitspaket in § 5 gilt erst
als fertig, wenn alle sieben Punkte belegt sind** — sie sind die
Abnahme-Checkliste und stehen deshalb vor den Paketen:

1. **Vorgeführt rot.** Die Negativkontrolle wird ausgeführt und im
   Plan/Summary protokolliert (welcher Bruch, welche Meldung), nicht behauptet.
   Ein Tor, das nie rot war, ist Dekoration.
2. **Selbstauskunft.** Das Tor druckt, *wie viele* Einheiten es geprüft hat
   (Seiten, Paare, Zeilen, Messstellen) — und schlägt fehl, wenn diese Zahl
   unter eine Sperrklinke fällt. Ein leerlaufender Wächter meldet sonst grün.
3. **FEHLER blockt, WARNUNG nicht — und Fehlalarme sind teurer als Lücken.**
   Ein Befund wird erst FEHLER, wenn er eine Handlungsanweisung trägt, die
   immer richtig ist. Fremdquellen-Verzug (Wiki, UEX-Drift) ist nie FEHLER.
4. **Torfähigkeit vor Verkabelung.** Für Schiene A vor dem Einhängen belegen:
   kein `git`-Aufruf, kein Netz, kein p4k-/Client-Zugriff (oder best-effort
   mit `existsSync`-Gatter wie in verify-mining), deterministisch, Laufzeit
   gemessen und im Budget (§ 5, W2).
5. **Sperrklinken statt Momentwerte.** Zählbare Bestände (Seiten, Items,
   Schiffe, Joins) werden gegen eine committete Untergrenze geprüft; die
   Klinke wandert nur per bewusstem Commit, dessen Diff die neue Zahl zeigt.
6. **Ausnahmen benannt + Zombie-Wächter.** Jede Ausnahme trägt Anlass und
   Fundstelle; das Tor reißt, wenn der Anlass verschwindet.
7. **Gegen das Artefakt prüfen.** `dist/` statt Quelle; das Image statt
   `dist/`, wo es das Image gibt (W5); die ausgelieferte Seite statt des
   Images, wo es um Deploy geht (W6).

---

## 5) Arbeitspakete

### W1 — Eine Wahrheit über die Torliste: `npm run gate` + Verkabelungs-Wächter

**Problem:** Die Torliste existiert genau einmal — als `RUN`-Zeile im
Dockerfile. `package.json` weiß nichts von ihr, lokal tippt man neun Befehle
oder vergisst sie, und ein neues verify-Skript *kann* lose liegen bleiben,
ohne dass irgendetwas meckert (genau so entstanden die 9 losen).

**Bauplan:**

1. `package.json`: neues Skript `gate` — die eine, kanonische Kette.
   Das Dockerfile ruft ab dann **nur noch** `RUN npm run gate` (der große
   Erklärkommentar bleibt und verweist auf die Registry). Damit können
   Dockerfile, CI und lokale Sitzungen nie wieder auseinanderlaufen.
2. `scripts/lib/gate-registry.mjs` (neu): jede Prüfstrecke mit Schiene und
   Begründung, Werkzeuge als benannte Ausnahmen:

   ```js
   // Schiene A = Auslieferungs-Tor (npm run gate, Dockerfile)
   // Schiene B = Datenlauf-Tor (npm run gate:data, lokal am Patch-Tag)
   // Schiene C = Deploy-Wächter (npm run check:staging / check:live)
   export const CHECKS = [
     { npm: 'test:e2e',        rail: 'A' },
     { npm: 'verify',          rail: 'A' },
     // …
     { npm: 'verify:items',    rail: 'B', why: 'UEX-Netz — aus GitHub Actions gesperrt (403, IP-Block; Token hilft nicht)' },
     { npm: 'verify:vehicles', rail: 'B', why: 'braucht frischen Extraktionslauf (vehicles-gamefiles.json ist unversioniert)' },
     { script: 'audit-typo-motion.mjs', rail: null, why: 'Erhebungswerkzeug Phase 2, kein Prüfer' },
   ];
   ```
3. `scripts/verify-wiring.mjs` (neu, selbst Teil von `gate`), vier
   Zusicherungen:
   - Z1: jedes `scripts/verify-*.mjs` / `audit-*.mjs` hat einen
     Registry-Eintrag (Vollständigkeit in beide Richtungen — kein Eintrag ohne
     Datei, keine Datei ohne Eintrag).
   - Z2: jedes Schiene-A-Skript steht in `package.json#gate`; kein
     B/C-Skript steht dort.
   - Z3: jedes Schiene-B-Skript steht in `package.json#gate:data` (W3).
   - Z4: Selbstauskunft: „N Skripte, A: x, B: y, C: z, Ausnahmen: w".
4. Reihenfolge in `gate`: die heutige Kette unverändert vorneweg (vertraut,
   schnellste Diagnose), Neues dahinter — s. W2.

**Negativkontrolle:** ein `scripts/verify-probe.mjs` anlegen → Z1 rot; ein
Schiene-A-Skript testweise aus `gate` nehmen → Z2 rot. Beides vorführen,
wieder aufräumen.

**Aufwand:** ~0,5 Tage. **Abhängigkeiten:** keine — W1 kommt zuerst, alle
weiteren Pakete tragen sich dort ein.

### W2 — Die sechs torfähigen Streuner ans Auslieferungs-Tor

**Kandidaten und Vorarbeiten** (alle Messwerte vom 09.08.):

| Prüfer | heute | Vorarbeit vor dem Einhängen |
|---|---|---|
| `verify:weapons` | ✅ 0,5 s | keine |
| `verify:vehicle-roles` | ✅ 0,4 s | keine |
| `verify:mining` | ❌ 0,5 s | **keine Code-Änderung nötig:** Der rote Befund ist ein echter Patch-Verzug (Schiene-B-Arbeit, W3); der Client-Abgleich ist per `existsSync(build_manifest.id)` best-effort und in CI automatisch still. Einhängen erst, nachdem der Datenlauf den Verzug behoben hat — **nie ein rotes Tor scharfschalten** |
| `verify:fx` | ✅ 11,6 s | keine |
| `verify:help` | ✅ 10,5 s | npm-Skript auf `--complete` heben (11/11 ist seit Wochen Realität; ohne Flag prüft es nur „Stand melden") |
| `audit:site` | ✅ 64,9 s | keine — 0 FEHLER; die 4 WARNUNGEN/30 INFOS bleiben Warnstufe |

**Neue Kette** (`gate`, Reihenfolge: Bestand zuerst, dann Neues schnell → langsam):

```
test:e2e → verify → verify:vendor → audit:csp → verify:crafting → verify:typo
→ verify:layers → verify:sync → verify:theme
→ verify:wiring → verify:metrics (W4) → verify:vehicle-roles → verify:weapons
→ verify:mining → verify:help → verify:fx → audit:site
```

**Budget:** heutige Kette ≈ 76 s + Neuzugänge ≈ 89 s → **≈ 165 s lokal**
(CI-Faktor unbekannt, erfahrungsgemäß ≤ 2×; der CI-Gesamtbuild lag zuletzt bei
~5–6 min — +1,5 min ist vertretbar). Sollte das Tor je zu teuer werden, ist
die Entlastungsregel vorab festgelegt: **audit:site bleibt als letztes, wird
aber nie entfernt** — es trägt als einziges die Datenherkunfts-Regel.

**Negativkontrolle:** je Neuzugang ein vorgeführter Bruch — z. B. ein
`data-help` aus einer Werkzeugseite löschen (verify:help), eine
`vehicle-roles.json`-Zeile tilgen (Klinke 223 reißt), einen toten Link in eine
Seite bauen (audit:site). Protokoll ins Summary.

**Aufwand:** ~0,5–1 Tag (der Löwenanteil ist das saubere Vorführen der
Negativkontrollen, nicht die Verkabelung).

### W3 — Schiene B formalisieren: `npm run gate:data` + Patch-Tag-Reihenfolge

**Problem:** Die Datenlauf-Prüfungen sind einzeln vorhanden, aber nirgends als
Ablauf festgeschrieben; zwei sind heute rot bzw. zahnlos (§ 1.3, § 1.2). Der
aktuelle Patch-Verzug (`12326004` → `12344265`) ist der konkrete Anlass, den
Ablauf einmal komplett zu fahren.

**Bauplan:**

1. `verify:items` **entschärfen, wo es Fremdträgheit misst:** die Klasse „Ort
   fehlt im Wiki" wird WARNUNG (Bauregel 3); FEHLER bleiben Join-/Dedupe-Fehler
   und tote Locations. Preis-Drift bleibt Meldung ohne Exit-Wirkung (ist
   Volatilität, kein Defekt).
2. `verify-hardpoints.mjs` **zum Prüfer machen:** npm-Skript
   `verify:hardpoints` anlegen; Exit-Logik ergänzen (FEHLER bei
   Hüllen-Verwechslung `sortDev > 30 %` auf exakter Zuordnung — heute 34
   benannte Verdachtsfälle, die erst beurteilt werden müssen: beurteilen,
   Schwelle ggf. je Schiff benennen, dann scharf); den fest verdrahteten
   Scratchpad-Pfad (`GTSUM`, Zeile 98 — zeigt in ein gelöschtes
   Sitzungsverzeichnis) durch einen Repo-Pfad unter `.cache/` ersetzen und
   Teil C als „übersprungen: N/A" ausweisen, wenn die Ground-Truth fehlt.
3. `package.json`: `gate:data` = `verify:items && verify:vehicles &&
   verify:hardpoints && verify:mining` — bewusst NACH einem frischen
   Extraktionslauf aufzurufen; `verify:mining` steuert hier den
   Client-Abgleich bei (der am Tor stille Teil ist lokal scharf).
4. `collapsedNames`-Klinke: kleiner Schritt in `gate:data`, der
   `assets/items-gamefiles.json` (existiert nur nach `datamine:items`) liest
   und `counts.collapsedNames` gegen die Baseline aus W4 hält. Damit wandert
   die letzte Gedächtnis-Dauerregel in eine Maschine.
5. **Patch-Tag-Reihenfolge** (im Dokumentkopf von `gate:data` als Kommentar,
   ersetzt verstreutes Playbook-Wissen):

   ```
   1. Client updaten, Changelist notieren (build_manifest.id)
   2. npm run datamine:items && npm run sync:items      # nie sync:item-prices allein
   3. npm run datamine:crafting / :mining / :loadouts / :vehicles / :components / :vehicle-roles
   4. npm run gate:data                                  # DIESER Schritt
   5. npm run build && npm run gate                      # Schiene A lokal
   6. committen (Kennungs-Diff zeigt die neue Changelist), auf staging
   ```

**Negativkontrolle:** `verify:items` gegen eine präparierte Kopie mit einem
Join-Duplikat (FEHLER bleibt scharf); `gate:data` ohne vorherigen
Datamine-Lauf → bricht mit klarer Meldung „Zwischenstufe fehlt — erst
datamine:items" ab statt still grün zu sein (derselbe Griff wie
`_test-prereqs.mjs`).

**Aufwand:** ~0,5 Tage (ohne den eigentlichen Datenlauf für den aktuellen
Patch-Verzug — der ist normale Patch-Tag-Arbeit nach Playbook).

### W4 — Kennzahlen-Sperrklinke: `verify:metrics` + committete Baseline

**Problem (L3):** Der Bestand kann heute still schrumpfen. Die −834-Items-Lehre
hat eine Gedächtnisregel erzeugt; Maschinen prüfen nichts davon. Dabei liegen
die Kennzahlen längst maschinenlesbar in committeten Artefakten.

**Bauplan:** `scripts/verify-metrics.mjs` (Schiene A, Ziel < 1 s) liest
**ausschließlich committete Artefakte** (kein Datamine-Wissen nötig) und prüft
gegen `data/metrics-baseline.json`. Startwerte = Ist vom 09.08.2026:

| Kennzahl | Quelle | Ist 09.08. | Regel |
|---|---|---|---|
| `items` | `assets/universal-items.json#counts` | 9.168 | min, Toleranz −1 % |
| `withObtain` | ebd. | 4.574 | min, −1 % |
| `withGameData` | ebd. | 6.642 | min, −1 % |
| `uexRows` | ebd. | 23.705 | min, −5 % (Preiszeilen schwanken) |
| `armorSets` | ebd. | 136 | min |
| `vehicles` | `src/data/vehicles.json` | 227 | **exakt**, Änderung nur per Baseline-Commit |
| `shipComponents` | `src/data/ship-components.json` | 223 | min |
| `vehicleRoles` | `src/data/vehicle-roles.json#count` | 223 | min (deckt sich mit Klinke im Prüfer — hier zusätzlich, damit EIN Ort alle Bestände zeigt) |
| `hardpointShips` | `src/data/ship-hardpoints.json` | 227 | min |
| `blueprints` | `assets/crafting-db.json` | 1.594 | min |
| `minerals` | `assets/mining-db.json` | 37 | min |
| `distPages` | `dist/**/*.html` | 17.361 | min, −2 % |
| `distItems` / `distMissionen` / `distCrafting` / `distSchiffe` / `distPatches` / `distTopics` | `dist/<bereich>` | 5.386 / 1.347 / 1.655 / 227 / 19 / 22 | min |
| `sitemaps` | `dist/sitemap*.xml` | 6 | exakt |
| `helpTools` | via verify:help | 11 | min (bleibt dort geprüft, hier gespiegelt) |

Baseline-Format bewusst schlict — Zahl, Regel, Anlass:

```json
{ "vehicles": { "wert": 227, "regel": "exakt",
    "anlass": "01.4-03: 223 + 4 ATLS; Aenderung nur mit neuem Datamine-Beleg" },
  "items":    { "wert": 9168, "regel": "min", "toleranzProzent": 1,
    "anlass": "Messlauf 09.08.2026; Lehre aus dem -834-Vorfall 07/2026" } }
```

**Update-Ritual:** Wächst der Bestand, schlägt nichts an; die Baseline wird
gelegentlich per bewusstem Commit nachgeführt (Diff zeigt die Entwicklung).
Schrumpft er, reißt das Tor, und die einzige legitime Antwort ist ein
Baseline-Commit, dessen Botschaft die Ursache nennt — das ist Bauregel 5.

**Negativkontrolle:** Baseline testweise `vehicles: 228` → rot mit klarer
Meldung; eine Kennzahl aus der Baseline löschen → rot („Kennzahl ohne Regel"),
damit die Baseline selbst nicht still erodieren kann.

**Aufwand:** ~0,5 Tage. **Hängt an:** W1 (Registry-Eintrag).

### W5 — Browser-Rauchtest: das eine neue Werkzeug

**Problem (L2):** Kein Tor lädt eine Seite in einen echten Browser. Die
gesamte Fallenklasse „HTML korrekt, Browser macht was anderes" (§ 2) ist
unbewacht; die Bodenwahrheit-Messung, die id 9 fand, war Einmal-Handarbeit im
Scratchpad — nichts davon ist committet (belegt: `playwright` kommt in keiner
`package.json` und keinem `scripts/`-Skript vor).

**Architektur-Entscheid: gegen das fertige Image, vor dem Push.** Der
Dockerfile-Kommentar begründet, warum die Tore im Docker-Build sitzen (dist/
existiert dort schon). Für den Browser gilt dasselbe Argument eine Stufe
später: Die CSP ist ein **nginx-Header** ([nginx/default.conf:145](../nginx/default.conf)) —
nur ein *laufender Container* zeigt sie; ebenso Rewrites und 404-Verhalten.
Der Workflow wird deshalb umgebaut von „build+push in einem Schritt" zu:

```yaml
# deploy-staging.yml (deploy-image.yml analog, ohne STAGING)
- uses: docker/build-push-action@v6
  with: { context: ., load: true, build-args: STAGING=1,
          tags: "ghcr.io/cibakhun/sc-patch-archive:staging" }   # load statt push
- run: docker run -d --rm -p 8080:80 --name smoke ghcr.io/cibakhun/sc-patch-archive:staging
- uses: actions/setup-node@v4
  with: { node-version: 22, cache: npm }
- run: npm ci && node scripts/browser-smoke.mjs --base http://localhost:8080
- run: docker push ghcr.io/cibakhun/sc-patch-archive:staging   # erst NACH grünem Rauchtest
```

Das prüft exakt das Artefakt, das ausgeliefert würde, kostet keinen zweiten
Seiten-Build und verlängert den Workflow um ~1–2 min. Die robots-Gegenprobe
(deploy-staging.yml:58) bleibt und rückt hinter den Rauchtest.

**Werkzeug:** `playwright-core` als devDependency (~5 MB, ausdrücklich **kein**
Browser-Download — Erfahrungswert der Sichtprüfungen). Browser-Auflösung in
dieser Reihenfolge: `CHROME_PATH`-Env →
`C:\Program Files\Google\Chrome\Application\chrome.exe` (lokal vorhanden,
geprüft) → `/usr/bin/google-chrome` (auf `ubuntu-latest` vorinstalliert) →
`/usr/bin/chromium`.

**`scripts/browser-smoke.mjs` — Prüfmatrix.** Seitenliste als Konfig im
Skriptkopf; Start mit den Leitseiten (je EN **und** DE):

| Seite | Sonderprobe |
|---|---|
| `/` + `/de.html` | Wortmarken-Wandlung vorhanden (Element), Scroll ohne Konsolenfehler |
| `/item-finder.html` (+ de) | **Interaktion:** Suchfeld „Arrow" → Trefferzahl ändert sich und ist > 0 |
| `/schiffe.html` (+ de) | **Interaktion:** Rollenfilter setzen → Zähler sinkt, Karten > 0 |
| `/crafting.html` (+ de) | Karten > 1.000 gerendert (clientseitige Liste lebt) |
| `/archiv.html` (+ de) | Ären-Liste gerendert, 0 Konsolenfehler |
| `/sc-4-9-0.html`-Patchseite (+ de) | Ambiente bleibt aus (FX-Vertrag: keine rAF-Schleife ohne Opt-in) |
| `/topics/mining.html` (+ de) | zwei ToolHelp-Instanzen vorhanden |
| `/missionen.html`, `/armor-sets.html`, `/precision-jump.html`, `/support.html`, `/downloads.html` (+ de) | Leitelement sichtbar |
| `/refinery.html` | leitet abgemeldet sauber um (R-1) |
| ein statisches Item-Detail (z. B. `/items/hardy-boots.html` + de) | Technische-Daten-Abschnitt vorhanden |
| `/404`-Fall (`/gibtsnicht.html`) | echte 404-Seite, kein nginx-Standardblatt |

Zusicherungen je Ladevorgang:

- **Z1** kein `pageerror` (unbehandelte JS-Ausnahme);
- **Z2** kein same-origin-Request mit Status ≥ 400 (fängt stale `?v=`-Busts,
  fehlende Assets);
- **Z3** kein CSP-Verstoß (`securitypolicyviolation`-Listener). Externe
  Requests werden per Route-Interception **abgebrochen und nicht gewertet** —
  CI hat keinen stabilen Weg ins Netz, und Fremd-Ausfälle sind keine
  Site-Fehler. Beim Lauf gegen die staging-**URL** (lokale Variante) ist der
  Cloudflare-RUM-Beacon der eine erwartete Verstoß (Dockerfile:72-79) —
  benannte Ausnahme mit Zombie-Wächter;
- **Z4** Leitelement der Seite ist sichtbar (`offsetParent`-Kette, nicht nur
  im DOM);
- **Z5** kein horizontaler Overflow (`scrollWidth ≤ innerWidth + 1`) — die
  wiederkehrende 360-px-Falle;
- **Z6** Selbstauskunft: N Seiten × M Varianten geladen, Klinke gegen
  Config-Schwund.

Varianten-Matrix mit Budget: alle Seiten in **Dunkel/1280×720**; die fünf
JS-schwersten (Item-Finder, Schiffe, Crafting, Startseite, Patch-Seite)
zusätzlich in **360×740** und **Hell**. Hellmodus ist Admin-only — das Rezept
sind die drei erprobten Kniffe der Sichtprüfung, wörtlich:

```js
await page.goto(url);                       // 1. erst echter Ursprung, sonst landet Storage im Nirgendwo
await page.evaluate(() => {
  sessionStorage.vb_user_role = '{"role":"admin"}';
  localStorage['vb.theme'] = 'light';
  localStorage['vb.help.seen'] = '{"all":1}';   // Erstbesuch-Hilfe verdeckt sonst die Messung
});
await page.reload();                        // 2. neu laden
await page.evaluate(() =>                   // 3. reconcile() zieht sonst nach ~200 ms zurück
  document.documentElement.setAttribute('data-theme', 'light'));
// Gegenprüfung ist Pflicht: steht data-theme wirklich auf light?
```

Dazu eine `prefers-reduced-motion`-Probe auf zwei Seiten (kein
`.reveal`-Element bleibt unsichtbar — das id-6-Muster „0 von 15 unsichtbar")
und **fünf benannte Pixel-Kontrast-Stichproben** nach dem Verfahren der
Sichtprüfung (Median = Untergrund, 2./98. Perzentil = Schrift; nur dünne
Schrift, Messkasten darf kein Nachbarelement streifen). Ausdrücklich
Stichprobe, nicht Fläche: die Fläche gehört `verify:layers`; die Stichprobe
ist die Bodenwahrheit, die id 9 gefunden hätte.

**Lokal:** dasselbe Skript gegen `npx astro preview` oder eine beliebige URL
(`node scripts/browser-smoke.mjs --base https://staging.verse-base.com`) —
Letzteres ist zugleich die Schiene-C-Probe nach einem Deploy. ⚠ Gegen
`verse-base.com` von CI aus ist der Cloudflare-Bot-Fight-Mode ein bekanntes
Risiko — der Live-URL-Lauf bleibt deshalb lokal.

**Negativkontrolle:** drei vorgeführte Brüche — (a) `<script>throw new
Error('probe')</script>` in eine Seite → Z1; (b) ein Asset-Verweis auf
`/assets/gibtsnicht.js` → Z2; (c) `display:none` auf das Leitelement des
Item-Finders → Z4.

**Aufwand:** ~1–1,5 Tage (0,5 Skript-Gerüst + Seitenliste, 0,5
Workflow-Umbau + CI-Browser, Rest Negativkontrollen und Feinschliff).
**Hängt an:** W1 (Registry), nicht an W2–W4.

### W6 — Deploy-Frische: Build-Stempel + `check:staging`

**Problem (L4):** „Fertig-Meldung erst, wenn die ausgelieferte Seite den neuen
Stand zeigt" ist heute Handarbeit (Seite aufrufen, Inhalt wiedererkennen). Als
cf58c76 die CI riss, fiel der stale Zustand erst in einer Sichtprobe auf; als
Coolify 20 Minuten hing, war „CI grün" die falsche Auskunft.

**Bauplan:**

1. Build-Stempel: kleines `scripts/_write-build-stamp.mjs` am Ende der
   `build`-Kette schreibt `dist/build.json`:
   `{ "sha": "<GIT_SHA>", "staging": true|false, "builtAt": "<ISO>" }`.
   Die SHA kommt als **Docker-`ARG GIT_SHA`** herein (Workflows geben
   `${{ github.sha }}` mit) — im Container gibt es kein git, genau daran ist
   verify:theme einmal gestorben; lokal fällt der Stempel auf `"dev"`.
2. `scripts/check-deployed.mjs` (neu): holt `<base>/build.json`, vergleicht
   mit dem erwarteten Stand (Argument oder `git rev-parse origin/staging`),
   meldet Alter und Ergebnis. npm-Skripte `check:staging` / `check:live`.
3. Workflow-Schritt nach dem Coolify-Trigger: bis zu N Minuten pollen, bis
   staging den frisch gepushten SHA ausliefert — sonst **Workflow rot**. Damit
   wird ein hängender Coolify-Deploy zum sichtbaren Ereignis statt zum
   stillen Zustand. (Zu verproben: ob Cloudflare den CI-Poll durchlässt —
   `build.json` ist eine statische Datei; falls der Bot-Fight-Mode ihn
   challengt, bleibt der Poll lokal und der Workflow-Schritt entfällt,
   der Rest des Pakets behält seinen Wert.)
4. Sitzungsregel (CLAUDE.md, s. W7): Die Fertig-Meldung einer Sitzung zitiert
   die Ausgabe von `npm run check:staging` — die bestehende Playbook-Regel
   wird damit maschinenprüfbar.

**Negativkontrolle:** `check:staging` gegen einen absichtlich falschen
Soll-SHA → rot; gegen eine URL ohne `build.json` → klare Meldung statt
Absturz.

**Aufwand:** ~0,5 Tage. **Hängt an:** nichts (W1-Eintrag als Schiene C).

### W7 — Zweig-Rückmeldung (Entscheidung des Betreibers)

**Problem (L5):** `claude/*`-Zweige laufen ohne jede CI; das Tor schlägt erst
auf `staging` zu — der Fehler einer Sitzung landet damit zwangsläufig im
Integrationszweig, bevor ihn eine Maschine sieht.

**Zwei Wege, bewusst als Wahl formuliert:**

- **W7a — `ci.yml` auf `claude/**`-Pushes:** checkout → `npm ci` → Build →
  `npm run gate` (ohne Docker, ohne Rauchtest). Kostet je Push ~6–8
  CI-Minuten; bei einem privaten Repo sind das zählbare Actions-Minuten —
  bei der heutigen Frequenz vieler paralleler Sitzungen der Hauptgrund,
  warum das eine Betreiber-Entscheidung ist und keine Selbstverständlichkeit.
- **W7b — Sitzungsregel statt CI:** eine `CLAUDE.md` im Repo-Wurzelverzeichnis
  (existiert noch nicht) macht `npm run build && npm run gate` zur Pflicht vor
  jedem `git push origin HEAD:staging`, und `npm run check:staging` zur
  Pflicht vor jeder Fertig-Meldung. Kostet nichts, wirkt auf jede Sitzung,
  hängt aber an Regeltreue statt an einer Maschine.

Empfehlung: **W7b sofort** (Textvorschlag unten), **W7a später**, falls trotz
W7b rote staging-Builds auflaufen. Vorschlag für die CLAUDE.md-Kernzeilen:

```markdown
## Lieferregeln (maschinelle Validierung)
- Vor jedem Push auf staging: `npm run build && npm run gate` — beides grün.
- Nach Datenläufen (datamine:*/sync:*): zusätzlich `npm run gate:data`.
- Fertig-Meldung erst nach grünem `npm run check:staging` (Deploy zeigt den neuen Stand).
- Neue Prüfskripte werden in scripts/lib/gate-registry.mjs eingetragen — verify:wiring erzwingt das.
- Jedes neue Tor wird vorgeführt rot (Negativkontrolle im Summary protokolliert).
```

**Aufwand:** W7b ~0,25 Tage; W7a ~0,5 Tage inkl. Minuten-Abschätzung.

---

## 6) Reihenfolge und Abnahme

| # | Paket | Aufwand | hängt an | lieferbar für sich? |
|---|---|---|---|---|
| 1 | W1 Registry + `npm run gate` | 0,5 T | — | ja — sofortiger Nutzen lokal |
| 2 | W2 sechs Streuner ans Tor | 0,5–1 T | W1; verify:mining erst nach Datenlauf | ja |
| 3 | W4 Kennzahlen-Sperrklinke | 0,5 T | W1 | ja |
| 4 | W3 `gate:data` + Patch-Tag-Ablauf | 0,5 T | W1 (Anlass: aktueller Patch-Verzug) | ja |
| 5 | W6 Deploy-Frische | 0,5 T | — | ja |
| 6 | W5 Browser-Rauchtest | 1–1,5 T | W1 | ja |
| 7 | W7 Zweig-Rückmeldung | 0,25–0,5 T | Betreiber-Entscheid | ja |

Jedes Paket ist erst fertig, wenn die **sieben Bauregeln aus § 4 belegt** sind
(insb. vorgeführte Negativkontrolle + Selbstauskunft) und die Lieferung nach
Playbook auf `staging` liegt. W2 trägt eine Sonderbedingung: `verify:mining`
wird erst eingehängt, wenn der aktuelle Patch-Verzug per Datenlauf behoben ist
— ein Tor darf nie rot geboren werden.

---

## 7) Bewusst nicht gebaut

| Verworfen | Warum |
|---|---|
| Pixel-Screenshot-Vergleiche über die 17.361 Seiten | Bei einer designlastigen, laufend umgebauten Seite produziert das rote Tore, die keiner mehr ansieht — der sichere Weg in Fehlalarm-Blindheit (Bauregel 3). Der Rauchtest prüft Verhalten und benannte Kontrast-Stichproben, keine Bildgleichheit |
| Unit-Tests für Astro-Komponenten | Die Komponenten sind Hüllen; die Logik liegt in `src/lib/` und Inline-Skripten — Letztere testet die e2e-Suite bereits **als echte Skripte in `node:vm`** |
| Supabase-/Konto-Flüsse am Tor | Ein Tor gegen einen echten Fremddienst wird flaky; Konto-Sichtrunden bleiben Handarbeit mit WINDOWS.md-Eintrag (Präzedenz id 2) |
| UEX-Abgleich am Auslieferungs-Tor | Technisch unmöglich (IP-Sperre) und inhaltlich falsch: Preisdrift ist kein Baufehler. Schiene B |
| Lighthouse-/Performance-Budgets | Echter Kandidat für später — erst, wenn die fünf Lücken zu sind; ein halbherziges Perf-Tor jetzt verwässert die Kette |
| „Mehr Prüfer bauen" vor der Verkabelung | Der Messlauf zeigt: die vorhandenen Prüfer nicht laufen zu lassen ist das Problem, nicht ihre Zahl |

---

## 8) Ehrliche Grenzen

Maschinen sichern hier **Regressionen und Invarianten** — nicht Qualität:

- **Sichturteile bleiben Sichturteile.** „Trägt das Motiv noch", „liest sich
  als ein Bewegungsbild" entscheidet kein Skript; der WINDOWS.md-Prozess
  (benannte Punkte, an den Betreiber übergeben, Phase erst danach „Complete")
  bleibt unverändert in Kraft. Die Tore machen Sichtrunden seltener nötig und
  besser vorbereitet (sortierte Verdachtslisten wie in id 6) — nie überflüssig.
- **Kennzahlen messen die Untergrenze, nicht die Güte.** 344 grüne Messungen
  bewiesen nicht, dass alles gut aussieht — sondern nur, dass die 344
  aufgezählten Stellen über der Marke lagen (id 9). Deshalb tragen neue Tore
  Aufzählungswächter, und deshalb bleibt „erst hinsehen, dann berichten" die
  Regel für alles Sichtbare.
- **Gegen schwankende KI-Ausgabequalität** wirken die Tore genau zur Hälfte:
  Sie fangen *Gebrochenes* (und mit W5 erstmals die Browser-Klasse), aber
  keinen schlechten-aber-funktionierenden Code. Die andere Hälfte bleibt
  Review und die Sitzungsregeln aus W7b — dafür machen die Tore „fertig"
  erstmals zu einem maschinenprüfbaren Begriff (`gate` grün + `check:staging`
  grün) statt zu einer Behauptung.

---

## Anhang: Messlauf vom 09.08.2026

Umgebung: Windows 11, Node 22.18, frischer Worktree auf `46ba9e3`
(= `origin/staging`), `npm ci` 8 s, `npm run build` 114 s (Astro-Anteil
81,45 s, 17.357 Seiten laut Build-Log; 17.361 HTML-Dateien in `dist/` inkl.
404/Onepager-Zählweise). Reihenfolge wie ausgeführt:

| Prüfer | Exit | Laufzeit | Kernbefund |
|---|---|---|---|
| `test:e2e` | 0 | 11,1 s | 234/234 Tests, 44 Suiten |
| `verify` | 0 | 12,5 s | 0 gebrochene Verweise |
| `verify:vendor` | 0 | 0,5 s | three.js deckungsgleich |
| `audit:csp` | 0 | 10,8 s | 10 externe Quellen, alle abgedeckt |
| `verify:crafting` | 0 | 1,3 s | Chips == Spieldaten, Kollisionssperre hält |
| `verify:typo` | 0 | 12,3 s | 6/6, Klinke 235.775 |
| `verify:layers` | 0 | 12,9 s | 7/7, 344 Messstellen |
| `verify:sync` | 0 | 12,0 s | 0 unerklärte Abweichungen / 8.678 Paare |
| `verify:theme` | 0 | 1,7 s | 0 Handänderungen, EXCLUSIONS leer |
| `audit:site` | 0 | 64,9 s | 0 FEHLER, 4 WARNUNGEN (u. a. Wikelo-PNGs 1,5–1,8 MB), 30 INFOS |
| `verify:fx` | 0 | 11,6 s | 7/7 über 8.678 Paare |
| `verify:help --complete` | 0 | 10,5 s | 11/11 Werkzeuge, 6 Zusicherungen |
| `verify:weapons` | 0 | 0,5 s | Selbstauskunft gedruckt, 0 Abweichungen |
| `verify:vehicle-roles` | 0 | 0,4 s | 223 ≥ Klinke 223 |
| `verify:mining` | **1** | 0,5 s | **Datenstand 12326004 ≠ installierter Client 12344265** |
| `verify-hardpoints.mjs` | 0* | 0,1 s | *kein Exit-Code vorhanden; Bericht: 34 Hüllen-Verdachtsfälle, 66 Komponenten-Abweichungen/126, Teil C übersprungen (stale Pfad) |
| `verify:items` | **1** | 13,4 s | 23.679 Zeilen identisch, 26 Drifts, 0 tote Locations, **128 Orte fehlen im Wiki** (Wiki-Verzug → Herabstufungs-Kandidat, W3) |

Reproduktion: `npm ci && npm run build`, dann die Befehle der Tabelle;
`verify:items` braucht freien UEX-Zugang (nicht aus GitHub Actions),
`verify:mining`s Client-Abgleich die lokale Spielinstallation,
`verify:vehicles` einen frischen `datamine:vehicles`-Lauf.
