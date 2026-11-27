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
     - `review-ready` nach drei abgeschlossenen Runden: Label ab, Krisz
       entscheidet (Label `review-runde-frei` gibt genau eine weitere frei
       und wird mit der Anforderung abgenommen).
     - `review-ready` auf einem fertigen, noch nicht angeforderten Stand:
       einmal `@coderabbitai review` schreiben (mit Marke je Stand).
       CodeRabbit prueft das Repo nicht mehr automatisch.
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
  bewerte, bereicheAusText, ledgerLesen, berichtText, kritischeGruende,
  LABEL_BEREIT, LABEL_RUNDE_FREI, LABEL_OHNE_CUBIC, LABEL_NEU, MAX_RUNDEN, STATUS_KONTEXT, BERICHT_MARKE,
  anforderungNoetig, anforderungsMarke, rundenZahl, rundenBremse,
} from './lib/review-nachweis.mjs';

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
  const res = await fetch(`https://api.github.com/${pfad}`, {
    method,
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
async function alle(pfad, max = 30) {
  const out = [];
  for (let seite = 1; seite <= max; seite++) {
    const teil = await api(`${pfad}${pfad.includes('?') ? '&' : '?'}per_page=100&page=${seite}`);
    out.push(...teil);
    if (teil.length < 100) break;
  }
  return out;
}
const R = `repos/${REPO}`;
const schlaf = (s) => new Promise((r) => setTimeout(r, s * 1000));

/* Alle Pruefer-Laeufe eines Commits. `filter=all`, sonst liefert GitHub nur
   den juengsten Lauf je Name, und ein spaeterer Skip oder ein Rate-Limit
   verdraengt einen fertigen Review desselben Commits (Review #477). */
async function laeufeFuer(sha) {
  const laeufe = [];
  for (let seite = 1; seite <= 5; seite++) {
    const teil = (await api(`${R}/commits/${sha}/check-runs?filter=all&per_page=100&page=${seite}`)).check_runs || [];
    laeufe.push(...teil);
    if (teil.length < 100) break;
  }
  return laeufe
    .filter((l) => ['coderabbitai', 'cubic-dev-ai'].includes(l.app?.slug))
    .map((l) => ({ app: l.app.slug, name: l.name, status: l.status, conclusion: l.conclusion, title: l.output?.title || '', summary: l.output?.summary || '', started_at: l.started_at }));
}

const cacheLaeufe = new Map();
const cacheVorfahr = new Map();
async function sammle(pr, { nurHeadNeu = false } = {}) {
  const head = pr.head.sha;
  const commits = (await alle(`${R}/pulls/${NUMMER}/commits`, 3)).map((c) => c.sha);
  const laeufeJeCommit = {};
  for (const c of commits) {
    if (!cacheLaeufe.has(c) || c === head || !nurHeadNeu) cacheLaeufe.set(c, await laeufeFuer(c));
    laeufeJeCommit[c] = cacheLaeufe.get(c);
  }
  const dateien = await alle(`${R}/pulls/${NUMMER}/files`, 30);
  const kommentareRoh = await alle(`${R}/issues/${NUMMER}/comments`, 10);
  const reviews = await alle(`${R}/pulls/${NUMMER}/reviews`, 10);
  // Andere offene PRs mit genau diesem Head: der Status gilt je Commit.
  const gleicherStand = (await alle(`${R}/pulls?state=open`, 3)).filter((p) => p.head.sha === head && p.number !== pr.number).map((p) => p.number);
  const kommentare = kommentareRoh.map((k) => ({ id: k.id, author: k.user?.login, body: k.body || '', url: k.html_url, erstellt: k.created_at }));
  const bericht = kommentare.find((k) => k.author === BOT && k.body.includes(BERICHT_MARKE));
  const bereiche = [
    ...reviews.filter((r) => r.user?.login === CR).flatMap((r) => bereicheAusText(r.body)),
    ...kommentare.filter((k) => k.author === CR).flatMap((k) => bereicheAusText(k.body)),
    ...(bericht ? ledgerLesen(bericht.body) : []),
  ];
  const imPr = new Set(commits);
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
  };
  if (pr.base.ref === 'main' && pr.head.ref === 'staging') d.release = await releaseDaten(commits);
  return { d, bericht };
}

async function releaseDaten(commits) {
  const nachweisJePr = new Map();
  const out = [];
  for (const sha of commits) {
    const prs = [];
    for (const p of await api(`${R}/commits/${sha}/pulls`)) {
      if (!nachweisJePr.has(p.number)) {
        const st = await api(`${R}/commits/${p.head.sha}/status`);
        nachweisJePr.set(p.number, st.statuses.find((x) => x.context === STATUS_KONTEXT)?.state || null);
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
  const schluessel = `${sha} ${u.state} ${u.description}`;
  if (schluessel === letzterStatus) return;
  letzterStatus = schluessel;
  console.log(`Status ${STATUS_KONTEXT} fuer ${sha.slice(0, 7)}: ${u.state} — ${u.description}`);
  if (TROCKEN) return;
  await api(`${R}/statuses/${sha}`, { method: 'POST', body: { state: u.state, description: u.description, context: STATUS_KONTEXT, target_url: LAUF || undefined } });
}

// ---------------------------------------------------------------- Ablauf
let pr = await api(`${R}/pulls/${NUMMER}`);
console.log(`PR #${NUMMER} ${pr.base.ref} <- ${pr.head.ref}, Head ${pr.head.sha.slice(0, 7)}, Ereignis ${EREIGNIS || '-'}/${AKTION || '-'}${LABEL ? ` (${LABEL})` : ''}, Auswertung aus ${QUELLE}`);
if (pr.state !== 'open' && !(TROCKEN && process.argv.includes('--auch-geschlossen'))) { console.log('PR ist nicht offen — nichts zu tun.'); process.exit(0); }
const labels = () => pr.labels.map((l) => l.name);

// `nachweis-neu` ist nur der Anstoss zu diesem Lauf (z. B. nach einer Ausnahme).
if (labels().includes(LABEL_NEU)) {
  await labelAb(LABEL_NEU);
  pr.labels = pr.labels.filter((l) => l.name !== LABEL_NEU);
}

/* Wurde `review-ready` vor dem Push des heutigen Heads gesetzt? Dann gehoert
   es zu einem aelteren Stand. Ankerzeit ist die erste Check-Suite des Heads
   (GitHub-Uhr, entsteht beim Push), sonst das Commit-Datum. Faengt den
   Fall, dass der Lauf zum Push abgebrochen wurde, bevor er das Label abnahm
   (cubic schreibt die PR-Beschreibung ~30 s nach jedem Push neu, das
   `edited` bricht den laufenden Lauf ab). */
async function labelAelterAlsHead(head) {
  const ev = await alle(`${R}/issues/${NUMMER}/events`, 5);
  const gesetzt = ev.filter((e) => e.event === 'labeled' && e.label?.name === LABEL_BEREIT).map((e) => Date.parse(e.created_at)).filter(Number.isFinite);
  if (!gesetzt.length) return false;
  const suiten = (await api(`${R}/commits/${head}/check-suites?per_page=100`)).check_suites || [];
  let anker = Math.min(...suiten.map((x) => Date.parse(x.created_at)).filter(Number.isFinite));
  if (!Number.isFinite(anker)) anker = Date.parse((await api(`${R}/commits/${head}`)).commit?.committer?.date || '');
  return Number.isFinite(anker) && Math.max(...gesetzt) < anker;
}

// Neuer Stand: das Label gehoerte zum alten.
if (labels().includes(LABEL_BEREIT) && (AKTION === 'synchronize' || await labelAelterAlsHead(pr.head.sha))) {
  await labelAb(LABEL_BEREIT);
  pr.labels = pr.labels.filter((l) => l.name !== LABEL_BEREIT);
}

const ende = Date.now() + WARTEN_MIN * 60_000;
let { d, bericht } = await sammle(pr);

/* Rundenbremse: bei jedem Ereignis vor jeder Anforderung, nicht nur beim
   Setzen des Labels (ein Ersatzlauf nach `edited` pruefte sie sonst nicht;
   Review #477). Die Bewertung nennt sie dann als Grund. */
if (anforderungNoetig(d, { bremse: false }) && rundenBremse(d)) {
  console.log(`Rundenbremse: ${rundenZahl(d)} abgeschlossene Runden — ${LABEL_BEREIT} wieder ab, Entscheidung bei Krisz.`);
  await labelAb(LABEL_BEREIT);
  pr.labels = pr.labels.filter((l) => l.name !== LABEL_BEREIT);
  d.pr.labels = labels();
}

// Genau eine Anforderung je Stand: CodeRabbit prueft das Repo nicht mehr
// automatisch (weniger als 10 Sterne), ein Review kommt nur auf Befehl, und
// nur von einem echten Konto (Secret REVIEW_ANFORDERUNG_TOKEN, Agentenkonto).
if (anforderungNoetig(d)) {
  const head = d.pr.head_sha;
  const text = `@coderabbitai review\n\n${anforderungsMarke(head)}\n<sub>Angefordert vom Review-Nachweis: Label \`${LABEL_BEREIT}\` auf Stand \`${head.slice(0, 7)}\`. Eine Anforderung je Stand (docs/review-workflow.md).</sub>`;
  if (TROCKEN) {
    console.log('(trocken) Anforderung an CodeRabbit');
    d.kommentare.push({ id: 0, author: '(trocken)', body: text, url: '(trocken)', erstellt: new Date().toISOString() });
  } else if (!ANFORDERUNG_TOKEN) {
    d.anforderungUnmoeglich = 'Secret REVIEW_ANFORDERUNG_TOKEN fehlt';
    console.log(`Keine Anforderung moeglich: ${d.anforderungUnmoeglich}.`);
  } else {
    try {
      const k = await api(`${R}/issues/${NUMMER}/comments`, { method: 'POST', body: { body: text }, token: ANFORDERUNG_TOKEN });
      console.log(`CodeRabbit angefordert fuer ${head.slice(0, 7)} als ${k.user?.login}: ${k.html_url}`);
      d.kommentare.push({ id: k.id, author: k.user?.login, body: text, url: k.html_url, erstellt: k.created_at });
      // Ueber dem Limit ging das nur mit `review-runde-frei`: genau eine
      // Runde, die Freigabe ist damit verbraucht (Review #477).
      if (rundenZahl(d) >= MAX_RUNDEN && labels().includes(LABEL_RUNDE_FREI)) {
        await labelAb(LABEL_RUNDE_FREI);
        pr.labels = pr.labels.filter((l) => l.name !== LABEL_RUNDE_FREI);
        d.pr.labels = labels();
      }
    } catch (e) {
      // Abgelaufener oder entzogener Token: der Lauf setzt trotzdem seinen Status.
      d.anforderungUnmoeglich = `Anforderung gescheitert (${String(e.message).match(/HTTP \d+/)?.[0] || 'Fehler'}), Token pruefen`;
      console.log(`Keine Anforderung: ${e.message}`);
    }
  }
}

let urteil = bewerte(d);
while (urteil.warten && !TROCKEN && Date.now() < ende) {
  await status(d.pr.head_sha, urteil);
  await schlaf(TAKT_S);
  pr = await api(`${R}/pulls/${NUMMER}`);
  if (pr.head.sha !== d.pr.head_sha || pr.state !== 'open') { console.log('Neuer Stand oder PR geschlossen — der Lauf dazu uebernimmt.'); process.exit(0); }
  ({ d, bericht } = await sammle(pr, { nurHeadNeu: true }));
  urteil = bewerte(d);
}
if (urteil.warten) urteil = bewerte({ ...d, keinWarten: true });

// cubic den kritischen PRs vorbehalten (wirkt erst mit cubic.yaml auf main).
if (!urteil.release) {
  const kritisch = kritischeGruende(d.dateien, labels()).length > 0;
  if (kritisch && labels().includes(LABEL_OHNE_CUBIC)) await labelAb(LABEL_OHNE_CUBIC);
  if (!kritisch && !labels().includes(LABEL_OHNE_CUBIC)) await labelDran(LABEL_OHNE_CUBIC);
}

await status(d.pr.head_sha, urteil);

const text = berichtText(urteil, { bereiche: d.bereiche, lauf: LAUF || '(lokal)', quelle: QUELLE });
if (TROCKEN) console.log('\n' + text);
else if (bericht && bericht.body !== text) await api(`${R}/issues/comments/${bericht.id}`, { method: 'PATCH', body: { body: text } });
else if (!bericht) await api(`${R}/issues/${NUMMER}/comments`, { method: 'POST', body: { body: text } });

// Selbstauskunft (Grundsatz 2): wie viel wurde wirklich angesehen.
console.log(`\nGeprueft: ${d.commits.length} Commits, ${d.dateien.length} Dateien, ${Object.values(d.laeufeJeCommit).flat().length} Pruefer-Laeufe, ${d.bereiche.length} CodeRabbit-Bereiche, ${d.kommentare.length} Kommentare, ${anfragen} API-Anfragen.`);
console.log(`Ergebnis: ${urteil.state} — ${urteil.description}`);
