// Anmelden, Registrieren, Passwort vergessen: Rückmeldung vor dem Absenden.
//
// 1. src/lib/auth-felder.ts nennt fehlende Felder als Satz (joinNames) und
//    prüft die Form einer Adresse (EMAIL_FORM, badEmail). „Passwort
//    vergessen“ antwortet absichtlich immer mit „Schau in dein Postfach“;
//    ohne Formprüfung kam das auch bei „abc“ oder „pilot@“.
// 2. Die drei Formulare rufen die Prüfungen auf, BEVOR sie etwas schicken,
//    und die Passwortregel steht dauerhaft am Feld, nicht nur im Platzhalter.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as nodeModule from 'node:module';

async function loadTs(rel) {
  const src = fs.readFileSync(path.resolve(rel), 'utf8');
  let js;
  if (typeof nodeModule.stripTypeScriptTypes === 'function') {
    js = nodeModule.stripTypeScriptTypes(src);
  } else {
    const { transformSync } = await import('esbuild');
    js = transformSync(src, { loader: 'ts', format: 'esm' }).code;
  }
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}

const { joinNames, EMAIL_FORM, badEmail } = await loadTs('src/lib/auth-felder.ts');
const read = (rel) => fs.readFileSync(path.resolve(rel), 'utf8');

/** Feld und Statusfeld, so weit badEmail sie anfasst. */
function fake(value) {
  const attrs = {};
  const input = {
    value,
    focused: false,
    setAttribute: (k, v) => { attrs[k] = v; },
    focus() { this.focused = true; },
  };
  const status = { id: 'rsStatus', textContent: '', hidden: true, classList: { remove() {} } };
  return { input, status, attrs };
}

describe('auth-felder: Satz und Adressform', () => {
  test('fehlende Felder stehen wie im Satz', () => {
    assert.equal(joinNames(['E-Mail'], ' und '), 'E-Mail');
    assert.equal(joinNames(['E-Mail', 'Passwort'], ' und '), 'E-Mail und Passwort');
    assert.equal(joinNames(['A', 'B', 'C'], ' and '), 'A, B and C');
  });

  test('ungültige Adressen fallen durch, gültige kommen durch', () => {
    for (const bad of ['abc', 'pilot@', '@beispiel.de', 'pilot@beispiel', 'pi lot@beispiel.de', 'pilot@@beispiel.de', 'pilot@beispiel.', 'pilot@beispiel.de,', 'pilot@bei;spiel.de', 'pilot@beispiel..de']) {
      assert.equal(EMAIL_FORM.test(bad), false, bad);
    }
    for (const good of ['du@beispiel.de', 'a.b+c@mail.example.com', 'X_1@sub.domain.io', 'kai@müller-flug.de']) {
      assert.equal(EMAIL_FORM.test(good), true, good);
    }
  });

  test('badEmail: Satz ins Statusfeld, Feld markiert und fokussiert', () => {
    const { input, status, attrs } = fake('abc');
    assert.equal(badEmail(input, status, 'Keine gültige Adresse'), true);
    assert.equal(status.textContent, 'Keine gültige Adresse');
    assert.equal(status.hidden, false);
    assert.equal(attrs['aria-invalid'], 'true');
    assert.equal(attrs['aria-errormessage'], 'rsStatus');
    assert.equal(input.focused, true);
  });

  test('badEmail: gültige Adresse (mit Leerraum am Rand) bleibt unberührt', () => {
    const { input, status, attrs } = fake('  du@beispiel.de ');
    assert.equal(badEmail(input, status, 'x'), false);
    assert.equal(status.hidden, true);
    assert.deepEqual(attrs, {});
  });
});

describe('Formulare: prüfen vor dem Absenden, Regel am Feld', () => {
  test('Passwort vergessen: leer und falsche Form melden sich, bevor der Link angefordert wird', () => {
    const src = read('src/components/account/AuthReset.astro');
    const leer = src.indexOf('missingFields(form, status)');
    const form = src.indexOf('badEmail(');
    const senden = src.indexOf('resetPasswordForEmail(');
    assert.ok(leer > 0 && form > leer && senden > form, 'Reihenfolge: missingFields, badEmail, resetPasswordForEmail');
    assert.match(src, /data-msg-missing=\{COPY\.missing\}/);
    assert.match(src, /data-msg-mail=\{COPY\.errMail\}/);
  });

  test('Registrieren: Adressform vor dem Konto-Aufruf', () => {
    const src = read('src/components/account/AuthRegister.astro');
    const form = src.indexOf('badEmail(');
    const senden = src.indexOf("functions.invoke('register'");
    assert.ok(form > 0 && senden > form, 'badEmail vor dem Aufruf');
  });

  test('Passwortregel steht als Hinweis am Feld und ist mit ihm verknüpft', () => {
    for (const [rel, id] of [['src/components/account/AuthRegister.astro', 'rgPass'], ['src/components/account/AuthUpdatePassword.astro', 'upPass']]) {
      const src = read(rel);
      const feld = new RegExp(`<input[^>]*id="${id}"[^>]*aria-describedby="${id}Hint"`);
      assert.match(src, feld, `${rel}: ${id} verweist auf den Hinweis`);
      assert.match(src, new RegExp(`<p class="acx-hint" id="${id}Hint">\\{COPY\\.passHint\\}</p>`), `${rel}: Hinweis vorhanden`);
      assert.match(src, /passHint: [`']Mindestens (12|\$\{MIN_PASS\}) Zeichen\.[`']/, `${rel}: Regel auf Deutsch`);
      assert.match(src, /passHint: [`']At least (12|\$\{MIN_PASS\}) characters\.[`']/, `${rel}: Regel auf Englisch`);
    }
  });
});
