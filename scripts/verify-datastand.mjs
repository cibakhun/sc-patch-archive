// verify-datastand.mjs — Kreuzvergleich der committeten Patch-Kennungen (D-04).
//
// WARUM ES DEN GIBT: `missions.json` stand auf CL 12326004, waehrend CL 12344265
// installiert war — ein Rueckstand von 18.261 Changelists, der niemandem auffiel,
// weil kein Tor die sechs Datenstaende GEGENEINANDER hielt. Alle bisherigen Tore
// (z.B. verify:mining) halten EINEN Datenstand gegen den EINEN installierten
// Client und koennen deshalb in der Bauumgebung, wo es keine Spielinstallation
// gibt, gar nichts sagen. Dieses Tor braucht keine Data.p4k: es liest
// AUSSCHLIESSLICH committete JSON-Dateien und haelt ihre Kennungen gegeneinander —
// und wirkt damit genau dort, wo ueber das Auslieferungsbild entschieden wird.
//
// Geprueft werden sechs maschinell erzeugte Datenstaende (Missionen, Mining,
// Crafting, Item-Katalog, Refinery, Zerlegung) und ein handgepflegter (Wikelo).
//
// ACHT ZUSICHERUNGEN:
//   1  Bestand und Selbstauskunft — wie viele Datenstaende gelesen wurden.
//   2  Jede maschinelle Kennung ist vorhanden und nichtleer.
//   3  Jede maschinelle Kennung traegt eine Changelist (letzte Ziffernfolge
//      >= 6 Stellen — eine gierige ERSTE Fundstelle traefe bei
//      "4.9.0-live.12344265" die falsche Zahl).
//   4  Jeder Datenstand liegt auf oder ueber seiner Klinke.
//   5  Verzug im Kreuzvergleich gegen die juengste Changelist, Toleranz
//      MAX_VERZUG, benannte Ausnahmen erlaubt.
//   6  Zombie-Waechter: eine Ausnahme, die die Toleranz wieder einhaelt, muss
//      raus.
//   7  Begleitdatei-Deckung: Zaehlfeld = Array-Laenge der begleiteten Datei.
//   8  Handpflege (FEHLER bei fehlendem Feld) + Client-Abgleich (WARNUNG).
//
// TOLERANZ-REGEL (MAX_VERZUG): eine OBERGRENZE, wandert nur nach UNTEN — nach
// oben nur per Commit, dessen Botschaft die Ursache nennt. Das ist umgekehrt zu
// einer Klinke (KLINKEN, Grundsatz 5: nur nach oben).
//
//   node scripts/verify-datastand.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_P4K } from './lib/p4k.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (rel) => JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
const read = (file) => {
  try { return { ok: true, json: rd(file) }; } catch (e) { return { ok: false, error: e }; }
};

const fail = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };
const warn = [];
const say = (msg) => { warn.push(msg); console.log(`    WARNUNG: ${msg}`); };

/* ---------- Datentabellen ---------- */

// Sechs maschinell erzeugte Datenstaende. Die Zeile "Zerlegung" ist eine der
// beiden Begleitdatei-Zeilen: dismantling-items.json ist ein nacktes Array ohne
// Kopf (Pitfall 3, 18-RESEARCH.md), die Kennung sitzt in einer eigenen Datei
// daneben — companion prueft, dass beide zueinander gehoeren (Zusicherung 7).
const STANDS = [
  { id: 'Missionen', file: 'src/data/missions.json', get: (j) => j?.meta?.patch },
  { id: 'Mining', file: 'assets/mining-db.json', get: (j) => j?.game_version },
  { id: 'Crafting', file: 'assets/crafting-db.json', get: (j) => j?.version },
  { id: 'Item-Katalog', file: 'assets/universal-items.json', get: (j) => j?.gameVersion },
  { id: 'Refinery', file: 'assets/refinery-data.json', get: (j) => j?.meta?.gameVersion },
  {
    id: 'Zerlegung',
    file: 'assets/dismantling-items.meta.json',
    get: (j) => j?.gameVersion,
    companion: { file: 'assets/dismantling-items.json', countField: 'itemCount' },
  },
];

// Ein handgepflegter Datenstand — keine Changelist (waere eine Luege ueber
// einen Auslesevorgang, den es nicht gab), stattdessen reviewedVersion/
// reviewedAt. Zweite Begleitdatei-Zeile (Zusicherung 7).
const HANDPFLEGE = [
  {
    id: 'Wikelo',
    file: 'assets/wikelo-trades.meta.json',
    versionField: 'reviewedVersion',
    dateField: 'reviewedAt',
    companion: { file: 'assets/wikelo-trades.json', countField: 'entryCount' },
  },
];

// Sperrklinken je maschinellem Datenstand — nur nach OBEN wandern
// (Grundsatz 5). Gesetzt aus der in 18-03-SUMMARY.md protokollierten
// Ausgangslage: alle sechs Datenstaende nennen dort CL 12344265. Ein
// Rueckfall darunter heisst, ein Erzeuger ist gegen einen aelteren Client
// gelaufen — die Handlungsanweisung ("neu erzeugen") ist dann immer richtig.
// Nach unten nur per Commit, dessen Botschaft die Ursache nennt.
// 27.08.2026, Datenlauf auf sc-alpha-4.10.0 (Client CL 12519617): alle sechs
// Staende gemeinsam von CL 12344265 auf 12519617 gehoben — nach OBEN, wie es
// Grundsatz 5 verlangt.
const KLINKEN = {
  Missionen: 12519617,
  Mining: 12519617,
  Crafting: 12519617,
  'Item-Katalog': 12519617,
  Refinery: 12519617,
  Zerlegung: 12519617,
};

// Toleranz des Kreuzvergleichs (Zusicherung 5) — anders als eine Klinke eine
// OBERGRENZE: wandert nur nach UNTEN, nach oben nur per Commit mit genannter
// Ursache. Anlass: der Rueckstand, der am 23.08.2026 unbemerkt blieb
// (missions.json auf CL 12326004, installierter Client auf 12344265), betrug
// 18.261 Changelists. Die Toleranz muss deutlich darunter liegen, sonst faengt
// sie genau diesen Fall nicht — und weit genug oben, dass ein einzelner
// nachgezogener Bereich am Patchtag nicht sofort alle uebrigen als verspaetet
// meldet.
const MAX_VERZUG = 10000;

// Benannte Ausnahmen vom Verzugs-Kreuzvergleich (Zusicherung 5/6). Jede
// Zeile: die Kennung eines Datenstands aus STANDS, ein Anlass als
// VOLLSTAENDIGER Satz. Jede Ausnahme hier ist eine Schuld, keine Loesung —
// Zusicherung 6 reisst, sobald ein eingetragener Datenstand die Toleranz
// wieder von sich aus einhaelt.
const AUSNAHMEN = [
  // { kennung: 'Beispiel', anlass: 'Vollstaendiger Satz, der den Rueckstand erklaert.' },
];

/* ---------- Lauf ---------- */

console.log('\n=== verify-datastand: Kreuzvergleich der committeten Patch-Kennungen (D-04) ===');

const standReads = STANDS.map((s) => ({ ...s, data: read(s.file) }));
const handReads = HANDPFLEGE.map((h) => ({ ...h, data: read(h.file) }));

console.log('\n[1] Bestand und Selbstauskunft');
const maschinellGelesen = standReads.filter((s) => s.data.ok).length;
const handpflegeGelesen = handReads.filter((h) => h.data.ok).length;
console.log(`    maschinelle Datenstaende gelesen — Soll: 6   Ist: ${maschinellGelesen}`);
console.log(`    handgepflegte Datenstaende gelesen — Soll: 1   Ist: ${handpflegeGelesen}`);
need(maschinellGelesen >= 6, `nur ${maschinellGelesen} maschinelle Datenstaende lesbar (Soll 6) — das Tor laeuft leer. Ursache klaeren, nicht die Untergrenze senken.`);
need(handpflegeGelesen >= 1, `nur ${handpflegeGelesen} handgepflegte Datenstaende lesbar (Soll 1) — das Tor laeuft leer. Ursache klaeren, nicht die Untergrenze senken.`);
for (const s of standReads) if (!s.data.ok) fail.push(`${s.id} (${s.file}): Datei nicht lesbar — ${s.data.error.message}`);
for (const h of handReads) if (!h.data.ok) fail.push(`${h.id} (${h.file}): Datei nicht lesbar — ${h.data.error.message}`);

console.log('\n[2] Kennung vorhanden und nichtleer');
const kennungen = new Map();
for (const s of standReads) {
  if (!s.data.ok) continue;
  const val = s.get(s.data.json);
  kennungen.set(s.id, val);
  need(
    typeof val === 'string' && val.trim() !== '',
    `${s.id} (${s.file}): Kennung fehlt oder ist leer — ein stiller Ruecksprung auf einen Leerwert (z.B. bei fehlender Quellkennung in der Refinery-Erzeugung) waere sonst nicht von einer echten Kennung zu unterscheiden`,
  );
}
console.log(`    geprueft: ${kennungen.size}   ohne gueltige Kennung — Soll: 0`);

console.log('\n[3] Kennung traegt eine Changelist');
const CL_RX = /\d{6,}/g;
const changelists = new Map();
for (const [id, val] of kennungen) {
  if (typeof val !== 'string') continue;
  const matches = val.match(CL_RX);
  const cl = matches ? Number(matches[matches.length - 1]) : null;
  if (cl == null) {
    fail.push(`${id}: Kennung "${val}" enthaelt keine Ziffernfolge von mindestens sechs Stellen — keine ablesbare Changelist`);
    continue;
  }
  changelists.set(id, cl);
}
console.log(`    Kennungen mit ablesbarer Changelist — Soll: ${kennungen.size}   Ist: ${changelists.size}`);

console.log('\n[4] Klinke je Datenstand');
for (const [id, cl] of changelists) {
  const klinke = KLINKEN[id];
  if (klinke == null) continue;
  console.log(`    ${id}: CL ${cl}   Klinke ${klinke}`);
  need(cl >= klinke, `${id}: CL ${cl} liegt unter der Klinke ${klinke} — ein Erzeuger ist gegen einen aelteren Client gelaufen. Neu erzeugen, nicht die Klinke senken.`);
}

console.log('\n[5] Verzug im Kreuzvergleich');
const maschinelleCLs = [...changelists.entries()].filter(([id]) => id in KLINKEN);
const juengsteCL = maschinelleCLs.length ? Math.max(...maschinelleCLs.map(([, cl]) => cl)) : null;
const aeltesteCL = maschinelleCLs.length ? Math.min(...maschinelleCLs.map(([, cl]) => cl)) : null;
const ausnahmeIds = new Set(AUSNAHMEN.map((a) => a.kennung));
let groessterAbstand = 0;
for (const [id, cl] of maschinelleCLs) {
  const abstand = juengsteCL - cl;
  groessterAbstand = Math.max(groessterAbstand, abstand);
  console.log(`    ${id}: Abstand zur juengsten Changelist (${juengsteCL}) — Soll: <= ${MAX_VERZUG}   Ist: ${abstand}`);
  if (abstand > MAX_VERZUG) {
    if (ausnahmeIds.has(id)) {
      const a = AUSNAHMEN.find((x) => x.kennung === id);
      console.log(`      ⚠ als Ausnahme gefuehrt (Schuld): ${a.anlass}`);
    } else {
      fail.push(`${id}: Abstand ${abstand} liegt ueber der Toleranz ${MAX_VERZUG} (juengste Changelist ${juengsteCL}) — neu erzeugen oder als benannte Ausnahme in AUSNAHMEN eintragen`);
    }
  }
}

console.log('\n[6] Zombie-Waechter der Ausnahmen');
console.log(`    eingetragene Ausnahmen: ${AUSNAHMEN.length}`);
for (const a of AUSNAHMEN) {
  const cl = changelists.get(a.kennung);
  if (cl == null) {
    fail.push(`Ausnahme "${a.kennung}": kein Datenstand mit dieser Kennung gefunden — die Ausnahme zeigt ins Leere`);
    continue;
  }
  const abstand = juengsteCL - cl;
  if (abstand <= MAX_VERZUG)
    fail.push(`Ausnahme "${a.kennung}" haelt die Toleranz wieder ein (Abstand ${abstand} <= ${MAX_VERZUG}) — ihr Anlass ist erledigt, entfernen statt verlaengern`);
}

console.log('\n[7] Begleitdatei-Deckung');
const begleitZeilen = [...standReads, ...handReads].filter((s) => s.companion);
for (const s of begleitZeilen) {
  if (!s.data.ok) continue;
  const soll = s.data.json?.[s.companion.countField];
  const comp = read(s.companion.file);
  if (!comp.ok) { fail.push(`${s.id}: Begleitdatei ${s.companion.file} nicht lesbar — ${comp.error.message}`); continue; }
  const ist = Array.isArray(comp.json) ? comp.json.length : null;
  console.log(`    ${s.id}: ${s.companion.countField} (${s.file}) ${soll}   Laenge (${s.companion.file}) ${ist}`);
  need(ist != null, `${s.id}: Begleitdatei ${s.companion.file} ist kein Array`);
  if (ist != null)
    need(
      soll === ist,
      `${s.id}: Zaehlfeld ${s.companion.countField} (${soll}) weicht von der Laenge der begleiteten Datei ${s.companion.file} (${ist}) ab — die Kennung gehoert zu einem anderen Bestand als die Datei daneben`,
    );
}

console.log('\n[8] Handpflege und Client-Abgleich (beide WARNUNG, nie FEHLER)');
const juengsteStandId = maschinelleCLs.find(([, cl]) => cl === juengsteCL)?.[0];
const juengsteKennung = juengsteStandId ? kennungen.get(juengsteStandId) : null;
const VERSION_RX = /^\d+\.\d+\.\d+/;
const juengsteFassung = typeof juengsteKennung === 'string' ? juengsteKennung.match(VERSION_RX)?.[0] : null;

for (const h of handReads) {
  if (!h.data.ok) continue;
  const version = h.data.json?.[h.versionField];
  const datum = h.data.json?.[h.dateField];
  // FEHLER: fehlende Felder — die Handlungsanweisung ("eintragen") ist immer richtig.
  need(typeof version === 'string' && version.trim() !== '', `${h.id}: Feld ${h.versionField} fehlt oder ist leer — eintragen`);
  need(typeof datum === 'string' && datum.trim() !== '', `${h.id}: Feld ${h.dateField} fehlt oder ist leer — eintragen`);

  // WARNUNG: Verzug der genannten Fassung gegen die juengste maschinelle Fassung.
  if (typeof version === 'string' && version.trim() !== '' && juengsteFassung && version !== juengsteFassung) {
    say(`${h.id}: genannte Fassung "${version}" weicht von der juengsten maschinellen Fassung "${juengsteFassung}" ab — beim naechsten Ueberarbeiten nachsehen und ${h.versionField} nachziehen`);
  }
  // WARNUNG: das Datum des Nachsehens liegt mehr als 90 Tage zurueck.
  if (typeof datum === 'string' && datum.trim() !== '') {
    const dt = new Date(datum);
    if (!Number.isNaN(dt.getTime())) {
      const tage = Math.floor((Date.now() - dt.getTime()) / 86_400_000);
      if (tage > 90) say(`${h.id}: ${h.dateField} liegt ${tage} Tage zurueck (> 90) — Nachsehen faellig`);
    }
  }
}

// WARNUNG: Abgleich der juengsten committeten Changelist gegen den
// installierten Client — best-effort, hinter existsSync gegattert (Muster aus
// verify-mining.mjs). Sechs Datenstaende gegen den Client als FEHLER zu
// fuehren hiesse, dass am Tag jedes Spiel-Patches jeder Push blockiert ist,
// bis alle sechs Datenlaeufe gefahren sind — die Zaehne dieses Tors sitzen im
// Kreuzvergleich oben (Zusicherung 5), nicht hier.
const bmPath = resolve(dirname(DEFAULT_P4K), 'build_manifest.id');
if (existsSync(bmPath)) {
  try {
    const d = JSON.parse(readFileSync(bmPath, 'utf8'))?.Data ?? {};
    const clientCL = Number(d.RequestedP4ChangeNum);
    if (juengsteCL != null && Number.isFinite(clientCL) && clientCL !== juengsteCL) {
      say(`juengste committete Changelist (${juengsteCL}) stimmt nicht mit dem installierten Client (${clientCL}) ueberein — Datenlauf faellig`);
    } else {
      console.log(`    Client-Abgleich: juengste committete Changelist (${juengsteCL}) stimmt mit dem installierten Client ueberein`);
    }
  } catch {
    console.log('    (Client-Abgleich uebersprungen: build_manifest.id nicht lesbar)');
  }
} else {
  console.log('    (Client-Abgleich uebersprungen: keine lokale Spielinstallation gefunden)');
}

/* ---------- Schlusszeile ---------- */

if (fail.length) {
  console.error(`\nFAIL (${fail.length}):\n` + fail.map((f) => `  · ${f}`).join('\n') + '\n');
  process.exit(1);
}

const aeltesteId = maschinelleCLs.find(([, cl]) => cl === aeltesteCL)?.[0];
const aeltesteKennung = aeltesteId ? kennungen.get(aeltesteId) : null;

console.log(
  `\nOK — Datenstaende geprueft: ${maschinelleCLs.length} maschinell + ${handReads.length} handgepflegt · ` +
  `aelteste Kennung ${aeltesteKennung} (${aeltesteId}) · juengste Kennung ${juengsteKennung} (${juengsteStandId}) · ` +
  `groesster Abstand ${groessterAbstand} · ${AUSNAHMEN.length} Ausnahmen · ${warn.length} Warnungen\n`,
);
