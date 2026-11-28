// Haelt das Urteil von verify:action-pins fest, ohne Netz und ohne git.
//
// verify:action-pins laeuft auf Schiene B (holt die Action-Repos mit git) und
// in pr-check.yml, nie im Auslieferungs-Tor. Was hier im Tor laeuft, ist der
// Leser fuer die uses-Zeilen (pinsAusText), der Versionsvergleich und das
// Urteil je Pin, dazu die Zahl der Pins im Repository gegen die Klinke.
//
// Die SHAs in diesem Test sind SYNTHETISCH.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinsAusText, versionPasst, urteil, KLINKE } from '../../scripts/verify-action-pins.mjs';
import { WORKFLOW_VORLAGEN } from '../../scripts/lib/workflow-vorlagen.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = 'a'.repeat(40);

test('pinsAusText: Repo, SHA und Version, Unterpfad und Kommentarzeilen', () => {
  const text = [
    'steps:',
    `  - uses: actions/checkout@${A} # v7.0.1`,
    `      uses: github/codeql-action/init@${A}   # v4.31.2`,
    `  # - uses: evil/action@${A} # v1`,
    '  - uses: ./.github/workflows/build-site-image.yml',
    '  - uses: docker://alpine:3',
    `  - uses: 'docker/login-action@${A}'`,
    '  - uses: actions/setup-node@v4',
  ].join('\r\n');
  const p = pinsAusText(text);
  assert.deepEqual(p.map((x) => [x.zeile, x.repo, x.sha, x.version]), [
    [2, 'actions/checkout', A, 'v7.0.1'],
    [3, 'github/codeql-action', A, 'v4.31.2'],
    [7, 'docker/login-action', A, null],
    [8, 'actions/setup-node', 'v4', null],
  ]);
});

test('versionPasst: genaue Version oder Hauptversion, sonst nicht', () => {
  assert.equal(versionPasst('v7.0.1', ['v7', 'v7.0.1']), true);
  assert.equal(versionPasst('v4', ['v4.4.0']), true);
  assert.equal(versionPasst('v4', ['v5.0.1']), false);
  assert.equal(versionPasst('v4.4', ['v4.40.0']), false);
});

test('urteil: Commit ausserhalb aller Zweige und Tags ist FEHLER', () => {
  const pin = { ref: `actions/checkout@${A}`, repo: 'actions/checkout', sha: A, version: 'v7.0.1' };
  const u = urteil(pin, { vorhanden: false, tags: [] }, 'x.yml:3');
  assert.equal(u.fehler.length, 1);
  assert.match(u.fehler[0], /^x\.yml:3: .* liegt auf keinem Zweig und keinem Tag von actions\/checkout/);
  assert.deepEqual(u.warnungen, []);
});

test('urteil: falsche Version im Kommentar, fehlende Version, kein Tag sind WARNUNG', () => {
  const pin = { ref: `a/b@${A}`, repo: 'a/b', sha: A, version: 'v4' };
  const falsch = urteil(pin, { vorhanden: true, tags: ['v5.0.1'] }, 'o');
  assert.deepEqual(falsch.fehler, []);
  assert.match(falsch.warnungen[0], /Kommentar nennt v4, der Commit traegt v5\.0\.1/);
  const ohne = urteil({ ...pin, version: null }, { vorhanden: true, tags: ['v5.0.1'] }, 'o');
  assert.match(ohne.warnungen[0], /ohne Version im Kommentar/);
  const kein = urteil(pin, { vorhanden: true, tags: [] }, 'o');
  assert.match(kein.warnungen[0], /traegt keinen Tag/);
  const gut = urteil(pin, { vorhanden: true, tags: ['v4', 'v4.4.0'] }, 'o');
  assert.deepEqual([gut.fehler, gut.warnungen], [[], []]);
});

test('urteil: ein Tag statt SHA rutscht nicht durch', () => {
  const u = urteil({ ref: 'a/b@v4', repo: 'a/b', sha: 'v4', version: null }, { vorhanden: true, tags: [] }, 'o');
  assert.equal(u.fehler.length, 1);
});

test('im Repository: Pins und Repos ueber der Klinke, jeder Pin per SHA', () => {
  const dir = join(ROOT, '.github/workflows');
  const dateien = [
    ...readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => join(dir, f)),
    ...WORKFLOW_VORLAGEN.map((f) => join(ROOT, f)),
  ];
  const pins = dateien.flatMap((f) => pinsAusText(readFileSync(f, 'utf8')));
  assert.ok(pins.length >= KLINKE.pins, `${pins.length} Pins, Klinke ${KLINKE.pins}`);
  assert.ok(new Set(pins.map((p) => p.repo)).size >= KLINKE.repos);
  for (const p of pins) assert.match(p.sha, /^[0-9a-f]{40}$/, p.ref);
});
