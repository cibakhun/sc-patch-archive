// Leeres Abschicken bei Anmelden, Registrieren und „Passwort vergessen“:
// alle fehlenden Pflichtfelder auf einmal nennen (statt still nichts zu tun
// oder nur das erste zu melden), die Felder markieren und das erste
// fokussieren. Dazu die Form der Adresse vor dem Absenden. Die Formulare
// tragen novalidate, die Browser-Blase kommt also nicht; Text und Bindewort
// stehen am Formular (data-msg-missing mit {f}, data-and).

/** Die Felder wie im Satz: „E-Mail", „E-Mail und Passwort", „A, B und C". */
export function joinNames(names: string[], and: string): string {
  if (names.length < 2) return names.join('');
  return names.slice(0, -1).join(', ') + and + names[names.length - 1];
}

/**
 * Feld fokussieren und den Satz mit ins Bild holen. Beim Registrieren am
 * Desktop zeigte der Fokus nur das Feld, der Satz stand darunter außer
 * Sicht. Passt nicht alles, geht das Feld vor dem Satz und der Satz vor der
 * Beschriftung; oben bleiben 80 px für die Kopfleiste. Es rollt nur das
 * eigene Fenster, nicht die Seite um einen Rahmen herum: im Terminal der
 * Halle läuft das Formular in einem.
 */
function insBild(feld: HTMLInputElement, status: HTMLElement): void {
  if (typeof window === 'undefined' || typeof feld.getBoundingClientRect !== 'function') {
    feld.focus();
    return;
  }
  feld.focus({ preventScroll: true });
  const f = feld.getBoundingClientRect();
  const s = status.getBoundingClientRect();
  const satz = s.bottom - window.innerHeight + 16; // so weit rollen, und der Satz steht im Bild
  const mitLabel = f.top - 140; // höchstens so weit, und die Beschriftung bleibt sichtbar
  const nurFeld = f.top - 80; // höchstens so weit, und das Feld bleibt sichtbar
  const weg = satz <= mitLabel ? Math.min(Math.max(0, satz), mitLabel) : Math.min(satz, nurFeld);
  if (weg) window.scrollBy(0, weg);
}

/** Name eines Feldes aus seinem Label, ohne das Pflicht-Sternchen. */
function nameOf(input: HTMLInputElement): string {
  const lbl = input.id ? input.form?.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`) : null;
  return (lbl?.childNodes[0]?.textContent || lbl?.textContent || input.name || '').replace(/\*/g, '').trim();
}

/**
 * Prüft alle Pflichtfelder des Formulars. Fehlt etwas, steht der Satz im
 * Statusfeld, die Felder tragen aria-invalid, und die Antwort ist true.
 */
export function missingFields(form: HTMLFormElement, status: HTMLElement): boolean {
  const fields = Array.from(form.querySelectorAll<HTMLInputElement>('input[required]'));
  const leer = fields.filter((f) => (f.type === 'password' ? f.value : f.value.trim()) === '');
  // Markiert heißt: aria-invalid und ein Verweis auf den Satz im Statusfeld.
  const gut = (f: HTMLInputElement) => { f.removeAttribute('aria-invalid'); f.removeAttribute('aria-errormessage'); };
  for (const f of fields) {
    if (leer.includes(f)) {
      f.setAttribute('aria-invalid', 'true');
      if (status.id) f.setAttribute('aria-errormessage', status.id);
    } else gut(f);
    if (!f.dataset.leerHoerer) {
      f.dataset.leerHoerer = '1';
      f.addEventListener('input', () => gut(f));
    }
  }
  if (!leer.length) return false;
  const msg = (form.dataset.msgMissing || '{f}').replace('{f}', joinNames(leer.map(nameOf), form.dataset.and || ', '));
  status.textContent = msg;
  status.classList.remove('acx-status--ok');
  status.hidden = false;
  insBild(leer[0], status);
  return true;
}

/** Grobe Form einer Adresse: etwas@etwas.tld, ohne Leerzeichen. */
export const EMAIL_FORM = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/**
 * Adresse in falscher Form: Satz ins Statusfeld, Feld markiert und
 * fokussiert, Antwort true. „Passwort vergessen“ antwortet absichtlich
 * immer gleich (verrät nicht, ob es ein Konto gibt); ohne diese Prüfung
 * meldete es auch bei „abc“ eine verschickte Mail.
 */
export function badEmail(input: HTMLInputElement, status: HTMLElement, msg: string): boolean {
  if (EMAIL_FORM.test(input.value.trim())) return false;
  input.setAttribute('aria-invalid', 'true');
  if (status.id) input.setAttribute('aria-errormessage', status.id);
  status.textContent = msg;
  status.classList.remove('acx-status--ok');
  status.hidden = false;
  insBild(input, status);
  return true;
}
