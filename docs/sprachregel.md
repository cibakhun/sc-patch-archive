# Sprachregel

Welche Sprache ein Text auf einer deutschen Seite (`/de/…`) hat, und wie das
geprüft wird. Entschieden von Krisz am 24.11.2026 (UX-Audit, Entscheidung
E-Sprache „wie empfohlen"). Anlass: Die heuristische Evaluation fand auf den
deutschen Seiten einen Mix aus deutschen Bedienwörtern, englischen Wertnamen
(„Recoil Smoothness"), englischen Absätzen ohne Kennzeichnung und
Rohwörtern („VEHICLEGEAR / WEAPONS").

## Die Regel

| Art | Sprache auf `/de/` | Beispiel |
| --- | --- | --- |
| Eigenname aus dem Spiel (Item, Schiff, Ort, Erz, Hersteller, Mission) | englisch, wie im Spiel | „Arclight Pistol", „Port Tressler", „Quantanium" |
| Bedienwort, Überschrift, Hinweis der Seite | deutsch | „Fundorte", „Im Crafting-Planer öffnen" |
| Wertname, Gattung, Kategorie | deutsch | „Rückstoßglättung", „Verteilzentren", „Schiffskomponenten / Waffen" |
| Spieltext ohne deutsche Fassung (Beschreibung, Missionstext) | englisch, **mit `lang="en"`** | Missionsbeschreibung, Schiffsbeschreibung |
| Spieltext mit deutscher Fassung | deutsch | Schiffsbeschreibung mit deutschem Text |
| Eigener Text (Fundhinweise, Ortsarten der eigenen Recherche) | deutsch | „Ein Deko-Gegenstand für den Hangar …" |

Warum Eigennamen englisch bleiben: 95 % der Aufrufe kommen auf englische
Seiten, und Spieler suchen mit dem Namen, den das Spiel zeigt. Ein übersetzter
Name findet im Spiel nichts.

Ausnahme in der Tabelle der Wertnamen: Die Slotnamen der Fertigung (FRAME,
BARREL, …) bleiben englisch. Sie stehen so am Fabrikator im Spiel und sind dort
Beschriftung, kein Fließtext.

## Wo die Übersetzungen liegen

- `src/i18n/craftingWerte.ts`: Wertnamen (`WERTNAMEN_DE`), Glieder der
  Kategoriepfade (`PFADGLIEDER_DE`) und Klassen der Bauteile (`KLASSEN_DE`,
  der Ton-Chip „Militär", „Zivil" der Crafting-Karten) des Craftings;
  `wertname()`, `pfadname()` und `gattung()` für die Seiten,
  `window.__CRAFT.werte`/`glieder` für den Crafting-Rechner. Filter und Suche
  des Rechners arbeiten weiter mit den englischen Schlüsseln (`data-top`,
  `data-sub`, `data-roh`); die Suche findet beide Fassungen.
- `src/i18n/lootText.ts`: Fundhinweise (`HINWEISE_DE`) und Ortsarten
  (`ORTE_DE`) der eigenen Recherche; `lootHinweis()` und `lootOrt()`.
- `src/i18n/spieltext.ts`: `fremdLang(seite, text)` gibt das `lang` für einen
  Spieltext zurück, wenn er nicht in der Sprache der Seite steht, sonst
  nichts. `MISSIONSTEXT_LANG` nennt die Sprache der Missionstexte.
- `src/i18n/vehicleText.ts`: `vDescLang()` sagt, in welcher Sprache die
  Schiffsbeschreibung wirklich steht: deutsch nur, wenn es eine deutsche
  Fassung gibt, die nicht wörtlich der englische Text ist (bei 98 von 235
  Schiffen ist sie es).

Kommt ein neuer Wertname, ein neuer Fundhinweis oder eine neue Ortsart dazu,
reißt `tests/e2e/sprachregel.test.js`, bis die Tabelle den Eintrag hat.

## Wie es geprüft wird

- `verify:sprache` Regel 1 liest die Wertnamen als eigenen Katalog `WERTE`:
  ein englischer Wertname als ganzer Text auf einer DE-Seite ist FEHLER.
- `verify:sprache` Regel 12: Jeder Absatz (`p`, `li`, `td`, `dd`) mit
  mindestens zehn Wörtern, dessen Sprache an den Funktionswörtern eindeutig
  ist, muss die Sprache tragen, die sein nächstes `lang` nennt. Ein englischer
  Absatz auf einer DE-Seite ohne `lang="en"` ist FEHLER, ebenso ein deutscher
  Absatz auf einer EN-Seite ohne `lang="de"`. Die Selbstauskunft nennt den
  Anteil gekennzeichneten englischen Spieltexts an den Absätzen der DE-Seiten;
  über der Decke `ANTEIL_DECKE` gibt es eine WARNUNG.
- `verify:clienttext` prüft den Text, den die Skripte schreiben, mit denselben
  Katalogen, also auch die Wertnamen im Crafting-Rechner.

## Offen

- Item-Namen stehen auf DE-Seiten noch in der deutschen Fassung des Spiels.
  Nach der Regel kommen sie englisch, mit dem deutschen Namen als Zweitnamen
  (`lang="de"`) und in der Suche unter beiden Namen (Paket C4, eigene PR).
- Das Modal des Item Finders zeigt Fundhinweise und Ortsarten der eigenen
  Recherche noch englisch; die Tabellen oben sind dafür da (Thread
  „Items und Item Finder zusammenlegen").
- Die Blattnamen der Crafting-Kategorien liegen beim selben Thread.
