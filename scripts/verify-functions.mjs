/* ============================================================
   verify-functions.mjs — Schiene B: sind die Edge Functions im Repository
   auch die, die auf der Datenbank laufen?

   WARUM ES DEN GIBT: Edge Functions rollt niemand automatisch aus. Es gibt
   keinen Workflow dafuer; ausgerollt wird von Hand vom Entwicklungsrechner.
   Migrationen und Seite gehen ueber ihre eigenen Wege live, die Functions
   nicht zwingend mit. Im Gesamtaudit vom 05.11.2026 wichen Repository und
   Anlage voneinander ab (Einzelheiten im Bericht des Audits, nicht hier).
   Kein Tor verglich beides: verify:typen nimmt supabase/functions bewusst
   aus, verify:db-rights liest nur Rechte.

   GEPRUEFT (gegen die laufende Anlage, Grundsatz 7):
     FEHLER   eine Function aus supabase/functions fehlt auf der Anlage;
              ihr Verzeichnis hat einen Commit, der juenger ist als der
              letzte Deploy (Handlungsanweisung: ausrollen — immer richtig,
              auch bei einer reinen Kommentaraenderung, denn danach gilt
              wieder "Repository = Anlage");
              verify_jwt auf der Anlage weicht von supabase/config.toml ab
              (fehlt der Eintrag dort, gilt der Supabase-Standard true) — ein
              falscher Wert schaltet still die Anmeldung oder den
              Stripe-Webhook ab;
              weniger Functions als die Klinke.
     WARNUNG  eine Function laeuft auf der Anlage, steht aber nicht im
              Repository.

   AUFRUF (Schiene B: braucht git UND ein Zugriffstoken)
     node scripts/verify-functions.mjs                      live (Management API)
     node scripts/verify-functions.mjs --ref <projekt>      anderes Projekt
     node scripts/verify-functions.mjs --snapshot <datei>   gegen eine Momentaufnahme
                                                            (JSON der Function-Liste)
   Live braucht SUPABASE_ACCESS_TOKEN (dasselbe Token wie verify:db-rights).
   Vorgabe-Projekt: Ziel "live" aus scripts/lib/supabase-ziel.mjs.

   Exit: 0 gruen (WARNUNGEN erlaubt) · 1 FEHLER · 2 nicht geprueft (kein
   Token, kein git, flacher Klon ohne die noetige Geschichte, Netz/API-Fehler,
   unlesbare Momentaufnahme).
   ============================================================ */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { supabaseZiel } from './lib/supabase-ziel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FUNKTIONEN = 'supabase/functions';

// Untergrenze der geprueften Functions (Grundsatz 5). Stand 05.11.2026: 6.
export const KLINKE_FUNKTIONEN = 6;

/** verify_jwt je Function aus supabase/config.toml ([functions.<slug>]). */
export function jwtSoll(toml) {
  const soll = new Map();
  let aktuell = null;
  for (const zeile of toml.split(/\r?\n/)) {
    const z = zeile.replace(/#.*$/, '').trim();
    const kopf = /^\[functions\.([A-Za-z0-9_-]+)\]$/.exec(z);
    if (kopf) { aktuell = kopf[1]; continue; }
    if (/^\[/.test(z)) { aktuell = null; continue; }
    const wert = /^verify_jwt\s*=\s*(true|false)$/.exec(z);
    if (aktuell && wert) soll.set(aktuell, wert[1] === 'true');
  }
  return soll;
}

/** Die Functions im Repository: Verzeichnisse mit index.ts. */
export function repoFunktionen(root = ROOT) {
  const dir = resolve(root, FUNKTIONEN);
  return readdirSync(dir)
    .filter((n) => !n.startsWith('_') && statSync(join(dir, n)).isDirectory())
    .filter((n) => { try { return statSync(join(dir, n, 'index.ts')).isFile(); } catch { return false; } })
    .sort();
}

/** Zeitpunkt (ms) und Kennung des letzten Commits, der das Verzeichnis aendert
 *  (oder supabase/functions/_shared, das jede Function mitbringen wuerde).
 *  Committer-Datum, nicht Autor-Datum: ein Commit, der am Abend nach einem
 *  Deploy vom Nachmittag landet, ist juenger als der Deploy, auch wenn er
 *  frueher geschrieben wurde. Ein Rebase macht einen
 *  Stand dadurch scheinbar neu; dann ist erneutes Ausrollen harmlos. */
function letzterCommit(slug) {
  const out = execFileSync('git', ['log', '-1', '--format=%ct %h %H', '--', `${FUNKTIONEN}/${slug}`, `${FUNKTIONEN}/_shared`], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!out) return null;
  const [ct, h, voll] = out.split(' ');
  return { ms: Number(ct) * 1000, kennung: h, voll };
}

/** Grenz-Commits eines flachen Klons. Im flachen Klon "legt" der Grenz-Commit
 *  jede Datei an; git log nennt ihn dann als letzte Aenderung, obwohl die echte
 *  aelter sein kann (05.11.2026 im Cloud-Klon: eine Function zeigte den Rand
 *  statt ihres letzten Commits, 18 Minuten zu spaet).
 *  Ein solcher Zeitpunkt taugt nicht fuer ein Urteil. */
function flacheGrenzen() {
  const pfad = execFileSync('git', ['rev-parse', '--git-path', 'shallow'], { cwd: ROOT, encoding: 'utf8' }).trim();
  try { return new Set(readFileSync(resolve(ROOT, pfad), 'utf8').split(/\s+/).filter(Boolean)); } catch { return new Set(); }
}

/** Zeitstempel der API: Millisekunden (Zahl) oder ISO-Text. */
const alsMs = (v) => (typeof v === 'number' ? v : Date.parse(v));
const tag = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

/**
 * repo:    [{ slug, commit: { ms, kennung } | null }]
 * anlage:  Function-Liste der Management API ([{ slug, version, updated_at, verify_jwt }])
 * soll:    Map slug -> verify_jwt aus config.toml
 */
export function pruefe(repo, anlage, soll) {
  const fehler = [], warnungen = [], zeilen = [];
  const live = new Map(anlage.map((f) => [f.slug, f]));
  for (const { slug, commit } of repo) {
    const f = live.get(slug);
    if (!f) { fehler.push(`${slug}: steht im Repository, laeuft aber nicht auf der Anlage — ausrollen`); continue; }
    const deploy = alsMs(f.updated_at);
    const jwtIst = f.verify_jwt !== false;
    const jwtSollWert = soll.has(slug) ? soll.get(slug) : true;
    zeilen.push(`${slug.padEnd(24)} v${String(f.version ?? '?').padEnd(3)} ausgerollt ${Number.isFinite(deploy) ? tag(deploy) : '?'}   Repository ${commit ? `${tag(commit.ms)} (${commit.kennung})` : '—'}   verify_jwt ${jwtIst}`);
    if (!Number.isFinite(deploy)) fehler.push(`${slug}: Deploy-Zeitpunkt unlesbar (${f.updated_at})`);
    else if (commit && commit.ms > deploy) {
      fehler.push(`${slug}: Repository-Stand ${commit.kennung} vom ${tag(commit.ms)} ist juenger als der Deploy vom ${tag(deploy)} — die Anlage fuehrt eine alte Fassung, ausrollen`);
    }
    if (jwtIst !== jwtSollWert) {
      fehler.push(`${slug}: verify_jwt ist ${jwtIst}, supabase/config.toml verlangt ${jwtSollWert}${soll.has(slug) ? '' : ' (Standard, kein Eintrag)'}`);
    }
  }
  const imRepo = new Set(repo.map((r) => r.slug));
  for (const f of anlage) if (!imRepo.has(f.slug)) warnungen.push(`${f.slug}: laeuft auf der Anlage, steht aber nicht im Repository`);
  if (repo.length < KLINKE_FUNKTIONEN) fehler.push(`nur ${repo.length} Functions im Repository gefunden (Klinke ${KLINKE_FUNKTIONEN})`);
  return { fehler, warnungen, zeilen };
}

async function holeLive(ref, token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/functions`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

/** Momentaufnahme: die Liste selbst oder { functions: [...] } (Form von list_edge_functions). */
export function leseMomentaufnahme(text) {
  const j = JSON.parse(text);
  const liste = Array.isArray(j) ? j : j.functions;
  if (!Array.isArray(liste)) throw new Error('keine Function-Liste in der Momentaufnahme');
  return liste;
}

async function main() {
  const argv = process.argv.slice(2);
  const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  let anlage, quelle, repo, kopf;
  try {
    kopf = execFileSync('git', ['log', '-1', '--format=%h %s'], { cwd: ROOT, encoding: 'utf8' }).trim();
    repo = repoFunktionen().map((slug) => ({ slug, commit: letzterCommit(slug) }));
  } catch (e) {
    console.error(`\nverify-functions: NICHT GEPRUEFT -- git nicht nutzbar (${e.message})\n`);
    return 2;
  }
  const grenzen = flacheGrenzen();
  const unsicher = repo.filter((r) => r.commit && grenzen.has(r.commit.voll)).map((r) => r.slug);
  if (unsicher.length) {
    console.error(`\nverify-functions: NICHT GEPRUEFT -- flacher Klon, die Geschichte von ${unsicher.join(', ')} endet am Klon-Rand.`);
    console.error('  Erst vertiefen: git fetch --unshallow   (oder --shallow-since=<Datum vor dem aeltesten Deploy>)\n');
    return 2;
  }
  try {
    const snapshot = argOf('--snapshot');
    if (snapshot) {
      anlage = leseMomentaufnahme(readFileSync(resolve(process.cwd(), snapshot), 'utf8'));
      quelle = `Momentaufnahme ${snapshot}`;
    } else {
      const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
      if (!token) {
        console.error('\nverify-functions: NICHT GEPRUEFT -- SUPABASE_ACCESS_TOKEN fehlt (dasselbe Token wie verify:db-rights).');
        console.error('  Offline: node scripts/verify-functions.mjs --snapshot <datei>   (JSON der Function-Liste)\n');
        return 2;
      }
      const ref = argOf('--ref') || process.env.SUPABASE_PROJECT_REF?.trim() || supabaseZiel('live').ref;
      anlage = await holeLive(ref, token);
      quelle = `live, Projekt ${ref} (Management API)`;
    }
  } catch (e) {
    console.error(`\nverify-functions: NICHT GEPRUEFT -- ${e.message}\n`);
    return 2;
  }
  const soll = jwtSoll(readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8'));
  const erg = pruefe(repo, anlage, soll);
  console.log('\nverify-functions: Edge Functions im Repository gegen die Anlage');
  console.log(`    Quelle: ${quelle}`);
  console.log(`    Repository: ${kopf}`);
  console.log(`    Functions: ${repo.length} im Repository (Klinke ${KLINKE_FUNKTIONEN}), ${anlage.length} auf der Anlage\n`);
  for (const z of erg.zeilen) console.log('    ' + z);
  console.log('');
  for (const w of erg.warnungen) console.log(`WARNUNG: ${w}`);
  for (const f of erg.fehler) console.error(`FEHLER: ${f}`);
  console.log(`\nverify-functions: FEHLER ${erg.fehler.length} | WARNUNGEN ${erg.warnungen.length}`);
  return erg.fehler.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (e) => {
    console.error(`\nverify-functions: NICHT GEPRUEFT -- ${e?.stack || e}\n`);
    process.exit(2);
  });
}
