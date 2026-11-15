// Lampen einer Halle, die im Spiel in Ruhe dunkel sind
// (scripts/lib/hall-ruhe.mjs).
//
// Der Export schreibt auch die Lampen, deren Ruhezustand keine Stärke hat,
// und zwar mit ihrem nächsten Zustand, der eine hat: In der Large-Halle
// brannten so 86 Warnleuchten, Notlichter und Strahler, die das Spiel erst
// schaltet. Der Extraktor nennt sie dem Build in <halle>.ruhe.json. Er läuft
// nur am PC mit den Spieldateien; hier steht seine Rechnung an kleinen
// Entities und Protokollen: welche Lampen dunkel sind, dass die Stelle in der
// Gruppe wirklich die Nummer des Lichtknotens ist (sonst bricht er ab), wie
// oft ein Container in der Halle steht, und dass der Build genau die
// genannten Lichtknoten weglässt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lampenName, ruheDunkel, ruheTeile, ruheListe, ruheRegel, ruheZaehler } from '../../scripts/lib/hall-ruhe.mjs';

// Eine Lampe mit den Stärken ihrer drei Zustände, wie die Entities sie nennen
const lampe = (name, d, a, e) => `<Light EntityCryGUID="x" Name="${name}">
  <EntityComponentLight __type="LightComponentParams" active="1" lightType="Projector" useTemperature="1">
    <sizeParams __type="LightSizeParams" lightRadius="12" />
    <offState __type="LightStateParams_Off" presetTag="" />
    <defaultState __type="LightStateParams_Default" intensity="${d}" temperature="3500"><color __type="RGB" r="1" g="1" b="1" /></defaultState>
    <auxiliaryState __type="LightStateParams_Aux" intensity="${a}" temperature="3500"><color __type="RGB" r="1" g="0" b="0" /></auxiliaryState>
    <emergencyState __type="LightStateParams_Emergency" intensity="${e}" temperature="3500"><color __type="RGB" r="1" g="0" b="0" /></emergencyState>
  </EntityComponentLight>
</Light>`;
const gruppe = (name, lampen, kopf = 'EntityClass="LightGroup"') => `<Entity Name="${name}" ${kopf}><PropertiesDataCore><Lights>${lampen.join('\n')}</Lights></PropertiesDataCore></Entity>`;
const zeile = (name, staerke) => `Light '${name}' type=Projector useTemp=true temperature=3500 intensity=${staerke} radius=12 color=[1.0, 0.75, 0.55]`;
const zeilen = (g, staerken) => staerken.map((s, i) => zeile(lampenName(g, i), s));

// Halle: brennt, dunkel mit auxiliary, dunkel mit emergency, ganz ohne Stärke, brennt (die Entities nennen 0.30000001)
const HALLE = () => [
  `<Entity Name="tuer" EntityClass="Door" />`,
  gruppe('lg_halle', [lampe('decke', 5, 3, 3), lampe('warn', 0, 2, 4), lampe('not', 0, 0, 1.5), lampe('tot', 0, 0, 0), lampe('leiste', '0.30000001', 0, 0)]),
  gruppe('lg_plattform', [lampe('p1', 8, 0, 0), lampe('p2', 0, 6, 0)], 'EntityClass="LightGroupObjectAttach" AttachmentType="CharacterBone" AttachmentTarget="pad"'),
].join('\n');
const HALLE_ZEILEN = () => [...zeilen('lg_halle', [5, 2, 1.5, 0, 0.3]), zeile('einzellicht-096', 0.032)];

test('lampenName: die Stelle in der Gruppe mit drei Ziffern, wie der Export sie schreibt', () => {
  assert.equal(lampenName('lg_halle', 7), 'lg_halle-007');
  assert.equal(lampenName('lg_cargo_elevator_lrg-001', 45), 'lg_cargo_elevator_lrg-001-045');
  assert.equal(lampenName('lg_halle', 1000), 'lg_halle-1000');
});

test('ruheDunkel: dunkel ist, was im Ruhezustand keine Stärke hat; der Export nahm auxiliary, sonst emergency', () => {
  const r = ruheDunkel(HALLE(), HALLE_ZEILEN());
  assert.deepEqual(r.gruppen, { lg_halle: { lampen: 5, dunkel: [1, 2, 3], auxiliary: 1, emergency: 1 } });
  assert.deepEqual(r.ohneExport, [{ gruppe: 'lg_plattform', lampen: 2 }], 'eine Gruppe am Knochen lässt der Export weg, sie steht nicht im Protokoll');
});

test('ruheDunkel: eine Gruppe ohne dunkle Lampe wird geprüft und trägt eine leere Liste', () => {
  const r = ruheDunkel(gruppe('lg_a', [lampe('x', 1, 0, 0), lampe('y', 2, 9, 9)]), zeilen('lg_a', [1, 2]));
  assert.deepEqual(r.gruppen, { lg_a: { lampen: 2, dunkel: [], auxiliary: 0, emergency: 0 } });
});

test('ruheDunkel bricht ab, wenn die Stelle in der Gruppe nicht die Nummer des Lichtknotens ist', () => {
  // eine Zeile fehlt
  assert.throws(() => ruheDunkel(HALLE(), HALLE_ZEILEN().filter((z) => !z.includes('lg_halle-003'))), /lg_halle: 5 Lampen in den Entities, 4 davon im Protokoll/);
  // eine Zeile über die Gruppe hinaus
  assert.throws(() => ruheDunkel(HALLE(), [...HALLE_ZEILEN(), zeile('lg_halle-005', 1)]), /dazu 1 Zeile\(n\) über die Gruppe hinaus \(lg_halle-005\)/);
  // zwei Lampen im Protokoll vertauscht: jede Zeile da, die Stärken passen nicht mehr
  assert.throws(() => ruheDunkel(HALLE(), [...zeilen('lg_halle', [2, 5, 1.5, 0, 0.3])]), /lg_halle-000 \(decke\): das Protokoll des Exports nennt die Stärke 2, nach den Entities wäre es 5/);
  // der Export nähme einen anderen Zustand als nachgemessen (emergency, obwohl auxiliary Stärke hat)
  assert.throws(() => ruheDunkel(HALLE(), [...zeilen('lg_halle', [5, 4, 1.5, 0, 0.3])]), /lg_halle-001 \(warn\): das Protokoll des Exports nennt die Stärke 4, nach den Entities wäre es 2 \(Ruhe 0, auxiliary 2, emergency 4\)/);
  // derselbe Lichtknoten zweimal im Protokoll eines Containers
  assert.throws(() => ruheDunkel(HALLE(), [...HALLE_ZEILEN(), zeile('lg_halle-002', 1.5)]), /lg_halle-002 \(not\): 2 Zeilen im Protokoll/);
});

test('ruheDunkel bricht ab bei Entities, die es nicht lesen kann', () => {
  assert.throws(() => ruheDunkel(`${HALLE()}\n${gruppe('lg_halle', [lampe('x', 1, 0, 0)])}`, HALLE_ZEILEN()), /Lichtgruppe lg_halle steht zweimal im Container/);
  assert.throws(() => ruheDunkel(gruppe('lg_a', [lampe('x', 1, 0, 0).replace(/<auxiliaryState[\s\S]*?<\/auxiliaryState>/, '')]), zeilen('lg_a', [1])), /lg_a-000 \(x\): ohne auxiliaryState/);
  assert.throws(() => ruheDunkel(gruppe('lg_a', [lampe('x', 'hell', 0, 0)]), zeilen('lg_a', [1])), /defaultState intensity="hell" ist keine Stärke/);
  assert.throws(() => ruheDunkel(`<Entity EntityClass="LightGroup"><Lights>${lampe('x', 1, 0, 0)}</Lights></Entity>`, []), /trägt keinen Namen/);
});

test('ruheTeile: die Halle einmal, jedes Kind so oft, wie es mit seinen Eltern in ihr steht; nur-Kinder ohne Lichter', () => {
  const kabine = { id: 'kabine', stellen: [{}], kinder: [] };
  const baum = [
    { id: 'modul', stellen: [{}, {}], kinder: [kabine] },
    { id: 'tuer', stellen: [{}, {}, {}], kinder: [{ id: 'kabine', stellen: [{}], kinder: [] }] },
  ];
  const t = ruheTeile('halle', baum, ['tuer']);
  assert.deepEqual(t.map((x) => [x.id, x.exemplare]), [['halle', 1], ['modul', 2], ['kabine', 5]], 'die Kabine steht zweimal im Modul und dreimal hinter einer Tür; die Tür selbst trägt keine Lichter bei');
  assert.equal(t[0].kind, null);
  assert.equal(t[1].kind, baum[0]);
  assert.deepEqual(ruheTeile('halle').map((x) => [x.id, x.exemplare]), [['halle', 1]], 'eine Halle ohne Kinder');
  assert.throws(() => ruheTeile('halle', [{ id: 'halle', stellen: [{}] }]), /heißt wie die Halle/);
});

test('ruheListe: je Gruppe Container, Exemplare und Stellen; weg zählt jedes Exemplar', () => {
  const liste = ruheListe([
    { id: 'halle', exemplare: 1, gruppen: { lg_halle: { lampen: 5, dunkel: [1, 2, 3] }, lg_hell: { lampen: 9, dunkel: [] } } },
    { id: 'modul', exemplare: 2, gruppen: { 'lg_modul-001': { lampen: 60, dunkel: [1, 3, 14, 22, 45] } } },
    { id: 'kabine', exemplare: 2, gruppen: {} },
  ]);
  assert.deepEqual(liste, { v: 1, weg: 13, gruppen: {
    lg_halle: { container: 'halle', exemplare: 1, lampen: 5, dunkel: [1, 2, 3] },
    'lg_modul-001': { container: 'modul', exemplare: 2, lampen: 60, dunkel: [1, 3, 14, 22, 45] },
  } });
  assert.deepEqual(ruheListe([{ id: 'halle', exemplare: 1, gruppen: { lg_hell: { lampen: 9, dunkel: [] } } }]), { v: 1, weg: 0, gruppen: {} });
});

test('ruheListe bricht ab, wenn zwei Container dieselbe Gruppe nennen oder ein Container keinmal steht', () => {
  const g = { lg_gleich: { lampen: 4, dunkel: [0] } };
  assert.throws(() => ruheListe([{ id: 'halle', exemplare: 1, gruppen: g }, { id: 'modul', exemplare: 2, gruppen: { lg_gleich: { lampen: 4, dunkel: [] } } }]), /Lichtgruppe lg_gleich steht in halle und in modul/);
  for (const exemplare of [0, 1.5, -1, undefined]) assert.throws(() => ruheListe([{ id: 'modul', exemplare, gruppen: g }]), /modul: .* Exemplare ist keine Zahl ab 1/, String(exemplare));
});

test('ruheRegel: Name des Lichtknotens und wie oft er in der Halle steht', () => {
  const r = ruheRegel({ v: 1, weg: 13, gruppen: { lg_halle: { container: 'halle', exemplare: 1, lampen: 5, dunkel: [1, 2, 3] }, 'lg_modul-001': { container: 'modul', exemplare: 2, lampen: 60, dunkel: [1, 3, 14, 22, 45] } } });
  assert.equal(r.weg, 13);
  assert.equal(r.namen.size, 8);
  assert.equal(r.namen.get('lg_halle-002'), 1);
  assert.equal(r.namen.get('lg_modul-001-045'), 2);
  assert.deepEqual(r.gruppen, { lg_halle: [1, 2, 3], 'lg_modul-001': [1, 3, 14, 22, 45] });
  assert.deepEqual(ruheRegel({ v: 1, weg: 0, gruppen: {} }), { weg: 0, namen: new Map(), gruppen: {} }, 'eine Halle ohne dunkle Lampe');
});

test('ruheRegel bricht bei einer Liste ab, die nicht heil ist', () => {
  const heil = () => ({ v: 1, weg: 3, gruppen: { lg_halle: { container: 'halle', exemplare: 1, lampen: 5, dunkel: [1, 2, 3] } } });
  ruheRegel(heil());
  const kaputt = [
    [(l) => { l.v = 2; }, /nicht die Form/],
    [(l) => { l.gruppen = [1]; }, /nicht die Form/],
    [(l) => { l.weg = 4; }, /nennt 4 Lichtknoten, ihre Gruppen ergeben 3/],
    [(l) => { l.gruppen.lg_halle.dunkel = [2, 1, 3]; }, /lg_halle: .* nicht heil/],
    [(l) => { l.gruppen.lg_halle.dunkel = [1, 1, 3]; }, /nicht heil/],
    [(l) => { l.gruppen.lg_halle.dunkel = [1, 2, 5]; }, /nicht heil/],
    [(l) => { l.gruppen.lg_halle.dunkel = []; }, /nicht heil/],
    [(l) => { l.gruppen.lg_halle.exemplare = 0; }, /nicht heil/],
    [(l) => { delete l.gruppen.lg_halle.lampen; }, /nicht heil/],
  ];
  for (const [bruch, meldung] of kaputt) { const l = heil(); bruch(l); assert.throws(() => ruheRegel(l), meldung, bruch.toString()); }
  for (const l of [null, undefined, 'x', []]) assert.throws(() => ruheRegel(l), /nicht die Form/);
});

test('ruheZaehler: lässt genau die genannten Lichtknoten weg und hält fest, dass jeder so oft dasteht, wie die Liste sagt', () => {
  const regel = ruheRegel({ v: 1, weg: 3, gruppen: { lg_halle: { container: 'halle', exemplare: 1, lampen: 5, dunkel: [1] }, lg_modul: { container: 'modul', exemplare: 2, lampen: 3, dunkel: [0] } } });
  const knoten = ['lg_halle-000', 'lg_halle-001', 'lg_modul-000', 'lg_modul-001', 'lg_modul-000', 'lg_modul-001', 'einzellicht-096'];
  const z = ruheZaehler(regel);
  assert.deepEqual(knoten.filter((n) => !z.dunkel(n)), ['lg_halle-000', 'lg_modul-001', 'lg_modul-001', 'einzellicht-096']);
  z.pruefe('hall/probe.ruhe.json');
  // die Liste stammt aus einem anderen Export: ein genannter Lichtknoten fehlt im Modell
  const fehlt = ruheZaehler(regel);
  knoten.filter((n) => n !== 'lg_halle-001').forEach((n) => fehlt.dunkel(n));
  assert.throws(() => fehlt.pruefe('hall/probe.ruhe.json'), /hall\/probe\.ruhe\.json passt nicht zum Modell: 1 von 2 genannten Lichtknoten .* \(lg_halle-001 0 statt 1\)/);
  // ein Exemplar zu viel oder zu wenig
  const einmal = ruheZaehler(regel);
  knoten.slice(0, 4).forEach((n) => einmal.dunkel(n));
  assert.throws(() => einmal.pruefe('x'), /lg_modul-000 1 statt 2/);
  const dreimal = ruheZaehler(regel);
  [...knoten, 'lg_modul-000'].forEach((n) => dreimal.dunkel(n));
  assert.throws(() => dreimal.pruefe('x'), /lg_modul-000 3 statt 2/);
});

test('vom Protokoll bis zum Bau: die Lampen, die ruheDunkel nennt, lässt der Zähler weg, alle anderen bleiben', () => {
  const modul = gruppe('lg_modul', [lampe('spin', 0, 7, 0), lampe('kabine', 3, 0, 0)]);
  const teile = ruheTeile('halle', [{ id: 'modul', stellen: [{}, {}], kinder: [] }]).map((t) => ({ id: t.id, exemplare: t.exemplare, ...(t.kind ? ruheDunkel(modul, zeilen('lg_modul', [7, 3])) : ruheDunkel(HALLE(), HALLE_ZEILEN())) }));
  const liste = ruheListe(teile);
  assert.equal(liste.weg, 5, 'drei in der Halle, eine je Modul');
  const z = ruheZaehler(ruheRegel(JSON.parse(JSON.stringify(liste))));
  const knoten = [...[0, 1, 2, 3, 4].map((i) => lampenName('lg_halle', i)), 'einzellicht-096', ...[0, 1, 0, 1].map((i) => lampenName('lg_modul', i))];
  assert.deepEqual(knoten.filter((n) => !z.dunkel(n)), ['lg_halle-000', 'lg_halle-004', 'einzellicht-096', 'lg_modul-001', 'lg_modul-001']);
  z.pruefe('hall/halle.ruhe.json');
});
