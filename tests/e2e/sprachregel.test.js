// Sprachregel (docs/sprachregel.md): Die Tabellen fuer Wertnamen, Pfadglieder,
// Fundhinweise und Ortsarten decken die Daten vollstaendig ab, und jeder
// Eintrag hat noch einen Anlass in den Daten.
//
// Anlass 24.11.2026 (UX-Audit, Heuristik B02): Auf den deutschen
// Bauplan-Seiten standen „Recoil Smoothness", „Max Temp" und Pfade wie
// „Vehiclegear / Weapons / Ballistic", auf 952 deutschen Itemblaettern der
// eigene Fundhinweis auf Englisch. Die Uebersetzung liegt in Tabellen; kommt
// mit neuen Spieldaten ein Wertname, ein Pfadglied, ein Fundhinweis oder eine
// Ortsart dazu, bliebe er auf /de/ still englisch. Dieser Test reisst dann
// und nennt den fehlenden Eintrag. Umgekehrt reisst er, wenn ein Eintrag
// keinen Anlass mehr hat (Zombie-Waechter wie bei den Toren).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { absatzSprache, absaetze, absatzFalschesLang } from '../../scripts/lib/textregeln.mjs';

async function bundle(entries) {
  const { buildSync } = await import('esbuild');
  const src = entries.map((e) => `export * from ${JSON.stringify(path.resolve(e))};`).join('\n');
  const out = buildSync({
    stdin: { contents: src, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprachregel-'));
  const file = path.join(dir, 'mod.mjs');
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

const M = await bundle(['src/i18n/craftingWerte.ts', 'src/i18n/lootText.ts', 'src/i18n/spieltext.ts', 'src/i18n/vehicleText.ts']);
const CRAFT = JSON.parse(fs.readFileSync('assets/crafting-db.json', 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync('assets/universal-items.json', 'utf8')).items;

const stats = new Set();
const glieder = new Set();
for (const b of CRAFT.blueprints) {
  for (const g of String(b.category || '').split(' / ').filter(Boolean)) glieder.add(g);
  for (const ing of b.ingredients || []) for (const q of ing.quality_effects || []) stats.add(q.stat);
}
const hinweise = new Set(ITEMS.map((i) => i.guide).filter(Boolean));
const orte = new Set(ITEMS.flatMap((i) => (i.obtain || []).filter((o) => o.kind === 'loot' && !o.ort).map((o) => o.loc)));

function fehlend(daten, tabelle) {
  return [...daten].filter((x) => !Object.prototype.hasOwnProperty.call(tabelle, x)).sort();
}
function ohneAnlass(daten, tabelle) {
  return Object.keys(tabelle).filter((k) => !daten.has(k)).sort();
}

describe('Sprachregel: Tabellen decken die Daten ab', () => {
  test('Selbstauskunft: es gibt etwas zu pruefen', () => {
    // Klinken (Grundsatz 5), gemessen 24.11.2026: 25 Wertnamen, 52
    // Pfadglieder, 46 Fundhinweise, 70 Ortsarten.
    assert.ok(stats.size >= 20, `nur ${stats.size} Wertnamen in crafting-db.json`);
    assert.ok(glieder.size >= 40, `nur ${glieder.size} Pfadglieder`);
    assert.ok(hinweise.size >= 40, `nur ${hinweise.size} Fundhinweise`);
    assert.ok(orte.size >= 60, `nur ${orte.size} Ortsarten`);
  });

  test('jeder Wertname hat eine deutsche Fassung', () => {
    assert.deepEqual(fehlend(stats, M.WERTNAMEN_DE), [], 'in WERTNAMEN_DE (src/i18n/craftingWerte.ts) ergaenzen');
  });

  test('jedes Pfadglied hat eine deutsche Fassung', () => {
    assert.deepEqual(fehlend(glieder, M.PFADGLIEDER_DE), [], 'in PFADGLIEDER_DE (src/i18n/craftingWerte.ts) ergaenzen');
  });

  test('jeder Fundhinweis hat eine deutsche Fassung', () => {
    assert.deepEqual(fehlend(hinweise, M.HINWEISE_DE).map((h) => h.slice(0, 80)), [], 'in HINWEISE_DE (src/i18n/lootText.ts) ergaenzen');
  });

  test('jede Ortsart der eigenen Recherche hat eine deutsche Fassung', () => {
    assert.deepEqual(fehlend(orte, M.ORTE_DE), [], 'in ORTE_DE (src/i18n/lootText.ts) ergaenzen');
  });

  test('jeder Ton-Chip der Crafting-Karten hat eine deutsche Fassung', async () => {
    const C = await bundle(['src/lib/crafting.ts']);
    const toene = new Set(C.blueprints.map((b) => C.blueprintSpecs(b)?.tone).filter(Boolean));
    assert.ok(toene.size >= 5, `nur ${toene.size} Toene`);
    const fehlt = [...toene].filter((t) => !(t in M.KLASSEN_DE) && !(t in M.PFADGLIEDER_DE)).sort();
    assert.deepEqual(fehlt, [], 'in KLASSEN_DE (src/i18n/craftingWerte.ts) ergaenzen');
    const ohne = Object.keys(M.KLASSEN_DE).filter((k) => !toene.has(k)).sort();
    assert.deepEqual(ohne, [], 'KLASSEN_DE ohne Anlass (Zombie-Waechter)');
  });

  test('kein Eintrag ohne Anlass in den Daten (Zombie-Waechter)', () => {
    assert.deepEqual(ohneAnlass(stats, M.WERTNAMEN_DE), [], 'WERTNAMEN_DE');
    assert.deepEqual(ohneAnlass(glieder, M.PFADGLIEDER_DE), [], 'PFADGLIEDER_DE');
    assert.deepEqual(ohneAnlass(hinweise, M.HINWEISE_DE).map((h) => h.slice(0, 80)), [], 'HINWEISE_DE');
    assert.deepEqual(ohneAnlass(orte, M.ORTE_DE), [], 'ORTE_DE');
  });

  test('die deutschen Fundhinweise sind deutsch', () => {
    const englisch = Object.values(M.HINWEISE_DE).filter((t) => absatzSprache(t) === 'en');
    assert.deepEqual(englisch, []);
    const gleich = Object.entries(M.HINWEISE_DE).filter(([en, de]) => en === de).map(([en]) => en.slice(0, 80));
    assert.deepEqual(gleich, [], 'Fundhinweis unuebersetzt');
  });
});

describe('Sprachregel: Helfer', () => {
  test('wertname/pfadname: deutsch auf DE, unveraendert auf EN, unbekanntes bleibt stehen', () => {
    assert.equal(M.wertname('Recoil Smoothness', 'de'), 'Rückstoßglättung');
    assert.equal(M.wertname('Recoil Smoothness', 'en'), 'Recoil Smoothness');
    assert.equal(M.pfadname('Vehiclegear / Weapons / Ballistic', 'de'), 'Schiffskomponenten / Waffen / Ballistisch');
    assert.equal(M.pfadname('Vehiclegear / Weapons / Ballistic', 'en'), 'Vehiclegear / Weapons / Ballistic');
    assert.equal(M.wertname('Neuer Wert', 'de'), 'Neuer Wert');
    assert.equal(M.gattung('Military', 'de'), 'Militär');
    assert.equal(M.gattung('Ballistic', 'de'), 'Ballistisch');
    assert.equal(M.gattung('Military', 'en'), 'Military');
  });

  test('vDescLang: eine deutsche Fassung, die woertlich der englische Text ist, ist englisch', () => {
    const roh = JSON.parse(fs.readFileSync('src/data/vehicles.json', 'utf8'));
    const liste = (Array.isArray(roh) ? roh : roh.vehicles || Object.values(roh)).filter((d) => d && typeof d === 'object');
    let gleich = 0;
    for (const d of liste) {
      const de = M.vDesc(d, 'de');
      if (!de) continue;
      const sprache = M.vDescLang(d, 'de');
      if (d.descriptionEn && de.trim() === String(d.descriptionEn).trim()) { gleich++; assert.equal(sprache, 'en', d.name); }
      if (absatzSprache(de) === 'en') assert.equal(sprache, 'en', `${d.name}: englischer Text, lang ${sprache}`);
    }
    assert.ok(gleich >= 1, 'kein Schiff mit gleicher Fassung gefunden — Test prueft nichts mehr');
  });

  test('displayName/altName: englischer Name in beiden Sprachen, deutscher als Zweitname (C4)', async () => {
    const I = await bundle(['src/lib/items.ts']);
    const mitDe = ITEMS.filter((i) => i.game?.nameDe && i.game.nameDe.trim() !== i.name);
    assert.ok(mitDe.length >= 2000, `nur ${mitDe.length} Items mit eigenem deutschem Namen`);
    for (const i of mitDe) {
      assert.equal(I.displayName(i, 'de'), i.name, i.id);
      assert.equal(I.displayName(i, 'en'), i.name, i.id);
      assert.equal(I.altName(i, 'de'), i.game.nameDe.trim(), i.id);
      assert.equal(I.altName(i, 'en'), i.game.nameDe.trim(), i.id);
    }
    const gleich = ITEMS.find((i) => i.game?.nameDe && i.game.nameDe.trim() === i.name);
    if (gleich) assert.equal(I.altName(gleich, 'de'), null, 'gleicher Name ist kein Zweitname');
  });

  test('fremdLang: nur wenn der Text nicht in der Sprache der Seite steht', () => {
    assert.equal(M.fremdLang('de', 'en'), 'en');
    assert.equal(M.fremdLang('de', 'de'), undefined);
    assert.equal(M.fremdLang('en', 'en'), undefined);
    assert.equal(M.fremdLang('en', 'de'), 'de');
    assert.equal(M.fremdLang('de', null), undefined);
  });
});

describe('Regel 12: Absatzsprache (verify:sprache)', () => {
  const EN = 'This item is found in the crates of the station and it can be looted with a ship.';
  const DE = 'Dieser Gegenstand liegt in den Kisten der Station und wird mit dem Schiff aus der Halle geholt.';

  test('absatzSprache: eindeutig englisch, eindeutig deutsch, sonst nichts', () => {
    assert.equal(absatzSprache(EN), 'en');
    assert.equal(absatzSprache(DE), 'de');
    assert.equal(absatzSprache('Arclight Pistol'), null, 'zu kurz');
    // Woerter beider Sprachen zaehlen nicht (Fehlalarm der ersten Messung auf /de/support.html).
    assert.equal(absatzSprache('Sag, was fehlt, was stört oder was du dir wünschst, wir lesen alles.'), null);
    // Ein englischer Eigenname im deutschen Satz macht ihn nicht englisch.
    assert.equal(absatzSprache('Calva Racing Helmet Year of the Rat — Helmets von Quirinus Tech, Star Citizen Alpha 4.10.3. An keinem bekannten Ingame-Terminal kaufbar.'), null);
  });

  test('absaetze: wirksames lang aus Element, Vorfahr oder Seite', () => {
    const html = `<html lang="de"><body><main>
      <p class="a">${EN}</p>
      <p class="b" lang="en">${EN}</p>
      <section lang="en"><ul><li class="c">${EN}</li></ul></section>
      <p class="d">${DE}</p>
      <p class="e"><span lang="en">${EN}</span></p>
      <script>var t = "${EN}";</script>
    </main></body></html>`;
    const r = absaetze(html, 'de').map((a) => `${a.klasse}:${a.sprache}/${a.lang}`);
    assert.deepEqual(r, ['a:en/de', 'b:en/en', 'c:en/en', 'd:de/de']);
  });

  test('absatzFalschesLang: leeres, drittes oder fehlendes lang ist ein Befund, Regionsangabe nicht (Review PR #442)', () => {
    const html = `<html lang="de"><body>
      <p class="leer" lang="">${EN}</p>
      <p class="fr" lang="fr">${EN}</p>
      <p class="region" lang="en-US">${EN}</p>
      <p class="ohne">${EN}</p>
      <p class="de">${DE}</p>
      <p class="en" lang="en">${EN}</p>
    </body></html>`;
    const befund = absaetze(html, 'de').filter(absatzFalschesLang).map((a) => a.klasse);
    assert.deepEqual(befund, ['leer', 'fr', 'ohne']);
  });

  test('absaetze: verschachtelte Absaetze gehoeren dem innersten', () => {
    const html = `<html lang="de"><body><table><tr><td class="aussen">kurz <p class="innen">${EN}</p></td></tr></table></body></html>`;
    assert.deepEqual(absaetze(html, 'de').map((a) => a.klasse), ['innen']);
  });
});
