# VerseBase

Inoffizielles Star-Citizen-Kompendium unter [verse-base.com](https://verse-base.com):
Item Finder, Bergbau- und Crafting-Datenbank, Schiffs-Datenblätter mit
3D-Hologramm, Missionen, Wikelo-Handel, Aaron-Halo-Routenrechner — und das
komplette Patch-Archiv von Alpha 4.0.0 bis 4.9.0, jede Version mit einer eigenen,
zum Inhalt passenden Design-Welt.

Zweisprachig: **Englisch ist die Standardsprache und liegt präfixlos auf der
Wurzel**, Deutsch unter `/de/…` (die deutsche Startseite ist `/de.html`).

## Technik

**[Astro](https://astro.build) 5**, statischer Build, kein Server-Rendering. Der
letzte Build umfasst **17.368 Seiten**. Alle Daten werden zur *Bauzeit*
eingebacken — die ausgelieferte Seite ruft keine API auf, hat keine Laufzeit-
Schlüssel und keine Ratelimits.

`build.format: 'file'` heißt: jede Seite ist eine echte Datei
(`src/pages/patches/sc-4-8-2.astro` → `/patches/sc-4-8-2.html`). Die
`.html`-Endung ist Teil der URL und steht so auch in jedem internen Link.

Benutzerkonten (Profil, Favoriten, Refinery-Aufträge, Crafting-Besitz) laufen
clientseitig gegen **Supabase**; die Seite bleibt statisch. Row Level Security
schützt die Daten, nicht der Schlüssel — der Publishable Key steht bewusst im
Quelltext.

```
src/pages/        Seitenbaum (EN auf der Wurzel, DE unter de/)
src/components/   geteilte Bausteine (SiteNav, ItemFinderApp, ShipDetail …)
src/lib/          Bau-Zeit-Logik (SEO, Archiv-Modell, Routen-Zwillinge …)
src/i18n/         UI-String-Kataloge DE/EN
src/data/         Daten-Schnappschüsse (Patches, Schiffe, Preise)
src/content.config.ts  typisierte Patch-Collection (Zod-Schema)
assets/           kanonische Bilder/CSS/Client-JS  → wird nach public/ gespiegelt
public/           was 1:1 ausgeliefert wird (inkl. vendortes three.js)
scripts/          Datamining, Sync, Bau-Helfer, Prüfungen
tests/e2e/        node:test — Verhalten, Datenbank, gebautes Layout, Konfig
nginx/            Auslieferungs-Konfiguration des Origins
supabase/         Migrationen + Edge Function (verify-rsi)
discord/          Server-Builder + Dauer-Bot (eigenes Deployment)
docs/             Tiefen-Analysen und Vorhaben
```

## Loslegen

```bash
npm ci
npm run dev
```

`dev` und `build` erzeugen vorab Thumbnails, die Downloads-Übersicht und
spiegeln `assets/` nach `public/assets/` — deshalb immer über die npm-Skripte
gehen, nie `astro dev` direkt aufrufen.

```bash
npm run build          # vollständiger Build nach dist/ (~3 Minuten)
npm run preview        # den Build lokal ausliefern
```

## Prüfen

**Ein Befehl, und es ist derselbe wie im Dockerfile:**

```bash
npm run gate
```

Das ist das Auslieferungs-Tor (Schiene A). Läuft nach einem Build und prüft
alles, was auch der CI-Build prüft, bevor ein Image entsteht — schlägt eine
Strecke fehl, entsteht dort kein Image und Coolify liefert weiter den letzten
guten Stand. **Vor jedem Push auf `staging` einmal grün gesehen haben.**

```bash
npm run gate -- --list            # nur zeigen, was liefe
npm run gate -- --only verify:fx  # eine einzelne Strecke, zur Diagnose
npm run gate -- --continue        # nicht beim ersten Fehler abbrechen
npm run gate:data                 # Schiene B: nach jedem Datamine-/Sync-Lauf
```

Jeder Lauf sagt in der Kopfzeile, **woran** er grün war: gegen den Live-Build
oder gegen den Vorschau-Build. Die beiden unterscheiden sich in der
SEO-Oberfläche (`STAGING=1` → site-weit `noindex`, gesperrte `robots.txt`,
absichtlich leere Sitemaps), und das reicht, damit dieselbe Kette lokal grün
und in CI rot sein kann — genau so passiert am 09.08.2026. Den staging-Build
lokal nachstellen:

```bash
$env:STAGING = '1'; npm run build; npm run gate   # PowerShell
```

Welche Strecken zu welcher Schiene gehören, steht in
[`scripts/lib/gate-registry.mjs`](scripts/lib/gate-registry.mjs) — und nur
dort. `verify:wiring` (erste Strecke im Tor) schlägt fehl, sobald ein
Prüfskript ohne Eintrag im Bestand liegt, ein Eintrag ins Leere zeigt oder
eine Strecke git/Netz/Kindprozess anfasst, ohne es zu erklären. Schiene B
läuft nur lokal: sie braucht die `Data.p4k`, den installierten Client oder
freien UEX-Zugang — aus GitHub Actions ist UEX gesperrt.

Einzeln aufrufbar bleibt weiterhin alles:

```bash
npm run test:e2e       # node:test — braucht einen Build (sagt es sonst)
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
still im Browser des Besuchers — deshalb läuft die Prüfung im Qualitätstor mit.

## Ausliefern

Push auf `main` → GitHub Actions baut das Docker-Image (viel RAM) → `ghcr.io` →
Coolify zieht das fertige Image. **Auf dem Server wird nicht gebaut** (er hat zu
wenig Speicher). Der Ablauf steht in
[`.github/workflows/deploy-image.yml`](.github/workflows/deploy-image.yml).

Das Qualitätstor sitzt im [`Dockerfile`](Dockerfile), nicht im Workflow: nach
`npm run build` laufen dort e2e-Tests, `_verify` und die three.js-Prüfung. Fällt
eine durch, entsteht kein Image und Coolify behält den letzten guten Stand.

Vor der Kante steht Cloudflare (TLS). Sicherheits-Header, Cache-Control und die
Rewrites setzt der Origin in [`nginx/default.conf`](nginx/default.conf).

`.github/workflows/build.yml` ist ein separater **Knopf für den Patch-Day**: er
zieht frische Daten-Schnappschüsse, committet sie nach `main` und baut. Sync-
Schritte sind absichtlich nicht fatal — fällt eine Fremd-API aus, baut die Seite
mit dem letzten guten Schnappschuss weiter.

## Daten

Der überwiegende Teil ist **spiel-akkurat aus der eigenen `Data.p4k`-Extraktion**
(`scripts/lib/p4k.mjs` liest den Zip64-Container mit zstd-Nutzlast direkt in
Node, `scripts/lib/datacore.mjs` den `Game2.dcb`-Datensatz — beides ohne unp4k
oder unforge). Preise stammen von UEX Corp, Schiffs-Specs von FleetYards und der
Star-Citizen-Wiki-API.

Die `datamine:*`-Skripte brauchen eine **lokale Star-Citizen-Installation**:

```bash
SC_P4K="D:/…/StarCitizen/LIVE/Data.p4k" npm run datamine:items
```

Ohne die Variable wird `F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k`
versucht. Alle daraus erzeugten Datendateien liegen als Schnappschuss im Repo —
**für Bauen und Entwickeln ist keine Spielinstallation nötig**, nur für den
Daten-Refresh am Patch-Day.

| Bereich | Skript |
|---|---|
| Items + Preise | `npm run datamine:items`, `npm run sync:items` |
| Bergbau | `npm run sync:mining`, `npm run verify:mining` |
| Crafting | `npm run datamine:crafting` |
| Missionen | `npm run datamine:missions` |
| Schiffe / Specs | `npm run sync:vehicles`, `npm run sync:ships`, `npm run sync:extras` |
| 3D-Hologramme | `npm run extract:hardpoints`, `npm run build:holo-meshes`, `npm run calibrate:holo` |
| Raffinerie | `npm run sync:refinery` |
| Hell-/Dunkel-Paletten | `npm run theme` |

## Mitschreiben

- Interne Links sind **root-relativ und tragen `.html`** (`/schiffe/x.html`).
  Verschiebt sich das Deploy-Ziel, ändern sich nur `site` in
  `astro.config.mjs` und `SITE.url` in `src/consts.ts`.
- Handverlinkte Dateien unter `/assets/` brauchen einen **Content-Hash als
  `?v=`** (siehe `ItemFinderApp.astro`). Ohne ihn bekommen wiederkehrende
  Besucher bis zu 24 Stunden lang das alte Skript zum neuen HTML.
- Der Sprachumschalter ermittelt selbst, ob es die Seite in der anderen Sprache
  gibt (`src/lib/routeTwins.ts`) — es ist nichts von Hand zu pflegen.
- „Fertig" heißt **DE und EN**. Der Audit zählt beide Bäume getrennt.
- Keine erfundenen Werte. Fehlt eine Angabe, wird das im UI gesagt („Nur
  Katalog", „Kein Fundort bekannt") statt geschätzt.

## Hinweis

Inoffizielles Fan-Projekt. Star Citizen® © Cloud Imperium Rights LLC & Ltd. —
keine Verbindung zu CIG. Eingebettete Trailer, Standbilder und Schiff-/
System-Bilder stammen von offiziellen bzw. Community-Quellen (© Cloud Imperium
Games) und werden im Rahmen der Fan-Content-Nutzung zu Dokumentationszwecken
eingebunden.
