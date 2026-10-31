/* Register-Nachtrag zum Breitbild-Durchgang vom 06.10.2026 — ueber gsd-cores
   eigene Bibliothek (parse → markFixed/appendWindow → render), nicht von
   Hand: so stimmen Tabelle, Kopfzahlen und JSON-Block hinterher ueberein.
   Schliesst id 63 (vom Betreiber beauftragt) und legt die Sichtabnahme
   sowie die geaenderte Zaehlung als eigene Eintraege an.
   Idempotent: ein zweiter Lauf aendert nichts.                           */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { homedir } from 'node:os';

const bw = createRequire(import.meta.url)(join(homedir(), '.claude', 'gsd-core', 'bin', 'lib', 'broken-windows.cjs'));
const P = '.planning/WINDOWS.md';
const jetzt = '2026-10-06T13:30:00.000Z';
let led = bw.parseLedger(readFileSync(P, 'utf8'));

const e63 = led.entries.find((e) => e.id === 63);
if (e63 && e63.status === 'open') {
  led = bw.markFixed(led, 63, { now: jetzt });
  led.entries = led.entries.map((e) => (e.id === 63 ? { ...e, reason: 'Vom Betreiber am 06.10.2026 beauftragt („die gesamte Seite nach den Umami-Daten optimieren"). Datengrundlage: Umami, 90 Tage bis 06.10.2026, ohne Bot-Signaturen — rund ein Drittel der echten Besucher an Schirmen ab 2560 px (2560x1440 ~20 %, 3440x1440 ~6 %, 3840x2160 ~3 %, 5120x1440 ~2 %). Umgesetzt als Zuschlag --vb-breit (assets/theme.css § 5: bis 1920 px exakt 0, darueber 75 % des Mehrplatzes, hoechstens 800 px) NUR an Kartenrastern: Item-Finder, Blueprint-Datenbank, Missionen, Schiffe, dazu die DataShell-Uebersichten /crafting, /items, /armor-sets (Schalter `breit`). Fliesstext behaelt seine Hoechstbreite (62–74ch), Tabellen- und Detailseiten bleiben bei 1080 px. Gemessen mit .planning/sketches/tools/mess-spalten.mjs: auf 3440 px 5/6/6/7 Spalten statt 2/3/4/4, auf 2560 px 4/5/5/6; mess-breit-werte.mjs belegt, dass bis 1920 px jeder berechnete Wert unveraendert ist. Sichtabnahme: id 65.' } : e));
}

const neu = [
  {
    kind: 'unrun-verify',
    phase: 'breitbild',
    file: 'assets/theme.css',
    description: 'Sichturteil offen (Breitbild-Durchgang 06.10.2026, beauftragt): vier sichtbare Aenderungen, alle aus den Umami-Daten abgeleitet und gemessen, aber nicht vom Betreiber angesehen. (a) Werkzeuge wachsen ab 1920 px mit (id 63) — auf 3440 px zeigt der Item-Finder 20 statt 6 Karten im ersten Bild; die Karten sind dort 310 statt 416 px breit, der Kategoriepfad bricht deshalb jetzt um statt gekappt zu werden (bei JEDER Fensterbreite, vorher nur unter 430 px). (b) Die Kopfleisten (SiteNav, DataShell .dp-bar, Zurueck-Marke) verteilen ihre Bedienelemente hoechstens ueber 2240 px (--vb-leiste) — auf 3440 px stehen Anmelden/Menue bei x=600 und x=2840 statt 45 und 3395; unter 2240 px Fensterbreite unveraendert. (c) Neuer Sprachhinweis (assets/sprachhinweis.js): wer mit deutschem Browser auf einer englischen Seite EINSTEIGT, bekommt unten links die deutsche Fassung angeboten, und umgekehrt (Anlass: 429 von 554 Einstiegen aus Deutschland lagen auf englischen Seiten). Nur beim Einstieg, nicht fuer Automaten, nach dem Schliessen ein Jahr lang nicht. Bei 1920 px liegt er auf den Datenseiten im freien Rand, auf /de/missionen deckt er ~40 px der Ecke des Hilfekastens ab. Aufnahmen: out/sprache/ via probe-sprachhinweis.mjs. (d) Schiffsbuehne mit srcset (153 von 227 Schiffsseiten): bei 1920/2560 px kein Hochziehen mehr (vorher 1,5x/2x), bei 4K 1,5x statt 3x — dafuer laedt ein Desktop-Aufruf 113–167 KB statt 65 KB vom Wiki (Fremdlast). Werkzeuge: breitbild.mjs, probe-buehnenbild.mjs.',
  },
  {
    kind: 'deviation',
    phase: 'breitbild',
    file: 'src/layouts/Layout.astro',
    description: 'Zaehlweise geaendert (06.10.2026) — Umami-Zahlen vor und nach der Auslieferung sind NICHT direkt vergleichbar. Nicht mehr gezaehlt: (1) alles ausserhalb von verse-base.com (data-domains; vorher in 90 Tagen localhost 662 und 127.0.0.1 996 Aufrufe aus den eigenen Messwerkzeugen), (2) navigator.webdriver, (3) die Fenstergroessen 1280x1200 (Singapur-Crawler, 2.608 „Besucher", allein 1.196 am 23.09.), 800x600 (241), 1024x1024 (63), 1200x3000 (7), 1280x1280 (5) — alle mit 97–100 % Absprung und 0–1 s, (4) Chrome iOS 390x844 OHNE Herkunft (201 von 203 Chrome-iOS-Besuchern, alle 0 s auf Uebersichtsseiten). Das verbleibende Risiko ist (4): ein echter iPhone-Nutzer, der die Adresse in Chrome TIPPT, wird beim ersten Aufruf nicht gezaehlt. Wer das nicht will, streicht die eine Zeile in vbZaehlen.',
  },
];
for (const n of neu) {
  if (led.entries.some((e) => e.phase === n.phase && e.file === n.file && e.kind === n.kind)) continue;
  led = bw.appendWindow(led, { ...n, line: undefined }, { now: jetzt }).ledger;
}

writeFileSync(P, bw.renderLedger(led), 'utf8');
const geprueft = bw.parseLedger(readFileSync(P, 'utf8'));
console.log(`Eintraege: ${geprueft.entries.length} · offen: ${bw.openCount(geprueft)} · neue ids: ${geprueft.entries.filter((e) => e.phase === 'breitbild').map((e) => e.id).join(', ')} · 63: ${geprueft.entries.find((e) => e.id === 63).status}`);
