// ereignisse.js — zehn Messereignisse mit festen Werten (Umami).
//
// Laedt auf jeder Seite, die auch den Zaehler laedt (src/layouts/Layout.astro,
// direkt nach ihm), und schickt ueber umami.track — also durch denselben
// Haken vbZaehlen wie die Seitenaufrufe: mit dem Widerspruchs-Cookie
// vb_noanalytics=1 geht nichts raus, auf anderen Hosts als verse-base.com
// zaehlt Umami ohnehin nicht.
//
// Was rausgeht, steht in LISTE: Ereignisname und Felder, jedes Feld nur mit
// einem der genannten Werte. Alles andere — unbekannter Name, fehlendes oder
// fremdes Feld, ein Wert ausserhalb der Liste — verwirft das Ereignis ganz.
// Ein Ereignis traegt ausserdem keine Seitenadresse eines einzelnen Items,
// Blueprints, Schiffs oder einer Mission (nur den Bereich, z. B. /items/),
// keinen Seitentitel und keine Herkunft.
//
// SOLL der Liste: scripts/lib/ereignisse.mjs (Freigabe Krisz 06.11.2026).
// verify:zaehler [7] fuehrt diese Datei aus und vergleicht.
//
// Ausloeser:
//  - Klick auf einen Link im Seiteninhalt (nicht Kopf, Navigation, Fuss) einer
//    Detailseite zu einer anderen Detailseite (weiter-detail) oder in ein
//    Werkzeug (weiter-werkzeug); Klick auf Anmelden/Registrieren von jeder
//    gezaehlten Seite (anmeldung-einstieg); Klick auf „Falschen Wert melden“
//    (Link mit data-ev-melden im Datenstand) einer Detailseite (wert-melden,
//    nur mit der Seitenart, ohne Pfad).
//  - Klick auf einen Link zu einer anderen Website, auch in Kopf und Fuss
//    (extern): nur die Art des Ziels aus EXTERN_HOSTS (unbekannte Hosts als
//    „sonst“), nie Adresse oder Pfad. Ein Element mit data-ev-extern="<ziel>"
//    nennt sein Ziel selbst (der Stripe-Knopf der Unterstuetzen-Seite: ein
//    <button>, seine Adresse gibt es erst nach dem Klick). Umami schickt mit
//    keepalive, die Zaehlung ueberlebt also das Verlassen der Seite.
//  - Erste Bedienung eines Elements mit data-ev-filter="<name>" (filter) bzw.
//    in einem Bereich mit data-ev-rechnung (rechnung) je Seitenaufruf, Klick
//    auf data-ev-kopieren (kopieren-teilen). Nur echte Bedienung
//    (isTrusted): Filter, die eine Seite aus ?Parametern selbst setzt, zaehlen
//    nicht.
//  - window.vbEreignis(name, felder) fuer die Suche (assets/search-overlay.js).
(function () {
  if (window.vbEreignis) return;
  var SEITE = 'item blueprint schiff mission werkzeug sonst';
  var DETAIL = 'item blueprint schiff mission';
  var WZ = 'finder missionen crafting fracturing refinery mining sprung wikelo schiffe archiv evolution';
  var LISTE = {
    'suche-offen': { seite: SEITE },
    'suche-treffer': { art: 'werkzeug schiff mission patch thema feature event item bauplan', platz: '1-3 4-10 11+' },
    'weiter-werkzeug': { seite: DETAIL, werkzeug: WZ },
    'weiter-detail': { seite: DETAIL, ziel: DETAIL },
    filter: {
      werkzeug: WZ,
      filter:
        'suche sortierung kategorie groesse verfuegbarkeit gewicht seltenheit ansicht typ auftraggeber fraktion gilde ort bauplan legal ' +
        'hersteller karriere rolle signatur merkmal komponente komponentengroesse ressource qualitaet system brechbar',
    },
    rechnung: { werkzeug: WZ },
    'kopieren-teilen': { werkzeug: WZ },
    'anmeldung-einstieg': { von: DETAIL + ' sonst ' + WZ, ziel: 'anmelden registrieren' },
    'wert-melden': { seite: DETAIL },
    extern: { seite: SEITE, ziel: 'discord spende wiki uex rsi fleetyards youtube sonst' },
  };
  var EINMAL = { 'suche-offen': 1, filter: 1, rechnung: 1 };
  var WERKZEUG_SEITEN = {
    '/item-finder.html': 'finder',
    '/missionen.html': 'missionen',
    '/topics/crafting.html': 'crafting',
    '/fracturing.html': 'fracturing',
    '/refinery.html': 'refinery',
    '/topics/mining.html': 'mining',
    '/precision-jump.html': 'sprung',
    '/topics/wikelo-emporium.html': 'wikelo',
    '/schiffe.html': 'schiffe',
    '/archiv.html': 'archiv',
    '/evolution.html': 'evolution',
  };
  var KONTO = { '/account/login.html': 'anmelden', '/account/register.html': 'registrieren' };
  var EXTERN_HOSTS = {
    'discord.gg': 'discord',
    'paypal.me': 'spende',
    'starcitizen.tools': 'wiki',
    'uexcorp.space': 'uex',
    'robertsspaceindustries.com': 'rsi',
    'fleetyards.net': 'fleetyards',
    'youtube.com': 'youtube',
  };
  var DETAIL_PFADE = [
    [/^\/items\/[^/]+\.html$/, 'item'],
    [/^\/crafting\/[^/]+\.html$/, 'blueprint'],
    [/^\/schiffe\/[^/]+\.html$/, 'schiff'],
    [/^\/missionen\/[^/]+\.html$/, 'mission'],
  ];
  function rein(p) {
    return String(p || '').replace(/[?#][\s\S]*$/, '').replace(/^\/de(?=\/)/, '');
  }
  function detailArt(p) {
    for (var i = 0; i < DETAIL_PFADE.length; i++) if (DETAIL_PFADE[i][0].test(p)) return DETAIL_PFADE[i][1];
    return null;
  }
  var pfad = location.pathname;
  var hier = rein(pfad);
  var hierDetail = detailArt(hier);
  var hierWz = WERKZEUG_SEITEN[hier] || null;
  var hierArt = hierDetail || (hierWz ? 'werkzeug' : 'sonst');
  // Detailseiten melden nur ihren Bereich (/items/, /de/crafting/ …).
  var adresse = hierDetail ? pfad.replace(/[^/]*$/, '') : pfad;
  var schon = {};

  function erlaubt(werte, v) {
    return typeof v === 'string' && (' ' + werte + ' ').indexOf(' ' + v + ' ') !== -1;
  }
  function senden(name, felder) {
    var regel = Object.prototype.hasOwnProperty.call(LISTE, name) ? LISTE[name] : null;
    if (!regel) return false;
    felder = felder || {};
    var daten = {};
    for (var k in felder) if (!Object.prototype.hasOwnProperty.call(regel, k)) return false;
    for (var f in regel) {
      if (!erlaubt(regel[f], felder[f])) return false;
      daten[f] = felder[f];
    }
    if (EINMAL[name]) {
      if (schon[name]) return false;
      schon[name] = 1;
    }
    var u = window.umami;
    if (!u || typeof u.track !== 'function') return false;
    try {
      u.track(function (p) {
        p.url = adresse;
        p.title = '';
        p.referrer = '';
        p.name = name;
        p.data = daten;
        return p;
      });
    } catch (e) {}
    return true;
  }

  // Oeffentlich fuer die Suche. Die Felder seite (suche-offen) setzt diese
  // Datei selbst; Aufrufer geben nur, was sie wissen.
  window.vbEreignis = function (name, felder) {
    var f = {};
    for (var k in felder || {}) f[k] = felder[k];
    if (name === 'suche-offen') f.seite = hierArt;
    return senden(name, f);
  };

  var BEDIEN = 'button, a, [role="button"], [role="tab"], [role="option"], [role="radio"], [role="checkbox"], [role="switch"]';
  function bedienung(e) {
    if (!e.isTrusted || !hierWz) return;
    var t = e.target;
    if (!t || !t.closest) return;
    if (e.type === 'click') {
      var b = t.closest(BEDIEN);
      if (!b) return;
      if (b.closest('[data-ev-kopieren]')) {
        senden('kopieren-teilen', { werkzeug: hierWz });
        return;
      }
    }
    var fi = t.closest('[data-ev-filter]');
    if (fi) {
      senden('filter', { werkzeug: hierWz, filter: fi.getAttribute('data-ev-filter') });
      return;
    }
    if (t.closest('[data-ev-rechnung]')) senden('rechnung', { werkzeug: hierWz });
  }

  function klick(e) {
    if (!e.isTrusted) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var mx = t.closest('[data-ev-extern]');
    if (mx) {
      senden('extern', { seite: hierArt, ziel: mx.getAttribute('data-ev-extern') });
      return;
    }
    var a = t.closest('a[href]');
    if (!a) return;
    var u;
    try {
      u = new URL(a.getAttribute('href'), location.href);
    } catch (x) {
      return;
    }
    if (u.origin !== location.origin) {
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
      var h = u.hostname.toLowerCase().replace(/^www\./, '');
      var z = Object.prototype.hasOwnProperty.call(EXTERN_HOSTS, h) ? EXTERN_HOSTS[h] : 'sonst';
      senden('extern', { seite: hierArt, ziel: z });
      return;
    }
    var ziel = rein(u.pathname);
    if (KONTO[ziel]) {
      senden('anmeldung-einstieg', { von: hierWz || hierDetail || 'sonst', ziel: KONTO[ziel] });
      return;
    }
    if (a.hasAttribute('data-ev-melden')) {
      if (hierDetail) senden('wert-melden', { seite: hierDetail });
      return;
    }
    if (!hierDetail || a.closest('header, nav, footer')) return;
    var d = detailArt(ziel);
    if (d) senden('weiter-detail', { seite: hierDetail, ziel: d });
    else if (WERKZEUG_SEITEN[ziel]) senden('weiter-werkzeug', { seite: hierDetail, werkzeug: WERKZEUG_SEITEN[ziel] });
  }

  document.addEventListener('click', klick, true);
  document.addEventListener('click', bedienung, true);
  document.addEventListener('change', bedienung, true);
  document.addEventListener('input', bedienung, true);
  // Fuer verify:zaehler [7]: die Liste, wie diese Datei sie anwendet.
  window.vbEreignis.liste = LISTE;
  window.vbEreignis.werkzeugSeiten = WERKZEUG_SEITEN;
  window.vbEreignis.externHosts = EXTERN_HOSTS;
})();
