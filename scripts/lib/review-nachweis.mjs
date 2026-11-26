/* ============================================================
   review-nachweis.mjs — das Urteil hinter dem Status `review-nachweis`.

   WARUM ES DEN GIBT (Krisz, 26.11.2026): Ein gruener Haken eines
   KI-Pruefers ist kein Beleg, dass der aktuelle Stand geprueft wurde.
   CodeRabbits eigene Schema-Beschreibung sagt, sein Status wird auch dann
   gruen, wenn ein Review uebersprungen oder rate-limitiert wurde. An #473
   lief der letzte Push zuerst in "Review rate limited"; am Haken war das
   nicht zu sehen. cubic stand im ganzen November ab dem Monatslimit auf
   "neutral" und zaehlte trotzdem als "durchgelaufen".

   Dieses Modul faellt das Urteil aus Daten, die der Aufrufer
   (scripts/review-nachweis.mjs) bei GitHub abholt. Es selbst hat kein
   Netz, kein git, keinen Kindprozess: so laesst es sich mit echten
   Antworten als Testdaten pruefen (tests/e2e/review-nachweis.test.js).

   GRUNDREGELN (docs/review-workflow.md):
     - Gruen nur mit positivem Beleg fuer GENAU den Head-Commit. Alles,
       was nicht ausdruecklich als abgeschlossener Review erkannt wird
       (Rate-Limit, Skip, Abbruch, unbekannter Text), zaehlt als NICHT
       geprueft. Im Zweifel rot (fail closed).
     - Abdeckung: Die inkrementellen Runden muessen zusammen den ganzen
       Stand abdecken. CodeRabbit nennt je Review den Bereich "between A
       and B"; die Bereiche muessen eine luecklose Kette von einem
       Vorfahren ausserhalb des PRs bis zum Head bilden.
     - Normaler PR: ein abgedeckter Review (CodeRabbit ODER cubic).
     - Kritischer PR: zwei (CodeRabbit UND cubic), oder einer plus eine
       dokumentierte Ausnahme mit Krisz' ausdruecklicher Freigabe. Nie
       automatisch.
     - Release (staging -> main): jeder enthaltene Commit gehoert zu einem
       nach staging gemergten PR, dessen letzter Stand den Nachweis trug.
   ============================================================ */

export const LABEL_BEREIT = 'review-ready';
export const LABEL_KRITISCH = 'kritisch';
export const LABEL_RUNDE_FREI = 'review-runde-frei';
export const LABEL_OHNE_CUBIC = 'ohne-cubic';
export const LABEL_NEU = 'nachweis-neu'; // nur: Nachweis neu bewerten (z. B. nach einer Ausnahme)
export const MAX_RUNDEN = 3;
export const STATUS_KONTEXT = 'review-nachweis';
export const BERICHT_MARKE = '<!-- review-nachweis:bericht -->';
export const anforderungsMarke = (sha) => `<!-- review-nachweis:anforderung sha=${sha} -->`;

const SHA = /^[0-9a-f]{40}$/;
const kurz = (s) => (s || '').slice(0, 7);

/* ---------------------------------------------------------------
   Kritische Pfade (Krisz, 26.11.2026, V3): Migrationen und RLS, Edge
   Functions (Stripe, Konto), Anmeldung und MFA, Server und Container,
   dazu IMMER alles, was Review-Gates, Rechte oder Sicherheits-
   konfiguration traegt. Jeder Eintrag nennt seinen Anlass.
   --------------------------------------------------------------- */
export const KRITISCHE_PFADE = [
  [/^supabase\/migrations\//, 'Datenbank-Migration (Schema, RLS, Rechte)'],
  [/^supabase\/functions\//, 'Edge Function (Zahlung, Konto, Registrierung)'],
  [/^supabase\/(config\.toml|rights\.)/, 'Supabase-Konfiguration oder Rechte-Soll'],
  [/^src\/components\/account\/(Auth|Mfa)/, 'Anmeldung, Passwort oder MFA'],
  [/^src\/pages\/(de\/)?account\/(login|register|reset|update-password)\./, 'Anmelde- oder Passwortseite'],
  [/^src\/lib\/(auth-|mfa|supabase\.ts$|account-cleanup|account-export)/, 'Anmelde-, Sitzungs- oder Kontologik'],
  [/^nginx\//, 'Server-Konfiguration (CSP, Kopfzeilen, Tor)'],
  [/(^|\/)Dockerfile$/, 'Container und Auslieferungs-Tor'],
  [/^\.dockerignore$/, 'Bau-Kontext (bestimmt, was das Tor sieht)'],
  [/^\.github\//, 'Workflows, Rechte, Dependabot (Review-Gate und CI)'],
  [/^(\.coderabbit\.yaml|cubic\.yaml)$/, 'Konfiguration der KI-Pruefer (Review-Gate)'],
  [/^scripts\/(lib\/)?review-nachweis\.mjs$/, 'Review-Gate selbst'],
  [/^scripts\/lib\/supabase-ziel\.mjs$/, 'Datenbank-Ziel je Bau (Live oder Vorschau)'],
  [/^scripts\/(verify-supply-chain|audit-csp|_write-csp-hashes)\.mjs$/, 'Sicherheits-Tor (Lieferkette, CSP)'],
  /* V3 (Krisz 26.11.2026): Aenderungen an Review-Gates und Berechtigungen
     sind immer kritisch. CLAUDE.md legt fest, was der Agent darf (nie
     mergen, main tabu, Ausnahmen nur mit Freigabe); docs/review-workflow.md
     haelt die Regeln und Vorlagen des Gates. */
  [/^CLAUDE\.md$/, 'Arbeitsregeln und Rechte des Agenten'],
  [/^docs\/review-workflow\.md$/, 'Regeln des Review-Gates'],
];

/* Inhaltliche Signale fuer sicherheitsrelevante Aenderungen ausserhalb der
   Pfade (V3: "zusaetzlich sicherheitsrelevante Aenderungen ausserhalb
   dieser Pfade"). Gesucht wird nur in geaenderten Zeilen (+/-) des Diffs.
   Das ist eine Heuristik, kein Beweis: was sie nicht faengt, markiert der
   Agent mit dem Label `kritisch` (CLAUDE.md). Lieber ein Fehlalarm zu viel
   als eine stille Luecke; jede Zeile nennt ihren Grund. */
export const KRITISCHE_SIGNALE = [
  [/\bservice_role\b|SERVICE_ROLE|SUPABASE_SECRET/i, 'Geheimschluessel oder Service-Rolle'],
  [/\bsecurity\s+definer\b/i, 'SECURITY DEFINER'],
  [/\b(create|alter|drop)\s+policy\b|\b(enable|disable)\s+row\s+level\s+security\b/i, 'RLS-Policy'],
  [/^\s*(grant|revoke)\s+\w/i, 'GRANT/REVOKE'],
  [/Content-Security-Policy|Strict-Transport-Security|X-Frame-Options/i, 'Sicherheits-Kopfzeile'],
  [/\bstripe\b/i, 'Zahlungslogik (Stripe)'],
  [/\bauth\.(admin|signIn|signUp|updateUser|setSession|exchangeCodeForSession|mfa)\b/, 'Anmelde-API'],
  // Nur entfernte oder geaenderte Zeilen: ein neues Tor ist keine Abschwaechung.
  [/^\s*"(gate|gate:data|test:e2e|verify:[\w-]+|audit:[\w-]+)"\s*:/, 'Tor-Kette in package.json geaendert', { nurEntfernt: true }],
];

/** Liste der Gruende, warum ein PR kritisch ist (leer = normal). */
export function kritischeGruende(dateien, labels = []) {
  const gruende = [];
  const dazu = (g) => { if (!gruende.includes(g)) gruende.push(g); };
  if (labels.includes(LABEL_KRITISCH)) dazu(`Label "${LABEL_KRITISCH}"`);
  for (const f of dateien) {
    for (const name of [f.filename, f.previous_filename].filter(Boolean)) {
      for (const [re, warum] of KRITISCHE_PFADE) if (re.test(name)) dazu(`${warum}: ${name}`);
    }
    if (typeof f.patch !== 'string') continue;
    for (const zeile of f.patch.split('\n')) {
      if (!/^[+-]/.test(zeile) || /^(\+\+\+|---)/.test(zeile)) continue;
      const inhalt = zeile.slice(1);
      for (const [re, warum, opt] of KRITISCHE_SIGNALE) {
        if (opt?.nurEntfernt && zeile[0] !== '-') continue;
        if (re.test(inhalt)) dazu(`${warum} in ${f.filename}`);
      }
    }
  }
  return gruende;
}

/* ---------------------------------------------------------------
   Einordnung der Check-Laeufe. Gezaehlt wird nur, was in echten
   Antworten (75 PRs, 26.11.2026) als abgeschlossener Review stand.
   --------------------------------------------------------------- */

/** CodeRabbit: 'geprueft' | 'laeuft' | 'ratenlimit' | 'uebersprungen' | 'abgebrochen' | 'unbekannt' */
export function codeRabbitLauf(lauf) {
  if (!lauf) return { art: 'fehlt' };
  const titel = lauf.title || '';
  const erste = (lauf.summary || '').split('\n')[0];
  if (lauf.status !== 'completed') return { art: 'laeuft', titel };
  if (lauf.conclusion === 'success' && titel === 'Finished' && /^Result: Success - Review completed\b/.test(erste)) return { art: 'geprueft', titel };
  if (/rate limit/i.test(titel + ' ' + erste)) return { art: 'ratenlimit', titel };
  if (lauf.conclusion === 'skipped' || /skipped/i.test(titel)) return { art: 'uebersprungen', titel };
  if (lauf.conclusion === 'cancelled') return { art: 'abgebrochen', titel };
  return { art: 'unbekannt', titel: titel || erste || `${lauf.status}/${lauf.conclusion}` };
}

/** cubic: 'geprueft' (voll|inkrementell) | 'merge' | 'laeuft' | 'limit' | 'nicht-geprueft' */
export function cubicLauf(lauf) {
  if (!lauf) return { art: 'fehlt' };
  const titel = lauf.title || '';
  const summary = lauf.summary || '';
  if (lauf.status !== 'completed') return { art: 'laeuft', titel };
  if (lauf.conclusion === 'success' && titel === 'AI review completed') {
    return { art: 'geprueft', inkrementell: /\(changes from recent commits\)/.test(summary), titel };
  }
  if (lauf.conclusion === 'success' && titel === 'AI review not needed for merge commit') return { art: 'merge', titel };
  if (/limit/i.test(titel)) return { art: 'limit', titel };
  return { art: 'nicht-geprueft', titel: titel || `${lauf.status}/${lauf.conclusion}` };
}

const istCodeRabbit = (l) => l.app === 'coderabbitai' && l.name === 'CodeRabbit';
const istCubic = (l) => l.app === 'cubic-dev-ai';
const juengster = (laeufe) => [...laeufe].sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')))[0];

/** Zustand des CodeRabbit-Reviews fuer einen Commit: irgendein abgeschlossener Lauf zaehlt; sonst der juengste. */
export function codeRabbitAmCommit(laeufe = []) {
  const cr = laeufe.filter(istCodeRabbit);
  if (cr.some((l) => codeRabbitLauf(l).art === 'geprueft')) {
    const j = codeRabbitLauf(juengster(cr));
    return j.art === 'laeuft' ? { art: 'geprueft', nochEinLauf: true } : { art: 'geprueft' };
  }
  return codeRabbitLauf(juengster(cr));
}

/* ---------------------------------------------------------------
   Anforderung. CodeRabbit prueft dieses Repo nicht mehr automatisch
   (weniger als 10 Sterne, seit 25./26.11.2026); ein Review kommt nur auf
   `@coderabbitai review`. Den Befehl schreibt der Workflow, genau einmal je
   Stand, mit einer Marke, die den Stand nennt. Die Marke verlaengert nur
   das Warten, sie zaehlt nie als Review.
   --------------------------------------------------------------- */
const anforderungen = (kommentare, head) => {
  const re = new RegExp(`<!--\\s*review-nachweis:anforderung\\s+sha=${head}\\s*-->`);
  return (kommentare || []).filter((k) => re.test(k.body || ''));
};

/** Zeitpunkt (ms) der juengsten Anforderung fuer genau diesen Stand, sonst null. */
export function anforderungAmHead(kommentare, head) {
  const t = anforderungen(kommentare, head).map((k) => Date.parse(k.erstellt || '')).filter(Number.isFinite);
  return t.length ? Math.max(...t) : null;
}

/** Soll jetzt `@coderabbitai review` geschrieben werden? Nur mit Label, nie im Draft, nie doppelt. */
export function anforderungNoetig(d) {
  const { pr } = d;
  if (pr.draft || (pr.base_ref === 'main' && pr.head_ref === 'staging')) return false;
  if (!(pr.labels || []).includes(LABEL_BEREIT)) return false;
  if (anforderungen(d.kommentare, pr.head_sha).length) return false;
  return codeRabbitAmCommit(d.laeufeJeCommit?.[pr.head_sha] || []).art !== 'geprueft';
}

/** Bereiche "between A and B" aus einem CodeRabbit-Text. */
export function bereicheAusText(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/between ([0-9a-f]{40}) and ([0-9a-f]{40})/g)) out.push({ a: m[1], b: m[2] });
  return out;
}

/* ---------------------------------------------------------------
   Abdeckung. CodeRabbit: Kette aus Bereichen. Quelle eines Bereichs ist
   ein Commit des PRs oder ein Commit des Zielzweigs (die Basis, gegen
   die der erste Review lief: CodeRabbit prueft dabei den ganzen PR-Diff
   ab der Merge-Basis). Ziel muss ein Commit des heutigen PR-Stands sein. Ein umgeschriebener Verlauf (Force-Push)
   reisst die Kette: dann hilft nur `@coderabbitai full review`.
   --------------------------------------------------------------- */
export function codeRabbitAbdeckung({ bereiche, commits, head, vorfahren }) {
  const imPr = new Set(commits);
  const gueltig = [];
  const verworfen = [];
  for (const r of bereiche) {
    if (!SHA.test(r.a) || !SHA.test(r.b)) continue;
    const zielOk = imPr.has(r.b);
    const quelleOk = imPr.has(r.a) || vorfahren[r.a] === true; // vorfahren: liegt auf dem Zielzweig
    (zielOk && quelleOk ? gueltig : verworfen).push(r);
  }
  const starts = new Set(gueltig.filter((r) => !imPr.has(r.a)).map((r) => r.a));
  const erreicht = new Set(starts);
  let neu = true;
  while (neu) {
    neu = false;
    for (const r of gueltig) if (erreicht.has(r.a) && !erreicht.has(r.b)) { erreicht.add(r.b); neu = true; }
  }
  const kette = [];
  if (erreicht.has(head)) {
    // Eine Kette zur Anzeige: rueckwaerts vom Head.
    let ziel = head;
    const gesehen = new Set();
    while (ziel && !starts.has(ziel) && !gesehen.has(ziel)) {
      gesehen.add(ziel);
      const r = gueltig.find((x) => x.b === ziel && erreicht.has(x.a));
      if (!r) break;
      kette.unshift(r);
      ziel = r.a;
    }
  }
  return { abgedeckt: erreicht.has(head), kette, verworfen, gueltig: gueltig.length };
}

/** cubic: voller Review setzt die Abdeckung, inkrementelle halten sie, alles andere reisst sie. */
export function cubicAbdeckung({ commits, head, laeufeJeCommit }) {
  let abgedeckt = false;
  let amHead = { art: 'fehlt' };
  const spur = [];
  for (const c of commits) {
    const laeufe = (laeufeJeCommit[c] || []).filter(istCubic);
    if (!laeufe.length) continue;
    const z = cubicLauf(juengster(laeufe));
    spur.push(`${kurz(c)} ${z.art}${z.inkrementell ? ' (inkrementell)' : ''}`);
    if (z.art === 'geprueft' && !z.inkrementell) abgedeckt = true;
    else if (z.art === 'geprueft' || z.art === 'merge') { /* haelt */ }
    else if (z.art === 'laeuft') { /* offen: zaehlt am Ende nur, wenn es der Head ist */ }
    else abgedeckt = false;
    if (c === head) amHead = z;
  }
  return { abgedeckt: abgedeckt && amHead.art === 'geprueft', amHead, spur };
}

/* ---------------------------------------------------------------
   Ausnahmen: nur mit Krisz' ausdruecklicher Freigabe, je Commit, mit
   Begruendung. Erkannt wird ein Kommentar eines freigabeberechtigten
   Kontos mit Marke und allen Pflichtzeilen. Solange der Agent mit
   Krisz' Konto schreibt, ist das eine DOKUMENTATION seiner Freigabe aus
   Chat oder AgencyOS, kein technischer Identitaetsnachweis
   (docs/review-workflow.md, "Grenzen").
   --------------------------------------------------------------- */
const PFLICHT = {
  'review-ausnahme': ['Freigabe', 'Zusätzliche Tests', 'Risiken', 'Fehlende Zweitprüfung'],
  'release-ausnahme': ['Freigabe', 'Nicht nachgewiesen', 'Risiken'],
};

export function ausnahme({ art, kommentare, head, konten }) {
  const marke = new RegExp(`<!--\\s*${art}\\s+sha=${head}\\s*-->`);
  const fehlend = [];
  for (const k of kommentare) {
    if (!konten.includes(k.author) || !marke.test(k.body || '')) continue;
    const zeilen = (k.body || '').split('\n');
    const leer = PFLICHT[art].filter((feld) => !zeilen.some((z) => {
      const m = new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\*\\*)?${feld}:(?:\\*\\*)?\\s*(.+)$`).exec(z);
      return m && m[1].trim().length >= 3;
    }));
    if (!leer.length) return { gilt: true, von: k.author, url: k.url };
    fehlend.push(...leer);
  }
  return { gilt: false, fehlend: [...new Set(fehlend)] };
}

/* ---------------------------------------------------------------
   Das Urteil.
   --------------------------------------------------------------- */
const s = (state, description, extra = {}) => ({ state, description: description.slice(0, 140), ...extra });

export function bewerte(d) {
  const { pr } = d;
  const head = pr.head_sha;
  const labels = pr.labels || [];
  const bericht = [];

  if (pr.draft) return s('pending', 'Draft: KI-Review erst nach "ready for review" und Label review-ready', { bericht: ['Draft-PR: kein Review vorgesehen.'] });

  if (pr.base_ref === 'main' && pr.head_ref === 'staging') return bewerteRelease(d);

  if ((d.commits || []).length >= 250) {
    return s('failure', 'PR hat 250+ Commits: Abdeckung nicht pruefbar, bitte aufteilen', { bericht: ['Mehr als 250 Commits: die API liefert nicht alle, der Nachweis bleibt aus.'] });
  }

  const gruende = kritischeGruende(d.dateien || [], labels);
  const kritisch = gruende.length > 0;

  // CodeRabbit
  const crHead = codeRabbitAmCommit(d.laeufeJeCommit?.[head] || []);
  const crAbd = codeRabbitAbdeckung({ bereiche: d.bereiche || [], commits: d.commits || [], head, vorfahren: d.vorfahren || {} });
  const crBeleg = crHead.art === 'geprueft' && crAbd.abgedeckt;

  // cubic
  const cuAbd = cubicAbdeckung({ commits: d.commits || [], head, laeufeJeCommit: d.laeufeJeCommit || {} });
  const cuBeleg = cuAbd.abgedeckt;

  const runden = (d.commits || []).filter((c) => (d.laeufeJeCommit?.[c] || []).filter(istCodeRabbit).some((l) => codeRabbitLauf(l).art === 'geprueft')).length;

  bericht.push(`Stand: \`${kurz(head)}\` · ${kritisch ? '**kritisch**' : 'normal'} · CodeRabbit-Runden mit Abschluss: ${runden}/${MAX_RUNDEN}`);
  if (kritisch) for (const g of gruende.slice(0, 12)) bericht.push(`- kritisch: ${g}`);
  if (gruende.length > 12) bericht.push(`- … und ${gruende.length - 12} weitere Gruende`);
  bericht.push(`CodeRabbit am Head: ${crHead.art}${crHead.titel ? ` (${crHead.titel})` : ''}; Abdeckung: ${crAbd.abgedeckt ? 'lueckenlos' : 'NICHT belegt'}${crAbd.kette.length ? ' — ' + crAbd.kette.map((r) => `${kurz(r.a)}..${kurz(r.b)}`).join(' → ') : ''}`);
  if (crAbd.verworfen.length) bericht.push(`- verworfene Bereiche (Ziel nicht im heutigen Verlauf oder Quelle nicht auf dem Zielzweig): ${crAbd.verworfen.map((r) => `${kurz(r.a)}..${kurz(r.b)}`).join(', ')}`);
  bericht.push(`cubic am Head: ${cuAbd.amHead.art}${cuAbd.amHead.titel ? ` (${cuAbd.amHead.titel})` : ''}; Abdeckung: ${cuBeleg ? 'lueckenlos' : 'NICHT belegt'}${cuAbd.spur.length ? ' — ' + cuAbd.spur.join(', ') : ''}`);

  const belege = [crBeleg && 'CodeRabbit', cuBeleg && 'cubic'].filter(Boolean);
  const extra = { bericht, kritisch, gruende, runden, belege };

  // Warten, solange ein Pruefer am Head noch laeuft oder angefordert ist.
  // Angefordert, aber noch kein Lauf nach der Anforderung (ein Skip von
  // davor, etwa "excluded by label configuration", ist dann veraltet).
  const tAnf = anforderungAmHead(d.kommentare, head);
  const crLetzter = juengster((d.laeufeJeCommit?.[head] || []).filter(istCodeRabbit));
  const crAngefordert = tAnf !== null && crHead.art !== 'geprueft' && crHead.art !== 'laeuft'
    && !(crLetzter && Date.parse(crLetzter.started_at || '') >= tAnf);
  const crWartet = crHead.art === 'laeuft' || crHead.nochEinLauf || (crHead.art === 'fehlt' && labels.includes(LABEL_BEREIT)) || crAngefordert;
  const cuWartet = cuAbd.amHead.art === 'laeuft';
  const brauchtMehr = kritisch ? belege.length < 2 : belege.length < 1;
  if (brauchtMehr && (crWartet || cuWartet) && !d.keinWarten) {
    return s('pending', `Warte auf ${[crWartet && 'CodeRabbit', cuWartet && 'cubic'].filter(Boolean).join(' und ')} fuer ${kurz(head)}`, { ...extra, warten: true });
  }

  if (!kritisch && belege.length >= 1) return s('success', `Geprueft (${belege.join(' + ')}) fuer ${kurz(head)}, lueckenlos`, extra);
  if (kritisch && belege.length >= 2) return s('success', `Kritisch, zweifach geprueft (CodeRabbit + cubic) fuer ${kurz(head)}`, extra);

  if (kritisch && belege.length === 1) {
    const a = ausnahme({ art: 'review-ausnahme', kommentare: d.kommentare || [], head, konten: d.freigabeKonten || [] });
    if (a.gilt) {
      bericht.push(`**AUSNAHME:** nur ein KI-Review (${belege[0]}), Zweitpruefung fehlt. Freigabe dokumentiert von ${a.von}: ${a.url || ''}`);
      return s('success', `AUSNAHME: kritisch, nur ${belege[0]}; Freigabe Krisz dokumentiert fuer ${kurz(head)}`, { ...extra, ausnahme: true });
    }
    if (a.fehlend?.length) bericht.push(`Ausnahme-Kommentar unvollstaendig, es fehlt: ${a.fehlend.join(', ')}`);
    return s('failure', `Kritisch: zweite Pruefung fehlt (cubic oder dokumentierte Freigabe von Krisz) fuer ${kurz(head)}`, extra);
  }

  // Kein Beleg. Grund so genau wie moeglich nennen.
  let grund;
  /* Ohne Label ist der eigentliche Grund die fehlende Anforderung, auch
     wenn CodeRabbit das als Skip meldet (live auf #477, 26.11.2026:
     "Review skipped: excluded by label configuration"). */
  if (!labels.includes(LABEL_BEREIT) && (crHead.art === 'fehlt' || /label configuration/i.test(crHead.titel || ''))) grund = 'Kein Review fuer diesen Stand angefordert (Label review-ready fehlt)';
  else if (crAngefordert) grund = 'Review angefordert, CodeRabbit hat nicht reagiert: NICHT geprueft';
  else if (crHead.art === 'ratenlimit') grund = 'CodeRabbit rate-limitiert: Stand NICHT geprueft';
  else if (crHead.art === 'uebersprungen') grund = `CodeRabbit hat uebersprungen (${crHead.titel}): NICHT geprueft`;
  else if (crHead.art === 'abgebrochen') grund = 'CodeRabbit-Review abgebrochen: NICHT geprueft';
  else if (crHead.art === 'unbekannt') grund = `CodeRabbit meldet Unbekanntes (${crHead.titel}): NICHT gezaehlt`;
  else if (crHead.art === 'geprueft') grund = 'Abdeckung lueckenhaft: Runden decken den Stand nicht ab, full review noetig';
  else if (crHead.art === 'laeuft') grund = 'CodeRabbit laeuft noch, Wartezeit abgelaufen: noch NICHT geprueft';
  else if (!labels.includes(LABEL_BEREIT)) grund = 'Kein Review fuer diesen Stand angefordert (Label review-ready fehlt)';
  else grund = 'CodeRabbit hat nicht reagiert';
  if (cuAbd.amHead.art === 'limit') grund += '; cubic am Limit';
  return s('failure', `${grund} (${kurz(head)})`, extra);
}

function bewerteRelease(d) {
  const head = d.pr.head_sha;
  const rel = d.release || {};
  const bericht = [`Release staging → main, Stand \`${kurz(head)}\`.`];
  const offen = [];
  const prs = new Set();
  if (rel.zuGross) offen.push('mehr als 250 Commits, nicht vollstaendig abrufbar');
  for (const c of rel.commits || []) {
    const ok = (c.prs || []).filter((p) => p.merged && p.base_ref === 'staging' && p.nachweis === 'success');
    if (ok.length) ok.forEach((p) => prs.add(p.number));
    else offen.push(`${kurz(c.sha)}${c.prs?.length ? ` (PR ${c.prs.map((p) => `#${p.number}: ${p.nachweis || 'kein Nachweis'}`).join(', ')})` : ' (kein PR)'}`);
  }
  bericht.push(`${(rel.commits || []).length} Commits, ${prs.size} PRs mit Nachweis, ${offen.length} ohne.`);
  for (const o of offen.slice(0, 20)) bericht.push(`- ohne Nachweis: ${o}`);
  if (offen.length > 20) bericht.push(`- … und ${offen.length - 20} weitere`);
  if (!offen.length && (rel.commits || []).length) return s('success', `Release: alle ${prs.size} PRs mit Review-Nachweis (${kurz(head)})`, { bericht, release: true });
  const a = ausnahme({ art: 'release-ausnahme', kommentare: d.kommentare || [], head, konten: d.freigabeKonten || [] });
  if (a.gilt) {
    bericht.push(`**RELEASE-AUSNAHME** dokumentiert von ${a.von}: ${a.url || ''}`);
    return s('success', `RELEASE-AUSNAHME: ${offen.length} ohne Nachweis, Freigabe Krisz dokumentiert (${kurz(head)})`, { bericht, release: true, ausnahme: true });
  }
  if (a.fehlend?.length) bericht.push(`Release-Ausnahme unvollstaendig, es fehlt: ${a.fehlend.join(', ')}`);
  return s('failure', `Release: ${offen.length} Commits ohne Review-Nachweis (${kurz(head)})`, { bericht, release: true });
}

/** Bereiche aus dem eigenen Bericht-Kommentar (Ledger) lesen. */
export function ledgerLesen(text) {
  const m = /<!-- review-nachweis:bereiche (\[[^]*?\]) -->/.exec(String(text || ''));
  if (!m) return [];
  try { return JSON.parse(m[1]).filter((r) => SHA.test(r.a) && SHA.test(r.b)); } catch { return []; }
}

/** Den Bericht-Kommentar bauen (Text fuer Menschen, Bereiche fuer den naechsten Lauf). */
export function berichtText(urteil, { bereiche, lauf, quelle }) {
  const symbol = urteil.state === 'success' ? '✅' : urteil.state === 'pending' ? '⏳' : '❌';
  const eindeutig = [];
  for (const r of bereiche) if (!eindeutig.some((x) => x.a === r.a && x.b === r.b)) eindeutig.push({ a: r.a, b: r.b });
  return [
    BERICHT_MARKE,
    `### ${symbol} review-nachweis: ${urteil.description}`,
    '',
    ...(urteil.bericht || []),
    '',
    `<sub>Automatischer Bericht, bei jedem Ereignis neu geschrieben. Auswertung aus: ${quelle}. [Lauf](${lauf}). Regeln: docs/review-workflow.md</sub>`,
    `<!-- review-nachweis:bereiche ${JSON.stringify(eindeutig)} -->`,
  ].join('\n');
}
