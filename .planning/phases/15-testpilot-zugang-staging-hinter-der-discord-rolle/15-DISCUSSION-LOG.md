# Phase 14: Testpilot-Zugang: staging hinter der Discord-Rolle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-17
**Phase:** 15-testpilot-zugang-staging-hinter-der-discord-rolle
**Areas discussed:** Vorabentscheidungen, Anmeldeweg am Tor, Aktualität der Rolle, Reichweite des Tors, Perks im Einzelnen, Nachgelagerte Punkte (Bestand, Name, Vergabe, Kanal)

---

## Vorabentscheidungen (vor Anlage der Phase)

Gestellt nach der Bestandsaufnahme, weil sie den Zuschnitt der Phase selbst bestimmen.

### Strenge des Tors

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Anmeldeseite, sonst nichts | Jede URL landet bei einer Seite „Diese Vorschau ist für Testpiloten" mit Discord-Anmeldeknopf | ✓ |
| Hartes 403, keine Erklärung | Nichts wird ausgeliefert, kein Hinweis | |
| Seite sichtbar, nur Banner | Kein echtes Tor, nur ein Hinweis oben | |

**Notiz:** Die dritte Option wurde ausdrücklich als „erfüllt deinen Wunsch nicht" gekennzeichnet und trotzdem angeboten, um die billige Variante sichtbar zu machen.

### Vergabe der Rolle

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Betreiber vergibt von Hand | Rolle raus aus dem Onboarding, rein in die Hand des Betreibers | ✓ |
| Bewerbung im Discord, Betreiber bestätigt | Knopf/Formular erzeugt eine Anfrage | |
| Automatisch ab Rang/Aktivität | Bot vergibt ab Level X oder nach N Fehlerberichten | |
| Bleibt selbst vergebbar | Status quo | |

### Identitätsnachweis

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Discord an das Site-Konto koppeln | „Discord verknüpfen" im Konto-Bereich; trägt auch die Perks | ✓ |
| Eigener Discord-Login nur am Tor | Zweites Anmeldesystem neben dem bestehenden | |

### Perks

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Abzeichen im Piloten-Profil | Auszeichnung auf /pilot/&lt;handle&gt; neben der RSI-Verifizierung | ✓ |
| Eigener Discord-Kanal + Deploy-Ping | Privater Raum, Bot meldet jeden neuen staging-Stand | ✓ |
| Rang-/XP-Bonus im Bot | Nutzt die vorhandene Level-Maschinerie | ✓ |
| Namensnennung auf der Seite | Danksagung/Credits auf verse-base.com | ✓ |

**Notiz:** Mehrfachauswahl, alle vier gewählt.

---

## Anmeldeweg am Tor

Vorbemerkung an den Betreiber: Sobald die Discord-ID einmal bewiesen ist, kann der Bot-Token jederzeit server-zu-server nach der Rolle fragen — der OAuth-Umweg ist ein einmaliger Eigentumsnachweis, kein Dauerzustand.

### Wie meldet sich ein Testpilot an?

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Discord wird zweiter Anmeldeweg | Gleichberechtigt neben E-Mail/Passwort; Supabase kann den Provider ab Werk; EIN Mechanismus trägt Tor und Abzeichen | ✓ |
| Konto-Login wie bisher + einmal verknüpfen | E-Mail/Passwort bleibt einziger Eingang, Discord wie heute RSI verknüpft | |
| Eigener Discord-Login nur am Tor | Site-Konto bleibt unberührt | |

### Jemand hat die Rolle, aber kein Konto

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Konto wird beim Discord-Login angelegt | Erster Login erzeugt still ein Konto | |
| Erst registrieren, dann verknüpfen | Reguläres Konto mit Bestätigungsmail, danach Verknüpfung | ✓ |
| Gar kein Konto nötig | Tor lässt nach OAuth durch, ohne Site-Konto | |

**Notiz:** Diese Wahl steht im technischen Widerspruch zur vorherigen — `signInWithOAuth` legt bei Supabase von sich aus ein Konto an. Der Widerspruch wurde sofort offengelegt statt still aufgelöst.

### Widerspruchsauflösung

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| So bauen: Discord meldet an, legt nie an | Kontoerstellung über Discord serverseitig unterbunden; Unbekannte bekommen „bitte erst registrieren" | ✓ |
| Discord darf doch Konten anlegen | Der einfache Weg, aber ohne bestätigte E-Mail | |
| Kein Discord-Login, nur Verknüpfen | Zurück auf den zweiten Anmeldeweg von oben | |

**Notiz:** Der Preis wurde benannt — ein Riegel an der Anmeldung, der vorgeführt rot werden muss, weil ein Fehler dort alle aussperrt.

### Was zeigt die Anmeldeseite?

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Erklärung + Discord-Knopf + Weg zur Rolle | Zwei Sätze, Anmeldeknopf, Link zum Discord-Server; kein Seitenmenü | ✓ |
| Kahl: Wortmarke, ein Satz, Knopf | Verrät nichts, auch nicht den Weg hinein | |
| Volles Seitenlayout mit Kopfleiste | Gibt Menüstruktur preis, schleppt ~37 KB SiteNav mit | |

### Sprache der Torseite

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Tor spricht beide Sprachen | DE und EN, Rückkehr auf die gewünschte URL in der gewünschten Sprache | |
| Nur Englisch, danach normal weiter | Eine einzige Torseite auf Englisch | ✓ |

**Notiz:** Folge für `verify:sync` (8.678 EN/DE-Paare) wurde benannt und in CONTEXT.md D-11 als offener Zuschnitt-Punkt festgehalten.

---

## Aktualität der Rolle

Vorbemerkung: Ein Livecheck bei jedem Aufruf ist bei ~17.000 Unterseiten nicht tragbar; die Frage ist die Gültigkeitsdauer des Ausweises.

### Wann ist ein Entzogener draußen?

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Innerhalb einer Stunde | Ausweis gilt 60 Minuten, erneuert sich still | |
| Sofort beim nächsten Seitenaufruf | Genaueste Variante | ✓ |
| Innerhalb eines Tages | Am sparsamsten und störungsrobustesten | |

**Notiz:** Nach der Antwort wurde richtiggestellt, dass „sofort" hier **nicht** eine HTTP-Anfrage je Seitenaufruf bedeuten muss — der Bot kennt den Stand aus dem Gateway-Ereignis. Damit ist „sofort" billiger als ein kurzlebiger Ausweis, nicht teurer.

### Discord nicht erreichbar

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Gültige Ausweise weiter, neue verweigern | Wer drin ist, arbeitet weiter; Neuanmeldung scheitert ehrlich | ✓ |
| Alles dicht | Auch für bereits Angemeldete | |
| Alles offen lassen | Tor fällt bei Störung auf | |

### Sofort-Rauswurf

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Ja, Sperrliste | Macht den Ausweis unabhängig von der Rolle wertlos | ✓ |
| Nein, Ablauf genügt | Weniger zu bauen | |

### Einblick, wer die Vorschau nutzt

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Liste der Testpiloten mit letztem Zugriff | Zeigt, wer wirklich testet | ✓ |
| Nur wer die Rolle hat | Kein Zugriffsprotokoll, datensparsam | |
| Gar nichts | Nichts zu bauen | |

---

## Reichweite des Tors

Vorbemerkung: Ein Tor über alles bricht `npm run check:staging`, das `/build.json` abholt und laut CLAUDE.md Bedingung jeder Fertig-Meldung ist.

### Was genau ist gesperrt?

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Alles außer benannter Ausnahmeliste | HTML, JSON, Bilder, Bundles; Liste kurz, prüfbar, vorgeführt rot | ✓ |
| Nur HTML-Seiten | Assets und JSON bleiben offen | |
| Alles, ohne Ausnahme | Auch /build.json — `check:staging` wäre tot | |

### Beleg für den Deploy-Check

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| /build.json bleibt offen | Enthält nur Commit-Hash und Datum | ✓ |
| Mit einem Schlüssel im Kopf abholen | Dichter, aber Geheimnis auf dem Entwicklungsrechner nötig | |
| Check prüft stattdessen die Torseite | Stempel steht dann sichtbar auf der Sperrseite | |

### Notzugang für den Betreiber

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Admin-Rolle allein genügt | Wer `admin` in `user_roles` trägt, kommt durch | ✓ |
| Separates Notschloss (Geheimnis im Container) | Wirkt auch bei Supabase-Ausfall, aber zweiter Schlüssel = zweites Loch | |
| Nein, gleiche Regel für alle | Kein Weg zurück, wenn die Kopplung bricht | |

### Zuschnitt

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Einzelstück für staging | Kein Vorratsbau | ✓ |
| Allgemein, später auch für Live-Seiten | Mehr Aufwand für etwas, das heute niemand braucht | |

---

## Perks im Einzelnen

### Abzeichen

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Neben RSI-Verifiziert, gleiche Bauform | Zweites Abzeichen in derselben Reihe, eigene Farbe | ✓ |
| Eigene, auffälligere Stelle im Profilkopf | Verdreht die Rangfolge gegenüber RSI | |
| Nur ein kleiner Hinweis | Ein Perk, den man suchen muss, wirkt nicht als Perk | |

### Deploy-Ping

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Änderungsliste aus den Commit-Betreffs | Plus Kennung und Link; die Betreffs sind hier ganze Sätze | ✓ |
| Nur „neuer Stand ist da" mit Link | Nie falsch, aber der Tester sucht selbst | |
| Änderungsliste, vom Betreiber freigegeben | Wartet in der Praxis oft auf eine Freigabe, die nicht kommt | |

### XP-Bonus

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Je Fehlerbericht mit eigenem Thread | Einmal pro Thread, nicht pro Nachricht | ✓ |
| Dauerhafter Multiplikator | Belohnt Anwesenheit statt Arbeit | |
| Einmalige Gutschrift bei Ernennung | Danach wirkungslos | |

### Namensnennung

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Nur auf ausdrücklichen Wunsch | Schalter im Konto, Standard AUS | ✓ |
| Automatisch, mit Widerspruchsmöglichkeit | Jemand steht dort, bevor er zugestimmt hat | |
| Automatisch, ohne Widerspruch | Rechtlich die schlechteste Variante | |

---

## Nachgelagerte Punkte

Aufgefallen während der Besprechung; der Betreiber entschied sich ausdrücklich, sie zu besprechen statt sie als offene Punkte weiterzureichen.

### Bestandsträger der selbst vergebenen Rolle

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Erst zählen und zeigen, dann allen entziehen | Trockenlauf nennt Namen und Anzahl, danach sauberer Schnitt | ✓ |
| Liste zeigen, je Person entscheiden | Niemand verliert sie versehentlich | |
| Alle behalten sie | Tor öffnet sofort für eine nie ausgewählte Gruppe | |

**Notiz:** Ohne diesen Schritt ist das Tor wirkungslos — die Rolle war seit dem Serveraufbau selbst vergebbar. Die Anzahl steht auf dem lebenden Server und ist im Repo nicht ablesbar.

### Anzeigename der Rolle

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| „Test Pilots" behalten | Steht so im Blueprint, passt zum Ton der übrigen Rollen | ✓ |
| „Testers" / nüchtern | Bricht mit dem Ton (Fleet Command, Navigators) | |
| Eigener Name des Betreibers | Wandert dann in Blueprint, Torseite, Abzeichen, Hilfetexte | |

**Notiz:** Der Betreiber hatte den Namen in seiner ursprünglichen Anfrage ausdrücklich offengelassen („oder ich weis noch nicht welchen namen diese rolle tragen wird"). Interner Schlüssel `tester` bleibt unabhängig vom Anzeigenamen.

### Vergabeweg in der Praxis

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| Egal wie — Bot reagiert auf das Ereignis | `guildMemberUpdate` trägt Begrüßung und Buchführung | ✓ |
| Nur über einen Bot-Befehl | Verlässt sich darauf, dass der Weg nie umgangen wird | |
| Nur über die Discord-Oberfläche, ohne Begrüßung | Der Neue erfährt nicht, was er jetzt kann | |

### Form des privaten Kanals

| Option | Beschreibung | Gewählt |
|--------|-------------|----------|
| EIN Kanal in BUILD & FEEDBACK | Ein Raum, nur für Testpiloten sichtbar | ✓ |
| Eigene Kategorie für Testpiloten | Läuft der Zusammenlegung vom 17.08. zuwider | |
| Kein eigener Kanal — Ping in #tools | Der ganze Server liest Unfertiges mit | |

**Notiz:** Vor der Frage wurde darauf hingewiesen, dass am Vortag `#suggestions` und `#support` zu einem `#feedback` zusammengelegt wurden — ein neuer Kanal braucht deshalb eine eigene Begründung.

---

## Claude's Discretion

Bewusst nicht entschieden, an die Recherche übergeben (Einzelheiten in CONTEXT.md):

1. Wo der Türsteher sitzt — Cloudflare Worker vs. nginx `auth_request` gegen den Bot vs. njs plus Edge Function
2. Wie der Rollenstand zum Türsteher kommt — Bot im Anfragepfad oder Push nach Supabase bei `guildMemberUpdate`
3. Form, Lebensdauer und Erneuerung des signierten Cookies (die Sitzung liegt im `localStorage` und ist am Rand unsichtbar)
4. Ob die Torseite eine gebaute Astro-Seite ist oder vom Rand kommt — und was das für `verify:sync` bedeutet
5. Der Zuschnitt in Wellen; die Kopplung gehört in die erste

## Deferred Ideas

- Das Tor auf Teile der Live-Seite ausweiten — eigene Phase, eigene Begründung
- Bewerbungsverfahren für die Rolle — verworfen zugunsten der Handvergabe, wieder aufzugreifen, wenn die Anfragen die Handvergabe sprengen
- Automatische Rollenvergabe ab Rang oder nach N Fehlerberichten — verworfen, der Betreiber will die Kontrolle behalten
- Eigene Kategorie mit mehreren Testpiloten-Kanälen — erst sinnvoll, wenn der eine Raum zu voll wird
- Todo `signatur-liste-kontogebunden.md` geprüft und **nicht** eingefaltet (Fehlalarm auf deutsche Füllwörter; Inhalt in Phase 9/10 erledigt)
