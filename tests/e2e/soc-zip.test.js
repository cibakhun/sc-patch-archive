// readZip (scripts/lib/soc-objects.mjs) liest die socpaks fuer datamine:loot
// und die Hangar-Auszuege. Seit 4.10.3 (CL 13220821) tragen die lokalen Koepfe
// "\" als Trenner, das Zentralverzeichnis "/". Das ist derselbe Eintrag und
// muss lesbar bleiben; ein Kopf, der zu einer ANDEREN Datei gehoert, bleibt
// ein Fehler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readZip } from '../../scripts/lib/soc-objects.mjs';

// Ein gespeichertes (Methode 0) ZIP mit einem Eintrag; lokaler und
// zentraler Name getrennt waehlbar.
function zip(localName, centralName, body) {
  const data = Buffer.from(body);
  const ln = Buffer.isBuffer(localName) ? localName : Buffer.from(localName);
  const cn = Buffer.isBuffer(centralName) ? centralName : Buffer.from(centralName);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(ln.length, 26);
  const cdAb = 30 + ln.length + data.length;
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(cn.length, 28);
  central.writeUInt32LE(0, 42);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + cn.length, 12);
  end.writeUInt32LE(cdAb, 16);
  return Buffer.concat([local, ln, data, central, cn, end]);
}

test('readZip liest einen Eintrag mit "\\" im lokalen Kopf und "/" im Verzeichnis', () => {
  const files = readZip(zip('global\\entdata\\1.entxml', 'global/entdata/1.entxml', '<Entity/>'));
  assert.deepEqual([...files.keys()], ['global/entdata/1.entxml']);
  assert.equal(files.get('global/entdata/1.entxml')().toString(), '<Entity/>');
});

test('readZip liest weiter gleiche Namen', () => {
  const files = readZip(zip('a/b.xml', 'a/b.xml', 'x'));
  assert.equal(files.get('a/b.xml')().toString(), 'x');
});

test('readZip wirft, wenn der lokale Kopf zu einer anderen Datei gehoert', () => {
  assert.throws(() => readZip(zip('global\\entdata\\2.entxml', 'global/entdata/1.entxml', 'x')), /lokaler Kopf bei 0 gehoert zu/);
});

test('readZip vergleicht die Namen byteweise: ungueltige UTF-8-Bytes bleiben verschieden', () => {
  // 0x82 und 0x84 sind beide kein gueltiges UTF-8 und fielen beim Dekodieren
  // auf dasselbe Ersatzzeichen. Nur "\\" und "/" duerfen gleich gelten.
  const name = (b) => Buffer.concat([Buffer.from('global\\'), Buffer.from([b]), Buffer.from('.entxml')]);
  assert.throws(() => readZip(zip(name(0x82), name(0x84), 'x')), /lokaler Kopf bei 0 gehoert zu/);
  const gleich = Buffer.concat([Buffer.from('global/'), Buffer.from([0x82]), Buffer.from('.entxml')]);
  assert.equal(readZip(zip(name(0x82), gleich, 'x')).size, 1);
});
