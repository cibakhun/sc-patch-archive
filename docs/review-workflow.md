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
   (CodeRabbit: `drafts: false`, cubic: `check_drafts` ist aus).
2. **Fertig bauen.** `npm run build && npm run gate`, betroffene Tests, bei
   Bedarf Vorschau-Bau. Danach Krisz' Test.
3. **Review anfordern.** „Ready for review“ und Label **`review-ready`**.
   Nur das Label löst CodeRabbit aus (`auto_review.enabled: false`,
   `labels: ["review-ready"]` in `.coderabbit.yaml`). Kein
   `@coderabbitai review` daneben, das wäre eine zweite Anforderung.
4. **Befunde abarbeiten.** Jeden lesen und einordnen: beheben, begründet
   ablehnen (erst nachmessen) oder als Entscheidung an Krisz. Auf jeden
   Kommentar antworten, Thread schließen.
5. **Nachbessern.** *Vor* dem Push das Label `review-ready` abnehmen, dann
   pushen, Tor erneut grün, Label wieder setzen. CodeRabbit prüft dann
   inkrementell nur die neuen Commits; der Nachweis setzt die Runden
   zusammen (siehe „Abdeckung“).
6. **Merge.** Nur wenn der Status **`review-nachweis`** auf dem aktuellen
   Commit grün ist. Krisz merged per Squash. Der Agent merged nie und nutzt
   nie den Bypass.

Höchstens **drei Runden** je PR. Danach nimmt der Workflow ein neu
gesetztes `review-ready` wieder ab, und Krisz entscheidet: Label
`review-runde-frei` gibt eine weitere Runde frei, nur auf seine Ansage.

## Labels

| Label | Wer setzt es | Wirkung |
|---|---|---|
| `review-ready` | Agent oder Krisz, wenn der Stand fertig ist | löst genau einen CodeRabbit-Review aus; der Workflow nimmt es bei jedem neuen Push ab |
| `kritisch` | Agent bei sicherheitsrelevanten Änderungen, die die Pfadliste nicht erkennt | macht den PR kritisch (zwei Reviews) |
| `review-runde-frei` | nur Krisz | erlaubt eine Runde über die dritte hinaus |
| `ohne-cubic` | der Workflow, auf normalen PRs | hält cubic für kritische PRs frei, sobald `cubic.yaml` auf `main` das Label beachtet (siehe „cubic“) |

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
| Rate-Limit, übersprungen („files exceed the limit“, „Incremental review skipped“), abgebrochen, unbekannte Meldung | ❌ failure, „NICHT geprüft“ |
| Runden decken den Stand nicht lückenlos ab | ❌ failure, „full review nötig“ |
| Label fehlt, kein Review angefordert | ❌ failure |
| 250 oder mehr Commits | ❌ failure (die API liefert nicht alle) |

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
  Kette endet am Head. Fehlt ein Glied, ist der Status rot.
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
  `.coderabbit.yaml`, `cubic.yaml`, das Review-Gate selbst, das
  Datenbank-Ziel je Bau, die Sicherheits-Tore (Lieferkette, CSP),
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
drei Zeichen):

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
40 Minuten (Takt 60 s) und prüft dabei nur den Head erneut. Jedes neue
Ereignis bricht den wartenden Lauf ab und startet neu
(`cancel-in-progress`). Ändert sich der Head während des Wartens, endet der
Lauf ohne Status; der Push hat einen eigenen Lauf ausgelöst.

## Grenzen (bewusst offen)

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
- **Label-Wettlauf.** Ein Push auf einen PR, der noch `review-ready` trägt,
  kann eine Runde starten, bevor der Workflow das Label abnimmt. Deshalb
  nimmt der Agent es *vor* dem Push selbst ab. Die Rundenbremse hat
  dasselbe Fenster.
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
- **`main`:** dasselbe, mit `review-nachweis` im Release-Modus; Merge nur
  durch Krisz.

## Lokal nachmessen

Nur lesend, setzt weder Status noch Label noch Kommentar:

```bash
GH_TOKEN=… node scripts/review-nachweis.mjs --pr 473 --trocken
```

`--auch-geschlossen` bewertet auch gemergte PRs (zum Nachmessen an echten
Daten).
