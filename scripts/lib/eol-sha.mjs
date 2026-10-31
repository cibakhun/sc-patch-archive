// Fingerabdruck unabhängig von den Zeilenenden der Arbeitskopie (18.10.2026).
//
// core.autocrlf=true (systemweit in Git für Windows) checkt Textdateien mit
// CRLF aus; Repo und CI (Linux) haben LF. Roh gehasht ergab derselbe Inhalt
// unter Windows einen anderen Wert als beim Erzeuger: verify:hangar-hall [14]
// riss in jedem Windows-Checkout, CI blieb grün. Darum Text vor dem Hash auf
// LF, Binärdateien roh. Text heißt wie bei git: keine NUL in den ersten 8000
// Bytes, also genau die Dateien, die git beim Auschecken umschreibt. Auf
// LF-Inhalt ändert das kein Byte: Werte von vor dieser Datei bleiben gültig.

import { createHash } from 'node:crypto';

const isText = (buf) => !buf.subarray(0, 8000).includes(0);

/** Inhalt mit LF statt CRLF (Zeichenkette oder Textdatei), Binärdaten unverändert. */
export function lf(input) {
  if (typeof input === 'string') return input.replace(/\r\n/g, '\n');
  // latin1 hin und zurück ist byte-genau, auch bei kaputtem UTF-8
  return isText(input) ? Buffer.from(input.toString('latin1').replace(/\r\n/g, '\n'), 'latin1') : input;
}

/** Erste 8 Hexstellen des sha1 über lf(input). */
export const sha8 = (input) => createHash('sha1').update(lf(input)).digest('hex').slice(0, 8);
