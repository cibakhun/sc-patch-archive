// Prueft die gebauten Crafting-Seiten (dist/) — DE + EN — auf den
// Groesse/Grade/Ton-Chip (ul.cbp__spec). Plan 05-01 bewies den Pfad an den
// 57 Quantumdrive-Karten; Plan 05-02 rollt ihn auf alle 1594 Blueprints aus
// und ergaenzt die Ton-Ableitung aus dem Kategorie-Pfad fuer die 96
// Schiffswaffen (D-04). Zielzahlen siehe 05-02-PLAN.md, bei der Planung
// gegen die echten Dateien nachgerechnet und beim Ausfuehren erneut
// gemessen (node -e gegen assets/crafting-db.json + universal-items.json).
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const enHtml = fs.readFileSync(path.resolve('dist/topics/crafting.html'), 'utf8');
const deHtml = fs.readFileSync(path.resolve('dist/de/topics/crafting.html'), 'utf8');

// Nachgezogen am 07.08.2026 beim Zusammenfuehren mit staging: fuenf Blueprints
// haben ihre Einzelgroesse verloren — vier davon (broadspec, gvsr repeater,
// revenant gatling, tarantula gt-870 mark 3 cannon), weil staging fuer
// mehrdeutige Anzeigenamen jetzt `sizes[]`/`variants[]` fuehrt statt einer
// erfundenen Einzelgroesse, und `nightfall`, das aus dem Item-Katalog
// verschwunden ist. Alle fuenf zeigen nun nichts statt eines geratenen Wertes.
// Begruendung ausfuehrlich in scripts/verify-crafting-specs.mjs.
const TOTAL_SPEC_ROWS = 1513;
const TOTAL_TONE_CHIPS = 495;

/** Schneidet das <article class="cbp" …>…</article> heraus, das den Karten-
 * Namen <name> als Linktext im h3.cbp__name traegt. Wirft, wenn keine
 * Karte gefunden wird — der Test soll nicht stillschweigend das falsche
 * Fragment pruefen. Fuer eindeutige Namen genuegt der erste Treffer. */
function findCard(html, name) {
  const nameRe = new RegExp(`<h3 class="cbp__name"><a href="[^"]*">${name}</a></h3>`);
  const nameMatch = nameRe.exec(html);
  assert.ok(nameMatch, `Karte "${name}" nicht gefunden`);
  const artStart = html.lastIndexOf('<article', nameMatch.index);
  assert.ok(artStart !== -1, `kein umschliessendes <article> fuer "${name}"`);
  const artEnd = html.indexOf('</article>', nameMatch.index);
  assert.ok(artEnd !== -1, `kein schliessendes </article> fuer "${name}"`);
  return html.slice(artStart, artEnd + '</article>'.length);
}

/** Wie findCard(), aber fuer Namen, die mehrfach vorkommen (die gesperrten
 * Namensgruppen aus D-09) — liefert ALLE Kartenausschnitte mit diesem Namen,
 * damit jede einzelne Karte geprueft werden kann, nicht nur die erste. */
function findAllCards(html, name) {
  const nameRe = new RegExp(`<h3 class="cbp__name"><a href="[^"]*">${name}</a></h3>`, 'g');
  const cards = [];
  let m;
  while ((m = nameRe.exec(html))) {
    const artStart = html.lastIndexOf('<article', m.index);
    const artEnd = html.indexOf('</article>', m.index);
    assert.ok(artStart !== -1 && artEnd !== -1, `kein umschliessendes <article> fuer "${name}"`);
    cards.push(html.slice(artStart, artEnd + '</article>'.length));
  }
  return cards;
}

/** Alle Karten-Ausschnitte, deren sichtbare Kategorie-Wurzel (cbp__cat) exakt
 * `root` ist — Grundlage der Armour/Ammo-Gegenprobe zu SC3. Schneidet je
 * Karte, nicht die ganze Datei, damit ein Treffer anderswo auf der Seite
 * nichts ueber die betroffene Karte behauptet. */
function cardsWithCategoryRoot(html, root) {
  const articleRe = /<article\s+class="cbp"[^>]*>[\s\S]*?<\/article>/g;
  const cards = [];
  let m;
  while ((m = articleRe.exec(html))) {
    const catMatch = /<span class="cbp__cat">([^<]*)/.exec(m[0]);
    if (catMatch && catMatch[1] === root) cards.push(m[0]);
  }
  return cards;
}

function specChips(card) {
  const m = /<ul class="cbp__spec">([\s\S]*?)<\/ul>/.exec(card);
  if (!m) return null;
  const lis = [...m[1].matchAll(/<li([^>]*)>([^<]*)<\/li>/g)];
  return lis.map(([, attrs, text]) => ({
    tone: /class="tone"/.test(attrs),
    text,
  }));
}

// Froggys eigene Beispiele (05-01) plus die Referenzkarten dieses Plans:
// die drei zusaetzlichen game.class-Karten (Lotus, Cassandra, Cirrus) und die
// beiden Schiffswaffen, deren Ton NICHT aus game.class kommt, sondern aus dem
// Kategorie-Pfad (D-04) — sowie Agure als Beleg, dass Groesse 0 ein echter
// Wert ist, keine fehlende Angabe.
// Grade `null` heisst: diese Karte darf KEINEN Grade-Chip tragen. Seit dem
// 07.08.2026 erscheint der Grade nur bei den fuenf Bauteilarten, bei denen er
// im Spiel etwas unterscheidet (Kraftwerk, Kuehler, Schild, Radar,
// Quantenantrieb). Schiffswaffen fuehren in AttachDef.Grade ausnahmslos den
// Vorgabewert 1 -> "A"; ein Chip "Grade A" auf einer Dominance-1 Scattergun
// behauptet eine Einstufung, die es nicht gibt. Siehe GRADE_BEARING_TYPES in
// src/lib/crafting.ts.
const REFERENCE_CARDS = [
  ['Allegro', 'S4', 'A', 'Civilian'],
  ['Atlas', 'S1', 'A', 'Civilian'],
  ['Hemera', 'S2', 'A', 'Civilian'],
  ['Erebos', 'S3', 'A', 'Civilian'],
  ['Drift', 'S1', 'C', 'Stealth'],
  ['Lotus', 'S2', 'A', 'Civilian'],
  ['Cassandra', 'S2', 'A', 'Stealth'],
  ['Cirrus', 'S2', 'C', 'Stealth'],
  ['Agure', 'S0', 'D', 'Military'],
  // Schiffswaffen: Groesse und Ton ja, Grade nein.
  ['AD4B Ballistic Gatling', 'S4', null, 'Ballistic'],
  ['9-Series Longsword Cannon', 'S1', null, 'Ballistic'],
  ['Dominance-2 Scattergun', 'S2', null, 'Laser'],
];

// Die 10 Karten der 5 gesperrten Namensgruppen (D-09) — bleiben nach dem
// Ausrollen chiplos, obwohl vier der fuenf Gruppen (Powerplant/Cooler/Radar)
// ihre Chips erst durch DIESEN Plan bekaemen. Namen wie in crafting-db.json
// geschrieben (Gross-/Kleinschreibung ist fachlich, nicht kosmetisch).
const LOCKED_GROUPS = ['BroadSpec', 'Main Powerplant'];

for (const [label, html] of [['EN', enHtml], ['DE', deHtml]]) {
  describe(`Crafting-Karten Groesse/Grade/Ton (${label})`, () => {
    for (const [name, size, grade, tone] of REFERENCE_CARDS) {
      const gradeLabel = grade === null ? 'keinen Grade' : `Grade ${grade}`;
      test(`${name} traegt Groesse ${size}, ${gradeLabel}, Ton ${tone}`, () => {
        const card = findCard(html, name);
        const chips = specChips(card);
        assert.ok(chips, `${name}: keine ul.cbp__spec auf der Karte`);
        const expected = grade === null ? 2 : 3;
        assert.strictEqual(chips.length, expected, `${name}: erwartet ${expected} Chips, gefunden ${chips.length} (${chips.map((c) => c.text).join('/')})`);
        assert.strictEqual(chips[0].text, size);
        if (grade === null) {
          assert.ok(
            !chips.some((c) => !c.tone && /^[A-D]$/.test(c.text)),
            `${name}: traegt einen Grade-Chip, obwohl diese Bauteilart keinen aussagekraeftigen Grade hat`,
          );
        } else {
          assert.strictEqual(chips[1].text, grade);
        }
        const last = chips[chips.length - 1];
        assert.strictEqual(last.text, tone);
        assert.strictEqual(last.tone, true, `${name}: Ton-Chip ohne class="tone"`);
      });
    }

    test('Frontline traegt Groesse und Grade, aber keinen Ton-Chip', () => {
      const card = findCard(html, 'Frontline');
      const chips = specChips(card);
      assert.ok(chips, 'Frontline: keine ul.cbp__spec auf der Karte');
      assert.strictEqual(chips.length, 2, `Frontline: erwartet 2 Chips, gefunden ${chips.length}`);
      assert.ok(!chips.some((c) => c.tone), 'Frontline: darf keinen li.tone tragen');
    });

    test(`die Seite enthaelt genau ${TOTAL_SPEC_ROWS} Chip-Reihen (volle Ausrollung)`, () => {
      const count = (html.match(/class="cbp__spec"/g) || []).length;
      assert.strictEqual(count, TOTAL_SPEC_ROWS);
    });

    test(`die Seite enthaelt genau ${TOTAL_TONE_CHIPS} Ton-Chips (400 aus game.class + 96 aus dem Kategorie-Pfad)`, () => {
      const count = (html.match(/class="tone"/g) || []).length;
      assert.strictEqual(count, TOTAL_TONE_CHIPS);
    });

    for (const name of LOCKED_GROUPS) {
      test(`beide Karten "${name}" (gesperrte Namensgruppe, D-09) bleiben chiplos`, () => {
        const cards = findAllCards(html, name);
        assert.strictEqual(cards.length, 2, `${name}: erwartet 2 Karten, gefunden ${cards.length}`);
        for (const [i, card] of cards.entries()) {
          assert.strictEqual(specChips(card), null, `${name} Karte ${i + 1}: darf keine ul.cbp__spec tragen`);
        }
      });
    }

    test('keine Armour-Karte traegt einen Ton-Chip (Gegenprobe zu SC3, je Kartenausschnitt)', () => {
      const cards = cardsWithCategoryRoot(html, 'Armour');
      assert.strictEqual(cards.length, 913, `Armour-Karten: erwartet 913, gefunden ${cards.length}`);
      const withTone = cards.filter((c) => c.includes('class="tone"'));
      assert.strictEqual(withTone.length, 0, `${withTone.length} Armour-Karten tragen dennoch einen Ton-Chip`);
    });

    test('keine Ammo-Karte traegt einen Ton-Chip (Gegenprobe zu SC3, je Kartenausschnitt)', () => {
      const cards = cardsWithCategoryRoot(html, 'Ammo');
      assert.strictEqual(cards.length, 36, `Ammo-Karten: erwartet 36, gefunden ${cards.length}`);
      const withTone = cards.filter((c) => c.includes('class="tone"'));
      assert.strictEqual(withTone.length, 0, `${withTone.length} Ammo-Karten tragen dennoch einen Ton-Chip`);
    });

    test('kein Chip in einer Chip-Reihe ist leer oder besteht nur aus einem Gedankenstrich', () => {
      const rows = [...html.matchAll(/<ul class="cbp__spec">([\s\S]*?)<\/ul>/g)];
      assert.ok(rows.length > 0, 'keine einzige ul.cbp__spec auf der Seite gefunden');
      for (const [, inner] of rows) {
        const lis = [...inner.matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map(([, text]) => text);
        assert.ok(lis.length > 0, 'eine Chip-Reihe ohne li gefunden');
        for (const text of lis) {
          assert.ok(text.trim().length > 0, 'leeres <li> in einer Chip-Reihe gefunden');
          assert.notStrictEqual(text.trim(), '—', 'Gedankenstrich-<li> in einer Chip-Reihe gefunden');
        }
      }
    });
  });
}

describe('Filter Groesse und Grade in der Seitenleiste (05-03, DE+EN)', () => {
  for (const [label, html] of [['EN', enHtml], ['DE', deHtml]]) {
    // Sieben statt acht seit dem 07.08.2026: S7 hatte genau einen Vertreter
    // (tarantula gt-870 mark 3 cannon), und der fuehrt auf staging jetzt
    // `sizes[]` statt einer Einzelgroesse. Ein Ankreuzfeld ohne einen einzigen
    // Treffer soll es nicht geben — die Liste wird aus den Daten gebildet.
    test(`${label}: sieben Ankreuzfelder cdb-size mit den Werten 0-6`, () => {
      const values = [...html.matchAll(/<input[^>]*class="cdb-size"[^>]*value="(\d+)"/g)].map(([, v]) => v);
      assert.strictEqual(values.length, 7, `${label}: erwartet 7 cdb-size-Ankreuzfelder, gefunden ${values.length}`);
      assert.deepStrictEqual(values.map(Number).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
    });

    test(`${label}: vier Ankreuzfelder cdb-grade mit den Werten A-D`, () => {
      const values = [...html.matchAll(/<input[^>]*class="cdb-grade"[^>]*value="([A-D])"/g)].map(([, v]) => v);
      assert.strictEqual(values.length, 4, `${label}: erwartet 4 cdb-grade-Ankreuzfelder, gefunden ${values.length}`);
      assert.deepStrictEqual(values.sort(), ['A', 'B', 'C', 'D']);
    });
  }

  test('EN traegt die Filter-Ueberschrift "Size", DE "Größe"; beide tragen "Grade"', () => {
    assert.ok(/<h4>Size<\/h4>/.test(enHtml), 'EN: Ueberschrift "Size" nicht gefunden');
    assert.ok(/<h4>Größe<\/h4>/.test(deHtml), 'DE: Ueberschrift "Größe" nicht gefunden');
    assert.ok(/<h4>Grade<\/h4>/.test(enHtml), 'EN: Ueberschrift "Grade" nicht gefunden');
    assert.ok(/<h4>Grade<\/h4>/.test(deHtml), 'DE: Ueberschrift "Grade" nicht gefunden');
  });

  test('Skript-Tag fuer /assets/crafting-app.js traegt einen sha1-Cache-Bust (>= 6 Hex-Ziffern), DE+EN', () => {
    for (const [label, html] of [['EN', enHtml], ['DE', deHtml]]) {
      const m = /src="\/assets\/crafting-app\.js\?v=([0-9a-f]{6,})"/.exec(html);
      assert.ok(m, `${label}: kein sha1-Cache-Bust am Skript-Tag gefunden`);
    }
  });
});

describe('DE/EN liefern identische Zaehlwerte (D-07, ein Koerper)', () => {
  test('Chip-Reihen, Ton-Chips und Armour/Ammo-Ton-Nullen stimmen zwischen DE und EN ueberein', () => {
    const specCountEn = (enHtml.match(/class="cbp__spec"/g) || []).length;
    const specCountDe = (deHtml.match(/class="cbp__spec"/g) || []).length;
    assert.strictEqual(specCountEn, specCountDe, 'Chip-Reihen weichen zwischen EN und DE ab');
    assert.strictEqual(specCountEn, TOTAL_SPEC_ROWS);

    const toneCountEn = (enHtml.match(/class="tone"/g) || []).length;
    const toneCountDe = (deHtml.match(/class="tone"/g) || []).length;
    assert.strictEqual(toneCountEn, toneCountDe, 'Ton-Chips weichen zwischen EN und DE ab');
    assert.strictEqual(toneCountEn, TOTAL_TONE_CHIPS);

    const armourToneEn = cardsWithCategoryRoot(enHtml, 'Armour').filter((c) => c.includes('class="tone"')).length;
    const armourToneDe = cardsWithCategoryRoot(deHtml, 'Armour').filter((c) => c.includes('class="tone"')).length;
    assert.strictEqual(armourToneEn, 0);
    assert.strictEqual(armourToneDe, 0);

    const ammoToneEn = cardsWithCategoryRoot(enHtml, 'Ammo').filter((c) => c.includes('class="tone"')).length;
    const ammoToneDe = cardsWithCategoryRoot(deHtml, 'Ammo').filter((c) => c.includes('class="tone"')).length;
    assert.strictEqual(ammoToneEn, 0);
    assert.strictEqual(ammoToneDe, 0);
  });
});
