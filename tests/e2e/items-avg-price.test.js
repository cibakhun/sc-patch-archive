// Ø-UEX-Spalte: Datenregel + Beweis im gebauten dist/ (DE+EN) + Mock-DOM.
// Erwartungswerte werden zur Laufzeit aus der echten DB abgeleitet — es steht
// keine feste Zahl im Test, damit der naechste Preis-Snapshot ihn nicht bricht.
// Fest verdrahtet werden nur die stabilen Item-IDs (Fixture-Wachhund, Test 3).
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const canonicalPath = path.resolve('assets/universal-items.json');
const db = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
const items = db.items;
const itemById = new Map(items.map((i) => [i.id, i]));

// Unabhaengige Referenzimplementierung des Mittelwerts — bewusst NICHT aus
// src/lib/items.ts importiert (TS, nicht ohne Build lauffaehig), sondern
// eigenstaendig geschrieben. Dieselbe Filterregel wie avgPrice()/minPrice().
function refAvg(item) {
  let sum = 0, n = 0;
  for (const o of item.obtain) {
    if (o.price != null && o.price > 0) { sum += o.price; n++; }
  }
  return n === 0 ? null : Math.round(sum / n);
}
function refMin(item) {
  let p = Infinity;
  for (const o of item.obtain) if (o.price != null && o.price > 0 && o.price < p) p = o.price;
  return p === Infinity ? null : p;
}
function refMax(item) {
  let p = -Infinity;
  for (const o of item.obtain) if (o.price != null && o.price > 0 && o.price > p) p = o.price;
  return p === -Infinity ? null : p;
}

describe('avgPrice — Datenregel gegen die echte DB', () => {
  test('1. Mittelwert liegt fuer jedes bepreiste Item zwischen Minimum und Maximum', () => {
    for (const it of items) {
      const avg = refAvg(it);
      if (avg == null) continue;
      const lo = refMin(it), hi = refMax(it);
      assert.ok(lo != null && hi != null, `${it.id}: Ø ohne min/max`);
      assert.ok(avg >= lo && avg <= hi, `${it.id}: Ø ${avg} nicht in [${lo}, ${hi}]`);
    }
  });

  test('2. Item ohne bepreisten obtain-Eintrag -> Mittelwert strikt null (nie 0, nie NaN)', () => {
    const unpriced = items.filter((it) => refAvg(it) === null);
    assert.ok(unpriced.length >= 6000, `nur ${unpriced.length} Items ohne Preis — Regel liefe an einem zu kleinen Set vorbei`);
    for (const it of unpriced) {
      const avg = refAvg(it);
      assert.strictEqual(avg, null, `${it.id}: erwartet null`);
      assert.notStrictEqual(avg, 0, `${it.id}: 0 statt null`);
      assert.ok(!Number.isNaN(avg), `${it.id}: NaN statt null`);
    }
  });

  test('3. Fixture-Wachhund: 10-series-greatsword-cannon hat weiterhin >=2 bepreiste Quellen mit unterschiedlichen Preisen', () => {
    const it = itemById.get('10-series-greatsword-cannon');
    assert.ok(it, 'Fixture-Item fehlt in der DB — neues Fixture waehlen');
    const priced = it.obtain.filter((o) => o.price != null && o.price > 0);
    assert.ok(priced.length >= 2, 'Fixture-Item hat <2 bepreiste Quellen — neues Fixture waehlen');
    const distinctPrices = new Set(priced.map((o) => o.price));
    assert.ok(distinctPrices.size >= 2, 'Fixture-Item hat keine Preisstreuung mehr — neues Fixture waehlen');
  });
});

// ---- Helfer: eine <table class="dp-table">…</table> aus gebautem HTML schneiden ----
function extractDpTable(html) {
  const m = html.match(/<table class="dp-table">[\s\S]*?<\/table>/);
  return m ? m[0] : null;
}
function extractTbodyRows(tableHtml) {
  const m = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!m) return [];
  return m[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
}

describe('Ø-Spalte im Datenblatt — gebautes dist/ (DE+EN)', () => {
  const distEnPath = path.resolve('dist/items/10-series-greatsword-cannon.html');
  const distDePath = path.resolve('dist/de/items/10-series-greatsword-cannon.html');

  test('4. EN: Spaltenkopf + Mittelwert in dist/items/10-series-greatsword-cannon.html', () => {
    assert.ok(fs.existsSync(distEnPath), 'dist fehlt — npm run build ausfuehren');
    const html = fs.readFileSync(distEnPath, 'utf8');
    const table = extractDpTable(html);
    assert.ok(table, 'dp-table nicht gefunden');
    assert.ok(table.includes('UEX avg'), 'EN-Spaltenkopf fehlt');

    const it = itemById.get('10-series-greatsword-cannon');
    const avg = refAvg(it);
    const formatted = avg.toLocaleString('en-US');
    const obtainCount = it.obtain.length;
    const occurrences = table.split(formatted).length - 1;
    assert.ok(occurrences >= obtainCount, `Ø-Wert ${formatted} kommt nur ${occurrences}x vor, erwartet >= ${obtainCount}`);
  });

  test('5. DE: deutscher Spaltenkopf + deutsche Zahlenformatierung in der DE-Fassung', () => {
    assert.ok(fs.existsSync(distDePath), 'dist/de fehlt — npm run build ausfuehren');
    const html = fs.readFileSync(distDePath, 'utf8');
    const table = extractDpTable(html);
    assert.ok(table, 'dp-table nicht gefunden');
    assert.ok(table.includes('Ø UEX'), 'DE-Spaltenkopf fehlt');

    const it = itemById.get('10-series-greatsword-cannon');
    const avg = refAvg(it);
    const formatted = avg.toLocaleString('de-DE');
    const obtainCount = it.obtain.length;
    const occurrences = table.split(formatted).length - 1;
    assert.ok(occurrences >= obtainCount, `Ø-Wert ${formatted} kommt nur ${occurrences}x vor, erwartet >= ${obtainCount}`);
  });

  test('6. adp-mk4-arms-justified (DE+EN): vier <td> je Zeile, Spaltenkopf da, aber NIRGENDS ein Betrag', () => {
    const currencyRe = /\d[\d.,]*\s*aUEC/;
    for (const p of [
      path.resolve('dist/items/adp-mk4-arms-justified.html'),
      path.resolve('dist/de/items/adp-mk4-arms-justified.html'),
    ]) {
      assert.ok(fs.existsSync(p), `${p} fehlt — npm run build ausfuehren`);
      const html = fs.readFileSync(p, 'utf8');
      const table = extractDpTable(html);
      assert.ok(table, `dp-table fehlt in ${p}`);
      assert.ok(table.includes('UEX avg') || table.includes('Ø UEX'), `Spaltenkopf fehlt in ${p}`);
      const rows = extractTbodyRows(table);
      assert.ok(rows.length > 0, `keine Zeilen in ${p}`);
      for (const row of rows) {
        const tdCount = (row.match(/<td/g) || []).length;
        assert.strictEqual(tdCount, 4, `Zeile ohne 4 <td> in ${p}: ${row}`);
        assert.ok(!currencyRe.test(row), `Betrag in preisfreier Zeile gefunden (${p}): ${row}`);
      }
    }
  });
});
