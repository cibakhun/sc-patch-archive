// Ø-Preis: Datenregel + Beweis im gebauten dist/ (DE+EN) + Mock-DOM.
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

// ---- Helfer: die Bezugsquellen-Tabelle und die Ø-Zeile darueber ----
// UX-Audit D5 (24.11.2026): der Mittelwert steht EINMAL ueber der Tabelle
// („Ø Preis über alle Verkaufsstellen"), nicht mehr als Spalte in jeder Zeile;
// eine Preisspalte gibt es nur, wenn eine Zeile einen Preis hat.
function extractBezugTable(html) {
  const m = html.match(/<table class="dp-table dp-bezug"[\s\S]*?<\/table>/);
  return m ? m[0] : null;
}
function extractAvgLine(html) {
  const m = html.match(/<p class="dp-avg"[^>]*>([\s\S]*?)<\/p>/);
  return m ? sichtbarerText(m[1]) : null;
}
// Sichtbarer Text eines Schnipsels: Zeichen fuer Zeichen, alles zwischen < und >
// faellt weg. Kein Regex-Ersetzen, das verschachtelte Reste stehen liesse.
function sichtbarerText(schnipsel) {
  let text = '';
  let imTag = false;
  for (const c of schnipsel) {
    if (imTag) { if (c === '>') imTag = false; continue; }
    if (c === '<') { imTag = true; continue; }
    text += c;
  }
  return text;
}
function extractBodyRows(tableHtml) {
  return (tableHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) || [])
    .filter((r) => !/<th\b/.test(r));
}

describe('Ø-Preis im Datenblatt — gebautes dist/ (DE+EN)', () => {
  const distEnPath = path.resolve('dist/items/10-series-greatsword-cannon.html');
  const distDePath = path.resolve('dist/de/items/10-series-greatsword-cannon.html');

  for (const [nr, sprache, p, label, locale] of [
    ['4', 'EN', distEnPath, 'Avg price across all vendors:', 'en-US'],
    ['5', 'DE', distDePath, 'Ø Preis über alle Verkaufsstellen:', 'de-DE'],
  ]) {
    test(`${nr}. ${sprache}: Ø einmal über der Tabelle, keine Ø-Spalte in den Zeilen`, () => {
      assert.ok(fs.existsSync(p), 'dist fehlt — npm run build ausfuehren');
      const html = fs.readFileSync(p, 'utf8');
      const table = extractBezugTable(html);
      assert.ok(table, 'Bezugsquellen-Tabelle nicht gefunden');
      assert.ok(!/>(?:Avg price|Ø Preis)<\/th>/.test(table), 'Ø-Spalte steht wieder in der Tabelle');

      const it = itemById.get('10-series-greatsword-cannon');
      const avg = refAvg(it);
      const zeile = extractAvgLine(html);
      assert.ok(zeile, 'Ø-Zeile über der Tabelle fehlt');
      assert.ok(zeile.includes(label), `Ø-Zeile ohne „${label}": ${zeile}`);
      assert.ok(zeile.includes(`${avg.toLocaleString(locale)} aUEC`), `Ø-Wert ${avg.toLocaleString(locale)} fehlt in: ${zeile}`);
      assert.strictEqual((html.match(/class="dp-avg"/g) || []).length, 1, 'Ø-Zeile mehr als einmal');
    });
  }

  test('6. adp-mk4-arms-justified (DE+EN): ohne Preis keine Preisspalte, keine Ø-Zeile, kein Betrag, kein „—"', () => {
    const currencyRe = /\d[\d.,]*\s*aUEC/;
    for (const p of [
      path.resolve('dist/items/adp-mk4-arms-justified.html'),
      path.resolve('dist/de/items/adp-mk4-arms-justified.html'),
    ]) {
      assert.ok(fs.existsSync(p), `${p} fehlt — npm run build ausfuehren`);
      const html = fs.readFileSync(p, 'utf8');
      const table = extractBezugTable(html);
      assert.ok(table, `Bezugsquellen-Tabelle fehlt in ${p}`);
      assert.ok(!/>(?:Price|Preis|Avg price|Ø Preis)<\/th>/.test(table), `Preisspalte ohne Preis in ${p}`);
      assert.strictEqual(extractAvgLine(html), null, `Ø-Zeile ohne Preis in ${p}`);
      const rows = extractBodyRows(table);
      assert.ok(rows.length > 0, `keine Zeilen in ${p}`);
      for (const row of rows) {
        const tdCount = (row.match(/<td\b/g) || []).length;
        assert.strictEqual(tdCount, 2, `Zeile ohne 2 <td> (Ort, Art) in ${p}: ${row}`);
        assert.ok(!currencyRe.test(row), `Betrag in preisfreier Zeile gefunden (${p}): ${row}`);
        assert.ok(!row.includes('—'), `Leerwert „—" in preisfreier Zeile (${p}): ${row}`);
      }
    }
  });
});

// Findet GENAU die eine <tr>…</tr>-Zeile, die eine bestimmte Item-ID im href
// traegt. Wichtig: ueber alle Zeilen einzeln (global, nicht-ueberlappend)
// suchen statt lazy vom ersten <tr> im Dokument bis zur Fund-ID durchzugreifen
// — sonst reisst der Treffer quer durch alle vorangehenden Tabellenzeilen.
function findRowById(html, id) {
  const rows = html.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  return rows.find((r) => r.includes(`${id}.html`)) || null;
}

describe('Ø-Spalte in der Kategorie-Liste — gebautes dist/ (DE+EN)', () => {
  test('7. vehiclegear-weapons-guns (DE+EN): Spaltenkopf + Mittelwert in der Zeile von 10-series-greatsword-cannon', () => {
    const it = itemById.get('10-series-greatsword-cannon');
    const avg = refAvg(it);
    for (const [p, header, locale] of [
      [path.resolve('dist/items/category/vehiclegear-weapons-guns.html'), 'Avg price', 'en-US'],
      [path.resolve('dist/de/items/category/vehiclegear-weapons-guns.html'), 'Ø Preis', 'de-DE'],
    ]) {
      assert.ok(fs.existsSync(p), `${p} fehlt — npm run build ausfuehren`);
      const html = fs.readFileSync(p, 'utf8');
      assert.ok(html.includes(header), `Spaltenkopf fehlt in ${p}`);
      // Zeile ueber die ID im href finden — robust gegen den abweichenden
      // deutschen Anzeigenamen (nameDe), der in DE statt it.name gerendert wird.
      const row = findRowById(html, it.id);
      assert.ok(row, `Zeile fuer ${it.id} nicht gefunden in ${p}`);
      assert.ok(row.includes(avg.toLocaleString(locale)), `Ø-Wert fehlt in Zeile (${p})`);
    }
  });

  test('8. armour-arms (DE+EN): adp-mk4-arms-justified traegt in beiden Zahlenspalten den Gedankenstrich, keinen Betrag', () => {
    const currencyRe = /\d[\d.,]*\s*aUEC/;
    for (const p of [
      path.resolve('dist/items/category/armour-arms.html'),
      path.resolve('dist/de/items/category/armour-arms.html'),
    ]) {
      assert.ok(fs.existsSync(p), `${p} fehlt — npm run build ausfuehren`);
      const html = fs.readFileSync(p, 'utf8');
      const row = findRowById(html, 'adp-mk4-arms-justified');
      assert.ok(row, `Zeile fuer adp-mk4-arms-justified nicht gefunden in ${p}`);
      const muted = row.match(/dp-muted">—<\/span>/g) || [];
      assert.ok(muted.length >= 2, `erwartet >=2 Gedankenstriche in ${p}, gefunden ${muted.length}`);
      assert.ok(!currencyRe.test(row), `Betrag in preisfreier Zeile (${p}): ${row}`);
    }
  });

  test('9. Jede tbody-Zeile der Listen-Tabelle hat in DE und EN genau vier <td>', () => {
    for (const p of [
      path.resolve('dist/items/category/vehiclegear-weapons-guns.html'),
      path.resolve('dist/de/items/category/vehiclegear-weapons-guns.html'),
    ]) {
      const html = fs.readFileSync(p, 'utf8');
      const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
      assert.ok(tbodyMatch, `tbody fehlt in ${p}`);
      const rows = tbodyMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
      assert.ok(rows.length > 0, `keine Zeilen in ${p}`);
      for (const row of rows) {
        const tdCount = (row.match(/<td/g) || []).length;
        assert.strictEqual(tdCount, 4, `Zeile ohne 4 <td> in ${p}: ${row}`);
      }
    }
  });
});

// Tests 10 bis 12 galten dem Ø im Modal und auf den Karten des Item Finders
// (assets/item-finder-app.js). Der Finder ist am 26.11.2026 in der
// Items-Werkbank auf /items.html aufgegangen; den Ø im Blatt der Werkbank
// prueft tests/e2e/items-werkbank.test.js (Test 47).
