# Review-Workflow: Draft-First und Review-Nachweis

Wie KI-Reviews (CodeRabbit, cubic) angefordert, ausgewertet und vor dem
Merge nachgewiesen werden. Die verbindlichen Kurzregeln stehen in
[`CLAUDE.md`](../CLAUDE.md); dieses Dokument erklärt sie und hält die
Vorlagen. Beschlossen von Krisz am 26.11.2026.

Grundsatz: **Qualität vor Geschwindigkeit, aber kein Review ohne Anlass.**
Beide Prüfer haben Kontingente. Ein Review läuft deshalb erst, wenn der
Stand fertig ist, genau einmal je Stand, und gezählt wird nur, was
nachweislich abgeschlossen wurde. Wo kein verlässlicher Nachweis möglich
ist, entscheidet Krisz, nie eine Automatik.

## Ablauf

1. **Draft-PR sofort.** Jeder PR nach `staging` beginnt als Draft. Pushen
   beliebig oft; `pr-check` und CodeQL laufen, die KI-Prüfer bleiben still
   (CodeRabbit: kein automatischer Review, cubic: `check_drafts` ist aus).
2. **Fertig bauen.** `npm run build && npm run gate`, betroffene Tests, bei
   Bedarf Vorschau-Bau. Danach Krisz' Test.
3. **Review anfordern.** „Ready for review“ und Label **`review-ready`**.
   Der Workflow schreibt daraufhin genau einmal je Stand
   `@coderabbitai review`, mit einer Marke, die den Stand nennt, und zwar
   mit dem Token des Agentenkontos (Secret `REVIEW_ANFORDERUNG_TOKEN`):
   Befehle von `github-actions[bot]` ignoriert CodeRabbit (live auf #477
   gemessen: 40 Minuten keine Reaktion, während ein Befehl von `cibakhun`
   auf #479 sofort lief). Fehlt das Secret oder ist der Token abgelaufen,
   fordert der Lauf nichts an und nennt das im Status. Selbst kein
   `@coderabbitai review` schreiben, das wäre eine zweite Anforderung.
   **Nach einem Rate-Limit** bleibt der Status rot („rate-limitiert“). Dann
   `review-ready` abnehmen und neu setzen, sobald das Limit vorbei ist
   (CodeRabbit nennt die Wartezeit): Hat CodeRabbit auf die jüngste
   Anforderung mit „rate limited“ geantwortet und kam das Label danach,
   schreibt der Workflow für denselben Stand genau eine neue Anforderung.
   Von selbst wiederholt er nichts, und eine Runde zählt erst mit einem
   abgeschlossenen Review.
   Hintergrund: CodeRabbit prüft Repos mit weniger als 10 Sternen seit dem
   25./26.11.2026 nicht mehr automatisch, auch nicht per Label (Meldung
   an #477). `.coderabbit.yaml` schaltet automatische Reviews deshalb ganz
   ab (`auto_review.enabled: false`, kein `labels`-Eintrag), damit bei 10
   Sternen keine zweite Anforderung dazukommt.
4. **Befunde abarbeiten.** Jeden lesen und einordnen: beheben, begründet
   ablehnen (erst nachmessen) oder als Entscheidung an Krisz. Auf jeden
   Kommentar antworten, Thread schließen.
5. **Nachbessern.** Pushen; der Workflow nimmt `review-ready` bei jedem
   Push ab, der neue Stand wird also nicht ungefragt geprüft. Wird der Lauf
   zum Push abgebrochen, bevor er das Label abnimmt (cubic schreibt die
   PR-Beschreibung kurz nach jedem Push neu), erkennt der nächste Lauf ein
   Label, das vor dem Push gesetzt wurde, und nimmt es ebenfalls ab. Tor erneut
   grün, Label wieder setzen: Der Workflow fordert einmal an, CodeRabbit
   prüft inkrementell nur die neuen Commits, und der Nachweis setzt die
   Runden zusammen (siehe „Abdeckung“).
6. **Merge.** Nur wenn der Status **`review-nachweis`** auf dem aktuellen
   Commit grün ist. Krisz merged per Squash. Der Agent merged nie und nutzt
   nie den Bypass.

Höchstens **drei Runden** je PR. Gezählt werden die Stände mit
abgeschlossenem CodeRabbit-Review, auch solche, die ein Force-Push, Rebase
oder Squash aus dem PR genommen hat: CodeRabbits Reviews bleiben am PR, der
Bericht-Kommentar hält die geprüften Stände fest, und für jeden
angeforderten Stand, der nicht mehr im PR liegt, liest der Lauf dessen
Check-Läufe nach (nicht lesbar zählt als Runde). Danach fordert der Workflow keinen
weiteren Review an, bei keinem Ereignis, nimmt `review-ready` wieder ab und
nennt die Rundenbremse im Status. Krisz entscheidet: Label
`review-runde-frei` gibt **genau eine** weitere Runde frei, nur auf seine
Ansage. Verbraucht ist sie mit der ersten Anforderung nach dem Setzen. Das
liest jeder Lauf aus dem Verlauf (Zeit des Setzens gegen die
Anforderungen), nicht aus dem Lauf, der anforderte: Bricht der ab oder
scheitert das Abnehmen des Labels, bremst der nächste Lauf trotzdem und
nimmt das Label nach. Jede weitere Runde braucht eine neue Freigabe.

## Labels

| Label | Wer setzt es | Wirkung |
|---|---|---|
| `review-ready` | Agent oder Krisz, wenn der Stand fertig ist | der Workflow fordert einmal je Stand einen CodeRabbit-Review an; er nimmt das Label bei jedem neuen Push ab |
| `kritisch` | Agent bei sicherheitsrelevanten Änderungen, die die Pfadliste nicht erkennt | macht den PR kritisch (zwei Reviews) |
| `review-runde-frei` | nur Krisz | erlaubt genau eine Runde über die dritte hinaus; verbraucht mit der nächsten Anforderung, der Workflow nimmt es dann ab |
| `ohne-cubic` | der Workflow, auf normalen PRs | hält cubic für kritische PRs frei, sobald `cubic.yaml` auf `main` das Label beachtet (siehe „cubic“) |
| `nachweis-neu` | Agent oder Krisz | nur ein Anstoß: bewertet den Nachweis neu (etwa nach einem Ausnahme-Kommentar); der Workflow nimmt es sofort ab |

## Der Status `review-nachweis`

Gesetzt von [`.github/workflows/review-nachweis.yml`](../.github/workflows/review-nachweis.yml)
bei jedem PR-Ereignis (Push, Ready, Label, Review). Das Urteil fällt
[`scripts/lib/review-nachweis.mjs`](../scripts/lib/review-nachweis.mjs),
getestet in `tests/e2e/review-nachweis.test.js`. Jeder Lauf schreibt einen
Bericht-Kommentar in den PR (wird überschrieben, nicht gestapelt), der den
Grund nennt.

| Lage | Status |
|---|---|
| Draft | ⏳ pending |
| Normaler PR, ein abgeschlossener Review (CodeRabbit **oder** cubic) deckt den Head lückenlos ab | ✅ success |
| Kritischer PR, CodeRabbit **und** cubic decken den Head lückenlos ab | ✅ success |
| Kritischer PR, ein Review plus gültige Ausnahme von Krisz für genau diesen Commit | ✅ success, Beschreibung beginnt mit **AUSNAHME** |
| Review läuft noch oder ist angefordert | ⏳ pending (der Lauf wartet bis zu 40 Minuten) |
| Angefordert, aber CodeRabbit reagiert nicht innerhalb der Wartezeit | ❌ failure, „nicht reagiert“ |
| Rate-Limit, übersprungen („files exceed the limit“, „Incremental review skipped“), abgebrochen, unbekannte Meldung | ❌ failure, „NICHT geprüft“ |
| Runden decken den Stand nicht lückenlos ab | ❌ failure, „full review nötig“ |
| Label fehlt, kein Review angefordert | ❌ failure |
| Drei Runden erreicht, keine Freigabe von Krisz | ❌ failure, „Rundenbremse“ |
| Derselbe Stand ist Head eines weiteren offenen PRs | ❌ failure, „nicht eindeutig“ (der Status hängt am Commit, nicht am PR) |
| Der Lauf selbst scheitert (API-Fehler, Abbruch im Skript, eine Liste länger als gelesen) | ❌ failure, „Auswertung gescheitert“; ein früherer Erfolg auf demselben Stand bleibt nicht stehen |
| 250 oder mehr Commits, 3000 oder mehr Dateien | ❌ failure (die API liefert nicht alle) |

Was **nie** zählt: der grüne CodeRabbit-Haken allein (er wird auch bei
Skip und Rate-Limit grün), ein Review auf einem älteren Commit, ein Review,
dessen Abdeckung nicht belegt ist. Gezählt wird bei CodeRabbit nur ein
Check-Lauf mit Titel `Finished` und der ersten Zeile
`Result: Success - Review completed`; bei cubic nur `AI review completed`.
Neue, unbekannte Meldungen der Prüfer zählen nicht, bis sie hier
eingeordnet und getestet sind.

Welche Auswertung läuft: die aus dem **Zielzweig**, nicht die aus dem PR.
Ein PR, der das Gate ändert, wird noch nach den alten Regeln beurteilt.
Nur wenn der Zielzweig das Gate noch nicht kennt (der PR, der es
einführt), läuft die aus dem PR, und der Bericht sagt das.

## Abdeckung über mehrere Runden

Ein inkrementeller Review prüft nur die Commits seit der letzten Runde.
Der Nachweis ist deshalb erst grün, wenn die Runden zusammen **jede
Änderung des aktuellen Stands** abdecken:

- **CodeRabbit** nennt je Runde einen Bereich („Reviewing files that changed
  from the base of the PR and between A and B“). Der Nachweis baut daraus
  eine lückenlose Kette: Sie beginnt auf einem Commit des Zielzweigs (der
  Basis des PRs), jeder Bereich endet auf einem Commit des PRs, und die
  Kette endet am Head. Fehlt ein Glied, ist der Status rot. Ein Glied zählt
  nur, wenn am Ziel des Bereichs ein abgeschlossener Review steht:
  CodeRabbit nennt den Bereich schon zu Beginn einer Runde, und eine
  abgebrochene Runde darf kein Glied werden.
- CodeRabbit überschreibt seine Zusammenfassung bei jeder Runde. Damit eine
  Runde ohne Kommentare ihren Bereich nicht verliert, hält der
  Bericht-Kommentar jeden gesehenen Bereich fest (verborgenes Ledger).
- **cubic**: Ein voller Review setzt die Abdeckung, inkrementelle Reviews
  und Merge-Commits („not needed for merge commit“) setzen sie fort, alles
  andere (Limit, Rewrite, nicht gestartet) bricht sie. Der Head selbst
  muss geprüft sein.

Reicht die Kette nicht: `@coderabbitai full review` fordert einen vollen
Review an (zählt als Runde).

## Kritische PRs

Kritisch ist ein PR, wenn mindestens eins zutrifft. Die vollständige,
maßgebliche Liste steht in `KRITISCHE_PFADE` und `KRITISCHE_SIGNALE`.

- **Pfade:** Datenbank-Migrationen, Edge Functions, Supabase-Konfiguration
  und Rechte-Soll, Anmeldung/Passwort/MFA (Komponenten, Seiten, Logik),
  `nginx/`, `Dockerfile`, `.dockerignore`, alles unter `.github/`,
  `.coderabbit.yaml`, `cubic.yaml`, das Review-Gate selbst, die Tor-Kette
  (`scripts/lib/gate-registry.mjs`, `scripts/run-gate.mjs`,
  `scripts/verify-wiring.mjs`), das Datenbank-Ziel je Bau, die
  Sicherheits-Tore (Lieferkette, CSP),
  `CLAUDE.md` und dieses Dokument. Umbenannte Dateien zählen auch unter
  ihrem alten Namen.
- **Inhalt außerhalb der Pfade** (geänderte Zeilen im Diff): Service-Rolle
  oder Geheimschlüssel, `SECURITY DEFINER`, RLS-Policies, `GRANT`/`REVOKE`,
  Sicherheits-Kopfzeilen, Stripe, Anmelde-API, und das Entfernen oder
  Ändern von Tor-Skripten in `package.json`.
- **Label `kritisch`:** Der Agent setzt es bei jeder anderen
  sicherheitsrelevanten Änderung. Die Erkennung ist eine Heuristik, das
  Label schließt ihre Lücken.

Kritische PRs brauchen **zwei unabhängige KI-Reviews** (CodeRabbit und
cubic), beide lückenlos am Head.

### Ausnahme bei fehlender Zweitprüfung

Nur mit **Krisz' ausdrücklicher Freigabe** aus Chat oder AgencyOS, nie auf
eigene Initiative, nie automatisch. Vorher gezielte Zusatztests. Die
Ausnahme ersetzt nur den *zweiten* Review, nie den ersten, und gilt nur für
den genannten Commit: Ein neuer Push braucht eine neue Ausnahme.

Kommentar im PR (volle 40-stellige SHA des Heads; jedes Feld mindestens
drei Zeichen), danach Label `nachweis-neu` setzen:

```markdown
<!-- review-ausnahme sha=<volle SHA des Heads> -->
**Ausnahme vom zweiten KI-Review**

- **Freigabe:** Krisz, <Chat/AgencyOS>, <Datum, Uhrzeit>, <Wortlaut oder Link>
- **Zusätzliche Tests:** <was gezielt geprüft wurde, mit Ergebnis>
- **Risiken:** <was ohne Zweitprüfung offen bleibt>
- **Fehlende Zweitprüfung:** <welcher Prüfer fehlt und warum, z. B. cubic am Limit>
```

Gezählt werden nur Kommentare der Konten in `FREIGABE_KONTEN` (heute
`cibakhun`). Solange der Agent mit diesem Konto schreibt, **dokumentiert**
der Kommentar Krisz' Freigabe, er beweist sie nicht. Eine Bestätigung auf
GitHub zählt deshalb nicht als Freigabe. Mit einem eigenen Agentenkonto
wird `FREIGABE_KONTEN` zur echten Identitätsprüfung.

## Release `staging` → `main`

Nur auf Krisz' Ansage. CodeRabbit prüft keine PRs nach `main`; der
Nachweis prüft dort stattdessen, dass **jeder Commit** des Releases zu einem
nach `staging` gemergten PR gehört, dessen letzter Stand einen grünen
`review-nachweis` trug. Ein Commit ohne PR (direkter Push) oder aus einem
PR ohne Nachweis macht den Status rot und wird im Bericht aufgeführt.

Gelesen wird dabei das Urteil **dieses PRs**, nicht irgendein Status am
Commit: Jede Beschreibung des Status endet mit der PR-Nummer (`[#477]`),
und die Release-Prüfung nimmt das jüngste Urteil, das genau diesen PR
nennt. Ein späterer PR vom selben Stand, der nach anderen Regeln grün
wurde (etwa als normaler PR), zählt so nicht für einen kritischen PR, der
rot gemergt worden wäre.

Das trifft zwangsläufig den ersten Release nach Einführung des Gates: PRs,
die davor gemergt wurden, tragen keinen Nachweis. Dafür und für andere
begründete Fälle gibt es die Release-Ausnahme, ebenfalls nur mit Krisz'
ausdrücklicher Freigabe:

```markdown
<!-- release-ausnahme sha=<volle SHA des Heads von staging> -->
**Release-Ausnahme**

- **Freigabe:** Krisz, <Chat/AgencyOS>, <Datum, Uhrzeit>, <Wortlaut oder Link>
- **Nicht nachgewiesen:** <welche Commits/PRs, und warum>
- **Risiken:** <was dadurch ungeprüft nach main geht>
```

## cubic

cubic liest seine Einstellungen nur von `main` (`cubic.yaml`) und kennt
keine Positivliste, nur `reviews.ignore.pr_labels`. Damit cubic den
kritischen PRs vorbehalten bleibt, setzt der Workflow auf normalen PRs das
Label `ohne-cubic` (auf kritischen nimmt er es ab). Wirkung hat das erst,
wenn `cubic.yaml` auf `main` ergänzt wird:

```yaml
reviews:
  ignore:
    pr_labels:
      - ohne-cubic
```

Diese Änderung ist ein PR nach `main` und braucht Krisz' Freigabe. Bis
dahin prüft cubic wie bisher jeden PR nach `staging`, sobald er kein Draft
mehr ist. Von Hand: `@cubic-dev-ai review` (voll) oder
`@cubic-dev-ai incremental review`, wirkt auch bei gesetztem Label.

## Warten

Das Ende eines CodeRabbit-Reviews ohne Kommentare löst kein Ereignis aus.
Ist ein Review angefordert oder läuft einer, wartet der Lauf deshalb bis zu
40 Minuten (Takt 60 s) und prüft dabei nur den Head erneut. „Angefordert“
heißt: Es gibt eine Anforderungs-Marke für genau diesen Stand, und
CodeRabbit hat danach noch keinen Lauf begonnen (ein Skip von davor ist
veraltet). Die Marke selbst zählt nie als Review. Jedes neue
Ereignis bricht den wartenden Lauf ab und startet neu
(`cancel-in-progress`). Ändert sich der Head während des Wartens, endet der
Lauf ohne Status; der Push hat einen eigenen Lauf ausgelöst.

## Grenzen (bewusst offen)

- **Status je Commit.** Offene PRs mit demselben Head erkennt der Nachweis
  und bleibt rot. Vor und nach einem grünen Status sieht der Lauf noch
  einmal nach; öffnet währenddessen ein zweiter PR vom selben Stand, steht
  in jeder Reihenfolge zuletzt rot. Ein Zeitfenster bleibt: Öffnet ein PR
  auf einen Stand, den ein anderer offener PR schon grün trägt, zeigt sein
  Commit dieses fremde Urteil, bis sein eigener erster Lauf schreibt (bei
  vollen GitHub-Runnern einige Minuten). Die Beschreibung nennt dann die
  fremde Nummer (`[#…]`). Ein PR nach einem Zweig ohne diesen Workflow
  schreibt gar keinen Status und überschreibt deshalb auch keinen. Wird nach dem Merge ein neuer PR vom
  selben Stand geöffnet, überschreibt sein Lauf zwar den Status am Commit,
  aber nicht das Urteil, das die Release-Prüfung liest: Die liest je PR
  (Marke `[#Nummer]` in der Beschreibung).
- **Gemeinsames Konto.** Agent und Krisz schreiben heute als `cibakhun`.
  Labels, Kommentare und Ausnahmen sind deshalb nicht einer Person
  zuzuordnen. Abhilfe: eigenes Agentenkonto mit eingeschränkten Rechten.
- **Workflow-Datei aus dem PR.** Bei `pull_request` kommt die YAML-Datei
  aus dem PR. Das Gate-Skript selbst kommt aus dem Zielzweig, aber ein PR
  könnte die YAML so ändern, dass es nicht läuft. Deshalb ist jede Änderung
  unter `.github/` kritisch. `pull_request_target` würde das lösen und ist
  in diesem Repo bewusst verboten (`verify:supply-chain`). Endgültige
  Abhilfe: Agentenkonto plus Pflicht-Freigabe durch Krisz (CODEOWNERS)
  für `.github/`.
- **Token des Agentenkontos.** Der Workflow bekommt bei `pull_request`
  ein Secret, und seine YAML-Datei kommt aus dem PR: Wer pushen darf,
  könnte den Token auslesen. Deshalb hat er nur `public_repo`, und das
  Konto ist kein Mitarbeiter im Repo; ein abhandengekommener Token kann
  kommentieren, nicht pushen. Ablauf 90 Tage, dann neu erzeugen. Das
  Agentenkonto steht nie in `FREIGABE_KONTEN`.
- **Reaktion von CodeRabbit.** Reagiert CodeRabbit nicht auf die
  Anforderung, steht der Nachweis nach 40 Minuten auf „nicht reagiert“
  (rot, nie grün). Die Marke der Anforderung kann jeder schreiben, der den
  PR kommentieren darf; eine gefälschte Marke unterdrückt höchstens die
  echte Anforderung (der Status bleibt rot), verbraucht eine Freigabe
  `review-runde-frei` vorzeitig oder zählt als Runde. Sie macht nie grün
  und gibt nie eine Runde frei.
- **Review ohne Ereignis.** Endet ein Review nach der Wartezeit und ohne
  Kommentare, bleibt der Status stehen, bis ein neues Ereignis kommt:
  Label `nachweis-neu` setzen.
- **Abhängigkeit vom Text der Prüfer.** Titel und Bereichszeilen sind
  keine zugesicherte Schnittstelle. Ändern sie sich, zählt der Nachweis
  nichts mehr (rot, nie fälschlich grün) und muss nachgezogen werden.
- **Fork-PRs** laufen nicht (kein Schreibrecht, kein Status): ohne Krisz
  kein Merge.
- **Kritisch-Erkennung** ist eine Heuristik; das Label `kritisch` schließt
  ihre Lücken.

## Rulesets (Vorschlag, noch nicht aktiv)

Erst nach Krisz' Freigabe auf Basis der Testergebnisse:

- **`staging`:** PR Pflicht, Squash-Merge, Status-Checks `site / build`,
  `bot`, `dependencies`, `review-nachweis` erforderlich, Konversationen
  müssen aufgelöst sein, kein Force-Push, Löschen verboten. Bypass nur für
  Krisz.
- **`main`:** PR Pflicht, **Merge-Commit** (kein Squash, kein Rebase),
  Status-Checks `site / build`, `bot`, `dependencies` und
  `review-nachweis` (im Release-Modus) erforderlich, Konversationen müssen
  aufgelöst sein, kein Force-Push, Löschen verboten; Merge nur durch
  Krisz. Grund: Nach einem Squash oder Rebase
  enthält `main` die Commits von `staging` nur als Kopien, die gemeinsame
  Basis bleibt alt, und jeder weitere Release-PR listet alle früheren
  Commits erneut. Der Nachweis liest diese Liste (höchstens 250 Commits) und
  bliebe so dauerhaft rot. Stand 27.11.2026: `staging` ist 751 Commits vor
  `main`, die bisherigen Releases kamen als Einzel-Commits. Den ersten
  Release nach dieser Regel entscheidet Krisz (Release-Ausnahme oder
  Verlauf einmal zusammenführen).

## Lokal nachmessen

Nur lesend, setzt weder Status noch Label noch Kommentar:

```bash
GH_TOKEN=… node scripts/review-nachweis.mjs --pr 473 --trocken
```

`--auch-geschlossen` bewertet auch gemergte PRs (zum Nachmessen an echten
Daten).
