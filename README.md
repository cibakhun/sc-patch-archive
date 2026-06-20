# SC Patch-Archiv

Ein statisches Web-Archiv aller **Star Citizen** Alpha-Patches von **4.0.0 bis 4.8.2** — jede Version mit eigener, zum Inhalt passender Design-Welt.

## Aufbau

- `index.html` — Hub mit allen 17 Patches (nach Ären gruppiert, je eigene Akzentfarbe & Trailer-Standbild).
- `patches/sc-4-X-Y.html` — eine eigenständige, themierte Seite pro Patch (Kino-Hero, Bento-Highlights, Schiff-Garage, Video-Wall, Galerie, klickbare Info-Lightboxen).
- `topics/<slug>.html` — Detailseiten für große Features (z. B. Contested Zones).
- `assets/` — lokale Bilder (Trailer-Standbilder, Schiff-/System-Renders, Video-Poster).
- `PATCH-DATA.md` — recherchierte Datenquelle (Fakten, Themes, Medien-Manifest).

## Lokal ansehen

Einfach `index.html` im Browser öffnen — oder einen kleinen Webserver starten:

```bash
python -m http.server 4178
# dann http://localhost:4178/
```

## Technik

Reines, statisches HTML/CSS/JS — kein Build-Schritt, keine Abhängigkeiten. Jede Seite ist in sich geschlossen (CSS im `<style>`, JS inline). Trailer werden als YouTube-Embeds geladen (Klick-zu-Laden-Facade), Bilder liegen lokal in `assets/`.

## Hinweis

Inoffizielles Fan-Projekt. Star Citizen® © Cloud Imperium Rights LLC & Ltd. — keine Verbindung zu CIG. Eingebettete Trailer, Standbilder und Schiff-/System-Bilder stammen von offiziellen bzw. Community-Quellen (© Cloud Imperium Games) und werden im Rahmen der Fan-Content-Nutzung zu Dokumentationszwecken eingebunden.
