// Baut index.html aus ../inhalt-de.json. Alle Fakten kommen aus der JSON; hier steht nur die Erzählung.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const hier = dirname(fileURLToPath(import.meta.url));
const j = JSON.parse(readFileSync(join(hier, '../inhalt-de.json'), 'utf8'));

const SITE = 'https://verse-base.com/de';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const href = (h) => (h.startsWith('http') || h.startsWith('#') ? h : SITE + h);
const a = (l, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(href(l.h))}"${l.h.startsWith('http') ? ' rel="noopener"' : ''}>${esc(l.t)}</a>`;
const inl = (parts) => parts.map((p) => (typeof p === 'string' ? esc(p) : p.b ? `<b>${esc(p.b)}</b>` : a(p))).join('');
const zahl = (n) => n.toLocaleString('de-DE');
const datum = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' });

const bildAlt = new Map(j.bilder.map((b) => [b.key, b.alt]));
function bild(key, art, alt, sizes, cls = '') {
  const altText = alt ?? bildAlt.get(key);
  if (!altText) throw new Error(`kein alt für ${key}`);
  if (art === 'render') {
    const p = `/assets/patch-4-10-3/render/${key}`;
    return `<img class="${cls}" src="${p}.webp" srcset="${p}-640.webp 640w, ${p}.webp 1200w" sizes="${sizes}" alt="${esc(altText)}" loading="lazy" decoding="async">`;
  }
  const p = `/assets/patch-4-10-3/rsi/${key}`;
  return `<img class="${cls}" src="${p}-1200.webp" srcset="${p}-640.webp 640w, ${p}-1200.webp 1200w, ${p}-1920.webp 1920w" sizes="${sizes}" alt="${esc(altText)}" loading="lazy" decoding="async">`;
}

const pfeil = (vor, nach) => `${esc(vor)}<span class="pf" aria-label="auf">→</span>${esc(nach)}`;
const stand = (vor) => `<span class="stand">${vor ? `${esc(vor)} → ` : 'Stand '}${esc(j.version)}</span>`;

// ---------- Daten für die Tafeln ----------
const auftraege = j.auftraege.gruppen.flatMap((g) => g.auftraege);
const galaxy = j.neueSchiffe.find((s) => s.id === 'rsi-galaxy');
const lib = j.neueSchiffe.find((s) => s.id === 'anvl-liberator');
const libHuelle = lib.vergleich.werte.find((w) => w.k === 'Hülle');
const kampf = j.werte.find((w) => w.id === 'kampf');
const striker = kampf.zeilen[0];
const strikerDps = kampf.zeilen[1];
const salvage = j.werte.find((w) => w.id === 'salvage');
const reclaimer = salvage.zeilen[0];
const salvageRest = salvage.zeilen.slice(1).map((z) => z.schiffe[0]);
const bp = j.bestand.zeilen.find((z) => z.was.t === 'Baupläne');
const skarnov = j.ausruestung.karten.find((k) => k.id === 'skarnov');
const minPreis = (s) => Math.min(...s.angebote.map((o) => o.preis));
const ortVon = (s) => s.angebote.find((o) => o.preis === minPreis(s)).ort;

const kurz = (n) => { if (!j.kopf.satz.includes(n)) throw new Error(`Name nicht im Kopfsatz: ${n}`); return esc(n); };
const tafeln = [];
const tafel = ({ id, img, kicker, h, num, numLbl, text, link, st, cap, extraCls = '' }) => `
<section class="tafel ${extraCls}" id="${id}" aria-labelledby="${id}-h">
  <figure class="tafel__bild">${img}${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>
  <div class="tafel__text">
    <p class="kicker">${kicker}${st}</p>
    <h2 id="${id}-h">${h}</h2>
    <p class="num">${num}<span class="num__lbl">${numLbl}</span></p>
    <p class="satz">${text}</p>
    <p class="weiter">${link}</p>
  </div>
</section>`;

tafeln.push(tafel({
  id: 'auftraege',
  img: bild('vncl-stinger', 'rsi', null, '(min-width: 900px) 50vw, 100vw'),
  kicker: 'Vanduul Incursion · ',
  st: stand(),
  h: esc(j.auftraege.titel),
  num: String(auftraege.length),
  numLbl: 'Aufträge von InterSec',
  text: `Vanduul-Clans bedrohen die Handelsrouten in Nyx. Die meisten Aufträge lassen sich teilen.`,
  link: `<a class="pfeil" href="#akte-auftraege">Alle ${auftraege.length} Aufträge</a>`,
  cap: 'Vanduul Stinger',
}));

tafeln.push(tafel({
  id: 'kampf',
  img: bild('vncl-glaive', 'rsi', null, '(min-width: 900px) 50vw, 100vw'),
  kicker: 'Kampf · ',
  st: stand(striker.vorherStand),
  h: `Der ${esc(j.kacheln.find((k) => k.ziel === 'kampf').k)} trifft härter`,
  num: pfeil(striker.vorher.v[0], striker.nachher.v[0]),
  numLbl: 'Energieschaden je Schuss',
  text: `Das sind ${esc(strikerDps.nachher.v[0])} statt ${esc(strikerDps.vorher.v[0])} DPS. Torpedos der Größe 5 und 7 machen sich erst ab 700 m scharf.`,
  link: a({ t: 'Zum Mauler „STRIKER“', h: striker.was[0].h }, 'pfeil'),
  cap: 'Vanduul Glaive',
}));

tafeln.push(tafel({
  id: 'galaxy',
  img: bild('rsi-galaxy-flug', 'rsi', null, '(min-width: 900px) 50vw, 100vw'),
  kicker: `Neues Schiff · `,
  st: stand(),
  h: kurz('RSI Galaxy'),
  num: '720<small>SCU</small>',
  numLbl: 'Laderaum mit Frachtmodul, sonst 64',
  text: `Das Mittelmodul bestimmt die Rolle. Mit dem ${a(galaxy.module[1])} wird die Galaxy zum Feldlazarett mit Medbetten der Stufen 1 bis 3.`,
  link: a({ t: 'Zur Galaxy', h: galaxy.link.h }, 'pfeil'),
}));

tafeln.push(tafel({
  id: 'liberator',
  img: bild('anvl-liberator', 'rsi', null, '(min-width: 900px) 50vw, 100vw'),
  kicker: `Neues Schiff · `,
  st: stand(),
  h: kurz('Anvil Liberator'),
  num: `${esc(libHuelle.dieses.replace(' HP', ''))}<small>HP</small>`,
  numLbl: `Hülle, die ${a(lib.vergleich.schiff)} hat ${esc(libHuelle.jenes)}`,
  text: `Fahrzeuge rollen über die Heckrampe, Schiffe landen im Hangar oder auf dem Rumpf. An Bord wird repariert, aufmunitioniert und betankt.`,
  link: a({ t: 'Zur Liberator', h: lib.link.h }, 'pfeil'),
}));

// aUEC: eine Tafel, acht Bilder zum Wischen
const slides = j.auec.schiffe.map((s) => `
    <li class="slide">
      <a href="${esc(href(s.link.h))}">
        ${bild(s.id, 'rsi', `${s.hersteller} ${s.name}`, '(min-width: 900px) 30vw, 86vw')}
        <span class="slide__t"><b>${esc(s.name)}</b><span>ab ${zahl(minPreis(s))} aUEC · ${esc(ortVon(s).split(' · ')[0].split(',')[0])}</span></span>
      </a>
    </li>`).join('');
const preiseVom = datum(j.auec.schiffe[0].preiseVom);
tafeln.push(`
<section class="tafel tafel--auec" id="auec" aria-labelledby="auec-h">
  <div class="auec__kopf">
    <p class="kicker">Für aUEC · ${stand()}</p>
    <h2 id="auec-h">${esc(j.auec.titel)}</h2>
    <p class="num">${j.auec.schiffe.length}<span class="num__lbl">Schiffe, die schon flogen, zum ersten Mal im Spiel kaufbar</span></p>
  </div>
  <ol class="schiene" aria-label="Die ${j.auec.schiffe.length} Schiffe, zum Wischen">${slides}
  </ol>
  <p class="auec__fuss"><span>Wischen für alle ${j.auec.schiffe.length}</span><span>Günstigster Preis, Stand ${preiseVom} · <a href="#akte-auec">alle Händler</a></span></p>
</section>`);

tafeln.push(tafel({
  id: 'salvage',
  img: bild('aegs-reclaimer', 'render', 'Aegis Reclaimer, farbiges Modell schräg von vorn', '(min-width: 900px) 50vw, 100vw', 'render'),
  kicker: 'Salvage · ',
  st: stand(reclaimer.vorherStand),
  h: 'Mehr Puffer für Salvage',
  num: `${pfeil(reclaimer.vorher.v[0], reclaimer.nachher.v[0])}<small>SCU</small>`,
  numLbl: `Puffer der ${a(reclaimer.schiffe[0])}`,
  text: `Auch ${salvageRest.slice(0, -1).map((s) => a(s)).join(', ')} und ${a(salvageRest.at(-1))} nehmen mehr auf. ${esc(salvage.notiz[0])}`,
  link: `<a class="pfeil" href="#akte-werte">Alle geänderten Werte</a>`,
}));

tafeln.push(tafel({
  id: 'bauplaene',
  img: bild('iae-2956-halle', 'rsi', null, '(min-width: 900px) 50vw, 100vw'),
  kicker: 'IAE 2956 · Baupläne · ',
  st: stand(bp.vorherStand),
  h: 'Expo-Andenken und neue Baupläne',
  num: `+${j.ausruestung.bauplaeneNeu}`,
  numLbl: `Baupläne, jetzt ${zahl(bp.nachher)}`,
  text: `Neu sind das Energiegewehr ${a(skarnov.liste[0].v[0])} in fünf Ausführungen und die Tarnung ${a({ t: '„Raider Camo“', h: '/crafting/skarnov-raider-camo-rifle.html' })}. Zur Expo gibt es Andenken und Lackierungen „2956 Best In Show“.`,
  link: a({ t: 'Alle Baupläne', h: bp.was.h }, 'pfeil'),
}));

// ---------- Dossier ----------
const liste = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const dAuftraege = j.auftraege.gruppen.map((g) => `
      <h4>${esc(g.titel)} <span>${esc(g.typ)}</span></h4>
      <p>${esc(g.text)}</p>
      ${liste(g.auftraege.map((m) => `${a(m.link)} <span class="dim">${esc(m.rang)}${m.bauplaene ? ` · ${m.bauplaene} Baupläne` : ''}${m.belohnung ? ` · ${a(m.belohnung)}` : ''}</span>`))}`).join('');

const werteZeile = (z) => {
  const wer = [...z.schiffe.map((s) => a(s)), ...z.was.map((w) => (typeof w === 'string' ? esc(w) : a(w)))].join(', ');
  const v = z.vorher ? inl(z.vorher.v) : z.schon ? 'schon' : '';
  return `<tr><th scope="row">${wer}</th><td>${v}</td><td>${inl(z.nachher.v)}</td></tr>`;
};
const dWerte = j.werte.map((w) => `
      <h4>${esc(w.titel)} <span>${esc(w.tag)} · 4.10.2 → 4.10.3</span></h4>
      <table><thead><tr><th scope="col"></th><th scope="col">4.10.2</th><th scope="col">4.10.3</th></tr></thead><tbody>${w.zeilen.map(werteZeile).join('')}</tbody></table>
      <p>${inl(w.notiz)}</p>`).join('');

const schiffDossier = (s) => `
      <h4>${a(s.link)} <span>${esc(s.hersteller)} · Stand ${esc(s.stand)}</span></h4>
      <p>${esc(s.text)}</p>
      <table><thead><tr><th scope="col"></th><th scope="col">${esc(s.name)}</th><th scope="col">${a(s.vergleich.schiff)}</th></tr></thead><tbody>${s.vergleich.werte.map((w) => `<tr><th scope="row">${esc(w.k)}</th><td>${esc(w.dieses)}</td><td>${esc(w.jenes)}</td></tr>`).join('')}</tbody></table>
      ${liste(s.werte.map((w) => `<span class="dim">${esc(w.k)}</span> ${inl(w.v)}`))}
      ${s.module.length ? `<p>Module: ${s.module.map((m) => a(m)).join(', ')}</p>` : ''}`;

const dAuec = liste(j.auec.schiffe.map((s) => `${a(s.link)} <span class="dim">${esc(s.hersteller)}</span><br>${s.angebote.map((o) => `${zahl(o.preis)} aUEC bei ${esc(o.haendler)}, ${esc(o.ort)}`).join('<br>')}`));

const dAusr = j.ausruestung.karten.map((k) => `
      <h4 id="${k.id === 'namen' ? 'namen' : 'akte-' + k.id}">${esc(k.titel)} <span>${esc(k.tag)} · Stand ${esc(k.stand)}</span></h4>
      <p>${inl(k.text)}</p>
      ${k.liste.length ? liste(k.liste.map((l) => `${l.k ? `<span class="dim">${esc(l.k)}</span> ` : ''}${l.v.map((v) => a(v)).join(', ')}`)) : ''}`).join('');

const dBestand = `
      <table><thead><tr><th scope="col"></th><th scope="col">4.10.2</th><th scope="col">4.10.3</th></tr></thead><tbody>${j.bestand.zeilen.map((z) => `<tr><th scope="row">${a(z.was)}</th><td>${zahl(z.vorher)}</td><td>${zahl(z.nachher)}</td></tr>`).join('')}</tbody></table>
      <p>${inl(j.bestand.notiz)}</p>`;

const dossier = `
<section class="akte" id="akte" aria-labelledby="akte-h">
  <details>
    <summary><span id="akte-h" class="akte__t">${esc(j.dossier.titel)}</span><span class="akte__s">${esc(j.dossier.text)}</span></summary>
    <div class="akte__in">
      <h3 id="akte-auftraege">Aufträge <span>Stand ${esc(j.version)}</span></h3>
      <p>${inl(j.auftraege.lead)}</p>${dAuftraege}
      <h3 id="akte-schiffe">Neue Schiffe</h3>${j.neueSchiffe.map(schiffDossier).join('')}
      <h3 id="akte-auec">Für aUEC <span>Preise vom ${preiseVom}</span></h3>${dAuec}
      <h3 id="akte-werte">Geänderte Werte</h3>${dWerte}
      <h3 id="akte-ausruestung">${esc(j.ausruestung.titel)}</h3>${dAusr}
      <h3 id="akte-bestand">Bestand <span>4.10.2 → 4.10.3</span></h3>${dBestand}
      <p class="notes">${a(j.notes)}</p>
    </div>
  </details>
</section>`;

const sprung = [
  ['#auftraege', 'Vanduul-Aufträge'],
  ['#galaxy', 'Galaxy'],
  ['#liberator', 'Liberator'],
  ['#auec', '8 für aUEC'],
  ['#bauplaene', '+17 Baupläne'],
];

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Alpha ${esc(j.version)} · ${esc(j.codename)} · VerseBase</title>
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/theme.css">
<link rel="stylesheet" href="/entwuerfe/runde3/v1/stil.css">
<link rel="preload" as="image" href="/assets/patch-4-10-3/rsi/vanduul-angriff-1200.webp" imagesrcset="/assets/patch-4-10-3/rsi/vanduul-angriff-640.webp 640w, /assets/patch-4-10-3/rsi/vanduul-angriff-1200.webp 1200w, /assets/patch-4-10-3/rsi/vanduul-angriff-1920.webp 1920w" imagesizes="100vw">
</head>
<body>
<header class="leiste">
  <a class="marke" href="${SITE}/" aria-label="VerseBase Startseite"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2 21 7v10l-9 5-9-5V7z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></svg></a>
  <nav class="krume" aria-label="Pfad"><a href="${SITE}/archiv.html">Archiv</a><span aria-hidden="true">/</span><span>Alpha ${esc(j.version)}</span></nav>
</header>
<main>
<section class="kopf" aria-labelledby="kopf-h">
  <figure class="kopf__bild">${bild('vanduul-angriff', 'rsi', null, '100vw').replace(' loading="lazy"', ' fetchpriority="high"')}</figure>
  <div class="kopf__text">
    <p class="eyebrow">${esc(j.kopf.eyebrow)}</p>
    <h1 id="kopf-h">${esc(j.kopf.titel)}</h1>
    <p class="codename">${esc(j.kopf.codename[0])}<span>${esc(j.kopf.codename[1])}</span></p>
    <p class="tagline">${esc(j.kopf.satz)}</p>
    <ul class="chips">${sprung.map(([h, t]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('')}</ul>
  </div>
</section>
${tafeln.join('\n')}
${dossier}
</main>
<footer class="fuss">
  <p class="fuss__nav"><a class="pfeil zurueck" href="${esc(href(j.vorgaenger.h))}">${esc(j.vorgaenger.titel)}</a>${a(j.notes)}</p>
  <p class="disclaimer">Inoffizielles Fan-Projekt. Star Citizen® © Cloud Imperium Rights LLC &amp; Ltd., keine Verbindung zu CIG. Bilder aus offiziellen Quellen © Cloud Imperium Games, Fan-Content-Nutzung.</p>
</footer>
<script>/* Sprung ins Dossier klappt es auf; ohne JS bleibt der Inhalt per Aufklappen erreichbar. */
function oeffne(){const z=location.hash&&document.querySelector(location.hash);const d=z&&z.closest('details');if(d&&!d.open){d.open=true;z.scrollIntoView();}}addEventListener('hashchange',oeffne);oeffne();</script>
</body>
</html>
`;
writeFileSync(join(hier, 'index.html'), html);
console.log(`index.html: ${html.length} Zeichen, ${(html.match(/<img /g) || []).length} Bilder`);
