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
       entscheidet (Label `review-runde-frei` gibt genau eine weitere frei;
       verbraucht ist es mit der ersten Anforderung nach dem Setzen, das
       liest jeder Lauf aus dem Verlauf und nimmt es dann ab).
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
  bewerte, bereicheAusText, ledgerLesen, berichtText, kritischeGruende,
  LABEL_BEREIT, LABEL_RUNDE_FREI, LABEL_OHNE_CUBIC, LABEL_NEU, STATUS_KONTEXT, BERICHT_MARKE,
  anforderungNoetig, anforderungsMarke, rundenBremse, rundenZahl,
  freigabeVerbraucht, zuletztGesetzt, seitenweise, statusMitKontrolle,
  rundenLesen, beschreibungMitPr, nachweisFuerPr,
  angeforderteStaende, rundenAusAnforderungen, bestaetigteRunden, ledgerBereiche, ANFORDERUNG_KONTEN,
  altesLedger,
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
  return laeufe
    .filter((l) => ['coderabbitai', 'cubic-dev-ai'].includes(l.app?.slug))
    .map((l) => ({ app: l.app.slug, name: l.name, status: l.status, conclusion: l.conclusion, title: l.output?.title || '', summary: l.output?.summary || '', started_at: l.started_at }));
}

// Andere offene PRs mit genau diesem Head: der Status gilt je Commit.
async function gleicheStaende(head) {
  return (await alle(`${R}/pulls?state=open`, 3)).filter((p) => p.head.sha === head && p.number !== NUMMER).map((p) => p.number);
}

const cacheLaeufe = new Map();
const cacheVorfahr = new Map();
async function sammle(pr, { nurHeadNeu = false } = {}) {
  const head = pr.head.sha;
  const commits = (await alle(`${R}/pulls/${NUMMER}/commits`, 3)).map((c) => c.sha);
  /* Texte vor den Laeufen: so ist der Lauf-Stand mindestens so neu wie die
     Zusammenfassung, deren Bereich er belegen soll (zielGeprueft). */
  const kommentareRoh = await alle(`${R}/issues/${NUMMER}/comments`, 10);
  const reviews = await alle(`${R}/pulls/${NUMMER}/reviews`, 10);
  const laeufeJeCommit = {};
  for (const c of commits) {
    // Beim Nachpollen: der Head immer, ein anderer Stand nur, solange einer
    // seiner Laeufe noch nicht fertig war (sonst bliebe er im Zwischenspeicher
    // "laeuft", und sein Bereich fiele aus der Kette; Review #477).
    const offen = (cacheLaeufe.get(c) || []).some((l) => l.status !== 'completed');
    if (!cacheLaeufe.has(c) || c === head || !nurHeadNeu || offen) cacheLaeufe.set(c, await laeufeFuer(c));
    laeufeJeCommit[c] = cacheLaeufe.get(c);
  }
  const dateien = await alle(`${R}/pulls/${NUMMER}/files`, 30);
  const gleicherStand = await gleicheStaende(head);
  const kommentare = kommentareRoh.map((k) => ({ id: k.id, author: k.user?.login, body: k.body || '', url: k.html_url, erstellt: k.created_at, geaendert: k.updated_at || k.created_at }));
  const bericht = kommentare.find((k) => k.author === BOT && k.body.includes(BERICHT_MARKE));
  if (bericht && altesLedger(bericht.body)) console.log('Ledger der ersten Fassung im Bericht: nicht gelesen, dessen Bereiche zaehlen nur mit eigenem Beleg.');
  // Jeder Bereich traegt seine Quelle: abgegebene Reviews und das Ledger
  // sind feste Belege, jeder andere Text nur fuer den juengsten Lauf.
  const bereiche = [
    ...reviews.filter((r) => r.user?.login === CR).flatMap((r) => bereicheAusText(r.body).map((x) => ({ ...x, quelle: 'review' }))),
    ...kommentare.filter((k) => k.author === CR).flatMap((k) => bereicheAusText(k.body).map((x) => ({ ...x, quelle: 'zusammenfassung', stand: Date.parse(k.geaendert || '') }))),
    ...(bericht ? ledgerLesen(bericht.body).map((x) => ({ ...x, quelle: 'ledger' })) : []),
  ];
  const imPr = new Set(commits);
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
    freigabeGesetzt, bereitGesetzt, fruehereRunden, vorlaeufigeRunden,
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
// Fuer Labels, deren Wirkung aus dem Verlauf folgt: Scheitert das Abnehmen,
// holt es der naechste Lauf nach, der Lauf selbst geht weiter.
async function labelAbWeich(name) {
  try {
    await labelAb(name);
    pr.labels = pr.labels.filter((l) => l.name !== name);
  } catch (e) {
    console.log(`Label ${name} nicht abgenommen (holt der naechste Lauf nach): ${e.message}`);
  }
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
   neuen Stand uebernimmt (Review #477). Trocken wird nichts geschrieben. */
async function headNochGleich(sha) {
  if (TROCKEN) return;
  const jetzt = await api(`${R}/pulls/${NUMMER}`);
  if (jetzt.head.sha !== sha || jetzt.state !== 'open') {
    console.log('Neuer Stand oder PR geschlossen waehrend der Erhebung — der Lauf dazu uebernimmt.');
    process.exit(0);
  }
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

// Label-Verlauf des PRs (aufsteigend, ganz oder Abbruch).
const ereignisse = await alle(`${R}/issues/${NUMMER}/events`, 10);
const freigabeGesetzt = zuletztGesetzt(ereignisse, LABEL_RUNDE_FREI);
const bereitGesetzt = zuletztGesetzt(ereignisse, LABEL_BEREIT);

/* Wurde `review-ready` vor dem Push des heutigen Heads gesetzt? Dann gehoert
   es zu einem aelteren Stand. Ankerzeit ist die erste Check-Suite des Heads
   (GitHub-Uhr, entsteht beim Push), sonst das Commit-Datum. Faengt den
   Fall, dass der Lauf zum Push abgebrochen wurde, bevor er das Label abnahm
   (cubic schreibt die PR-Beschreibung ~30 s nach jedem Push neu, das
   `edited` bricht den laufenden Lauf ab). */
async function labelAelterAlsHead(head) {
  const gesetzt = zuletztGesetzt(ereignisse, LABEL_BEREIT);
  if (gesetzt === null) return false;
  const suiten = (await api(`${R}/commits/${head}/check-suites?per_page=100`)).check_suites || [];
  let anker = Math.min(...suiten.map((x) => Date.parse(x.created_at)).filter(Number.isFinite));
  if (!Number.isFinite(anker)) anker = Date.parse((await api(`${R}/commits/${head}`)).commit?.committer?.date || '');
  return Number.isFinite(anker) && gesetzt < anker;
}

// Neuer Stand: das Label gehoerte zum alten.
if (labels().includes(LABEL_BEREIT) && (AKTION === 'synchronize' || await labelAelterAlsHead(pr.head.sha))) {
  await labelAb(LABEL_BEREIT);
  pr.labels = pr.labels.filter((l) => l.name !== LABEL_BEREIT);
}

const ende = Date.now() + WARTEN_MIN * 60_000;
let { d, bericht } = await sammle(pr);

/* `review-runde-frei` gilt fuer genau eine Anforderung. Verbraucht ist es,
   sobald nach dem Setzen eine geschrieben wurde; das folgt aus dem Verlauf
   (rundenBremse liest es so), das Abnehmen hier ist nur Aufraeumen und
   holt nach, was ein abgebrochener Lauf nicht mehr schaffte (Review #477). */
if (freigabeVerbraucht(d)) {
  console.log(`Freigabe ${LABEL_RUNDE_FREI} ist verbraucht (Anforderung nach dem Setzen).`);
  await labelAbWeich(LABEL_RUNDE_FREI);
  d.pr.labels = labels();
}

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
  await headNochGleich(head);
  const text = `@coderabbitai review\n\n${anforderungsMarke(head)}\n<sub>Angefordert vom Review-Nachweis: Label \`${LABEL_BEREIT}\` auf Stand \`${head.slice(0, 7)}\`. Eine Anforderung je Stand (docs/review-workflow.md).</sub>`;
  if (TROCKEN) {
    console.log('(trocken) Anforderung an CodeRabbit');
    d.kommentare.push({ id: 0, author: ANFORDERUNG_KONTEN[0], body: text, url: '(trocken)', erstellt: new Date().toISOString() });
  } else if (!ANFORDERUNG_TOKEN) {
    d.anforderungUnmoeglich = 'Secret REVIEW_ANFORDERUNG_TOKEN fehlt';
    console.log(`Keine Anforderung moeglich: ${d.anforderungUnmoeglich}.`);
  } else {
    try {
      // Nur ein eingetragenes Konto: eine Marke von einem anderen zaehlte
      // nicht, und jeder Lauf forderte erneut an.
      const konto = (await api('user', { token: ANFORDERUNG_TOKEN })).login;
      if (!ANFORDERUNG_KONTEN.includes(konto)) throw new Error(`HTTP 403 Konto ${konto} ist kein Anforderungskonto (ANFORDERUNG_KONTEN)`);
      const k = await api(`${R}/issues/${NUMMER}/comments`, { method: 'POST', body: { body: text }, token: ANFORDERUNG_TOKEN });
      console.log(`CodeRabbit angefordert fuer ${head.slice(0, 7)} als ${k.user?.login}: ${k.html_url}`);
      d.kommentare.push({ id: k.id, author: k.user?.login, body: text, url: k.html_url, erstellt: k.created_at });
      // Eine Freigabe `review-runde-frei` ist mit dieser Anforderung
      // verbraucht (gilt auch ohne das Abnehmen, siehe freigabeVerbraucht).
      if (labels().includes(LABEL_RUNDE_FREI)) {
        await labelAbWeich(LABEL_RUNDE_FREI);
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

// Gruen nur, wenn auch danach kein zweiter offener PR denselben Stand traegt.
await headNochGleich(d.pr.head_sha);
urteil = await statusMitKontrolle(urteil, d, { schreibe: (u) => status(d.pr.head_sha, u), gleicheStaende });

const text = berichtText(urteil, { bereiche: ledgerBereiche(d), runden: bestaetigteRunden(d), lauf: LAUF || '(lokal)', quelle: QUELLE });
if (TROCKEN) console.log('\n' + text);
else if (bericht && bericht.body !== text) await api(`${R}/issues/comments/${bericht.id}`, { method: 'PATCH', body: { body: text } });
else if (!bericht) await api(`${R}/issues/${NUMMER}/comments`, { method: 'POST', body: { body: text } });

// Selbstauskunft (Grundsatz 2): wie viel wurde wirklich angesehen.
console.log(`\nGeprueft: ${d.commits.length} Commits, ${d.dateien.length} Dateien, ${Object.values(d.laeufeJeCommit).flat().length} Pruefer-Laeufe, ${d.bereiche.length} CodeRabbit-Bereiche, ${d.kommentare.length} Kommentare, ${anfragen} API-Anfragen.`);
console.log(`Ergebnis: ${urteil.state} — ${urteil.description}`);
