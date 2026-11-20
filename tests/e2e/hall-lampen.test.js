// Stärke der Spiellampen einer Halle (hallLampenStaerke, hallStrahler und
// hallGitterLampen im Viewer).
//
// HALL_FEST.licht hebt alle Lampen einer Halle fester Größe, HALL_FEST.daempf
// nimmt einzelne Lichtgruppen davon wieder ein Stück zurück (die Lampen in
// den Kabinen der Frachtaufzüge: wenige Meter über ihrem Boden, mit `licht`
// 16 brannte er aus). Hier steht die Regel am echten Viewer des Repos: welche
// Lampe zu welcher Gruppe zählt und welchen Faktor sie bekommt. Dass die
// Bühne ihre Lampen mit dieser Funktion hebt, zeigt sie selbst in ihrer
// Zeile „… Spiellampen … gesetzt, N gedämpft“; das Bild der Kabine steht im
// Ledger.
//
// HALL_FEST.strahler stellt die Hauptstrahler einer Halle (ihre Lampen ab
// einer Spielstärke): Farbe zu Weiß gemischt, Stärke nach der Seite der
// Landefläche (Krisz 18.11.2026 zur Large-Halle: „die beleuchtung [ist]
// super kacke“, das Schiff stand türkis und von beiden Seiten gleich hell
// da). HALL_FEST.gitter hebt das Licht der übrigen Lampen im Lichtgitter.
// Auch hier steht die Regel am echten Viewer und an der Lampendatei des
// Repos; wie viele Hauptstrahler die Bühne gestellt hat, nennt sie in
// derselben Zeile („…, N Hauptstrahler“), check:hangar-shader hält es fest.
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

const mitteX = (F) => (F.pad.from[0] + F.pad.to[0]) / 2;
const MIT_STRAHLERN = Object.entries(FEST).filter(([, F]) => F.strahler);

test('hallStrahler: Lampen ab der Spielstärke `ab` (und unter `bis`), nach ihrer Seite der Landefläche gestellt (mal `mal`), die Farbe zu Weiß gemischt', () => {
  const H = viewer.hallStrahler;
  assert.equal(typeof H, 'function', 'der Viewer gibt hallStrahler nicht mehr heraus');
  assert.ok(MIT_STRAHLERN.length, 'keine Halle in HALL_FEST stellt Hauptstrahler: der Test liefe leer');
  for (const [id, F] of MIT_STRAHLERN) {
    const S = F.strahler, m = mitteX(F), farbe = [0.52, 0.95, 0.96];
    assert.ok(Number.isFinite(S.ab) && S.ab > 0, `${id}: strahler.ab ist ${S.ab}, erwartet eine Spielstärke über null`);
    assert.ok(Number.isFinite(S.weiss) && S.weiss >= 0 && S.weiss <= 1, `${id}: strahler.weiss ist ${S.weiss}, erwartet ein Anteil von 0 bis 1`);
    assert.ok(Array.isArray(S.seiten) && S.seiten.length === 2 && S.seiten.every((f) => Number.isFinite(f) && f > 0), `${id}: strahler.seiten ist ${JSON.stringify(S.seiten)}, erwartet zwei Faktoren über null (+x, −x)`);
    assert.ok(S.bis === undefined || (Number.isFinite(S.bis) && S.bis > S.ab), `${id}: strahler.bis ist ${S.bis}, erwartet eine Spielstärke über ab`);
    assert.ok(S.mal === undefined || (Number.isFinite(S.mal) && S.mal > 0), `${id}: strahler.mal ist ${S.mal}, erwartet ein Faktor über null`);
    const mal = S.mal ?? 1, innen = S.bis ? (S.ab + S.bis) / 2 : S.ab * 2;
    const plus = H(id, { intensity: S.ab, pos: [m + 0.5, 40, 0], color: farbe }, m);
    const minus = H(id, { intensity: innen, pos: [m - 0.5, 40, 0], color: farbe }, m);
    assert.equal(plus.staerke, S.seiten[0] * mal, `${id}: eine Lampe auf der Seite +x bekommt den ersten Faktor (mal ${mal})`);
    assert.equal(minus.staerke, S.seiten[1] * mal, `${id}: eine Lampe auf der Seite −x bekommt den zweiten Faktor (mal ${mal})`);
    assert.equal(H(id, { intensity: S.ab, pos: [m, 40, 0], color: farbe }, m).staerke, S.seiten[1] * mal, `${id}: genau über der Mitte zählt die Lampe zur Seite −x`);
    if (S.bis) {
      assert.equal(H(id, { intensity: S.bis, pos: [m + 0.5, 40, 0], color: farbe }, m), null, `${id}: ab bis (${S.bis}) ist eine Lampe kein Hauptstrahler`);
      assert.ok(H(id, { intensity: S.bis * 0.999, pos: [m + 0.5, 40, 0], color: farbe }, m), `${id}: knapp unter bis ist eine Lampe Hauptstrahler`);
    }
    for (const r of [plus, minus]) for (let i = 0; i < 3; i++) assert.ok(Math.abs(r.farbe[i] - (farbe[i] + (1 - farbe[i]) * S.weiss)) < 1e-12, `${id}: Kanal ${i} der Farbe ist ${r.farbe[i]}, erwartet der Anteil ${S.weiss} zu Weiß gemischt`);
    assert.deepEqual(farbe, [0.52, 0.95, 0.96], 'die Farbe der Lampe selbst bleibt, wie sie war');
    assert.deepEqual(H(id, { intensity: S.ab, pos: [m + 0.5, 40, 0] }, m).farbe, [1, 1, 1], `${id}: eine Lampe ohne Farbe ist weiß und bleibt es`);
    assert.equal(H(id, { intensity: S.ab * 0.999, pos: [m + 0.5, 40, 0], color: farbe }, m), null, `${id}: knapp unter ab ist eine Lampe kein Hauptstrahler`);
    assert.equal(H(id, { intensity: S.ab, color: farbe }, m), null, `${id}: ohne Lage hat eine Lampe keine Seite`);
    assert.equal(H(id, null, m), null);
    assert.equal(H(id, undefined, m), null);
  }
});

test('hallStrahler: eine Halle ohne Eintrag stellt keine Lampe', () => {
  const H = viewer.hallStrahler, l = { intensity: 1e6, pos: [0, 40, 0], color: [0.52, 0.95, 0.96] };
  assert.equal(H('revelyork-single', l, 0), null);
  assert.equal(H(undefined, l, 0), null);
  assert.equal(H('gibt-es-nicht', l, 0), null);
});

test('hallStrahler an der Lampendatei: beide Seiten der Landefläche tragen Hauptstrahler, die Schwelle liegt weit über jeder anderen Lampe', () => {
  let hallen = 0;
  for (const [id, F] of MIT_STRAHLERN) {
    const datei = join(ROOT, 'public/hangar/hall', `${id}.lights.json`);
    const lampen = JSON.parse(readFileSync(datei, 'utf8')).lights;
    const m = mitteX(F), haupt = lampen.filter((l) => viewer.hallStrahler(id, l, m));
    const plus = haupt.filter((l) => l.pos[0] > m).length, minus = haupt.length - plus;
    assert.ok(plus > 0 && minus > 0, `${id}: ${plus} Hauptstrahler auf der Seite +x, ${minus} auf −x (von ${lampen.length} Lampen ab Stärke ${F.strahler.ab}): strahler.seiten stellt eine Seite, die es nicht gibt`);
    const rest = Math.max(...lampen.filter((l) => !haupt.includes(l) && l.intensity < F.strahler.ab).map((l) => l.intensity));
    assert.ok(rest <= F.strahler.ab / 2, `${id}: die stärkste Lampe unter ab hat ${rest}, die Schwelle ab ist ${F.strahler.ab}: Sie trennt die Hauptstrahler nicht mehr deutlich von den anderen`);
    if (F.strahler.bis) {
      const oben = Math.max(...haupt.map((l) => l.intensity)), ueber = lampen.filter((l) => l.intensity >= F.strahler.bis);
      assert.ok(oben <= F.strahler.bis / 2, `${id}: der stärkste Hauptstrahler hat ${oben}, bis ist ${F.strahler.bis}: Die Schwelle trennt sie nicht mehr deutlich von den Strahlern darüber`);
      assert.ok(ueber.length > 0, `${id}: bis ${F.strahler.bis} nimmt keine Lampe der Datei aus: eine Ausnahme ohne Anlass`);
    }
    hallen++;
  }
  assert.ok(hallen > 0);
});

test('hallGitterLampen: Stärke mal gitter, die Hauptstrahler ausgenommen, die Liste selbst bleibt', () => {
  const G = viewer.hallGitterLampen;
  assert.equal(typeof G, 'function', 'der Viewer gibt hallGitterLampen nicht mehr heraus');
  const mit = Object.entries(FEST).filter(([, F]) => F.gitter !== undefined);
  assert.ok(mit.length, 'keine Halle in HALL_FEST hebt ihr Gitterlicht: der Test liefe leer');
  for (const [id, F] of mit) {
    assert.ok(Number.isFinite(F.gitter) && F.gitter > 0, `${id}: gitter ist ${F.gitter}, erwartet ein Faktor über null`);
    const list = [{ name: 'a', intensity: 2, pos: [0, 0, 0] }, { name: 'b', intensity: 5, pos: [1, 0, 0], haupt: true }, { name: 'c', intensity: 0.5, pos: [2, 0, 0] }];
    const vorher = JSON.stringify(list), aus = G(id, list);
    assert.deepEqual(aus.map((l) => l.intensity), [2 * F.gitter, 5, 0.5 * F.gitter], `${id}: Stärke mal ${F.gitter}, der Hauptstrahler bleibt`);
    assert.deepEqual(aus.map((l) => l.name), ['a', 'b', 'c'], 'Reihenfolge und übrige Angaben bleiben');
    assert.equal(JSON.stringify(list), vorher, 'die Liste der Bühne bleibt unverändert (sie zählt an ihr die gedämpften Lampen)');
  }
  const l = [{ intensity: 2 }];
  assert.equal(G('revelyork-single', l), l, 'eine Halle ohne Eintrag bekommt ihre Liste zurück');
  assert.equal(G(undefined, l), l);
});
