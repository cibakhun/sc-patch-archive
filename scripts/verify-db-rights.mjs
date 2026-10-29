/* ============================================================
   verify-db-rights.mjs — Schiene B: die WIRKSAMEN Datenbankrechte von
   anon, authenticated und PUBLIC gegen das Soll in
   supabase/rights.expected.json.

   WARUM ES DEN GIBT: Supabase gibt jedem neuen Objekt in public ueber
   Standardrechte sofort alles an anon und authenticated. Am 29.10.2026 war
   genau das die Ursache dafuer, dass drei Profil-Views fuer Anonyme
   beschreibbar waren (20261029123218), obwohl jede Migration "grant select"
   schrieb. Die Migration 20261030100000 kappt die Standardrechte und setzt
   jedes Recht ausdruecklich. Dieses Tor haelt den Zustand fest: was live
   gilt, muss im Soll stehen, und das Soll steht im Repository neben den
   Migrationen. Konzept: docs/maschinelle-validierung.md, § 4.

   GEMESSEN wird gegen die DATENBANK, nicht gegen die Migrationsdateien
   (Grundsatz 7): supabase/rights.snapshot.sql fragt has_*_privilege() je
   Objekt und Rolle ab, also inklusive geerbter Rechte (PUBLIC,
   Mitgliedschaften), dazu die wirksamen Standardrechte fuer NEUE Objekte.

   URTEIL (Grundsatz 3):
     FEHLER   ein Recht ueber dem Soll (bei anon, authenticated oder PUBLIC),
              ein Objekt mit Rechten ohne Soll-Eintrag, eine Ausnahme ohne
              Anlass (Zombie), ein Soll-Eintrag mit Rechten ohne Begruendung
              oder mit unbekanntem Rechtenamen, weniger Objekte als die Klinke.
              Die Handlungsanweisung ist immer richtig: entziehen, oder in
              Migration UND Soll ausdruecklich eintragen.
     WARNUNG  ein Recht aus dem Soll fehlt live (die Seite koennte an der
              Stelle scheitern -- pruefen, nicht blind granten), ein Objekt
              ohne Rechte und ohne Soll-Eintrag, ein Soll-Eintrag ohne Objekt.

   AUFRUF
     node scripts/verify-db-rights.mjs                     live (Management API)
     node scripts/verify-db-rights.mjs --snapshot <datei>  gegen eine Momentaufnahme
     node scripts/verify-db-rights.mjs --save <datei>      live abfragen und speichern
     node scripts/verify-db-rights.mjs --print-sql         nur die Abfrage ausgeben
   Live braucht SUPABASE_ACCESS_TOKEN (persoenliches Zugriffstoken aus dem
   Supabase-Dashboard, Account > Access Tokens) in der Umgebung, optional
   SUPABASE_PROJECT_REF bzw. --ref; Vorgabe ist das Projekt aus src/consts.ts.
   Der Aufruf geht an den read-only-Endpunkt der Management API (Abfrage als
   supabase_read_only_user). Eine Momentaufnahme ist das JSON-Ergebnis von
   supabase/rights.snapshot.sql, z. B. aus dem SQL-Editor oder von --save.

   Exit: 0 gruen (WARNUNGEN erlaubt) · 1 FEHLER · 2 nicht geprueft (kein
   Token, Netz/API-Fehler, unlesbare Momentaufnahme).
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SOLL_DATEI = 'supabase/rights.expected.json';
export const ABFRAGE_DATEI = 'supabase/rights.snapshot.sql';

// Untergrenze der geprueften Objekte (Tabellen, Views, Sequenzen, Funktionen,
// Schemas, Standardrechte, Rollen). Darf nur nach OBEN wandern -- nach unten
// nur per Commit, der die Ursache nennt.
// Stand 30.10.2026: 51 (live gemessen, Migration 20261030100000).
export const KLINKE_OBJEKTE = 51;

export const ROLLEN = ['anon', 'authenticated', 'public'];

// Bekannte Rechtenamen je Objektart. Ein Tippfehler im Soll ("SELCT") wuerde
// sonst still als "fehlt live" (WARNUNG) durchlaufen.
const TAB = ['DELETE', 'INSERT', 'MAINTAIN', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'];
const SEQ = ['SELECT', 'UPDATE', 'USAGE'];
const RECHTE = {
  table: TAB,
  view: TAB,
  column: ['INSERT', 'REFERENCES', 'SELECT', 'UPDATE'],
  sequence: SEQ,
  function: ['EXECUTE'],
  schema: ['CREATE', 'USAGE'],
  default: [...new Set([...TAB, ...SEQ, 'EXECUTE'])],
  role: ['SUPERUSER', 'BYPASSRLS', 'CREATEROLE', 'CREATEDB', 'REPLICATION'],
};
const bekanntesRecht = (art, r) =>
  (RECHTE[art] ?? []).includes(r) || (art === 'role' && /^MEMBER:[a-z_][a-z0-9_]*$/.test(r));

const liste = (s) => (Array.isArray(s) ? s : String(s ?? '').split(','))
  .map((x) => String(x).trim()).filter(Boolean);

/** Fingerabdruck einer Momentaufnahme: md5 ueber die sortierten Zeilen.
 *  Dieselbe Formel laesst sich live in SQL nachrechnen (siehe Kopf von
 *  supabase/rights.snapshot.sql), damit klar ist, WELCHER Stand geprueft wurde. */
export function fingerabdruck(rows) {
  const zeilen = rows
    .map((r) => [r.kind, r.obj, r.anon ?? '', r.authenticated ?? '', r.public ?? ''].join('|'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return createHash('md5').update(zeilen.join('\n')).digest('hex');
}

/** Liest die Abfrage ohne Kommentarzeilen und ohne abschliessendes Semikolon. */
export function ladeAbfrage(root = ROOT) {
  return readFileSync(resolve(root, ABFRAGE_DATEI), 'utf8')
    .split(/\r?\n/).filter((z) => !/^\s*--/.test(z)).join('\n')
    .trim().replace(/;\s*$/, '');
}

/** Momentaufnahme aus Datei: ein Array von Zeilen oder {rows: [...]}. */
export function leseMomentaufnahme(text) {
  const j = JSON.parse(text);
  const rows = Array.isArray(j) ? j : Array.isArray(j?.rows) ? j.rows : null;
  if (!rows) throw new Error('kein Zeilen-Array (erwartet: [ {kind, obj, anon, authenticated, public}, ... ])');
  return rows;
}

/**
 * Kern: vergleicht Zeilen mit dem Soll. Rein, ohne Ein-/Ausgabe -- so laesst
 * es sich in tests/e2e ohne Datenbank pruefen.
 * @returns {{fehler: string[], warnungen: string[], zahlen: object, server: number|null}}
 */
export function pruefe(rows, soll) {
  const fehler = [], warnungen = [];
  const objekte = soll?.objekte && typeof soll.objekte === 'object' ? soll.objekte : null;
  if (!objekte) return { fehler: ['Soll-Datei ohne "objekte"'], warnungen, zahlen: {}, server: null };

  const meta = rows.find((r) => r?.kind === 'server');
  const server = meta && /^\d+$/.test(String(meta.obj)) ? Number(meta.obj) : null;
  // MAINTAIN gibt es erst ab PG 17. Ohne Kennzeile gilt der Live-Stand (17).
  const kenntMaintain = server === null || server >= 170000;

  /* ---- das Soll selbst ---- */
  let ausnahmen = 0;
  for (const [key, e] of Object.entries(objekte)) {
    const art = key.split(' ')[0];
    if (!RECHTE[art]) { fehler.push(`Soll "${key}": unbekannte Objektart "${art}"`); continue; }
    const fremd = Object.keys(e).filter((k) => !ROLLEN.includes(k) && !['warum', 'ausnahme'].includes(k));
    if (fremd.length) fehler.push(`Soll "${key}": unbekannte Felder ${fremd.join(', ')} (erlaubt: ${ROLLEN.join(', ')}, warum, ausnahme)`);
    let hatRechte = false;
    for (const g of ROLLEN) {
      for (const r of liste(e[g])) {
        hatRechte = true;
        if (!bekanntesRecht(art, r)) fehler.push(`Soll "${key}": ${g} nennt unbekanntes Recht "${r}"`);
      }
    }
    if (e.ausnahme !== undefined) {
      ausnahmen++;
      if (String(e.ausnahme).trim().length < 10) fehler.push(`Soll "${key}": Ausnahme ohne Anlass (mindestens ein Satz)`);
      if (!hatRechte) fehler.push(`Soll "${key}": Ausnahme ohne geduldetes Recht -- Ausnahme streichen`);
    } else if (hatRechte && String(e.warum ?? '').trim().length < 10) {
      fehler.push(`Soll "${key}": Rechte ohne Begruendung ("warum") -- wer braucht sie?`);
    }
  }

  /* ---- die Datenbank gegen das Soll ---- */
  const gesehen = new Set();
  let rollenzeilen = 0, einzelrechte = 0, objektzahl = 0;
  for (const r of rows) {
    if (!r || typeof r.kind !== 'string' || typeof r.obj !== 'string') {
      fehler.push(`unlesbare Zeile in der Momentaufnahme: ${JSON.stringify(r)}`);
      continue;
    }
    if (r.kind === 'server') continue;
    const key = `${r.kind} ${r.obj}`;
    if (gesehen.has(key)) { fehler.push(`${key}: doppelt in der Momentaufnahme`); continue; }
    gesehen.add(key);
    objektzahl++;
    const e = objekte[key];
    if (!e) {
      const offen = ROLLEN.filter((g) => liste(r[g]).length).map((g) => `${g}: ${liste(r[g]).join(',')}`);
      if (offen.length) {
        fehler.push(`${key}: kein Soll-Eintrag, aber ${offen.join(' · ')} -- in der Migration entziehen ` +
          `oder ausdruecklich granten UND in ${SOLL_DATEI} eintragen`);
      } else {
        warnungen.push(`${key}: kein Soll-Eintrag (ohne Rechte, unkritisch) -- in ${SOLL_DATEI} nachtragen`);
      }
      for (const g of ROLLEN) { rollenzeilen++; einzelrechte += liste(r[g]).length; }
      continue;
    }
    for (const g of ROLLEN) {
      rollenzeilen++;
      const ist = new Set(liste(r[g]));
      const sollG = new Set(liste(e[g]).filter((p) => kenntMaintain || p !== 'MAINTAIN'));
      einzelrechte += ist.size;
      const zuviel = [...ist].filter((p) => !sollG.has(p));
      const fehlt = [...sollG].filter((p) => !ist.has(p));
      if (zuviel.length) {
        fehler.push(`${key}: ${g} hat ${zuviel.join(',')} ueber dem Soll -- entziehen, oder in Migration und ${SOLL_DATEI} begruenden`);
      }
      if (fehlt.length) {
        if (e.ausnahme !== undefined) {
          fehler.push(`${key}: Ausnahme ohne Anlass -- ${g} hat ${fehlt.join(',')} nicht mehr; Ausnahme in ${SOLL_DATEI} anpassen`);
        } else {
          warnungen.push(`${key}: ${g} fehlt ${fehlt.join(',')} laut Soll -- pruefen, ob die Seite an dieser Stelle scheitert`);
        }
      }
    }
  }
  // Unter der Klinke ist die Quelle kaputt, nicht das Soll: dann keine
  // Einzelmeldung je fehlendem Objekt, nur der eine FEHLER unten.
  const fehlend = Object.keys(objekte).filter((key) => !gesehen.has(key));
  if (objektzahl >= KLINKE_OBJEKTE) {
    for (const key of fehlend) warnungen.push(`${key}: steht im Soll, fehlt in der Datenbank (umbenannt/geloescht?) -- Soll bereinigen`);
  }

  /* ---- Selbstauskunft + Klinke ---- */
  if (objektzahl < KLINKE_OBJEKTE) {
    fehler.push(`nur ${objektzahl} Objekte in der Momentaufnahme, Klinke ${KLINKE_OBJEKTE} (${fehlend.length} Soll-Eintraege ohne Gegenstueck) -- Abfrage oder Quelle kaputt, nicht die Klinke senken`);
  }
  const sollZahl = Object.keys(objekte).length;
  if (sollZahl < KLINKE_OBJEKTE) {
    fehler.push(`nur ${sollZahl} Soll-Eintraege, Klinke ${KLINKE_OBJEKTE}`);
  }
  return {
    fehler,
    warnungen,
    zahlen: { objekte: objektzahl, rollenzeilen, einzelrechte, soll: sollZahl, ausnahmen },
    server,
  };
}

/* ---------- Live-Abfrage ueber die Management API ---------- */
function projektRef(argRef) {
  if (argRef) return argRef;
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF.trim();
  const consts = readFileSync(resolve(ROOT, 'src/consts.ts'), 'utf8');
  const m = consts.match(/https:\/\/([a-z0-9]{20})\.supabase\.co/);
  if (!m) throw new Error('Projekt-Ref weder in --ref, SUPABASE_PROJECT_REF noch src/consts.ts gefunden');
  return m[1];
}

async function holeLive(ref, token, sql) {
  // Nur der read-only-Endpunkt (Abfrage als supabase_read_only_user). Bewusst
  // KEIN Rueckfall auf den allgemeinen Endpunkt: der fuehrt die Abfrage aus
  // dem Repository mit Schreibrechten aus, und das Token gilt fuer das ganze
  // Konto. Antwortet der Endpunkt nicht (er ist bei Supabase als Beta
  // gefuehrt), endet das Tor mit Exit 2 -- offline weiter mit --snapshot.
  const url = `https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/database/query/read-only`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${text.slice(0, 300)}`);
  return { rows: leseMomentaufnahme(text), weg: 'read-only' };
}

/* ---------- Hauptlauf ---------- */
async function main() {
  const argv = process.argv.slice(2);
  const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const sql = ladeAbfrage();
  if (argv.includes('--print-sql')) { console.log(sql); return 0; }

  const soll = JSON.parse(readFileSync(resolve(ROOT, SOLL_DATEI), 'utf8'));
  const snapshot = argOf('--snapshot');
  let rows, quelle;
  try {
    if (snapshot) {
      rows = leseMomentaufnahme(readFileSync(resolve(process.cwd(), snapshot), 'utf8'));
      quelle = `Momentaufnahme ${snapshot}`;
    } else {
      const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
      if (!token) {
        console.error('\nverify-db-rights: NICHT GEPRUEFT -- SUPABASE_ACCESS_TOKEN fehlt.');
        console.error('  Setzen (Supabase-Dashboard > Account > Access Tokens) oder offline pruefen:');
        console.error(`  node scripts/verify-db-rights.mjs --snapshot <datei>   (Ergebnis von ${ABFRAGE_DATEI})\n`);
        return 2;
      }
      const ref = projektRef(argOf('--ref'));
      const live = await holeLive(ref, token, sql);
      rows = live.rows;
      quelle = `live, Projekt ${ref} (Management API, Endpunkt ${live.weg})`;
      const save = argOf('--save');
      if (save) { writeFileSync(resolve(process.cwd(), save), JSON.stringify(rows, null, 1) + '\n'); quelle += `, gespeichert in ${save}`; }
    }
  } catch (e) {
    const grund = e?.cause?.code || e?.cause?.message;
    console.error(`\nverify-db-rights: NICHT GEPRUEFT -- ${e.message}${grund ? ` (${grund})` : ''}\n`);
    return 2;
  }

  const erg = pruefe(rows, soll);
  console.log('\nverify-db-rights: wirksame Rechte von anon, authenticated, PUBLIC gegen ' + SOLL_DATEI);
  console.log(`    Quelle: ${quelle}`);
  console.log(`    Server: ${erg.server ? `server_version_num ${erg.server}` : 'unbekannt (keine Kennzeile, MAINTAIN wird erwartet wie live)'}`);
  console.log(`    Fingerabdruck: ${rows.length} Zeilen, md5 ${fingerabdruck(rows)}`);
  console.log(`\n[1] Objekte geprueft: ${erg.zahlen.objekte ?? 0}   Klinke: ${KLINKE_OBJEKTE}   Soll-Eintraege: ${erg.zahlen.soll ?? 0} (davon Ausnahmen: ${erg.zahlen.ausnahmen ?? 0})`);
  console.log(`[2] Rollenzeilen: ${erg.zahlen.rollenzeilen ?? 0}   Einzelrechte gesehen: ${erg.zahlen.einzelrechte ?? 0}`);
  for (const w of erg.warnungen) console.log(`WARNUNG: ${w}`);
  for (const f of erg.fehler) console.error(`FEHLER: ${f}`);
  console.log(`\nverify-db-rights: FEHLER ${erg.fehler.length} | WARNUNGEN ${erg.warnungen.length}`);
  return erg.fehler.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (e) => {
    console.error(`\nverify-db-rights: NICHT GEPRUEFT -- ${e?.stack || e}\n`);
    process.exit(2);
  });
}
