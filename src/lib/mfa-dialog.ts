// Bedient den Code-Dialog (src/components/account/MfaCodeDialog.astro).
// askCode() oeffnet ihn, prueft den Code gegen die bestaetigten Faktoren
// (src/lib/mfa.ts) und loest mit true auf, sobald die Sitzung auf aal2
// steht, mit false bei Abbruch. Mehrere gleichzeitige Aufrufe teilen sich
// denselben offenen Dialog.
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeCode, verifyCode } from './mfa';

let open: Promise<boolean> | null = null;

export function askCode(client: Pick<SupabaseClient, 'auth'>): Promise<boolean> {
  if (open) return open;
  const dlg = document.getElementById('mfaDialog') as HTMLDialogElement | null;
  const form = document.getElementById('mfaDialogForm') as HTMLFormElement | null;
  const input = document.getElementById('mfaDialogCode') as HTMLInputElement | null;
  const btn = document.getElementById('mfaDialogBtn') as HTMLButtonElement | null;
  const cancel = document.getElementById('mfaDialogCancel') as HTMLButtonElement | null;
  const status = document.getElementById('mfaDialogStatus');
  if (!dlg || !form || !input || !btn || !cancel || !status) return Promise.resolve(false);
  const D = dlg.dataset;

  open = new Promise<boolean>((resolve) => {
    // Abbrechen ist auch waehrend der Pruefung moeglich. Kommt deren Ergebnis
    // danach, gehoert es zu dieser (beendeten) Sitzung und darf einen neu
    // geoeffneten Dialog weder schliessen noch beschriften.
    let settled = false;
    const say = (msg: string) => { status.textContent = msg; status.hidden = !msg; };
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      form.removeEventListener('submit', onSubmit);
      cancel.removeEventListener('click', onCancel);
      dlg.removeEventListener('cancel', onCancel);
      input.value = '';
      say('');
      btn.disabled = false;
      btn.textContent = D.submit || '';
      if (dlg.open) dlg.close();
      open = null;
      resolve(ok);
    };
    const onCancel = (e: Event) => { e.preventDefault(); done(false); };
    const onSubmit = async (e: Event) => {
      e.preventDefault();
      const code = normalizeCode(input.value);
      if (!code) { say(D.msgFormat || ''); input.focus(); return; }
      btn.disabled = true;
      btn.textContent = D.busy || '';
      say('');
      const r = await verifyCode(client, code);
      if (settled) return;
      btn.disabled = false;
      btn.textContent = D.submit || '';
      // 'none': der Faktor ist inzwischen weg (anderes Geraet), es gibt
      // nichts mehr nachzuweisen.
      if (r === 'ok' || r === 'none') { done(true); return; }
      say(r === 'wrong' ? (D.msgWrong || '') : r === 'rate' ? (D.msgRate || '') : (D.msgNet || ''));
      input.select();
    };
    form.addEventListener('submit', onSubmit);
    cancel.addEventListener('click', onCancel);
    dlg.addEventListener('cancel', onCancel);
    say('');
    if (!dlg.open) dlg.showModal();
    input.focus();
  });
  return open;
}
