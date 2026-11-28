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
   **Opus-Schleife zuerst** (Krisz, 28.11.2026): Vor jeder externen
   Anforderung prüft ein frischer Opus-Review ohne Vorwissen den ganzen
   Diff (eigener Durchgang, nur Diff und Checkout, nie der Verlauf des
   Arbeitsthreads; immer mit Effort xhigh, Krisz 28.11.2026). Befunde beheben, Tor, dann ein neuer frischer
   Durchgang, bis Opus nichts mehr findet. Erst dann Schritt 3.
3. **Review anfordern.** „Ready for review“ und Label **`review-ready`**.
   Der Workflow schreibt daraufhin genau einmal je Stand
   `@coderabbitai review`, mit einer Marke, die den Stand nennt, und zwar
   mit dem Token des Agentenkontos (Secret `REVIEW_ANFORDERUNG_TOKEN`):
   Befehle von `github-actions[bot]` ignoriert CodeRabbit (live auf #477
   gemessen: 40 Minuten keine Reaktion, während ein Befehl von `cibakhun`
   auf #479 sofort lief). Fehlt das Secret, ist der Token abgelaufen oder
   gehört er zu keinem eingetragenen Anforderungskonto
   (`ANFORDERUNG_KONTEN`: nur `Verse-Base`), fordert der Lauf nichts an
   und nennt das im Status. Marken anderer Konten zählen nicht, auch nicht
   die alten von `github-actions[bot]` aus der Zeit vor dem Agentenkonto:
   sie haben nie einen Review ausgelöst und sperren den Stand deshalb
   nicht. Nach der Prüfung des Tokens und unmittelbar vor dem Befehl sieht
   der Lauf noch einmal nach, dass der Head derselbe ist. Selbst kein
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
   Label, das vor dem Push gesetzt wurde, und nimmt es ebenfalls ab (auch
   nach einem Force-Push zurück auf einen früheren Commit). Tor erneut
   grün, Label wieder setzen: Der Workflow fordert einmal an, CodeRabbit
   prüft inkrementell nur die neuen Commits, und der Nachweis setzt die
   Runden zusammen (siehe „Abdeckung“).
6. **Merge.** Nur wenn der Status **`review-nachweis`** auf dem aktuellen
   Commit grün ist. Krisz merged per Squash nach `staging`; ein Release
   `staging` → `main` geht per normalem Merge-Commit (Krisz, 28.11.2026).
   Der Agent merged nie und nutzt nie den Bypass.

**Kombi-Review** (Krisz, 28.11.2026): Jeder PR, auch ein nicht kritischer,
bekommt am Ende mindestens ein externes Review (CodeRabbit oder cubic),
und zwar erst, wenn die Opus-Schleife sauber ist, nie parallel dazu. Findet
das externe Review etwas, behebt der Agent es, die Opus-Schleife läuft
erneut bis sauber, danach wieder extern. Fertig ist der PR erst, wenn
auch das externe Review ohne Befund durchgeht. Der Opus-Review ist kein
Beleg im Status `review-nachweis`: dort zählen nur CodeRabbit und cubic,
kritische PRs brauchen weiter beide.

**Runden: so viele, bis eine ohne neuen Befund durchgeht** (Krisz,
28.11.2026: „Alles muss so lange geprüft werden, bis es nichts mehr zu
bemängeln gibt“; ersetzt das frühere Limit von drei Runden). Jede Runde
braucht einen fertigen Stand mit grünem Tor und ein neu gesetztes
`review-ready`; der Workflow fordert je Stand genau einmal an und nimmt das
Label bei jedem Push ab, eine Schleife ohne Zutun gibt es also nicht. Fertig
ist ein PR für den Merge erst, wenn die letzte Runde keinen neuen Befund
mehr gebracht hat und alle Threads beantwortet und geschlossen sind; das
prüft der Status nicht (eine Runde ohne Kommentare hinterlässt bei
CodeRabbit keinen auswertbaren Eintrag), darauf achten Agent und Krisz.

Ohne neuen Befund heißt: ohne Befund, der eine Änderung verlangt. Lehnt
der Agent alle Befunde einer Runde begründet ab (nachgemessen, jeder
Kommentar beantwortet, jeder Thread geschlossen), ändert sich der Stand
nicht, und derselbe Stand wird nicht noch einmal angefordert: eine zweite
Anforderung desselben Stands gibt es nur nach einem Rate-Limit, sonst
käme dieselbe Prüfung mit denselben Antworten zurück. Die Runde ist damit
die letzte. Ein Befund, der als Entscheidung an Krisz geht, bleibt offen,
bis Krisz entschieden hat; führt die Entscheidung zu einer Änderung, gibt
es einen neuen Stand und eine neue Runde.

Der Bericht nennt die Zahl der Runden. Gezählt werden die Stände mit
abgeschlossenem CodeRabbit-Review, auch solche, die ein Force-Push, Rebase
oder Squash aus dem PR genommen hat: CodeRabbits Reviews bleiben am PR, der
Bericht-Kommentar hält die geprüften Stände fest, und für jeden
angeforderten Stand, der nicht mehr im PR liegt, liest der Lauf dessen
Check-Läufe nach. Ist ein solcher Stand nicht lesbar (API-Fehler, Commit
weg), zählt er nicht als abgeschlossene Runde: der Bericht nennt ihn
getrennt („dazu 1 angefordert, Läufe nicht lesbar“), er kommt nicht ins
Ledger, und der nächste Lauf liest ihn neu. Die Zahl ist nur Bericht; seit
dem Wegfall des Limits entscheidet sie nichts.

## Labels

| Label | Wer setzt es | Wirkung |
|---|---|---|
| `review-ready` | Agent oder Krisz, wenn der Stand fertig ist | der Workflow fordert einmal je Stand einen CodeRabbit-Review an; er nimmt das Label bei jedem neuen Push ab |
| `kritisch` | Agent bei sicherheitsrelevanten Änderungen, die die Pfadliste nicht erkennt | macht den PR kritisch (zwei Reviews) |
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
| Derselbe Stand ist Head eines weiteren offenen PRs | ❌ failure, „nicht eindeutig“ (der Status hängt am Commit, nicht am PR) |
| Der Lauf selbst scheitert (API-Fehler, Abbruch im Skript, eine Liste länger als gelesen) | ❌ failure, „Auswertung gescheitert“; ein früherer Erfolg auf demselben Stand bleibt nicht stehen |
| 250 oder mehr Commits, 3000 oder mehr Dateien | ❌ failure (die API liefert nicht alle; „bitte aufteilen“) |

Was **nie** zählt: der grüne CodeRabbit-Haken allein (er wird auch bei
Skip und Rate-Limit grün), ein Review auf einem älteren Commit, ein Review,
dessen Abdeckung nicht belegt ist. Gezählt wird bei CodeRabbit nur ein
Check-Lauf mit Titel `Finished` und der ersten Zeile
`Result: Success - Review completed`; bei cubic nur `AI review completed`.
Neue, unbekannte Meldungen der Prüfer zählen nicht, bis sie hier
eingeordnet und getestet sind.

Welche Auswertung läuft: die aus dem **Zielzweig**, nicht die aus dem PR.
Ein PR, der das Gate ändert, wird noch nach den alten Regeln beurteilt.
Kennt `main` das Gate noch nicht (vor dem ersten Release), läuft die
Fassung von `staging`. Nur wenn auch `staging` es noch nicht kennt (der PR,
der es einführt), läuft die aus dem PR, und der Bericht sagt das. Der
Workflow läuft nur für PRs nach `staging` und `main`, auch bei Reviews
(`pull_request_review` kennt keinen Zweigfilter). Beide Dateien der Auswertung
kommen aus einem festen Commit des Zielzweigs, nicht aus zwei Abrufen des
Zweignamens. Bereiche liest der Nachweis nur aus CodeRabbits Reviews und
seiner Zusammenfassung, nie aus einer Chat-Antwort (die könnte jeder per
Erwähnung mit einer passenden Zeile bestellen) und nie aus Codeblöcken.
Zusammenfassung ist nur der früheste CodeRabbit-Kommentar, der mit ihrer
Marke beginnt und keine Antwort-Marke trägt. cubic-Läufe zählen nur ab Eröffnung des PRs
bzw. dem letzten Wechsel des Zielzweigs, nur aus einer Check-Suite dieses
Zweigs und nicht aus der Lebenszeit eines anderen PRs, der den Commit
enthält (gleich von welchem Zweig).
Weicht `.coderabbit.yaml` an einem von CodeRabbit geprüften Zwischenstand
von der Basis ab, ist der PR kritisch.

## Abdeckung über mehrere Runden

Ein inkrementeller Review prüft nur die Commits seit der letzten Runde.
Der Nachweis ist deshalb erst grün, wenn die Runden zusammen **jede
Änderung des aktuellen Stands** abdecken:

- **CodeRabbit** nennt je Runde einen Bereich („Reviewing files that changed
  from the base of the PR and between A and B“). Der Nachweis baut daraus
  eine lückenlose Kette: Sie beginnt auf einem Commit des Zielzweigs (der
  Basis des PRs), jeder Bereich endet auf einem Commit des PRs, und die
  Kette endet am Head. Fehlt ein Glied, ist der Status rot. Ein Glied zählt
  nur, wenn es zu einem abgeschlossenen Review am Ziel des Bereichs gehört:
  CodeRabbit nennt den Bereich schon zu Beginn einer Runde, und eine
  abgebrochene Runde darf kein Glied werden. Ein abgegebener
  CodeRabbit-Review und das Ledger sind feste Belege (ein fertiger Lauf am
  Ziel genügt). Ein Bereich aus der Zusammenfassung spricht nur für den
  **jüngsten** Lauf am Ziel: der muss fertig sein und darf nicht nach der
  letzten Änderung der Zusammenfassung begonnen haben. Sonst schlösse ein
  abgebrochener `full review` mit einem früheren fertigen Lauf eine Lücke.
- CodeRabbit überschreibt seine Zusammenfassung bei jeder Runde. Damit eine
  Runde ohne Kommentare ihren Bereich nicht verliert, hält der
  Bericht-Kommentar jeden belegten Bereich fest (verborgenes Ledger); ein
  unbelegter (Runde läuft noch oder brach ab) kommt nicht hinein. Gelesen
  wird nur diese Fassung (`review-nachweis:bereiche2`): die erste schrieb
  jeden gesehenen Bereich, auch den einer abgebrochenen Runde; ihre
  Bereiche zählen nur mit eigenem Beleg.
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
  Ändern von Tor-Skripten in `package.json`. Lässt GitHub den Diff einer
  geänderten Datei weg (zu groß), ist die Suche blind: dann kritisch,
  außer bei JSON-Daten (jede `.json` außer `package.json`).
- **300 oder mehr geänderte Dateien:** Dann liefert der feste Vergleich
  nicht alle Dateien, und gelöschte Dateien der PR-Liste lassen sich nicht
  an den geprüften Stand binden (siehe „Warten“). Im Zweifel kritisch.
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

Nur auf Krisz' Ansage, per **normalem Merge-Commit**, nie Squash oder
Rebase (Krisz, 28.11.2026; Grund unter „Rulesets“). CodeRabbit prüft keine PRs nach `main`; der
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

Dateien und Prüfer-Läufe des Releases selbst erhebt der Nachweis nicht:
Sie entscheiden dort nichts, und ab 3000 Dateien wäre die Dateiliste
nicht vollständig lesbar. So bleibt auch ein großer Release bewertbar,
notfalls über die Release-Ausnahme.

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
40 Minuten und prüft dabei nur den Head erneut. Der Takt beginnt bei 60 s
und verdoppelt sich bis 5 Minuten: Jede Runde kostet rund zehn Anfragen,
und `GITHUB_TOKEN` hat 1000 je Stunde für das ganze Repo. „Angefordert“
heißt: Es gibt eine Anforderungs-Marke für genau diesen Stand, und
CodeRabbit hat danach noch keinen Lauf begonnen (ein Skip von davor ist
veraltet). Die Marke selbst zählt nie als Review. Jedes neue
Ereignis bricht den wartenden Lauf ab und startet neu
(`cancel-in-progress`). Ändert sich der Head während des Wartens, endet der
Lauf ohne Status; der Push hat einen eigenen Lauf ausgelöst. Dasselbe gilt
unmittelbar vor der Anforderung und vor jedem Schreiben aus den erhobenen
Daten: jedem Status (auch dem „Warte“), dem Label `ohne-cubic` und dem
Bericht. Kam während der Erhebung ein neuer Stand, schreibt der Lauf
nichts, damit kein Urteil aus gemischten Daten am alten Stand hängt.
Vor der Anforderung muss außerdem die Freigabe noch stehen (Label
`review-ready` gesetzt, kein Draft), gelesen im letzten Abruf vor dem
Befehl. Bis zum Befehl bleiben Millisekunden; was dort durchrutscht, ist
höchstens eine Anforderung für genau diesen Head (GitHub kennt kein
bedingtes Anlegen eines Kommentars). Die Basis prüft der Lauf genauso.
Basis ist die Spitze des Zielzweigs, nicht `base.sha` des PRs: GitHub
zieht `base.sha` nicht nach (gemessen an #477: `6e0b4af`, während
`staging` 64 Commits weiter war). Wechselt der Zielzweig, endet der Lauf
ohne Status (das Ereignis `edited` hat einen eigenen Lauf); rückt die
Spitze nur weiter, bleibt die Zusammenführungsbasis und damit die
Dateiliste gleich; verschiebt sie sich trotzdem, scheitert er sichtbar
(„Auswertung gescheitert“).
Ein Head, der wechselt und zurückkehrt (A, B, wieder A), besteht diese
Nachfrage; deshalb sind auch die Daten an den Stand gebunden. Die Dateien
kommen aus dem Vergleich zweier fester Commits (`compare/<Spitze>...<Head>`),
der nicht davon abhängt, wohin der Head inzwischen zeigt; die PR-Liste
gilt dem jeweils aktuellen Head, und eine Liste von B nur aus gelöschten
Dateien verriete B nicht einmal (gemessen an 21 PRs, #460 bis #480: beide
nennen dieselben Dateien mit demselben Status und Blob). Der Vergleich
liefert höchstens 300 Dateien; ab dann gilt die PR-Liste, und jede ihrer
nicht gelöschten Dateien muss den Head als Quelle nennen (`contents_url`),
jede Datei des Vergleichs muss gleich in ihr stehen, und ihre Länge muss
die Dateizahl des PRs treffen; gelöschte Dateien bindet auch das nicht,
deshalb gilt ein PR ab 300 Dateien als kritisch. Der Head muss in der Commit-Liste stehen, und jeder
Commit der Liste muss in seinem Verlauf liegen (eine Liste zu einem
Nachfolger B = A + X brächte X mit). Die Commits ordnet der Lauf nach
ihren Eltern, nicht nach der Liste, weil cubics Abdeckung sie der Reihe
nach liest (gemessen in 81 PRs stimmte die Liste, zugesagt ist es nicht).
Passt etwas nicht, erhebt der Lauf alles neu, höchstens dreimal, und
bricht dann ab, ohne selbst ein Urteil zu schreiben; der letzte Schritt
des Workflows setzt dann „Auswertung gescheitert: Stand NICHT bewertet“
(rot) auf den Stand, den der Lauf gelesen hat (`BEWERTET_HEAD`; scheitert
er schon davor, auf den des Ereignisses). Ein Push zwischen Ereignis und
Abruf ließe sonst ein früheres Grün am gelesenen Stand stehen. Beim Nachpollen liest der Lauf den Head,
jeden Stand, dessen Lauf noch nicht fertig war, und jedes Ziel eines
Bereichs aus einer Zusammenfassung neu: ein dort später begonnener und
abgebrochener Lauf nimmt dem Bereich den Beleg.

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
- **Status ist fälschbar für jeden, der pushen darf.** `review-nachweis`
  ist ein Commit-Status. Jeder Workflow dieses Repos mit `statuses: write`
  kann ihn setzen, auch einer, der nur auf einem anderen gepushten Zweig
  liegt, und GitHub unterscheidet das nicht vom echten Lauf (beide kommen
  von der GitHub-Actions-App). Die Release-Prüfung liest dieselben Status
  je PR. Gegen Fremde ohne Schreibrecht hält das Gate (Fork-PRs laufen
  nicht, sie können keinen Status setzen); gegen Konten mit Push-Recht ist
  es eine Anzeige, kein Schloss. Heute hat nur `cibakhun` Push-Recht.
  Abhilfe, wenn weitere Konten dazukommen: ein Check-Lauf einer eigenen
  GitHub-App statt des Status, die das Ruleset als Quelle verlangt
  (Opus-Review #477).
- **Gemeinsames Konto.** Agent und Krisz schreiben heute als `cibakhun`.
  Labels, Kommentare und Ausnahmen sind deshalb nicht einer Person
  zuzuordnen. Abhilfe: eigenes Agentenkonto mit eingeschränkten Rechten.
- **Workflow-Datei aus dem PR.** Bei `pull_request` kommt die YAML-Datei
  aus dem PR. Das Gate-Skript selbst kommt aus dem Zielzweig, aber ein PR
  kann die YAML ändern: so, dass es nicht läuft, oder so, dass sie Skript
  und Logik aus dem PR holt oder `FREIGABE_KONTEN` erweitert; dann
  entscheidet sein eigener Code, auch über „kritisch“, und schreibt ein
  echtes Grün. Die Einstufung von `.github/` als kritisch schützt dagegen
  nicht, sie macht die Änderung nur sichtbar. `pull_request_target` würde das lösen und ist
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
  (rot, nie grün). Ausweg ohne neuen Commit: Label `review-ready` ab und
  frühestens 40 Minuten nach der Anforderung neu setzen. Kam seitdem kein
  CodeRabbit-Lauf am Stand, gibt das genau eine neue Anforderung frei. Ebenso nach einem abgebrochenen Review (etwa PR während des Reviews geschlossen und wieder geöffnet): Label ab und neu. Die Marke der Anforderung zählt nur von den
  Anforderungskonten; eine Marke von jemand anderem unterdrückt keine
  Anforderung und zählt nicht als Runde. Wer den Token des Agentenkontos
  hätte, könnte das weiterhin (siehe oben); auch dann macht eine Marke nie
  grün.
- **Fehlerschritt ohne Netz.** Scheitert ein Lauf, markiert der letzte
  Schritt den bewerteten Stand und den heutigen Head als „nicht bewertet“.
  Kann er den heutigen Head nicht lesen (API-Fehler), bleibt es beim
  bewerteten Stand. Ein grüner Status auf einem neueren Head bleibt dann
  nur stehen, wenn zugleich ein alter Lauf von Hand neu gestartet wurde,
  ein späteres Ereignis zum neueren Head abgebrochen wurde und die API
  ausfällt. Abhilfe dann: Label `nachweis-neu` setzen.
- **Review ohne Ereignis.** Endet ein Review nach der Wartezeit und ohne
  Kommentare, bleibt der Status stehen, bis ein neues Ereignis kommt:
  Label `nachweis-neu` setzen.
- **Abhängigkeit vom Text der Prüfer.** Titel und Bereichszeilen sind
  keine zugesicherte Schnittstelle. Ändern sie sich, zählt der Nachweis
  nichts mehr (rot, nie fälschlich grün) und muss nachgezogen werden.
- **Fork-PRs** laufen nicht (kein Schreibrecht, kein Status): ohne Krisz
  kein Merge.
- **Kritisch-Erkennung** ist eine Heuristik; das Label `kritisch` schließt
  ihre Lücken. Neue oder geänderte Abhängigkeiten (`package.json`,
  Lockfile) machen einen PR nicht von selbst kritisch: die Lieferkette
  prüft `verify:supply-chain` im Tor; ob Abhängigkeits-PRs zwei Reviews
  brauchen, ist Krisz' Entscheidung.
- **cubic und Merge-Commits.** „AI review not needed for merge commit“
  hält die cubic-Abdeckung. Enthält ein Merge Konfliktlösungen oder eigene
  Änderungen, ist nicht belegt, dass cubic sie im nächsten Review mitprüft.
  Bei einem normalen PR, der nur cubic trägt, kann das ungeprüft grün
  werden. Merges in den PR-Zweig daher vermeiden (Rebase vor dem Review)
  oder `kritisch` setzen.
- **Zusammenfassung und Zeitfenster.** Ein Bereich aus der Zusammenfassung
  zählt nur, wenn der jüngste Lauf am Ziel höchstens 2 Minuten vor der
  letzten Änderung des Textes fertig wurde und der Text seit 3 Minuten
  unverändert ist (CodeRabbit legt den neuen Lauf gemessen 2 s nach dem
  Text an). Bis dahin wartet der Lauf; erst dann geht er ins Ledger.
- **API-Limit.** Erschöpft sich das Limit des `GITHUB_TOKEN` (etwa durch
  viele wartende Läufe), scheitert auch der Fehlerschritt, und ein früheres
  Grün auf demselben Stand kann stehen bleiben. Reviews lösen deshalb nur
  von Bots und Konten mit Rechten einen Lauf aus. Vor dem Merge den
  Bericht auf den Stand prüfen. Ein Release-Lauf kostet je enthaltenem
  Commit eine Anfrage (`commits/{sha}/pulls`) und je PR eine weitere
  (seine Status), bei 250 Commits also bis rund 500; Läufe und Dateien des
  Releases liest er nicht.
- **Fast-Forward auf einen anderswo gepushten Commit.** Wird der
  `synchronize`-Lauf abgebrochen, bevor er das Label abnimmt, kann der
  nächste Lauf das alte `review-ready` für neu halten und einmal zu früh
  anfordern (kostet ein Review, macht nichts grün).
- **Basis nach Merge von staging.** Ändert staging `.coderabbit.yaml` und
  wird danach in den PR gemergt, weichen früher geprüfte Zwischenstände
  von der neuen Basis ab, und der PR gilt als kritisch (im Zweifel rot).
- **Auswertung aus dem Zielzweig.** Wird `scripts/lib/review-nachweis.mjs`
  auf dem Zielzweig umbenannt, bewertet sich jeder PR mit dem eigenen Code;
  das sagt nur der Bericht (Quelle der Auswertung). Umbenennen also nur
  zusammen mit dem Workflow.
- **Basis nach dem Urteil.** Die Bindung an die Zusammenführungsbasis
  prüft der Lauf nur, solange er läuft; ein Push auf den Zielzweig startet
  keinen Lauf. Ein grüner Stand bleibt trotzdem gültig, weil sich die
  Zusammenführungsbasis eines offenen PRs ohne neuen Head nicht verschieben
  kann, solange `staging` nur Squash-Merges annimmt (die Commits eines
  Zweigs werden so nie Vorfahren von `staging`), kein Force-Push und kein
  direkter Push möglich ist. Das leistet das Ruleset (Vorschlag unten); bis
  es aktiv ist und nach jedem Bypass auf `staging` offene PRs mit Label
  `nachweis-neu` neu bewerten lassen. Nach `main` gehen nur Release-PRs
  von `staging`, und deren Merge schließt den einzigen offenen.
- **300 oder mehr geänderte Dateien.** Dann bindet die PR-Liste nur, was sie
  selbst verrät: die ersten 300 Dateien des Vergleichs, die Quelle jeder
  nicht gelöschten Datei und die Dateizahl des PRs. Kehrt der Head genau
  während der Erhebung zurück (A, B, wieder A) und unterscheidet sich B
  hinter den ersten 300 Dateien nur durch gelöschte Dateien bei gleicher
  Dateizahl, fiele eine fehlende kritische Änderung nicht auf. Deshalb ist
  jeder so große PR kritisch: zwei Reviews oder Krisz' dokumentierte
  Ausnahme. Weil CodeRabbit PRs über 300 Dateien überspringt (gemessen:
  „640 files exceed the limit of 300“), geht ein so großer PR damit nur
  mit Ausnahme durch; vorher hätte cubic allein gereicht.

## Rulesets (Vorschlag, noch nicht aktiv)

Erst nach Krisz' Freigabe auf Basis der Testergebnisse:

- **`staging`:** PR Pflicht, Squash-Merge, Status-Checks `site / build`,
  `bot`, `dependencies`, `review-nachweis` erforderlich, Konversationen
  müssen aufgelöst sein, kein Force-Push, Löschen verboten. Bypass nur für
  Krisz. Squash-Merge, kein Force-Push und PR-Pflicht tragen hier auch den
  Nachweis (siehe Grenzen, „Basis nach dem Urteil“).
- **`main`:** PR Pflicht, **Merge-Commit** (kein Squash, kein Rebase),
  Status-Checks `site / build`, `bot`, `dependencies` und
  `review-nachweis` (im Release-Modus) erforderlich, Konversationen müssen
  aufgelöst sein, kein Force-Push, Löschen verboten; Merge nur durch
  Krisz. Grund: Nach einem Squash oder Rebase
  enthält `main` die Commits von `staging` nur als Kopien, die gemeinsame
  Basis bleibt alt, und jeder weitere Release-PR listet alle früheren
  Commits erneut. Der Nachweis liest diese Liste (höchstens 250 Commits) und
  bliebe so dauerhaft rot. Entschieden von Krisz am 28.11.2026. Stand 28.11.2026: `staging` ist 829 Commits vor
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
