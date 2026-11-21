#!/usr/bin/env node
/* ============================================================
   verify-patch-vergleich.mjs — die committeten Patch-Vergleiche
   (src/data/patch-vergleich/) sind in sich stimmig.

   Kein git, kein Netz, kein Kindprozess: neu gerechnet wird mit
   scripts/patch-vergleich.mjs auf der Betreiber-Maschine. Hier steht nur,
   was eine Patchseite ohne Nachrechnen glauben darf:
     1  uebersicht.json nennt genau die Paardateien, mit denselben Zahlen.
     2  Die Paare bilden eine lueckenlose Kette.
     3  Je Datei: Zaehler = Eintraege, jeder Eintrag vollstaendig, keiner doppelt,
        jede Feldaenderung ist eine (vorher != nachher) mit Beschriftung.
     4  Bestand geht auf: nachher - vorher = neu - entfernt, je Art.
     5  Klinken: Paare und Eintraege.
     6  Hand-Ergaenzungen (ergaenzt/<nach>.json): vollstaendig, mit Beleg, und
        keine fuehrt ein Feld, das der Vergleich selbst rechnet (Zombie-Waechter;
        vorgefuehrt rot am 15.11.2026 mit einer Carrack-Radar-Ergaenzung).
   WARNUNG statt FEHLER: der juengste Vergleich endet nicht auf dem
   Datenstand von src/data/vehicles.json (Datenlauf ohne Vergleich).
   ============================================================ */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'src/data/patch-vergleich');

// Stand 15.11.2026: 4 Paare (4.9.0 -> 4.10.3), 791 Eintraege.
const MIN_PAARE = 4;
const MIN_EINTRAEGE = 791;

const KINDS = ['ship', 'price', 'item', 'blueprint', 'mission'];
const CHANGES = ['new', 'renamed', 'changed', 'removed'];

const fail = [];
const warnungen = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };
const lies = (n) => JSON.parse(readFileSync(resolve(DIR, n), 'utf8'));
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const dateien = readdirSync(DIR).filter((n) => /^[\d.]+__[\d.]+\.json$/.test(n));
const uebersicht = lies('uebersicht.json');

console.log('\n[1] uebersicht.json <-> Paardateien');
need(gleich([...uebersicht.paare.map((p) => p.datei)].sort(), [...dateien].sort()), `uebersicht.json nennt ${uebersicht.paare.map((p) => p.datei).join(', ')}, im Ordner liegen ${dateien.join(', ')}`);

console.log('[2] Kette der Paare');
for (let i = 1; i < uebersicht.paare.length; i++) {
  need(uebersicht.paare[i - 1].nach === uebersicht.paare[i].von, `Luecke in der Kette: ${uebersicht.paare[i - 1].nach} endet, ${uebersicht.paare[i].von} beginnt`);
}

console.log('[3] Eintraege je Datei   [4] Bestand geht auf');
let eintraegeGesamt = 0;
for (const zeile of uebersicht.paare) {
  const name = zeile.datei;
  let v;
  try { v = lies(name); } catch (e) { fail.push(`${name}: nicht lesbar (${e.message})`); continue; }
  const wo = (e) => `${name}: ${e.kind} ${e.id} (${e.name})`;
  need(v.von.version === zeile.von && v.nach.version === zeile.nach, `${name}: Kopf ${v.von.version} -> ${v.nach.version}, uebersicht ${zeile.von} -> ${zeile.nach}`);
  need(gleich(v.zaehler, zeile.zaehler) && gleich(v.bestand, zeile.bestand), `${name}: Zaehler oder Bestand weichen von uebersicht.json ab — scripts/patch-vergleich.mjs neu laufen lassen`);

  const gezaehlt = Object.fromEntries(KINDS.map((k) => [k, Object.fromEntries(CHANGES.map((c) => [c, 0]))]));
  const gesehen = new Set();
  for (const e of v.eintraege) {
    if (!KINDS.includes(e.kind) || !CHANGES.includes(e.change)) { fail.push(`${wo(e)}: unbekannte Art ${e.kind}/${e.change}`); continue; }
    gezaehlt[e.kind][e.change]++;
    const schluessel = `${e.kind}|${e.id}`;
    need(!gesehen.has(schluessel), `${wo(e)}: doppelt`);
    gesehen.add(schluessel);
    need(typeof e.id === 'string' && e.id && typeof e.name === 'string' && e.name, `${wo(e)}: ohne id oder Namen`);
    if (e.change === 'changed' || e.change === 'renamed') {
      need(Array.isArray(e.felder), `${wo(e)}: ohne felder`);
      for (const f of e.felder ?? []) {
        need(!gleich(f.vorher, f.nachher), `${wo(e)}: ${f.feld} gleich vorher und nachher (${JSON.stringify(f.vorher)})`);
        need(v.felder[e.kind]?.[f.feld]?.de && v.felder[e.kind]?.[f.feld]?.en, `${wo(e)}: Feld ${f.feld} ohne Beschriftung im Kopf`);
      }
    }
    if (e.change === 'changed') need(e.felder?.length > 0, `${wo(e)}: geaendert ohne ein einziges Feld`);
    if (e.change === 'renamed') need(e.nameVorher && e.nameVorher !== e.name, `${wo(e)}: umbenannt, aber nameVorher "${e.nameVorher}"`);
    if (e.change === 'new' && e.kind === 'price') need(e.angebote?.length > 0 && e.angebote.every((a) => a.preis > 0), `${wo(e)}: neu kaufbar ohne Angebot mit Preis`);
    if (e.change === 'new' && e.kind !== 'price') need(Array.isArray(e.werte), `${wo(e)}: neu ohne werte`);
  }
  need(gleich(gezaehlt, v.zaehler), `${name}: Kopf zaehlt ${JSON.stringify(v.zaehler)}, die Eintraege ergeben ${JSON.stringify(gezaehlt)}`);
  for (const k of KINDS) {
    const b = v.bestand[k];
    const saldo = gezaehlt[k].new - gezaehlt[k].removed;
    need(b && b.nachher - b.vorher === saldo, `${name}: ${k} Bestand ${b?.vorher} -> ${b?.nachher}, aber neu - entfernt = ${saldo}`);
  }
  eintraegeGesamt += v.eintraege.length;
  console.log(`    ${name}: ${v.eintraege.length} Eintraege (${v.von.ref} -> ${v.nach.ref})`);
}

console.log('[5] Klinken');
console.log(`    Paare — Soll: >= ${MIN_PAARE}   Ist: ${dateien.length}`);
console.log(`    Eintraege — Soll: >= ${MIN_EINTRAEGE}   Ist: ${eintraegeGesamt}`);
need(dateien.length >= MIN_PAARE, `nur ${dateien.length} Paare, Klinke ${MIN_PAARE}`);
need(eintraegeGesamt >= MIN_EINTRAEGE, `nur ${eintraegeGesamt} Eintraege, Klinke ${MIN_EINTRAEGE}`);

console.log('[6] Hand-Ergaenzungen (ergaenzt/<nach>.json)');
// Was eine Patchseite neben dem Vergleich behauptet, steht dort mit Beleg.
// Zombie-Waechter (Grundsatz 6): fuehrt der Vergleich das Feld inzwischen
// selbst, ist die Ergaenzung ueberholt und muss gestrichen werden.
const ERG_DIR = resolve(DIR, 'ergaenzt');
const ergDateien = existsSync(ERG_DIR) ? readdirSync(ERG_DIR).filter((n) => /^[\d.]+\.json$/.test(n)) : [];
const fahrzeugIds = new Set(JSON.parse(readFileSync(resolve(ROOT, 'src/data/vehicles.json'), 'utf8')).vehicles.map((x) => x.id));
const REITER = ['neu', 'geaendert', 'kaufbar', 'auftraege', 'bauplaene', 'entfernt'];
let ergGesamt = 0;
for (const n of ergDateien) {
  let erg;
  try { erg = JSON.parse(readFileSync(resolve(ERG_DIR, n), 'utf8')); } catch (e) { fail.push(`ergaenzt/${n}: nicht lesbar (${e.message})`); continue; }
  const paar = uebersicht.paare.find((p) => p.nach === erg.nach && p.von === erg.von);
  need(`${erg.nach}.json` === n && paar, `ergaenzt/${n}: kein Vergleich ${erg.von} -> ${erg.nach} in uebersicht.json`);
  need(/^https:\/\//.test(erg.beleg?.h ?? '') && erg.beleg?.t, `ergaenzt/${n}: ohne Beleg (beleg.t, beleg.h)`);
  if (!paar) continue;
  const v = lies(paar.datei);
  const ids = new Set();
  for (const x of erg.eintraege ?? []) {
    const wo = `ergaenzt/${n}: ${x.id}`;
    need(x.id && !ids.has(x.id), `${wo}: id fehlt oder doppelt`);
    ids.add(x.id);
    need(['ship', 'thema'].includes(x.kind), `${wo}: Art ${x.kind} (erlaubt: ship, thema)`);
    need(x.label && x.nachher && x.feld, `${wo}: ohne label, feld oder nachher`);
    need(x.en?.label && x.en?.nachher, `${wo}: ohne englischen Text (en.label, en.nachher)`);
    need(REITER.includes(x.reiter), `${wo}: Reiter ${x.reiter} unbekannt`);
    if (x.kind === 'ship') need(fahrzeugIds.has(x.ziel), `${wo}: Fahrzeug ${x.ziel} nicht in src/data/vehicles.json`);
    if (x.link) need(/^\/[a-z0-9/-]+\.html$/.test(x.link), `${wo}: Link ${x.link} ist kein Seitenpfad`);
    const kinds = x.kind === 'ship' ? ['ship'] : KINDS.filter((k) => k !== 'price');
    const berechnet = kinds.filter((k) => v.felder[k]?.[x.feld]);
    need(!berechnet.length, `${wo}: der Vergleich ${paar.datei} fuehrt "${x.feld}" jetzt selbst (${berechnet.join(', ')}) — Ergaenzung streichen, die Seite rechnet den Wert`);
    if (x.kind === 'ship') {
      const e = v.eintraege.find((y) => y.kind === 'ship' && y.id === x.ziel);
      const f = e?.felder?.find((y) => y.feld === x.feld) ?? e?.werte?.find((y) => y.feld === x.feld);
      need(!f, `${wo}: ${x.ziel} hat im Vergleich ein Feld "${x.feld}" — Ergaenzung streichen`);
    }
  }
  ergGesamt += ids.size;
  console.log(`    ergaenzt/${n}: ${ids.size} Ergaenzungen gegen ${paar.datei} geprueft`);
}
console.log(`    Ergaenzungen gesamt: ${ergGesamt} in ${ergDateien.length} Datei(en)`);
const juengster = uebersicht.paare.at(-1);
if (juengster) {
  const fahrzeuge = JSON.parse(readFileSync(resolve(ROOT, 'src/data/vehicles.json'), 'utf8')).gameVersion ?? '';
  const cl = lies(juengster.datei).nach.cl?.vehicles;
  if (!cl || !fahrzeuge.includes(cl)) warnungen.push(`der juengste Vergleich endet auf CL ${cl}, src/data/vehicles.json steht auf ${fahrzeuge}: Paar in scripts/patch-vergleich.mjs (PAARE) ergaenzen und neu laufen lassen`);
}
for (const w of warnungen) console.log(`\nWARNUNG: ${w}`);

if (fail.length) {
  for (const f of fail) console.error(`FEHLER: ${f}`);
  console.error(`\nverify-patch-vergleich: ${fail.length} FEHLER\n`);
  process.exit(1);
}
console.log(`\nverify-patch-vergleich: ${dateien.length} Paare, ${eintraegeGesamt} Eintraege, ${ergGesamt} Hand-Ergaenzungen stimmig ✓\n`);
