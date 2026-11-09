// Auswahl des GHCR-Aufraeumens (.github/scripts/ghcr-aufraeumen.mjs).
//
// Anlass 09.11.2026: das alte Aufraeumen ("die 10 neuesten bleiben") zaehlte
// die Vorschau-Images mit und loeschte das Image des vorigen Live-Stands im
// selben Lauf, der den neuen auslieferte. Hier die Zusagen an Listen, wie die
// Packages-API sie liefert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auswahl, MAX_LOESCHEN } from '../../.github/scripts/ghcr-aufraeumen.mjs';

let naechsteId = 1;
const hash = (n) => n.toString(16).padStart(40, '0');
const zeit = (tag, stunde = 0) => new Date(Date.UTC(2026, 10, 1) + tag * 864e5 + stunde * 36e5).toISOString();
const version = (tags, tag, stunde) => ({ id: naechsteId++, name: `sha256:${hash(naechsteId)}`, created_at: zeit(tag, stunde), metadata: { container: { tags } } });
const tagsAus = (liste) => liste.map((v) => v.metadata.container.tags.join(','));

// Das Paket am 09.11.2026 vor dem Release, nachgestellt: ein Live-Image vom
// 03.11. (latest), danach 21 Vorschau-Images, dann das neue Live-Image.
function lageAm09() {
  const liste = [version([hash(0x6bb4)], 2)];
  for (let i = 0; i < 21; i++) liste.push(version([`staging-${hash(0x5000 + i)}`], 3, i * 3));
  liste.at(-1).metadata.container.tags.push('staging');
  liste.push(version([hash(0x6c13), 'latest'], 8));
  return liste;
}

test('das vorige Live-Image bleibt, auch wenn mehr als zehn Vorschau-Images dazwischen liegen', () => {
  const a = auswahl(lageAm09(), { live: 5, staging: 10 });
  assert.equal(a.abbruch, undefined);
  const bleibt = tagsAus(a.bleibt);
  assert.ok(bleibt.includes(hash(0x6bb4)), 'voriges Live-Image muss bleiben');
  assert.ok(bleibt.includes(`${hash(0x6c13)},latest`));
  assert.equal(a.zahlen.live, 2);
  assert.equal(a.zahlen.staging, 21);
  assert.equal(a.weg.length, 11, 'die elf aeltesten Vorschau-Images fallen');
  assert.ok(a.weg.every((v) => v.metadata.container.tags[0].startsWith('staging-')));
  assert.ok(bleibt.some((t) => t.endsWith(',staging')), 'das Image mit Tag staging bleibt');
});

test('von den Live-Images bleiben die neuesten, aeltere fallen', () => {
  const liste = [];
  for (let i = 0; i < 8; i++) liste.push(version([hash(0x100 + i)], i));
  const a = auswahl(liste, { live: 5, staging: 10 });
  assert.deepEqual(tagsAus(a.weg).sort(), [hash(0x100), hash(0x101), hash(0x102)].sort());
  assert.equal(a.behalten.live, 5);
});

test('latest, staging und der geschonte Commit bleiben auch jenseits der Anzahl', () => {
  const liste = [];
  liste.push(version([hash(0x1), 'latest'], 0));
  liste.push(version([`staging-${hash(0x2)}`, 'staging'], 0, 1));
  liste.push(version([hash(0x3)], 0, 2));
  for (let i = 0; i < 3; i++) liste.push(version([hash(0x10 + i)], 1 + i));
  for (let i = 0; i < 3; i++) liste.push(version([`staging-${hash(0x20 + i)}`], 1 + i, 1));
  const a = auswahl(liste, { live: 1, staging: 1, schonen: [hash(0x3)] });
  const weg = tagsAus(a.weg);
  assert.ok(!weg.includes(`${hash(0x1)},latest`));
  assert.ok(!weg.includes(`staging-${hash(0x2)},staging`));
  assert.ok(!weg.includes(hash(0x3)));
  assert.deepEqual(weg.sort(), [hash(0x10), hash(0x11), `staging-${hash(0x20)}`, `staging-${hash(0x21)}`].sort());
});

test('unbekannte Tags fasst es nicht an', () => {
  const liste = [version(['v1.2.3'], 0), version(['bot-abc'], 0, 1)];
  for (let i = 0; i < 3; i++) liste.push(version([hash(0x30 + i)], 1 + i));
  const a = auswahl(liste, { live: 1, staging: 1 });
  assert.equal(a.zahlen.sonst, 2);
  assert.deepEqual(tagsAus(a.weg).sort(), [hash(0x30), hash(0x31)].sort());
});

test('Versionen ohne Tag fallen nur, wenn sie deutlich aelter sind als alles Bleibende', () => {
  const liste = [];
  const alt = version([], 0);
  liste.push(alt);
  liste.push(version([hash(0x40)], 3));
  const teilDesBleibenden = version([], 2, 23.5); // eine halbe Stunde vor dem Index
  liste.push(teilDesBleibenden);
  const a = auswahl(liste, { live: 1, staging: 1 });
  assert.deepEqual(a.weg.map((v) => v.id), [alt.id]);
  assert.ok(a.bleibt.includes(teilDesBleibenden));
});

test('ohne Live-Version oder mit kaputten Angaben wird nichts geloescht', () => {
  const nurStaging = [];
  for (let i = 0; i < 15; i++) nurStaging.push(version([`staging-${hash(0x60 + i)}`], i));
  assert.match(auswahl(nurStaging).abbruch, /keine Live-Version/);
  assert.equal(auswahl(nurStaging).weg, undefined);

  const kaputt = [version([hash(0x80)], 1), { id: 999, name: 'x', created_at: 'gestern', metadata: { container: { tags: [hash(0x81)] } } }];
  assert.match(auswahl(kaputt).abbruch, /created_at/);
  assert.match(auswahl([version([hash(0x90)], 1)], { live: 0 }).abbruch, /ungueltige Anzahl/);
});

test('hoechstens MAX_LOESCHEN je Lauf, die aeltesten zuerst', () => {
  const viele = [version([hash(0x70)], 400)];
  for (let i = 0; i < MAX_LOESCHEN + 20; i++) viele.push(version([`staging-${hash(0x1000 + i)}`], 0, i));
  const a = auswahl(viele, { live: 5, staging: 10 });
  assert.equal(a.weg.length, MAX_LOESCHEN);
  assert.equal(a.spaeter, 10);
  assert.equal(a.weg[0].metadata.container.tags[0], `staging-${hash(0x1000)}`, 'das aelteste zuerst');
  assert.ok(!a.bleibt.some((v) => a.weg.includes(v)));
  assert.equal(a.bleibt.length, 11, 'bleibt zaehlt nur, was wirklich bleibt');
});

test('ein zusaetzliches Tag schuetzt auch ein altes Live- oder Vorschau-Image', () => {
  const liste = [];
  liste.push(version([hash(0x200), 'rueckweg'], 0));
  liste.push(version([`staging-${hash(0x201)}`, 'pruefen'], 0, 1));
  for (let i = 0; i < 3; i++) liste.push(version([hash(0x210 + i)], 1 + i));
  for (let i = 0; i < 3; i++) liste.push(version([`staging-${hash(0x220 + i)}`], 1 + i, 1));
  const a = auswahl(liste, { live: 1, staging: 1 });
  const weg = tagsAus(a.weg);
  assert.ok(!weg.includes(`${hash(0x200)},rueckweg`), 'Live-Image mit Zusatz-Tag bleibt');
  assert.ok(!weg.includes(`staging-${hash(0x201)},pruefen`), 'Vorschau-Image mit Zusatz-Tag bleibt');
  assert.deepEqual(weg.sort(), [hash(0x210), hash(0x211), `staging-${hash(0x220)}`, `staging-${hash(0x221)}`].sort());
});
