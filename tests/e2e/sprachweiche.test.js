// verify:sprachweiche (scripts/verify-sprachweiche.mjs) gegen einen kleinen
// Muster-Bau: jede Zusicherung einmal gruen und einmal rot. Anlass: DE/EN auf
// Hangar, Advanced Loadout, Patch 4.10.3 und Chronik zeigte auf die
// Startseite (UX-Audit 24.11.2026, Task-Flows T9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SKRIPT = path.resolve('scripts/verify-sprachweiche.mjs');

/** Seite mit Umschalter (zweimal, wie Kopfleiste + Menue) und hreflang-Paar. */
function seite({ opt, de, en, art = 'langsw__opt' }) {
  const alt = de || en
    ? `<link rel="alternate" hreflang="de" href="https://verse-base.com${de}" /><link rel="alternate" hreflang="en" href="https://verse-base.com${en}" />`
    : '';
  const a = opt ? `<a class="${art}" href="${opt}" lang="x">X</a>` : '';
  return `<!doctype html><html><head>${alt}</head><body>${a}${a}</body></html>`;
}

function bau(seiten, { staging = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprachweiche-'));
  fs.writeFileSync(path.join(dir, 'build.json'), JSON.stringify({ staging }));
  for (const [p, html] of Object.entries(seiten)) {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), html);
  }
  return dir;
}

function lauf(dir, extra = []) {
  // Das erste Vorkommen eines Schalters gilt: extra ueberstimmt die Vorgaben.
  const r = spawnSync(process.execPath, [SKRIPT, '--dist', dir, ...extra, '--klinke-seiten', '4', '--klinke-eingehaengt', '2'], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: r.stdout + r.stderr };
}

const GUT = {
  'index.html': seite({ opt: '/de.html', de: '/de.html', en: '/' }),
  'de.html': seite({ opt: '/index.html', de: '/de.html', en: '/' }),
  'archiv.html': seite({ opt: '/de/archiv.html', de: '/de/archiv.html', en: '/archiv.html' }),
  'de/archiv.html': seite({ opt: '/archiv.html', de: '/de/archiv.html', en: '/archiv.html' }),
  'items/x.html': seite({ opt: '/de/items/x.html', art: 'dp-lang', de: '/de/items/x.html', en: '/items/x.html' }),
  'de/items/x.html': seite({ opt: '/items/x.html', art: 'dp-lang', de: '/de/items/x.html', en: '/items/x.html' }),
  'nur-en.html': seite({ opt: '/de.html' }),
};

test('gruen: jede Option aufs Gegenstueck, ohne Gegenstueck auf die Startseite', () => {
  const r = lauf(bau(GUT));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\[1\] 14 Optionen auf 7 Seiten .*: 12 aufs Gegenstueck, 0 daneben/);
  assert.match(r.out, /\[2\] 1 Seiten ohne Gegenstueck im Bau, 0 davon/);
});

test('[1] rot: Option zeigt auf die Startseite, obwohl das Gegenstueck im Bau steht', () => {
  const r = lauf(bau({ ...GUT, 'de/archiv.html': seite({ opt: '/index.html', de: '/de/archiv.html', en: '/archiv.html' }) }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[1\] \/de\/archiv\.html \(langsw\): zeigt auf \/index\.html statt aufs Gegenstueck \/archiv\.html — Startseite/);
});

test('[1] rot: Datenblatt-Umschalter auf eine andere Seite', () => {
  const r = lauf(bau({ ...GUT, 'items/x.html': seite({ opt: '/de/archiv.html', art: 'dp-lang', de: '/de/items/x.html', en: '/items/x.html' }) }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[1\] \/items\/x\.html \(dp-lang\): zeigt auf \/de\/archiv\.html/);
});

test('[2] rot: ohne Gegenstueck zeigt die Option ins Leere', () => {
  const r = lauf(bau({ ...GUT, 'nur-en.html': seite({ opt: '/de/nur-en.html' }) }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[2\] \/nur-en\.html \(langsw\): kein Gegenstueck im Bau, Option zeigt auf \/de\/nur-en\.html — steht nicht im Bau/);
});

test('[3] rot: hreflang nennt eine Seite, die nicht das Gegenstueck ist', () => {
  const r = lauf(bau({ ...GUT, 'archiv.html': seite({ opt: '/de/archiv.html', de: '/de/index.html', en: '/archiv.html' }) }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[3\] \/archiv\.html: hreflang="de" nennt https:\/\/verse-base\.com\/de\/index\.html, erwartet \/de\/archiv\.html/);
});

test('[1] rot: Option auf fremden Ursprung mit passendem Pfad (Review PR #426)', () => {
  const r = lauf(bau({ ...GUT, 'archiv.html': seite({ opt: 'https://example.org/de/archiv.html', de: '/de/archiv.html', en: '/archiv.html' }) }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[1\] \/archiv\.html \(langsw\): zeigt auf https:\/\/example\.org\/de\/archiv\.html statt aufs Gegenstueck \/de\/archiv\.html — fremder Ursprung/);
});

test('[1] gruen: eigener Ursprung als volle Adresse zaehlt wie der Pfad', () => {
  const r = lauf(bau({ ...GUT, 'archiv.html': seite({ opt: 'https://verse-base.com/de/archiv.html', de: '/de/archiv.html', en: '/archiv.html' }) }));
  assert.equal(r.code, 0, r.out);
});

test('[1] rot: einfach angefuehrte Attribute werden gelesen (Review PR #426)', () => {
  const html = `<!doctype html><html><head><link rel='alternate' hreflang='de' href='https://verse-base.com/de/archiv.html'><link rel=alternate hreflang=en href=https://verse-base.com/archiv.html></head><body><a class='langsw__opt' href='/de.html'>DE</a><a class='langsw__opt' href='/de.html'>DE</a></body></html>`;
  const r = lauf(bau({ ...GUT, 'archiv.html': html }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[1\] \/archiv\.html \(langsw\): zeigt auf \/de\.html statt aufs Gegenstueck \/de\/archiv\.html/);
  assert.doesNotMatch(r.out, /\[3\] \/archiv\.html/, 'hreflang in einfachen und ohne Anfuehrungszeichen gilt');
});

test('[3] rot: hreflang auf fremden Ursprung', () => {
  const r = lauf(bau({ ...GUT, 'archiv.html': seite({ opt: '/de/archiv.html', de: '/de/archiv.html', en: '/archiv.html' }).replace('https://verse-base.com/de/archiv.html', 'https://example.org/de/archiv.html') }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[3\] \/archiv\.html: hreflang="de" nennt https:\/\/example\.org\/de\/archiv\.html, erwartet \/de\/archiv\.html/);
});

test('Kommentare zaehlen nicht: ein auskommentierter falscher Umschalter bleibt ohne Befund', () => {
  const html = seite({ opt: '/de/archiv.html', de: '/de/archiv.html', en: '/archiv.html' }).replace('<body>', '<body><!-- <a class="langsw__opt" href="/de.html">alt</a> -->');
  const r = lauf(bau({ ...GUT, 'archiv.html': html }));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\[1\] 14 Optionen/);
});

test('[4] Vorschau-Bau: eingehaengte Seiten zaehlen, Klinke reisst ohne sie', () => {
  const mitHangar = {
    ...GUT,
    'hangar.html': seite({ opt: '/de/hangar.html', de: '/de/hangar.html', en: '/hangar.html' }),
    'de/hangar.html': seite({ opt: '/hangar.html', de: '/de/hangar.html', en: '/hangar.html' }),
  };
  const gruen = lauf(bau(mitHangar, { staging: true }));
  assert.equal(gruen.code, 0, gruen.out);
  assert.match(gruen.out, /\[4\] 2 eingehaengte Seiten mit Umschalter geprueft/);
  const rot = lauf(bau(GUT, { staging: true }));
  assert.equal(rot.code, 1, rot.out);
  assert.match(rot.out, /\[4\] nur 0 eingehaengte Seiten mit Umschalter, Klinke 2/);
});

test('Klinke: zu wenige Seiten mit Umschalter', () => {
  const r = lauf(bau(GUT), ['--klinke-seiten', '99']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /nur 7 Seiten mit Umschalter, Klinke 99/);
});
