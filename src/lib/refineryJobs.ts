// Auftragsrechnung, die Refinery-Seite und Konto-Kachel teilen. Ohne Datenimport,
// damit das Konto-Skript nicht die ganze Erz-/Stationsliste mitlädt.
// Bis 10/2026 rechneten beide getrennt: die Kachel summierte alle Aufträge,
// die Seite nur abgeholte, und dieselbe Bezeichnung zeigte zwei Zahlen.

export interface JobValueFields {
  status: string;
  est_value: number | null;
  sold_value: number | null;
  started_at: string;
}

/** Erlös, wenn eingetragen, sonst der geschätzte Wert. */
export function jobValue(j: Pick<JobValueFields, 'est_value' | 'sold_value'>): number {
  const v = j.sold_value != null ? Number(j.sold_value) : j.est_value != null ? Number(j.est_value) : 0;
  return Number.isFinite(v) ? v : 0;
}

/** „Refinery-Wert": alle Aufträge, aktive mit Schätzwert, abgeholte mit Erlös. */
export function refineryValue(jobs: readonly JobValueFields[]): { total: number; active: number } {
  let total = 0, active = 0;
  for (const j of jobs) {
    total += jobValue(j);
    if (j.status === 'active') active++;
  }
  return { total, active };
}

/** Verlaufslinie der letzten zehn Auftragswerte (alt → neu) als SVG-Inhalt, '' unter zwei Werten. */
export function refinerySpark(jobs: readonly JobValueFields[], gradId: string): string {
  const vals = [...jobs]
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
    .slice(0, 10)
    .map(jobValue)
    .reverse();
  if (vals.length < 2) return '';
  const W = 120, H = 24, mx = Math.max(...vals), mn = Math.min(...vals), rng = (mx - mn) || 1;
  const pts = vals.map((v, i) => [
    +((i / (vals.length - 1)) * W).toFixed(1),
    +(H - 2 - ((v - mn) / rng) * (H - 4)).toFixed(1),
  ] as const);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ');
  const area = 'M' + pts[0][0] + ',' + H + ' ' + pts.map((p) => 'L' + p[0] + ',' + p[1]).join(' ') + ' L' + pts[pts.length - 1][0] + ',' + H + ' Z';
  const end = pts[pts.length - 1];
  return `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--gold);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--gold);stop-opacity:0"/></linearGradient></defs>` +
    `<path d="${area}" fill="url(#${gradId})"/>` +
    `<path d="${line}" fill="none" style="stroke:var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` +
    `<circle cx="${end[0]}" cy="${end[1]}" r="2.2" style="fill:var(--gold)"/>`;
}

/** Countdown „2d 03:12:45" / „03:12:45" — für den Live-Ticker. */
export function fmtCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const hms = `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

/** Kurzname für den Mini-Timer: „ARC-L1" statt „ARC-L1 Wide Forest Station". */
export function stationShort(name: string): string {
  const n = String(name || '').trim();
  const lp = /^([A-Z]{3}-L\d)\b/.exec(n);
  return lp ? lp[1] : n;
}

export interface JobTimerFields {
  status: string;
  started_at: string;
  ready_at: string;
}

/** Laufende Aufträge für die Mini-Timer, nach Fertigzeit (fertige zuerst):
 *  left = Restzeit in ms, pct = Fortschritt 0–100. */
export function jobTimers<T extends JobTimerFields>(jobs: readonly T[], now: number): Array<{ job: T; left: number; pct: number; ready: boolean }> {
  const out: Array<{ job: T; left: number; pct: number; ready: boolean }> = [];
  for (const job of jobs) {
    if (job.status !== 'active') continue;
    const ready = Date.parse(job.ready_at);
    if (!Number.isFinite(ready)) continue;
    const start = Date.parse(job.started_at);
    const left = Math.max(0, ready - now);
    const span = ready - start;
    const pct = left <= 0 ? 100 : span > 0 ? Math.max(0, Math.min(100, ((now - start) / span) * 100)) : 0;
    out.push({ job, left, pct, ready: left <= 0 });
  }
  return out.sort((a, b) => Date.parse(a.job.ready_at) - Date.parse(b.job.ready_at));
}

export interface JobEventFields {
  status: string;
  started_at: string;
  ready_at: string;
  collected_at?: string | null;
}

/** Neuester Stand eines Auftrags für den Verlauf: abgeholt, fertig oder gestartet. */
export function latestJobEvent(j: JobEventFields, now: number): { kind: 'collected' | 'ready' | 'started'; ts: number } {
  const ready = Date.parse(j.ready_at);
  if (j.status === 'done' && j.collected_at) return { kind: 'collected', ts: Date.parse(j.collected_at) || 0 };
  if (j.status === 'active' && ready <= now) return { kind: 'ready', ts: ready };
  return { kind: 'started', ts: Date.parse(j.started_at) || 0 };
}
