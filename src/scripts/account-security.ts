// Bereich „Sicherheit & Konto" (Runde E, 29.10.2026): Anmeldung (E-Mail und
// Passwort als Zeilen, die erst auf Klick ihr Formular zeigen), verbundene
// Konten (Discord, RSI), Sitzungen (andere Geräte / überall abmelden) und
// „Meine Daten" als JSON-Datei.
//
// Die Formulare selbst (emailForm, passForm, RSI-Prüfung, Löschen, Discord
// verbinden und lösen) bedient weiter account-dashboard.ts. Hier nur
// Aufklappen, Zustände und die neuen Aktionen; Discord löst die vorhandenen
// Knöpfe der Discord-Karte aus und hört auf 'vb:discord'.
import { supabase } from '../lib/supabase';
import { buildAccountExport, exportFileName, type ExportClient } from '../lib/account-export';

const root = document.getElementById('sec');
if (root) boot(root);

function boot(root: HTMLElement) {
  const C: Record<string, string> = JSON.parse(root.dataset.copy || '{}');
  const lang = root.dataset.lang === 'de' ? 'de' : 'en';
  const loc = lang === 'de' ? 'de-DE' : 'en-US';
  const home = root.dataset.home || '/';
  const $ = (id: string) => document.getElementById(id);

  /* ------------------------------------------------------------ Meldung --- */
  let toastTimer = 0;
  const toast = (msg: string) => {
    const t = $('secToast');
    if (!t) return;
    $('secToastMsg')!.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { t.hidden = true; }, 3600);
  };

  /* ---------------------------------------------------------- Aufklappen --- */
  // [data-sec-open="<id>"] zeigt das Formular <id> unter seiner Zeile. Die
  // Beschriftung im geschlossenen Zustand steht in data-label (Passwort und
  // RSI wechseln sie je nach Zustand).
  const toggles = [...root.querySelectorAll<HTMLButtonElement>('[data-sec-open]')];
  toggles.forEach((b) => { b.dataset.label = b.textContent || ''; });
  const setLabel = (b: HTMLButtonElement | null, label: string) => {
    if (!b) return;
    b.dataset.label = label;
    if (b.getAttribute('aria-expanded') !== 'true') b.textContent = label;
  };
  const openForm = (b: HTMLButtonElement, open: boolean) => {
    const target = document.getElementById(b.dataset.secOpen || '');
    if (!target) return;
    target.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
    b.textContent = open ? C.cancel : (b.dataset.label || '');
    b.closest('.sec-row')?.classList.toggle('is-open', open);
    if (open) target.querySelector<HTMLInputElement>('input:not([type=hidden])')?.focus();
  };
  toggles.forEach((b) => b.addEventListener('click', () => openForm(b, b.getAttribute('aria-expanded') !== 'true')));

  // Sprünge aus dem Cockpit (z. B. Profil-Check „RSI" → pfRsiHandle): liegt
  // das Ziel in einem zugeklappten Formular, erst aufklappen. Läuft im selben
  // Ereignis vor dem Fokus, den account-dashboard.ts im nächsten Bild setzt.
  document.addEventListener('vb:tab', (e) => {
    const id = ((e as CustomEvent).detail || {}).el as string | undefined;
    const el = id ? document.getElementById(id) : null;
    const form = el?.closest<HTMLElement>('.sec-form');
    if (!form || !form.hidden) return;
    const b = toggles.find((t) => t.dataset.secOpen === form.id);
    if (b) openForm(b, true);
  });

  /* -------------------------------------------------------------- Schild --- */
  // „3 von 4": zweiter Anmeldeweg (Passwort, Discord), bestätigte RSI-Identität
  // und Zwei-Faktor, letzteres nur, wo die Karte dafür angeboten wird
  // (account-mfa.ts meldet das mit 'vb:mfa'). null = (noch) nicht bekannt,
  // der Punkt fehlt dann und zählt nicht mit.
  const shield: Record<string, boolean | null> = { pass: null, dc: null, rsi: null, mfa: null };
  const shieldEl = $('secShield');
  const paintShield = () => {
    if (!shieldEl || shield.pass === null) return;
    let n = 0, t = 0;
    shieldEl.querySelectorAll<HTMLButtonElement>('.sec-step').forEach((b) => {
      const v = shield[b.dataset.step || ''] ?? null;
      (b.parentElement as HTMLElement).hidden = v === null;
      if (v === null) return;
      t++;
      if (v) n++;
      b.classList.toggle('is-done', v);
      b.querySelector('span')!.textContent = (v ? b.dataset.on : b.dataset.off) || '';
    });
    $('secShieldN')!.textContent = n === t ? C.shieldAll : C.shieldN.replace('%n%', String(n)).replace('%t%', String(t));
    $('secShieldLevel')?.setAttribute('y', String(56 - 56 * (t ? n / t : 0)));
    shieldEl.classList.toggle('is-full', n === t);
    shieldEl.hidden = false;
  };
  // Offener Punkt: dorthin, wo man ihn erledigt (Formular klappt auf, siehe
  // 'vb:tab' oben); erledigter Punkt: zu seiner Zeile.
  shieldEl?.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('.sec-step');
    if (!b) return;
    const el = b.classList.contains('is-done') ? b.dataset.doneGo : b.dataset.go;
    document.dispatchEvent(new CustomEvent('vb:tab', { detail: { tab: 'security', el } }));
  });
  document.addEventListener('vb:mfa', (e) => {
    const d = ((e as CustomEvent).detail || {}) as { offered?: boolean; active?: boolean };
    shield.mfa = d.offered ? !!d.active : null;
    paintShield();
  });

  /* -------------------------------------------- Konto-Daten und Discord --- */
  const when = (iso?: string | null, withTime = false) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (!t) return '—';
    return new Date(t).toLocaleString(loc, withTime
      ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { month: 'long', year: 'numeric' });
  };

  const paintIdentities = async () => {
    let ids: any[] = [];
    try {
      const { data } = await (supabase.auth as any).getUserIdentities();
      ids = (data && data.identities) || [];
    } catch { /* ohne Antwort: Zeilen bleiben, wie sie sind */ return; }
    const dc = ids.find((i) => i.provider === 'discord') || null;
    const row = $('secDc');
    if (row) {
      row.classList.toggle('is-on', !!dc);
      const d = (dc && dc.identity_data) || {};
      $('secDcVal')!.textContent = dc
        ? String(d.custom_claims?.global_name || d.full_name || d.user_name || d.name || '').replace(/#0$/, '') || '✓'
        : C.notLinked;
      ($('secDcLink') as HTMLButtonElement).hidden = !!dc;
      ($('secDcUnlink') as HTMLButtonElement).hidden = !dc;
    }
    // Wer nur mit Discord angemeldet ist, hat kein Passwort: „Setzen".
    const hasPass = ids.some((i) => i.provider === 'email');
    $('secPassRow')?.classList.toggle('is-off', !hasPass);
    $('secPassVal')!.textContent = hasPass ? '••••••••' : C.noPass;
    setLabel($('secPassBtn') as HTMLButtonElement | null, hasPass ? C.change : C.set);
    shield.pass = hasPass;
    shield.dc = !!dc;
    paintShield();
  };
  $('secDcLink')?.addEventListener('click', () => ($('btnDiscordLink') as HTMLButtonElement | null)?.click());
  $('secDcUnlink')?.addEventListener('click', () => ($('btnDiscordUnlink') as HTMLButtonElement | null)?.click());
  document.addEventListener('vb:discord', () => { paintIdentities(); });

  // Rückmeldungen der Discord-Karte (Fehler, „zweiter Anmeldeweg nötig")
  // auch hier zeigen, wo der Knopf gedrückt wurde.
  const dcStatus = $('dcLinkStatus');
  const dcMsg = $('secDcMsg');
  if (dcStatus && dcMsg) {
    const mirror = () => {
      dcMsg.textContent = dcStatus.textContent || '';
      dcMsg.className = dcStatus.className + ' sec-msg';
      dcMsg.hidden = dcStatus.hidden || !dcStatus.textContent;
    };
    new MutationObserver(mirror).observe(dcStatus, { attributes: true, childList: true, characterData: true, subtree: true });
  }

  // RSI: Zustand aus dem Profil-Check (dieselbe Quelle wie das Cockpit).
  document.addEventListener('vb:profile-check', (e) => {
    const items = ((e as CustomEvent).detail || []) as Array<{ k: string; ok: boolean }>;
    const rsi = items.find((i) => i.k === 'rsi');
    if (!rsi) return;
    const handle = (($('pfRsiHandle') as HTMLInputElement | null)?.value || '').trim();
    $('secRsi')?.classList.toggle('is-on', rsi.ok);
    $('secRsiVal')!.textContent = rsi.ok && handle ? '@' + handle : C.rsiNone;
    setLabel($('secRsiBtn') as HTMLButtonElement | null, rsi.ok ? C.change : C.rsiOpen);
    shield.rsi = rsi.ok;
    paintShield();
  });

  /* ---------------------------------------------------------- Sitzungen --- */
  // Dieses Gerät, grob aus der Browserkennung (nur zur Anzeige).
  const device = () => {
    const ua = navigator.userAgent;
    const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
      : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
      : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
    return [b, os].filter(Boolean).join(' · ') || '—';
  };
  const dev = $('secDevice');
  if (dev) dev.textContent = device();

  // Zweistufig im Knopf selbst: erster Klick fragt nach, zweiter führt aus.
  const arm = (b: HTMLButtonElement, run: () => Promise<void>) => {
    let t = 0;
    const label = b.innerHTML;
    b.addEventListener('click', async () => {
      if (!t) {
        b.classList.add('is-armed');
        b.textContent = C.sure;
        t = window.setTimeout(() => { t = 0; b.classList.remove('is-armed'); b.innerHTML = label; }, 4000);
        return;
      }
      clearTimeout(t);
      t = 0;
      b.disabled = true;
      try { await run(); } finally { b.disabled = false; b.classList.remove('is-armed'); b.innerHTML = label; }
    });
  };

  const others = $('secOthers') as HTMLButtonElement | null;
  if (others) arm(others, async () => {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    toast(error ? C.err : C.othersDone);
  });

  const all = $('secAll') as HTMLButtonElement | null;
  if (all) arm(all, async () => {
    const { data } = await supabase.auth.getUser();
    // Wie beim normalen Abmelden: Präsenz sofort auf offline, dann die
    // lokalen Kopien des Kontos aus diesem Browser (forgetLocalCopies in
    // account-dashboard.ts; die Datenschutzerklärung #storage sagt das zu).
    if (data?.user) {
      try { await supabase.from('profiles').update({ last_seen: null, last_active: null, activity: null, activity_at: null }).eq('id', data.user.id); } catch { /* egal */ }
    }
    document.dispatchEvent(new Event('vb:forget-local'));
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) { toast(C.err); return; }
    location.href = home;
  });

  /* -------------------------------------------------------- Meine Daten --- */
  // Alles, was diesem Konto gehört, als eine Datei (Auskunft und Mitnahme,
  // Art. 15/20 DSGVO): lib/account-export.ts liest mit der eigenen Sitzung
  // jede Tabelle seitenweise und ausdrücklich nur die eigenen Zeilen, dazu die
  // Liste der hochgeladenen Bilder. Was sich nicht lesen lässt, steht in der
  // Datei unter errors; der Rest kommt trotzdem.
  const exportBtn = $('secExport') as HTMLButtonElement | null;
  exportBtn?.addEventListener('click', async () => {
    exportBtn.disabled = true;
    const label = exportBtn.innerHTML;
    exportBtn.textContent = C.exportBusy;
    try {
      const { data: u, error: uErr } = await supabase.auth.getUser();
      const user = u?.user;
      if (uErr || !user) throw uErr || new Error('no user');
      // ExportClient ist die schmale Form, die account-export.ts braucht; der
      // Vergleich mit den generischen supabase-js-Typen ist tsc zu tief.
      const dump = await buildAccountExport(
        supabase as unknown as ExportClient,
        user as unknown as { id: string } & Record<string, unknown>,
      );
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = exportFileName(lang);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      toast(dump.errors ? C.exportPartial : C.exportDone);
    } catch {
      toast(C.err);
    } finally {
      exportBtn.disabled = false;
      exportBtn.innerHTML = label;
    }
  });

  /* ---------------------------------------------------------------- Start --- */
  (async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return;
    const last = $('secLast');
    if (last) last.textContent = when(user.last_sign_in_at, true);
    const since = $('secSince');
    if (since) since.textContent = when(user.created_at);
    paintIdentities();
  })();
}
