/* Traegt die Messwerte vom 31.08.2026 in den offenen Punkt id 60 nach.
   Der Punkt ist ein Gestaltungsurteil des Betreibers und bleibt offen —
   ergaenzt wird nur, was inzwischen dazugemessen wurde. */
import { readFileSync, writeFileSync } from 'node:fs';
const P = '.planning/WINDOWS.md';
const roh = readFileSync(P, 'utf8');
const m = roh.match(/```(?:json)?\r?\n([\s\S]*?)```/);
const arr = JSON.parse(m[1]);

const e = arr.find((x) => x.id === 60);
if (!e) throw new Error('id 60 nicht gefunden');
const nachtrag = ' NACHGETRAGEN 31.08.2026: der Punkt ist enger geworden, weil die zweite Ursache inzwischen weg ist. Die Erstbesuch-Hilfe klappt jetzt nur noch auf, wenn dahinter Bedienung im Bild bleibt (gemessen statt geraten, id 62). Damit liegt die erste Bedienung auf /missionen.html bei 1024x768 auf 593px (77 %), bei 1280x720 auf 643px (89 %) und bei 1440x900 auf 715px (79 %) -- alle im Bild. Was BLEIBT, ist der Hero selbst: bei 844x390 ist er 347px hoch = 89 % des Fensters, bei 1181x560 381px = 68 %. Dort liegt die erste Bedienung weiter bei 135 % bzw. 104 %, auch mit zugeklappter Hilfe. Aufgeschluesselt (844x390): h1 56px, Beschreibungszeile 60px, Kennzahlenreihe 54px, Rest Innenabstaende. Der Hero ist damit bereits auf Inhaltsmass geschrumpft -- weiter geht es nur, indem eines der drei Stuecke auf flachen Fenstern wegfaellt, und WELCHES ist die Gestaltungsfrage. Messwerkzeug: .planning/sketches/tools/mess-erste-bedienung.mjs und mess-was-drueber.mjs.';
if (!e.description.includes('NACHGETRAGEN 31.08.2026')) e.description += nachtrag;

const text = JSON.stringify(arr, null, 2);
let neu = roh.replace(m[1], text + '\n');
const z = { open: 0, waived: 0, fixed: 0 };
for (const x of arr) z[x.status] = (z[x.status] || 0) + 1;
neu = neu.replace(/open_count: \d+/, 'open_count: ' + z.open)
         .replace(/waived_count: \d+/, 'waived_count: ' + z.waived)
         .replace(/fixed_count: \d+/, 'fixed_count: ' + z.fixed)
         .replace(/total_count: \d+/, 'total_count: ' + arr.length)
         .replace(/last_updated: .*/, 'last_updated: 2026-08-31T15:55:00.000Z');
writeFileSync(P, neu, 'utf8');
console.log('id 60 ergaenzt; Zaehler ' + z.open + '/' + z.waived + '/' + z.fixed + '/' + arr.length);
