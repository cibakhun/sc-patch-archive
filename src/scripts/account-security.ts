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
    // Wie beim normalen Abmelden: Präsenz sofort auf offline.
    if (data?.user) {
      try { await supabase.from('profiles').update({ last_seen: null, last_active: null, activity: null }).eq('id', data.user.id); } catch { /* egal */ }
    }
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) { toast(C.err); return; }
    location.href = home;
  });

  /* -------------------------------------------------------- Meine Daten --- */
  // Alles, was diesem Konto gehört, als eine Datei (Auskunft und Mitnahme).
  // Nachrichten seitenweise, weil PostgREST je Abfrage höchstens 1000
  // Zeilen liefert.
  const exportBtn = $('secExport') as HTMLButtonElement | null;
  const paged = async (table: string, order: string) => {
    const out: unknown[] = [];
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await supabase.from(table).select('*').order(order).range(from, from + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return out;
  };
  exportBtn?.addEventListener('click', async () => {
    exportBtn.disabled = true;
    const label = exportBtn.innerHTML;
    exportBtn.textContent = C.exportBusy;
    try {
      const { data: u } = await supabase.auth.getUser();
      const user = u?.user;
      if (!user) throw new Error('no user');
      const one = async (q: PromiseLike<{ data: unknown; error: unknown }>) => {
        const { data, error } = await q;
        if (error) throw error;
        return data;
      };
      const [profile, favorites, layouts, friends, requests, refinery, crafting, mining, discord, messages] = await Promise.all([
        one(supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()),
        one(supabase.from('favorites').select('*').order('created_at')),
        one(supabase.from('hangar_layouts').select('*').order('updated_at')),
        one(supabase.from('friends').select('*').order('created_at')),
        one(supabase.from('friend_requests').select('*').order('created_at')),
        one(supabase.from('refinery_jobs').select('*').order('created_at')),
        one(supabase.from('crafting_entries').select('*').order('slug')),
        one(supabase.from('mining_sig_presets').select('*').order('name')),
        one(supabase.from('discord_role_state').select('*').eq('user_id', user.id)),
        paged('direct_messages', 'id'),
      ]);
      const dump = {
        exported_at: new Date().toISOString(),
        site: location.origin,
        account: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          providers: (user.identities || []).map((i) => i.provider),
        },
        profile, favorites, hangar_layouts: layouts, friends, friend_requests: requests,
        direct_messages: messages, refinery_jobs: refinery, crafting: crafting,
        mining_presets: mining, discord_rank: discord,
      };
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      const handle = (profile as { handle?: string } | null)?.handle || user.id.slice(0, 8);
      a.href = URL.createObjectURL(blob);
      a.download = `versebase-konto-${handle}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(C.exportDone);
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
