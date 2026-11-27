/* ============================================================
   verify-werkbank-items.mjs  (Krisz 27.11.2026)

   „Da steht wieder ganz fett Datenblatt öffnen. Aber wofür sollte ein User
   den Datenblatt öffnen?“ (Krisz, 27.11.2026, zur Items-Werkbank). Nach der
   Regel „nur Werkbänke für Menschen“ (26.11.2026) fuehrt kein Weg mehr aus
   der Werkbank aufs Item-Datenblatt — also muss die Werkbank selbst
   beantworten, was das Blatt beantwortet. Dieses Tor haelt beide
   gegeneinander: das GEBAUTE Blatt (dist/[de/]items/<id>.html) und das
   Blatt, das die AUSGELIEFERTE Werkbank (dist/[de/]items.html mit
   assets/items-werkbank.js und /items-wege.json) im Pruefstand zeichnet.

   Je Item mit Datenblatt, beide Sprachen:
   [1] Wege: dieselben Karten in „So bekommst du es“ (data-weg).
   [2] Missionen zum Bauplan: dieselbe Zahl.
   [3] Ab Werk: dieselbe Zahl Schiffe.
   [4] Aehnliche Items: dieselben, in derselben Reihenfolge.
   [5] Gleichnamige Items: dieselben.
   [6] Set-Preis: derselbe Text.
   [7] Werkzeuge (Bruchrechner, Wikelo): dieselbe Zahl Wege dorthin.
   [8] Fahrzeug: zeigt das Blatt aufs Schiff, zeigt die Werkbank in die
       Schiffsliste.
   [9] Preisspanne: dieselbe.
   [10] Kaufen nach System: die Zeilen tragen dieselben Systeme.
   Je Item des Katalogs und je Set, beide Sprachen:
   [11] Kein Weg aufs Blatt: kein href im Blatt der Werkbank zeigt auf ein
        Datenblatt oder Verzeichnis (Item-, Bauplan-, Schiffs-, Missions-
        blatt, Kategorieliste, Blueprint-Verzeichnis, Set-Seite).
   [12] Melden je Item: jedes Item-Blatt der Werkbank hat „Falschen Wert
        melden“.

   Selbstauskunft: druckt je Sprache verglichene Items und je Pruefung die
   Zahl der Blaetter, auf denen es etwas zu vergleichen gab, und reisst
   unter den Klinken (ein leerlaufender Vergleich sieht sonst gruen aus).

   Kein git, kein Netz: alles aus dist/. Einziger Kindprozess ist esbuilds
   Dienst beim Buendeln (wie verify:clienttext).

       node scripts/verify-werkbank-items.mjs [--dist <ordner>] [--js <items-werkbank.js>] [--alle]
       (--js prueft eine andere Fassung des Skripts gegen denselben Bau —
       so wird die Gegenprobe gefahren.)
   ============================================================ */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { oeffneSeite } from './lib/pruefstand.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? resolve(argv[i + 1]) : null; };
const DIST = opt('--dist') || resolve(ROOT, 'dist');
const JS = opt('--js') || join(DIST, 'assets', 'items-werkbank.js');
const ALLE = argv.includes('--alle');
if (!existsSync(DIST)) { console.error(`verify:werkbank-items: ${DIST} fehlt — erst npm run build.`); process.exit(2); }

/* ---------- Klinken (gemessen 27.11.2026 am gebauten Stand, je Sprache) ----------
 * Etwas unter dem Messwert; nach oben nachziehen, nach unten nur per Commit
 * mit Ursache. „gleichnamig“ hat keine Klinke: seit den Zusammenlegungen vom
 * 26.11.2026 gibt es keine gleichnamigen Item-Seiten mehr (0 = 0 wird trotzdem
 * verglichen, sobald wieder welche entstehen). */
const KLINKE = {
  items: 9400, // Items im Katalog der Werkbank (9.462)
  blaetter: 5700, // davon mit Datenblatt, verglichen (5.783)
  wege: 5550, // Blaetter mit mindestens einem Weg (5.645)
  missionen: 660, // Blaetter mit Missionen zum Bauplan (686)
  serie: 260, // Blaetter mit Schiffen ab Werk (277)
  aehnlich: 5700, // Blaetter mit aehnlichen Items (5.781)
  setPreis: 2100, // Blaetter mit Set-Preis (2.182)
  werkzeuge: 130, // Blaetter mit Wegen in die Werkzeuge (139)
  fahrzeug: 170, // Fahrzeug-Items mit Datenblatt (178)
  spanne: 1450, // Blaetter mit Preisspanne (1.499)
  systemZeilen: 56000, // verglichene Bezugszeilen mit System (57.976)
  sets: 135, // Sets der Werkbank, auf Blatt-Links geprueft (143)
};

/* ---------- Pruefnaht wie in verify:clienttext ---------- */
const QUELLE = readFileSync(JS, 'utf8');
const ANKER = QUELLE.lastIndexOf('})();');
if (ANKER < 0 || QUELLE.slice(ANKER + 5).trim() !== '') {
  console.error(`verify:werkbank-items: ${JS} endet nicht mit "})();" — die Pruefnaht findet ihren Platz nicht.`);
  process.exit(1);
}
const NAHT = `
  window.__pruefnaht = {
    bereit: function () { return bereit; },
    ladeFehler: function () { return ladeFehler; },
    laden: function () { return typeof ladeZusatz === 'function' ? ladeZusatz() : ladeCraft(); },
    wege: function () { return typeof WEGE === 'undefined' ? null : WEGE; },
    leere: function () { if (io) io.disconnect(); el.gitter.innerHTML = ''; },
    items: function () { return ITEMS; },
    sets: function () { return SETLISTE; },
    blatt: function (it) {
      el.inh.innerHTML = blattItem(it);
      craftEinsetzen(it, document.getElementById('wzb-craft'));
      if (typeof wegeEinsetzen === 'function') wegeEinsetzen(it, document.getElementById('wzb-wege'), document.getElementById('wzb-mehr'));
      return el.inh.innerHTML;
    },
    satz: function (st) { return blattSatz(st); }
  };
`;
const CODE = QUELLE.slice(0, ANKER) + NAHT + QUELLE.slice(ANKER);
const SKRIPT = '/assets/items-werkbank.js';

/* ---------- Lesen ---------- */
// Entitäten in einem Durchgang: aus '&amp;quot;' wird '&quot;', nicht doppelt entschlüsselt '"'.
const ENT = { '&amp;': '&', '&#39;': "'", '&#x27;': "'", '&quot;': '"' };
const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/&(?:amp|#39|#x27|quot);/g, (e) => ENT[e]).replace(/\s+/g, ' ').replace(/\s+([·.,)])/g, '$1').trim();
const ab = (s, marke, ende) => {
  const i = s.indexOf(marke);
  if (i < 0) return null;
  const j = s.indexOf(ende, i);
  return s.slice(i, j < 0 ? undefined : j);
};
const alle = (re, s) => [...s.matchAll(re)].map((m) => m[1]);

/** Was das gebaute Datenblatt beantwortet. */
function blattAntworten(html) {
  const bw = ab(html, 'id="so-bekommst-du-es"', '</section>') ?? '';
  // Bis zum Ende der Wege-Liste: die Missionszeilen enden selbst mit </li>.
  const her = ab(bw, 'data-weg="herstellen"', '</section>') ?? '';
  const herUl = ab(her, 'bw-zeilen--links', '</ul>') ?? '';
  const mehr = /#missionen"[^>]*>\+\s*([\d.,]+)/.exec(herUl);
  const misLi = (herUl.match(/<li\b/g) ?? []).length;
  const serie = ab(html, 'id="serie"', '</section>') ?? '';
  const aeh = ab(html, 'data-aehnlich', '</ul>') ?? '';
  const zw = ab(html, 'dp-zwilling', '</p>') ?? '';
  const setp = /<p\b[^>]*data-set-preis[^>]*>([\s\S]*?)<\/p>/.exec(html);
  const wz = ab(html, 'id="werkzeuge"', '</section>') ?? '';
  const tab = ab(html, 'dp-bezug', '</table>') ?? '';
  const spanne = /class="dp-key"[^>]*><b[^>]*>(?:Preisspanne|Price range)<\/b><span[^>]*>([^<]*)<\/span>/.exec(html);
  return {
    wege: alle(/data-weg="([a-z-]+)"/g, bw).sort().join(','),
    missionen: mehr ? misLi - 1 + Number(mehr[1].replace(/[.,]/g, '')) : misLi,
    serie: (serie.match(/<a class="dp-chip"/g) ?? []).length,
    aehnlich: alle(/<li data-item="([^"]+)"/g, aeh).join(','),
    zwilling: alle(/href="(?:\/de)?\/items\/([^"/]+)\.html"/g, zw).sort().join(','),
    setPreis: setp ? text(setp[1]) : '',
    werkzeuge: (wz.match(/<a\b/g) ?? []).length,
    fahrzeug: html.includes('data-specs-schiff'),
    spanne: spanne ? spanne[1].trim() : '',
    systeme: alle(/<tr\b[^>]*\sdata-sys="([^"]*)"/g, tab).sort().join('|'),
  };
}

/** Was das Blatt der Werkbank beantwortet. */
function werkbankAntworten(html) {
  const wege = ab(html, 'id="wzb-wege"', 'id="wzb-quellen"') ?? '';
  const mis = /data-missionen="(\d+)"/.exec(wege);
  const aeh = ab(html, 'data-aehnlich', '</ul>') ?? '';
  const zw = ab(html, 'wzb-zw', '</p>') ?? '';
  const setp = /<p\b[^>]*data-set-preis[^>]*>([\s\S]*?)<\/p>/.exec(html);
  const serie = /data-serie="(\d+)"/.exec(html);
  const spanne = /data-spanne="?[^>]*>([^<]*)</.exec(html);
  const liste = ab(html, 'class="wzb-q"', '</ul>') ?? '';
  return {
    wege: alle(/data-weg="([a-z-]+)"/g, wege).sort().join(','),
    missionen: mis ? Number(mis[1]) : 0,
    serie: serie ? Number(serie[1]) : 0,
    serieChips: (html.match(/<a class="wz-tag" href=/g) ?? []).length,
    aehnlich: alle(/<li data-item="([^"]+)"/g, aeh).join(','),
    zwilling: alle(/data-oeffne="([^"]+)"/g, zw).sort().join(','),
    setPreis: setp ? text(setp[1]) : '',
    werkzeuge: (html.match(/data-werkzeug="/g) ?? []).length,
    fahrzeug: html.includes('data-fahrzeug'),
    spanne: spanne ? spanne[1].trim() : '',
    systeme: alle(/<li\b[^>]*\sdata-sys="([^"]*)"/g, liste).sort().join('|'),
    melden: html.includes('data-melden'),
  };
}

// [11] Ziele, die fuer Menschen nicht mehr da sind: Datenblaetter und
// Verzeichnisse. Die Kennung im Meldeformular (?wert=/items/<id>.html) ist
// ein Wert, kein Ziel: gelesen wird nur der Pfad vor dem „?“.
const BLATT_ZIEL = [
  [/^\/(?:de\/)?items\/category\//, 'Kategorieliste'],
  [/^\/(?:de\/)?items\/[^/]+\.html$/, 'Item-Datenblatt'],
  [/^\/(?:de\/)?crafting\.html$/, 'Blueprint-Verzeichnis'],
  [/^\/(?:de\/)?crafting\//, 'Bauplan-Blatt oder Blueprint-Kategorie'],
  [/^\/(?:de\/)?schiffe\/[^/]+\.html$/, 'Schiffsdatenblatt'],
  [/^\/(?:de\/)?missionen\/[^/]+\.html$/, 'Missionsblatt'],
  [/^\/(?:de\/)?armor-sets\.html$/, 'Set-Seite'],
];
function blattZiele(html) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)) {
    const pfad = m[1].replace(/&amp;/g, '&').split(/[?#]/)[0].replace(/^https?:\/\/[^/]+/, '');
    for (const [re, name] of BLATT_ZIEL) if (re.test(pfad)) { out.push(`${name} ${m[1]}`); break; }
  }
  return out;
}

/* ---------- Lauf ---------- */
const esbuild = await import('esbuild');
const buendel = new Map();
const SEITEN = { en: 'items.html', de: 'de/items.html' };
const fehler = [];
const zahl = {};
const t0 = Date.now();
const de = (n) => n.toLocaleString('de-DE');

for (const [lang, seite] of Object.entries(SEITEN)) {
  if (!existsSync(join(DIST, seite))) { fehler.push(`${seite} fehlt — die Items-Werkbank ist nicht im Bau`); continue; }
  let naht = false, p;
  try {
    p = await oeffneSeite({
      dist: DIST, seite, esbuild, buendel, sprache: lang === 'de' ? 'de-DE' : 'en-US',
      umbau: (name, code) => {
        if (name !== SKRIPT) return code;
        naht = true;
        return CODE;
      },
    });
  } catch (err) { fehler.push(`${lang}: ${seite} laesst sich nicht oeffnen — ${err.message}`); continue; }
  if (!naht) { fehler.push(`${lang}: ${seite} laedt ${SKRIPT} nicht — Skript umbenannt? Dann SKRIPT hier nachziehen.`); p.schliesse(); continue; }
  await p.settle(3000);
  const n = p.window.__pruefnaht;
  if (!n || !n.bereit()) { fehler.push(`${lang}: der Item-Katalog ist nicht geladen — dbUrl in window.__WZI pruefen`); p.schliesse(); continue; }
  await n.laden();
  await p.settle(500);
  if (!n.wege()) fehler.push(`${lang}: /items-wege.json ist nicht geladen — wegeUrl in window.__WZI, Datei in dist/ und Laenge gegen den Katalog pruefen`);
  n.leere();
  const z = (zahl[lang] = { items: 0, blaetter: 0, wege: 0, missionen: 0, serie: 0, aehnlich: 0, zwilling: 0, setPreis: 0, werkzeuge: 0, fahrzeug: 0, spanne: 0, systemZeilen: 0, sets: 0 });
  const blattOrdner = join(DIST, lang === 'de' ? 'de/items' : 'items');
  const melde = (it, was) => fehler.push(`${lang}: ${it.id} — ${was}`);
  for (const it of n.items()) {
    let html;
    try { html = n.blatt(it); } catch (err) { melde(it, `Blatt der Werkbank bricht ab: ${err.message}`); continue; }
    p.ernte();
    z.items++;
    for (const ziel of blattZiele(html)) melde(it, `[11] Blatt der Werkbank fuehrt aufs ${ziel}`);
    const w = werkbankAntworten(html);
    if (!w.melden) melde(it, '[12] kein „Falschen Wert melden“ im Blatt der Werkbank');
    const datei = join(blattOrdner, `${it.id}.html`);
    if (!existsSync(datei)) continue;
    z.blaetter++;
    const b = blattAntworten(readFileSync(datei, 'utf8'));
    if (b.wege) z.wege++;
    if (b.wege !== w.wege) melde(it, `[1] Wege: Blatt [${b.wege}], Werkbank [${w.wege}]`);
    if (b.missionen) z.missionen++;
    if (b.missionen !== w.missionen) melde(it, `[2] Missionen zum Bauplan: Blatt ${b.missionen}, Werkbank ${w.missionen}`);
    if (b.serie) z.serie++;
    if (b.serie !== w.serie || w.serie !== w.serieChips) melde(it, `[3] ab Werk: Blatt ${b.serie} Schiffe, Werkbank ${w.serie} (${w.serieChips} verlinkt)`);
    if (b.aehnlich) z.aehnlich++;
    if (b.aehnlich !== w.aehnlich) melde(it, `[4] aehnliche Items: Blatt [${b.aehnlich}], Werkbank [${w.aehnlich}]`);
    if (b.zwilling) z.zwilling++;
    if (b.zwilling !== w.zwilling) melde(it, `[5] gleichnamige Items: Blatt [${b.zwilling}], Werkbank [${w.zwilling}]`);
    if (b.setPreis) z.setPreis++;
    if (b.setPreis !== w.setPreis) melde(it, `[6] Set-Preis: Blatt „${b.setPreis}“, Werkbank „${w.setPreis}“`);
    if (b.werkzeuge) z.werkzeuge++;
    if (b.werkzeuge !== w.werkzeuge) melde(it, `[7] Werkzeuge: Blatt ${b.werkzeuge}, Werkbank ${w.werkzeuge}`);
    if (b.fahrzeug) z.fahrzeug++;
    if (b.fahrzeug !== w.fahrzeug) melde(it, `[8] Fahrzeug: Blatt ${b.fahrzeug ? 'zeigt aufs Schiff' : 'ohne'}, Werkbank ${w.fahrzeug ? 'zeigt in die Schiffsliste' : 'ohne'}`);
    if (b.spanne) z.spanne++;
    if (b.spanne !== w.spanne) melde(it, `[9] Preisspanne: Blatt „${b.spanne}“, Werkbank „${w.spanne}“`);
    z.systemZeilen += b.systeme ? b.systeme.split('|').filter((s) => s !== 'ohne').length : 0;
    if (b.systeme !== w.systeme) melde(it, `[10] Systeme der Bezugszeilen: Blatt [${b.systeme}], Werkbank [${w.systeme}]`);
  }
  for (const st of n.sets()) {
    let html;
    try { html = n.satz(st); } catch (err) { fehler.push(`${lang}: Set ${st.id} — Blatt bricht ab: ${err.message}`); continue; }
    z.sets++;
    for (const ziel of blattZiele(html)) fehler.push(`${lang}: Set ${st.id} — [11] Blatt der Werkbank fuehrt aufs ${ziel}`);
  }
  for (const f of p.fehler.splice(0)) fehler.push(`${lang}: ${seite} — ${f}`);
  p.schliesse();
}

/* ---------- Selbstauskunft ---------- */
console.log(`verify:werkbank-items — Bau ${DIST}, Skript ${JS === join(DIST, 'assets', 'items-werkbank.js') ? 'ausgeliefert' : JS} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
for (const [lang, z] of Object.entries(zahl)) {
  console.log(`${lang}: ${de(z.items)} Items, ${de(z.blaetter)} mit Datenblatt verglichen · Wege ${de(z.wege)} · Missionen ${de(z.missionen)} · ab Werk ${de(z.serie)} · aehnlich ${de(z.aehnlich)} · gleichnamig ${de(z.zwilling)} · Set-Preis ${de(z.setPreis)} · Werkzeuge ${de(z.werkzeuge)} · Fahrzeug ${de(z.fahrzeug)} · Spanne ${de(z.spanne)} · Systemzeilen ${de(z.systemZeilen)} · ${z.sets} Sets`);
  for (const [k, min] of Object.entries(KLINKE)) {
    if ((z[k] ?? 0) < min) fehler.push(`${lang}: nur ${de(z[k] ?? 0)} bei „${k}“ (Klinke ${de(min)}) — vergleicht das Tor noch, oder fehlt der Werkbank ein Abschnitt?`);
  }
}
if (!Object.keys(zahl).length) fehler.push('keine Sprache geprueft');

if (fehler.length) {
  const zeige = ALLE ? fehler : fehler.slice(0, 12);
  for (const f of zeige) console.error(`FEHLER ${f}`);
  if (!ALLE && fehler.length > zeige.length) console.error(`… und ${fehler.length - zeige.length} weitere (--alle zeigt jeden)`);
  console.error(`\nverify:werkbank-items: ${fehler.length} FEHLER — die Items-Werkbank beantwortet nicht, was das Datenblatt beantwortet, oder fuehrt Menschen aufs Blatt.`);
  process.exit(1);
}
console.log('\nverify:werkbank-items gruen — die Items-Werkbank beantwortet jede Frage des Item-Datenblatts selbst und fuehrt nirgends auf ein Datenblatt oder Verzeichnis.');
