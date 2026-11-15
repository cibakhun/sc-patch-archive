// Kleine Fassungen der komprimierten Zwillinge fuers Telefon
// (scripts/lib/hangar-ktx.mjs: ktxKlein, ktxKleinWeg).
// Anlass: Krisz, 15.11.2026, Bild der leichten Ansicht auf dem iPhone 12:
// „Hoch, nach dem Laden, Grafik verloren“. Die volle Halle haelt am Telefon
// mit komprimierten Texturen 82 statt 198 MB bei der Grafikkarte; das
// Telefon laedt dafuer von jedem Zwilling nur die Stufen bis 256 px.
// Geprueft wird die Regel an gebauten KTX2-Dateien: Was faellt, was bleibt
// Byte fuer Byte, und was die Funktion ablehnt, statt es falsch zu kuerzen.
// Ob eine gekuerzte Datei im Umwandler dasselbe Bild ergibt, prueft
// verify:hangar-ktx [8] an den echten Zwillingen.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { KTX_KLEIN_MAX, ktxKlein, ktxKleinWeg, ktxKopf, ktxMitKv } from '../../scripts/lib/hangar-ktx.mjs';

const KENNUNG = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
const stufenZahl = (b, h) => Math.floor(Math.log2(Math.max(b, h))) + 1;
// Bytes einer Stufe: erkennbar an ihrer Nummer
const stufe = (i, len) => Buffer.alloc(len, 0x40 + i);

// Baut eine KTX2-Datei wie basisu: Kopf, Stufenliste, DFD, Schluessel-Wert-
// Daten, bei BasisLZ (art 1) die Bildbeschreibungen und Codebuecher, dann die
// Stufen, kleinste zuerst. Rueckgabe: { buf, stufen: [Buffer je Stufe, groesste
// zuerst], descs: [Buffer je Stufe], buecher }.
function bau({ b = 1024, h = 1024, art = 1, kv = { HGart: 'c', HGbau: 'd1', HGwebp: '4711' }, flaechen = 1, lagen = 0, sgdSchief = 0 } = {}) {
  const n = stufenZahl(b, h);
  const stufen = Array.from({ length: n }, (_, i) => stufe(i, 5 + (n - i) * 7));
  const dfd = Buffer.alloc(44, 0xd0);
  dfd.writeUInt32LE(44, 0);
  const kvTeile = [];
  for (const key of Object.keys(kv).sort()) {
    const body = Buffer.concat([Buffer.from(key), Buffer.from([0]), Buffer.from(String(kv[key])), Buffer.from([0])]);
    const len = Buffer.alloc(4); len.writeUInt32LE(body.length);
    kvTeile.push(len, body, Buffer.alloc((4 - (body.length % 4)) % 4));
  }
  const kvd = Buffer.concat(kvTeile);
  const descs = Array.from({ length: n }, (_, i) => { const d = Buffer.alloc(20, 0x10 + i); d.writeUInt32LE(0, 4); d.writeUInt32LE(stufen[i].length, 8); return d; });
  const buecher = Buffer.alloc(37, 0xcb);
  let sgd = Buffer.alloc(0);
  if (art === 1) {
    const kopf = Buffer.alloc(20);
    kopf.writeUInt16LE(3, 0); kopf.writeUInt16LE(5, 2);
    kopf.writeUInt32LE(20, 4); kopf.writeUInt32LE(10, 8); kopf.writeUInt32LE(7 + sgdSchief, 12); kopf.writeUInt32LE(0, 16);
    sgd = Buffer.concat([kopf, ...descs, buecher]);
  }
  const kopf = Buffer.alloc(80 + 24 * n);
  KENNUNG.copy(kopf, 0);
  kopf.writeUInt32LE(0, 12); kopf.writeUInt32LE(1, 16); kopf.writeUInt32LE(b, 20); kopf.writeUInt32LE(h, 24);
  kopf.writeUInt32LE(0, 28); kopf.writeUInt32LE(lagen, 32); kopf.writeUInt32LE(flaechen, 36); kopf.writeUInt32LE(n, 40); kopf.writeUInt32LE(art, 44);
  let at = kopf.length;
  kopf.writeUInt32LE(at, 48); kopf.writeUInt32LE(dfd.length, 52); at += dfd.length;
  kopf.writeUInt32LE(at, 56); kopf.writeUInt32LE(kvd.length, 60); at += kvd.length;
  const fuell = sgd.length ? (8 - (at % 8)) % 8 : 0;
  at += fuell;
  kopf.writeBigUInt64LE(BigInt(sgd.length ? at : 0), 64); kopf.writeBigUInt64LE(BigInt(sgd.length), 72);
  at += sgd.length;
  const daten = [];
  for (let i = n - 1; i >= 0; i--) {
    kopf.writeBigUInt64LE(BigInt(at), 80 + 24 * i);
    kopf.writeBigUInt64LE(BigInt(stufen[i].length), 88 + 24 * i);
    kopf.writeBigUInt64LE(BigInt(art === 2 ? 1000 + i : 0), 96 + 24 * i);
    daten.push(stufen[i]);
    at += stufen[i].length;
  }
  return { buf: Buffer.concat([kopf, dfd, kvd, Buffer.alloc(fuell), sgd, ...daten]), stufen, descs, buecher, dfd, kvd };
}
const ebene = (buf, k, i) => buf.subarray(k.ebenen[i].off, k.ebenen[i].off + k.ebenen[i].len);

describe('Kleine Zwillinge: was faellt', () => {
  test('die Kante der kleinen Fassungen ist die der Automatik am Telefon', () => {
    assert.equal(KTX_KLEIN_MAX, 256);
  });

  test('so viele Stufen, bis die laengere Kante passt; die kleinste bleibt immer', () => {
    const k = (b, h, stufen = stufenZahl(b, h)) => ({ breite: b, hoehe: h, stufen });
    assert.equal(ktxKleinWeg(k(1024, 1024)), 2);
    assert.equal(ktxKleinWeg(k(2048, 2048)), 3);
    assert.equal(ktxKleinWeg(k(512, 512)), 1);
    assert.equal(ktxKleinWeg(k(256, 256)), 0);
    assert.equal(ktxKleinWeg(k(64, 64)), 0);
    // die laengere Kante zaehlt, in beiden Lagen
    assert.equal(ktxKleinWeg(k(2048, 512)), 3);
    assert.equal(ktxKleinWeg(k(256, 512)), 1);
    // keine Zweierpotenz: 768 -> 384 -> 192
    assert.equal(ktxKleinWeg(k(768, 96)), 2);
    // eine andere Kante
    assert.equal(ktxKleinWeg(k(1024, 1024), 128), 3);
    assert.equal(ktxKleinWeg(k(1024, 1024), 1024), 0);
    // ohne kleinere Stufen bleibt die eine, auch wenn sie zu gross ist
    assert.equal(ktxKleinWeg(k(1024, 1024, 1)), 0);
    assert.equal(ktxKleinWeg(k(1024, 1024, 2)), 1);
  });
});

describe('Kleine Zwillinge: die gekuerzte Datei', () => {
  for (const [name, art] of [['BasisLZ (Farbe, Daten)', 1], ['Zstandard (Normal-Karten)', 2]]) {
    test(`${name}: 1024 px verliert zwei Stufen, alles andere bleibt Byte fuer Byte`, () => {
      const q = bau({ art }), alt = ktxKopf(q.buf);
      assert.ok(alt, 'die gebaute Datei ist lesbar');
      const klein = ktxKlein(q.buf), k = ktxKopf(klein);
      assert.ok(k);
      assert.notEqual(klein, q.buf);
      assert.ok(klein.length < q.buf.length);
      assert.deepEqual([k.breite, k.hoehe, k.stufen, k.super, k.vkFormat], [256, 256, 9, art, 0]);
      assert.deepEqual(k.kv, alt.kv);
      assert.ok(klein.subarray(k.dfdOff, k.dfdOff + k.dfdLen).equals(q.dfd));
      assert.ok(klein.subarray(k.kvdOff, k.kvdOff + k.kvdLen).equals(q.kvd));
      // jede uebrige Stufe traegt die Bytes ihrer Stufe im Zwilling, die Stufenliste auch die entpackte Laenge
      for (let i = 0; i < 9; i++) {
        assert.ok(ebene(klein, k, i).equals(q.stufen[i + 2]), `Stufe ${i}`);
        assert.equal(klein.readBigUInt64LE(96 + 24 * i), q.buf.readBigUInt64LE(96 + 24 * (i + 2)), `entpackte Laenge der Stufe ${i}`);
      }
      // die Stufen liegen dicht an dicht am Ende, kleinste zuerst
      assert.equal(k.ebenen[0].off + k.ebenen[0].len, klein.length);
      for (let i = 8; i > 0; i--) assert.equal(k.ebenen[i].off + k.ebenen[i].len, k.ebenen[i - 1].off);
      if (art === 1) {
        // Bildbeschreibungen der beiden groessten Stufen sind weg, die Codebuecher ganz da
        assert.equal(k.sgdOff % 8, 0);
        assert.equal(k.sgdLen, alt.sgdLen - 40);
        const sgd = klein.subarray(k.sgdOff, k.sgdOff + k.sgdLen);
        assert.ok(sgd.subarray(0, 20).equals(q.buf.subarray(alt.sgdOff, alt.sgdOff + 20)));
        for (let i = 0; i < 9; i++) assert.ok(sgd.subarray(20 + 20 * i, 40 + 20 * i).equals(q.descs[i + 2]), `Beschreibung ${i}`);
        assert.ok(sgd.subarray(20 + 20 * 9).equals(q.buecher));
        assert.equal(k.sgdOff + k.sgdLen, k.ebenen[8].off);
      } else assert.deepEqual([k.sgdOff, k.sgdLen], [0, 0]);
    });
  }

  test('was schon klein ist, kommt unveraendert zurueck (dieselbe Datei, kein Kopieren)', () => {
    for (const [b, h] of [[256, 256], [64, 64], [256, 128], [96, 96], [4, 4]]) {
      const q = bau({ b, h });
      assert.equal(ktxKlein(q.buf), q.buf, `${b} x ${h}`);
    }
    // und die gekuerzte Fassung ist selbst klein
    const klein = ktxKlein(bau().buf);
    assert.equal(ktxKlein(klein), klein);
  });

  test('ungleiche Kanten: jede halbiert sich mit, nie unter 1', () => {
    const k = ktxKopf(ktxKlein(bau({ b: 2048, h: 512, art: 2 }).buf));
    assert.deepEqual([k.breite, k.hoehe, k.stufen], [256, 64, 9]);
    const schmal = ktxKopf(ktxKlein(bau({ b: 1024, h: 2 }).buf));
    assert.deepEqual([schmal.breite, schmal.hoehe, schmal.stufen], [256, 1, 9]);
  });

  test('eine andere Kante kuerzt weiter; die Schluessel ueberleben auch ein Umschreiben danach', () => {
    const q = bau({ b: 1024, h: 1024 });
    const k = ktxKopf(ktxKlein(q.buf, 128));
    assert.deepEqual([k.breite, k.hoehe, k.stufen], [128, 128, 8]);
    const mit = ktxKopf(ktxMitKv(ktxKlein(q.buf), { HGmittel: '0.1,0.2,0.3' }));
    assert.equal(mit.kv.HGmittel, '0.1,0.2,0.3');
    assert.equal(mit.kv.HGwebp, '4711');
    assert.deepEqual([mit.breite, mit.stufen], [256, 9]);
  });
});

describe('Kleine Zwillinge: was die Funktion ablehnt', () => {
  test('keine KTX2-Datei, abgeschnittene Datei', () => {
    assert.throws(() => ktxKlein(Buffer.alloc(200)), /keine lesbare KTX2-Datei/);
    const q = bau();
    assert.throws(() => ktxKlein(q.buf.subarray(0, q.buf.length - 30)), /keine lesbare KTX2-Datei/);
  });

  test('ohne Superkompression, mehrere Flaechen oder Lagen: lieber kein kleiner Zwilling als ein falscher', () => {
    assert.throws(() => ktxKlein(bau({ art: 0 }).buf), /Superkompression 0/);
    assert.throws(() => ktxKlein(bau({ art: 3 }).buf), /Superkompression 3/);
    assert.throws(() => ktxKlein(bau({ flaechen: 6 }).buf), /nur ein flaches Bild/);
    assert.throws(() => ktxKlein(bau({ lagen: 4 }).buf), /nur ein flaches Bild/);
    // ... aber nur, wenn ueberhaupt gekuerzt wuerde
    assert.doesNotThrow(() => ktxKlein(bau({ b: 128, h: 128, flaechen: 6 }).buf));
  });

  test('BasisLZ-Daten, die nicht eine Beschreibung je Stufe tragen', () => {
    assert.throws(() => ktxKlein(bau({ sgdSchief: 5 }).buf), /BasisLZ-Daten .* erwartet/);
  });
});
