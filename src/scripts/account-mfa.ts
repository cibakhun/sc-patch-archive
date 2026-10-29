// Konto -> Sicherheit -> Zwei-Faktor-Anmeldung (MfaSettings.astro).
//
// Sichtbar fuer Admin-Konten (user_roles) und fuer jedes Konto mit einem
// TOTP-Faktor. Einrichten: startEnroll -> QR-Code und Schluessel -> erster
// Code (finishEnroll); danach steht diese Sitzung auf aal2. Ein weiteres
// Geraet hinzufuegen oder ein bestaetigtes entfernen verlangt Supabase aus
// einer aal2-Sitzung; fehlt sie, fragt die Karte zuerst den Code ab.
import { supabase } from '../lib/supabase';
import {
  finishEnroll, groupSecret, hasAal2, normalizeCode, removeFactor, startEnroll, totpFactors,
  type TotpFactor,
} from '../lib/mfa';
import { askCode } from '../lib/mfa-dialog';

const card = document.getElementById('mfaCard') as HTMLElement | null;
if (card) void boot(card);

async function boot(card: HTMLElement) {
  const C: Record<string, string> = JSON.parse(card.dataset.copy || '{}');
  const loc = card.dataset.lang === 'de' ? 'de-DE' : 'en-US';
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const stateEl = $('mfaState');
  const sessEl = $('mfaSession');
  const stepUpBtn = $<HTMLButtonElement>('mfaStepUp');
  const list = $<HTMLUListElement>('mfaList');
  const addRow = $('mfaAddRow');
  const nameIn = $<HTMLInputElement>('mfaName');
  const addBtn = $<HTMLButtonElement>('mfaAdd');
  const enrollBox = $('mfaEnroll');
  const qr = $<HTMLImageElement>('mfaQr');
  const secretEl = $('mfaSecret');
  const codeIn = $<HTMLInputElement>('mfaEnrollCode');
  const okBtn = $<HTMLButtonElement>('mfaEnrollOk');
  const cancelBtn = $<HTMLButtonElement>('mfaEnrollCancel');
  const status = $('mfaStatus');
  if (!stateEl || !sessEl || !stepUpBtn || !list || !addRow || !nameIn || !addBtn || !enrollBox
    || !qr || !secretEl || !codeIn || !okBtn || !cancelBtn || !status) return;

  const say = (msg: string, ok = false) => {
    status.textContent = msg;
    status.classList.toggle('acx-status--ok', ok && !!msg);
    status.hidden = !msg;
  };

  const { data: sess } = await supabase.auth.getSession();
  const user = sess.session?.user;
  if (!user) return; // account-dashboard.ts leitet zur Anmeldung

  let isAdmin = false;
  try {
    const { data: roleRow } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    isAdmin = !!roleRow && roleRow.role === 'admin';
  } catch { /* dann nur mit vorhandenem Faktor sichtbar */ }

  let verified: TotpFactor[] = [];
  let pendingId = '';

  const fmtDate = (iso?: string) => {
    const t = iso ? Date.parse(iso) : NaN;
    return t ? new Date(t).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  };

  const paint = async () => {
    const fs = await totpFactors(supabase);
    verified = fs ? fs.verified : [];
    card.hidden = !(isAdmin || verified.length > 0 || (fs && fs.pending.length > 0));
    if (card.hidden) return;
    stateEl.textContent = verified.length === 0 ? C.off
      : verified.length === 1 ? C.on1 : (C.onN || '').replace('%n%', String(verified.length));
    const aal2 = await hasAal2(supabase);
    sessEl.textContent = verified.length ? (aal2 ? C.sessAal2 : C.sessAal1) : '';
    stepUpBtn.hidden = !verified.length || aal2;
    addBtn.textContent = verified.length ? C.addMore : C.add;

    list.replaceChildren(...verified.map((f) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'mfa-name';
      name.textContent = f.friendly_name || C.nameFallback;
      const since = document.createElement('span');
      since.className = 'mfa-since';
      since.textContent = (C.since || '').replace('%d%', fmtDate(f.created_at));
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = card.dataset.clsHot || 'btn';
      rm.textContent = C.remove;
      rm.addEventListener('click', () => void onRemove(f, rm));
      li.append(name, since, rm);
      return li;
    }));
  };

  /** Fehlt der Sitzung der Code, erst nachfragen. true = jetzt aal2. */
  const ensureAal2 = async (): Promise<boolean> => {
    if (!verified.length || (await hasAal2(supabase))) return true;
    const ok = await askCode(supabase);
    if (!ok) say(C.errAal);
    else document.dispatchEvent(new CustomEvent('vb:aal2'));
    return ok;
  };

  const onRemove = async (f: TotpFactor, btn: HTMLButtonElement) => {
    say('');
    // Zweistufig statt confirm(): erster Klick fragt nach, zweiter entfernt.
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1';
      btn.textContent = C.removeSure;
      setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = C.remove; } }, 5000);
      return;
    }
    btn.disabled = true;
    if (!(await ensureAal2())) { btn.disabled = false; return; }
    let r = await removeFactor(supabase, f.id);
    if (r === 'aal' && (await askCode(supabase))) r = await removeFactor(supabase, f.id);
    await paint();
    if (r === 'ok') say(verified.length ? C.okRemoved : C.okRemovedLast, true);
    else say(r === 'aal' ? C.errAal : C.errNet);
  };

  const closeEnroll = () => {
    enrollBox.hidden = true;
    addRow.hidden = false;
    qr.removeAttribute('src');
    secretEl.textContent = '';
    codeIn.value = '';
    pendingId = '';
  };

  addBtn.addEventListener('click', async () => {
    say('');
    addBtn.disabled = true;
    const idle = addBtn.textContent;
    addBtn.textContent = C.adding;
    try {
      if (!(await ensureAal2())) return;
      const r = await startEnroll(supabase, nameIn.value, C.nameFallback);
      if (!r.ok) {
        say(r.reason === 'aal' ? C.errAal : r.reason === 'limit' ? C.errLimit
          : r.reason === 'disabled' ? C.errDisabled : r.reason === 'rate' ? C.errRate : C.errNet);
        return;
      }
      pendingId = r.id;
      if (r.qr) qr.src = r.qr; else qr.removeAttribute('src');
      secretEl.textContent = groupSecret(r.secret);
      addRow.hidden = true;
      enrollBox.hidden = false;
      codeIn.focus();
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = idle;
    }
  });

  const confirmEnroll = async () => {
    say('');
    const code = normalizeCode(codeIn.value);
    if (!code) { say(C.errFormat); codeIn.focus(); return; }
    if (!pendingId) return;
    okBtn.disabled = true;
    okBtn.textContent = C.confirming;
    const r = await finishEnroll(supabase, pendingId, code);
    okBtn.disabled = false;
    okBtn.textContent = C.confirm;
    if (r !== 'ok') {
      say(r === 'wrong' ? C.errWrong : r === 'rate' ? C.errRate : C.errNet);
      codeIn.select();
      return;
    }
    closeEnroll();
    nameIn.value = '';
    await paint();
    say(verified.length > 1 ? C.okAdded : C.okAddedOne, true);
    // Die Sitzung steht jetzt auf aal2 (z. B. fuer die Testpiloten-Liste).
    document.dispatchEvent(new CustomEvent('vb:aal2'));
  };
  okBtn.addEventListener('click', () => void confirmEnroll());
  codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void confirmEnroll(); } });

  cancelBtn.addEventListener('click', async () => {
    const id = pendingId;
    closeEnroll();
    say('');
    // Angefangener Faktor ohne Bestaetigung: gleich wieder weg (sonst
    // raeumt ihn startEnroll beim naechsten Mal ab).
    if (id) { try { await supabase.auth.mfa.unenroll({ factorId: id }); } catch { /* bleibt bis zum naechsten Versuch */ } }
  });

  stepUpBtn.addEventListener('click', async () => {
    say('');
    if (await askCode(supabase)) document.dispatchEvent(new CustomEvent('vb:aal2'));
  });
  // Code anderswo eingegeben (Anmeldung im Konto, Testpiloten-Karte)?
  document.addEventListener('vb:aal2', () => void paint());

  await paint();
}
