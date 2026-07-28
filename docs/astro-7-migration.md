# Astro 5 → 7: Migrationsplan

**Stand:** 27.07.2026 · **Ist:** `astro@5.18.2` · **Ziel:** `astro@7.1.4`

Der Anlass ist nicht Neugier, sondern `npm audit`: nach `npm audit fix` bleiben
**5 Befunde (4 hoch, 1 niedrig)** übrig, und **alle** hängen an Astro 5 —
`esbuild` und `sharp` kommen als dessen Abhängigkeiten mit, `@gltf-transform/
functions` erbt `sharp` nur weiter (es ist selbst aktuell). Die einzige Auflösung
ist der Versionssprung. `npm audit fix --force` würde ihn in einem Rutsch
erledigen und dabei mit hoher Wahrscheinlichkeit den Build brechen — darum
dieser Plan statt eines Knopfdrucks.

Es sind **zwei** Hauptversionen, keine. Der Weg führt über 6.

Quellen: [Upgrade auf v6](https://docs.astro.build/en/guides/upgrade-to/v6/) ·
[Upgrade auf v7](https://docs.astro.build/en/guides/upgrade-to/v7/) — die
Bruchstellen unten stammen von dort, die **Betroffenheit ist an diesem Repo
gemessen**.

---

## Was uns NICHT trifft (gemessen, nicht vermutet)

Der größte Teil der v6-Abrisslisten geht an diesem Projekt vorbei, weil es eine
rein statische Seite ohne Adapter, ohne SSR und ohne Markdown ist:

| Bruchstelle | Befund |
|---|---|
| `Astro.glob()` entfernt | keine Verwendung |
| `<ViewTransitions />` entfernt | keine Verwendung |
| `astro:transitions`-Interna entfernt | keine Verwendung |
| `import.meta.env.ASSETS_PREFIX` | keine Verwendung |
| `emitESMImage()` | keine Verwendung |
| Legacy-Content-Collections | schon auf Content Layer (`loader: glob(…)` in `src/content.config.ts`) |
| Adapter-API (`NodeApp`, `loadManifest`, …) | kein Adapter, `output` ist statisch |
| Actions, Sessions, `rewrite()` | nicht genutzt |
| `@astrojs/db` entfernt (v7) | nicht genutzt |
| Markdown-Pipeline getauscht (v7) | **0** `.md`/`.mdx` unter `src/` — Patch-Daten sind JSON |
| `src/fetch.ts` wird reserviert (v7) | Datei existiert nicht |
| CommonJS-Konfig entfernt | `astro.config.mjs` ist ESM |
| Node ≥ 22.12 | `node:22-alpine` (Dockerfile), `node-version: 22` (CI), lokal v22.18 |

## Was uns trifft

### 1. `z` aus `astro:content` → `astro/zod` (v6, noch funktionsfähig)
Eine Stelle: [`src/content.config.ts:4`](../src/content.config.ts). Ein-Zeilen-
Änderung, kann **sofort und unabhängig** von der Migration passieren.

### 2. Zod 4 (v6)
`content.config.ts` nutzt `z.object/string/enum/regex/boolean/optional` — alles
Kernformen, die der Bruch (`z.string().email()` & Co) nicht berührt. Risiko
gering, aber der Schema-Bau ist die Stelle, an der ein Fehler die *gesamte*
Patch-Collection kippt. Erste Prüfung nach dem v6-Sprung: baut `astro build`
die 19 Patch-Datensätze noch?

### 3. Rust-Compiler ist Pflicht (v7) — **das Hauptrisiko**
Er korrigiert kaputtes HTML nicht mehr still, sondern bricht ab: nicht
geschlossene Tags werden zu Fehlern, falsche Verschachtelung (`<div>` in `<p>`)
bleibt stehen, wie sie dasteht.

Dieses Repo besteht aus handgeschriebenen `.astro`-Seiten mit sehr viel Inline-
Markup — 19 Patch- und 22 Themenseiten je Sprache, jede mit eigenem Layout.
Genau dort schlummern seit Jahren vom alten Compiler stillschweigend geflickte
Stellen. Der Ausfall ist laut (Build bricht), nicht leise — aber er kann viele
Dateien gleichzeitig treffen.

*Vorgehen:* nach dem Sprung auf 7 `astro build` laufen lassen und die Fehlerliste
abarbeiten, **bevor** irgendetwas anderes angefasst wird. Punkt 8 dieses
Vorhabens (Sprachzwillinge zusammenlegen) halbiert die Zahl der Fundstellen —
deshalb steht er in der Reihenfolge davor.

### 4. `compressHTML` wird zu `'jsx'` (v7) — **das leise Risiko**
Der neue Standard entfernt Leerzeichen zwischen Inline-Elementen. Auf einer
Seite, die fast nur aus gesetztem Text besteht, ist das **sichtbar**: aus
`<b>4.9</b> <span>Patch</span>` kann `4.9Patch` werden.

*Vorgehen:* Zuerst `compressHTML: true` ausdrücklich in `astro.config.mjs`
eintragen — damit verhält sich 7 wie bisher und die Migration bleibt bei einer
Sache. Der Wechsel auf `'jsx'` ist danach ein eigener, optischer Durchgang.

### 5. Vite 7 (v6) und Vite 8 (v7)
Keine eigenen Vite-Plugins im Projekt. `astro.config.mjs` nutzt nur
`server.allowedHosts` (Astro-Ebene, nicht `vite.server`) — der frühere Fallstrick
ist also schon umgangen. Restrisiko: Wie Vite die `_astro/*`-Bundles benennt und
aufteilt. Da unsere URLs gehasht sind, ist das folgenlos.

### 6. `i18n.routing.redirectToDefaultLocale` wird `false` (v6)
Wir setzen `prefixDefaultLocale: false`, EN liegt präfixlos auf der Wurzel — die
Weiterleitung wäre gar nicht im Spiel. Kein Handlungsbedarf, hier nur notiert,
damit es beim Lesen der Release-Notes nicht erneut geprüft wird.

---

## Reihenfolge

Jeder Schritt endet mit derselben Prüfkette. Sie ist der eigentliche Grund,
warum diese Migration überhaupt machbar ist:

```bash
npm run build && npm run test:e2e && npm run verify && npm run verify:vendor \
  && npm run audit:csp && npm run audit:site
```

0. **Vorher:** Punkt 8 (ein Körper je Patch-/Themenseite) abschließen. Halbiert
   die Menge Markup, die der Rust-Compiler gleich prüfen wird.
1. `z`-Import auf `astro/zod` umstellen. Läuft auf Astro 5 schon.
2. `compressHTML: true` ausdrücklich in `astro.config.mjs` festschreiben.
   Auf Astro 5 ist das der geltende Standard → **keine** Änderung am Ergebnis,
   aber die spätere Umstellung wird dadurch zu einer bewussten Entscheidung.
3. `npm i astro@6` — Prüfkette. Erwartete Baustellen: Zod-4-Schemas,
   Content-Layer-Feinheiten.
4. `npm i astro@7` — Prüfkette. Erwartete Baustelle: HTML-Fehler aus dem
   Rust-Compiler, seitenweise abzuarbeiten.
5. `npm audit` muss danach **0** melden. Ist das nicht so, war der Sprung
   umsonst und der Rest ist Kosmetik.
6. Optischer Durchgang: `compressHTML` auf `'jsx'` und DE+EN durchsehen —
   getrennt vom Rest, weil hier nichts bricht, sondern nur anders aussieht.

## Was den Ausfall abfängt

Vor diesem Vorhaben hätte eine Migration nur der Build selbst quittiert. Jetzt
prüfen mit: 92 e2e-Tests, `_verify` über alle ~830.000 lokalen Referenzen des
Builds, `audit-site` über die 17.363 Seiten (tote Links, Anker, Sitemap,
Platzhalter, Mojibake), `audit-csp` gegen die Sicherheitsrichtlinie und das Tor
im Dockerfile, das ohne grüne Kette gar kein Image erzeugt.

Bleibt eine Lücke, und sie ist ehrlich zu benennen: **niemand prüft die Optik.**
`compressHTML` und der Rust-Compiler können ein gültiges, vollständig verlinktes
HTML erzeugen, das schlicht anders aussieht. Dafür gibt es nur das Hinsehen —
DE **und** EN, Startseite, eine Patch-Seite, eine Themenseite, Item-Finder,
Schiffs-Datenblatt.
