#!/usr/bin/env node
/* ============================================================
   patch-vergleich-abgleich.mjs — haelt die Behauptungen der 4.10.3-Seite
   (src/lib/patch-4-10-3/inhalt.ts) gegen den Datenvergleich
   src/data/patch-vergleich/4.10.2__4.10.3.json.

     node scripts/patch-vergleich-abgleich.mjs

   Jede Behauptung steht mit ihrer Zeile in inhalt.ts in BEHAUPTUNGEN.
   Ergebnis je Zeile: bestaetigt, widerspricht oder nicht abgedeckt (der
   Wert steht nicht in den verglichenen Daten). Kein Tor: die Seite ist
   Redaktionsgut, das Skript ist der Pruefauftrag fuer sie.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const V = JSON.parse(readFileSync(resolve(ROOT, 'src/data/patch-vergleich/4.10.2__4.10.3.json'), 'utf8'));

const finde = (kind, slug) => V.eintraege.find((e) => e.kind === kind && (e.slug === slug || e.id === slug));
const alle = (kind, change) => V.eintraege.filter((e) => e.kind === kind && e.change === change);
const feld = (e, f) => e?.felder?.find((x) => x.feld === f);
const wert = (e, f) => e?.werte?.find((x) => x.feld === f)?.wert;
const gleicheMenge = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const zeige = (x) => JSON.stringify(x);

const OK = 'bestaetigt', NEIN = 'widerspricht', OFFEN = 'nicht abgedeckt';
/** pruefe() gibt [Ergebnis, Beleg] zurueck. */
const ja = (bedingung, beleg) => [bedingung ? OK : NEIN, beleg];
const offen = (grund) => () => [OFFEN, grund];

function bestand(kind, vorher, nachher) {
  return () => { const b = V.bestand[kind]; return ja(b.vorher === vorher && b.nachher === nachher, `${b.vorher} → ${b.nachher}`); };
}
function radar(ids, vorher, nachher) {
  return () => {
    const zeilen = ids.map((id) => [id, feld(finde('ship', id), 'radars')]);
    return ja(zeilen.every(([, f]) => f && f.vorher.join() === vorher && f.nachher.join() === nachher), zeilen.map(([id, f]) => `${id}: ${f ? `${f.vorher} → ${f.nachher}` : 'kein Radarwechsel'}`).join('; '));
  };
}
function neu(kind, slugs) {
  return () => {
    const fehlt = slugs.filter((s) => finde(kind, s)?.change !== 'new');
    return ja(!fehlt.length, fehlt.length ? `nicht neu: ${fehlt.join(', ')}` : `${slugs.length} neu`);
  };
}

const AUEC = { 'aegs-tiburon': ['Lorville'], 'misc-starlite': ['Lorville', 'Levski'], 'drak-ironclad': ['Levski'], 'drak-pitbull': ['Levski', 'Pyro'], 'drak-ironclad-assault': ['Pyro'], 'glsn-basher': ['Pyro'], 'orig-m80': ['Area 18'], 'gama-tyilui': ['Area 18'] };
const INTERSEC = ['intercept-vanduul-fleet', 'vanduul-strike-group-detected', 'counterstrike-against-vanduul-raiders', 'draw-out-maulers', 'interdict-vanduul-maulers', 'seek-and-destroy-super-stingers', 'engage-shattered-blade-and-vanduul', 'neutralize-vanduul-and-shattered-blade-threat', 'stop-vanduul-and-shattered-blade-hostilities', 'retake-boarded-vessel', 'living-vanduul-sample', 'intersec-eliminate-specific-rank1'];

const BEHAUPTUNGEN = [
  [537, 'Bestand Items 9412 → 9515', bestand('itemKatalog', 9412, 9515)],
  [538, 'Bestand Baupläne 1617 → 1634', bestand('blueprint', 1617, 1634)],
  [539, 'Bestand Missionsfamilien 1387 → 1399', bestand('mission', 1387, 1399)],
  [540, 'Bestand Schiffe und Fahrzeuge 231 → 235', bestand('ship', 231, 235)],
  [542, 'Neue Fahrzeuge: Galaxy, Liberator und vier ATLS', () => {
    const ids = alle('ship', 'new').map((e) => e.id);
    return ja(gleicheMenge(ids, ['rsi-galaxy', 'anvl-liberator', 'argo-atls-geo-collector-grad02', 'argo-atls-ikti', 'argo-atls-geo-ikti', 'argo-atls-geo-ikti-ntls']), ids.join(', '));
  }],
  [525, 'Phoenix Emerald und Hammerhead 2949 Best In Show entfallen', () => {
    const ids = alle('ship', 'removed').map((e) => e.id);
    return ja(gleicheMenge(ids, ['rsi-constellation-phoenix-emerald', 'aegs-hammerhead-showdown']), ids.join(', '));
  }],
  [524, 'Anvils Bodenfahrzeuge heißen HM6 Ballista, Spartan, Centurion', () => {
    const r = ['anvl-ballista', 'anvl-spartan', 'anvl-centurion'].map((id) => finde('ship', id));
    return ja(r.every((e) => e?.change === 'renamed' && e.name.startsWith('HM6 ')), r.map((e) => `${e?.nameVorher} → ${e?.name}`).join('; ') + ` (dazu ${alle('ship', 'renamed').length - 3} Ballista-Editionen)`);
  }],
  [258, '12 neue InterSec-Aufträge in Nyx', () => {
    const slugs = alle('mission', 'new').map((e) => e.slug);
    return ja(gleicheMenge(slugs, INTERSEC), `${slugs.length} neue Missionsfamilien, Menge ${gleicheMenge(slugs, INTERSEC) ? 'gleich' : 'verschieden'} zu den 12 der Seite`);
  }],
  [567, 'Die meisten der 12 Aufträge lassen sich teilen', () => {
    const teilbar = INTERSEC.filter((s) => wert(finde('mission', s), 'shareable') === true).length;
    return ja(teilbar > 6, `teilbar: ${teilbar} von 12`);
  }],
  [567, 'Angeboten je nach Auftrag ab Jr. Contractor bis Head Contractor', () => {
    const erste = INTERSEC.map((s) => [s, (wert(finde('mission', s), 'ranks') ?? [''])[0].split(' → ')[0]]);
    const menge = [...new Set(erste.map(([, r]) => r))];
    const elite = erste.filter(([, r]) => r === 'Elite Contractor').map(([s]) => s);
    return ja(menge.includes('Jr. Contractor') && !elite.length, `niedrigster Rang je Auftrag: ${menge.join(', ')}; ab Elite Contractor: ${elite.join(', ') || 'keiner'} (Leiter laut Rangspannen der Daten: Jr. < Contractor < Sr. < Veteran < Head < Elite)`);
  }],
  [263, 'Mauler „STRIKER“: Energieschaden je Schuss 64 → 250', () => {
    const f = feld(finde('item', 'vanduul-mauler-striker-repeater'), 'damage.energy');
    return ja(f?.vorher === 64 && f?.nachher === 250, f ? `${f.vorher} → ${f.nachher}` : 'keine Änderung');
  }],
  [426, 'Mauler „STRIKER“: DPS rund 800 → 3125', () => {
    const f = feld(finde('item', 'vanduul-mauler-striker-repeater'), 'dps');
    return ja(f && Math.abs(f.vorher - 800) < 50 && f.nachher === 3125, f ? `${f.vorher} → ${f.nachher}` : 'keine Änderung');
  }],
  [407, 'Radar Carrack und Expedition: Surveyor → Surveyor-Max', radar(['anvl-carrack', 'anvl-carrack-expedition'], '1× Surveyor (S2)', '1× Surveyor-Max (S3)')],
  [408, 'Radar Starlancer MAX und TAC: Surveyor → Surveyor-Max', radar(['misc-starlancer-max', 'misc-starlancer-tac'], '1× Surveyor (S2)', '1× Surveyor-Max (S3)')],
  [409, 'Radar Perseus: Epier → Resolu', radar(['rsi-perseus'], '1× Epier (S2)', '1× Resolu (S3)')],
  [410, 'Hammerhead und Tiburon hatten Resolu schon', () => {
    const r = ['aegs-hammerhead', 'aegs-tiburon'].map((id) => feld(finde('ship', id), 'radars'));
    return ja(r.every((f) => !f), r.every((f) => !f) ? 'kein Radarwechsel an beiden' : zeige(r));
  }],
  [261, 'Radar Größe 2 → 3 an Carrack, Perseus, Starlancer MAX und TAC', radar(['anvl-carrack', 'misc-starlancer-max', 'misc-starlancer-tac'], '1× Surveyor (S2)', '1× Surveyor-Max (S3)')],
  [437, 'Vanguard Warden und Hoplite: Turm-DPS 400 → 750', () => {
    const r = ['aegs-vanguard', 'aegs-vanguard-hoplite'].map((id) => feld(finde('ship', id), 'turretDps'));
    return ja(r.every((f) => f?.vorher === 400 && f?.nachher === 750), r.map((f) => (f ? `${f.vorher} → ${f.nachher}` : '–')).join('; '));
  }],
  [441, 'Warden und Hoplite: Shredder S3 statt Sawbuck S2 im Turm', () => {
    const r = ['aegs-vanguard', 'aegs-vanguard-hoplite'].map((id) => feld(finde('ship', id), 'turretWeapons'));
    return ja(r.every((f) => /Sawbuck.*\(S2\)/.test(f?.vorher) && /Shredder.*\(S3\)/.test(f?.nachher)), r.map((f) => (f ? `${f.vorher} → ${f.nachher}` : '–')).join('; '));
  }],
  [438, 'Vanguard Sentinel: Suckerpunch-L → Suckerpunch-XL', () => {
    const f = feld(finde('ship', 'aegs-vanguard-sentinel'), 'turretWeapons');
    return ja(/Suckerpunch-L /.test(f?.vorher) && /Suckerpunch-XL /.test(f?.nachher), f ? `${f.vorher} → ${f.nachher}` : '–');
  }],
  [439, 'Vanguard Harbinger: Turmwaffen 2 → 3', () => {
    const f = feld(finde('ship', 'aegs-vanguard-harbinger'), 'turretWeapons');
    return ja(/^2× /.test(f?.vorher) && /^3× /.test(f?.nachher), f ? `${f.vorher} → ${f.nachher}` : '–');
  }],
  [260, '8 Schiffe zum ersten Mal für aUEC kaufbar', () => {
    const ids = alle('price', 'new').map((e) => e.id);
    return ja(gleicheMenge(ids, Object.keys(AUEC)), ids.join(', '));
  }],
  [360, 'Kauforte der 8 Schiffe (Lorville, Levski, Pyro, Area18)', () => {
    const fehler = Object.entries(AUEC).flatMap(([id, orte]) => {
      const a = finde('price', id)?.angebote ?? [];
      return orte.filter((o) => !a.some((x) => (o === 'Pyro' ? x.system === 'Pyro' : x.ort === o))).map((o) => `${id} nicht in ${o}`);
    });
    return ja(!fehler.length, fehler.length ? fehler.join('; ') : 'jedes Schiff an jedem genannten Ort');
  }],
  [265, 'Baupläne +17', () => ja(alle('blueprint', 'new').length === 17, `${alle('blueprint', 'new').length} neue Baupläne`)],
  [471, 'Raider Camo als Bauplan: Corbel, Palatino, Tailwind, M3A, M4A, M5A, Skarnov', () => {
    const namen = new Set(alle('blueprint', 'new').map((e) => e.name));
    const soll = ['Corbel Core Raider Camo', 'Palatino Core Raider Camo', 'Tailwind Flight Suit Raider Camo', 'M3A Cannon Raider Camo', 'M4A Cannon Raider Camo', 'M5A Cannon Raider Camo', 'Skarnov "Raider Camo" Rifle'];
    const fehlt = soll.filter((n) => !namen.has(n));
    return ja(!fehlt.length, fehlt.length ? `fehlt: ${fehlt.join(', ')}` : 'alle sieben neu, dazu weitere Teile derselben Sets');
  }],
  [496, 'Der RSI-Schild S4 „Glacis“ heißt jetzt Deterrent', () => {
    const e = finde('item', 'deterrent');
    return ja(e?.change === 'renamed' && e.nameVorher === 'Glacis', e ? `${e.change}: ${e.nameVorher ?? ''} → ${e.name}` : '–');
  }],
  [499, 'Den Namen Glacis trägt ein neuer Schild', neu('item', ['glacis'])],
  [498, 'Die Polaris trägt Deterrent ab Werk', () => {
    const f = feld(finde('ship', 'rsi-polaris'), 'shields');
    return ja(/Deterrent/.test(f?.nachher), f ? `${f.vorher} → ${f.nachher}` : 'kein Schildwechsel (der Name wechselte am Item)');
  }],
  [500, 'Lephari: neues ziviles Radar S3 für Galaxy, Centaurus, Zeus ES', () => {
    const it = finde('item', 'lephari');
    const r = ['rsi-constellation-mk5-centaurus', 'rsi-zeus-es'].map((id) => feld(finde('ship', id), 'radars'));
    const vorher = r.every((f) => /Lephari \(S3\)/.test(f?.vorher?.join()));
    return [it?.change === 'new' && !vorher ? OK : NEIN, `Item ${it?.change ?? '–'}; Centaurus und Zeus ES vorher: ${r.map((f) => f?.vorher).join(' / ')}${vorher ? ' (das Radar war schon verbaut, nur ohne Spielnamen; der Bauplan heißt jetzt Lephari statt Radr Wlop S03 Lephari)' : ''}`];
  }],
  [480, 'Skarnov neu in fünf Ausführungen, dazu die Batterie', neu('item', ['skarnov-rifle', 'skarnov-ferrite-rifle', 'skarnov-relay-rifle', 'skarnov-sparkplug-rifle', 'skarnov-raider-camo-rifle', 'skarnov-rifle-battery-30-cap'])],
  [509, 'IAE 2956: Kappe, T-Shirt, Bomber Jacket', neu('item', ['iae-2956-hat', 'iae-2956-t-shirt', '2956-best-in-show-bomber-jacket'])],
  [512, 'Lackierung 2956 Best In Show für Corsair, Ironclad Assault, M80, Perseus', neu('item', ['corsair-2956-best-in-show-livery', 'ironclad-assault-2956-best-in-show-livery', 'm80-2956-best-in-show-livery', 'perseus-2956-best-in-show-livery'])],
  [323, 'Galaxy-Module: Cargo, Med Bay, Stock', neu('item', ['galaxy-cargo-module', 'galaxy-med-bay-module', 'galaxy-stock-module'])],
  [320, 'Galaxy: 32 × Tempest II', () => {
    const w = wert(finde('ship', 'rsi-galaxy'), 'missileRacks');
    return ja(w?.some((x) => /^32× Tempest II/.test(x)), zeige(w));
  }],
  [341, 'Liberator-Türme: 4 × Panther, 2 × Galdereen', () => {
    const w = wert(finde('ship', 'anvl-liberator'), 'turretWeapons');
    return ja(w?.some((x) => /^4× CF-337 Panther/.test(x)) && w?.some((x) => /^2× CF-557 Galdereen/.test(x)), zeige(w));
  }],
  [319, 'Galaxy: Frachtmodul hebt den Laderaum von 64 auf 720 SCU', offen('64 SCU steht im Schiff, die 720 SCU des Moduls stehen in keinem verglichenen Feld')],
  [417, 'Salvage-Puffer: Reclaimer 240 → 448, MOTH, Vulture, Fortune, Salvation', offen('Puffer stehen weder in vehicles.json noch in den Item-Werten')],
  [427, 'High Risk Target: Ruf 2000 → 4000', offen('Rufwerte der Aufträge werden nicht verglichen')],
  [428, 'Torpedos Größe 5 und 7 scharf ab 700 m', () => {
    const t = V.eintraege.filter((e) => e.kind === 'item' && /torpedo/i.test(e.name));
    return t.length ? [OFFEN, `Torpedo-Einträge: ${t.map((e) => e.name).join(', ')}; eine Scharfschaltdistanz steht in keinem Feld`] : [OFFEN, 'kein Torpedo geändert; eine Scharfschaltdistanz steht in keinem verglichenen Feld (nur armTime)'];
  }],
  [429, 'Bombenhalter Größe 1 und 3 am Waffenkiosk in Orison', offen('Shop-Bestände werden nicht verglichen')],
  [431, 'Vanduul-KI mehr Munition, Mauler weniger Lebenspunkte', offen('KI-Loadouts und NPC-Schiffe stehen nicht im Vergleich')],
  [412, 'Perseus-Relais an einer Konsole, Starlancer-Radar im Maschinenraum', offen('Einbauort steht in keinem verglichenen Feld')],
];

const ergebnisse = BEHAUPTUNGEN.map(([zeile, text, pruefe]) => { const [e, beleg] = pruefe(); return { zeile, text, e, beleg }; });
for (const art of [NEIN, OK, OFFEN]) {
  const liste = ergebnisse.filter((r) => r.e === art);
  console.log(`\n${art.toUpperCase()} (${liste.length})`);
  for (const r of liste) console.log(`  inhalt.ts:${r.zeile}  ${r.text}\n      ${r.beleg}`);
}
console.log(`\n${ergebnisse.length} Behauptungen: ${ergebnisse.filter((r) => r.e === OK).length} bestätigt, ${ergebnisse.filter((r) => r.e === NEIN).length} widersprochen, ${ergebnisse.filter((r) => r.e === OFFEN).length} nicht abgedeckt`);
