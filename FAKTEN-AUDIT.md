# FAKTEN-AUDIT — alle 17 Patches (Stand 2026-07-03)

**Zweck:** Jede harte Behauptung des Archivs (Datenschicht + Seiten) als prüfbare Checkliste.
Extrahiert von 6 parallelen Claude-Sonnet-5-Agenten aus `src/data/patches/*.json`, den Patch-Seiten und allen Topic-Seiten.

**So benutzt du das:**
- Kreuze an (`[x]`), was **falsch oder korrekturbedürftig** ist — gern mit kurzer Notiz dahinter.
- Die `⚠ Verdachtsfälle` pro Patch sind von den Agenten gefundene Widersprüche/Unbelegtes — kein Urteil, nur Hinweise.
- Quellen-Kürzel: `(json)` = Datenschicht, `(patch-page)` = Patch-Seite, `(topic:slug)` = Deep-Dive-Seite.

**Bekannte offene Punkte (außerhalb der Checkliste):**
1. **XenoThreat @ 4.8.0** — laut dir vermutlich erst 4.8.3; alle betroffenen Claims unten mit `⚠XT` markiert. Du prüfst die Zuordnung.
2. **4.8.3 ist live** — dem Archiv fehlt der Patch-Eintrag komplett (Daten benötigt: Datum, Codename, Features, Schiffe, Events, Wipe).

---


## Alpha 4.0.0 — Destination Pyro
- [ ] Datum 19. Dezember 2024, Major Release `(json)` `(patch-page)`
- [ ] Ära: Pyro-Ära `(json)`
- [ ] Server Meshing: ≈10 Server pro Shard `(json)`
- [ ] Server Meshing: bis 500 Spieler pro Shard (vorher ~100) `(json)` `(patch-page)` `(topic:4-0-0-server-meshing)`
- [ ] Statstrip Meshing-Topic: exakt "500" Spieler, "1" geteilter Shard, "2" Systeme `(topic:4-0-0-server-meshing)`
- [ ] Vorher/Nachher: "Rund 100 Spieler" (Einzelserver) vs. "bis zu rund 500" (Meshing) `(topic:4-0-0-server-meshing)`
- [ ] "Static Server Meshing" + "Replication Layer" (trennt Persistenz vom Einzelserver) `(topic:4-0-0-server-meshing)`
- [ ] Pyro: zweites Sternsystem, erreichbar per Jump Point von Stanton `(json)` `(patch-page)` `(topic:4-0-0-pyro-system)`
- [ ] Pyro: 6 Planeten (Pyro I–VI), u.a. Monox, Bloom, Terminus, Pyro V (Gasriese) `(json)`
- [ ] Pyro-Topic Statstrip: "6" Planeten, "6" Monde um Pyro V, "0" Sicherheitszonen `(topic:4-0-0-pyro-system)`
- [ ] Pyro V hat 6 Monde: Ignis, Vatra, Adir, Fairo, Fuego, Vuur `(topic:4-0-0-pyro-system)`
- [ ] Pyro-Zentrum: "Flare Star" — heller, sterbender Stern in verlängerter Nova-Phase `(topic:4-0-0-pyro-system)`
- [ ] Pyro hat Ruin Station, Rest-Stops, Asteroidenbasen `(json)` `(patch-page)`
- [ ] Ruin Station = ehemalige Gold-Horizon-Bergbauplattform, Schwarzmarkt/Gangs `(topic:4-0-0-pyro-system)` `(topic:4-0-0-contested-zones)`
- [ ] Pyro: keine Versicherung, keine Bergung, kein ASOP-Notruf, keine Sicherheitskräfte `(topic:4-0-0-pyro-system)`
- [ ] Contested Zones: PvPvE-Beutezonen tief in Pyros Anlagen `(json)` `(patch-page)` `(topic:4-0-0-contested-zones)`
- [ ] Contested Zones: erste PvPvE-Endgame-Aktivität im PU `(topic:4-0-0-contested-zones)`
- [ ] Contested Zones: On-Foot/FPS, keine Sicherheitszone, Tod = Verlust der getragenen Beute `(topic:4-0-0-contested-zones)`
- [ ] CZ-Topic Statstrip: "6" ruinierte Welten, "500" Spieler/Shard, "0" Sicherheitszonen `(topic:4-0-0-contested-zones)`
- [ ] Wipe: Voller Wipe + 20.000 aUEC Startguthaben `(json)` `(patch-page)`
- [ ] Neues Schiff: Mirai Guardian, Mirai, Jäger, Status "neu" `(json)` `(patch-page)`
- [ ] Neues Schiff: RSI Polaris, RSI, Korvette, Status "neu im 4.0-Zyklus" `(json)` `(patch-page)`
- [ ] Event: "Save Stanton — Kapitel 1", Auftakt des Fraktions-Narrativs `(json)`
- [ ] Erster aktiver Jump Point zwischen Stanton und Pyro `(json)` `(patch-page)`
- [ ] Jump-Point-Tunnel: eng/kurvenreich, Wandberührung riskant, Piraten am Ausgang `(topic:4-0-0-pyro-system)`

### ⚠ Verdachtsfälle
- RSI Polaris: auf der Patch-Seite gleichrangig neben Mirai Guardian als 4.0.0-Schiff präsentiert, obwohl ihr Status vorsichtiger ist ("neu im 4.0-Zyklus" statt "neu") — Unterschied auf der Seite nicht kenntlich.
- Pyro V "Gasriese" (json) vs. Mondsystem-Beschreibung (Topic) — plausibel vereinbar, zur Prüfung markiert.

## Alpha 4.0.1 — Stabilität & Save Stanton II
- [ ] Datum 28. Januar 2025, Point-Release `(json)` `(patch-page)`
- [ ] Ära: Pyro-Ära `(json)`
- [ ] Crash-Fixes: Top-10 häufigste Client- & Server-Abstürze behoben `(json)` `(patch-page)`
- [ ] Entity Density Manager: optimierte Aufräum-Logik `(json)` `(patch-page)`
- [ ] Streaming: zuverlässigeres Laden von Aufzügen, Hangars, Innenräumen `(json)` `(patch-page)`
- [ ] Save Stanton Kapitel 2 "Fight for Pyro": permanente Fraktionswahl, 3 Fraktionen `(json)` `(patch-page)` `(topic:4-0-1-fight-for-pyro)`
- [ ] 3 Fraktionen: Citizens for Prosperity, Headhunters, Frontier Fighters `(json)` `(patch-page)` `(topic)`
- [ ] Wahl nach erster Mission, permanent, kein Wechsel `(json)` `(topic)`
- [ ] Danach: alle Missionen reputationsgebunden `(json)` `(topic)`
- [ ] Ripper-SMG: exklusiv für Abschluss vor 4.0.2-Start `(json)` `(patch-page)` `(topic)`
- [ ] Event-Zeitraum: 28. Jan – 28. Feb 2025 `(json)`
- [ ] Topic Statstrip: "2" Kapitel, "3" Fraktionen, "1" endgültige Wahl `(topic)`
- [ ] Fraktions-Lackierungen (Kap. 1 UND 2): Anvil C8R Pisces, Anvil Carrack, Drake Cutter, RSI Zeus Mk II `(topic)`
- [ ] Schiff: F7C-M Super Hornet Mk II, Anvil, Jäger, "im 4.0-Zyklus", `unverified: true` `(json)` `(patch-page)`

### ⚠ Verdachtsfälle
- Frontier Fighters (3. Fraktion in 4.0.1) fehlt im Folge-Patch 4.0.2 (nur noch 2 Fraktionen) — kein Erklärungstext für den Schwund.
- F7C-M Super Hornet Mk II ist als `unverified` markiert, wird auf der Patch-Seite aber ohne Kennzeichnung in der regulären Ship-Garage präsentiert.

## Alpha 4.0.2 — Supply or Die
- [ ] Datum 28. Februar 2025, Point-Release & Event `(json)` `(patch-page)`
- [ ] Ära: Pyro-Ära `(json)`
- [ ] Supply or Die: einmaliges, story-getriebenes PvPvE-Versorgungsevent in Pyro `(json)` `(patch-page)` `(topic:4-0-2-supply-or-die)`
- [ ] 2 verfeindete Fraktionen: Citizens for Prosperity vs. Headhunters `(json)` `(patch-page)` `(topic)`
- [ ] Citizens: Industriegüter + Detatrine für med. Nachschub, Ziel Stabilisierung `(json)` `(topic)`
- [ ] Headhunters: Salvage + Mining mit allen Mitteln, Ziel Kontrolle `(json)` `(topic)`
- [ ] Detatrine = seltene Chemikalie, Schlüsselressource der Citizens `(json)` `(topic)`
- [ ] 3 Missionstypen, gleicher Kriegsfortschritt: Depot-Kämpfe (PvPvE), Mining & Refining, Salvage `(json)` `(patch-page)` `(topic)`
- [ ] Topic Statstrip: "2" Fraktionen, "3" Missionstypen, "1" einmaliges Story-Event `(topic)`
- [ ] Stufe-2-Belohnung: Ravager-212 Outcast Twin-Shotgun `(json)` `(patch-page)` `(topic)`
- [ ] Stufe-3-Belohnung: Outcast-Lackierungen für MISC Fortune, Drake Vulture, MISC Prospector `(json)` `(topic)`
- [ ] Keine neuen Schiffe (ships leer) `(json)`
- [ ] Wer eine Fraktion beliefert, macht die andere automatisch zum Feind `(topic)`

### ⚠ Verdachtsfälle
- **Widerspruch json↔patch-page:** Bento-data-text nennt Outcast-Lackierungen nur für "Vulture und Prospector" — das features-Array im JSON nennt DREI Schiffe (Fortune, Vulture, Prospector). Fortune fehlt auf der Patch-Seite.
- 2 Fraktionen (4.0.2) vs. 3 Fraktionen (4.0.1) im selben Konflikt ohne Übergangserklärung.


## Alpha 4.1.0 — Orbital Assault
- [ ] Datum: 27. März 2025 `(json)` `(patch-page)`
- [ ] Ära: Sturm & Stahl `(json)`
- [ ] Patch-Typ: `point` (json) — aber Patch-Seite zeigt Eyebrow "Feature-Patch" `(patch-page)`
- [ ] Tagline: "Orbitale Hathor-Laser, Asteroiden-Mining und neue Kollisionsphysik" `(json)`
- [ ] Persistente Aktivität "Align & Mine" auf Aberdeen und Daymar `(json)` `(topic:4-1-0-align-and-mine)`
- [ ] Hathor-Anlagen: 2 Monde, je 1 Orbital Mining Station `(json)` `(topic)`
- [ ] Align & Mine sprengt jeweils 1 neue Höhle pro Ausrichtung frei `(topic)` Statstrip
- [ ] Aegis Idris (Idris-M & Idris-P) erstmals spielbar für Besitzer `(json)` `(patch-page)`
- [ ] Idris = Fregatte, Aegis Dynamics `(json)`
- [ ] ~130 dokumentierte Bugfixes `(json)` `(patch-page)`
- [ ] Neue Fauna: Juvenile Valakkar — grabende Wurm-Kreaturen `(json)` `(patch-page)`
- [ ] Valakkar halten Abstand, bewegen sich durch den Boden, bewerfen Spieler mit Gestein `(json)`
- [ ] Überarbeitete Kollisionsphysik: Masse & Geschwindigkeit stärker berücksichtigt `(json)` `(patch-page)`
- [ ] Neue NPC-Interaktionen & DNA-gestützte Gesichtsgeneratoren `(json)`
- [ ] Neue Arena-Commander-Maps `(json)`
- [ ] Missionen für statisches Server Meshing überarbeitet `(json)`
- [ ] Kein Wipe erwähnt `(json)`
- [ ] Trailer: NArGjlRFsQQ, "Alpha 4.1 - Orbital Assault", own: true `(json)` `(patch-page)`
- [ ] Zweites Video "Aegis Idris — Commercial" (X2OFObiypT4) `(patch-page)`

### ⚠ Verdachtsfälle
- **Patch-Typ-Widerspruch:** JSON `type: point`, Patch-Seite-Eyebrow sagt "Feature-Patch" (4.1.1 nutzt korrekt "Point-Release").
- Rollenbezeichnung Sprachmix: json `role: "Frigate"` (Englisch) vs. Seiten "Fregatte" — JSON sonst durchgehend Deutsch.

## Alpha 4.1.1 — Balancing & Fleet Week
- [ ] Datum: 13. Mai 2025 `(json)` `(patch-page)`
- [ ] Ära: Sturm & Stahl; Patch-Typ point `(json)` `(patch-page)`
- [ ] >200 Bugfixes, davon 61 aus dem Issue Council `(json)` — Bento nennt nur "200+" ohne die 61 `(patch-page)`
- [ ] Turret-Munition erhöht bei: Redeemer, Retaliator, Reclaimer, Carrack, Polaris, Hammerhead `(json)` `(patch-page)`
- [ ] Neues actor-basiertes Recoil-System, sichtbar, skalierbar/abschaltbar `(json)` `(patch-page)`
- [ ] Waffen-Balancing für Schiffs- und Handfeuerwaffen `(json)` `(patch-page)`
- [ ] Event "Hunt The Polaris": serverweite Mission während Fleet Week 2955 `(json)` `(patch-page)` `(topic:4-1-1-hunt-the-polaris)`
- [ ] Frontier Fighters stehlen eine RSI Polaris mitten in der Flottenschau `(json)` `(topic)`
- [ ] Verfolgung quer durch Stanton; Finale an flüchtigem Wurmloch; Beute geteilt `(json)` `(topic)`
- [ ] Fleet Week 2955 = jährliche Flottenparade/Invictus mit den größten UEE-Schiffen `(json)` `(topic)`
- [ ] Polaris explizit unter den Schiffen mit erhöhter Turret-Munition `(json)` `(topic)`
- [ ] Kein neues Schiff (ships leer); kein Wipe erwähnt `(json)`
- [ ] Trailer: NArGjlRFsQQ mit own: false (vom 4.1.0 wiederverwendet) `(json)`
- [ ] Zusatz-Video: "Invictus / Fleet Week 2955" (EUK0BR0JTfE) `(patch-page)`

### ⚠ Verdachtsfälle
- Issue-Council-Aufschlüsselung (61) geht auf der Patch-Seite verloren (nur "200+").
- Wiederverwendeter 4.1.0-Trailer mit Titel "Orbital Assault" passt nicht zum Fleet-Week-Thema (korrekt als own:false markiert, aber kein eigener Trailer).
- events[0].desc und features-Eintrag "Hunt The Polaris" beschreiben den Ablauf nahezu wortgleich (Redundanz im JSON).

## Alpha 4.2.0 — Storm Breaker
- [ ] Datum: 19. Juni 2025 `(json)` `(patch-page)`
- [ ] Ära: Sturm & Stahl; Patch-Typ major `(json)` `(patch-page)`
- [ ] Dynamisches Wetter (Starkregen + Turbulenzen) in Stanton & Pyro `(json)` `(patch-page)` `(topic:4-2-0-storm-breaker)`
- [ ] Strahlung = neue Umweltgefahr, baut sich über Zeit auf, ohne Schutz tödlich `(json)` `(patch-page)` `(topic)`
- [ ] Gegenmittel: CureLife DeconPen Xtra (Canoiodide + Hemozal) `(json)` `(patch-page)` `(topic)`
- [ ] ~190 Bug- & Crash-Fixes `(json)` `(patch-page)` `(topic)`
- [ ] VTOL im Sturm deutlich erschwert `(json)` `(topic)`
- [ ] Storm-Breaker-Mission = persistente Aktivität, an Regen-Krisen-Story angebunden `(json)` `(topic)`
- [ ] Neues Fahrzeug: ARGO ATLS IKTI, ARGO, Mech-Suit, neu `(json)` `(patch-page)`
- [ ] Neues Schiff: Esperia Prowler Utility, Esperia, Utility, neu `(json)` `(patch-page)`
- [ ] Patch-Seite nennt Prowler zusätzlich "Stealth-Frachter · 32 SCU" — SCU-Zahl NICHT im JSON `(patch-page)`
- [ ] Topic-Statstrip: "3 neue Wetter-Gefahren" — JSON belegt nur 2 Gefahrenkomplexe `(topic)`
- [ ] Statstrip: "2 Systeme: Stanton & Pyro" `(topic)`
- [ ] Trailer: _OzfPaUWYpY, "Alpha 4.2: Storm Breaker", own: true `(json)` `(patch-page)`
- [ ] Commercials: ARGO ATLS (s-giJ2Px3d0), Esperia Prowler (Op0YkiMm8TQ) `(patch-page)`
- [ ] Kein Wipe erwähnt `(json)`

### ⚠ Verdachtsfälle
- **Zahl unbelegt:** Topic-Statstrip "3 neue Wetter-Gefahren" vs. nur 2 belegte Gefahrenkomplexe (Regen/Turbulenz + Strahlung).
- **Zahl unbelegt:** "32 SCU" für Prowler Utility existiert nur auf der Patch-Seite, nicht in der Datenschicht.
- Strahlungsmechanik-Formulierung nahezu wortgleich an mind. 4 Stellen (json ×2, patch-page, topic ×2) — Text-Recycling.


## Alpha 4.2.1 — Resource Drive
- [ ] Datum: 17. Juli 2025 `(json)`
- [ ] Codename: Resource Drive `(json)`
- [ ] Ära: Sturm & Stahl `(json)`
- [ ] Patch-Typ: point `(json)`
- [ ] Erstes Event mit Shard-übergreifendem Tracking `(json)`
- [ ] 4 konkurrierende Konzerne: Hurston Dynamics, Crusader Industries, ArcCorp, microTech `(json)`
- [ ] Sieger: Hurston Dynamics mit ~337 Mio. SCU `(json)`
- [ ] 5 Belohnungs-Tiers, T5 = Strata Hurston Black + 5% Dauerrabatt `(json)`
- [ ] Ship-Escort-Missionen: 6 Schwierigkeitsstufen, Foxwell-Gruppe, Systeme Stanton & Pyro, Belohnung Scrip `(json)`
- [ ] Konvoi-Routen: Stanton & Pyro, Fracht ist zerstörbar `(json)`
- [ ] Wikelo-Rezepte: 3 Zutaten-Stufen (Core, Rare, Content-Bound), deterministisch statt Zufalls-Drops `(json)`
- [ ] Flight Tuning: allgemeines Flugmodell-Update für alle Schiffe `(json)`
- [ ] Neues Schiff: RSI Meteor, Hersteller Roberts Space Industries, Rolle Frachter, Status neu `(json)`
- [ ] Event "Resource Drive": globaler Wettbewerb zwischen 4 Megakonzernen, Sieger Hurston Dynamics ~337 Mio. SCU `(json)`
- [ ] Trailer-YouTube-ID: _OzfPaUWYpY, Titel "Alpha 4.2: Storm Breaker" `(json)`
- [ ] Eyebrow "17. Juli 2025 · Point-Release & Event" `(patch-page)`
- [ ] RSI Meteor Ship-Card verlinkt YouTube-ID `aMeyPCQuaDw` (Video "RSI Meteor — Commercial") `(patch-page)`
- [ ] Wikelo-Rezepte-Popup nennt Händler "Wikelo" explizit `(patch-page)`
- [ ] Ship-Escort-Text: Eskorte "bis zur Quantum-Travel-Flucht" `(patch-page)`
- [ ] Hero-Tagline: "Konvoi-Event, Ship-Escort-Missionen und die RSI Meteor" (ohne "global") `(patch-page)`
- [ ] Imperator Addison ruft die 4 Megakonzerne zum Wettstreit auf `(topic:4-2-1-resource-drive)`
- [ ] Event heißt vollständig "Second Life Resource Drive" `(topic:4-2-1-resource-drive)`
- [ ] Konzern-Zuordnung: Hurston Dynamics = Waffen/Hurston, Crusader Industries = Raumfahrt/Crusader, ArcCorp = Energie/ArcCorp, microTech = Technik/microTech `(topic:4-2-1-resource-drive)`
- [ ] Sieger-Betrag exakt "rund 337 Millionen SCU" `(topic:4-2-1-resource-drive)`
- [ ] Tier-5-Belohnung explizit als "Strata-Hurston-Black-Armor" bezeichnet (nicht nur "Strata Hurston Black") `(topic:4-2-1-resource-drive)`
- [ ] Neuer "Global Event Tracking Service" erstmals bei Resource Drive eingeführt `(topic:4-2-1-resource-drive)`
- [ ] Stat-Strip zeigt animierten Zähler bis 337 (Mio. SCU), bis 4 (Konzerne), bis 5 (Tiers) `(topic:4-2-1-resource-drive)`
- [ ] Beschreibung: "Ohne Eskorte erreicht die Fracht die Sammelstelle nicht" `(topic:4-2-1-resource-drive)`
- [ ] Wipe: nicht erwähnt (kein Hinweis in json/patch-page/topic)

### ⚠ Verdachtsfälle
- Video-ID-Diskrepanz: RSI Meteor auf der Patch-Seite mit `yt:aMeyPCQuaDw` ("Commercial"); die JSON `trailer.yt` (`_OzfPaUWYpY`, "Alpha 4.2: Storm Breaker") wird auf der Patch-Seite nirgends als Video eingebunden, nur im Kopf-Meta. Zwei verschiedene Videos ohne klare Trennung (Patch-Trailer vs. Schiff-Commercial).
- "Erstes globales Event" mind. 4× nahezu wortgleich wiederholt (json keyFacts/summary/features + Topic) — Redundanz, kein Widerspruch.
- Tier-5-Bezeichnung uneinheitlich: json "Strata Hurston Black" vs. Topic "Strata-Hurston-Black-Armor".

## Alpha 4.3.0 — Dark Territory
- [ ] Datum: 16. August 2025 `(json)`
- [ ] Codename: Dark Territory `(json)`
- [ ] Ära: Onyx & Heilung `(json)`
- [ ] Patch-Typ: major `(json)`
- [ ] ~100 verlassene ASD-Forschungsstationen (Onyx Facilities), Stanton-weit `(json)`
- [ ] Personal Hangars: instanzierte Heimathäfen, direktes Spawnen `(json)`
- [ ] Missionsgeber: Arken Mallor (Hockrow Agency) `(json)`
- [ ] Neues Schiff: Kruger L-21 Wolf, Hersteller Kruger, Rolle leichter Jäger, Status neu `(json)`
- [ ] Narrativ: Regen Crisis, angetrieben von Dr. Logan Jorrits Experimenten `(json)`
- [ ] Personal Hangars: Typ "Instanziert" `(json)`
- [ ] Onyx Facilities: ~100 Stationen, Zustand "ungesichert, verlassen" `(json)`
- [ ] Investigation-Missionen: neuer Missionstyp über mobiGlas von Arken Mallor `(json)`
- [ ] Flight Tuning Light-Fighter: speziell für leichte Jäger wie Kruger L-21 Wolf `(json)`
- [ ] Resource Drive läuft in 4.3.0 fort, Fokus Ressourcen-Hauling, insbesondere Aphorite `(json)`
- [ ] `fixesNote`: "Nicht spezifisch genannt" `(json)`
- [ ] Trailer-YouTube-ID: MCJlD2Meuek, Titel "Alpha 4.3 – Dark Territory", `own: true` `(json)`
- [ ] Eyebrow "16. August 2025 · Major Release" `(patch-page)`
- [ ] Personal-Hangars-Popup: "ohne Umweg über Habs oder Transit" `(patch-page)`
- [ ] Arken-Mallor-Popup: Zugang über "Investigation-Tab des mobiGlas" `(patch-page)`
- [ ] Regen-Crisis-Popup nennt ASD-Experimente explizit als "Regeneration (Regen)" `(patch-page)`
- [ ] Onyx-Facilities-Kachel verlinkt zur Topic-Seite mit Stat "~100" `(patch-page)`
- [ ] Kruger L-21 Wolf in der Garage nur als Bild verlinkt (kein Video) `(patch-page)`
- [ ] Topic: ASD = "Associated Sciences and Development" `(topic:4-3-0-onyx-facilities)`
- [ ] Stat-Strip zeigt "0 gesicherte Innenräume" `(topic:4-3-0-onyx-facilities)`
- [ ] Kette 4-stufig: Auftrag annehmen → Anlage betreten → Daten bergen → Wahrheit zusammensetzen `(topic:4-3-0-onyx-facilities)`
- [ ] Personal Hangars im Onyx-Topic als eigener Abschnitt ("Auch in 4.3.0") wiederholt `(topic:4-3-0-onyx-facilities)`
- [ ] Wipe: nicht erwähnt `(json/patch-page/topic)`

### ⚠ Verdachtsfälle
- "Personal Hangars" und "Onyx Facilities" tragen im JSON denselben `topicSlug: "4-3-0-onyx-facilities"`, obwohl zwei separate Features — Hangars haben keine eigene Detailseite, werden aber in der Bento-Kachel individuell beworben (Datenmodell-Ungenauigkeit).
- "Personal Hangars" dreifach beschrieben (json/patch-page/topic) mit leicht unterschiedlicher Betonung — konsistent, aber redundant.
- `fixesNote: "Nicht spezifisch genannt"` vs. 4.3.1 ohne Feld — uneinheitliche Datenstruktur.

## Alpha 4.3.1 — Virtue's Descent
- [ ] Datum: 18. September 2025 `(json)`
- [ ] Codename: Virtue's Descent `(json)`
- [ ] Ära: Onyx & Heilung `(json)`
- [ ] Patch-Typ: point `(json)`
- [ ] RSI Apollo: 2 modulare Medical-Rooms, Konfigurationen Medivac & Triage `(json)`
- [ ] MedGel-Kosten: T3=5 / T2=10 / T1=20 Ladungen pro Respawn/Heilung `(json)`
- [ ] Bett-Stufen T1–T3 mit angepassten Respawn-Distanzen `(json)`
- [ ] Onyx-Erweiterung: Site B – Dr. Jorrits Labor mit biologischen Proben `(json)`
- [ ] Medical Overhaul: Wiederbelebung über Bett-Stufen mit definierten Respawn-Distanzen `(json)`
- [ ] Medgel-System facts: Stufen-Kosten "T1=20, T2=10, T3=5" `(json)`
- [ ] RSI Apollo: Rolle "Medical Medivac/Triage", "2 modulare Medical-Rooms mit Regenerations-Fähigkeiten" `(json)`
- [ ] Onyx Site B: "verzahnt mit Medical-Overhaul-Thema" `(json)`
- [ ] Atmospheric Control Surfaces: Flugmodell-Verbesserung, besonders für neue Medical-Schiffe `(json)`
- [ ] Ship Respawn via Dropships & Watchtowers: alternative Respawn-Mechanik statt klassischer Claim-Wartezeit `(json)`
- [ ] Neues Schiff: RSI Apollo, RSI, Rolle Medical Medivac/Triage, Status neu `(json)`
- [ ] events-Array leer (kein benanntes Event in 4.3.1) `(json)`
- [ ] Trailer-YouTube-ID: pq7XEWatINA, Titel "Alpha 4.3.1: Virtue's Descent", own: true `(json)`
- [ ] Eyebrow "18. September 2025 · Point-Release" `(patch-page)`
- [ ] MedGel-Kachel: "T3·T2·T1" (absteigende UI-Reihenfolge) `(patch-page)`
- [ ] Bett-Stufen-Popup: T1 = New-Babbage-Krankenhaus (Premium), T3 = Cutlass Red `(patch-page)`
- [ ] Zweites Video: "RSI Apollo — Behind the Ships", YouTube-ID `-0Yf6SVAYpw` `(patch-page)`
- [ ] Topic-Stat-Strip: "3 Bett-Stufen T1 bis T3", "1 Schiff der Stunde: RSI Apollo" `(topic:4-3-1-medical-overhaul)`
- [ ] Topic: T1 = New Babbage Premium, T3 = Cutlass Red — "je höher die Stufe, desto näher die Rückkehr" `(topic:4-3-1-medical-overhaul)`
- [ ] Versus: Medivac (Bergung aus dem Feld) vs. Triage (Versorgung an Bord mit Regeneration) `(topic:4-3-1-medical-overhaul)`
- [ ] Wipe: nicht erwähnt `(json/patch-page/topic)`

### ⚠ Verdachtsfälle
- **MedGel/Bett-Stufen-Verwirrung:** T1 ist laut allen Quellen die HOCHWERTIGSTE Stufe (New-Babbage-Krankenhaus), T3 die einfachste (Cutlass Red) — aber die Kostenreihe "T3=5 / T2=10 / T1=20" wird nirgends erklärt (bedeutet T1 nun höchste oder niedrigste Stufe?). Intern konsistent lesbar, aber hohes Missverständnis-Potenzial; Konvention nirgends definiert.
- Apollo-Medien uneinheitlich: Garage verlinkt Video (`yt:-0Yf6SVAYpw`), Bento-Kachel Bild — anders behandelt als RSI Meteor in 4.2.1.
- Topic-Text "je höher die Stufe, desto näher die Rückkehr" kollidiert sprachlich mit T1=beste (T1 ist numerisch die NIEDRIGSTE Nummer) — prüfen, was gemeint ist.


## Alpha 4.3.2 — Fractured Frontiers
- [ ] Datum: 16. Oktober 2025; Ära "Onyx & Heilung"; Typ point ("Point-Release & Event") `(json)` `(patch-page)`
- [ ] Tagline: "Frontier-Fighters-Finale, Salvage-Rework und Yormandi-Boss." `(json)`
- [ ] Finale in 3 Phasen: Aufklärung → Belagerung → Takedown `(json)`
- [ ] Verbündete: Headhunters + Citizens for Prosperity; Gegnerin: Amelia Boyd `(json)`
- [ ] Phase 3 = serverweit koordinierter Polaris-Takedown (1 gestohlene Polaris) `(json)` `(patch-page)`
- [ ] Salvage-Rework: erhöhter Materialwert; Refining ausgebaut `(json)`
- [ ] Yormandi: neue schlangenartige, biomechanische Kreatur; Standort ASD Site B `(json)`
- [ ] Yormandi solo machbar, im Duo leichter `(json)`
- [ ] Yormandi "in der Tradition der Valakkar-Würmer" `(patch-page)`
- [ ] Wikelo-Aufträge verlangen Augen und Zungen von Yormandi `(patch-page)`
- [ ] Neues Schiff: Anvil Paladin, schwerer Gunship, Turm-Positionen + Crew-Deck (einziges neues Schiff) `(json)`
- [ ] Combat-/FPS-Updates + Economy-Tuning `(json)`
- [ ] Fixes: "zahlreiche", Anzahl nicht spezifiziert `(json)`
- [ ] Topic-Statstrip: 3 Phasen, 2 verbündete Fraktionen, 1 gejagte Polaris `(topic:4-3-2-frontier-fighters)`
- [ ] Frontier Fighters operieren "von Stanton bis tief nach Pyro" `(topic)`
- [ ] Trailer: MCJlD2Meuek "Alpha 4.3 – Dark Territory", own: false `(json)`

### ⚠ Verdachtsfälle
- Trailer = recycelter 4.3-Serientrailer (own:false), kein eigener 4.3.2-Trailer.
- "Tradition der Valakkar-Würmer" nur auf Patch-Seite, keine Quelle im JSON.
- Fix-Anzahl fehlt (Nachbar 4.4.0 hat präzise "180+").

## Alpha 4.4.0 — Welcome to Nyx
- [ ] Datum: 19. November 2025; Ära "Neue Horizonte"; Typ major `(json)` `(patch-page)`
- [ ] Nyx = drittes voll simuliertes Sternsystem, Jump Points zu Stanton UND Pyro `(json)`
- [ ] Nyx: nebelverhangen, asteroidendicht, gesetzlos; Glaciem Ring = dichter Asteroidengürtel `(json)`
- [ ] Levski liegt im Asteroiden Delamar; Sitz der Peoples Alliance; einziger fester Halt `(json)`
- [ ] Vanduul erstmals als eigenständige KI-Gegner-Fraktion im PU `(json)`
- [ ] Vanduul: genau 4 KI-Schiffstypen — Stinger (leicht), Glaive, Scythe, Blade `(json)`
- [ ] Vanduul greifen ohne Vorwarnung an `(json)`
- [ ] Operation Sworn Enemies: Untersuchungsmission in verlassenen Nyx-Stationen `(json)`
- [ ] Interstellares Hauling: prozedurale Frachtmissionen über Stanton, Pyro, Nyx `(json)`
- [ ] IAE 2955 in Orison; 200+ Schiffe testbar; Free-Fly bis 3. Dez 2025; Dauer "14 Tage" `(json)`
- [ ] Neue Schiffe: RSI Perseus (schweres Gunship), RSI Salvation (Salvage); Vanduul Scythe als KI-Schiff gelistet `(json)`
- [ ] Fixes: 180+ `(json)`
- [ ] 2 Topic-Seiten: nyx-system, vanduul `(json)`
- [ ] Nyx-Topic-Statstrip: "3 = System nach Stanton & Pyro", "1 = Levski in Delamar" `(topic:4-4-0-nyx-system)`
- [ ] Vanduul-Topic-Statstrip: "4 KI-Schiffstypen", "1 neues System", "0 Vorwarnungen" `(topic:4-4-0-vanduul)`
- [ ] Vanduul = "jahrzehntealter Erzfeind aus dem Vanduul-Krieg" `(topic:4-4-0-vanduul)`
- [ ] Trailer: ilDmGyHLQNg "Alpha 4.4: Welcome to Nyx", own: true `(json)`

### ⚠ Verdachtsfälle
- "14 Tage" IAE-Dauer taucht nur einmal auf (json feature-facts), sonst nirgends — rechnerisch plausibel (19. Nov–3. Dez), aber unbelegt.
- JSON dokumentiert selbst frühere Korrekturen (Verifikations-Log: RSI-Salvation-Rolle, Jump-Points-Feature) — Datei war schon einmal fehlerhaft.
- dateDisplay "19. Nov 2025" abgekürzt vs. sonst ausgeschriebene Monatsnamen.
- Tag "Interstellar Hauling" ohne Topic-Seite und ohne Zahlen — schwach belegt.

## Alpha 4.5.0 — Dawn of Engineering
- [ ] Datum: 17. Dezember 2025; Ära "Neue Horizonte"; Typ major `(json)`
- [ ] 4 neue Engineering-Systeme: Engineering, Ship Armor, Feuer-Hazard, Power Management `(json)`
- [ ] Ship Armor = physische Schicht ÜBER Hülle und Komponenten; absorbiert Schaden; verschleißt `(json)`
- [ ] Feuer: breitet sich dynamisch aus, frisst Sauerstoff, greift auf Räume über, muss aktiv gelöscht werden `(json)`
- [ ] Power Management: Echtzeit-Energieverteilung; Überlastung → Hitze/Ausfälle/Schäden `(json)`
- [ ] Engineering-Terminal: Echtzeit-Monitoring + Reparatur; neue Crew-Rolle `(json)`
- [ ] Vulkan wird Standard-Renderer, ersetzt DirectX 11; seit Alpha 3.23 experimentell `(json)` `(patch-page)` `(topic:4-5-0-engineering)`
- [ ] Vulkan: Multithread-Rendering + HDR-Support `(patch-page)`
- [ ] VR-Unterstützung: experimentell, via Vulkan `(json)`
- [ ] KEINE neuen Schiffe, KEINE Events (Arrays leer) `(json)`
- [ ] 1 Topic-Seite: engineering `(json)`
- [ ] Topic-Statstrip: "4 neue Systeme", "1 Panzerschicht", "VULKAN Standard ab 4.5.0", "VR experimentell" `(topic)`
- [ ] Trailer: JgpLAqW1wOU "Alpha 4.5: Dawn of Engineering", own: true `(json)`
- [ ] Kein Wipe erwähnt; keine Fix-Anzahl angegeben `(json)`

### ⚠ Verdachtsfälle
- Ship-Armor- und Vulkan-Beschreibungen jeweils 3× nahezu wortgleich (json/patch-page/topic) — Text-Recycling über Ebenen.
- Keine Fix-Anzahl (Lücke ggü. 4.3.2/4.4.0).
- Major-Release ohne einziges Schiff/Event — plausibel (Technik-Patch), aber gegen Quelle prüfenswert.


## Alpha 4.6.0 — Lifeline for Levski
- [ ] Datum: 29. Januar 2026; Ära "Neue Horizonte"; Typ major `(json)` `(patch-page)`
- [ ] Event "Lifeline for Levski" — Pandemie an Levski, läuft bis 17. März 2026 `(json)` `(patch-page)`
- [ ] Auslöser: fehlerhafte Luftfilter; Krankheit "People's Ailment" (Lunge), verursacht durch Molina-Pilz `(json)`
- [ ] Molina-Pilz benannt nach Samuel Molina, erstem Todesopfer `(patch-page)`
- [ ] Gegner: "The Moraine" — Piraten aus Asteroidensiedlungen im Glaciem Ring (Nyx) `(json)` `(patch-page)`
- [ ] Mission "Clearing the Air": Supply-Escorts gegen The Moraine (Antifungal, Heilmittel, Filter-Komponenten) `(json)`
- [ ] LAMP (Light Amplification): Cockpit-Nachtsicht durch Restlicht-Verstärkung `(json)` `(patch-page)`
- [ ] Neues Schiff: RSI Hermes — Blockade-Runner, ca. 288 SCU `(json)` `(patch-page)`
- [ ] Neues Schiff: Argo Moth — Salvage (mittel); Nachschub ab 11. Februar 2026 `(json)` `(patch-page)`
- [ ] 160+ Bugfixes (Server-Meshing, Streaming, NPC, UI, Missionsmarker, Hangars) `(json)` `(patch-page)`
- [ ] Engineering & Armor-Feinschliff; "Place-from-Inventory" reaktiviert; Star-Map mit Harvestable-Daten; Kel-To-Kiosks `(json)`
- [ ] Trailer: OPp6dd2WSpI `(json)` `(patch-page)`
- [ ] Kein Wipe erwähnt; KEINE Topic-Seiten (topics: []) `(json)`

### ⚠ Verdachtsfälle
— keine gefunden

## Alpha 4.7.0 — Welcome to the Rock
- [ ] Datum: 26. März 2026; Ära "Neue Horizonte"; Typ major `(json)` `(patch-page)`
- [ ] Crafting T0: FPS-Waffen & Rüstung aus Blueprints + seltenen Mineralien `(json)` `(patch-page)` `(topic:4-7-0-crafting)`
- [ ] Materialqualität beeinflusst finale Stats `(json)` `(topic)`
- [ ] Operation Breaker Stations: mehrstufige Koop-Mission im Keeger Belt (Nyx) `(json)` `(patch-page)` `(topic)`
- [ ] 2 Modi: PvE (privat) & PvP (offen/FFA) `(json)` `(patch-page)` `(topic)`
- [ ] 5 Schritte: Stationen reaktivieren → Laser zünden → Gegner abwehren → Optik-Komponenten fertigen → Ressourcen extrahieren `(topic)`
- [ ] Gegner: Claw Salamander, Eis-Valakkar `(json)` `(topic)`
- [ ] QV Breaker Stations: von QV Planet Services gebaut, kürzlich von Shubin übernommen `(topic)`
- [ ] Neues Schiff: Aurora Mk II — RSI-Starter, ersetzt altes Modell; Module Standard/Cargo(+6 SCU)/Combat `(json)` `(patch-page)`
- [ ] Inventar-Rework; Combat-Overhaul (Shield/Armor/Radar/Missile) `(json)`
- [ ] Event "Stella Fortuna": Racing, Video-Contest, Cosmetics `(json)` `(topic)`
- [ ] Trailer: sX4_Q6AuqSI `(json)` `(patch-page)`
- [ ] 1 Topic-Seite: crafting; kein Wipe erwähnt `(json)`

### ⚠ Verdachtsfälle
- Singular/Plural-Inkonsistenz "Blueprint(s)" zwischen Statstrip ("2 Zutaten") und Fließtext.
- keyFacts unterschlägt die Standard-Konfiguration der Aurora Mk II (nennt nur Cargo ODER Combat; features nennen 3 Optionen).

## Alpha 4.8.0 — Tactical Strike
- [ ] Datum: 14. Mai 2026; Typ major `(json)` `(patch-page)`
- [ ] Ära: "Tactical Strike" — identisch mit Codename (bricht das Ären-Schema; 4.6/4.7 = "Neue Horizonte") `(json)`
- [ ] VOLLER WIPE — erster seit 4.0.0 `(json)` `(patch-page)` `(topic:4-8-0-tactical-strike-groups)`
- [ ] 166+ Bugfixes `(json)` `(patch-page)`
- [ ] G-Force-Flugmodell: Greyout → Redout → Blackout; Toleranz abhängig vom Anzug `(json)` `(patch-page)`
- [ ] Neue Schiffe: Drake Ironclad (Panzer-Hauler), Ironclad Assault (Combat-Variante), Drake Command Module `(json)` `(patch-page)`
- [ ] Aegis Hammerhead: "Gold Standard"-Rework (NICHT neu) `(json)` `(patch-page)`
- [ ] Tactical Strike Groups: Koop-Multi-Schiff-Missionen für Orgs, Nyx, QV Extraction Stations `(json)` `(patch-page)` `(topic)`
- [ ] TSG: empfohlen 7+ Spieler; Rollen Fighter/Bomber/Support/Capital `(json)` `(topic)`
- [ ] TSG: Boss = Vanduul Mauler; 5 Phasen (Schiffskampf → Relais/Tunnel → Kühler/Kern → FPS-Infiltration → Mauler) `(json)` `(topic)`
- [ ] TSG: Belohnung exklusiver Armbrust-Blueprint; "erste dedizierte kooperative Schiffskampf-Operation" `(json)` `(topic)`
- [ ] Refueling-Überarbeitung (T0); Vehicle Loadout Recovery (LTP-integriert); Ship Hangar Service (T0) `(json)`
- [ ] Neue Ausrüstung: UltiFlex-Armbrust, Kastak-Plasma-Granate, Tailwind-Flugsuit `(json)`
- [ ] Trailer: RWQSxN-ZukE `(json)` `(patch-page)`
- [ ] 2 Topic-Seiten: tactical-strike-groups, xenothreat `(json)`
- [ ] ⚠XT XenoThreat als Feature/Event in 4.8.0: "Rückkehr des massiven serverweiten Events" `(json)` `(patch-page)`
- [ ] ⚠XT XenoThreat: Fraktion aus desertierten UEE-Navy-Soldaten, Herkunft Pyro `(json)` `(topic:4-8-0-xenothreat)`
- [ ] ⚠XT Szenario: Konvoi-Überfall + öffentliche Hinrichtung → Starfarer-Bergung → Flaggschiff-Verteidigung `(json)` `(topic)`
- [ ] ⚠XT Flaggschiff UEES War Hammer, verteidigt bei INS Jericho `(json)` `(patch-page)` `(topic)`
- [ ] ⚠XT Gegner-Wellen: Fighter, Hammerhead-Gunships, Idris-M-Fregatten `(json)` `(topic)`
- [ ] ⚠XT Verteidiger: Civilian Defense Force `(topic)`
- [ ] ⚠XT Topic-Meta datiert Rückkehr explizit "mit Alpha 4.8.0" `(topic)`

### ⚠ Verdachtsfälle
- **⚠XT XenoThreat-Datierung (User-Verdacht: kam erst 4.8.3):** json + Patch-Seite + komplette eigene Topic-Seite verorten das Event fest in 4.8.0 — alle Stellen oben mit ⚠XT markiert.
- **Statstrip-Widerspruch im XenoThreat-Topic:** "3 eskalierende Event-Phasen" vs. 4 Scrollytelling-Schritte auf derselben Seite.
- **Ära-Feld:** "Tactical Strike" = Codename statt Ära — möglicher Eingabefehler (4.6/4.7 = "Neue Horizonte").
- Hammerhead (Rework) steht in der Ship-Garage optisch gleichrangig neben dem Neuzugang Ironclad — irreführende Gleichbehandlung.
- TSG (Nyx) und XenoThreat (Stanton) unter einem Codename ohne Erklärung des geografischen Bruchs.


## Alpha 4.8.1 — Defend Location
- [ ] Datum: 3. Juni 2026; Ära "Tactical Strike"; Typ point `(json)` `(patch-page)`
- [ ] Neuer Missionstyp "Defend Location": wellenbasierter Raumkampf, Verteidigung von Asteroiden-Mining-Basen gegen Bomber `(json)` `(patch-page)` `(topic:4-8-1-defend-location)`
- [ ] 385 Einsatzorte über Stanton & Pyro `(json)` `(topic)` — Patch-Seite nennt dieselbe Zahl "Missionen" `(patch-page)`
- [ ] 149 verteidigbare Basen `(json)` `(patch-page)` `(topic)`
- [ ] 6 Schwierigkeitsstufen (Very Easy bis Super) `(json)` `(topic)`
- [ ] Auftraggeber: Foxwell, Head Hunters, CFP, Rough and Ready `(json)` `(topic)`
- [ ] Belohnungen: aUEC, Reputation, Org-Scrip, Crafting-Blueprints (höhere Stufen) `(json)` `(topic)`
- [ ] Hybrid-Variante: Verteidigung + Escort startender/landender Schiffe `(json)` `(topic)`
- [ ] Jeder durchgelassene Bomber beschädigt Infrastruktur `(json)` `(topic)`
- [ ] Blueprints speisen das 4.7.0-Crafting-System `(json)` `(topic)`
- [ ] 30+ Bugfixes (Ship-Claim, Landing-Gear/Hangartore, 60k-Shard-Lock) `(json)` `(patch-page)`
- [ ] Kein Schiff, kein separates Event, kein Wipe `(json)`
- [ ] Trailer: RWQSxN-ZukE "Alpha 4.8 - Tactical Strike", own: false `(json)` `(patch-page)`

### ⚠ Verdachtsfälle
- Begriffsverschiebung: "385 Einsatzorte" (json/topic) vs. "385 Missionen" (Patch-Seite Bento + Marquee).
- json listet "Einsatzorte: 385" und "Basen: 149" nebeneinander ohne Erklärung des Verhältnisses (erst Topic-Band "Maßstab" erklärt: 385 gespeist aus 149).

## Alpha 4.8.2 — Gatac & Alien Week
- [ ] Datum: 17. Juni 2026; Ära "Tactical Strike"; Typ point `(json)` `(patch-page)`
- [ ] Neues Schiff: Gatac Railen — Grav-Lev-Frachter, ca. 640 SCU in dreieckigen Frachtpods `(json)` `(patch-page)` `(topic:4-8-2-alien-week)`
- [ ] Railen nutzt Xi'an-Graviton-Levitation statt klassischer Triebwerke `(json)` `(patch-page)`
- [ ] Neues Schiff: Gatac Tyilui — Snub-Carrier für quantum-unfähige Snubs `(json)` `(patch-page)` `(topic)`
- [ ] Tyilui-Design inspiriert von "2001: A Space Odyssey" `(json)`
- [ ] Event "Alien Week 2956": 17.–25. Juni 2026 `(json)`
- [ ] Alien Week feiert nicht-menschliche Hersteller rund um First Contact Day `(json)` `(topic)`
- [ ] Gatac = Headliner 2956 mit Railen, Syulen und Tyilui `(json)` `(patch-page)` `(topic)`
- [ ] Weitere Hersteller: Aopoa (Khartu-al, Nox), Banu, Esperia (Talon) `(json)` `(topic)`
- [ ] Pledge-Store-Aktionen, limitierte Lackierungen, Alien-Gear; Xi'an-Sprachlektionen `(json)` `(topic)`
- [ ] First Contact Day: jährlicher Gedenktag an den Erstkontakt Menschheit↔Xi'an `(json)` `(patch-page)` `(topic)`
- [ ] Patch-Seite datiert den Erstkontakt auf "im Jahr 2530" — Jahreszahl NUR dort `(patch-page)`
- [ ] LTP aktiv mit 20.000 aUEC Startguthaben, kein voller Wipe `(json)`
- [ ] Keine Fix-Anzahl beziffert `(json)`
- [ ] 3 Videos: Railen (Xh35kuWo0a4), Tyilui (oulQmbwN87M), Syulen (_XhngLncdVU) `(patch-page)`

### ⚠ Verdachtsfälle
- **Syulen fehlt im ships[]-Array**, wird aber überall (events, Features, Patch-Seite, Topic) als dritter Gatac-Headliner geführt — strukturelle Lücke json↔Fließtext.
- **"Im Jahr 2530" (Xi'an-Erstkontakt) nur auf der Patch-Seite** — weder json noch Topic nennen ein Jahr. ZUSATZ-FLAG (Fable): In der SC-Lore feiert der First Contact Day üblicherweise den Erstkontakt mit den BANU (2438, Vernon Tar); der Xi'an-Kontakt (2530) ist ein anderes Ereignis — die Zuordnung "First Contact Day = Xi'an 2530" könnte selbst eine Falschinfo sein. Bitte prüfen.
- Topic-Statstrip: "3 Gatac-Headliner" + separat "1 flugfertige Railen" — impliziert unausgesprochen, dass Syulen/Tyilui nicht flugfertig sind; nirgends explizit aufgelöst.
- Event-Zeitraum (17.–25. Juni) steht nicht auf der Patch-Seite selbst, nur in json/Topic.
