// Baut entwuerfe/runde3/v3/index.html aus inhalt-de.json.
// Aufruf aus dem Worktree-Wurzelordner: node entwuerfe/runde3/v3/bauen.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const J = JSON.parse(readFileSync(join(hier, '..', 'inhalt-de.json'), 'utf8'));

const SITE = 'https://verse-base.com/de';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = (h) => (h.startsWith('/') ? SITE + h : h);
const a = (l) => `<a href="${esc(url(l.h))}"${l.h.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(l.t)}</a>`;
const rich = (teile) => teile.map((p) => (typeof p === 'string' ? esc(p) : p.b ? `<b>${esc(p.b)}</b>` : a(p))).join('');
const zahl = (n) => n.toLocaleString('de-DE');
const RSI = (key, w) => `/assets/patch-4-10-3/rsi/${key}-${w}.webp`;
const RENDER = (id) => `/assets/patch-4-10-3/render/${id}-640.webp`;

const k = J.kopf;
const kachel = (ziel) => J.kacheln.find((x) => x.ziel === ziel);
const wert = (id) => J.werte.find((w) => w.id === id);
const [galaxy, liberator] = J.neueSchiffe;
const anzahlAuftraege = J.auftraege.gruppen.reduce((n, g) => n + g.auftraege.length, 0);

// Bild-Kacheln nach dem Muster der Startseite: Bild ist die ganze Fläche,
// Name in der Display-Schrift, eine Zeile, Pfeil. `render` = freigestelltes Modell.
const tools = [
  { size: 'xl', name: 'Vanduul Incursion', sub: `${anzahlAuftraege} Aufträge von InterSec in Nyx`, href: '/missionen.html', img: RSI('vncl-scythe', 1200) },
  { size: 'w', name: galaxy.name, sub: 'Modulschiff · mit Frachtmodul 720 SCU', href: galaxy.link.h, img: RSI('rsi-galaxy-flug', 1200) },
  { size: 'w', name: liberator.name, sub: 'Träger für Schiffe und Fahrzeuge', href: liberator.link.h, img: RSI('anvl-liberator', 1200) },
  { size: 't', name: 'Radar Gr. 3', sub: kachel('radar').s, href: kachel('radar').link.h, img: RENDER('anvl-carrack'), render: true },
  { size: 't', name: 'Salvage', sub: 'Reclaimer 240 → 448 SCU', href: kachel('salvage').link.h, img: RENDER('aegs-reclaimer'), render: true },
  { size: 't', name: 'Mauler „STRIKER“', sub: 'Schaden je Schuss 64 → 250', href: '/items/vanduul-mauler-striker-repeater.html', img: RSI('vncl-glaive', 640) },
  { size: 't', name: 'Vanguard', sub: 'Turm-DPS 400 → 750', href: '/schiffe/aegs-vanguard.html', img: RENDER('aegs-vanguard-hoplite'), render: true },
  { size: 't', name: 'Baupläne +17', sub: 'Skarnov, Raider Camo, Deterrent', href: '/crafting.html', img: RENDER('rsi-polaris'), render: true },
  { size: 't', name: 'IAE 2956', sub: 'Andenken und Lackierungen', href: '/items/2956-best-in-show-bomber-jacket.html', img: RSI('iae-2956-halle', 640) },
];

const toolHtml = tools.map((t) => `
      <a class="tool tool--${t.size}${t.render ? ' tool--render' : ''}" style="--img:url('${t.img}')" href="${esc(url(t.href))}">
        <span class="tool__arrow" aria-hidden="true">→</span>
        <span class="tool__name">${esc(t.name)}</span>
        <span class="tool__sub">${esc(t.sub)}</span>
      </a>`).join('');

// "Ähnliche Schiffe"-Karten: Foto oben, Name, eine Zeile.
const auecHtml = J.auec.schiffe.map((s) => {
  const min = Math.min(...s.angebote.map((o) => o.preis));
  return `
      <a class="sd__sim" href="${esc(url(s.link.h))}">
        <div class="im"><img src="${RSI(s.id, 640)}" alt="${esc(s.name)}" loading="lazy" width="640" height="360"></div>
        <div class="tx"><div class="nm">${esc(s.name)}</div><div class="mt">${s.angebote.length > 1 ? 'ab ' : ''}${zahl(min)} aUEC</div></div>
      </a>`;
}).join('');

// ---------- Dossier (zugeklappt) ----------
const zeileWert = (z, einheit) => {
  const wer = [...z.schiffe.map(a), ...z.was.map((w) => (typeof w === 'string' ? esc(w) : a(w)))].join(', ');
  const seite = (s) => (s ? s.v.map((v) => (typeof v === 'string' ? esc(v) : a(v))).join(', ') : '');
  const vor = seite(z.vorher);
  const pfeil = vor ? `${vor} → ${seite(z.nachher)}` : `${seite(z.nachher)}${z.schon ? ' (schon vorher)' : ''}`;
  return `<li><span class="dk">${wer}:</span> ${pfeil}${einheit ? ' ' + esc(einheit) : ''}${z.delta != null ? ` <span class="dd">+${z.delta} %</span>` : ''}</li>`;
};
// notiz-Einträge sind Satzteile (Text oder Link), die zusammen einen Satz bilden
const dossierWerte = J.werte.map((w) => `
        <h4>${esc(w.titel)} <small>${esc(w.tag)} · 4.10.2 → 4.10.3</small></h4>
        <ul class="dl">${w.zeilen.map((z) => zeileWert(z, w.einheit)).join('')}</ul>
        <p>${rich(w.notiz)}</p>`).join('');

const dossierAuftraege = J.auftraege.gruppen.map((g) => `
        <h4>${esc(g.titel)} <small>${esc(g.typ)}</small></h4>
        <p>${esc(g.text)}</p>
        <ul class="dl">${g.auftraege.map((m) => `<li>${a(m.link)} · <span class="dk">${esc(m.rang)}</span>${m.belohnung ? ` · ${a(m.belohnung)}` : ''}</li>`).join('')}</ul>`).join('');

const dossierSchiff = (s) => `
        <h4>${a(s.link)} <small>${esc(s.hersteller)} · Stand ${esc(s.stand)}</small></h4>
        <p>${esc(s.text)}</p>
        <ul class="dl">${s.werte.map((w) => `<li><span class="dk">${esc(w.k)}</span> ${rich(w.v)}</li>`).join('')}</ul>
        ${s.module.length ? `<p>Module: ${s.module.map(a).join(', ')}</p>` : ''}
        <table><caption>Im Vergleich mit der ${a(s.vergleich.schiff)}</caption><tbody>${s.vergleich.werte.map((w) => `<tr><th>${esc(w.k)}</th><td>${esc(w.dieses)}</td><td>${esc(w.jenes)}</td></tr>`).join('')}</tbody></table>`;

const dossierAusruestung = J.ausruestung.karten.map((c) => `
        <h4 id="${esc(c.id)}">${esc(c.titel)} <small>${esc(c.tag)} · Stand ${esc(c.stand)}</small></h4>
        <p>${rich(c.text)}</p>
        ${c.liste.length ? `<ul class="dl">${c.liste.map((l) => `<li>${l.k ? `<span class="dk">${esc(l.k)}</span> ` : ''}${l.v.map(a).join(', ')}</li>`).join('')}</ul>` : ''}`).join('');

const dossierAuec = `
        <ul class="dl">${J.auec.schiffe.map((s) => `<li><span class="dk">${a(s.link)}:</span> ${s.angebote.map((o) => `${esc(o.haendler)}, ${esc(o.ort)}: ${zahl(o.preis)} aUEC`).join(' · ')}</li>`).join('')}</ul>`;

const b = J.bestand;
const dossierBestand = `
        <ul class="dl">${b.zeilen.map((z) => `<li><span class="dk">${a(z.was)}</span> ${zahl(z.vorher)} → ${zahl(z.nachher)}</li>`).join('')}</ul>
        <p>${rich(b.notiz)}</p>`;

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Alpha 4.10.3 · IAE 2956 &amp; Vanduul Incursion · VerseBase</title>
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/theme.css">
<link rel="stylesheet" href="stil.css">
<link rel="preload" as="image" href="${RSI('vanduul-angriff', 1200)}" media="(max-width:900px)">
</head>
<body>
<a class="skip" href="#main">Zum Inhalt springen</a>
<main id="main">

  <section class="hero">
    <div class="hero__photo" aria-hidden="true"></div>
    <a class="hero__back" href="${SITE}/archiv.html">← Archiv</a>
    <div class="hero__in">
      <div class="eyebrow">${esc(k.eyebrow)}</div>
      <h1 data-text="${esc(k.titel)}">${esc(k.titel)}</h1>
      <div class="codename">${esc(k.codename[0])}<span>${esc(k.codename[1])}</span></div>
      <div class="tagline">${esc(k.satz)}</div>
      <div class="tags">
        <a class="tag hot" href="${SITE}/missionen.html">${anzahlAuftraege} Aufträge in Nyx</a><a class="tag" href="${esc(url(galaxy.link.h))}">Galaxy</a><a class="tag" href="${esc(url(liberator.link.h))}">Liberator</a><a class="tag" href="#auec">${J.auec.schiffe.length} Schiffe für aUEC</a><a class="tag" href="${SITE}/crafting.html">+${J.ausruestung.bauplaeneNeu} Baupläne</a>
      </div>
    </div>
    <div class="scrollcue" aria-hidden="true">Scrollen ↓</div>
  </section>

  <div class="wrap">
    <section class="sec" id="neu">
      <div class="sec__head"><h2>Das ist neu</h2><span class="rule"></span><span class="stand">4.10.2 → 4.10.3</span></div>
      <div class="tools">${toolHtml}
      </div>
    </section>

    <section class="sec" id="auec">
      <div class="sec__head"><h2>${esc(J.auec.titel)}</h2><span class="rule"></span><span class="stand">Stand 4.10.3 · Preise 14.11.2026</span></div>
      <p class="lead">${rich(J.auec.lead)}</p>
      <div class="sd__simgrid">${auecHtml}
      </div>
    </section>

  </div>
  <section class="ende" id="akte">
    <div class="ende__photo" aria-hidden="true"></div>
    <div class="ende__in">
      <p class="tools__more">
        <span>Weiter:</span>
        <a href="${SITE}/missionen.html">Alle Missionen</a>
        <a href="${SITE}/schiffe.html">Schiffs-Index</a>
        <a href="${SITE}/crafting.html">Baupläne</a>
        <a href="${esc(J.notes.h)}" target="_blank" rel="noopener">${esc(J.notes.t)}</a>
      </p>
      <details class="dossier">
        <summary><span class="dossier__t">${esc(J.dossier.titel)}</span><span class="dossier__s">Aufträge, Werte, Preise, Namen · Stand 4.10.3</span></summary>
        <div class="dossier__in">
        <h3>Aufträge von ${esc(J.auftraege.auftraggeber)}</h3>
        <p>${rich(J.auftraege.lead)}</p>${dossierAuftraege}
        <h3>Neue Schiffe</h3>${dossierSchiff(galaxy)}${dossierSchiff(liberator)}
        <h3>Geänderte Werte</h3>${dossierWerte}
        <h3>Händler und Preise für aUEC <small>Stand 4.10.3 · 14.11.2026</small></h3>${dossierAuec}
        <h3>${esc(J.ausruestung.titel)}</h3>${dossierAusruestung}
        <h3>Bestand <small>4.10.2 → 4.10.3</small></h3>${dossierBestand}
        </div>
      </details>

<footer>
  <nav class="pager" aria-label="Patch-Navigation">
    <a href="${esc(url(J.vorgaenger.h))}"><span class="dir">← Älter</span><span class="ttl">${esc(J.vorgaenger.titel)}</span></a>
  </nav>
  <p class="disclaimer">Inoffizielles Fan-Projekt. Star Citizen® © Cloud Imperium Rights LLC &amp; Ltd. Bilder aus offiziellen Quellen © Cloud Imperium Games, Fan-Content-Nutzung.</p>
</footer>
    </div>
  </section>
</main>
</body>
</html>
`;

writeFileSync(join(hier, 'index.html'), html);
console.log('index.html geschrieben,', tools.length, 'Bildkacheln,', J.auec.schiffe.length, 'Schiffskarten');
