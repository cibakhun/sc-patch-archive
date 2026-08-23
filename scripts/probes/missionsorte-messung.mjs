/* ============================================================
   missionsorte-messung.mjs — beantwortet EINE Frage: wie viele der
   Missionsfamilien in `src/data/missions.json` tragen eine Ortsangabe,
   und wie sieht der Ortskatalog aus?

   GEGEN WELCHES ARTEFAKT: ausschliesslich die committete
   `src/data/missions.json` — kein p4k, kein Browser, kein Netz. Diese
   Sonde rechnet NICHT nach, was `scripts/datamine-missions.mjs` tut,
   sondern liest, was er zuletzt geschrieben hat. Genau daran ist in der
   Messsitzung vor Phase 18 ein Befund gescheitert: eine Sonde hatte
   gegen eine eigene Nachbildung des Erzeugers geprueft statt gegen die
   echte Datei, und der Befund ("der Platzhalter-Parser laeuft gegen ein
   totes Format") war falsch.

   VERBINDLICHE DEFINITION "Familie mit Ortsangabe": nichtleeres
   `localities[]` nach Filterung von `null`/leeren Strings. Dieselbe
   Definition benutzt der Ableser `missionenMitOrt` in
   scripts/verify-metrics.mjs (Phase 18, Plan 01, Task 2) — beide muessen
   uebereinstimmen, sonst behaupten zwei Zahlen dasselbe und meinen
   Verschiedenes.

   EINE SONDE, KEIN TOR: liegt in scripts/probes/, wird von keinem
   npm-Ziel gerufen und haengt an keiner Strecke der Torkette (npm run
   gate) — scripts/verify-wiring.mjs prueft nur scripts/verify-*.mjs und
   scripts/audit-*.mjs, eine Datei unter scripts/probes/ beruehrt seine
   Bijektion nicht. Sie urteilt nicht (kein process.exit(1)), sie misst.

   Aufruf, jeweils aus dem Projektwurzelverzeichnis:

     node scripts/probes/missionsorte-messung.mjs
     node scripts/probes/missionsorte-messung.mjs --json
   ============================================================ */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const JSON_OUT = process.argv.includes('--json');
const SRC = resolve(ROOT, 'src', 'data', 'missions.json');

const db = JSON.parse(readFileSync(SRC, 'utf8'));
const families = Array.isArray(db.missions) ? db.missions : [];

// Verbindliche Definition: nichtleeres localities[] nach Filterung von
// null/leeren Strings.
const hatOrt = (f) => Array.isArray(f.localities) && f.localities.filter((x) => x != null && x !== '').length > 0;
const mitOrt = families.filter(hatOrt);

// Ortskatalog: id -> Trefferzahl (wie viele Familien fuehren diese ID
// in ihrem localities[]).
const katalogTreffer = new Map();
for (const f of families) {
  for (const id of f.localities ?? []) {
    if (id == null || id === '') continue;
    katalogTreffer.set(id, (katalogTreffer.get(id) ?? 0) + 1);
  }
}
const katalog = (db.localities ?? [])
  .map((l) => ({ id: l.id, name: l.name, treffer: katalogTreffer.get(l.id) ?? 0 }))
  .sort((a, b) => b.treffer - a.treffer);

// Token-Haeufigkeit ueber title, desc, titleVariants[].text — {...}-Chips.
const TOKEN_RE = /\{([^}]*)\}/g;
const tokenZaehler = new Map();
function zaehleTokens(text) {
  if (typeof text !== 'string' || !text) return;
  for (const m of text.matchAll(TOKEN_RE)) {
    const t = m[1];
    tokenZaehler.set(t, (tokenZaehler.get(t) ?? 0) + 1);
  }
}
for (const f of families) {
  zaehleTokens(f.title);
  zaehleTokens(f.desc);
  for (const v of f.titleVariants ?? []) zaehleTokens(v?.text);
}
const tokenListe = [...tokenZaehler.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .map(([token, n]) => ({ token, n }));

const ergebnis = {
  patch: db.meta?.patch ?? null,
  familien: families.length,
  familienMitOrt: mitOrt.length,
  ortskatalog: katalog,
  tokenHaeufigkeit: tokenListe,
};

if (JSON_OUT) {
  console.log(JSON.stringify(ergebnis, null, 2));
} else {
  console.log(`Patch-Kennung: ${ergebnis.patch}`);
  console.log(`Familien gesamt: ${ergebnis.familien}`);
  console.log(`Familien mit Ortsangabe (nichtleeres localities[]): ${ergebnis.familienMitOrt}`);
  console.log(`\nOrtskatalog (${katalog.length} Eintraege), id:name — Trefferzahl:`);
  for (const k of katalog) console.log(`  ${k.id}:${k.name} — ${k.treffer}`);
  console.log(`\nToken-Haeufigkeit (Top ${tokenListe.length}):`);
  for (const t of tokenListe) console.log(`  {${t.token}} — ${t.n}`);
}
