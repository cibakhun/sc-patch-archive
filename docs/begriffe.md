# Begriffsliste: ein Name je Ziel

Stand 24.11.2026 · UX-Audit Paket A, Punkt A4 (Umsetzungsplan Abschnitt 6, Befunde IA B5, HE B07/B25, FA B6/H11)

Das Audit zählte bis zu 14 verschiedene Linktexte für dasselbe Ziel, und zwei
Linktexte, die je nach Stelle auf ein anderes Ziel zeigten („Preise & Fundorte“,
„Blaupausen & Planer“). Diese Liste legt fest, wie jedes Ziel heißt. Neue Seiten,
Leisten, Links und Überschriften nehmen den Namen von hier.

**Im Code ist die Quelle [`src/lib/bereiche.ts`](../src/lib/bereiche.ts).** Dort
stehen Name und Unterzeile jedes Ziels je Sprache; Menü, Suche und Datenblatt-Fuß
lesen daraus. Wer eine Seite schreibt, die ein Ziel beim Namen nennt, nimmt
`ziel('<schlüssel>', lang).name` statt den Namen abzutippen. Ändert sich ein Name,
ändert er sich dort und hier im selben Commit.

## Regeln

1. **Ein Ziel, ein Name.** Ein Link darf beschreiben, was man dort tut („Im
   Planer öffnen →“), aber er nennt das Ziel nicht anders, als es hier heißt.
2. **Ein Name, ein Ziel.** Kein Name aus dieser Liste steht als Linktext für ein
   anderes Ziel. Unterzeilen sind keine Namen und gehören nur zu ihrem Ziel.
3. **Spielbegriffe bleiben englisch, wie im Spiel**, in beiden Sprachen: Mining,
   Fracturing, Refinery, Precision Jump, Crafting, Blueprint, Item, Loadout.
   Spieler suchen mit dem Wort, das der Client zeigt. Bedienwörter, Gattungen und
   Wertnamen sind auf `/de/` deutsch (Sprachregel, Entscheidung „E-Sprache“ im
   Umsetzungsplan, gebaut nach der Empfehlung, bis Krisz anders entscheidet).
4. **Die Überschrift einer Seite ist ihr Name.** Ein Untertitel darf ergänzen
   („Precision Jump“, darunter „Aaron Halo“), aber nicht ersetzen.
5. **Keine URL ändert sich durch einen Namen.**

## Bereiche und Seiten

Die Leiste zeigt die sieben Bereiche; ein Bereich führt auf seine erste Seite.
„Kurz“ ist die Form für die waagrechte Leiste, wo der volle Name nicht passt.

| Bereich | Seite (Schlüssel) | Pfad | DE | EN | Unterzeile DE / EN |
|---|---|---|---|---|---|
| Items | `items` | `/items.html` | Item-Verzeichnis | Item directory | Alle Items nach Kategorie / Every item by category |
| | `finder` | `/item-finder.html` | Item Finder | Item Finder | Preise & Fundorte / Prices & locations |
| | `sets` | `/armor-sets.html` | Rüstungs-Sets | Armor sets | Ganze Sets im Vergleich / Full sets compared |
| Crafting | `crafting` | `/topics/crafting.html` | Crafting | Crafting | Werkbank & Planer / Workbench & planner |
| | `blueprints` | `/crafting.html` | Blueprint-Verzeichnis | Blueprint directory | Alle Blueprints nach Kategorie / Every blueprint by category |
| Schiffe / Ships | `schiffe` | `/schiffe.html` | Schiffe | Ships | Datenblätter & Specs / Data sheets & specs |
| | `hangar` (nur Vorschau) | `/hangar.html` | Hangar | Hangar | Jedes Schiff in 3D / Every ship in 3D |
| | `loadout` (nur Vorschau) | `/hangar-loadout.html` | Advanced Loadout | Advanced loadout | Ausstattung mit allen Werten / Components with every stat |
| Missionen / Missions | `missionen` | `/missionen.html` | Missionen | Missions | Belohnungen & Ruf / Rewards & reputation |
| Mining | `mining` | `/topics/mining.html` | Mining | Mining | Mineralien & Scans / Minerals & scans |
| | `fracturing` | `/fracturing.html` | Fracturing | Fracturing | Bricht der Brocken? / Will the rock break? |
| | `refinery` | `/refinery.html` | Refinery | Refinery | Erträge & Aufträge / Yields & jobs |
| | `sprung` | `/precision-jump.html` | Precision Jump | Precision Jump | Aaron-Halo-Routen / Aaron Halo routes |
| | `mining-start` | `/mining-guide.html` | Mining in fünf Schritten (Leiste: Einstieg) | Mining in five steps (bar: Getting started) | Vom Scan zum Verkauf / From scan to sale |
| Wikelo's Emporium (kurz: Wikelo) | `wikelo` | `/topics/wikelo-emporium.html` | Wikelo's Emporium | Wikelo's Emporium | Banu-Handel / Banu trades |
| Patch-Archiv / Patch archive | `archiv` | `/archiv.html` | Patch-Archiv | Patch archive | Alle Versionen / All versions |
| | `themen` | `/archiv.html#themen` | Alle Themen | All topics | Themen-Verzeichnis / Topic directory |
| | `evolution` | `/evolution.html` | Evolution | Evolution | Systeme × Patches / Systems × patches |
| | `downloads` | `/downloads.html` | Downloads | Downloads | Medien & Onepager / Media & one-pagers |

Konto und Service (rechts in der Leiste bzw. im Fuß, kein Bereich):

| Schlüssel | Pfad | DE | EN | Unterzeile DE / EN |
|---|---|---|---|---|
| `konto` | `/account/login.html` | Anmelden (angemeldet: Konto) | Sign in (signed in: Account) | Flotte & Profil / Fleet & profile |
| `flotte` | `/account/fleet.html` | Meine Flotte | My fleet | Schiffe aus „Zur Flotte“, auch ohne Konto / Ships from “Add to fleet”, even without an account |
| `feedback` | `/feedback.html` | Feedback | Feedback | Ideen & Fehler melden / Ideas & bug reports |
| `discord` | Einladung | Discord | Discord | Werkstatt hinter der Seite / The workshop behind the site |
| `support` | `/support.html` | Unterstützen | Support | Server & Domain mitfinanzieren / Help pay for server & domain |
| `impressum` | `/impressum.html` | Impressum | Legal Notice | |
| `datenschutz` | `/datenschutz.html` | Datenschutz | Privacy | |

## Weitere Begriffe

| Was | DE | EN | nicht mehr |
|---|---|---|---|
| Die Sammlung eigener Schiffe | Flotte | Fleet | Favoriten, Hangar (für die Sammlung), Favoriten & Profil |
| Anmeldung (Knopf, Seite) | Anmelden | Sign in | Login, LOGIN |
| Konto-Startseite | Konto | Account | Dashboard |
| Logo, Name für Bildschirmleser | VerseBase, Startseite | VerseBase, home | SC Archiv — Startseite |
| Wortmarke im Text und in der Leiste | VerseBase | VerseBase | VERSE·BASE, Verse·Base |
| Startseite in Brotkrumen | Startseite | Home | Archiv, VerseBase |
| Link ins Patch-Archiv | Patch-Archiv (auch „Alle Patches“, aber nur mit Ziel `/archiv.html`) | Patch archive („All patches“ ebenso) | „Alle Patches“ mit Ziel Startseite |
| Die Leiste über dem Schiffsblatt | Schiffe // Hersteller | Ships // manufacturer | HANGAR // AEGIS DYNAMICS |

**Verworfene Namen und wohin sie gehören** (heute noch an einzelnen Stellen):

- „Preise & Fundorte“ ist die Unterzeile des Item Finders, nie der Name des Item-Verzeichnisses.
- „Blaupausen & Planer“, „Crafting-Datenbank“, „Blueprint-Datenbank“, „Fabricator-Planer“ heißen Crafting (Werkbank) bzw. Blueprint-Verzeichnis.
- „Gegenstände“ heißt Items.
- „Raffinerie“, „Refinery-Tracker“, „Refinery-Finder“ heißen Refinery.
- „Aaron Halo“ als Überschrift heißt Precision Jump (Aaron Halo als Untertitel).
- „Schiffs-Index“, „Schiffe und Fahrzeuge“ heißen Schiffe.

## Wer was übernimmt

Die Namen stehen hier und in `bereiche.ts` ab Paket A. Die Seiten selbst ziehen
die Pakete nach, die sie besitzen (Umsetzungsplan Abschnitt 2): Schiffe E6,
Mining-Werkzeuge G6, Konto und Flotte I1, Patch- und Themenseiten H
(„Alle Patches“ mit Ziel Startseite in `components/patches/*`), Item-Kategorien
der Items-Thread.
