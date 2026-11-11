// verify-loot-fundorte.mjs — Sind die bestaetigten Fundorte vollstaendig benannt
// und steht der Katalog auf dem Stand ihrer Rechnung?
//
// WARUM ES DEN GIBT: Seit 10.11.2026 (Vorschlag aus #feedback „Loot-only Items –
// Find Locations") zeigen Item-Seiten und Item Finder, WO ein Item als Loot
// entstehen kann — Ortsart und Himmelskoerper, Status „bestätigt". Die Kette hat
// drei Glieder, und jedes kann still reissen:
//   1. datamine:loot (PC) schreibt src/data/loot-fundorte.json — interne
//      Belegungsnamen, Himmelskoerper-Wurzeln, Profile je Item.
//   2. scripts/lib/loot-orte.mjs buendelt die Belegungen zu Ortsarten mit
//      Spielernamen (DE/EN) und benennt die Himmelskoerper.
//   3. apply:loot-fundorte traegt das Ergebnis in assets/universal-items.json
//      ein (Kopf `fundorte`, je Item `fund`); src/lib/items.ts und
//      assets/item-finder-app.js machen daraus Zeilen.
// Ein neuer Patch bringt neue Belegungen (Glied 2 kennt sie nicht), ein
// sync:items baut den Katalog ohne `fund` neu (Glied 3 fehlt), eine Umbenennung
// in loot-orte.mjs erreicht den Katalog nicht. Jedes davon sieht auf der Seite
// aus wie „hat eben keinen Fundort".
//
// ZUSICHERUNGEN (alle FEHLER — die Handlung dahinter ist immer richtig):
//   1  Bestand und Selbstauskunft: Kopf, Belegungen, Profile, Items; Klinken.
//   2  Jede Belegung der Daten hat eine Ortsart oder steht benannt unter
//      VERSTECKT (sonst bricht apply ohnehin ab — hier mit Liste).
//   3  Zombie-Waechter: jede Belegung in ORTSARTEN und VERSTECKT kommt in den
//      Daten noch vor. Eine verwaiste Zuordnung heisst: das Spiel hat
//      umbenannt, und die neue Fassung steht vermutlich unter (2).
//   4  Jede Himmelskoerper-Wurzel der Daten hat einen Namen in KOERPER.
//   5  Der Katalog steht auf dem Stand der Rechnung: wendeFundorteAn() auf
//      einer Kopie ergibt denselben Kopf und dasselbe `fund` je Item wie die
//      committete Datei, dieselben Kennzahlen — sonst `npm run apply:loot-fundorte`.
//   6  Kein `fund` an einem Item, das laut Spiel nicht als Loot entsteht
//      (game.lootable === false) — die Exklusiv-Aussage gewinnt.
//   7  Gegen das Artefakt (Grundsatz 7): dist/assets/universal-items.json
//      traegt denselben Kopf und dieselbe Zahl Profile-Traeger wie assets/.
//
// Schiene A: kein git, kein Netz, keine Data.p4k — nur committete JSON und dist/.
//
//   node scripts/verify-loot-fundorte.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORTSARTEN, VERSTECKT, KOERPER, ortsartVon, wendeFundorteAn } from './lib/loot-orte.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FD = 'src/data/loot-fundorte.json';
const DB = 'assets/universal-items.json';
const DIST_DB = 'dist/assets/universal-items.json';
const rd = (rel) => JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));

// Klinken (Grundsatz 5): nur nach OBEN; nach unten nur per Commit, dessen
// Botschaft die Ursache nennt. Erster Lauf 10.11.2026 (sc-alpha-4.10.2
// @12913470): 4.398 Spiel-Items, 54 Belegungen, 3.068 Katalog-Items mit
// bestaetigtem Fundort, 20 Ortsarten. Die grossen Zahlen knapp darunter —
// ein Patch darf ein paar Items aus den Loot-Tabellen nehmen.
const KLINKEN = { spielItems: 4300, belegungen: 50, katalogItems: 3000, ortsarten: 20 };

const fail = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };
const liste = (xs, n = 12) => xs.slice(0, n).join(', ') + (xs.length > n ? ` … (+${xs.length - n})` : '');

console.log('\n=== verify:loot-fundorte — bestaetigte Fundorte benannt und im Katalog? ===');
console.log(`Artefakt: ${FD} + ${DB}${existsSync(resolve(ROOT, DIST_DB)) ? ` + ${DIST_DB}` : ''}`);

/* ---------- [1] Bestand ---------- */
console.log('\n[1] Bestand und Selbstauskunft');
let fd = null, db = null;
try { fd = rd(FD); } catch (e) { fail.push(`${FD} nicht lesbar — ${e.message}`); }
try { db = rd(DB); } catch (e) { fail.push(`${DB} nicht lesbar — ${e.message}`); }

if (fd) {
  const patch = fd.meta?.patch;
  need(typeof patch === 'string' && /\d{6,}/.test(patch), `${FD}: meta.patch "${patch}" traegt keine Changelist`);
  const bel = Object.keys(fd.belegungen ?? {});
  const profile = fd.profile ?? [];
  const items = Object.entries(fd.items ?? {});
  console.log(`    Patch ${patch}`);
  console.log(`    Belegungen ${bel.length} (Klinke ${KLINKEN.belegungen})   Profile ${profile.length}   Spiel-Items ${items.length} (Klinke ${KLINKEN.spielItems})`);
  need(bel.length >= KLINKEN.belegungen, `nur ${bel.length} Belegungen in ${FD}, Klinke ${KLINKEN.belegungen} — Ursache klaeren, nicht die Klinke senken`);
  need(items.length >= KLINKEN.spielItems, `nur ${items.length} Spiel-Items in ${FD}, Klinke ${KLINKEN.spielItems} — Ursache klaeren, nicht die Klinke senken`);
  // Form: Profile sind Listen bekannter Belegungen, Items zeigen auf ein Profil.
  const belSet = new Set(bel);
  const profilFremd = profile.flatMap((p, i) => (Array.isArray(p) && p.length ? p : [null]).filter((b) => !belSet.has(b)).map((b) => `#${i}:${b}`));
  need(!profilFremd.length, `${FD}: Profil nennt unbekannte oder keine Belegung — ${liste(profilFremd)}`);
  const itemFremd = items.filter(([, p]) => !Number.isInteger(p) || p < 0 || p >= profile.length).map(([g]) => g);
  need(!itemFremd.length, `${FD}: ${itemFremd.length} Item(s) zeigen auf kein Profil — ${liste(itemFremd)}`);
  const ohneWurzel = bel.filter((b) => !Object.keys(fd.belegungen[b]?.wurzeln ?? {}).length);
  need(!ohneWurzel.length, `${FD}: Belegung ohne Himmelskoerper — ${liste(ohneWurzel)} (der Datenlauf nimmt nur Belegungen mit Welt auf)`);

  /* ---------- [2] Jede Belegung zugeordnet ---------- */
  console.log('\n[2] Jede Belegung hat eine Ortsart oder ist benannt versteckt');
  const unbekannt = bel.filter((b) => ortsartVon(b) === undefined);
  const versteckt = bel.filter((b) => ortsartVon(b) === null);
  console.log(`    zugeordnet ${bel.length - unbekannt.length - versteckt.length}   versteckt ${versteckt.length}   ohne Ortsart — Soll: 0   Ist: ${unbekannt.length}`);
  for (const b of unbekannt)
    fail.push(`Belegung "${b}" hat keine Ortsart — in scripts/lib/loot-orte.mjs unter ORTSARTEN (Spielername DE/EN) oder mit Grund unter VERSTECKT eintragen`);

  /* ---------- [3] Zombie-Waechter ---------- */
  console.log('\n[3] Zombie-Waechter: jede Zuordnung kommt in den Daten noch vor');
  const zugeordnet = [...ORTSARTEN.flatMap((a) => a.belegungen.map((b) => [a.key, b])), ...Object.keys(VERSTECKT).map((b) => ['VERSTECKT', b])];
  const verwaist = zugeordnet.filter(([, b]) => !belSet.has(b));
  console.log(`    Zuordnungen ${zugeordnet.length} (${ORTSARTEN.length} Ortsarten, ${Object.keys(VERSTECKT).length} versteckt)   verwaist — Soll: 0   Ist: ${verwaist.length}`);
  for (const [k, b] of verwaist)
    fail.push(`Zuordnung ${k} → "${b}" zeigt ins Leere — die Belegung steht nicht mehr in ${FD}; entfernen (oder die neue Schreibweise aus [2] dort eintragen)`);
  const leereArt = ORTSARTEN.filter((a) => !a.belegungen.some((b) => belSet.has(b))).map((a) => a.key);
  need(!leereArt.length, `Ortsart ohne eine einzige Belegung in den Daten — ${leereArt.join(', ')}`);

  /* ---------- [4] Himmelskoerper benannt ---------- */
  console.log('\n[4] Jeder Himmelskoerper hat einen Namen');
  const wurzeln = new Set(bel.flatMap((b) => Object.keys(fd.belegungen[b].wurzeln)));
  const namenlos = [...wurzeln].filter((w) => KOERPER[w] === undefined).sort();
  console.log(`    Wurzeln in den Daten ${wurzeln.size}   Namen in KOERPER ${Object.keys(KOERPER).length}   ohne Namen — Soll: 0   Ist: ${namenlos.length}`);
  for (const w of namenlos) fail.push(`Himmelskoerper "${w}" hat keinen Namen — in KOERPER (scripts/lib/loot-orte.mjs) eintragen`);
}

/* ---------- [5] Katalog auf dem Stand der Rechnung ---------- */
let soll = null;
if (fd && db && !fail.length) {
  console.log('\n[5] Katalog steht auf dem Stand der Rechnung');
  const kopie = JSON.parse(JSON.stringify(db));
  let z = null;
  try { z = wendeFundorteAn(kopie, fd); } catch (e) { fail.push(`wendeFundorteAn bricht ab — ${e.message}`); }
  if (z) {
    soll = kopie;
    need(JSON.stringify(db.fundorte) === JSON.stringify(kopie.fundorte),
      `${DB}: Kopf "fundorte" weicht von der Rechnung ab (Patch ${db.fundorte?.patch ?? '—'} gegen ${kopie.fundorte.patch}, Profile ${db.fundorte?.profile?.length ?? '—'} gegen ${kopie.fundorte.profile.length}) — npm run apply:loot-fundorte`);
    const abw = [];
    for (let i = 0; i < kopie.items.length; i++) if ((db.items[i]?.fund ?? null) !== (kopie.items[i].fund ?? null)) abw.push(kopie.items[i].id);
    need(!abw.length, `${DB}: ${abw.length} Item(s) mit anderem Fundort-Profil als die Rechnung — ${liste(abw)} — npm run apply:loot-fundorte`);
    for (const k of ['withObtain', 'catalogOnly', 'withFundort'])
      need(db.counts?.[k] === kopie.counts?.[k], `${DB}: counts.${k} ${db.counts?.[k]} gegen ${kopie.counts?.[k]} aus der Rechnung — npm run apply:loot-fundorte`);
    console.log(`    Items mit Fundort ${z.items} (Klinke ${KLINKEN.katalogItems})   Zeilen ${z.zeilen}   Profile ${z.profile}   Ortsarten ${z.arten} (Klinke ${KLINKEN.ortsarten})`);
    console.log(`    laut Spiel nicht als Loot (keine Zeile, Exklusiv gewinnt): ${z.gesperrt}   nur in versteckten Belegungen: ${z.nurVersteckt}`);
    console.log(`    abweichende Items — Soll: 0   Ist: ${abw.length}`);
    need(z.items >= KLINKEN.katalogItems, `nur ${z.items} Katalog-Items mit bestaetigtem Fundort, Klinke ${KLINKEN.katalogItems} — Ursache klaeren, nicht die Klinke senken`);
    need(z.arten >= KLINKEN.ortsarten, `nur ${z.arten} Ortsarten in Gebrauch, Klinke ${KLINKEN.ortsarten} — Ursache klaeren, nicht die Klinke senken`);
  }
}

/* ---------- [6] Exklusiv gewinnt ---------- */
if (db) {
  console.log('\n[6] Kein Fundort an einem Item, das laut Spiel kein Loot ist');
  const falsch = db.items.filter((i) => i.fund != null && i.game?.lootable === false).map((i) => i.id);
  console.log(`    Soll: 0   Ist: ${falsch.length}`);
  need(!falsch.length, `${falsch.length} Item(s) mit Fundort, obwohl game.lootable === false — ${liste(falsch)}`);
}

/* ---------- [7] Gegen das Artefakt ---------- */
if (db) {
  console.log('\n[7] Gegen das Artefakt: dist/ traegt denselben Stand');
  if (!existsSync(resolve(ROOT, DIST_DB))) {
    fail.push(`${DIST_DB} fehlt — erst bauen (npm run build), dann pruefen`);
  } else {
    const dist = rd(DIST_DB);
    const n = (d) => d.items.filter((i) => i.fund != null).length;
    console.log(`    assets/: ${n(db)} Items mit Profil, Patch ${db.fundorte?.patch ?? '—'}   dist/: ${n(dist)}, Patch ${dist.fundorte?.patch ?? '—'}`);
    need(JSON.stringify(dist.fundorte) === JSON.stringify(db.fundorte) && n(dist) === n(db),
      `${DIST_DB} weicht von ${DB} ab (Kopf oder Zahl der Items mit Profil) — neu bauen`);
  }
}

if (fail.length) {
  console.error(`\nverify:loot-fundorte: ${fail.length} FEHLER`);
  for (const f of fail) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\nOK — ${fd.meta.patch}: ${Object.keys(fd.belegungen).length} Belegungen, ${soll ? soll.counts.withFundort : '—'} Katalog-Items mit bestaetigtem Fundort, Zuordnung und Katalog stimmig`);
