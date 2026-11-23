# Wer besucht die Seite womit — Umami-Auswertung vom 06.10.2026

Grundlage: Umami (`stats.verse-base.com`), **90 Tage bis 06.10.2026**, Host
`verse-base.com`. Alle Zahlen aus den Detailtabellen (Spalte „Visitors“), nicht
aus den Kacheln. Was daraus umgesetzt wurde, steht unten; die Sichtabnahme ist
im Register (`.planning/WINDOWS.md`, id 65), die geänderte Zählweise ebenda
(id 66).

## 1. Erst die Bots herausrechnen

Ohne Filter sieht der September nach Durchbruch aus. Er war es nicht.

| Signatur | „Besucher“ | Absprung | Verweildauer | Erkennbar an |
|---|---:|---:|---:|---|
| Singapur, alle **1280×1200**, Chrome/Windows | 2.608 | 100 % | 0 s | allein 1.196 am 23.09., nur `/items/*` |
| **800×600** (Headless-Vorgabe, Chrome + Firefox) | 241 | 97 % | 1 s | keine echte Bildschirmgröße |
| **Chrome iOS 390×844 ohne Herkunft** | 201 | 98 % | 0 s | 201 von 203 Chrome-iOS-Besuchern, nur Übersichtsseiten, USA |
| **1024×1024** | 63 | 100 % | 0 s | keine echte Bildschirmgröße |
| 1200×3000, 1280×1280 | 12 | 100 % | 0 s | dto. |
| *1600×1200* | *51* | *100 %* | *0 s* | *verdächtig, aber eine echte (alte) Auflösung → nicht gefiltert* |
| *Linux 1920×1080 / 1366×768* | *~125* | *88 %* | *0–3 s* | *gemischt, nicht trennbar → nicht gefiltert* |
| eigene Messläufe `localhost` / `127.0.0.1` | 22 | — | — | 662 + 996 Aufrufe |

Ohne Singapur bleiben **3.769 Besucher / 8.587 Aufrufe**; ohne die übrigen
Signaturen grob **3.000 echte Menschen** in 90 Tagen. Tagesverlauf (ohne
Singapur): Anfang August 10–40, Ende August 60–90, seit Mitte September
**85–155 Besucher pro Tag**.

## 2. Wo sie herkommen

- **Kanal:** Organische Suche 2.231, Social 48 — praktisch alles kommt aus Suchmaschinen.
- **Suchmaschinen:** bing 1.092 · duckduckgo 812 · brave 119 · chatgpt 72 · ecosia 53 · **google 53** · qwant 37 · yahoo 32 · kagi 11. Der Bing-Index (Bing, DDG, Ecosia, Qwant, Yahoo) trägt weiter rund 85 %.
- **Länder:** USA 1.838 · Deutschland 506 · UK 262 · **Frankreich 245** · Kanada 94 · Australien 62 · Niederlande 56 · Spanien 54 · Dänemark 50 · Österreich 38.
- **Browsersprache:** Englisch 2.642 · Deutsch 400 · **Französisch 268** · Spanisch 88 · Portugiesisch 43 · Dänisch 37 · Italienisch 31.
- **Deutsche landen auf Englisch:** von den Einstiegen aus Deutschland lagen **429 auf englischen Seiten und nur 125 auf deutschen** — obwohl 362 dieser Besucher Deutsch als Browsersprache führen. Bing rankt die englische Fassung.

## 3. Womit sie kommen

**Geräte** (bereinigt, gerundet): Desktop ~84 % (Windows ~2.650, Linux ~120, macOS ~75), Telefon ~16 % (Android ~330, iPhone ~170), Tablet unter 1 %.

**Browser:** Chrome ~1.370 · Edge ~1.125 · **Firefox ~600 (≈ 19 %)** · Safari iOS ~150 · Opera ~140 · Safari macOS 34 · Samsung 15. Der Firefox-Anteil ist hoch für eine Fachseite — die Seite muss dort genauso gehen. Statische Prüfung des Bestands auf Funktionen, die Firefox fehlen: einziger Fund ist Document-PiP in der Mining-Werkbank, und der hat schon einen Rückfall. Eine echte Firefox-Darstellung wurde nicht geprüft (kein Firefox auf dem Messrechner).

**Bildschirme** (Bildschirm, nicht Fenster; echte Besucher):

| Bildschirm | Besucher | Anteil | Anmerkung |
|---|---:|---:|---|
| 1920×1080 | ~810 | ~26 % | bis August die einzige gemessene Desktop-Größe |
| **2560×1440** | 639 | ~20 % | |
| **3440×1440** (21:9) | 184 | ~6 % | |
| **3840×2160** | 88 | ~3 % | 4K bei 100 % |
| **5120×1440** (32:9) | 58 | ~2 % | |
| 2560×1080, 2752×1152, 4096×…, 3840×1080 … | ~80 | ~3 % | weitere Breitbild-Formate |
| 1536×864, 2048×1152, 1707×960 … | ~200 | ~6 % | skalierte Schirme (125–150 %) |
| 1680×1050, 1440×900, 1280×800, 1920×1200 | ~170 | ~5 % | 16:10 |
| 1080×1920, 1440×2560, 1200×1920 | ~85 | ~3 % | **hochkant** — Zweitbildschirm neben dem Spiel |
| Telefone (360–440 px breit) | ~500 | ~16 % | |

**Rund ein Drittel der echten Besucher hat einen Schirm ab 2560 px Breite.**
Der Auflösungs-Durchgang vom 30./31.08. hat bei 1920 px aufgehört — darüber war
nie gemessen worden.

## 4. Was sie benutzen

Einstiege (ohne Singapur): `/crafting/th-01-propulsor.html` 521 · `/item-finder.html` 210 · `/` 133 · `/precision-jump.html` 125 · `/schiffe.html` 108 · `/crafting/vendetta-hmg.html` 92 · `/index.html` 86 · `/missionen.html` 82 · `/items/arlington-rifle.html` 82 · `/armor-sets.html` 76 · `/topics/mining.html` 49+35.

Aufrufe nach Bereich (Top 500 Pfade): Crafting-Detailseiten ~2.000 · Schiffe ~820 · Items ~790 · Themen ~750 · Missionen ~730 · Item-Finder 469 · Startseite ~580.

Ereignisse: **keine** — Umami zählt bisher nur Seitenaufrufe, keine Bedienschritte.

## 5. Gemessen am Breitbild (vorher)

`.planning/sketches/tools/breitbild.mjs`, 30 Seiten × 6 echte Fenstergrößen
(1920×945, 2560×1305, 3440×1305, 3840×2025, 5120×1305, 1080×1785), 0 Abstürze:

- Kein Überlauf, keine unbegrenzten `vw`-Schriften — die Seite bricht nicht, sie **verschenkt Platz**.
- Jede Werkzeugseite endete an ihrer festen Höchstbreite: der Item-Finder zeigte auf 3440 px **zwei** Ergebniskarten je Zeile, Missionen und Schiffe vier, die Blueprint-Datenbank drei; links und rechts je ~1.100 px leer.
- Die Kopfleiste verteilte ihre Bedienung über die volle Breite: auf 3440 px Anmelden bei x=45, Menü bei x=3395 — gut 1.100 px neben dem Inhalt.
- Das Schiffs-Bühnenbild ist ein 1280-px-Wiki-Vorschaubild auf randloser Bühne: bei 1920 px 1,5-fach, bei 2560 px 2-fach, bei 4K 3-fach hochgezogen.

## 6. Umgesetzt (06.10.2026)

| Was | Wo | Gemessen |
|---|---|---|
| Werkzeug-Raster wachsen ab 1920 px mit (`--vb-breit`, bis +800 px) | Item-Finder, Blueprint-Datenbank, Missionen, Schiffe, DataShell-Übersichten (`breit`) | 3440 px: 5/6/6/7 statt 2/3/4/4 Spalten; 2560 px: 4/5/5/6. Bis 1920 px jeder berechnete Wert identisch (`mess-breit-werte.mjs`) |
| Kategoriepfad auf Item-Karten bricht um statt zu kappen — bei jeder Fensterbreite | `ItemFinderApp.astro` | vorher nur unter 430 px; schmale Karten gibt es auch bei 1024 px und auf Breitbild |
| Kopfleisten-Bedienung höchstens über 2240 px (`--vb-leiste`) | SiteNav, Zurück-Marke, DataShell-Leiste | 3440 px: x=600…2840 statt 45…3395; unter 2240 px unverändert |
| Sprachhinweis beim Einstieg (DE-Browser auf EN-Seite → deutsche Fassung, und umgekehrt) | `assets/sprachhinweis.js` | 7 Fälle geprüft (`probe-sprachhinweis.mjs`): nur Einstieg, nie für Automaten, nach Schließen ein Jahr Ruhe |
| Schiffsbühne mit `srcset` aus gemessener Breitentabelle | `scripts/sync-ship-hero-widths.mjs` → `src/data/ship-hero-widths.json`, 153 von 227 Seiten | Faktor bei 1920/2560 px jetzt 1,0, bei 4K 1,5 (`probe-buehnenbild.mjs`) |
| Zähl-Hygiene: nur `verse-base.com`, keine Automaten, keine Bot-Fenstergrößen | `Layout.astro` (`data-domains`, `data-before-send`) | **Zahlen ab Auslieferung nicht direkt mit vorher vergleichbar** (Register id 66) |

## 7. Bewusst nicht umgesetzt — Empfehlungen

1. **Cloudflare cacht `/assets/*.json` nicht** (`cf-cache-status: DYNAMIC`, JSON ist keine Standard-Endung). Der Item-Finder lädt bei jedem Besuch `universal-items.json` — **1,08 MB komprimiert** — vom Ursprung. Die URL trägt schon `?v=<hash>`; eine Cache-Regel „`/assets/*.json` → cachen, Ablauf vom Ursprung (1 Tag)“ im Cloudflare-Dashboard wäre gefahrlos. Betreiber-Sache, nicht im Bestand.
2. **HTML kommt bei jedem Aufruf vom Ursprung** (`no-cache`, DYNAMIC) — Antwortzeit hier 0,2–0,33 s, für die Hälfte der Besucher (USA) mehr. Edge-Caching kollidiert aber mit dem Widerspruch per Cookie (die CSP hängt am Aufruf). Nicht ohne Umbau lösbar.
3. **Der Item-Finder-Datensatz** (7,1 MB roh / 1,08 MB br für 9.222 Items) ließe sich in Liste + Details teilen — größerer Umbau.
4. **Französisch** ist mit 7 % die dritte Besuchersprache (Frankreich 245 Besucher, längste Verweildauer aller großen Länder). Eine FR-Fassung wäre Inhaltsarbeit, keine Optimierung — nur als Beobachtung.
5. **Telefon-Bühne** bleibt beim 1280er (Faktor ~2 auf DPR-3-Schirmen, durch `cover` höhengebunden). Ein größeres Bild kostete mobil 100+ KB mehr.
6. **Ereignisse messen**: Umami kann Klicks über `data-umami-event` zählen, ohne neues Skript. Ohne Ereignisse bleibt unbekannt, welche Filter, Ansichten und Rechner wirklich benutzt werden.
