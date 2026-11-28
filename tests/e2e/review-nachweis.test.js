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
  anforderungNoetig, anforderungAmHead, anforderungsMarke, rundenZahl, rundenBremse,
  freigabeVerbraucht, zuletztGesetzt, seitenweise, statusMitKontrolle,
  gepruefteStaende, rundenLesen, beschreibungMitPr, nachweisFuerPr, wiederholungErlaubt,
  angeforderteStaende, rundenAusAnforderungen, bestaetigteRunden, ledgerBereiche,
} from '../../scripts/lib/review-nachweis.mjs';

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
    assert.deepEqual(ledgerLesen('<!-- review-nachweis:bereiche [kaputt -->'), []);
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
  const anf = (sha, erstellt = '2026-11-26T17:30:20Z') => ({ author: 'github-actions[bot]', body: `@coderabbitai review\n\n${anforderungsMarke(sha)}`, erstellt });
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

describe('Review-Nachweis: Rundenbremse und gleicher Stand (Review #477)', () => {
  const D = h('4');
  // Drei Staende mit fertigem Review, der vierte (D) neu und noch ohne.
  const vierte = (x = {}) => lage({
    commits: [A, B, C, D],
    laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_FERTIG], [D]: [CR_AUS_SKIP] },
    bereiche: [{ a: BASIS, b: A }, { a: A, b: B }, { a: B, b: C }], ...x, pr: { head_sha: D, ...(x.pr || {}) },
  });
  test('drei Runden: keine vierte Anforderung, bei jedem Ereignis, nicht nur beim Label', () => {
    assert.equal(rundenZahl(vierte()), 3);
    assert.equal(rundenBremse(vierte()), true);
    assert.equal(anforderungNoetig(vierte()), false, 'ohne Freigabe keine vierte Runde');
    assert.equal(anforderungNoetig(vierte(), { bremse: false }), true, 'ohne Bremse waere sie faellig');
  });
  // Krisz setzt die Freigabe nach der dritten Runde.
  const GESETZT = '2026-11-28T09:00:00Z';
  const ev = [
    { event: 'labeled', label: { name: 'review-ready' }, created_at: '2026-11-28T08:00:00Z' },
    { event: 'labeled', label: { name: 'review-runde-frei' }, created_at: GESETZT },
  ];
  const anfD = { author: 'Verse-Base', body: `@coderabbitai review\n\n${anforderungsMarke(D)}`, erstellt: '2026-11-28T09:00:30Z' };
  const frei = (x = {}) => vierte({ freigabeGesetzt: zuletztGesetzt(ev, 'review-runde-frei'), ...x, pr: { labels: ['review-ready', 'review-runde-frei'], ...(x.pr || {}) } });
  test('review-runde-frei gibt genau die naechste Anforderung frei', () => {
    assert.equal(zuletztGesetzt(ev, 'review-runde-frei'), Date.parse(GESETZT));
    assert.equal(freigabeVerbraucht(frei()), false);
    assert.equal(rundenBremse(frei()), false);
    assert.equal(anforderungNoetig(frei()), true);
    // Eine Anforderung von vor dem Setzen verbraucht sie nicht.
    const alt = { ...anfD, body: `@coderabbitai review\n\n${anforderungsMarke(C)}`, erstellt: '2026-11-28T07:00:00Z' };
    assert.equal(freigabeVerbraucht(frei({ kommentare: [alt] })), false);
  });
  test('verbraucht mit der Anforderung, auch wenn der Lauf danach abbrach und das Label blieb', () => {
    // Lage danach: Label noch da (Abnehmen nie passiert oder gescheitert),
    // Anforderung fuer D steht, ein neuer Stand E ist gepusht.
    const E = h('5');
    const danach = frei({
      kommentare: [anfD],
      commits: [A, B, C, D, E],
      laeufeJeCommit: { [A]: [CR_FERTIG], [B]: [CR_FERTIG], [C]: [CR_FERTIG], [D]: [CR_FERTIG], [E]: [] },
      pr: { head_sha: E },
    });
    assert.equal(freigabeVerbraucht(danach), true);
    assert.equal(rundenBremse(danach), true);
    assert.equal(anforderungNoetig(danach), false, 'keine fuenfte Runde ohne neue Freigabe');
    const u = bewerte({ ...danach, keinWarten: true });
    assert.equal(u.state, 'failure');
    assert.match(u.description, /^Rundenbremse: 4 Runden erreicht/);
  });
  test('Runden ueberdauern ein Umschreiben: nach Force-Push keine vierte ohne Freigabe', () => {
    // Drei Runden auf A, B, C; dann Squash auf einen neuen Stand E. Die
    // geprueften Commits sind nicht mehr im PR, ihre Reviews schon.
    const E = h('5');
    const neu = lage({ commits: [E], laeufeJeCommit: { [E]: [] }, bereiche: [], pr: { head_sha: E } });
    assert.equal(rundenZahl(neu), 0, 'ohne Gedaechtnis waere die Bremse weg');
    const mit = { ...neu, fruehereRunden: [A, B, C] };
    assert.equal(rundenZahl(mit), 3);
    assert.equal(anforderungNoetig(mit), false);
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
    assert.equal(anforderungNoetig(d), false, 'keine vierte Anforderung');
  });
  test('Nicht lesbarer alter Stand: zaehlt vorsorglich, geht aber nicht ins Ledger', () => {
    const E = h('5');
    const nach = (aus) => lage({ commits: [E], laeufeJeCommit: { [E]: [] }, bereiche: [], pr: { head_sha: E }, fruehereRunden: [A, B, ...aus.bestaetigt], vorlaeufigeRunden: aus.vorlaeufig });
    // Lauf 1: C nicht lesbar (API-Fehler) -> im Zweifel dritte Runde, keine Anforderung.
    const eins = rundenAusAnforderungen([C], { [C]: null });
    assert.deepEqual(eins, { bestaetigt: [], vorlaeufig: [C] });
    assert.equal(rundenZahl(nach(eins)), 3);
    assert.equal(anforderungNoetig(nach(eins)), false);
    assert.deepEqual(bestaetigteRunden(nach(eins)).sort(), [A, B].sort(), 'ins Ledger nur Belegtes');
    // Lauf 2 liest C neu: nur ein Skip, also keine Runde, die Bremse ist frei.
    const zwei = rundenAusAnforderungen([C], { [C]: [CR_AUS_SKIP] });
    assert.deepEqual(zwei, { bestaetigt: [], vorlaeufig: [] });
    assert.equal(rundenZahl(nach(zwei)), 2);
    assert.equal(anforderungNoetig(nach(zwei)), true, 'ein einmaliger API-Fehler sperrt nicht dauerhaft');
  });
  test('Freigabe ohne bekannten Setzzeitpunkt bremst (im Zweifel verbraucht)', () => {
    const ohneZeit = vierte({ pr: { labels: ['review-ready', 'review-runde-frei'] } });
    assert.equal(freigabeVerbraucht(ohneZeit), true);
    assert.equal(anforderungNoetig(ohneZeit), false);
  });
  test('ROT mit Grund: Rundenbremse, auch nachdem das Label abgenommen ist', () => {
    for (const labels of [['review-ready'], []]) {
      const u = bewerte(vierte({ pr: { labels }, keinWarten: true }));
      assert.equal(u.state, 'failure');
      assert.match(u.description, /^Rundenbremse: 3 Runden erreicht/, labels.join() || 'ohne Label');
    }
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
    assert.equal(anforderungNoetig({ ...d, kommentare: [marke(C, 'github-actions[bot]')] }), false);
    // ... verbraucht keine Freigabe ...
    const frei = { ...d, pr: pr({ labels: ['review-ready', 'review-runde-frei'] }), freigabeGesetzt: Date.parse('2026-11-28T08:00:00Z'), kommentare: [marke(A, 'irgendwer')] };
    assert.equal(freigabeVerbraucht(frei), false);
    assert.equal(freigabeVerbraucht({ ...frei, kommentare: [marke(A, 'Verse-Base')] }), true);
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
