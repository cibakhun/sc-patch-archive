// Raeumt alte Versionen von ghcr.io/<owner>/sc-patch-archive auf und laesst
// dabei die letzten Live-Images stehen.
//
// Anlass 09.11.2026: Bis dahin lief hier actions/delete-package-versions mit
// "die 10 neuesten bleiben". Das Paket traegt aber zwei Sorten Images:
// Live-Images aus deploy-image.yml (Tag = Commit-Hash) und Vorschau-Images aus
// deploy-staging.yml (Tag staging-<Hash>). Zwischen zwei Live-Releases
// entstehen mehr als zehn Vorschau-Images, also fiel das vorige Live-Image bei
// jedem Release heraus: Lauf 42553428500 loeschte 6bb4ade6 in derselben
// Minute, in der 6c134200 live ging. Der Rueckweg "voriges Image in Coolify"
// war damit weg. Das Werkzeug kann nicht nach Tags filtern (ignore-versions
// prueft nur den Versionsnamen, bei Containern den Digest).
//
// Regeln:
//   - Live-Versionen (ein Tag aus 40 Hex-Zeichen): die LIVE neuesten bleiben.
//   - Vorschau-Versionen (Tag staging-<40 Hex>, kein Live-Tag): die STAGING
//     neuesten bleiben.
//   - Was latest oder staging traegt, bleibt immer; ebenso der Tag aus
//     --schonen (der eben gebaute Commit) und jede Version, die irgendein
//     Tag traegt, das keiner der beiden Sorten folgt, auch neben einem
//     Commit-Tag (unbekannt heisst: nicht anfassen; ein von Hand gesetzter
//     Rueckweg-Tag schuetzt sein Image).
//   - Versionen ohne Tag fallen nur, wenn sie mehr als eine Stunde aelter
//     sind als die aelteste bleibende Version. Teile eines Multi-Arch-Index
//     entstehen mit ihm im selben Push und bleiben so mit ihm stehen.
//   - Keine Live-Version in der Liste: Abbruch ohne Loeschen. Hoechstens
//     MAX_LOESCHEN Versionen je Lauf, die aeltesten zuerst; der Rest faellt
//     im naechsten Lauf.
//
// Aufruf (im Workflow; GH_TOKEN mit packages:write):
//   node .github/scripts/ghcr-aufraeumen.mjs --owner cibakhun --paket sc-patch-archive \
//     --live 5 --staging 10 --schonen <sha> [--trocken]
// Die Auswahl selbst ist auswahl() und in tests/e2e/ghcr-aufraeumen.test.js
// an Beispiellisten geprueft.

import { pathToFileURL } from 'node:url';

export const LIVE_TAG = /^[0-9a-f]{40}$/;
export const STAGING_TAG = /^staging-[0-9a-f]{40}$/;
export const MAX_LOESCHEN = 100;
const STUNDE = 3600e3;

const tagsVon = (v) => v?.metadata?.container?.tags ?? [];
const zeit = (v) => Date.parse(v.created_at);

export function auswahl(versionen, { live = 5, staging = 10, schonen = [] } = {}) {
  if (!Number.isInteger(live) || live < 1 || !Number.isInteger(staging) || staging < 1) {
    return { abbruch: `ungueltige Anzahl (live ${live}, staging ${staging}) — mindestens 1 je Sorte` };
  }
  const neu = [...versionen].sort((a, b) => zeit(b) - zeit(a));
  if (neu.some((v) => Number.isNaN(zeit(v)))) return { abbruch: 'Version ohne lesbares created_at — nichts geloescht' };

  const liveV = neu.filter((v) => tagsVon(v).some((t) => LIVE_TAG.test(t)));
  const stagingV = neu.filter((v) => !liveV.includes(v) && tagsVon(v).some((t) => STAGING_TAG.test(t)));
  const ohneTag = neu.filter((v) => tagsVon(v).length === 0);
  const sonst = neu.filter((v) => tagsVon(v).length && !liveV.includes(v) && !stagingV.includes(v));
  const zahlen = { gesamt: neu.length, live: liveV.length, staging: stagingV.length, ohneTag: ohneTag.length, sonst: sonst.length };

  if (!liveV.length) return { abbruch: 'keine Live-Version in der Liste — nichts geloescht', zahlen };

  // latest und staging folgen keiner der beiden Sorten und sind damit hier
  // mit erfasst, ebenso jedes andere Tag, das jemand von Hand setzt.
  const geschont = (v) => tagsVon(v).some((t) => schonen.includes(t) || !(LIVE_TAG.test(t) || STAGING_TAG.test(t)));
  const bleibt = new Set([
    ...liveV.slice(0, live),
    ...stagingV.slice(0, staging),
    ...sonst,
    ...neu.filter(geschont),
  ]);
  const grenze = Math.min(...[...bleibt].map(zeit)) - STUNDE;
  const alleWeg = [
    ...liveV.filter((v) => !bleibt.has(v)),
    ...stagingV.filter((v) => !bleibt.has(v)),
    ...ohneTag.filter((v) => !bleibt.has(v) && zeit(v) < grenze),
  ].sort((a, b) => zeit(a) - zeit(b));
  const weg = alleWeg.slice(0, MAX_LOESCHEN);
  return {
    zahlen,
    bleibt: neu.filter((v) => !alleWeg.includes(v)),
    weg,
    spaeter: alleWeg.length - weg.length,
    behalten: { live: Math.min(live, liveV.length), staging: Math.min(staging, stagingV.length) },
  };
}

function argument(name, standard) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : standard;
}

async function main() {
  const owner = argument('owner', process.env.GITHUB_REPOSITORY_OWNER);
  const paket = argument('paket', 'sc-patch-archive');
  const live = Number(argument('live', '5'));
  const staging = Number(argument('staging', '10'));
  const schonen = [argument('schonen', '')].filter(Boolean);
  const trocken = process.argv.includes('--trocken');
  const token = process.env.GH_TOKEN;
  if (!owner || !token) {
    console.log('::warning::GHCR-Aufraeumen: owner oder GH_TOKEN fehlt — nichts geprueft, nichts geloescht');
    return;
  }
  const basis = `https://api.github.com/users/${owner}/packages/container/${paket}/versions`;
  const kopf = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };

  const versionen = [];
  for (let seite = 1; seite <= 50; seite++) {
    const r = await fetch(`${basis}?per_page=100&page=${seite}`, { headers: kopf, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`Liste der Versionen: HTTP ${r.status} ${await r.text()}`);
    const teil = await r.json();
    versionen.push(...teil);
    if (teil.length < 100) break;
  }

  const a = auswahl(versionen, { live, staging, schonen });
  const z = a.zahlen;
  console.log(`GHCR-Aufraeumen ghcr.io/${owner}/${paket}${trocken ? ' (trocken, nichts wird geloescht)' : ''}`);
  if (z) console.log(`  Versionen: ${z.gesamt} (Live ${z.live}, staging ${z.staging}, ohne Tag ${z.ohneTag}, sonst ${z.sonst})`);
  if (a.abbruch) {
    console.log(`::warning::GHCR-Aufraeumen: ${a.abbruch}`);
    return;
  }
  console.log(`  bleiben: Live ${a.behalten.live} von hoechstens ${live}, staging ${a.behalten.staging} von hoechstens ${staging}, gesamt ${a.bleibt.length}`);
  const bleibendLive = a.bleibt.filter((v) => tagsVon(v).some((t) => LIVE_TAG.test(t)));
  for (const v of bleibendLive) console.log(`    Live bleibt: ${tagsVon(v).join(', ')}  (${v.created_at})`);
  console.log(`  zu loeschen: ${a.weg.length}${a.spaeter ? ` (weitere ${a.spaeter} im naechsten Lauf, hoechstens ${MAX_LOESCHEN} je Lauf)` : ''}`);
  let geloescht = 0;
  for (const v of a.weg) {
    const name = tagsVon(v).join(', ') || `ohne Tag ${String(v.name).slice(0, 19)}`;
    if (trocken) { console.log(`    wuerde loeschen: ${name}  (${v.created_at})`); continue; }
    const r = await fetch(`${basis}/${v.id}`, { method: 'DELETE', headers: kopf, signal: AbortSignal.timeout(30000) });
    if (r.status === 204) { geloescht++; console.log(`    geloescht: ${name}  (${v.created_at})`); }
    else console.log(`::warning::GHCR-Aufraeumen: ${name} nicht geloescht, HTTP ${r.status}`);
  }
  if (!trocken) console.log(`  geloescht: ${geloescht} von ${a.weg.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.log(`::warning::GHCR-Aufraeumen abgebrochen: ${e.message}`);
    process.exitCode = 1;
  });
}
