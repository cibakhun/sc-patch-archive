// Stärke der Spiellampen einer Halle (hallLampenStaerke im Viewer).
//
// HALL_FEST.licht hebt alle Lampen einer Halle fester Größe, HALL_FEST.daempf
// nimmt einzelne Lichtgruppen davon wieder ein Stück zurück (die Lampen in
// den Kabinen der Frachtaufzüge: wenige Meter über ihrem Boden, mit `licht`
// 16 brannte er aus). Hier steht die Regel am echten Viewer des Repos: welche
// Lampe zu welcher Gruppe zählt und welchen Faktor sie bekommt. Dass die
// Bühne ihre Lampen mit dieser Funktion hebt, zeigt sie selbst in ihrer
// Zeile „… Spiellampen … gesetzt, N gedämpft“; das Bild der Kabine steht im
// Ledger.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DATEI = join(ROOT, 'assets/hangar-viewer.js');
const FEST = JSON.parse(/\/\* hall-fest \*\/([\s\S]*?)\/\* \/hall-fest \*\//.exec(readFileSync(DATEI, 'utf8'))[1]);
const viewer = await import(pathToFileURL(DATEI).href);

test('lampenGruppe: der Name der Lampe ohne die Nummern an seinem Ende', () => {
  const G = viewer.lampenGruppe;
  assert.equal(G('lg_elev_util_cargo_hangar_lrg_a-012'), 'lg_elev_util_cargo_hangar_lrg_a');
  assert.equal(G('lg_cargo_elevator_lrg-001-059'), 'lg_cargo_elevator_lrg', 'Lampen aus einem eingehängten Container tragen zwei Nummern');
  assert.equal(G('lg_hangar_lrgtop-000'), 'lg_hangar_lrgtop');
  assert.equal(G('l_dropoff_singlealcove_001_util_a'), 'l_dropoff_singlealcove_001_util_a', 'eine Zahl mitten im Namen bleibt (kein Strich davor am Ende)');
  assert.equal(G('lg_a-1b'), 'lg_a-1b', 'nur reine Nummern fallen weg');
  assert.equal(G(undefined), '');
  assert.equal(G(null), '');
});

test('hallLampenStaerke: licht für jede Lampe der Halle, mal daempf für die genannten Gruppen', () => {
  const S = viewer.hallLampenStaerke;
  const gedaempft = Object.entries(FEST).filter(([, F]) => F.daempf && Object.keys(F.daempf).length);
  assert.ok(gedaempft.length, 'keine Halle in HALL_FEST dämpft eine Lichtgruppe: der Test liefe leer');
  let gruppen = 0;
  for (const [id, F] of gedaempft) {
    const licht = F.licht ?? 1;
    assert.equal(S(id, ''), licht, `${id}: eine Lampe ohne Namen bekommt licht`);
    assert.equal(S(id, undefined), licht);
    assert.equal(S(id, 'lg_hangar_lrgtop-000'), licht, `${id}: eine Lampe einer anderen Gruppe bekommt licht`);
    for (const [gruppe, f] of Object.entries(F.daempf)) {
      gruppen++;
      assert.ok(Number.isFinite(f) && f > 0 && f < 1, `${id}: daempf.${gruppe} ist ${f}, erwartet ein Faktor zwischen 0 und 1`);
      assert.equal(S(id, `${gruppe}-000`), licht * f, `${id}: Lampe der Gruppe ${gruppe}`);
      assert.equal(S(id, `${gruppe}-001-059`), licht * f, `${id}: Lampe der Gruppe ${gruppe} aus einem eingehängten Container`);
      assert.equal(S(id, gruppe), licht * f, `${id}: der Name ohne Nummer ist die Gruppe selbst`);
      assert.equal(S(id, `${gruppe}_b-000`), licht, `${id}: eine Gruppe, deren Name nur so anfängt, bleibt ungedämpft`);
      assert.equal(S(id, `x${gruppe}-000`), licht, `${id}: eine Gruppe, deren Name nur so endet, bleibt ungedämpft`);
    }
  }
  assert.ok(gruppen > 0);
});

test('hallLampenStaerke: eine Halle ohne Eintrag lässt ihre Lampen, wie sie sind', () => {
  const S = viewer.hallLampenStaerke;
  assert.equal(S('revelyork-single', 'lg_elev_util_cargo_hangar_lrg_a-000'), 1);
  assert.equal(S(undefined, 'lg_elev_util_cargo_hangar_lrg_a-000'), 1);
  assert.equal(S('gibt-es-nicht', ''), 1);
});
