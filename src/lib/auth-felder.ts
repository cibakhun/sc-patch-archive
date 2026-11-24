// Leeres Abschicken bei Anmelden und Registrieren: alle fehlenden Pflicht-
// felder auf einmal nennen (statt still nichts zu tun oder nur das erste zu
// melden), die Felder markieren und das erste fokussieren. Die Formulare
// tragen novalidate, die Browser-Blase kommt also nicht; Text und Bindewort
// stehen am Formular (data-msg-missing mit {f}, data-and).

/** Die Felder wie im Satz: „E-Mail", „E-Mail und Passwort", „A, B und C". */
export function joinNames(names: string[], and: string): string {
  if (names.length < 2) return names.join('');
  return names.slice(0, -1).join(', ') + and + names[names.length - 1];
}

/** Name eines Feldes aus seinem Label, ohne das Pflicht-Sternchen. */
function nameOf(input: HTMLInputElement): string {
  const lbl = input.id ? input.form?.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`) : null;
  const t = (lbl?.childNodes[0]?.textContent || lbl?.textContent || input.name || '').replace('*', '').trim();
  return t;
}

/**
 * Prüft alle Pflichtfelder des Formulars. Fehlt etwas, steht der Satz im
 * Statusfeld, die Felder tragen aria-invalid, und die Antwort ist true.
 */
export function missingFields(form: HTMLFormElement, status: HTMLElement): boolean {
  const fields = Array.from(form.querySelectorAll<HTMLInputElement>('input[required]'));
  const leer = fields.filter((f) => (f.type === 'password' ? f.value : f.value.trim()) === '');
  for (const f of fields) {
    if (leer.includes(f)) f.setAttribute('aria-invalid', 'true');
    else f.removeAttribute('aria-invalid');
    if (!f.dataset.leerHoerer) {
      f.dataset.leerHoerer = '1';
      f.addEventListener('input', () => f.removeAttribute('aria-invalid'));
    }
  }
  if (!leer.length) return false;
  const msg = (form.dataset.msgMissing || '{f}').replace('{f}', joinNames(leer.map(nameOf), form.dataset.and || ', '));
  status.textContent = msg;
  status.classList.remove('acx-status--ok');
  status.hidden = false;
  leer[0].focus();
  return true;
}
