# Discord-Verschlankung — Trockenlauf-Plan

**Stand:** 09.08.2026 · Zweig `claude/discord-server-organization-16099e` · **noch nichts am Live-Server verändert**

## Warum

Der Server soll nur noch einem Zweck dienen: **Entwicklung von und Feedback zu verse-base.com.**
Es gibt sehr viele Star-Citizen-Discords, jeder mit klarem Zweck — SC-News, CCU-Spiel, LFG/Orgs. Gegen die anzutreten heißt, überall Zweiter zu sein. Eng bleiben heißt, das Einzige zu tun, was hier sonst niemand tut: direkter Draht zu den Werkzeugen und zu dem, der sie baut.

Die Regel steht jetzt als Prüfstein im Kopf von `discord/blueprint.mjs`: *dient das der Seite oder dem Feedback dazu?* Wenn nein, gehört es auf einen fremden Server.

## Vorher / Nachher

|  | vorher | nachher |
|---|---|---|
| Kanäle | 41 | **16** |
| Kategorien | 6 | **5** |
| Rollen (Blueprint) | 19 | **12** |
| Onboarding-Abfragen | 4 | **3** |
| Seed-Beiträge | 10 | 9 |

Die 12 Rang-Rollen des Bots sind hier nicht mitgezählt — die gehören dem Bot, nicht dem Blueprint, und bleiben unangetastet.

## Der neue Server

```
⁘ START HERE      📜 welcome · 📏 rules · 🧭 start-here
📡 RELEASES       📣 announcements · 🩹 patch-notes
🔧 BUILD & FEEDBACK  🐞 bug-reports · 💡 suggestions · 🛟 support · 🧰 tools · 🤖 bot-commands
💬 HANGAR         💬 general · 🛬 Landing Zone (Voice)
🛡 FLIGHT DECK    🗝 staff-chat · 🧾 mod-log · ⚙ bot-config · 📥 community-updates  (privat)
```

### Neu (2)

- **🐞 bug-reports** — als **Forum**, nicht als Textkanal: ein Thread pro Fehler, Schlagworte je Werkzeug (Item Finder, Ships, Crafting, Mining, Patch archive, Account, Discord bot, Mobile, Data error) plus **Fixed**. Damit fällt kein Bericht mehr aus dem Bildlauf. Das war der auffälligste Mangel: ein Entwicklungs-Server ohne Fehlermeldekanal.
  **Die Newcomer-Sperre ist genau hier aufgehoben** — eine Fehlermeldung ohne Screenshot ist eine halbe Fehlermeldung, und wer sie schreibt, ist typischerweise gerade erst beigetreten.
- **🧰 tools** — ersetzt die acht Werkzeug-Kanäle. Die Aufteilung je Werkzeug lebt jetzt in den Forum-Schlagworten, wo sie etwas nützt, statt in acht stillen Räumen.

### Entfernt (27)

| Gruppe | Kanäle |
|---|---|
| 🤝 CREW UP (ganze Kategorie) | looking-for-group · trade-deals · org-recruitment · events |
| Sozial | introductions · screenshots · clips · memes · off-topic · patch-chat |
| Werkzeug-Kanäle → `🧰 tools` | mining · trading · crafting-salvage · ships · combat · exploration · missions · wikelo-emporium · guides |
| Voice | Mining Op · Trade Run · Combat Wing · Chill Lounge · Briefing Room (Stage) · AFK |
| Sonstiges | pick-your-roles (Inhalt steckt jetzt in start-here) · veterans-lounge |

### Bleibt, wandert aber die Kategorie (7)

`announcements` · `patch-notes` → 📡 RELEASES  ·  `suggestions` · `support` · `bot-commands` → 🔧 BUILD & FEEDBACK  ·  `general` · `Landing Zone` → 💬 HANGAR

⭐ **Kein Verlust dabei:** `build.mjs` adoptiert gleichnamige Kanäle aus jeder Kategorie und **verschiebt** sie (`build.mjs` Zeile 390–407). Nachrichtenverlauf, Anheftungen und Kanal-ID bleiben. Ohne diesen Zweig würde stattdessen eine leere Kopie entstehen.

### Rollen: 19 → 12

- **Raus (8):** ⛏ Miner · 💰 Trader · 🔧 Industrialist · 🚀 Combat Pilot · 🧭 Explorer · 📜 Contractor · 🐟 Wikelo Regular · 🎉 Event Pings — sie haben nie etwas freigeschaltet (nur Farbe + Ping), und ihre Kanäle sind weg.
- **Neu (1):** 🧪 **Test Pilots** — die einzige Interessen-Rolle, die bleibt, weil sie von der Arbeit an der Seite handelt: Ping, wenn etwas vor dem Release getestet werden soll.
- **Bleibt:** die 3 Team-Rollen, 🔔 Patch Pings, 📢 Announcement Pings, 2 Sprachen, 4 Pronomen.

## Was sonst noch nachgezogen wurde

- `autoMod` — die Invite-Link-Regel hatte eine Ausnahme für `#org-recruitment`. Der Kanal ist weg, die Ausnahme ist leer: **Invite-Links sind jetzt ausnahmslos gesperrt**, mit einem freundlichen Hinweistext, wo man stattdessen fragt.
- `bot/src/config.mjs` — `noXpChannelNames` von `['bot-commands','memes','off-topic']` auf `['bot-commands']`. Sonst hätte `--validate` gemeckert (es prüft beide Richtungen).
- `bot/src/selftest.mjs` — ein Prüffall benutzte `😂・memes` als Beispiel für „Thread erbt vom Elternkanal"; jetzt `🤖・bot-commands`. Gleiche Mechanik, existierender Kanal.
- `build.mjs` — `guild.afkChannel` darf `null` sein (es gibt keinen AFK-Raum mehr). Vorher war die Prüfung unbedingt und hätte das Blueprint als ungültig gemeldet.
- Der Dauer-Invite **https://discord.gg/eaXhkf8d3Y** zeigt auf `#welcome` — der Kanal bleibt, der Link funktioniert unverändert weiter.

## ⚠ Der Builder löscht nichts

`build.mjs` legt an und gleicht ab, es entfernt **nie** etwas. Ein verschlanktes Blueprint allein lässt die 27 Kanäle also einfach stehen. Deshalb neu: **`discord/prune.mjs`** (`npm run prune`).

```
npm run prune              # Trockenlauf: was ginge, und wie lebendig es noch ist
npm run prune -- --archive # Kanäle verstecken, jede Nachricht bleibt erhalten
npm run prune -- --delete  # endgültig entfernen
```

Trockenlauf ist die Voreinstellung; er verbindet sich nur lesend. Er zeigt je Kanal **Erstellungsdatum und letzte Aktivität**, damit die Entscheidung nicht im Blindflug fällt.

`--archive` ist der umkehrbare Weg: der Kanal wandert in eine private Kategorie **🗄 ARCHIVE**, die @everyone nicht sieht. Verlauf bleibt, Seitenleiste wird ruhig, und man kann alles zurückziehen.

**Nie angefasst, in jedem Modus:** alles aus dem Blueprint · die 12 Rang-Rollen + ✦-Prestige-Rollen · verwaltete Bot-Rollen · @everyone · Rollen oberhalb des Bots · die Archiv-Kategorie selbst.

## Reihenfolge beim Anwenden

⚠ **`build` kommt VOR `prune`** — sonst stehen die alten Kategorien noch mit Überlebenden drin und lassen sich nicht räumen.

1. `npm run prune` — **lesen**, nichts passiert
2. `npm run build` — legt bug-reports + tools an, verschiebt die 7 Überlebenden in ihre neuen Kategorien, aktualisiert Seed-Beiträge, Onboarding, Welcome-Screen, AutoMod
3. `npm run prune -- --archive` (empfohlen) oder `-- --delete` — räumt die Waisen und die leer gewordenen Kategorien
4. `npm run order` — Rollenhierarchie neu setzen (Bulk-API ist kaputt, siehe README)
5. `npm run audit` — Gegenprobe

Schritt 2 braucht ein `npm install` in `discord/` (eigenes `package.json`) und den Token in `discord/.env`.

---

## Live gegangen am 09.08.2026

Ausgeführt in genau dieser Reihenfolge. **Endstand: `audit` meldet 0 Fehler.** Live-Baum: 5 sichtbare Kategorien mit 16 Kanälen, dazu die versteckte `🗄 ARCHIVE` mit allen 27.

**Drei Fehler, die erst der Live-Lauf gezeigt hat** — alle behoben:

1. ⚠⚠ **`prune.mjs` bot die komplette Rangleiter zum Löschen an.** Der Schutz verglich `RANKS[].name` (der blanke Name `Drifter`) mit dem Live-Rollennamen (`🌑 Drifter`, mit Insignie) — er traf nie. Der Trockenlauf listete 20 statt 8 Rollen; ein `--delete --roles` hätte alle 12 Rang-Rollen mitgenommen. Richtig ist `allRankRoleNames()`. **Genau dafür ist der Trockenlauf da.** Zusätzlich eingebaut: eine Gegenprobe, die abbricht, wenn nicht alle 12 Rang-Rollen live aufgelöst werden — der Namensabgleich muss sich beweisen, bevor ihm etwas Zerstörerisches anvertraut wird.
2. **Foren haben kein `.send()` und kein `.messages`.** `build.mjs` starb beim Seed für `#bug-reports`, `audit.mjs` stürzte beim Pin-Check ab. Ein Forum-Beitrag ist ein **Thread**, dessen Startnachricht den Inhalt trägt. Beide Stellen haben jetzt einen Forum-Zweig (Thread nach Titel finden → Startnachricht aktualisieren, sonst anlegen). Anpinnen läuft über `edit({ flags })`, nicht `setFlags` — und braucht ein eigenes `try/catch`, weil eine fehlende Methode **synchron** wirft und ein angehängtes `.catch()` sie nicht fängt.
3. **Threads liegen mit in `guild.channels.cache`.** `prune.mjs` hielt den Seed-Thread von `#bug-reports` für einen verwaisten Kanal und wollte ihn archivieren. Fehlgeschlagen (Threads haben keine Overwrites), aber jetzt sauber: `ch.isThread()` wird übersprungen.

**Bewusste Ausnahme, jetzt maschinell sichtbar:** In `#bug-reports` ist die Newcomer-Sperre aufgehoben. Der Audit meldete das zuerst als Fehler; er liest die Ausnahme jetzt aus dem Overwrite **des Blueprints selbst** (keine fest verdrahtete Kanalliste, die verrotten kann) und gibt sie als Notiz aus: „gate deliberately lifted in #🐞・bug-reports".

⚠⚠ **`--archive` versteckt nur vor Mitgliedern, nicht vor dir.** Administrator übergeht das `ViewChannel`-Verbot — der Betreiber sieht `🗄 ARCHIVE` samt aller 27 Kanäle weiter in der Seitenleiste. Für den Einzigen, der täglich draufschaut, ist der Server damit **kein bisschen kürzer geworden**. Das war der eigentliche Sinn der Übung, also ist Archivieren nur der Zwischenschritt: neuer Schalter `--drop-archive` räumt das Archiv endgültig ab, nachdem der Trockenlauf gezeigt hat, dass nichts drin ist.

**Noch offen:** Die **8 Spielstil-Rollen leben noch.** Der Löschbefehl wurde vom Auto-Mode-Klassifikator blockiert. Sie stehen ganz unten in der Hierarchie, werden nirgends mehr angeboten und tun nichts — aber sauber ist es erst mit:

```
npm run prune -- --delete --roles
```

Verbleibende Audit-Warnungen (alle erwartet): die 8 Rollen · 29 Kanäle „nicht im Blueprint" (= das Archiv) · Kategorie-Reihenfolge (wegen `🗄 ARCHIVE` am Ende) · fehlendes Bot-Avatar (Altbestand, `npm run avatar:apply`).

## Offene Entscheidungen — die gehören dir

1. **Die XP-Rangleiter (12 Ränge) bleibt unangetastet.** Sie ist Gemeinschafts-Möblierung und passt streng genommen nicht zum neuen Zweck. Ich habe sie trotzdem gelassen: Die Level-5-Schwelle ist echter Spam-Schutz, und die Leiter selbst herauszunehmen ist ein eigener Eingriff in den Bot und seine Datenbank. **Empfehlung:** vorerst lassen, getrennt entscheiden.
2. **`#guides` (Forum) enthält womöglich echte Beiträge.** Deshalb ist der Trockenlauf so wichtig — er zeigt die Anzahl aktiver Threads. **Empfehlung:** `--archive` statt `--delete`.
3. **Acht Spielstil-Rollen werden gelöscht, die Mitglieder gerade tragen.** Sichtbare Folge: ihre Namensfarbe ändert sich. Kein Rechteverlust, aber sichtbar.
4. **`#patch-notes` ist der strittige Verbleib.** Es ist streng genommen SC-News. Meine Begründung fürs Behalten: es ist keine Nachrichten-Sammlung, sondern das Patch-Archiv der Seite, das seine eigene Ausgabe postet — ein Werkzeug bei der Arbeit. Wenn du es anders siehst, ist es eine Zeile.
5. **Die Seite verlinkt den Discord nirgends** (`grep discord.gg src/` = 0 Treffer). Bei diesem engen Zweck ist die richtige Stelle nicht die Startseite, sondern dort, wo Leute auf Reibung stoßen: Feedback- und Support-Seite. Eigener Arbeitsschritt.
