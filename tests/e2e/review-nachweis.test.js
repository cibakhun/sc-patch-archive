// Review-Nachweis (scripts/lib/review-nachweis.mjs): das Urteil hinter dem
// Status `review-nachweis`, gegen Antworten, wie GitHub sie am 26.11.2026
// wirklich lieferte (Check-Laeufe von CodeRabbit und cubic aus 75 PRs,
// Bereichszeilen aus #470, #471, #473, #445).
//
// Jeder Fall, der NICHT gruen werden darf, steht hier einmal rot vorgefuehrt
// (Grundsatz 1): Draft, kein Label, Rate-Limit, Skip, Abbruch, unbekannter
// Text, Review nur auf aelterem Stand, Luecke in der Kette, umgeschriebener
// Verlauf, kritisch ohne Zweitpruefung, falsche oder unvollstaendige
// Ausnahme, Release mit unbelegtem Commit. Und die Gegenprobe: was gruen
// werden muss, wird gruen.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  bewerte, codeRabbitLauf, cubicLauf, bereicheAusText, codeRabbitAbdeckung, cubicAbdeckung,
  kritischeGruende, ausnahme, ledgerLesen, berichtText, codeRabbitAmCommit,
  anforderungNoetig, anforderungAmHead, anforderungsMarke, rundenZahl, unlesbareRunden, fremdeDateien, verlaufZumHead,
  abweichendeDateien,
  seitenweise, statusMitKontrolle,
  gepruefteStaende, rundenLesen, beschreibungMitPr, nachweisFuerPr, wiederholungErlaubt,
  angeforderteStaende, rundenAusAnforderungen, bestaetigteRunden, ledgerBereiche, altesLedger,
} from '../../scripts/lib/review-nachweis.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const h = (c) => c.repeat(40).slice(0, 40);
const BASIS = h('b'), A = h('1'), B = h('2'), C = h('3'), FREMD = h('f');

// Echte Ausgaben (gekuerzt auf das, was das Urteil liest).
const CR_FERTIG = { app: 'coderabbitai', name: 'CodeRabbit', status: 'completed', conclusion: 'success', title: 'Finished', summary: 'Result: Success - Review completed\nRun ID: `e20596f8`', started_at: '2026-11-26T07:27:45Z' };
const CR_LIMIT = { app: 'coderabbitai', name: 'CodeRabbit', status: 'completed', conclusion: 'neutral', title: 'Review rate limited', summary: 'Result: Rate limited - Review rate limited', started_at: '2026-11-26T07:20:31Z' };
const CR_SKIP = { app: 'coderabbitai', name: 'CodeRabbit', status: 'completed', conclusion: 'skipped', title: 'Review skipped: 640 files exceed the limit of 300', summary: 'Result: Skipped - Review skipped: 640 files exceed the limit of 300', started_at: '2026-11-11T10:00:00Z' };
const CR_LABEL_SKIP = { app: 'coderabbitai', name: 'CodeRabbit', status: 'completed', conclusion: 'skipped', title: 'Review skipped: excluded by label configuration', summary: 'Result: Skipped - Review skipped: excluded by label configuration', started_at: '2026-11-26T17:29:09Z' };
const CR_AUS_SKIP = { app: 'coderabbitai', name: 'CodeRabbit', status: 'completed', conclusion: 'skipped', title: 'Review skipped: automatic reviews are disabled', summary: 'Result: Skipped - Review skipped: automatic reviews are disabled', started_at: '2026-11-26T17:45:40Z' };
const CR_INKR_SKIP = { app: 'coderabbitai', name: 'CodeRabbit', status: 'completed', conclusion: 'skipped', title: 'Incremental review skipped', summary: 'Result: Skipped - Incremental review skipped', started_at: '2026-11-11T10:00:00Z' };
const CR_ABBRUCH = { app: 'coderabbitai', name: 'CodeRabbit', status: 'completed', conclusion: 'cancelled', title: 'Review cancelled', summary: 'Result: Cancelled - Pull request is closed', started_at: '2026-11-11T10:00:00Z' };
const CR_LAEUFT = { app: 'coderabbitai', name: 'CodeRabbit', status: 'in_progress', conclusion: null, title: '', summary: '', started_at: '2026-11-26T08:00:00Z' };
// Ein gruener Haken mit fremdem Text: zaehlt NICHT.
const CR_GRUEN_FREMD = { app: 'coderabbitai', name: 'CodeRabbit', status: 'completed', conclusion: 'success', title: 'Finished', summary: 'Result: Success - Nothing to review', started_at: '2026-11-26T09:00:00Z' };
const CU_VOLL = { app: 'cubic-dev-ai', name: 'cubic · AI code reviewer', status: 'completed', conclusion: 'success', title: 'AI review completed', summary: 'AI review completed with 1 review. Found 3 issues across 9 files.', started_at: '2026-11-05T10:00:00Z' };
const CU_INKR = { ...CU_VOLL, summary: 'AI review completed with 1 review. 0 issues found across 2 files (changes from recent commits).' };
const CU_MERGE = { ...CU_VOLL, title: 'AI review not needed for merge commit', summary: 'This commit only merges another branch into the PR branch, so cubic completed this check without running' };
const CU_LIMIT = { app: 'cubic-dev-ai', name: 'cubic · AI code reviewer', status: 'completed', conclusion: 'neutral', title: 'AI review line limit reached', summary: "You've reached your plan's monthly review limit. cubic has reviewed 81,244 of the 80,000 allowed lines", started_at: '2026-11-26T07:00:00Z' };
const CU_REWRITE = { ...CU_LIMIT, title: 'Automatic AI review not started after branch rewrite', summary: 'This push rewrote the branch history, so cubic did not start an automatic review.' };

const DOKU = [{ filename: 'docs/notiz.md', patch: '@@ -1 +1 @@\n-alt\n+neu' }];
const pr = (x = {}) => ({ number: 1, draft: false, base_ref: 'staging', head_ref: 'claude/x', head_sha: C, labels: ['review-ready'], ...x });
const lage = (x = {}) => ({
  pr: pr(x.pr), commits: [A, B, C], dateien: DOKU,
  laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_FERTIG] },
  bereiche: [{ a: BASIS, b: A }, { a: A, b: B }, { a: B, b: C }],
  vorfahren: { [BASIS]: true }, kommentare: [], freigabeKonten: ['cibakhun'], ...x, ...(x.pr ? { pr: pr(x.pr) } : {}),
});

describe('Review-Nachweis: Einordnung der Pruefer-Laeufe', () => {
  test('CodeRabbit: nur "Review completed" ist ein Review', () => {
    assert.equal(codeRabbitLauf(CR_FERTIG).art, 'geprueft');
    assert.equal(codeRabbitLauf(CR_LIMIT).art, 'ratenlimit');
    assert.equal(codeRabbitLauf(CR_SKIP).art, 'uebersprungen');
    assert.equal(codeRabbitLauf(CR_INKR_SKIP).art, 'uebersprungen');
    assert.equal(codeRabbitLauf(CR_ABBRUCH).art, 'abgebrochen');
    assert.equal(codeRabbitLauf(CR_LAEUFT).art, 'laeuft');
    assert.equal(codeRabbitLauf(CR_GRUEN_FREMD).art, 'unbekannt', 'gruener Haken mit fremdem Text darf nicht zaehlen');
    assert.equal(codeRabbitLauf(undefined).art, 'fehlt');
  });
  test('CodeRabbit am Commit: ein spaeterer Rate-Limit-Versuch nimmt einen fertigen Review nicht weg', () => {
    assert.equal(codeRabbitAmCommit([CR_FERTIG, CR_LIMIT]).art, 'geprueft');
    assert.equal(codeRabbitAmCommit([CR_LIMIT]).art, 'ratenlimit');
    assert.equal(codeRabbitAmCommit([CU_VOLL]).art, 'fehlt', 'cubic ist nicht CodeRabbit');
  });
  test('cubic: voll, inkrementell, Merge, Limit, Rewrite', () => {
    assert.deepEqual([cubicLauf(CU_VOLL).art, cubicLauf(CU_VOLL).inkrementell], ['geprueft', false]);
    assert.deepEqual([cubicLauf(CU_INKR).art, cubicLauf(CU_INKR).inkrementell], ['geprueft', true]);
    assert.equal(cubicLauf(CU_MERGE).art, 'merge');
    assert.equal(cubicLauf(CU_LIMIT).art, 'limit');
    assert.equal(cubicLauf(CU_REWRITE).art, 'nicht-geprueft');
  });
});

describe('Review-Nachweis: Abdeckung ueber mehrere Runden', () => {
  test('Bereichszeile aus einem echten CodeRabbit-Review (#473)', () => {
    const body = 'Reviewing files that changed from the base of the PR and between 288742fa4f65a87aea02054dbae6a3a5b2e7fd6f and 80948e0d208813981f841f77c2b60251e67e17d9.';
    assert.deepEqual(bereicheAusText(body), [{ a: '288742fa4f65a87aea02054dbae6a3a5b2e7fd6f', b: '80948e0d208813981f841f77c2b60251e67e17d9' }]);
  });
  test('lueckenlose Kette Basis -> A -> B -> C deckt C ab', () => {
    const r = codeRabbitAbdeckung({ bereiche: [{ a: BASIS, b: A }, { a: A, b: B }, { a: B, b: C }], commits: [A, B, C], head: C, vorfahren: { [BASIS]: true } });
    assert.equal(r.abgedeckt, true);
    assert.equal(r.kette.length, 3);
  });
  test('ROT: Luecke (Runde A..B fehlt, wie an #445 ohne Ledger)', () => {
    const r = codeRabbitAbdeckung({ bereiche: [{ a: BASIS, b: A }, { a: B, b: C }], commits: [A, B, C], head: C, vorfahren: { [BASIS]: true } });
    assert.equal(r.abgedeckt, false);
  });
  test('ROT: Quelle liegt nicht auf dem Zielzweig', () => {
    const r = codeRabbitAbdeckung({ bereiche: [{ a: FREMD, b: C }], commits: [A, B, C], head: C, vorfahren: { [FREMD]: false } });
    assert.equal(r.abgedeckt, false);
    assert.equal(r.verworfen.length, 1);
  });
  test('ROT: umgeschriebener Verlauf (geprueftes Ziel nicht mehr im PR)', () => {
    const r = codeRabbitAbdeckung({ bereiche: [{ a: BASIS, b: FREMD }, { a: FREMD, b: C }], commits: [A, B, C], head: C, vorfahren: { [BASIS]: true } });
    assert.equal(r.abgedeckt, false);
  });
  test('full review (Basis..Head) heilt jede Luecke', () => {
    const r = codeRabbitAbdeckung({ bereiche: [{ a: BASIS, b: A }, { a: BASIS, b: C }], commits: [A, B, C], head: C, vorfahren: { [BASIS]: true } });
    assert.equal(r.abgedeckt, true);
  });
  test('cubic: voll, dann inkrementell und Merge haelt; Limit dazwischen reisst', () => {
    assert.equal(cubicAbdeckung({ commits: [A, B, C], head: C, laeufeJeCommit: { [A]: [CU_VOLL], [B]: [CU_MERGE], [C]: [CU_INKR] } }).abgedeckt, true);
    assert.equal(cubicAbdeckung({ commits: [A, B, C], head: C, laeufeJeCommit: { [A]: [CU_VOLL], [B]: [CU_LIMIT], [C]: [CU_INKR] } }).abgedeckt, false);
    assert.equal(cubicAbdeckung({ commits: [A, B, C], head: C, laeufeJeCommit: { [A]: [CU_VOLL], [C]: [CU_MERGE] } }).abgedeckt, false, 'Merge am Head ist kein Review');
  });
  test('Ledger: Bereiche ueberleben im eigenen Bericht', () => {
    const text = berichtText({ state: 'success', description: 'x', bericht: [] }, { bereiche: [{ a: A, b: B }, { a: A, b: B }], lauf: 'u', quelle: 'q' });
    assert.deepEqual(ledgerLesen(text), [{ a: A, b: B }]);
    assert.deepEqual(ledgerLesen('<!-- review-nachweis:bereiche2 [kaputt -->'), []);
  });
});

describe('Review-Nachweis: kritische Aenderungen', () => {
  test('Pfade: Migration, Edge Function, Auth, nginx, Workflows, Pruefer-Konfiguration, Gate selbst, Agentenregeln', () => {
    for (const f of ['supabase/migrations/20261124110000_x.sql', 'supabase/functions/stripe-webhook/index.ts', 'src/components/account/AuthLogin.astro',
      'src/lib/auth-url.ts', 'src/pages/de/account/login.astro', 'nginx/default.conf', 'Dockerfile', 'discord/bot/Dockerfile',
      '.github/workflows/pr-check.yml', '.coderabbit.yaml', 'cubic.yaml', 'scripts/lib/review-nachweis.mjs', 'scripts/verify-supply-chain.mjs',
      'CLAUDE.md', 'docs/review-workflow.md',
      // Review #477: `rail: 'A'` -> `null` nimmt einen Pruefer still aus dem Tor.
      'scripts/lib/gate-registry.mjs', 'scripts/run-gate.mjs', 'scripts/verify-wiring.mjs']) {
      assert.ok(kritischeGruende([{ filename: f }]).length > 0, f);
    }
  });
  test('normal: Freunde-Komponente, Doku, Daten', () => {
    for (const f of ['src/components/account/FriendsManager.astro', 'docs/x.md', 'src/data/ships.json', 'docs/README.md', 'scripts/verify-item3d.mjs']) assert.deepEqual(kritischeGruende([{ filename: f }]), [], f);
  });
  test('Inhalt ausserhalb der Pfade: Service-Rolle, Stripe, Policy', () => {
    assert.ok(kritischeGruende([{ filename: 'src/lib/x.ts', patch: '+const k = SUPABASE_SERVICE_ROLE_KEY;' }]).length);
    assert.ok(kritischeGruende([{ filename: 'src/pages/abo.astro', patch: '+import Stripe from "stripe";' }]).length);
    assert.ok(kritischeGruende([{ filename: 'scripts/x.sql', patch: '+create policy p on t' }]).length);
  });
  test('package.json: neues Tor ist normal, entferntes oder geaendertes kritisch', () => {
    assert.deepEqual(kritischeGruende([{ filename: 'package.json', patch: '+    "verify:neu": "node scripts/verify-neu.mjs",' }]), []);
    assert.ok(kritischeGruende([{ filename: 'package.json', patch: '-    "gate": "node scripts/run-gate.mjs",\n+    "gate": "true",' }]).length);
  });
  test('umbenannte Datei zaehlt mit ihrem alten Namen', () => {
    assert.ok(kritischeGruende([{ filename: 'docs/alt.sql', previous_filename: 'supabase/migrations/1_x.sql' }]).length);
  });
  test('Label "kritisch" macht kritisch', () => {
    assert.ok(kritischeGruende(DOKU, ['kritisch']).length);
  });
});

describe('Review-Nachweis: Urteil (T1 bis T9)', () => {
  test('T1 ROT: Draft', () => {
    const u = bewerte(lage({ pr: { draft: true } }));
    assert.equal(u.state, 'pending');
    assert.match(u.description, /Draft/);
  });
  test('T9 Gegenprobe: normaler PR, CodeRabbit lueckenlos -> gruen', () => {
    const u = bewerte(lage());
    assert.equal(u.state, 'success', u.description);
  });
  test('Gegenprobe: normaler PR nur mit cubic -> gruen (Regel "oder")', () => {
    const u = bewerte(lage({ laeufeJeCommit: { [A]: [CU_VOLL], [B]: [CU_INKR], [C]: [CU_INKR] }, bereiche: [] }));
    assert.equal(u.state, 'success', u.description);
    assert.deepEqual(u.belege, ['cubic']);
  });
  test('T7 ROT: kein Label, kein Review am Head', () => {
    const u = bewerte(lage({ pr: { labels: [] }, laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG] }, bereiche: [{ a: BASIS, b: A }, { a: A, b: B }] }));
    assert.equal(u.state, 'failure');
    assert.match(u.description, /Label review-ready fehlt/);
  });
  test('T7 ROT live (#477): Ready ohne Label, CodeRabbit meldet Skip wegen Label, cubic am Limit', () => {
    assert.equal(codeRabbitLauf(CR_LABEL_SKIP).art, 'uebersprungen');
    const u = bewerte(lage({ pr: { labels: [] }, laeufeJeCommit: { [C]: [CR_LABEL_SKIP, CU_LIMIT] }, bereiche: [] }));
    assert.equal(u.state, 'failure');
    assert.match(u.description, /Label review-ready fehlt/);
    assert.match(u.description, /cubic am Limit/);
    const nachUmbau = bewerte(lage({ pr: { labels: [] }, laeufeJeCommit: { [C]: [CR_AUS_SKIP, CU_LIMIT] }, bereiche: [] }));
    assert.match(nachUmbau.description, /Label review-ready fehlt/, 'live #477 nach dem Umbau: "automatic reviews are disabled"');
  });
  test('T4 ROT: Review nur auf aelterem Stand; mit Label wird gewartet, ohne Wartezeit rot', () => {
    const d = lage({ laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG] }, bereiche: [{ a: BASIS, b: A }, { a: A, b: B }] });
    const warten = bewerte(d);
    assert.equal(warten.state, 'pending');
    assert.equal(warten.warten, true);
    const ende = bewerte({ ...d, keinWarten: true });
    assert.equal(ende.state, 'failure');
  });
  test('Review laeuft: warten', () => {
    const u = bewerte(lage({ laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_LAEUFT] } }));
    assert.equal(u.state, 'pending');
  });
  test('T6 ROT: Rate-Limit am Head (Lage wie #473 vor dem zweiten Versuch)', () => {
    const u = bewerte(lage({ laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_LIMIT, CU_LIMIT] }, bereiche: [{ a: BASIS, b: A }, { a: A, b: B }] }));
    assert.equal(u.state, 'failure');
    assert.match(u.description, /rate-limitiert/);
    assert.match(u.description, /cubic am Limit/);
  });
  test('ROT: Skip, Abbruch, unbekannter gruener Text', () => {
    for (const [lauf, muster] of [[CR_SKIP, /uebersprungen/], [CR_ABBRUCH, /abgebrochen/], [CR_GRUEN_FREMD, /Unbekanntes/]]) {
      const u = bewerte(lage({ laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [lauf] } }));
      assert.equal(u.state, 'failure', lauf.title);
      assert.match(u.description, muster);
    }
  });
  test('ROT: fertiger Review am Head, aber Luecke in der Kette', () => {
    const u = bewerte(lage({ bereiche: [{ a: BASIS, b: A }, { a: B, b: C }] }));
    assert.equal(u.state, 'failure');
    assert.match(u.description, /Abdeckung lueckenhaft/);
  });
  const KRIT = [{ filename: 'supabase/migrations/2026_x.sql', patch: '+select 1;' }];
  test('T8 ROT: kritisch, nur CodeRabbit, cubic am Limit', () => {
    const u = bewerte(lage({ dateien: KRIT, laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_FERTIG, CU_LIMIT] } }));
    assert.equal(u.state, 'failure');
    assert.match(u.description, /zweite Pruefung fehlt/);
  });
  test('kritisch, CodeRabbit + cubic -> gruen', () => {
    const u = bewerte(lage({ dateien: KRIT, laeufeJeCommit: { [A]: [CR_FERTIG, CU_VOLL], [B]: [CR_FERTIG, CU_INKR], [C]: [CR_FERTIG, CU_INKR] } }));
    assert.equal(u.state, 'success', u.description);
  });
  const AUSN = (sha, felder = true, author = 'cibakhun') => ({
    author, url: 'https://example.invalid/k',
    body: [`<!-- review-ausnahme sha=${sha} -->`, '**Freigabe:** Krisz im Projekt-Chat, 26.11.2026 17:10',
      felder ? '**Zusätzliche Tests:** Migration lokal eingespielt, db-rights-Test gruen' : '', '**Risiken:** RLS fuer neue Tabelle',
      '**Fehlende Zweitprüfung:** cubic am Monatslimit bis 01.12.'].join('\n'),
  });
  test('kritisch mit vollstaendiger Ausnahme fuer genau diesen Stand -> gruen, deutlich als AUSNAHME', () => {
    const u = bewerte(lage({ dateien: KRIT, kommentare: [AUSN(C)] }));
    assert.equal(u.state, 'success');
    assert.match(u.description, /^AUSNAHME/);
  });
  test('ROT: Ausnahme fuer aelteren Stand, unvollstaendig, von fremdem Konto, oder ohne jeden KI-Review', () => {
    assert.equal(bewerte(lage({ dateien: KRIT, kommentare: [AUSN(B)] })).state, 'failure');
    const unvoll = bewerte(lage({ dateien: KRIT, kommentare: [AUSN(C, false)] }));
    assert.equal(unvoll.state, 'failure');
    assert.ok(unvoll.bericht.some((z) => /Zusätzliche Tests/.test(z)));
    assert.equal(bewerte(lage({ dateien: KRIT, kommentare: [AUSN(C, true, 'jemand')] })).state, 'failure');
    const ohne = bewerte(lage({ dateien: KRIT, kommentare: [AUSN(C)], laeufeJeCommit: { [C]: [CR_LIMIT] }, bereiche: [] }));
    assert.equal(ohne.state, 'failure', 'eine Ausnahme ersetzt nie den ersten Review');
  });
  test('ROT: 250 Commits sind nicht vollstaendig pruefbar', () => {
    assert.equal(bewerte(lage({ commits: Array.from({ length: 250 }, (_, i) => String(i).padStart(40, '0')) })).state, 'failure');
  });
  test('Ausnahme-Parser verlangt jedes Pflichtfeld', () => {
    assert.deepEqual(ausnahme({ art: 'review-ausnahme', kommentare: [AUSN(C, false)], head: C, konten: ['cibakhun'] }).fehlend, ['Zusätzliche Tests']);
  });
});

describe('Review-Nachweis: Anforderung genau einmal je Stand', () => {
  // Live auf #477 (26.11.2026): Ready um 17:29:09 ohne Label -> Skip
  // "excluded by label configuration"; Label um 17:30:11. CodeRabbit prueft
  // das Repo nicht mehr automatisch (weniger als 10 Sterne), also schreibt
  // der Workflow `@coderabbitai review` mit Marke.
  const anf = (sha, erstellt = '2026-11-26T17:30:20Z') => ({ author: 'Verse-Base', body: `@coderabbitai review\n\n${anforderungsMarke(sha)}`, erstellt });
  const ohneReview = (x = {}) => lage({ laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_LABEL_SKIP] }, bereiche: [{ a: BASIS, b: A }, { a: A, b: B }], ...x });
  test('anfordern: Label da, kein Draft, keine Marke fuer diesen Stand, kein Review am Head', () => {
    assert.equal(anforderungNoetig(ohneReview()), true);
    assert.equal(anforderungNoetig(ohneReview({ kommentare: [anf(B)] })), true, 'Marke eines aelteren Stands zaehlt nicht');
  });
  test('nicht anfordern: Draft, ohne Label, schon angefordert, schon geprueft, Release', () => {
    assert.equal(anforderungNoetig(ohneReview({ pr: { draft: true } })), false);
    assert.equal(anforderungNoetig(ohneReview({ pr: { labels: [] } })), false);
    assert.equal(anforderungNoetig(ohneReview({ kommentare: [anf(C)] })), false);
    assert.equal(anforderungNoetig(lage()), false);
    assert.equal(anforderungNoetig(ohneReview({ pr: { base_ref: 'main', head_ref: 'staging' } })), false);
  });
  test('angefordert, alter Skip am Head: warten; ohne Wartezeit rot "nicht reagiert"', () => {
    assert.equal(anforderungAmHead([anf(C)], C), Date.parse('2026-11-26T17:30:20Z'));
    const d = ohneReview({ kommentare: [anf(C)] });
    const u = bewerte(d);
    assert.equal(u.state, 'pending', u.description);
    assert.equal(u.warten, true);
    const ende = bewerte({ ...d, keinWarten: true });
    assert.equal(ende.state, 'failure');
    assert.match(ende.description, /nicht reagiert/);
  });
  test('Anforderung fuer einen aelteren Stand laesst am neuen nicht warten', () => {
    const u = bewerte(ohneReview({ pr: { labels: [] }, kommentare: [anf(B)] }));
    assert.equal(u.state, 'failure');
    assert.match(u.description, /Label review-ready fehlt/);
  });
  test('Lauf nach der Anforderung: der zaehlt (Skip danach ist echt rot, fertig ist gruen)', () => {
    const spaeterSkip = { ...CR_SKIP, started_at: '2026-11-26T17:31:00Z' };
    const rot = bewerte(ohneReview({ kommentare: [anf(C)], laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_LABEL_SKIP, spaeterSkip] } }));
    assert.equal(rot.state, 'failure');
    assert.match(rot.description, /uebersprungen/);
    const gruen = bewerte(lage({ kommentare: [anf(C)], laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_LABEL_SKIP, { ...CR_FERTIG, started_at: '2026-11-26T17:31:00Z' }] } }));
    assert.equal(gruen.state, 'success', gruen.description);
  });
  test('ohne Token keine Anforderung: rot mit Grund, nie gruen (live #477: Bot-Befehl wird ignoriert)', () => {
    const u = bewerte(ohneReview({ laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_AUS_SKIP] }, anforderungUnmoeglich: 'Secret REVIEW_ANFORDERUNG_TOKEN fehlt' }));
    assert.equal(u.state, 'failure');
    assert.match(u.description, /nicht angefordert: Secret REVIEW_ANFORDERUNG_TOKEN fehlt/);
    // Noch gar kein CodeRabbit-Lauf am Head: nicht ewig "Warte", sondern rot mit Grund.
    const leer = bewerte(ohneReview({ laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [] }, anforderungUnmoeglich: 'Anforderung gescheitert (HTTP 401), Token pruefen' }));
    assert.equal(leer.state, 'failure', leer.description);
    assert.match(leer.description, /HTTP 401/);
  });
  test('nach Rate-Limit: erst ein neu gesetztes Label gibt genau eine neue Anforderung frei', () => {
    const limit = { ...CR_LIMIT, started_at: '2026-11-26T17:30:40Z' }; // Antwort auf anf(C) um 17:30:20
    const limitLage = (x = {}) => ohneReview({ kommentare: [anf(C)], laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_LABEL_SKIP, limit] }, ...x });
    assert.equal(anforderungNoetig(limitLage()), false, 'ohne neues Label nichts von selbst');
    assert.equal(anforderungNoetig(limitLage({ bereitGesetzt: Date.parse('2026-11-26T17:30:11Z') })), false, 'Label von vor dem Limit');
    const neu = limitLage({ bereitGesetzt: Date.parse('2026-11-26T18:31:00Z') });
    assert.equal(wiederholungErlaubt(neu), true);
    assert.equal(anforderungNoetig(neu), true, 'Label nach dem Limit: eine neue Anforderung');
    // Danach steht eine neue Marke nach dem Limit: keine dritte.
    const danach = { ...neu, kommentare: [anf(C), anf(C, '2026-11-26T18:31:05Z')] };
    assert.equal(anforderungNoetig(danach), false);
    // Ein Skip ist kein Rate-Limit: Label neu setzen hilft dort nicht.
    const skip = limitLage({ laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [{ ...CR_SKIP, started_at: '2026-11-26T17:30:40Z' }] }, bereitGesetzt: Date.parse('2026-11-26T18:31:00Z') });
    assert.equal(anforderungNoetig(skip), false);
    // Der Status bleibt rot und sagt, was zu tun ist.
    const u = bewerte({ ...limitLage(), keinWarten: true });
    assert.equal(u.state, 'failure');
    assert.match(u.description, /rate-limitiert: NICHT geprueft, nach dem Limit Label neu setzen/);
  });
  test('die Marke allein ist nie ein Review', () => {
    const u = bewerte(ohneReview({ kommentare: [anf(C)], keinWarten: true }));
    assert.notEqual(u.state, 'success');
  });
});

describe('Review-Nachweis: Runden und gleicher Stand (Review #477)', () => {
  const D = h('4');
  // Drei Staende mit fertigem Review, der vierte (D) neu und noch ohne.
  const vierte = (x = {}) => lage({
    commits: [A, B, C, D],
    laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_FERTIG], [D]: [CR_AUS_SKIP] },
    bereiche: [{ a: BASIS, b: A }, { a: A, b: B }, { a: B, b: C }], ...x, pr: { head_sha: D, ...(x.pr || {}) },
  });
  // Krisz, 28.11.2026: pruefen, bis nichts mehr zu bemaengeln ist. Ein
  // Rundenlimit gibt es nicht mehr; vor einer Endlosschleife schuetzt, dass
  // jeder Stand ein neu gesetztes Label braucht und genau einmal angefordert wird.
  test('kein Rundenlimit: nach drei Runden wird der neue Stand angefordert, aber nur mit Label und nur einmal', () => {
    assert.equal(rundenZahl(vierte()), 3);
    assert.equal(anforderungNoetig(vierte()), true, 'vierte Runde');
    assert.equal(anforderungNoetig(vierte({ pr: { labels: [] } })), false, 'ohne Label nichts');
    const anfD = { author: 'Verse-Base', body: `@coderabbitai review\n\n${anforderungsMarke(D)}`, erstellt: '2026-11-28T09:00:30Z' };
    assert.equal(anforderungNoetig(vierte({ kommentare: [anfD] })), false, 'derselbe Stand nie doppelt');
    const ohne = bewerte(vierte({ pr: { labels: [] }, keinWarten: true }));
    assert.equal(ohne.state, 'failure');
    assert.match(ohne.description, /^Kein Review fuer diesen Stand angefordert/);
    assert.match(ohne.bericht.join('\n'), /CodeRabbit-Runden mit Abschluss: 3\b/);
  });
  test('Runden ueberdauern ein Umschreiben: die Zahl im Bericht faellt nach Force-Push nicht', () => {
    // Drei Runden auf A, B, C; dann Squash auf einen neuen Stand E. Die
    // geprueften Commits sind nicht mehr im PR, ihre Reviews schon.
    const E = h('5');
    const neu = lage({ commits: [E], laeufeJeCommit: { [E]: [] }, bereiche: [], pr: { head_sha: E } });
    assert.equal(rundenZahl(neu), 0, 'ohne Gedaechtnis faellt die Zahl');
    const mit = { ...neu, fruehereRunden: [A, B, C] };
    assert.equal(rundenZahl(mit), 3);
    assert.deepEqual(gepruefteStaende({ ...mit, commits: [C, E], laeufeJeCommit: { [C]: [CR_FERTIG] } }).sort(), [A, B, C].sort(), 'doppelt zaehlt einmal');
    // Das Ledger im Bericht traegt sie zum naechsten Lauf.
    const text = berichtText({ state: 'failure', description: 'x', bericht: [] }, { bereiche: [], runden: [A, B, C, 'kaputt'], lauf: '-', quelle: '-' });
    assert.deepEqual(rundenLesen(text).sort(), [A, B, C].sort());
  });
  test('Runde ohne Review-Eintrag, Lauf vor dem Ledger abgebrochen: die Marke findet sie wieder', () => {
    // Dritte Runde auf C endet ohne Kommentare (kein Review-Eintrag), ein
    // Force-Push bricht den Lauf ab, bevor er das Ledger schreibt. Ledger und
    // Reviews kennen nur A und B; die Anforderung fuer C steht noch da.
    const E = h('5'), F = h('6');
    const marke = (sha) => ({ author: 'Verse-Base', body: `@coderabbitai review\n\n${anforderungsMarke(sha)}`, erstellt: '2026-11-28T09:00:00Z' });
    const kommentare = [marke(A), marke(B), marke(C), marke(F), { author: 'x', body: 'kein Befehl' }];
    assert.deepEqual(angeforderteStaende(kommentare), [A, B, C, F]);
    // C: fertiger Review (gefunden ueber die Marke); F: nur Rate-Limit (keine
    // Runde); A, B stehen schon im Ledger.
    const aus = rundenAusAnforderungen([C, F], { [C]: [CR_FERTIG], [F]: [CR_LIMIT] });
    assert.deepEqual(aus, { bestaetigt: [C], vorlaeufig: [] });
    const d = lage({ commits: [E], laeufeJeCommit: { [E]: [] }, bereiche: [], pr: { head_sha: E }, fruehereRunden: [A, B, ...aus.bestaetigt] });
    assert.equal(rundenZahl(d), 3);
  });
  test('Nicht lesbarer alter Stand: keine abgeschlossene Runde, im Bericht getrennt genannt, nicht im Ledger', () => {
    const E = h('5');
    const nach = (aus) => lage({ commits: [E], laeufeJeCommit: { [E]: [] }, bereiche: [], pr: { head_sha: E }, fruehereRunden: [A, B, ...aus.bestaetigt], vorlaeufigeRunden: aus.vorlaeufig });
    // Lauf 1: C nicht lesbar (API-Fehler). Ohne Rundenlimit entscheidet die
    // Zahl nichts mehr; sie ist nur Bericht und zaehlt deshalb nur Belegtes
    // (Review #477, Runde 4). Der angeforderte Stand steht getrennt daneben.
    const eins = rundenAusAnforderungen([C], { [C]: null });
    assert.deepEqual(eins, { bestaetigt: [], vorlaeufig: [C] });
    assert.equal(rundenZahl(nach(eins)), 2, 'nicht lesbar ist keine abgeschlossene Runde');
    assert.deepEqual(unlesbareRunden(nach(eins)), [C]);
    assert.match(bewerte(nach(eins)).bericht.join('\n'), /CodeRabbit-Runden mit Abschluss: 2 \(dazu 1 angefordert, Laeufe nicht lesbar\)/);
    assert.deepEqual(bestaetigteRunden(nach(eins)).sort(), [A, B].sort(), 'ins Ledger nur Belegtes');
    // Lauf 2 liest C neu: nur ein Skip, also keine Runde.
    const zwei = rundenAusAnforderungen([C], { [C]: [CR_AUS_SKIP] });
    assert.deepEqual(zwei, { bestaetigt: [], vorlaeufig: [] });
    assert.equal(rundenZahl(nach(zwei)), 2);
    assert.deepEqual(unlesbareRunden(nach(zwei)), [], 'ein einmaliger API-Fehler bleibt nicht stehen');
    assert.doesNotMatch(bewerte(nach(zwei)).bericht.join('\n'), /nicht lesbar/);
  });
  test('ROT: derselbe Stand ist Head eines weiteren offenen PRs, auch wenn sonst alles gruen waere', () => {
    assert.equal(bewerte(lage()).state, 'success');
    const u = bewerte(lage({ gleicherStand: [480] }));
    assert.equal(u.state, 'failure');
    assert.match(u.description, /auch Head von #480/);
    const rel = bewerte({ ...lage({ gleicherStand: [481] }), pr: pr({ base_ref: 'main', head_ref: 'staging' }) });
    assert.equal(rel.state, 'failure', 'auch im Release-Modus');
  });
  // Wettlauf: der zweite PR erscheint erst nach dem Sammeln.
  const lauf = async (antworten) => {
    const geschrieben = [];
    let n = 0;
    const u = await statusMitKontrolle(bewerte(lage()), lage(), {
      schreibe: async (x) => { geschrieben.push(x.state); },
      gleicheStaende: async () => antworten[Math.min(n++, antworten.length - 1)],
    });
    return { u, geschrieben, abfragen: n };
  };
  test('gleicher Stand, Wettlauf: zweiter PR erst nach dem gruenen Schreiben -> zuletzt rot', async () => {
    const { u, geschrieben } = await lauf([[], [482]]);
    assert.deepEqual(geschrieben, ['success', 'failure']);
    assert.equal(u.state, 'failure');
    assert.match(u.description, /auch Head von #482/);
  });
  test('gleicher Stand schon vor dem Schreiben: nur rot; ohne zweiten PR genau ein gruen', async () => {
    assert.deepEqual((await lauf([[483]])).geschrieben, ['failure']);
    const ok = await lauf([[]]);
    assert.deepEqual(ok.geschrieben, ['success']);
    assert.equal(ok.abfragen, 2, 'vor und nach dem Schreiben nachgesehen');
  });
});

describe('Review-Nachweis: Kette nur ueber fertige Reviews (Review #477)', () => {
  test('ROT: Bereich aus einer abgebrochenen Runde (Ziel ohne fertigen Review) ist kein Glied', () => {
    // CodeRabbit nennt den Bereich A..B schon zu Beginn; die Runde auf B
    // brach ab, das Ledger hat den Bereich trotzdem.
    const d = lage({ laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_ABBRUCH], [C]: [CR_FERTIG] } });
    const u = bewerte(d);
    assert.equal(u.state, 'failure', u.description);
    assert.match(u.description, /Abdeckung lueckenhaft/);
    assert.ok(u.bericht.some((z) => /verworfene Bereiche/.test(z)));
    // Mit fertigem Review auf B ist dieselbe Kette gueltig.
    assert.equal(bewerte(lage()).state, 'success');
  });
});

describe('Review-Nachweis: Release liest das Urteil je PR (Review #477)', () => {
  const st = (state, description, created_at) => ({ context: 'review-nachweis', state, description, created_at });
  test('Beschreibung traegt den PR und bleibt in 140 Zeichen', () => {
    const b = beschreibungMitPr('x'.repeat(200), 477);
    assert.equal(b.length, 140);
    assert.match(b, / \[#477\]$/);
  });
  test('ein spaeterer PR vom selben Stand ersetzt das Urteil des gemergten nicht', () => {
    const liste = [
      st('success', beschreibungMitPr('Geprueft (CodeRabbit) fuer abc, lueckenlos', 491), '2026-12-02T10:00:00Z'),
      st('failure', beschreibungMitPr('Kritisch: zweite Pruefung fehlt', 490), '2026-12-01T10:00:00Z'),
      st('pending', beschreibungMitPr('Warte auf CodeRabbit', 490), '2026-12-01T09:00:00Z'),
    ];
    assert.equal(nachweisFuerPr(liste, 490), 'failure', 'das eigene juengste Urteil zaehlt');
    assert.equal(nachweisFuerPr(liste, 491), 'success');
    assert.equal(nachweisFuerPr(liste, 49), null, '#49 ist nicht #490');
    assert.equal(nachweisFuerPr([st('success', 'Geprueft ohne Marke', '2026-12-01T10:00:00Z')], 490), null, 'ohne Marke kein Nachweis');
    assert.equal(nachweisFuerPr([{ ...liste[0], context: 'anderer' }], 491), null);
  });
});

describe('Review-Nachweis: Listen ganz oder gar nicht (Review #477)', () => {
  const quelle = (anzahl) => async (seite) => Array.from({ length: Math.max(0, Math.min(100, anzahl - (seite - 1) * 100)) }, (_, i) => (seite - 1) * 100 + i);
  test('liest alle Seiten bis zur ersten nicht vollen', async () => {
    assert.equal((await seitenweise(quelle(250), { max: 3 })).length, 250);
    assert.equal((await seitenweise(quelle(0), { max: 3 })).length, 0);
  });
  test('genau max volle Seiten: eine leere Probe danach, dann vollstaendig', async () => {
    assert.equal((await seitenweise(quelle(300), { max: 3 })).length, 300);
  });
  test('ROT: mehr als max Seiten wirft statt still abzuschneiden', async () => {
    await assert.rejects(seitenweise(quelle(301), { max: 3, was: 'offene PRs' }), /offene PRs: mehr als 300 Eintraege, Liste unvollstaendig/);
    await assert.rejects(seitenweise(quelle(501), { max: 5, was: 'Check-Laeufe' }), /mehr als 500/);
  });
  test('ROT: 3000 Dateien sind nicht vollstaendig pruefbar', () => {
    const viele = Array.from({ length: 3000 }, (_, i) => ({ filename: `docs/x${i}.md` }));
    const u = bewerte(lage({ dateien: viele }));
    assert.equal(u.state, 'failure');
    assert.match(u.description, /3000\+ Dateien/);
  });
});

describe('Review-Nachweis: Release staging -> main', () => {
  const rel = (commits, kommentare = []) => ({ pr: { number: 9, draft: false, base_ref: 'main', head_ref: 'staging', head_sha: C, labels: [] }, release: { commits, zuGross: false }, kommentare, freigabeKonten: ['cibakhun'] });
  const p = (n, nachweis = 'success') => ({ number: n, merged: true, base_ref: 'staging', nachweis });
  test('alle Commits aus PRs mit Nachweis -> gruen', () => {
    assert.equal(bewerte(rel([{ sha: A, prs: [p(1)] }, { sha: B, prs: [p(1)] }, { sha: C, prs: [p(2)] }])).state, 'success');
  });
  test('ROT: Commit ohne PR, PR ohne Nachweis', () => {
    assert.equal(bewerte(rel([{ sha: A, prs: [p(1)] }, { sha: B, prs: [] }])).state, 'failure');
    assert.equal(bewerte(rel([{ sha: A, prs: [p(1, 'failure')] }])).state, 'failure');
    assert.equal(bewerte(rel([{ sha: A, prs: [p(1, null)] }])).state, 'failure');
  });
  test('Release-Ausnahme mit allen Feldern fuer genau diesen Stand -> gruen, deutlich markiert', () => {
    const k = { author: 'cibakhun', body: [`<!-- release-ausnahme sha=${C} -->`, 'Freigabe: Krisz im Chat', 'Nicht nachgewiesen: 717 Alt-Commits vor dem Gate', 'Risiken: siehe Liste'].join('\n') };
    const u = bewerte(rel([{ sha: A, prs: [] }], [k]));
    assert.equal(u.state, 'success');
    assert.match(u.description, /^RELEASE-AUSNAHME/);
  });
});

describe('Review-Nachweis: Runde 3 (Review #477)', () => {
  const marke = (sha, author) => ({ author, body: `@coderabbitai review\n\n${anforderungsMarke(sha)}`, erstellt: '2026-11-28T09:00:00Z' });
  test('Anforderungsmarken zaehlen nur vom Anforderungskonto', () => {
    const d = lage({ laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_AUS_SKIP] }, bereiche: [{ a: BASIS, b: A }, { a: A, b: B }], kommentare: [marke(C, 'irgendwer')] });
    // Eine fremde Marke fuer den Head unterdrueckt die echte Anforderung nicht ...
    assert.equal(anforderungAmHead(d.kommentare, C), null);
    assert.equal(anforderungNoetig(d), true);
    assert.equal(anforderungNoetig({ ...d, kommentare: [marke(C, 'Verse-Base')] }), false);
    // Alte Marken des Workflow-Bots haben nie einen Review ausgeloest
    // (CodeRabbit ignoriert Bots) und sperren den Stand nicht (Runde 4).
    assert.equal(anforderungNoetig({ ...d, kommentare: [marke(C, 'github-actions[bot]')] }), true);
    assert.deepEqual(angeforderteStaende([marke(A, 'github-actions[bot]')]), []);
    // ... und zaehlt nicht als angeforderter Stand.
    assert.deepEqual(angeforderteStaende([marke(A, 'irgendwer'), marke(B, 'Verse-Base')]), [B]);
  });

  // B hatte einen fertigen inkrementellen Review (A..B); danach soll ein
  // `full review` die Luecke Basis..A schliessen und bricht ab. Seine
  // Zusammenfassung nennt Basis..B schon zu Beginn.
  const SPAET_ABBRUCH = { ...CR_ABBRUCH, started_at: '2026-11-27T10:00:00Z' };
  const SPAET_FERTIG = { ...CR_FERTIG, started_at: '2026-11-27T10:00:00Z' };
  const inkr = { a: A, b: B, quelle: 'review' };
  const voll = (stand) => ({ a: BASIS, b: B, quelle: 'zusammenfassung', stand: Date.parse(stand) });
  const luecke = (laeufeB, bereiche) => lage({ commits: [A, B], pr: { head_sha: B }, laeufeJeCommit: { [A]: [CR_AUS_SKIP], [B]: laeufeB }, bereiche });

  test('Bereich aus der Zusammenfassung gehoert zum juengsten Lauf: ein abgebrochener full review schliesst keine Luecke', () => {
    const u = bewerte(luecke([CR_FERTIG, SPAET_ABBRUCH], [inkr, voll('2026-11-27T10:00:05Z')]));
    assert.notEqual(u.state, 'success', 'Abbruch nach frueherem fertigem Lauf darf nicht gruen machen');
    // Ist der full review fertig, schliesst er die Luecke.
    assert.equal(bewerte(luecke([CR_FERTIG, SPAET_FERTIG], [inkr, voll('2026-11-27T10:12:00Z')])).state, 'success');
    // Text aelter als der juengste Lauf: er spricht nicht fuer diesen Lauf.
    assert.equal(codeRabbitAbdeckung({ bereiche: [voll('2026-11-27T09:59:00Z')], commits: [A, B], head: B, vorfahren: { [BASIS]: true }, laeufeJeCommit: { [B]: [CR_FERTIG, SPAET_FERTIG] } }).abgedeckt, false);
    assert.equal(codeRabbitAbdeckung({ bereiche: [{ ...voll('x'), stand: NaN }], commits: [A, B], head: B, vorfahren: { [BASIS]: true }, laeufeJeCommit: { [B]: [SPAET_FERTIG] } }).abgedeckt, false, 'unlesbare Zeit: im Zweifel nicht');
    // Ein abgegebener Review ist ein fester Beleg: ein spaeterer Abbruch nimmt ihn nicht weg.
    assert.equal(codeRabbitAbdeckung({ bereiche: [{ a: BASIS, b: B, quelle: 'review' }], commits: [A, B], head: B, vorfahren: { [BASIS]: true }, laeufeJeCommit: { [B]: [CR_FERTIG, SPAET_ABBRUCH] } }).abgedeckt, true);
  });

  test('Ins Ledger geht nur, was belegt ist; das alte Ledger bleibt', () => {
    const k = (r) => `${r.a}..${r.b}`;
    const abbruch = luecke([CR_FERTIG, SPAET_ABBRUCH], [inkr, voll('2026-11-27T10:00:05Z'), { a: BASIS, b: A, quelle: 'ledger' }]);
    assert.deepEqual(ledgerBereiche(abbruch).map(k).sort(), [k({ a: BASIS, b: A }), k(inkr)].sort(), 'der abgebrochene Bereich wird nicht festgehalten');
    const fertig = luecke([CR_FERTIG, SPAET_FERTIG], [inkr, voll('2026-11-27T10:12:00Z')]);
    assert.ok(ledgerBereiche(fertig).some((r) => r.a === BASIS && r.b === B), 'der fertige full review wird festgehalten');
    const text = berichtText({ state: 'success', description: 'x', bericht: [] }, { bereiche: ledgerBereiche(fertig), lauf: '-', quelle: '-' });
    assert.deepEqual(ledgerLesen(text).map(k).sort(), ledgerBereiche(fertig).map(k).sort());
  });
});

// Der Laeufer selbst, gegen feste GitHub-Antworten (tests/e2e/helpers/fake-github.js).
const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAKE = pathToFileURL(join(WURZEL, 'tests', 'e2e', 'helpers', 'fake-github.js')).href;
const KOPF = h('a'), NEU = h('c');
const ZIEL = h('e'); // Spitze des Zielzweigs, wie sie der PR nennt (base.sha)
const prMit = (sha, labels = [], x = {}) => ({ number: 477, state: 'open', draft: false, base: { ref: 'staging', sha: ZIEL }, head: { sha, ref: 'claude/x' }, labels: labels.map((name) => ({ name })), changed_files: 1, ...x });
const lauf = (x) => ({ app: { slug: 'coderabbitai' }, name: 'CodeRabbit', output: { title: x.title || '', summary: x.summary || '' }, ...x });
const laeuft = lauf({ status: 'in_progress', conclusion: null, started_at: '2026-11-28T03:00:00Z' });
const datei = (sha, filename = 'README.md') => ({ filename, status: 'modified', contents_url: `https://api.github.com/repos/o/r/contents/${filename}?ref=${sha}` });
function laeufer(pulls, { routen = {}, env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'review-nachweis-'));
  const szenario = join(dir, 'szenario.json'), log = join(dir, 'anfragen.log');
  writeFileSync(szenario, JSON.stringify({ routen: {
    'GET repos/o/r/pulls/477': pulls,
    'GET repos/o/r/pulls/477/commits': [[{ sha: KOPF }]],
    [`GET repos/o/r/commits/${KOPF}/check-runs`]: [{ check_runs: [laeuft] }],
    // Dateien fest am Stand: Vergleich Basis...Head (die PR-Liste erst ab 300 Dateien).
    [`GET repos/o/r/compare/${ZIEL}...${KOPF}`]: [{ files: [datei(KOPF)] }],
    ...routen,
  } }));
  const r = spawnSync(process.execPath, ['--import', FAKE, join(WURZEL, 'scripts', 'review-nachweis.mjs')], {
    encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, FAKE_GITHUB: szenario, FAKE_GITHUB_LOG: log, REPO: 'o/r', PR_NUMMER: '477', GH_TOKEN: 'test', ANFORDERUNG_TOKEN: '', EREIGNIS: '', AKTION: '', LABEL: '', LAUF_URL: '', WARTEN_MIN: '0.02', TAKT_S: '0.2', ...env },
  });
  const anfragen = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((z) => JSON.parse(z)) : [];
  return { ...r, anfragen, schreibend: anfragen.filter((x) => !x.schluessel.startsWith('GET ')) };
}
const zustaende = (r) => r.anfragen.filter((x) => x.schluessel === `POST repos/o/r/statuses/${KOPF}`).map((x) => x.body.state);

describe('Review-Nachweis: Nachtraege zu Runde 3 (Review #477)', () => {
  const SPAET_ABBRUCH = { ...CR_ABBRUCH, started_at: '2026-11-27T10:00:00Z' };
  const inkr = { a: A, b: B, quelle: 'review' };
  const abgebrochenVoll = { a: BASIS, b: B, quelle: 'zusammenfassung', stand: Date.parse('2026-11-27T10:00:05Z') };
  const luecke = (bereiche, laeufeA = [CR_AUS_SKIP]) => lage({ commits: [A, B], pr: { head_sha: B }, laeufeJeCommit: { [A]: laeufeA, [B]: [CR_FERTIG, SPAET_ABBRUCH] }, bereiche });
  const ausBericht = (text) => ledgerLesen(text).map((x) => ({ ...x, quelle: 'ledger' }));

  test('Ledger der ersten Fassung wird nicht gelesen: der Bereich eines abgebrochenen full review schliesst keine Luecke', () => {
    // So schrieb die erste Fassung: jeden gesehenen Bereich, auch Basis..B
    // aus der Zusammenfassung eines spaeter abgebrochenen full review.
    const alt = `<!-- review-nachweis:bericht -->\n<!-- review-nachweis:bereiche ${JSON.stringify([{ a: BASIS, b: B }])} -->`;
    assert.equal(altesLedger(alt), true);
    assert.deepEqual(ledgerLesen(alt), []);
    assert.notEqual(bewerte(luecke([inkr, abgebrochenVoll, ...ausBericht(alt)])).state, 'success');
    // Fassung 2 schreibt nur Belegtes und wird gelesen: Basis..A war ein
    // fertiger Lauf an A, dessen Zusammenfassung inzwischen ueberschrieben ist.
    const neu = berichtText({ state: 'failure', description: 'x', bericht: [] }, { bereiche: [{ a: BASIS, b: A }], lauf: '-', quelle: '-' });
    assert.equal(altesLedger(neu), false);
    assert.deepEqual(ledgerLesen(neu), [{ a: BASIS, b: A }]);
    assert.equal(bewerte(luecke([inkr, ...ausBericht(neu)], [CR_FERTIG])).state, 'success', 'ein belegter Bereich aus dem Ledger schliesst die Luecke');
  });


  test('Laeufer: wechselt der Head waehrend der Erhebung, schreibt er nichts mehr, auch kein "Warte"', () => {
    const r = laeufer([prMit(KOPF), prMit(NEU)]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Neuer Stand oder PR geschlossen waehrend der Erhebung/);
    // Jede schreibende Anfrage, nicht nur POST: kein Status, kein Label (DELETE), kein Bericht (PATCH).
    assert.deepEqual(r.schreibend, [], 'auf dem alten Stand wird nichts geschrieben');
  });

  test('Gegenprobe Laeufer: bleibt der Head, schreibt er "Warte" und am Ende sein Urteil', () => {
    const r = laeufer([prMit(KOPF)]);
    assert.equal(r.status, 0, r.stderr);
    const zust = zustaende(r);
    assert.equal(zust[0], 'pending', 'erst Warte');
    assert.equal(zust.at(-1), 'failure', 'nach Ablauf der Wartezeit nicht geprueft');
    assert.ok(r.anfragen.some((x) => x.schluessel === 'POST repos/o/r/issues/477/comments'), 'Bericht geschrieben');
  });
});

describe('Review-Nachweis: Runde 4 (Review #477)', () => {
  const bericht = (r) => r.anfragen.filter((x) => x.schluessel === 'POST repos/o/r/issues/477/comments' && x.body.body.includes('review-nachweis:bericht')).at(-1)?.body.body || '';

  test('fremdeDateien: jede nicht geloeschte Datei muss vom Head stammen', () => {
    assert.deepEqual(fremdeDateien([datei(KOPF), datei(KOPF, 'b.js')], KOPF), []);
    assert.deepEqual(fremdeDateien([datei(KOPF), datei(NEU, 'b.js')], KOPF).map((f) => f.filename), ['b.js']);
    // Eine geloeschte Datei nennt die Seite des Zielzweigs (gemessen an #480).
    assert.deepEqual(fremdeDateien([{ ...datei(h('9'), 'weg.js'), status: 'removed' }], KOPF), []);
    assert.equal(fremdeDateien([{ filename: 'ohne.js', status: 'modified' }], KOPF).length, 1, 'ohne Angabe im Zweifel fremd');
  });

  // CodeRabbits Nachfrage zu Runde 4: A aendert eine kritische Datei, B nimmt
  // das zurueck und loescht nur eine normale Datei. Die PR-Liste, waehrend B
  // Head war gelesen, enthaelt dann nur die geloeschte Datei und verraet B
  // auch ueber contents_url nicht.
  const KRITISCH = { ...datei(KOPF, '.github/workflows/deploy.yml'), sha: h('7') };
  const NUR_GELOESCHT = { filename: 'docs/alt.md', status: 'removed', sha: h('8'), contents_url: `https://api.github.com/repos/o/r/contents/docs/alt.md?ref=${ZIEL}` };

  test('ROT: Dateien kommen fest vom Stand; eine PR-Liste von B mit nur geloeschten Dateien macht A nicht normal', () => {
    const r = laeufer([prMit(KOPF)], { routen: {
      [`GET repos/o/r/compare/${ZIEL}...${KOPF}`]: [{ files: [KRITISCH] }],
      'GET repos/o/r/pulls/477/files': [[NUR_GELOESCHT]],
    } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(bericht(r), /\*\*kritisch\*\*/, 'der kritische Stand A bleibt kritisch');
    assert.match(bericht(r), /\.github\/workflows\/deploy\.yml/);
    assert.ok(!r.anfragen.some((x) => x.schluessel === 'GET repos/o/r/pulls/477/files'), 'unter 300 Dateien keine PR-Liste');
  });

  // Ab 300 Dateien liefert der Vergleich nicht alle; dann gilt die PR-Liste,
  // gebunden an die ersten 300 des Vergleichs und die Dateizahl des PRs.
  const viele = (n, sha = KOPF) => Array.from({ length: n }, (_, i) => ({ ...datei(sha, `data/d${String(i).padStart(4, '0')}.json`), sha: h('9') }));
  // Jede Seite der PR-Liste als eigene Route: bei jedem Erheben dieselbe Liste.
  const seiten = (liste) => Object.fromEntries(Array.from({ length: Math.floor(liste.length / 100) + 1 }, (_, i) => [`GET repos/o/r/pulls/477/files?page=${i + 1}`, [liste.slice(i * 100, i * 100 + 100)]]));
  const gross = (prListe, pulls = [prMit(KOPF, [], { changed_files: 320 })]) => laeufer(pulls, { routen: {
    [`GET repos/o/r/compare/${ZIEL}...${KOPF}`]: [{ files: viele(300) }],
    ...seiten(prListe),
  } });

  test('abweichendeDateien: PR-Liste muss zum Vergleich und zum Head passen', () => {
    const fest = viele(3);
    assert.equal(abweichendeDateien(viele(5), fest, KOPF), 0);
    assert.equal(abweichendeDateien([...viele(5).slice(1)], fest, KOPF), 1, 'Datei des Vergleichs fehlt');
    assert.equal(abweichendeDateien([{ ...viele(1)[0], sha: h('6') }, ...viele(5).slice(1)], fest, KOPF), 1, 'anderer Blob');
    assert.equal(abweichendeDateien([{ ...viele(1)[0], status: 'removed' }, ...viele(5).slice(1)], fest, KOPF), 1, 'anderer Status');
    assert.equal(abweichendeDateien([...viele(5), datei(NEU, 'x.js')], fest, KOPF), 1, 'fremder Stand per contents_url');
  });

  test('ROT: ab 300 Dateien scheitert eine fremde PR-Liste nach drei Versuchen, ohne ein Urteil zu schreiben', () => {
    const r = gross([...viele(300), ...viele(20, NEU).map((f, i) => ({ ...f, filename: `neu/${i}.json` }))]);
    assert.notEqual(r.status, 0, 'der Lauf scheitert');
    assert.match(r.stdout, /erhebe neu \(Versuch 3\)/);
    assert.match(r.stderr, /passen nach 3 Versuchen nicht zum Stand aaaaaaa \(20 Dateiabweichungen, 0 Commits aus einem anderen Stand\)/);
    assert.deepEqual(r.schreibend, [], 'kein Urteil aus gemischten Daten (den Fehlschlag meldet der Workflow)');
    // Nur geloeschte Dateien von B: faellt ueber den Vergleich und die Dateizahl auf.
    const g = gross([NUR_GELOESCHT]);
    assert.notEqual(g.status, 0);
    assert.deepEqual(g.schreibend, []);
    // Hinter den ersten 300 Dateien fehlen zehn Aenderungen: nur die Dateizahl des PRs verraet es.
    const k = gross([...viele(300), ...viele(10).map((f, i) => ({ ...f, filename: `mehr/${i}.json` }))]);
    assert.notEqual(k.status, 0);
    assert.match(k.stderr, /\(1 Dateiabweichungen, 0 Commits/);
    assert.deepEqual(k.schreibend, []);
  });

  test('Gegenprobe: ab 300 Dateien laeuft eine passende PR-Liste normal durch', () => {
    const r = gross([...viele(300), ...viele(20).map((f, i) => ({ ...f, filename: `mehr/${i}.json` }))]);
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /erhebe neu/);
    assert.equal(zustaende(r)[0], 'pending');
    assert.match(r.stdout, /320 Dateien/);
    // Geloeschte Dateien bindet auch der Abgleich nicht: ab 300 Dateien im Zweifel kritisch.
    assert.match(bericht(r), /\*\*kritisch\*\*/);
    assert.match(bericht(r), /300 oder mehr Dateien: Dateiliste nicht fest an den Stand gebunden/);
  });

  test('ROT: ab 300 Dateien ist ein PR kritisch, auch wenn die Liste nur Daten nennt', () => {
    // CodeRabbits Nachfrage: Die PR-Liste von B besteht jeden Abgleich, wenn
    // sie sich hinter Datei 300 nur durch geloeschte Dateien unterscheidet;
    // die kritische Aenderung von A fehlt dann. Deshalb zaehlt die Groesse.
    assert.deepEqual(kritischeGruende(viele(299)), [], 'unter 300 normale Daten: normal');
    assert.deepEqual(kritischeGruende(viele(300)), ['300 oder mehr Dateien: Dateiliste nicht fest an den Stand gebunden']);
    const vonB = [...viele(300), ...viele(19).map((f, i) => ({ ...f, filename: `mehr/${i}.json` })), { ...NUR_GELOESCHT }];
    assert.ok(kritischeGruende(vonB).length > 0);
  });

  test('ROT: Commits von einem anderen Stand scheitern nach drei Versuchen, ohne zu schreiben', () => {
    // Der Head fehlt in der Commit-Liste ...
    const c = laeufer([prMit(KOPF)], { routen: { 'GET repos/o/r/pulls/477/commits': [[{ sha: NEU }]] } });
    assert.notEqual(c.status, 0);
    assert.match(c.stderr, /Head fehlt in der Commit-Liste/);
    assert.deepEqual(c.schreibend, []);
    // ... oder die Liste gehoert zu einem Nachfolger (B = A + X): X liegt nicht im Verlauf von A.
    const x = laeufer([prMit(KOPF)], { routen: { 'GET repos/o/r/pulls/477/commits': [[{ sha: KOPF, parents: [] }, { sha: NEU, parents: [{ sha: KOPF }] }]] } });
    assert.notEqual(x.status, 0);
    assert.match(x.stderr, /0 Dateiabweichungen, 1 Commits aus einem anderen Stand/);
    assert.deepEqual(x.schreibend, []);
  });

  test('verlaufZumHead: nur der Verlauf des Heads, Eltern vor Kindern', () => {
    const P = h('4'), Q = h('5'), M = h('6');
    const c = (sha, ...parents) => ({ sha, parents });
    assert.deepEqual(verlaufZumHead([c(A, BASIS), c(B, A), c(C, B)], C), [A, B, C]);
    assert.deepEqual(verlaufZumHead([c(C, B), c(A, BASIS), c(B, A)], C), [A, B, C], 'Reihenfolge der Liste zaehlt nicht');
    assert.deepEqual(verlaufZumHead([c(A, BASIS), c(B, A), c(C, B)], B), [A, B], 'Nachfolger faellt heraus');
    // Zusammenfuehrung im Zweig: beide Seiten vor M, gemeinsamer Vorfahr zuerst.
    const v = verlaufZumHead([c(P, BASIS), c(A, P), c(Q, P), c(M, A, Q)], M);
    assert.deepEqual(v.sort(), [P, A, Q, M].sort());
    const reihe = verlaufZumHead([c(M, A, Q), c(Q, P), c(A, P), c(P, BASIS)], M);
    assert.ok(reihe.indexOf(P) < reihe.indexOf(A) && reihe.indexOf(P) < reihe.indexOf(Q) && reihe.at(-1) === M, reihe.join());
    // Fehlt der Head, bleibt die Liste (das faengt der Laeufer).
    assert.deepEqual(verlaufZumHead([c(A, BASIS)], C), [A]);
  });

  test('ROT: cubic liest in Verlaufsreihenfolge; eine verdrehte Liste macht einen Abbruch nicht gruen', () => {
    // Wahrer Verlauf A (voll) -> B (Limit) -> C (inkrementell): nach dem Limit ist nichts belegt.
    const laeufeJeCommit = { [A]: [CU_VOLL], [B]: [CU_LIMIT], [C]: [CU_INKR] };
    const liste = [{ sha: B, parents: [A] }, { sha: A, parents: [BASIS] }, { sha: C, parents: [B] }];
    assert.equal(cubicAbdeckung({ commits: liste.map((x) => x.sha), head: C, laeufeJeCommit }).abgedeckt, true, 'so saehe es mit der Listenreihenfolge aus');
    assert.equal(cubicAbdeckung({ commits: verlaufZumHead(liste, C), head: C, laeufeJeCommit }).abgedeckt, false);
    // Gegenprobe: ohne das Limit haelt die Abdeckung.
    assert.equal(cubicAbdeckung({ commits: verlaufZumHead(liste, C), head: C, laeufeJeCommit: { ...laeufeJeCommit, [B]: [CU_INKR] } }).abgedeckt, true);
  });

  test('Gegenprobe: passt die Liste beim zweiten Erheben, laeuft er normal weiter', () => {
    const r = laeufer([prMit(KOPF)], { routen: { 'GET repos/o/r/pulls/477/commits': [[{ sha: NEU }], [{ sha: KOPF }]] } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /erhebe neu \(Versuch 2\)/);
    assert.equal(zustaende(r)[0], 'pending');
    // Ab 300 Dateien: die Dateizahl kommt beim neuen Erheben aus dem frischen PR-Abruf.
    const z = gross([...viele(300), ...viele(20).map((f, i) => ({ ...f, filename: `mehr/${i}.json` }))], [prMit(KOPF, [], { changed_files: 300 }), prMit(KOPF, [], { changed_files: 320 })]);
    assert.equal(z.status, 0, z.stderr);
    assert.match(z.stdout, /1 Dateiabweichungen, 0 Commits aus einem anderen Stand\), erhebe neu \(Versuch 2\)/);
    // Und ist der Head inzwischen ein anderer, uebernimmt dessen Lauf.
    const w = laeufer([prMit(KOPF), prMit(NEU)], { routen: { 'GET repos/o/r/pulls/477/commits': [[{ sha: NEU }]] } });
    assert.equal(w.status, 0, w.stderr);
    assert.match(w.stdout, /Neuer Stand oder PR geschlossen waehrend der Erhebung/);
    assert.deepEqual(w.schreibend, []);
  });

  const mitAnforderung = { env: { ANFORDERUNG_TOKEN: 'konto' }, routen: { 'GET user': [{ login: 'Verse-Base' }] } };
  const anforderungen = (r) => r.anfragen.filter((x) => x.schluessel === 'POST repos/o/r/issues/477/comments' && x.body.body.includes(`review-nachweis:anforderung sha=${KOPF}`));

  test('ROT: wechselt der Head waehrend der Token-Pruefung, geht keine Anforderung hinaus', () => {
    // Abruf 1: Start, 2: vor der Token-Pruefung, 3: danach.
    const r = laeufer([prMit(KOPF, ['review-ready']), prMit(KOPF, ['review-ready']), prMit(NEU, ['review-ready'])], mitAnforderung);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.anfragen.some((x) => x.schluessel === 'GET user'), 'Token wurde geprueft');
    assert.deepEqual(anforderungen(r), [], 'kein Befehl an einen neuen Stand');
    assert.deepEqual(r.schreibend, []);
  });

  test('Gegenprobe: bleibt der Head, geht genau eine Anforderung hinaus', () => {
    const r = laeufer([prMit(KOPF, ['review-ready'])], mitAnforderung);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(anforderungen(r).length, 1);
  });

  // Runde 5: Auch die Freigabe selbst kann waehrend der Token-Pruefung entfallen.
  test('ROT: Label ab oder zurueck zum Draft waehrend der Token-Pruefung: keine Anforderung', () => {
    const ohne = laeufer([prMit(KOPF, ['review-ready']), prMit(KOPF, ['review-ready']), prMit(KOPF, [])], mitAnforderung);
    assert.equal(ohne.status, 0, ohne.stderr);
    assert.match(ohne.stdout, /Freigabe waehrend der Token-Pruefung entfallen \(Label review-ready fehlt\)/);
    assert.deepEqual(anforderungen(ohne), []);
    assert.deepEqual(ohne.schreibend, []);
    const draft = laeufer([prMit(KOPF, ['review-ready']), prMit(KOPF, ['review-ready']), prMit(KOPF, ['review-ready'], { draft: true })], mitAnforderung);
    assert.equal(draft.status, 0, draft.stderr);
    assert.match(draft.stdout, /Freigabe waehrend der Token-Pruefung entfallen \(Draft\)/);
    assert.deepEqual(draft.schreibend, []);
  });

  // Runde 5: Die Dateiliste ist der Vergleich ab der Zusammenfuehrungsbasis.
  const NEUBASIS = h('d'), ZB = h('9');
  const mitBasis = (zielNeu, zbNeu) => ({ routen: {
    [`GET repos/o/r/compare/${ZIEL}...${KOPF}`]: [{ files: [datei(KOPF)], merge_base_commit: { sha: ZB } }],
    [`GET repos/o/r/compare/${NEUBASIS}...${KOPF}`]: [{ files: [datei(KOPF)], merge_base_commit: { sha: zbNeu } }],
  } });

  test('ROT: wechselt der Zielzweig waehrend der Erhebung, schreibt der Lauf nichts', () => {
    const r = laeufer([prMit(KOPF), prMit(KOPF, [], { base: { ref: 'main', sha: ZIEL } })], mitBasis());
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Zielzweig waehrend der Erhebung geaendert \(staging -> main\)/);
    assert.deepEqual(r.schreibend, []);
  });

  test('ROT: verschiebt sich die Zusammenfuehrungsbasis, scheitert der Lauf ohne Urteil', () => {
    const r = laeufer([prMit(KOPF), prMit(KOPF, [], { base: { ref: 'staging', sha: NEUBASIS } })], mitBasis(NEUBASIS, h('5')));
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Zusammenfuehrungsbasis hat sich waehrend der Erhebung verschoben \(9999999 -> 5555555\)/);
    assert.deepEqual(r.schreibend, []);
  });

  test('Gegenprobe: ruecken nur neue Commits auf den Zielzweig, laeuft er normal weiter', () => {
    const r = laeufer([prMit(KOPF), prMit(KOPF, [], { base: { ref: 'staging', sha: NEUBASIS } })], mitBasis(NEUBASIS, ZB));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(zustaende(r)[0], 'pending');
    assert.equal(zustaende(r).at(-1), 'failure', 'ohne Review rot wie sonst');
  });

  // Ziel einer Zusammenfassung ist ein aelterer Stand A. Beim ersten Erheben
  // gibt es dort nur einen alten fertigen Lauf; waehrend des Wartens startet
  // ein neuer Lauf an A, dessen Zusammenfassung Basis..A nennt.
  const BASIS2 = h('b'), A2 = h('1');
  const ALT_FERTIG = lauf({ status: 'completed', conclusion: 'success', title: 'Finished', summary: 'Result: Success - Review completed', started_at: '2026-11-28T09:00:00Z' });
  const NEU_ABBRUCH = lauf({ status: 'completed', conclusion: 'cancelled', title: 'Review cancelled', summary: 'Result: Cancelled - Review cancelled', started_at: '2026-11-28T10:00:00Z' });
  const NEU_FERTIG = { ...ALT_FERTIG, started_at: '2026-11-28T10:00:00Z' };
  const zusammenfassung = { id: 7, user: { login: 'coderabbitai[bot]' }, body: `Reviewing files that changed between ${BASIS2} and ${A2}.`, created_at: '2026-11-28T10:00:05Z', updated_at: '2026-11-28T10:00:05Z' };
  const zielLauf = (spaeter) => laeufer([prMit(KOPF)], { routen: {
    'GET repos/o/r/pulls/477/commits': [[{ sha: A2, parents: [{ sha: BASIS2 }] }, { sha: KOPF, parents: [{ sha: A2 }] }]],
    [`GET repos/o/r/commits/${A2}/check-runs`]: [{ check_runs: [ALT_FERTIG] }, { check_runs: [ALT_FERTIG, spaeter] }],
    'GET repos/o/r/issues/477/comments': [[], [zusammenfassung]],
    [`GET repos/o/r/compare/${BASIS2}...staging`]: [{ status: 'ahead' }],
  } });

  test('ROT: Ziel einer Zusammenfassung wird beim Warten neu gelesen; ein abgebrochener Lauf dort belegt den Bereich nicht', () => {
    const r = zielLauf(NEU_ABBRUCH);
    assert.equal(r.status, 0, r.stderr);
    const text = bericht(r);
    assert.match(text, /review-nachweis:bereiche2/, 'Bericht mit Ledger geschrieben');
    assert.ok(!text.includes(`"a":"${BASIS2}","b":"${A2}"`), 'Basis..A darf nicht ins Ledger');
  });

  test('Gegenprobe: ist der neue Lauf am Ziel fertig, geht der Bereich ins Ledger', () => {
    const text = bericht(zielLauf(NEU_FERTIG));
    assert.ok(text.includes(`"a":"${BASIS2}","b":"${A2}"`), text);
  });
});
