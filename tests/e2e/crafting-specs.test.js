// Prueft die gebauten Crafting-Seiten (dist/) — DE + EN — auf den
// Groesse/Grade/Ton-Chip (ul.cbp__spec), der in Plan 05-01 auf die 57
// Quantumdrive-Karten kommt. Die 57er-Zahl ist die Ausrollsperre DIESES
// Plans: Plan 05-02 rollt auf die Gesamtzahl aller Blueprints aus, dann
// muss diese Konstante hier angehoben werden. Die Quantumdrives selbst sind
// von der Kollisionssperre (COLLIDING_NAMES in src/lib/crafting.ts) nicht
// betroffen — keine der 5 kollidierenden Namensgruppen liegt in dieser
// Kategorie — deshalb bleibt die 57/57-Erwartung hier unveraendert bestehen.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const enHtml = fs.readFileSync(path.resolve('dist/topics/crafting.html'), 'utf8');
const deHtml = fs.readFileSync(path.resolve('dist/de/topics/crafting.html'), 'utf8');

const QUANTUMDRIVE_CARDS = 57;

/** Schneidet das <article class="cbp" …>…</article> heraus, das den Karten-
 * Namen <name> als Linktext im h3.cbp__name traegt. Wirft, wenn keine oder
 * mehr als eine Karte gefunden wird — der Test soll nicht stillschweigend
 * das falsche Fragment pruefen. */
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

function specChips(card) {
  const m = /<ul class="cbp__spec">([\s\S]*?)<\/ul>/.exec(card);
  if (!m) return null;
  const lis = [...m[1].matchAll(/<li([^>]*)>([^<]*)<\/li>/g)];
  return lis.map(([, attrs, text]) => ({
    tone: /class="tone"/.test(attrs),
    text,
  }));
}

// Froggys eigene Beispiele (siehe 05-01-PLAN.md) — je Groesse, Grade, Ton.
const REFERENCE_CARDS = [
  ['Allegro', 'S4', 'A', 'Civilian'],
  ['Atlas', 'S1', 'A', 'Civilian'],
  ['Hemera', 'S2', 'A', 'Civilian'],
  ['Erebos', 'S3', 'A', 'Civilian'],
  ['Drift', 'S1', 'C', 'Stealth'],
];

for (const [label, html] of [['EN', enHtml], ['DE', deHtml]]) {
  describe(`Crafting-Karten Groesse/Grade/Ton (${label})`, () => {
    for (const [name, size, grade, tone] of REFERENCE_CARDS) {
      test(`${name} traegt Groesse ${size}, Grade ${grade}, Ton ${tone}`, () => {
        const card = findCard(html, name);
        const chips = specChips(card);
        assert.ok(chips, `${name}: keine ul.cbp__spec auf der Karte`);
        assert.strictEqual(chips.length, 3, `${name}: erwartet 3 Chips, gefunden ${chips.length}`);
        assert.strictEqual(chips[0].text, size);
        assert.strictEqual(chips[1].text, grade);
        assert.strictEqual(chips[2].text, tone);
        assert.strictEqual(chips[2].tone, true, `${name}: Ton-Chip ohne class="tone"`);
      });
    }

    test('Frontline traegt Groesse und Grade, aber keinen Ton-Chip', () => {
      const card = findCard(html, 'Frontline');
      const chips = specChips(card);
      assert.ok(chips, 'Frontline: keine ul.cbp__spec auf der Karte');
      assert.strictEqual(chips.length, 2, `Frontline: erwartet 2 Chips, gefunden ${chips.length}`);
      assert.ok(!chips.some((c) => c.tone), 'Frontline: darf keinen li.tone tragen');
    });

    test(`die Seite enthaelt genau ${QUANTUMDRIVE_CARDS} Chip-Reihen (nur Quantumdrives in diesem Plan)`, () => {
      const count = (html.match(/class="cbp__spec"/g) || []).length;
      assert.strictEqual(count, QUANTUMDRIVE_CARDS);
    });

    test('Lotus (Powerplant, ausserhalb der Ausrollsperre) traegt in diesem Plan noch keine Chip-Reihe', () => {
      const card = findCard(html, 'Lotus');
      const chips = specChips(card);
      assert.strictEqual(chips, null, 'Lotus: Plan 05-02 rollt erst hier aus, hier muss die Karte noch chiplos sein');
    });
  });
}
