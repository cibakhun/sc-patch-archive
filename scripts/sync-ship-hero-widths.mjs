/* ============================================================
   sync-ship-hero-widths.mjs — welche größeren Fassungen der Schiffsbilder
   liefert das Wiki?

   Die Bühne jeder Schiffsseite ist randlos breit, das Wiki-Bild dahinter
   aber ein 1280-px-Vorschaubild (`…/thumb/…/1280px-NAME`). Auf den
   Schirmen, die die Besucher wirklich haben (Umami, 90 Tage bis
   06.10.2026: 1920 px ~27 %, 2560 px ~20 %, 3440 px ~6 %, 3840 px ~3 %),
   wurde es also 1,5- bis 3-fach hochgezogen und sichtbar weich.

   MediaWiki erzeugt Vorschaubilder in jeder Breite — aber NIE breiter als
   das Original, darüber antwortet es mit 404. Gemessen am 06.10.2026 über
   191 Bühnenbilder: 125 gibt es in 2560 px, 44 nur bis 1920 px, 22 gar
   nicht größer. Ein blindes `srcset` hätte also bei jedem dritten Schiff
   erst eine tote Anfrage gestellt. Deshalb wird hier GEMESSEN und das
   Ergebnis committet; src/lib/shipRenders.ts bietet nur an, was es gibt.

   Fehlt ein Bild in der Tabelle (neue Hero-URL nach einem Datenlauf), gibt
   es für dieses Schiff schlicht kein srcset — der alte Zustand, nie ein
   kaputtes Bild. Ein Lauf nach `sync:ships`/`datamine:vehicles` holt es
   nach.

   Netz: ja (HEAD auf media.starcitizen.tools) — Schiene B, nicht im Tor.
   Höflich: nacheinander, eine Anfrage zur Zeit, mit Atempause.

     node scripts/sync-ship-hero-widths.mjs
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';

const QUELLE = 'src/data/vehicles.json';
const ZIEL = 'src/data/ship-hero-widths.json';
const STUFEN = [2560, 1920]; // größte zuerst: wer 2560 hat, hat auch 1920
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const roh = readFileSync(QUELLE, 'utf8');
const RE = /"hero"\s*:\s*"(https:\/\/media\.starcitizen\.tools\/thumb\/[^"]+?\/1280px-[^"]+)"/g;
const urls = [...new Set([...roh.matchAll(RE)].map((m) => m[1]))].sort();
if (urls.length < 150) {
  console.error(`FEHLER: nur ${urls.length} Bühnenbilder in ${QUELLE} gefunden (erwartet ~190) — Muster prüfen, nichts geschrieben.`);
  process.exit(1);
}

/* true = gibt es, false = gibt es nicht (404/400), null = unklar (Netz) */
async function gibtEs(url) {
  for (let versuch = 0; versuch < 3; versuch++) {
    try {
      const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (r.status === 200) return true;
      if (r.status === 404 || r.status === 400) return false;
    } catch { /* Netz wackelt — gleich noch einmal */ }
    await pause(1000 * (versuch + 1));
  }
  return null;
}

const breiten = {};
const zaehl = { 2560: 0, 1920: 0, 1280: 0, unklar: 0 };
for (const [i, u] of urls.entries()) {
  let max = 1280;
  for (const w of STUFEN) {
    const ok = await gibtEs(u.replace('/1280px-', `/${w}px-`));
    if (ok === null) { max = null; break; }
    if (ok) { max = w; break; }
  }
  if (max === null) zaehl.unklar++;
  else zaehl[max]++;
  if (max && max > 1280) breiten[u] = max;
  if ((i + 1) % 25 === 0) process.stderr.write(`  … ${i + 1}/${urls.length}\n`);
  await pause(120);
}

/* Unklare Antworten sind KEIN Anlass, den alten Stand zu verschlechtern:
   lieber gar nicht schreiben als eine Tabelle mit Löchern, die gestern
   noch voll war. */
if (zaehl.unklar > 0) {
  console.error(`FEHLER: ${zaehl.unklar} von ${urls.length} Bildern ohne klare Antwort — Netz prüfen, nichts geschrieben.`);
  process.exit(1);
}

const aus = {
  quelle: 'media.starcitizen.tools — HEAD auf die 1920- und 2560-px-Vorschaubilder je Bühnenbild aus src/data/vehicles.json',
  gemessen: new Date().toISOString().slice(0, 10),
  geprueft: urls.length,
  stufen: { 2560: zaehl[2560], 1920: zaehl[1920], nurBis1280: zaehl[1280] },
  breiten,
};
writeFileSync(ZIEL, JSON.stringify(aus, null, 2) + '\n', 'utf8');
console.log(`${ZIEL}: ${urls.length} Bühnenbilder geprüft — 2560 px: ${zaehl[2560]} · 1920 px: ${zaehl[1920]} · nur 1280 px: ${zaehl[1280]}`);
