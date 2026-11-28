/* ============================================================
   review-nachweis.mjs — setzt den Status `review-nachweis` auf den
   Head-Commit eines Pull Requests.

   Laeuft in .github/workflows/review-nachweis.yml bei jedem PR-Ereignis
   (Push, Ready, Label, Review). Holt bei GitHub, was das Urteil braucht,
   und laesst es von scripts/lib/review-nachweis.mjs faellen. Regeln und
   Ablauf: docs/review-workflow.md.

   Was es ausser dem Status tut:
     - Neuer Push auf einen PR mit `review-ready`: Label ab. Ein Label
       steht so nie fuer einen aelteren Stand, und jeder Stand wird genau
       einmal angefordert.
     - `review-ready` auf einem fertigen, noch nicht angeforderten Stand:
       einmal `@coderabbitai review` schreiben (mit Marke je Stand).
       CodeRabbit prueft das Repo nicht mehr automatisch. Nach einem
       Rate-Limit gibt erst ein neu gesetztes Label eine weitere frei.
     - `nachweis-neu`: nur Anstoss fuer einen neuen Lauf, wird abgenommen.
     - Label `ohne-cubic` auf normalen PRs, nicht auf kritischen: cubic
       bleibt so den kritischen vorbehalten, sobald cubic.yaml auf main
       das Label beachtet (reviews.ignore.pr_labels). Bis dahin ohne
       Wirkung.
     - Ein Bericht-Kommentar je PR (wird ueberschrieben, nicht gestapelt).
       Er traegt auch die gesehenen CodeRabbit-Bereiche, damit eine Runde
       ohne Kommentare ihre Abdeckung nicht verliert, wenn CodeRabbit
       seine Zusammenfassung ueberschreibt.

   Wartet, solange ein angeforderter Review am Head noch laeuft (hoechstens
   WARTEN_MIN Minuten), damit das Ende eines Reviews ohne Kommentare nicht
   unbemerkt bleibt: dieses Ende loest kein Workflow-Ereignis aus.

   Lokal, nur lesend (kein Status, kein Label, kein Kommentar):
       GH_TOKEN=… node scripts/review-nachweis.mjs --pr 473 --trocken [--auch-geschlossen]
   (--auch-geschlossen bewertet auch gemergte PRs, zum Nachmessen an echten
   Daten; wartet trocken nie.)
   ============================================================ */
import {
  bewerte, bereicheAusText, ledgerLesen, berichtText, kritischeGruende, VERGLEICH_MAX,
  LABEL_BEREIT, LABEL_OHNE_CUBIC, LABEL_NEU, STATUS_KONTEXT, BERICHT_MARKE,
  anforderungNoetig, anforderungsMarke,
  zuletztGesetzt, seitenweise, statusMitKontrolle,
  rundenLesen, beschreibungMitPr, nachweisFuerPr, ersteZusammenfassung, labelAelter,
  angeforderteStaende, rundenAusAnforderungen, bestaetigteRunden, ledgerBereiche, ANFORDERUNG_KONTEN,
  altesLedger, abweichendeDateien, verlaufZumHead,
} from './lib/review-nachweis.mjs';
import { appendFileSync } from 'node:fs';

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const TROCKEN = process.argv.includes('--trocken');
const REPO = process.env.REPO || 'cibakhun/sc-patch-archive';
const NUMMER = Number(arg('--pr') || process.env.PR_NUMMER);
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
// Token des Agentenkontos, nur fuer `@coderabbitai review`: CodeRabbit
// ignoriert Befehle von github-actions[bot] (live auf #477, 26.11.2026).
const ANFORDERUNG_TOKEN = process.env.ANFORDERUNG_TOKEN || '';
const EREIGNIS = process.env.EREIGNIS || '';
const AKTION = process.env.AKTION || '';
const LABEL = process.env.LABEL || '';
const LAUF = process.env.LAUF_URL || '';
const QUELLE = process.env.QUELLE || 'lokal';
const KONTEN = (process.env.FREIGABE_KONTEN || 'cibakhun').split(',').map((x) => x.trim()).filter(Boolean);
const WARTEN_MIN = Number(process.env.WARTEN_MIN || 40);
const TAKT_S = Number(process.env.TAKT_S || 60);
const BOT = 'github-actions[bot]';
const CR = 'coderabbitai[bot]';

if (!Number.isInteger(NUMMER) || NUMMER <= 0) { console.error('PR-Nummer fehlt (--pr oder PR_NUMMER)'); process.exit(2); }
if (!TOKEN) { console.error('GH_TOKEN fehlt'); process.exit(2); }

let anfragen = 0;
async function api(pfad, { method = 'GET', body, token = TOKEN } = {}) {
  anfragen++;
  // Zeitlimit je Anfrage: eine haengende Anfrage liesse den Job sonst ins
  // Limit von 50 Minuten laufen, und ein abgebrochener Job fuehrt den
  // Fehlerschritt nicht aus (Opus-Review #477, Runde 2).
  const res = await fetch(`https://api.github.com/${pfad}`, {
    method,
    signal: AbortSignal.timeout(60_000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'review-nachweis',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === 'DELETE' && res.status === 404) return null;
  if (!res.ok) throw new Error(`${method} ${pfad}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}
// Ganze Liste oder Abbruch: eine still abgeschnittene Liste gaebe es nicht.
const alle = (pfad, max = 30) => seitenweise(
  (seite) => api(`${pfad}${pfad.includes('?') ? '&' : '?'}per_page=100&page=${seite}`),
  { max, was: pfad },
);
const R = `repos/${REPO}`;
const schlaf = (s) => new Promise((r) => setTimeout(r, s * 1000));

/* Alle Pruefer-Laeufe eines Commits. `filter=all`, sonst liefert GitHub nur
   den juengsten Lauf je Name, und ein spaeterer Skip oder ein Rate-Limit
   verdraengt einen fertigen Review desselben Commits (Review #477). */
async function laeufeFuer(sha) {
  const laeufe = await seitenweise(
    async (seite) => (await api(`${R}/commits/${sha}/check-runs?filter=all&per_page=100&page=${seite}`)).check_runs || [],
    { max: 5, was: `Check-Laeufe von ${sha.slice(0, 7)}` },
  );
  const eigene = laeufe.filter((l) => ['coderabbitai', 'cubic-dev-ai'].includes(l.app?.slug));
  /* Zweig der Check-Suite je cubic-Lauf: eine Suite gibt es je App und
     Commit einmal, ihr `head_branch` ist der Zweig des ersten Pushs. Ein
     Commit, den ein anderer PR zuerst gepusht hat (Merge eines fremden
     Zweigs), traegt dessen Lauf (Opus-Review #477, Runde 5). */
  const zweige = new Map();
  if (eigene.some((l) => l.app.slug === 'cubic-dev-ai')) {
    for (const x of (await api(`${R}/commits/${sha}/check-suites?per_page=100`)).check_suites || []) zweige.set(x.id, x.head_branch ?? null);
  }
  return eigene.map((l) => ({
    app: l.app.slug, name: l.name, status: l.status, conclusion: l.conclusion, title: l.output?.title || '', summary: l.output?.summary || '', started_at: l.started_at, completed_at: l.completed_at,
    ...(l.app.slug === 'cubic-dev-ai' ? { zweig: zweige.get(l.check_suite?.id) ?? null } : {}),
  }));
}

// Andere offene PRs mit genau diesem Head: der Status gilt je Commit.
async function gleicheStaende(head) {
  return (await alle(`${R}/pulls?state=open`, 3)).filter((p) => p.head.sha === head && p.number !== NUMMER).map((p) => p.number);
}

// Spitze eines Zweigs, als fester Commit fuer den Vergleich.
async function zielSpitze(ref) {
  const sha = (await api(`${R}/branches/${ref.split('/').map(encodeURIComponent).join('/')}`)).commit?.sha;
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error(`Spitze von ${ref} nicht lesbar`);
  return sha;
}

const cacheLaeufe = new Map();
const cacheVorfahr = new Map();
const cacheConfig = new Map();
async function sammle(pr, { nurHeadNeu = false, versuch = 1 } = {}) {
  const head = pr.head.sha;
  const commitListe = (await alle(`${R}/pulls/${NUMMER}/commits`, 3)).map((c) => ({ sha: c.sha, parents: (c.parents || []).map((p) => p.sha) }));
  // Voll (250): die API liefert nicht alle, bewerte bleibt ohnehin rot.
  const voll = commitListe.length >= 250;
  const commits = voll ? commitListe.map((c) => c.sha) : verlaufZumHead(commitListe, head);
  /* Texte vor den Laeufen: so ist der Lauf-Stand mindestens so neu wie die
     Zusammenfassung, deren Bereich er belegen soll (zielGeprueft). */
  const kommentareRoh = await alle(`${R}/issues/${NUMMER}/comments`, 10);
  const reviews = await alle(`${R}/pulls/${NUMMER}/reviews`, 10);
  // Ziele der Bereiche aus CodeRabbits Zusammenfassungen: ihr Beleg ist der
  // juengste Lauf am Ziel, also werden sie bei jedem Nachpollen neu gelesen.
  // Sonst saehe ein spaeter gestarteter und abgebrochener Lauf am Ziel nur
  // der naechste Prozess (Review #477, Runde 4).
  const zf = ersteZusammenfassung(kommentareRoh.filter((k) => k.user?.login === CR));
  const zieleZusammenfassung = new Set(zf ? bereicheAusText(zf.body).map((r) => r.b) : []);
  const laeufeJeCommit = {};
  for (const c of commits) {
    // Beim Nachpollen: der Head immer, ein Ziel einer Zusammenfassung immer,
    // ein anderer Stand nur, solange einer seiner Laeufe noch nicht fertig
    // war (sonst bliebe er im Zwischenspeicher "laeuft", und sein Bereich
    // fiele aus der Kette; Review #477).
    const offen = (cacheLaeufe.get(c) || []).some((l) => l.status !== 'completed');
    if (!cacheLaeufe.has(c) || c === head || !nurHeadNeu || offen || zieleZusammenfassung.has(c)) cacheLaeufe.set(c, await laeufeFuer(c));
    laeufeJeCommit[c] = cacheLaeufe.get(c);
  }
  /* Dateien fest am Stand: ein Vergleich zweier fester Commits (Basis des
     PRs ... Head) haengt nicht davon ab, wohin der Head inzwischen zeigt.
     Die PR-Liste dagegen gilt dem jeweils aktuellen Head; kehrte er waehrend
     der Erhebung zurueck (A -> B -> A), stammte sie unbemerkt von B, und
     eine Liste nur aus geloeschten Dateien verriete das nicht einmal ueber
     contents_url (Review #477, Runde 4). Gemessen an 21 PRs (#460 bis
     #480): Vergleich und PR-Liste nennen dieselben Dateien mit demselben
     Status und Blob. Der Vergleich liefert hoechstens 300 Dateien
     (GitHub-Doku); ab 300 gilt die PR-Liste (bis 3000), gebunden ueber
     abweichendeDateien und die Dateizahl des PRs. Geloeschte Dateien bindet
     auch das nicht; deshalb ist ein PR ab 300 Dateien kritisch
     (kritischeGruende).
     Basis ist die Spitze des Zielzweigs, nicht `base.sha` des PRs: GitHub
     zieht `base.sha` nicht nach, wenn der Zielzweig weiterrueckt (gemessen
     an #477: `base.sha` 6e0b4af, staging 64 Commits weiter; Review #477,
     Runde 6). Der Merge nimmt die Zusammenfuehrungsbasis mit der Spitze.
     Geschlossene PRs (nur trocken, zum Nachmessen): `base.sha`, die Basis
     beim Merge; die Spitze enthielte den gemergten PR schon (0 Dateien). */
  const spitze = pr.state === 'open' ? await zielSpitze(pr.base.ref) : pr.base.sha;
  const vergleich = await api(`${R}/compare/${spitze}...${head}`);
  const fest = vergleich.files || [];
  // Gegen diese Basis gilt die Dateiliste; headNochGleich prueft sie vor jedem Schreiben.
  basis = { ref: pr.base.ref, sha: spitze, zusammen: vergleich.merge_base_commit?.sha || null };
  const vollstaendig = fest.length < VERGLEICH_MAX;
  const dateien = vollstaendig ? fest : await alle(`${R}/pulls/${NUMMER}/files`, 30);
  /* Gehoeren Commits und Dateien zum festgehaltenen Head? Ein Head, der
     waehrend der Erhebung wechselt und zurueckkehrt (A -> B -> A), besteht
     jede spaetere Head-Pruefung, und ein kritischer Stand A koennte mit den
     Daten von B als normal gelten (Review #477, Runde 4). Die Dateien bindet
     der feste Vergleich, ab 300 Dateien abweichendeDateien und die
     Dateizahl. Bei den Commits muss der Head dabei sein, und jeder Commit
     muss in seinem Verlauf liegen (verlaufZumHead), ausser die Liste ist
     voll (250, siehe bewerte).
     Passt es nicht: ist der Head ein anderer, uebernimmt dessen Lauf; sonst
     kurz warten und alles neu erheben (GitHub rechnet die Liste nach einem
     Push nach). Nach drei Versuchen bricht der Lauf ab, ohne ein Urteil zu
     schreiben; den roten Status "Auswertung gescheitert" setzt der letzte
     Schritt des Workflows. */
  /* Auch unter 300: die Zahl muss zur Dateizahl des PRs passen. Ein leerer
     oder gekuerzter Vergleich saehe sonst nach "nichts Kritisches" aus
     (Opus-Review #477, Runde 4; gemessen an #402, #477, #481: gleich). */
  const fremd = vollstaendig ? (fest.length === pr.changed_files ? 0 : 1) : abweichendeDateien(dateien, fest, head) + (dateien.length === pr.changed_files ? 0 : 1);
  const headFehlt = !voll && !commits.includes(head);
  const fremdeCommits = voll || headFehlt ? 0 : commitListe.length - commits.length;
  if (fremd || headFehlt || fremdeCommits) {
    const jetzt = await api(`${R}/pulls/${NUMMER}`);
    if (jetzt.head.sha !== head || jetzt.state !== 'open') {
      console.log('Neuer Stand oder PR geschlossen waehrend der Erhebung — der Lauf dazu uebernimmt.');
      process.exit(0);
    }
    const was = `${fremd} Dateiabweichungen, ${fremdeCommits} Commits aus einem anderen Stand${headFehlt ? ', Head fehlt in der Commit-Liste' : ''}`;
    if (versuch >= 3) throw new Error(`Dateien oder Commits passen nach ${versuch} Versuchen nicht zum Stand ${head.slice(0, 7)} (${was})`);
    console.log(`Dateien oder Commits nicht vom Stand ${head.slice(0, 7)} (${was}), erhebe neu (Versuch ${versuch + 1}).`);
    await schlaf(Math.min(5, TAKT_S));
    // Mit der Dateizahl des frischen PR-Abrufs: GitHub rechnet sie nach einem Push nach.
    return sammle({ ...pr, changed_files: jetzt.changed_files }, { nurHeadNeu: false, versuch: versuch + 1 });
  }
  const gleicherStand = await gleicheStaende(head);
  const kommentare = kommentareRoh.map((k) => ({ id: k.id, author: k.user?.login, body: k.body || '', url: k.html_url, erstellt: k.created_at, geaendert: k.updated_at || k.created_at }));
  const bericht = kommentare.find((k) => k.author === BOT && k.body.includes(BERICHT_MARKE));
  if (bericht && altesLedger(bericht.body)) console.log('Ledger der ersten Fassung im Bericht: nicht gelesen, dessen Bereiche zaehlen nur mit eigenem Beleg.');
  // Jeder Bereich traegt seine Quelle: abgegebene Reviews und das Ledger
  // sind feste Belege, jeder andere Text nur fuer den juengsten Lauf.
  const bereiche = [
    ...reviews.filter((r) => r.user?.login === CR).flatMap((r) => bereicheAusText(r.body).map((x) => ({ ...x, quelle: 'review' }))),
    ...[ersteZusammenfassung(kommentare.filter((k) => k.author === CR))].filter(Boolean).flatMap((k) => bereicheAusText(k.body).map((x) => ({ ...x, quelle: 'zusammenfassung', stand: Date.parse(k.geaendert || '') }))),
    ...(bericht ? ledgerLesen(bericht.body).map((x) => ({ ...x, quelle: 'ledger' })) : []),
  ];
  const imPr = new Set(commits);
  /* Andere PRs vom selben Zweig (offen oder geschlossen): ihre cubic-Laeufe
     haengen an denselben Commits. Ein Lauf in ihrer Lebenszeit ist nicht
     zuzuordnen und zaehlt nicht (Opus-Review #477, Runde 5). */
  const besitzer = REPO.split('/')[0];
  const fremdeZeiten = (await alle(`${R}/pulls?state=all&head=${encodeURIComponent(`${besitzer}:${pr.head.ref}`)}`, 3))
    .filter((p) => p.number !== NUMMER).map((p) => [Date.parse(p.created_at || ''), p.closed_at ? Date.parse(p.closed_at) : Infinity]);
  /* CodeRabbit liest `.coderabbit.yaml` aus dem PR-Zweig. Weicht sie an einem
     geprueften Zwischenstand von der Basis ab, kann eine Runde Teile
     ausgeblendet haben, auch wenn der Enddiff sie nicht mehr aendert
     (Opus-Review #477, Runde 5). */
  // Je fester Commit unveraenderlich: einmal lesen.
  const crConfig = async (ref) => {
    if (!cacheConfig.has(ref)) cacheConfig.set(ref, (await api(`${R}/contents/.coderabbit.yaml?ref=${ref}`).catch((e) => (/HTTP 404/.test(e.message) ? {} : Promise.reject(e))))?.sha || null);
    return cacheConfig.get(ref);
  };
  const configBasis = await crConfig(basis.zusammen || basis.sha);
  const zwischenKritisch = [];
  for (const b of [...new Set(reviews.filter((r) => r.user?.login === CR).flatMap((r) => bereicheAusText(r.body)).map((r) => r.b))].filter((b) => imPr.has(b) && b !== head)) {
    if ((await crConfig(b)) !== configBasis) zwischenKritisch.push(`CodeRabbit-Konfiguration an geprueftem Zwischenstand ${b.slice(0, 7)} geaendert`);
  }
  // Runden, die ein Umschreiben ueberdauern: CodeRabbits Reviews bleiben am
  // PR, ihr Bereich endet am geprueften Stand; dazu das eigene Ledger und
  // die Laeufe jedes angeforderten Stands, der nicht mehr im PR liegt
  // (deckt eine Runde ohne Review-Eintrag, deren Lauf abbrach, bevor er
  // das Ledger schrieb). Nicht lesbar zaehlt als Runde.
  const alteAnf = angeforderteStaende(kommentare).filter((sha) => !imPr.has(sha));
  const laeufeAlt = {};
  for (const sha of alteAnf) {
    if (!cacheLaeufe.has(sha)) {
      try { cacheLaeufe.set(sha, await laeufeFuer(sha)); } catch (e) { console.log(`Laeufe von ${sha.slice(0, 7)} nicht lesbar, zaehlt als Runde: ${e.message}`); cacheLaeufe.set(sha, null); }
    }
    laeufeAlt[sha] = cacheLaeufe.get(sha);
  }
  const ausAnf = rundenAusAnforderungen(alteAnf, laeufeAlt);
  const fruehereRunden = [
    ...reviews.filter((r) => r.user?.login === CR).flatMap((r) => bereicheAusText(r.body)).map((r) => r.b),
    ...(bericht ? rundenLesen(bericht.body) : []),
    ...ausAnf.bestaetigt,
  ];
  // Nicht lesbar: zaehlt fuer diese Entscheidung, nicht fuers Ledger.
  const vorlaeufigeRunden = ausAnf.vorlaeufig;
  const vorfahren = {};
  for (const a of new Set(bereiche.map((r) => r.a).filter((a) => !imPr.has(a)))) {
    if (!cacheVorfahr.has(a)) {
      let ok = false;
      // Liegt a auf dem Zielzweig? (a ist Vorfahr seiner Spitze)
      try { ok = ['ahead', 'identical'].includes((await api(`${R}/compare/${a}...${encodeURIComponent(pr.base.ref)}`)).status); } catch { ok = false; }
      cacheVorfahr.set(a, ok);
    }
    vorfahren[a] = cacheVorfahr.get(a);
  }
  const d = {
    pr: {
      number: pr.number, draft: pr.draft, base_ref: pr.base.ref, head_ref: pr.head.ref,
      head_sha: head, labels: pr.labels.map((l) => l.name),
    },
    commits, dateien, laeufeJeCommit, bereiche, vorfahren, kommentare, freigabeKonten: KONTEN, gleicherStand,
    bereitGesetzt, fruehereRunden, vorlaeufigeRunden, fremdeZeiten, zwischenKritisch,
    // cubic-Laeufe zaehlen erst ab Eroeffnung des PRs bzw. letztem Wechsel des Zielzweigs.
    kontextAb: Math.max(...[pr.created_at, ...ereignisse.filter((e) => e.event === 'base_ref_changed').map((e) => e.created_at)].map((t) => Date.parse(t || '')).filter(Number.isFinite)),
  };
  if (pr.base.ref === 'main' && pr.head.ref === 'staging') d.release = await releaseDaten(commits);
  return { d, bericht };
}

async function releaseDaten(commits) {
  const nachweisJePr = new Map();
  const out = [];
  for (const sha of commits) {
    const prs = [];
    for (const p of await alle(`${R}/commits/${sha}/pulls`, 3)) {
      if (!nachweisJePr.has(p.number)) {
        // Das juengste Urteil, das genau diesen PR nennt: ein spaeterer PR
        // vom selben Stand ueberschreibt es nicht (Review #477).
        const st = await alle(`${R}/commits/${p.head.sha}/statuses`, 10);
        nachweisJePr.set(p.number, nachweisFuerPr(st, p.number));
      }
      prs.push({ number: p.number, merged: Boolean(p.merged_at), base_ref: p.base.ref, nachweis: nachweisJePr.get(p.number) });
    }
    out.push({ sha, prs });
  }
  return { commits: out, zuGross: commits.length >= 250 };
}

async function labelAb(name) {
  if (TROCKEN) { console.log(`(trocken) Label ab: ${name}`); return; }
  await api(`${R}/issues/${NUMMER}/labels/${encodeURIComponent(name)}`, { method: 'DELETE' });
  console.log(`Label entfernt: ${name}`);
}
async function labelDran(name) {
  if (TROCKEN) { console.log(`(trocken) Label dran: ${name}`); return; }
  await api(`${R}/issues/${NUMMER}/labels`, { method: 'POST', body: { labels: [name] } });
  console.log(`Label gesetzt: ${name}`);
}
let letzterStatus = '';
async function status(sha, u) {
  // Die Beschreibung nennt den PR: die Release-Pruefung liest je PR.
  const beschreibung = beschreibungMitPr(u.description, NUMMER);
  const schluessel = `${sha} ${u.state} ${beschreibung}`;
  if (schluessel === letzterStatus) return;
  letzterStatus = schluessel;
  console.log(`Status ${STATUS_KONTEXT} fuer ${sha.slice(0, 7)}: ${u.state} — ${beschreibung}`);
  if (TROCKEN) return;
  // Unmittelbar vor jedem Schreiben, auch dem "Warte" in der Schleife: ist
  // der Head inzwischen ein anderer, ueberschriebe der Status sonst ein
  // Urteil des alten Stands mit einem aus gemischten Daten (Review #477).
  await headNochGleich(sha);
  await api(`${R}/statuses/${sha}`, { method: 'POST', body: { state: u.state, description: beschreibung, context: STATUS_KONTEXT, target_url: LAUF || undefined } });
}

/* Gehoeren die gesammelten Daten noch zum Head? Waehrend der Erhebung
   gepushte Commits mischen sonst Dateien eines neuen Stands in das Urteil
   ueber den alten. Dann schreibt dieser Lauf nichts mehr; der Lauf zum
   neuen Stand uebernimmt (Review #477). Trocken wird nichts geschrieben.
   Dasselbe fuer die Basis (Review #477, Runden 5 und 6): Die Dateiliste ist
   der Vergleich ab der Zusammenfuehrungsbasis mit der Spitze des
   Zielzweigs. Wechselt der Zielzweig, kommt ein Lauf zum Ereignis
   "edited". Rueckt die Spitze nur weiter, bleibt die Zusammenfuehrungsbasis
   gleich und die Liste gilt; verschiebt sie sich (Zielzweig umgeschrieben
   oder Teile dieses Stands dort eingeflossen), gibt es kein Ereignis: dann
   scheitert der Lauf sichtbar, statt ein Urteil aus der alten Liste zu
   schreiben.
   Rueckgabe: der PR aus dem letzten Abruf, nach dem Basisvergleich; daran
   prueft der Aufrufer die Freigabe (Review #477, Runde 6). */
let basis = null;
async function headNochGleich(sha) {
  if (TROCKEN) return null;
  if (basis) {
    const spitze = await zielSpitze(basis.ref);
    if (spitze !== basis.sha) {
      const zusammen = (await api(`${R}/compare/${spitze}...${sha}`)).merge_base_commit?.sha || null;
      if (!zusammen || zusammen !== basis.zusammen) {
        throw new Error(`Zusammenfuehrungsbasis hat sich waehrend der Erhebung verschoben (${String(basis.zusammen).slice(0, 7)} -> ${String(zusammen).slice(0, 7)}): Stand ${sha.slice(0, 7)} nicht bewertet`);
      }
      basis = { ...basis, sha: spitze };
    }
  }
  const jetzt = await api(`${R}/pulls/${NUMMER}`);
  if (jetzt.head.sha !== sha || jetzt.state !== 'open') {
    console.log('Neuer Stand oder PR geschlossen waehrend der Erhebung — der Lauf dazu uebernimmt.');
    process.exit(0);
  }
  if (basis && jetzt.base.ref !== basis.ref) {
    console.log(`Zielzweig waehrend der Erhebung geaendert (${basis.ref} -> ${jetzt.base.ref}) — der Lauf dazu uebernimmt.`);
    process.exit(0);
  }
  return jetzt;
}

// ---------------------------------------------------------------- Ablauf
let pr = await api(`${R}/pulls/${NUMMER}`);
console.log(`PR #${NUMMER} ${pr.base.ref} <- ${pr.head.ref}, Head ${pr.head.sha.slice(0, 7)}, Ereignis ${EREIGNIS || '-'}/${AKTION || '-'}${LABEL ? ` (${LABEL})` : ''}, Auswertung aus ${QUELLE}`);
if (pr.state !== 'open' && !(TROCKEN && process.argv.includes('--auch-geschlossen'))) { console.log('PR ist nicht offen — nichts zu tun.'); process.exit(0); }
// Scheitert der Lauf, markiert der letzte Schritt des Workflows diesen
// Stand, den bewerteten, nicht den des Ereignisses: ein Push zwischen
// Ereignis und Abruf liesse sonst ein frueheres Gruen hier stehen (Review
// #477, Runde 6).
if (!TROCKEN && process.env.GITHUB_ENV && /^[0-9a-f]{40}$/.test(pr.head.sha)) appendFileSync(process.env.GITHUB_ENV, `BEWERTET_HEAD=${pr.head.sha}\n`);
const labels = () => pr.labels.map((l) => l.name);

// `nachweis-neu` ist nur der Anstoss zu diesem Lauf (z. B. nach einer Ausnahme).
if (labels().includes(LABEL_NEU)) {
  await labelAb(LABEL_NEU);
  pr.labels = pr.labels.filter((l) => l.name !== LABEL_NEU);
}

// Label-Verlauf des PRs (aufsteigend, ganz oder Abbruch).
const ereignisse = await alle(`${R}/issues/${NUMMER}/events`, 10);
const bereitGesetzt = zuletztGesetzt(ereignisse, LABEL_BEREIT);

/* Wurde `review-ready` vor dem Push des heutigen Heads gesetzt? Dann gehoert
   es zu einem aelteren Stand. Ankerzeit ist die erste Check-Suite des Heads
   (GitHub-Uhr, entsteht beim Push), sonst das Commit-Datum. Faengt den
   Fall, dass der Lauf zum Push abgebrochen wurde, bevor er das Label abnahm
   (cubic schreibt die PR-Beschreibung ~30 s nach jedem Push neu, das
   `edited` bricht den laufenden Lauf ab).
   Rueckgabe null: nicht zu entscheiden (kein Ereignis, keine Ankerzeit).
   Auch beim Push entscheidet die Zeit, nicht das Ereignis allein: ein
   Label, das Sekunden nach dem Push gesetzt wurde, gehoert zum neuen
   Stand (Opus-Review #477, Runde 2). */
async function labelAelterAlsHead(head) {
  if (zuletztGesetzt(ereignisse, LABEL_BEREIT) === null) return null;
  const suiten = (await api(`${R}/commits/${head}/check-suites?per_page=100`)).check_suites || [];
  const datum = suiten.some((x) => Number.isFinite(Date.parse(x.created_at || ''))) ? null : (await api(`${R}/commits/${head}`)).commit?.committer?.date;
  return labelAelter(ereignisse, LABEL_BEREIT, suiten, datum, AKTION === 'synchronize' ? process.env.PR_AKTUALISIERT : undefined);
}

// Neuer Stand: das Label gehoerte zum alten.
// Nicht zu entscheiden: beim Push im Zweifel ab (das Label wird neu gesetzt).
const bereitAlt = labels().includes(LABEL_BEREIT) ? await labelAelterAlsHead(pr.head.sha) : false;
if (bereitAlt === true || (bereitAlt === null && AKTION === 'synchronize')) {
  await labelAb(LABEL_BEREIT);
  pr.labels = pr.labels.filter((l) => l.name !== LABEL_BEREIT);
}

const ende = Date.now() + WARTEN_MIN * 60_000;
let { d, bericht } = await sammle(pr);

// Genau eine Anforderung je Stand: CodeRabbit prueft das Repo nicht mehr
// automatisch (weniger als 10 Sterne), ein Review kommt nur auf Befehl, und
// nur von einem echten Konto (Secret REVIEW_ANFORDERUNG_TOKEN, Agentenkonto).
if (anforderungNoetig(d)) {
  const head = d.pr.head_sha;
  await headNochGleich(head);
  const text = `@coderabbitai review\n\n${anforderungsMarke(head)}\n<sub>Angefordert vom Review-Nachweis: Label \`${LABEL_BEREIT}\` auf Stand \`${head.slice(0, 7)}\`. Eine Anforderung je Stand (docs/review-workflow.md).</sub>`;
  if (TROCKEN) {
    console.log('(trocken) Anforderung an CodeRabbit');
    d.kommentare.push({ id: 0, author: ANFORDERUNG_KONTEN[0], body: text, url: '(trocken)', erstellt: new Date().toISOString() });
  } else if (!ANFORDERUNG_TOKEN) {
    d.anforderungUnmoeglich = 'Secret REVIEW_ANFORDERUNG_TOKEN fehlt';
    console.log(`Keine Anforderung moeglich: ${d.anforderungUnmoeglich}.`);
  } else {
    // Fehler des Tokens und des Befehls werden zur Statusmeldung; Fehler
    // der Head-/Basispruefung dazwischen nicht: die brechen den Lauf
    // sichtbar ab (Fehlerschritt), statt als "Token pruefen" eine
    // Anforderung still auszulassen (CodeRabbit-Review #477, Runde 7).
    const unmoeglich = (e) => {
      d.anforderungUnmoeglich = `Anforderung gescheitert (${String(e.message).match(/HTTP \d+/)?.[0] || 'Fehler'}), Token pruefen`;
      console.log(`Keine Anforderung: ${e.message}`);
    };
    let tokenOk = false;
    try {
      // Nur ein eingetragenes Konto: eine Marke von einem anderen zaehlte
      // nicht, und jeder Lauf forderte erneut an.
      const konto = (await api('user', { token: ANFORDERUNG_TOKEN })).login;
      if (!ANFORDERUNG_KONTEN.includes(konto)) throw new Error(`HTTP 403 Konto ${konto} ist kein Anforderungskonto (ANFORDERUNG_KONTEN)`);
      tokenOk = true;
    } catch (e) { unmoeglich(e); }
    if (tokenOk) {
      // Die Pruefung des Tokens dauert: der Head ist danach noch einmal
      // zu pruefen, sonst ginge der Befehl an einen neuen, nicht
      // freigegebenen Stand (Review #477, Runde 4).
      const jetzt = await headNochGleich(head);
      // Freigabe noch da? Label ab oder zurueck zum Draft waehrend der
      // Pruefung: dann geht kein Befehl hinaus; das Ereignis dazu hat einen
      // eigenen Lauf (Review #477, Runde 5). `jetzt` ist der letzte Abruf vor
      // dem Befehl (Runde 6). Bis zum POST bleibt ein Rest von Millisekunden:
      // GitHub kennt kein bedingtes Anlegen eines Kommentars. Was dort
      // durchrutscht, ist hoechstens eine Anforderung fuer genau diesen Head
      // (Marke je Stand, kein zweiter Befehl): Kosten, kein Urteil.
      if (jetzt.draft || !(jetzt.labels || []).some((l) => l.name === LABEL_BEREIT)) {
        console.log(`Freigabe waehrend der Token-Pruefung entfallen (${jetzt.draft ? 'Draft' : `Label ${LABEL_BEREIT} fehlt`}) — keine Anforderung, der Lauf dazu uebernimmt.`);
        process.exit(0);
      }
      try {
        const k = await api(`${R}/issues/${NUMMER}/comments`, { method: 'POST', body: { body: text }, token: ANFORDERUNG_TOKEN });
        console.log(`CodeRabbit angefordert fuer ${head.slice(0, 7)} als ${k.user?.login}: ${k.html_url}`);
        d.kommentare.push({ id: k.id, author: k.user?.login, body: text, url: k.html_url, erstellt: k.created_at });
      } catch (e) { unmoeglich(e); } // abgelaufener oder entzogener Token: der Lauf setzt trotzdem seinen Status
    }
  }
}

let urteil = bewerte(d);
// Takt waechst bis 5 Minuten: jede Runde kostet rund zehn Anfragen, und
// GITHUB_TOKEN hat 1000 je Stunde fuer das ganze Repo (Opus-Review #477).
// Ein CodeRabbit-Review dauert meist 5 bis 10 Minuten.
let takt = TAKT_S;
while (urteil.warten && !TROCKEN && Date.now() < ende) {
  await status(d.pr.head_sha, urteil);
  await schlaf(Math.max(0, Math.min(takt, (ende - Date.now()) / 1000)));
  takt = Math.min(takt * 2, Math.max(TAKT_S, 300));
  pr = await api(`${R}/pulls/${NUMMER}`);
  if (pr.head.sha !== d.pr.head_sha || pr.state !== 'open') { console.log('Neuer Stand oder PR geschlossen — der Lauf dazu uebernimmt.'); process.exit(0); }
  ({ d, bericht } = await sammle(pr, { nurHeadNeu: true }));
  urteil = bewerte(d);
}
if (urteil.warten) urteil = bewerte({ ...d, keinWarten: true });

// Ab hier schreibt der Lauf aus den erhobenen Daten: Label, Status,
// Bericht. Vor jedem dieser Schritte Head und Basis pruefen (Review #477,
// Runde 5); die Statusschreibe prueft selbst (status()).
await headNochGleich(d.pr.head_sha);

// cubic den kritischen PRs vorbehalten (wirkt erst mit cubic.yaml auf main).
if (!urteil.release) {
  const kritisch = kritischeGruende(d.dateien, labels()).length > 0;
  if (kritisch && labels().includes(LABEL_OHNE_CUBIC)) await labelAb(LABEL_OHNE_CUBIC);
  if (!kritisch && !labels().includes(LABEL_OHNE_CUBIC)) await labelDran(LABEL_OHNE_CUBIC);
}

// Gruen nur, wenn auch danach kein zweiter offener PR denselben Stand traegt.
urteil = await statusMitKontrolle(urteil, d, { schreibe: (u) => status(d.pr.head_sha, u), gleicheStaende });

const text = berichtText(urteil, { bereiche: ledgerBereiche(d), runden: bestaetigteRunden(d), lauf: LAUF || '(lokal)', quelle: QUELLE });
if (TROCKEN) console.log('\n' + text);
else if (!bericht || bericht.body !== text) {
  await headNochGleich(d.pr.head_sha);
  if (bericht) await api(`${R}/issues/comments/${bericht.id}`, { method: 'PATCH', body: { body: text } });
  else await api(`${R}/issues/${NUMMER}/comments`, { method: 'POST', body: { body: text } });
}

// Selbstauskunft (Grundsatz 2): wie viel wurde wirklich angesehen.
console.log(`\nGeprueft: ${d.commits.length} Commits, ${d.dateien.length} Dateien, ${Object.values(d.laeufeJeCommit).flat().length} Pruefer-Laeufe, ${d.bereiche.length} CodeRabbit-Bereiche, ${d.kommentare.length} Kommentare, ${anfragen} API-Anfragen.`);
console.log(`Ergebnis: ${urteil.state} — ${urteil.description}`);
