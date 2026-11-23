# Entwicklung

Wie VerseBase gebaut, geprüft und ausgeliefert wird. Die verbindlichen
Arbeitsregeln stehen in [`CLAUDE.md`](../CLAUDE.md), das Prüfkonzept in
[`maschinelle-validierung.md`](maschinelle-validierung.md).

## Technik

**[Astro](https://astro.build) 5**, statischer Build, kein Server-Rendering. Ein
Live-Build umfasst über 18.000 Seiten. Alle Daten werden zur *Bauzeit*
eingebacken: die ausgelieferte Seite ruft keine eigene API auf, hat keine
Laufzeit-Schlüssel und keine Ratelimits.

`build.format: 'file'` heißt: jede Seite ist eine echte Datei
(`src/pages/patches/sc-4-8-2.astro` → `/patches/sc-4-8-2.html`). Die
`.html`-Endung ist Teil der URL und steht so auch in jedem internen Link.

Zweisprachig: **Englisch ist die Standardsprache und liegt präfixlos auf der
Wurzel**, Deutsch unter `/de/…` (die deutsche Startseite ist `/de.html`).

Benutzerkonten (Profil, Favoriten, Flotte, Refinery-Aufträge, Crafting-Besitz)
laufen clientseitig gegen **Supabase**; die Seite bleibt statisch. Row Level
Security schützt die Daten, nicht der Schlüssel: der Publishable Key steht
bewusst im Quelltext. Live und Vorschau haben getrennte Supabase-Projekte
(`scripts/lib/supabase-ziel.mjs`).

```
src/pages/        Seitenbaum (EN auf der Wurzel, DE unter de/)
src/components/   geteilte Bausteine (SiteNav, ItemFinderApp, ShipDetail …)
src/lib/          Bau-Zeit-Logik (SEO, Archiv-Modell, Routen-Zwillinge …)
src/i18n/         UI-String-Kataloge DE/EN
src/data/         Daten-Schnappschüsse (Patches, Schiffe, Missionen …)
src/content.config.ts  typisierte Patch-Collection (Zod-Schema)
assets/           kanonische Bilder/CSS/Client-JS → wird nach public/ gespiegelt
public/           was 1:1 ausgeliefert wird (inkl. vendortes three.js)
scripts/          Datenaufbereitung, Bau-Helfer, Prüfungen
tests/e2e/        node:test: Verhalten, Datenbank, gebautes Layout, Konfiguration
nginx/            Auslieferungs-Konfiguration des Origins
supabase/         Migrationen und Edge Functions
discord/          Server-Builder und Dauer-Bot (eigenes Deployment)
docs/             diese Doku
.planning/        Arbeitsstand: Roadmap, Phasen, Notizen, Sichtprüfungen (WINDOWS.md)
```

## Loslegen

Node.js 22.

```bash
npm ci
npm run dev
```

`dev` und `build` erzeugen vorab Thumbnails, die Downloads-Übersicht und
spiegeln `assets/` nach `public/assets/`. Deshalb immer über die npm-Skripte
gehen, nie `astro dev` direkt aufrufen.

```bash
npm run build          # vollständiger Build nach dist/ (einige Minuten)
npm run preview        # den Build lokal ausliefern
```

Unter Windows/PowerShell `npm.cmd` statt `npm`.

## Prüfen

**Ein Befehl, und es ist derselbe wie im Dockerfile:**

```bash
npm run gate
```

Das ist das Auslieferungs-Tor (Schiene A). Es läuft nach einem Build und prüft
alles, was auch der CI-Build prüft, bevor ein Image entsteht. Schlägt eine
Strecke fehl, entsteht kein Image, und Coolify liefert weiter den letzten guten
Stand. **Vor jedem Push einmal grün gesehen haben.**

```bash
npm run gate -- --list            # nur zeigen, was liefe
npm run gate -- --only verify:fx  # eine einzelne Strecke, zur Diagnose
npm run gate -- --continue        # nicht beim ersten Fehler abbrechen
npm run gate:data                 # Schiene B: nach jedem Datenlauf
```

Jeder Lauf sagt in der Kopfzeile, **woran** er grün war: gegen den Live-Build
oder gegen den Vorschau-Build. Die beiden unterscheiden sich in der
SEO-Oberfläche (`STAGING=1` → site-weit `noindex`, gesperrte `robots.txt`,
absichtlich leere Sitemaps) und darin, dass nur der Vorschau-Build den Hangar
enthält. Das reicht, damit dieselbe Kette lokal grün und in CI rot sein kann.
Den Vorschau-Build lokal nachstellen:

```powershell
$env:STAGING = '1'; npm run build; npm run gate
```

Welche Strecken zu welcher Schiene gehören, steht in
[`scripts/lib/gate-registry.mjs`](../scripts/lib/gate-registry.mjs), und nur
dort. `verify:wiring` (erste Strecke im Tor) schlägt fehl, sobald ein
Prüfskript ohne Eintrag im Bestand liegt, ein Eintrag ins Leere zeigt oder eine
Strecke git, Netz oder einen Kindprozess anfasst, ohne es zu erklären. Schiene B
läuft nur lokal auf dem Betreiber-Rechner, weil sie die Spielinstallation oder
freien UEX-Zugang braucht; aus GitHub Actions ist UEX gesperrt.

Eine Strecke kann im Verzeichnis **ausgesetzt** sein (`disabled`), wenn sie aus
einem benannten Grund gerade rot ist. Jeder Lauf druckt diese Schuldenposten am
Ende, damit sie niemand vergisst; `npm run gate -- --only <name>` ruft eine
ausgesetzte Strecke gezielt auf, um sie abzutragen.

### Browser-Rauchtest (Schiene C)

Das einzige Verfahren, das eine Seite in einem **echten Browser** lädt, gegen
die Klasse „HTML korrekt, Browser macht trotzdem etwas anderes“:

```bash
npm run preview                                      # Terminal 1
npm run smoke -- --base http://localhost:4321        # Terminal 2
```

Die Leitseiten je EN und DE in mehreren Breiten: keine JS-Ausnahme, keine
eigene Ressource ≥ 400, kein CSP-Verstoß, Leitelement wirklich sichtbar, kein
waagerechter Überlauf, dazu Interaktionsproben. Die vollständige Liste der
Zusicherungen steht im Kopf von
[`scripts/browser-smoke.mjs`](../scripts/browser-smoke.mjs). Braucht
`playwright-core` (schon als devDependency) und einen installierten Chrome oder
Edge; ein anderer Pfad geht über `CHROME_PATH`.

In CI läuft er gegen den **fertigen Container**, und zwar vor dem Push: die CSP
ist ein nginx-Header und existiert nur dort.

### Liefert die Seite wirklich den neuen Stand? (Schiene C)

```bash
npm run check:staging        # gegen staging.verse-base.com
npm run check:live           # gegen verse-base.com
npm run check:headers        # Kopfzeilen und CSP von staging
npm run check:headers:live   # Kopfzeilen und CSP von live
```

Jeder Build schreibt `dist/build.json` mit der Commit-Kennung. `check:*` holt
sie von der ausgelieferten Seite und vergleicht sie mit `origin/staging` bzw.
`origin/main`, und prüft nebenbei, dass Vorschau und Live nicht vertauscht sind.
**Das ist die einzige belastbare Antwort auf „ist es draußen?“**: „CI grün“ ist
keine.

Und zwar **vom Entwicklungsrechner aus**: Cloudflare weist GitHub-Runner ab. Der
Warte-Schritt in den Workflows bleibt bestehen, meldet bei einer Sperre aber
ehrlich „NICHT geprüft“, statt grün zu tun.

Einzeln aufrufbar bleibt weiterhin alles:

```bash
npm run test:e2e       # node:test, braucht einen Build (sagt es sonst)
npm run verify         # jede lokale href/src/url() in dist/ zeigt auf eine Datei
npm run verify:vendor  # vendortes three.js passt zur devDependency
npm run audit:csp      # die CSP in nginx/default.conf deckt alles ab, was lädt
npm run audit:site     # Links, Anker, Sitemap, hreflang, SEO, A11y, Gewichte
```

`audit:site` unterscheidet **FEHLER** (blockiert die Veröffentlichung) von
WARNUNG und INFO. Es kennt die Rewrites aus `nginx/default.conf`, meldet also
keine Links als tot, die der Server sehr wohl ausliefert.

`audit:csp` misst die Content-Security-Policy gegen den fertigen Build: welche
externen Hosts, Blob-Worker und WebAssembly-Nutzungen tatsächlich vorkommen und
ob die Richtlinie sie deckt. Eine zu enge CSP bricht nicht beim Deploy, sondern
still im Browser des Besuchers.

Inline-Skripte laufen per Hash statt `'unsafe-inline'`: der letzte Schritt von
`npm run build` (`scripts/_write-csp-hashes.mjs`) rechnet die sha256 aller
Inline-Skripte nach `dist/_csp/`, nginx liest sie per `include`. `audit:csp`
sichert zu, dass jedes Inline-Skript seinen Hash hat und kein Inline-Handler
(`onclick=…`) ohne benannte Ausnahme im Build steht. Neue Handler gehören als
Listener nach `assets/`, Bild-Rückfälle als `data-img-fail` ans `<img>`. Der
Umami-Zähler kommt als gepinnte Kopie vom eigenen Ursprung
(`public/vendor/zaehler/zaehler.js`, erneuern mit
`node scripts/vendor-umami.mjs <tag>`, Anleitung im Kopf der Datei). Der Pfad
trägt bewusst nicht „umami“: Werbeblocker-Listen sperren `/umami/script.js`.

## Ausliefern

| Zweig | Workflow | Image | Ziel |
|---|---|---|---|
| `staging` | [`deploy-staging.yml`](../.github/workflows/deploy-staging.yml) | `ghcr.io/…:staging` | staging.verse-base.com (Vorschau-Build, Tester-Anmeldung) |
| `main` | [`deploy-image.yml`](../.github/workflows/deploy-image.yml) | `ghcr.io/…:latest` | verse-base.com |

Push → GitHub Actions baut das Docker-Image → `ghcr.io` → Coolify zieht das
fertige Image. **Auf dem Server wird nicht gebaut** (er hat zu wenig Speicher).
Pull Requests gegen `staging` oder `main` durchlaufen vorher
[`pr-check.yml`](../.github/workflows/pr-check.yml).

Das Qualitätstor sitzt im [`Dockerfile`](../Dockerfile), nicht im Workflow:
nach `npm run build` läuft dort `npm run gate`. Fällt eine Strecke durch,
entsteht kein Image, und Coolify behält den letzten guten Stand.

Vor der Kante steht Cloudflare (TLS). Sicherheits-Header, Cache-Control und die
Rewrites setzt der Origin in [`nginx/default.conf`](../nginx/default.conf).

[`build.yml`](../.github/workflows/build.yml) ist ein separater **Knopf für den
Patch-Day**: er zieht frische Schnappschüsse der Fremdquellen, committet sie
nach `main` und baut. Die Sync-Schritte sind absichtlich nicht fatal: fällt
eine Fremd-API aus, baut die Seite mit dem letzten guten Schnappschuss weiter.

Wie die Live-Datenbank gesichert und zurückgespielt wird, steht in
[`betrieb/datenbank-backup.md`](betrieb/datenbank-backup.md).

## Daten

Alle Daten liegen als Schnappschuss im Repo (`src/data/`, `assets/*.json`).
**Für Bauen und Entwickeln ist kein Datenzugang nötig.** Die Datenläufe, die
diese Schnappschüsse nach einem Patch erneuern, laufen lokal auf dem
Betreiber-Rechner und stehen als Skripte in `package.json`; danach gehört
`npm run gate:data` dazu.

Fremdquellen werden auf der Seite genannt: Preise von UEX Corp,
Hologramm-Dateien, Lacke und Varianten von FleetYards, Wiki-Texte von
starcitizen.tools (CC BY-SA 4.0).

## Mitschreiben

- Interne Links sind **root-relativ und tragen `.html`** (`/schiffe/x.html`).
  Verschiebt sich das Deploy-Ziel, ändern sich nur `site` in
  `astro.config.mjs` und `SITE.url` in `src/consts.ts`.
- Handverlinkte Dateien unter `/assets/` brauchen einen **Content-Hash als
  `?v=`** (siehe `ItemFinderApp.astro`). Ohne ihn bekommen wiederkehrende
  Besucher bis zu 24 Stunden lang das alte Skript zum neuen HTML.
- Der Sprachumschalter ermittelt selbst, ob es die Seite in der anderen Sprache
  gibt (`src/lib/routeTwins.ts`); es ist nichts von Hand zu pflegen.
- „Fertig“ heißt **DE und EN**. Der Audit zählt beide Bäume getrennt.
- Keine erfundenen Werte. Fehlt eine Angabe, wird das im UI gesagt („Nur
  Katalog“, „Kein Fundort bekannt“), statt zu schätzen.
- Der Hangar gehört nur in den Vorschau-Build; neue Links dorthin fragen
  `HAS_HANGAR` (Seite) bzw. `HANGAR_ON` (Skript), siehe
  `scripts/lib/hangar-switch.mjs`.
