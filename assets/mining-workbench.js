/* ============================================================================
   mining-workbench.js — Client-Teil der Mining-Werkbank.

   Zustand: Auswahl, angeheftete Signaturen, Station. Gast -> localStorage;
   Kontobindung ist ein eigener Schuldenposten
   (.planning/todos/pending/signatur-liste-kontogebunden.md).

   ⚠ HIER WIRD NICHTS MEHR GEBROCHEN. Am 12.08.2026 sind Laser, Module,
   Gadget, Felsmasse, das Messgeraet und jede Brechbarkeit hier ausgezogen —
   in assets/fracturing-calc.js auf /fracturing.html. Diese Werkbank
   beantwortet „welches Erz, wo, was ist es wert?", nicht „krieg ich es
   auf?". Die Brech-Formel steht seither an genau EINER Stelle, und das ist
   nicht diese Datei. Wer hier wieder ein Urteil einbaut, macht den Umzug
   rueckgaengig — er war ausdruecklich so gewollt.
   ========================================================================== */
(function () {
  'use strict';

  var node = document.getElementById('wb-data');
  if (!node) return;
  var D;
  try { D = JSON.parse(node.textContent || '{}'); } catch (e) { return; }
  if (!D || !D.minerals || !D.minerals.length) return;

  var T = D.t || {};
  var LS = 'vb-mining-wb';
  var byName = {};
  for (var i = 0; i < D.minerals.length; i++) byName[D.minerals[i].name] = D.minerals[i];

  /* Fundort-Index (Phase 12): Ortsname -> Liste der Erz-Eintraege an diesem
     Ort. Ausschliesslich aus D.minerals[].locs[] abgeleitet -- DB.bodies wird
     NICHT an den Client gesendet (gemessene 54.883 Bytes je Sprachseite ohne
     Gegenwert; scripts/verify-mining.mjs Zusicherung 9 garantiert, dass beide
     Datensichten deckungsgleich sind, solange sie gruen ist). Die Feldnamen
     (n, p, s, t, mi, ms, ch, ef, pt) bleiben woertlich wie an l -- eine
     dritte Schreibweise derselben Zahl waere das Gegenteil einer geteilten
     Wahrheit; pctSub()/pctRight()/locSub() arbeiten unveraendert auf diesen
     Objekten. */
  /* Object.create(null), nicht {} (Code-Review 12-REVIEW.md, WR-01): der
     Schluessel ist ein Fundortname aus den Spieldaten. Hiesse ein Fundort je
     "__proto__" oder "constructor", traefe `locIndex[name]` bei einem
     Objekt-Literal das Prototyp-Objekt statt eines eigenen Eintrags — der Ort
     bekaeme keine Liste, und jede spaetere for...in-Schleife der Seite waere
     verunreinigt. Ueber `?fundort=` ist das nicht ausloesbar (nur Lesezugriff
     gegen den bestehenden Schluessel), das Risiko haengt allein an den Daten.
     Ein prototypenloses Objekt macht die Frage gegenstandslos, statt sich auf
     die heutigen 45 Namen zu verlassen. */
  var locIndex = Object.create(null);
  for (var i0 = 0; i0 < D.minerals.length; i0++) {
    var m0 = D.minerals[i0];
    for (var j0 = 0; j0 < m0.locs.length; j0++) {
      var l0 = m0.locs[j0];
      (locIndex[l0.p] || (locIndex[l0.p] = [])).push({
        n: m0.name, p: l0.p, s: l0.s, t: l0.t, mi: l0.mi, ms: l0.ms, ch: l0.ch, ef: l0.ef, pt: l0.pt,
      });
    }
  }

  /* Ein Fundort-Paar ist nur gueltig, wenn BEIDE Haelften noch existieren:
     das Erz im Katalog UND ein Fundort dieses Namens bei genau diesem Erz.
     Format "<Erz>||<Fundort>" — derselbe Trenner wie scripts/verify-mining.mjs
     (Zeile 68) fuer dieselbe Tatsache benutzt. Ein Paar, dessen Erz oder
     Fundort ein Patch entfernt hat, faellt hier still heraus statt die
     Merkliste zu vergiften (Praezedenz: die Signaturenliste macht es mit
     byName genauso). */
  function locPinValid(pair) {
    if (typeof pair !== 'string') return false;
    var idx = pair.indexOf('||');
    if (idx < 0) return false;
    var m = byName[pair.slice(0, idx)];
    if (!m) return false;
    var loc = pair.slice(idx + 2);
    return m.locs.some(function (l) { return l.p === loc; });
  }

  /* Nachschlagefunktion fuer die Werte eines Fundort-Paares in der Merkliste (O-3):
     Chance und Hoechstanteil kommen HIER, zur Anzeigezeit, aus dem ausgelieferten
     Katalog -- NICHT aus dem gespeicherten Paar (T-09-06). Ein manipulierter oder
     veralteter localStorage-/Datenbankeintrag traegt nur den Schluessel, nie eine
     Zahl; ein Datenlauf zieht die Werte automatisch mit statt sie einzufrieren.
     null, wenn das Paar nicht mehr existiert -- faellt bereits beim Laden ueber
     locPinValid() heraus, die Funktion haelt den Fall trotzdem aus. */
  function locOf(ore, loc) {
    var m = byName[ore];
    if (!m) return null;
    for (var i = 0; i < m.locs.length; i++) if (m.locs[i].p === loc) return m.locs[i];
    return null;
  }

  /* 128 -- muss mit der Pruefklausel der Migration
     supabase/migrations/20260815090000_mining_preset_locations.sql
     (check array_length(locations,1) <= 128) uebereinstimmen. Hebt sich einer,
     muss sich der andere mitheben (T-09-07). */
  var LOCPIN_MAX = 128;

  /* Schwelle fuer Spurenerze (D-07): GEMESSEN -- 171 der 521 Paare liegen bei
     hoechstens 10 % Hoechstanteil, 350 ueber 50 %, dazwischen liegt nichts. */
  var TRACE_MAX = 10;

  /* view: 'ore' (Erz-Ansicht, Vorgabe) oder 'loc' (Fundort-Ansicht, Phase 12).
     selLoc: der Ortsname der geoeffneten Fundort-Ansicht, sonst null. Beide
     bleiben ABSICHTLICH aussen vor bei save()/localStorage -- ein Neuladen
     ohne Adressparameter zeigt wieder das Erz, deckungsgleich mit dem
     heutigen ?mineral=-Verhalten (Claudes Ermessen, CONTEXT.md). */
  var S = { sel: D.minerals[0].name, pins: [], locPins: [], ref: 0, q: '', sys: null, view: 'ore', selLoc: null };
  /* Ein alter Speicherstand traegt noch laser/mods/gadget/mass. Die Felder
     werden schlicht nicht mehr gelesen und beim naechsten Schreiben fallen
     sie weg — kein Grund, gespeicherte Auswahl und Signaturen wegzuwerfen.
     Ein Speicherstand von VOR dieser Phase kennt `locPins` gar nicht — das
     ergibt die leere Merkliste, keinen Fehler (D-04). */
  try {
    var saved = JSON.parse(localStorage.getItem(LS) || 'null');
    if (saved && typeof saved === 'object') {
      if (byName[saved.sel]) S.sel = saved.sel;
      if (Array.isArray(saved.pins)) S.pins = saved.pins.filter(function (n) { return !!byName[n]; });
      if (Array.isArray(saved.locPins)) S.locPins = saved.locPins.filter(locPinValid);
      if (typeof saved.ref === 'number' && D.refineries[saved.ref]) S.ref = saved.ref;
    }
  } catch (e) { /* kaputter Speicher ist kein Grund, das Werkzeug zu verweigern */ }
  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify({ sel: S.sel, pins: S.pins, locPins: S.locPins, ref: S.ref }));
    } catch (e) { /* privater Modus */ }
  }

  /* Das Dokument des ausgelagerten Fensters, solange eines offen ist (s.
     Abschnitt AUSLAGERN weiter unten). null heisst: alles steht in der Seite. */
  var popDoc = null;

  /* ⚠ Der Rueckfall auf popDoc ist die BEDINGUNG dafuer, dass die Auslagerung
     ueberhaupt funktioniert: das ausgelagerte Stueck wird per adoptNode in ein
     ANDERES Dokument verschoben, und document.getElementById dieser Seite
     findet es danach nicht mehr. Ohne diese Zeile liefe renderPins() beim
     ersten Anheften in `null.innerHTML` — und zwar erst NACH dem Auslagern,
     also genau dort, wo man es beim Bauen zuletzt sucht. */
  var $ = function (id) {
    return document.getElementById(id) || (popDoc ? popDoc.getElementById(id) : null);
  };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var NF = new Intl.NumberFormat(D.lang === 'de' ? 'de-DE' : 'en-GB');
  function n2(v) { return D.lang === 'de' ? v.toFixed(2).replace('.', ',') : v.toFixed(2); }
/* Prozentwerte mit der Praezision zeigen, die die Daten TATSAECHLICH haben: die
   Fundort-Felder tragen eine Nachkommastelle. n2 haengte stets zwei an ("28,50 %")
   und tat damit genauer, als die Quelle ist. */
function nPct(v) { var s = (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, ''); return D.lang === 'de' ? s.replace('.', ',') : s; }

  /* Chance/Hoechstanteil in EINER Schreibweise (O-3): von renderDetail() (Fundort-
     Zeile in der Mitte) UND renderLocPins() (Wertezeile der Merkliste) genutzt,
     damit beide Ansichten garantiert denselben Text zeigen statt zwei Kopien der
     Formel zu pflegen. */
  /* ⚠ Die Liste ist nach `ef` sortiert (Erwartungswert des Anteils) und der Balken
     zeichnet `ef` — sichtbar waren aber nur `ch` und `ms`. Wo ein Ort mehrere
     Gesteinsarten mischt, laufen die Groessen auseinander, und die angezeigte Zahl
     sprang: Silicon stand mit 69,5 → 36 → 36 → 51,5 % da, obwohl 29 → 28,2 → 28,2
     → 21,5 die richtige Ordnung ist.
     Rechts steht deshalb NUR noch die rangbildende Zahl — sie faellt monoton und
     deckt sich mit dem Balken daneben. Chance und Hoechstanteil ziehen in die
     Unterzeile: der rechte Block ist 142 px breit, alle drei Werte nebeneinander
     brauchten 309 px und liefen sichtbar aus der Spalte. */
  /* byChance (optional, Phase 12, D-06): in der Fundort-Ansicht erklaert die
     Chance die Reihenfolge, nicht der Erwartungswert -- derselbe Grund, aus
     dem die Fundort-Zeile bereits nach ef statt ch rangiert (Kommentar oben
     an dieser Datei). Optionaler nachgestellter Parameter statt einer
     dritten Formatierstelle, das etablierte Muster dieser Datei (siebter
     Parameter pinKey bei row2()). Beide bestehenden, einstelligen
     Aufrufstellen aendern ihr Verhalten dadurch nicht. */
  function pctRight(l, byChance) {
    if (byChance) return l.ch != null ? nPct(l.ch) + ' %' : '—';
    return l.ef != null ? nPct(l.ef) + ' %' : (l.ch != null ? nPct(l.ch) + ' %' : '—');
  }
  /* Die Detailzahlen unter dem Ortsnamen — von der Fundort-Zeile UND der
     Merkliste genutzt, damit beide denselben Text zeigen. byChance (Phase 12):
     die Chance steht in der Fundort-Ansicht bereits rechts (pctRight()) --
     hier faellt der Chance-Teil deshalb weg, nur der Hoechstanteil bleibt. */
  function pctSub(l, byChance) {
    if (byChance) return l.ms != null ? T.upTo + ' ' + nPct(l.ms) + ' %' : '';
    var t = [];
    if (l.ch != null) t.push(nPct(l.ch) + ' % ' + T.chance);
    if (l.ms != null) t.push(T.upTo + ' ' + nPct(l.ms) + ' %');
    return t.join(' · ');
  }
  var TYPE_LBL = {
    planet: 'tPlanet', moon: 'tMoon', belt: 'tBelt', lagrange: 'tLagrange',
    cluster: 'tCluster', cave: 'tCave', event: 'tEvent', special: 'tSpecial',
  };
  /* Ortsart und System gehoeren zur ORTSANGABE, nicht zu den Kennzahlen.
     Ohne die Art standen bei Stileron zwei Asteroidenfelder (Akiro Cluster,
     Pyro Deep Space Asteroids) und fuenf Planeten ununterscheidbar
     untereinander — zwei voellig verschiedene Anflugarten. Das Feld lag die
     ganze Zeit in den Daten und wurde nur nie gezeichnet. */
  function locSub(l) {
    var art = TYPE_LBL[l.t] ? T[TYPE_LBL[l.t]] : null;
    return art ? art + ' · ' + (l.s || '') : (l.s || '');
  }
  /* "Lagrange D" ist fuer sich keine Ortsangabe: angeflogen werden ARC-L3,
     CRU-L5, MIC-L4. Die Punkte stehen deshalb direkt hinter dem Namen. */
  function locName(l) {
    return l.pt && l.pt.length ? l.p + ' · ' + l.pt.join(', ') : l.p;
  }

  /* Die Daten kennen VIER Abbaumethoden (ship 26, roc 4, fps 4, hand 3). Die
     zweite Fassung warf alles ausser `ship` in denselben Topf „Hand" — die
     vier ROC-Erze standen damit falsch da. `fps` und `hand` bleiben bewusst
     zusammengefasst: beides ist Handabbau, und eine belastbare Unterscheidung
     geben die Daten nicht her. */
  function methodLabel(meth) {
    if (meth === 'ship') return T.ship;
    if (meth === 'roc') return T.roc;
    return T.hand;
  }

  /* Ertragsprofile sind nach Materialnamen MIT Suffix gekeyt
     ("Taranite (Raw)"), der Katalog fuehrt den sauberen Namen.
     ⚠ Zwei Erze tragen das Wort aber als PRAEFIX: "Raw Ice" und "Raw Silicon".
     Solange nur Suffixe geprueft wurden, fand der Join sie nie — Ice (19 Fundorte)
     und Silicon (23) standen ohne "Beste Stationen" da, obwohl ihr Bonus in den
     Profilen steht (+10 bzw. +8). Gemessen am 15.08.: 17 von 37 Erzen ohne
     Ertragsspalte, davon 11 zu Recht (Edelsteine werden nicht raffiniert). */
  function yieldFor(profId, name) {
    var prof = D.profiles[profId];
    if (!prof) return null;
    var keys = [name, name + ' (Ore)', name + ' (Raw)', name + ' (Pure)', 'Raw ' + name];
    for (var i = 0; i < keys.length; i++) if (typeof prof[keys[i]] === 'number') return prof[keys[i]];
    return null;
  }
  /* Alle 20 Stationen fuer DIESES Erz durchrechnen und sortieren — die
     Antwort auf „wo bringe ich das hin?", die es vorher nirgends gab. */
  function rankRefineries(name) {
    var out = [];
    for (var i = 0; i < D.refineries.length; i++) {
      var y = yieldFor(D.refineries[i].p, name);
      if (y === null) continue;
      out.push({ i: i, n: D.refineries[i].n, s: D.refineries[i].s, y: y });
    }
    out.sort(function (a, b) { return b.y - a.y; });
    return out;
  }

  var MAXCLUSTER = { common: 6, uncommon: 5, rare: 4, epic: 3, legendary: 2 };
  var listEl = $('wb-list');

  function renderList() {
    var q = S.q.trim().toLowerCase(), shown = 0;
    var tiles = listEl.querySelectorAll('.wb__tile');
    /* Nachschlageobjekt der Erznamen, die am AKTUELL offenen Fundort
       vorkommen (Phase 12, D-09) -- EINMAL vor der Schleife aus locIndex
       gebaut, statt in der Schleife je Kachel ueber die Eintragsliste zu
       laufen (37 * bis zu 17 Vergleiche waeren vermeidbare Arbeit im
       Zeichenpfad). Gebunden an S.view === 'loc', NICHT nur an S.selLoc:
       ein direkter Kachelklick waehrend die Fundort-Ansicht offen ist setzt
       S.view sofort auf 'ore' zurueck, laesst S.selLoc aber unveraendert
       stehen (derselbe Zweig wie schon vor dieser Phase) -- ohne die
       View-Bedingung bliebe die Markierung nach genau diesem Wechsel
       faelschlich aktiv. Leer, wenn kein Fundort offen ist; die Umschaltung
       unten entfernt is-here dann von ALLEN Kacheln, sonst bliebe die
       Markierung nach dem Zuruecksperingen stehen. Die Filterzeile bleibt
       die alleinige Instanz, die ueber `display` entscheidet, was sichtbar
       ist -- is-here annotiert nur, filtert nichts. */
    var hereIdx = {};
    if (S.view === 'loc' && locIndex[S.selLoc]) {
      var hereEntries = locIndex[S.selLoc];
      for (var hi = 0; hi < hereEntries.length; hi++) hereIdx[hereEntries[hi].n] = true;
    }
    /* Seit der Gruppierung (16.08.2026) zaehlt `shown` NAMEN, nicht Kacheln:
       Carinite steht in zwei Gruppen (Multitool und ROC) und haette den
       Zaehler sonst um eins zu hoch getrieben. */
    var seen = {};
    for (var i = 0; i < tiles.length; i++) {
      var el = tiles[i], m = byName[el.getAttribute('data-min')];
      if (!m) continue;
      var hit = !q || m.name.toLowerCase().indexOf(q) >= 0 ||
        m.locs.some(function (l) { return (l.p || '').toLowerCase().indexOf(q) >= 0; });
      if (hit && S.sys) hit = m.systems.indexOf(S.sys) >= 0;
      el.style.display = hit ? '' : 'none';
      el.classList.toggle('is-sel', m.name === S.sel);
      el.classList.toggle('is-here', !!hereIdx[m.name]);
      /* Der Zustand steckt in der Klasse, nicht im Zeichen: das Symbol bleibt
         stehen, nur die Flaeche faerbt sich (wie bei .wb__chip.is-on). Fuer
         Screenreader traegt ihn aria-pressed — ein Umschalter, kein Link. */
      var pin = el.querySelector('.wb__pin'), on = S.pins.indexOf(m.name) >= 0;
      pin.classList.toggle('is-on', on);
      pin.setAttribute('aria-pressed', String(on));
      pin.setAttribute('aria-label', (on ? T.unpin : T.pin) + ': ' + m.name);
      if (hit && !seen[m.name]) { seen[m.name] = true; shown++; }
    }
    /* Ueberschriften ohne sichtbare Kachel darunter verschwinden mit: ein
       leeres Band „LEGENDÄR 3" ueber einer leeren Flaeche waere eine Zusage,
       die die Filterzeile gerade zurueckgenommen hat. Erst die Baender, dann
       die Gruppen — eine Gruppe ist genau dann leer, wenn all ihre Baender es
       sind. */
    var bands = listEl.querySelectorAll('.wb__band');
    for (var bi = 0; bi < bands.length; bi++) {
      var bt = bands[bi].querySelectorAll('.wb__tile'), bOn = false;
      for (var bj = 0; bj < bt.length; bj++) if (bt[bj].style.display !== 'none') { bOn = true; break; }
      bands[bi].hidden = !bOn;
    }
    var grps = listEl.querySelectorAll('.wb__grp');
    for (var gi = 0; gi < grps.length; gi++) {
      var gb = grps[gi].querySelectorAll('.wb__band'), gOn = false;
      for (var gj = 0; gj < gb.length; gj++) if (!gb[gj].hidden) { gOn = true; break; }
      grps[gi].hidden = !gOn;
    }
    $('wb-count').textContent = shown === D.minerals.length ? String(shown) : shown + '/' + D.minerals.length;
  }

  /* Siebter Parameter pinKey (optional): NUR der Fundort-Aufruf uebergibt
     ihn. Die drei Stations-Aufrufe (#wb-refs) und der Ersatzeintrag der
     gewaehlten Station bleiben sechsstellig — sie bekommen dadurch keinen
     Nadelknopf (D-05, Nebenbedingung 2 der Phase).
     Achter Parameter opts (optional, Phase 12): { cls, attrs, badge }. `cls`
     haengt an die Klassenliste des aeusseren div.wb__row2 an, `attrs` ist
     eine fertig zusammengesetzte, vom Aufrufer bereits durch esc() gefuehrte
     Attribut-Zeichenkette fuers oeffnende div-Tag (z.B. data-loc/data-ore +
     role="button" tabindex="0"), `badge` ist fertiges HTML fuer ein
     Abzeichen. Ist badge gesetzt, wickelt row2() das .p-Element und das
     Abzeichen zusaetzlich in ein span class="wb__nm"; ist opts nicht
     gesetzt, bleibt die erzeugte Zeichenkette Byte fuer Byte wie vor
     Phase 12. Alle bestehenden Aufrufstellen bleiben unangetastet. */
  function row2(main, sub, barPct, right, amber, mark, pinKey, opts) {
    var o = opts || {};
    var pin = '';
    if (pinKey) {
      var pinOn = S.locPins.indexOf(pinKey) >= 0;
      pin = '<button type="button" class="wb__lpin' + (pinOn ? ' is-on' : '') + '" data-locpin="' + esc(pinKey) +
        '" aria-pressed="' + pinOn + '" aria-label="' + esc((pinOn ? T.unpin : T.pin) + ': ' + pinKey.replace('||', ' — ')) +
        '"><svg class="wb__lpin__i" aria-hidden="true" focusable="false"><use href="#wb-i-pin" /></svg></button>';
    }
    var nameHtml = '<span class="p">' + esc(main) + '</span>';
    if (o.badge) nameHtml = '<span class="wb__nm">' + nameHtml + o.badge + '</span>';
    return '<div class="wb__row2' + (mark ? ' is-pick' : '') + (o.cls ? ' ' + o.cls : '') + '"' +
      (o.attrs ? ' ' + o.attrs : '') + '><span>' + nameHtml +
      (sub ? '<span class="s">' + esc(sub) + '</span>' : '') + '</span>' +
      '<span class="r">' + pin + (barPct === null ? '' :
        '<span class="wb__bar' + (amber ? ' amber' : '') + '"><i style="width:' + barPct + '%"></i></span>') +
      '<em>' + esc(right) + '</em></span></div>';
  }

  function renderDetail() {
    var m = byName[S.sel];
    if (!m) return;

    $('wb-name').textContent = m.name;
    $('wb-sig').textContent = m.sig ? NF.format(m.sig) : T.none;

    /* Der grosse Anheft-Knopf am gewaehlten Erz. `data-pin` wird hier gesetzt,
       damit ihn der delegierte Klick-Handler ohne Sonderfall erkennt — er
       behandelt jedes [data-pin] gleich. */
    var big = $('wb-pinsel');
    if (big) {
      var isPinned = S.pins.indexOf(m.name) >= 0;
      big.setAttribute('data-pin', m.name);
      big.classList.toggle('is-on', isPinned);
      big.setAttribute('aria-pressed', String(isPinned));
      $('wb-pinsel-txt').textContent = isPinned ? T.unpin : T.pin;
    }
    $('wb-tags').innerHTML =
      '<span class="wb__tag is-rar">' + esc(D.rar[m.rarity] || (D.lang === 'de' ? 'ohne Stufe' : 'no tier')) + '</span>' +
      '<span class="wb__tag">' + esc(m.kind) + '</span>' +
      /* ALLE Abbauarten, nicht nur die fuehrende: Carinite laesst sich mit
         dem Multitool UND dem ROC abbauen, und im Kopf stand bisher nur
         eine von beiden. */
      (m.methods && m.methods.length ? m.methods : [m.method]).map(function (mm) {
        return '<span class="wb__tag">' + esc(methodLabel(mm)) + '</span>';
      }).join('') +
      (m.refine ? '<span class="wb__tag">' + esc(T.refinable) + '</span>' : '');

    /* ⚠ Hier stand bis 12.08.2026 zusaetzlich „effektiv" — der Widerstand
       NACH dem Res-Mod der Ausruestung. Der Wert gehoert zum Rechnen, nicht
       zum Nachschlagen, und steht jetzt im Fracturing-Rechner. Physik,
       Qualitaetsstufen und „Steine mit diesem Erz" sind seit Phase 9 (D-01)
       ganz aus der Werkbank gestrichen, nicht nur aus dem Astro-Koerper: die
       Kaesten wb-stats/wb-bands/wb-rocks entstanden hier bis Task 3 nur noch
       ueber schuetzende $()===null-Zweige (Deviation Rule 1 im 09-01-Summary,
       Task 1) — jetzt, wo nichts mehr auf sie zeigt, sind auch diese drei
       Zuweisungen weg. */

    /* Fundorte nach ef (Erwartungswert des Anteils) rangieren, nicht nach ch.
       ch allein sagt nur, WIE OFT das Erz vorkommt, nicht wie ergiebig; ms allein
       ist je Erz oft an allen Fundorten gleich. Der Balken zeigt ef relativ zum
       besten Fundort DIESES Erzes — so stimmen Balkenlaenge und Reihenfolge ueberein.
       Vorher lief die Sortierung ueber ch, der Balken aber ueber den Massenanteil:
       die Liste sah dadurch unsortiert aus. */
    var locs = m.locs.slice().sort(function (a, b) { return (b.ef || 0) - (a.ef || 0); });
    var maxEf = 0;
    for (var li = 0; li < locs.length; li++) if ((locs[li].ef || 0) > maxEf) maxEf = locs[li].ef || 0;
    $('wb-loch').textContent = T.locations + (locs.length ? ' · ' + locs.length : '');
    $('wb-locs').innerHTML = locs.length
      ? locs.map(function (l) {
          var bar = maxEf > 0 ? Math.round((l.ef || 0) / maxEf * 100) : 0;
          var sub = pctSub(l), ort = locSub(l);
          /* Achter Parameter opts (Phase 12, D-01): NUR der Fundort-Aufruf
             bekommt data-loc -- dieselbe Abgrenzung, die pinKey hier schon
             traegt. Die drei Stations-Aufrufe unten bleiben ohne opts. */
          return row2(locName(l), sub ? ort + ' · ' + sub : ort, bar, pctRight(l), false, false, m.name + '||' + l.p,
            { attrs: 'data-loc="' + esc(l.p) + '" role="button" tabindex="0"' });
        }).join('')
      : '<p class="wb__empty">' + esc(T.noLocs) + '</p>';

    /* Stations-Rangliste fuer dieses Erz — und die GEWAEHLTE Station darin.
       ⚠ Die Stationswahl der Rig-Leiste war wirkungslos: S.ref wurde
       gespeichert und beim Aendern wurde neu gezeichnet, aber gelesen hat es
       niemand. Sie ist jetzt markiert, und faellt sie aus den besten vier,
       bekommt sie eine eigene Zeile. Kennt das Ertragsprofil das Erz gar
       nicht, sagt die Zeile das ausdruecklich statt zu verschwinden. */
    var ranked = rankRefineries(m.name);
    var chosen = D.refineries[S.ref];
    if (!ranked.length) {
      $('wb-refs').innerHTML = '<p class="wb__empty">' + esc(T.none) + '</p>';
    } else {
      var best = ranked.slice(0, 4), worst = ranked[ranked.length - 1];
      var maxAbs = Math.max(Math.abs(ranked[0].y), Math.abs(worst.y), 1);
      var picked = null;
      for (var pi = 0; pi < ranked.length; pi++) if (ranked[pi].i === S.ref) picked = ranked[pi];
      var html = best.map(function (r) {
        var mine = r.i === S.ref;
        return row2(r.n, r.s + ' · ' + (mine ? T.yourPick : T.yieldMod),
          Math.abs(r.y) / maxAbs * 100, (r.y > 0 ? '+' : '') + r.y + ' %', r.y >= 0, mine);
      }).join('');
      if (picked && best.indexOf(picked) < 0) {
        html += row2(picked.n, picked.s + ' · ' + T.yourPick, Math.abs(picked.y) / maxAbs * 100,
          (picked.y > 0 ? '+' : '') + picked.y + ' %', picked.y >= 0, true);
      } else if (!picked && chosen) {
        html += row2(chosen.n, chosen.s + ' · ' + T.yourPick, null, T.none, false, true);
      }
      if (ranked.length > 4 && worst.i !== S.ref) {
        html += row2(worst.n, worst.s + ' · ' + T.worst, Math.abs(worst.y) / maxAbs * 100,
          (worst.y > 0 ? '+' : '') + worst.y + ' %', false);
      }
      $('wb-refs').innerHTML = html;
    }

    /* Bezuege nach draussen: Crafting und Schiffe — in der ersten Fassung
       ersatzlos weggefallen, hier wieder angebunden. */
    var links = '';
    if (m.bp) {
      links += '<a class="wb__link" href="' + esc(D.craftingPath) + '">' + esc(T.usedIn) +
        ' <b>' + m.bp + '</b></a>';
    }
    /* ⚠ Frueher `D.ships.slice(0,3)` — dieselben drei Schiffe unter JEDEM Erz,
       auch unter den elf, die sich gar nicht per Schiff abbauen lassen. Jetzt
       nur die Fahrzeuge, die die Methode dieses Erzes auch bedienen; Hand-Erze
       bekommen keinen Verweis. */
    ((D.shipsByMethod || {})[m.method] || []).forEach(function (s) {
      links += '<a class="wb__link" href="' + esc(s.h) + '">' + esc(s.n) +
        (s.ore ? ' <b>' + esc(s.ore) + '</b>' : '') + '</a>';
    });
    $('wb-links').innerHTML = links;

    /* Der Weg zum Fracturing-Rechner nimmt das gewaehlte Erz mit — sonst
       landet man dort auf einem anderen und muss es zweimal suchen. */
    var frac = $('wb-frac');
    if (frac) {
      frac.href = D.fracturingPath + '?mineral=' + encodeURIComponent(m.name) + '#calc';
      $('wb-frac-ore').textContent = m.name;
    }
  }

  /* Fundort-Ansicht (Phase 12, Tracer): der EINZIGE Ort, der die Sichtbarkeit
     von #wb-orehead/#wb-oreview gegen #wb-lochead/#wb-locview umschaltet.
     Zwei Umschaltstellen waeren zwei Wahrheiten. */
  function renderLocation() {
    var showLoc = S.view === 'loc';
    var oreHead = $('wb-orehead'), oreView = $('wb-oreview'), locHead = $('wb-lochead'), locView = $('wb-locview');
    if (oreHead) oreHead.hidden = showLoc;
    if (oreView) oreView.hidden = showLoc;
    if (locHead) locHead.hidden = !showLoc;
    if (locView) locView.hidden = !showLoc;
    if (!showLoc) return;

    /* Ist S.selLoc kein bekannter locIndex-Schluessel (z.B. nach einem
       Datenlauf, der den Ort entfernt hat), still auf die Erz-Ansicht
       zurueckfallen -- dieselbe Allow-List-Haltung wie fromQuery() unten. */
    var entries = locIndex[S.selLoc];
    if (!entries || !entries.length) {
      S.view = 'ore'; S.selLoc = null;
      if (oreHead) oreHead.hidden = false;
      if (oreView) oreView.hidden = false;
      if (locHead) locHead.hidden = true;
      if (locView) locView.hidden = true;
      return;
    }

    /* Kopf ueber textContent, NICHT innerHTML -- #wb-locname bekommt NUR
       S.selLoc, nicht das Ergebnis von locName() (D-11: dessen Anflugpunkte
       gehoeren im Kopf in die Unterzeile, nicht in die Ueberschrift). */
    var head = entries[0];
    if ($('wb-locname')) $('wb-locname').textContent = S.selLoc;
    var sub = locSub(head);
    if (head.pt && head.pt.length) sub += ' · ' + head.pt.join(', ');
    if ($('wb-locsub')) $('wb-locsub').textContent = sub;

    /* Absteigend nach Chance (D-06), bei Gleichstand nach Erzname -- deter-
       ministische Reihenfolge. maxCh ueber GENAU DIESEN Ort, nicht global. */
    var sorted = entries.slice().sort(function (a, b) {
      return (b.ch || 0) - (a.ch || 0) || a.n.localeCompare(b.n);
    });
    var maxCh = 0;
    for (var si = 0; si < sorted.length; si++) if ((sorted[si].ch || 0) > maxCh) maxCh = sorted[si].ch || 0;

    /* Methode auf drei Schluessel normalisiert (D-05): Schiff bleibt Schiff,
       ROC bleibt ROC, alles uebrige (auch fps) wird Hand. Immer gruppiert,
       auch bei nur einer nichtleeren Gruppe -- eine leere Gruppe kann nicht
       entstehen, weil die Gruppen AUS den Zeilen abgeleitet werden. */
    var groups = { ship: [], roc: [], hand: [] };
    for (var gi = 0; gi < sorted.length; gi++) {
      var e = sorted[gi];
      groups[e.mi === 'ship' ? 'ship' : (e.mi === 'roc' ? 'roc' : 'hand')].push(e);
    }

    var order = ['ship', 'roc', 'hand'], html = '';
    for (var oi = 0; oi < order.length; oi++) {
      var gk = order[oi], list = groups[gk];
      if (!list.length) continue;
      html += '<div class="wb__sec"><h4>' + esc(methodLabel(gk) + ' · ' + list.length) + '</h4><div class="wb__locs">' +
        list.map(function (e2) {
          var bar = maxCh > 0 ? Math.round((e2.ch || 0) / maxCh * 100) : 0;
          /* data-ore + role/tabindex: dieselbe Attributkombination wie
             .wb__tile -- der delegierte Klick-/Tastatur-Handler verdrahtet
             seit Plan 02 (D-02) genau diesen Zweig: ein Klick oder Enter auf
             die Zeile fuehrt zurueck zum Erz. Kein pinKey: an einem Fundort
             wird kein einzelnes Erz angeheftet. Kein locSub() in der
             Unterzeile -- Art und System stehen bereits im Kopf und waeren
             an jeder Zeile dieselben. Kein Scan-Signatur-Element (D-08) --
             Spalte 3 leistet das bereits. */
          var opts = { attrs: 'data-ore="' + esc(e2.n) + '" role="button" tabindex="0"' };
          if ((e2.ms || 0) <= TRACE_MAX) {
            opts.cls = 'is-trace';
            opts.badge = '<span class="wb__tag is-trace">' + esc(T.trace) + '</span>';
          }
          return row2(e2.n, pctSub(e2, true), bar, pctRight(e2, true), false, false, null, opts);
        }).join('') +
        '</div></div>';
    }
    if (locView) locView.innerHTML = html;
  }

  function renderPins() {
    /* Zaehler in der Ueberschrift #wb-pinsh (D-03), Form wie #wb-loch:
       Beschriftung, Trennpunkt, Zahl -- nur sobald mindestens ein Erz
       angeheftet ist. Guard gegen fehlendes Element, wie ueberall sonst in
       dieser Datei ($()===null). MUSS vor dem fruehen Ausstieg unten stehen:
       sonst friert der Zaehler beim Leeren der Liste auf seinem letzten Wert
       ein. */
    var pinsh = $('wb-pinsh');
    if (pinsh) pinsh.textContent = T.signatures + (S.pins.length ? ' · ' + S.pins.length : '');
    if (!S.pins.length) {
      $('wb-pins').innerHTML = '<p class="wb__empty">' + esc(T.pinHint) + '</p>';
      return;
    }
    $('wb-pins').innerHTML = S.pins.map(function (name) {
      var m = byName[name];
      if (!m || !m.sig) return '';
      var max = MAXCLUSTER[m.rarity] || 4, mult = '';
      for (var k = 1; k <= max; k++) {
        var val = k * m.sig;
        mult += '<i title="×' + k + '">' + NF.format(val) + '</i>';
      }
      return '<div class="wb__pin-item"><div class="wb__pin-top">' +
        '<span class="nm">' + esc(m.name) + '</span>' +
        '<button type="button" data-pin="' + esc(m.name) + '" aria-label="' + esc(T.unpin + ': ' + m.name) + '">×</button>' +
        '</div><div class="wb__mult">' + mult + '</div></div>';
    }).join('');
  }

  /* Die Fundort-Merkliste, seit Phase 10 (D-03) unter der Signaturenliste
     gestapelt statt hinter einem zweiten Reiter — erz-uebergreifend (D-06).
     Eintrag "Erz — Fundort" mit Geviertstrich, derselbe ×-Knopf traegt dasselbe
     data-locpin wie die Nadel in der Fundort-Zeile: EIN Attribut, zwei
     Richtungen (Praezedenz: data-pin bei den Signaturen).
     Seit Phase 12 (D-03) traegt die Zeile SELBST zusaetzlich data-loc: ein
     Klick irgendwo auf die Zeile oeffnet denselben Fundort wie die
     Fundort-Zeile in der Mitte. Der delegierte Handler braucht dafuer
     KEINEN neuen Zweig -- der [data-loc]-Zweig aus Plan 01 findet diese
     Zeile ueber genau dasselbe Attribut, und [data-locpin] steht davor
     unveraendert an erster Stelle (dieselbe Vorrangfrage ist an dieser
     Datei bereits zweimal beantwortet: [data-locpin] vor [data-pin],
     data-pre-rmloc bewusst NICHT als data-locpin benannt). */
  function renderLocPins() {
    var box = $('wb-locpins');
    /* Zaehler in der Ueberschrift #wb-lpinsh (D-03, vorher in der
       Reiter-Beschriftung), Form wie #wb-loch: Beschriftung, Trennpunkt,
       Zahl -- nur sobald mindestens ein Paar angeheftet ist. Guard gegen
       fehlendes Element, wie ueberall sonst in dieser Datei ($()===null). */
    var lpinsh = $('wb-lpinsh');
    if (lpinsh) lpinsh.textContent = T.locations + (S.locPins.length ? ' · ' + S.locPins.length : '');
    if (!box) return;
    if (!S.locPins.length) {
      box.innerHTML = '<p class="wb__empty">' + esc(T.locPinsEmpty) + '</p>';
      return;
    }
    box.innerHTML = S.locPins.map(function (pair) {
      var idx = pair.indexOf('||');
      var ore = pair.slice(0, idx), loc = pair.slice(idx + 2);
      var label = ore + ' — ' + loc;
      /* Werte je Eintrag (O-3): System links, Chance/Hoechstanteil rechts, aus
         dem Katalog nachgeschlagen -- NIE aus dem gespeicherten Paar (T-09-06).
         locOf() liefert null, wenn das Paar zwischen Anheften und Zeichnen
         verschwunden ist (Datenlauf); die Wertezeile faellt dann schlicht weg,
         der Eintrag selbst bleibt stehen. */
      var l = locOf(ore, loc);
      var lsub = l ? pctSub(l) : '', lort = l ? locSub(l) : '';
      var meta = l
        ? '<div class="wb__lmeta"><span>' + esc(lsub ? lort + ' · ' + lsub : lort) +
          '</span><em>' + esc(pctRight(l)) + '</em></div>'
        : '';
      /* data-loc traegt NUR den Fundort-Teil des Paares, durch esc() gefuehrt
         wie der Paar-Schluessel im Kreuz-Knopf daneben (T-12-05/threat model
         T-12-05) -- role/tabindex dieselbe Kombination wie .wb__tile und
         .wb__row2[data-loc]. */
      return '<div class="wb__pin-item" data-loc="' + esc(loc) + '" role="button" tabindex="0"><div class="wb__pin-top">' +
        '<span class="nm">' + esc(label) + '</span>' +
        '<button type="button" data-locpin="' + esc(pair) + '" aria-label="' + esc(T.unpin + ': ' + label) + '">×</button>' +
        '</div>' + meta + '</div>';
    }).join('');
  }

  /* renderDetail() laeuft bewusst in JEDEM Durchlauf weiter, auch wenn die
     Erz-Ansicht gerade verborgen ist (Phase 12, D-10): nur so bleiben
     Fusszeile, Fracturing-Verweis und der Erz-Koerper auf dem zuletzt
     gewaehlten Erz stehen, und der Rueckweg ist ohne Neuaufbau sofort da.
     renderLocation() laeuft NACH renderDetail() und ist die einzige Stelle,
     die zwischen beiden Ansichten umschaltet. */
  function renderAll() { renderList(); renderDetail(); renderLocation(); renderPins(); renderLocPins(); renderPresetList(); save(); }

  /* ==========================================================
     PRESETS — benannte Zusammenstellungen der Signaturenliste
     ==========================================================
     KONTOGEBUNDEN, im Gegensatz zur angehefteten Liste selbst: die bleibt im
     localStorage, weil sie der Arbeitsstand ist und ohne Konto funktionieren
     muss. Ans Konto geht nur, was man benennt und wiederholt aufruft.

     Kein supabase-js auf dieser Seite (DOC-06: die Themenseiten laden nur
     account-lite.js). Der PostgREST-Aufruf und die Session kommen aus
     window.VBAccount — Session-Format und Refresh-Sperre ein zweites Mal zu
     bauen waere eine zweite Wahrheit.

     ⚠ Schluessel der Eintraege ist der MINERALNAME, nicht der Index in
     mining-db.json: der verschiebt sich mit jedem Datamine-Lauf. Genau dieser
     Fehler ist bei Crafting einmal bezahlt worden. Beim Laden wird gegen
     `byName` gefiltert — ein Erz, das ein Patch entfernt, faellt still raus
     statt die Liste zu vergiften.

     Seit Phase 9 traegt EIN Preset BEIDE Listen — Signaturen (`minerals`)
     UND Fundort-Paare (`locations`, Format "Erz||Fundort", Migration
     20260815090000_mining_preset_locations.sql). Ein Preset, das vor dieser
     Spalte gespeichert wurde, liefert kein `locations`-Feld oder `null`;
     `(r.locations || [])` ergibt dafuer die leere Merkliste, keinen Fehler
     (D-04).

     Seit Phase 10 (10-01, D-05) ist das Auswahlfeld eine sichtbare Liste
     (renderPresetList()); `preCur` haelt den Namen der markierten Zeile, weil
     der Zustand keinen DOM-Traeger mehr hat wie zuvor `<select>.value`.
     `preEditFor` unterscheidet die beiden Anlaesse der Namenseingabe: `null`
     = Neuanlage, sonst der alte Name, der per PATCH umbenannt wird (D-02,
     Form 1). Das Umbenennen verschiebt damit den Primaerschluessel
     `(user_id, name)` — ein einzelner PATCH auf `?name=eq.<alt>`, weil die
     UPDATE-Politik der Migration 20260812040000 (Zeilen 41-44) ausschliesslich
     `user_id` prueft, nie den Namen; der einzige Fehlerfall ist die
     Eindeutigkeitsverletzung, die PostgREST als HTTP 409 meldet.

     ⚠ eq.null-Falle (Review Phase 10, MEDIUM): PostgREST liest den LITERALEN
     Text "null" hinter `eq.` als IS NULL, nicht als Gleichheit mit dem Text
     "null" (dafuer waere `eq."null"` mit Anfuehrungszeichen noetig). Der
     Filter bleibt hier ABSICHTLICH unquotiert: eine quotierte Form wuerde das
     Wire-Format JEDES Preset-Aufrufs aendern und ist gegen keine echte
     PostgREST-Instanz aus dieser Umgebung nachweisbar; die e2e-Suite pinnt
     das heutige Format woertlich (mining-shortlist.test.js, Pfad-Zusicherung
     bei "Umbenennen schickt genau EINEN PATCH..." und beim zweiten
     Loesch-Klick). Zwei kleinere Riegel stattdessen: (1) der Name "null"
     wird bereits bei Anlage/Umbenennen abgewiesen (wb-pre-ok-Handler unten),
     (2) der Treffer-Check unten (Prefer: return=representation) verwandelt
     jeden trotzdem ins Leere laufenden Aufruf von "meldet still Erfolg" in
     "meldet laut presetFail" — deckungsgleich mit dem Projektgrundsatz
     „scheitert es laut statt still" (Kommentar zur 128-Grenze in preSave()
     unten). Ein VOR diesem Fix gespeichertes Preset namens "null" bleibt
     dadurch weiterhin unerreichbar (Rand-/Sonderfall), meldet das jetzt aber
     ehrlich statt es zu verschweigen. */
  var TBL = 'mining_sig_presets';
  var preList = $('wb-preset-list'), prePick = $('wb-pre-pick'), preEdit = $('wb-pre-edit');
  var preMsg = $('wb-pre-msg'), preGuest = $('wb-pre-guest'), preName = $('wb-pre-name');
  var preLogin = $('wb-pre-login');
  var presets = [];   // [{name, minerals, locations}]
  var preSess = null; // gueltige Session oder null (= Gast)
  var preCur = '';    // Name der aktuell markierten Zeile (is-sel)
  var preEditFor = null; // null = Neuanlage, sonst der alte Name beim Umbenennen
  var preAsk = null;     // Name der Zeile mit offener Rueckfrage (D-01, D-02 Form 2), sonst null
  /* Betreiber-Befund 15.08.2026: "Ueberschreiben" bekommt dieselbe zweistufige
     Rueckfrage mit Worten wie "Loeschen" (D-01) -- beide Aktionen verwerfen
     gespeicherten Inhalt unwiederbringlich. preAskWhat unterscheidet, WELCHE
     der beiden gemeint ist ('del' oder 'upd'); es darf immer nur EINE Zeile
     UND immer nur EINE Rueckfrage gleichzeitig bewaffnet sein -- ein Klick auf
     "Ueberschreiben" entwaffnet eine offene Loesch-Rueckfrage (auch in einer
     anderen Zeile) und umgekehrt, weil beide Felder immer gemeinsam gesetzt
     werden, nie preAsk allein. */
  var preAskWhat = null; // 'del' oder 'upd', nur gueltig solange preAsk gesetzt ist
  var preOpen = null; // Name der aufgeklappten Zeile (D-02 Form 3), sonst null

  function preSay(text, ms) {
    if (!preMsg) return;
    preMsg.textContent = text || '';
    preMsg.hidden = !text;
    if (text && ms !== 0) setTimeout(function () { if (preMsg.textContent === text) preMsg.hidden = true; }, ms || 2600);
  }
  /* Zeichnet #wb-preset-list neu — Vorbild renderPins() (Textbaustein per
     .map().join('') auf innerHTML). Jede Zeile traegt data-preset (immer
     durch esc(), auch im Attributwert — T-10-01) sowie zwei delegierte
     Klick-Ziele: [data-pre-pick] fuer die Auswahl (preApply), [data-pre-rename]
     fuer den Stift (preMode(true, name)). Keins der beiden traegt data-pin
     oder data-locpin: der delegierte Klick-Handler wuerde diese Zeile sonst
     als Erz-Anheftung bzw. Fundort-Paar missverstehen. */
  function renderPresetList() {
    if (!preList) return;
    if (!presets.length) {
      preList.innerHTML = '<p class="wb__empty">' + esc(T.presetListEmpty) + '</p>';
      return;
    }
    preList.innerHTML = presets.map(function (p) {
      /* Traegt die Zeile eine offene Rueckfrage (Loeschen D-01 ODER
         Ueberschreiben, Betreiber-Befund 15.08.2026), ersetzt eine volle
         Zeilenbreite beschriftete Schaltflaeche die gesamte Aktionszeile --
         im Bauteil die einzigen Aktionen mit Worten statt eines Zeichens, an
         einem anderen Ort als jedes ×. Modifikatorklasse + Wortlaut
         unterscheiden die beiden auf einen Blick (s. Stilblock .wb__pre-ask--*
         fuer die Begruendung, warum das Pflicht ist). */
      var head;
      if (preAsk === p.name && preAskWhat === 'del') {
        head = '<button type="button" class="wb__pre-ask wb__pre-ask--del" data-pre-delok="1"><span>' + esc(T.presetDelAsk) + '</span></button>';
      } else if (preAsk === p.name && preAskWhat === 'upd') {
        head = '<button type="button" class="wb__pre-ask wb__pre-ask--upd" data-pre-updok="1"><span>' + esc(T.presetUpdAsk) + '</span></button>';
      } else {
        var cnt = p.minerals.length + ' ' + T.signatures + ' · ' + p.locations.length + ' ' + T.locations;
        var isOpen = preOpen === p.name;
        /* Reihenfolge in der Aktionszeile ist Pflicht: Zaehlzeile,
           Ueberschreiben, Umbenennen, Loeschen. Die Zaehlzeile ist zugleich
           der Aufklapp-Griff (data-pre-open, aria-expanded) -- die Zahl
           selbst ist der Griff, kein Klappzeichen aus einer Schriftart. */
        head = '<div class="wb__pre-act">' +
          '<button type="button" class="wb__pre-cnt" data-pre-open="1" aria-expanded="' + isOpen + '" title="' +
            esc(isOpen ? T.presetHide : T.presetShow) + '">' + esc(cnt) + '</button>' +
          '<button type="button" class="wb__pre-a" data-pre-update="1" title="' + esc(T.presetUpdate) + '" aria-label="' + esc(T.presetUpdate) + '">' +
            '<svg aria-hidden="true" focusable="false"><use href="#wb-i-update" /></svg>' +
          '</button>' +
          '<button type="button" class="wb__pre-a" data-pre-rename="1" title="' + esc(T.presetRename) + '" aria-label="' + esc(T.presetRename) + '">' +
            '<svg aria-hidden="true" focusable="false"><use href="#wb-i-edit" /></svg>' +
          '</button>' +
          '<button type="button" class="wb__pre-a wb__pre-a--del" data-pre-del="1" title="' + esc(T.presetDel) + '" aria-label="' + esc(T.presetDel) + '">' +
            '<svg aria-hidden="true" focusable="false"><use href="#wb-i-trash" /></svg>' +
          '</button>' +
        '</div>';
      }
      /* Aufklapp-Ansicht (D-02 Form 3): zeigt jedes gespeicherte Erz und
         jedes gespeicherte Fundort-Paar mit je einem Entfernen-Knopf.
         ⚠ data-pre-rmmin/data-pre-rmloc heissen bewusst NICHT data-pin/
         data-locpin -- die tragen im delegierten Handler die Bedeutung
         "Arbeitsstand umschalten"; hier soll NUR die gespeicherte Zeile
         geaendert werden. */
      var body = '';
      if (preOpen === p.name) {
        var entries = p.minerals.map(function (name) {
          return '<div class="wb__pre-ent"><span>' + esc(name) + '</span>' +
            '<button type="button" data-pre-rmmin="' + esc(name) + '" aria-label="' + esc(T.presetRemoveEntry) + '">×</button></div>';
        }).concat(p.locations.map(function (pair) {
          var idx = pair.indexOf('||');
          var label = pair.slice(0, idx) + ' — ' + pair.slice(idx + 2);
          return '<div class="wb__pre-ent"><span>' + esc(label) + '</span>' +
            '<button type="button" data-pre-rmloc="' + esc(pair) + '" aria-label="' + esc(T.presetRemoveEntry) + '">×</button></div>';
        })).join('');
        body = '<div class="wb__pre-body wb__scroll">' +
          (entries || '<p class="wb__empty">' + esc(T.presetNoEntries) + '</p>') +
        '</div>';
      }
      return '<div class="wb__pre-item' + (p.name === preCur ? ' is-sel' : '') + '" data-preset="' + esc(p.name) + '">' +
        '<div class="wb__pre-top">' +
          '<button type="button" class="wb__pre-name" data-pre-pick="1">' + esc(p.name) + '</button>' +
        '</div>' + head + body + '</div>';
    }).join('');
  }
  function preLoad() {
    return window.VBAccount.rest(preSess, 'GET', TBL + '?select=name,minerals,locations&order=name.asc')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        presets = (rows || []).map(function (r) {
          return {
            name: r.name,
            minerals: (r.minerals || []).filter(function (n) { return !!byName[n]; }),
            locations: (r.locations || []).filter(locPinValid),
          };
        });
        renderPresetList();
      })
      .catch(function () { /* offline: die Liste bleibt leer, das Werkzeug laeuft weiter */ });
  }
  /* okText (optional): "Speichern" (Neuanlage) und "Ueberschreiben"
     (D-02, Form 2: mit der aktuellen Auswahl ueberschreiben) sind dieselbe
     Schreiboperation, sollen sich aber in der Rueckmeldung unterscheiden. */
  function preSave(name, okText) {
    if (!S.pins.length && !S.locPins.length) { preSay(T.presetEmpty); return; }
    var body = [{ name: name, minerals: S.pins.slice(), locations: S.locPins.slice() }];
    /* Upsert auf (user_id, name): derselbe Name ueberschreibt, statt an einem
       Unique-Konflikt zu scheitern. user_id setzt die Spalten-Vorgabe
       (default auth.uid()), der Client schickt sie nicht mit.
       ⚠ Traegt `locations` mehr als 128 Paare, weist die Datenbank den Upsert
       ab (Pruefklausel der Migration) — der Nutzer sieht T.presetFail. Der
       geschmeidige Weg (eigene Meldung, Sperre beim Anheften) kommt in 09-02;
       bis dahin scheitert es laut statt still (T-09-03). */
    return window.VBAccount.rest(preSess, 'POST', TBL + '?on_conflict=user_id,name', body,
      'resolution=merge-duplicates,return=minimal')
      .then(function (r) {
        if (!r.ok) { preSay(T.presetFail, 4000); return; }
        preSay(okText || T.presetSaved);
        preCur = name;
        return preLoad();
      })
      .catch(function () { preSay(T.presetFail, 4000); });
  }
  /* Einzeleintrag entfernen (D-02, Form 3) — gezielter PATCH auf GENAU die
     gespeicherte Zeile, OHNE preApply(): das blosse Ausduennen eines
     gespeicherten Presets darf weder den Arbeitsstand (S.pins/S.locPins)
     noch das aktive Preset (preCur) aendern -- sonst loest sich die Grenze
     zu "ueberschreiben" auf (CONTEXT.md, Abschnitt "Im Planungslauf
     nachgeschaerft"). Das verkuerzte Array entstammt dem zuletzt GELADENEN
     Serverstand (`presets`), nie dem Arbeitsstand (T-10-04). */
  /* Lost-Update-Schutz (Review Phase 10, HIGH): preRemoveEntry() berechnet
     `next` IMMER aus dem lokal gecachten `presets`-Array, das erst NACH
     einem echten Netzwerk-Umlauf per preLoad() aktualisiert wird. Zwei
     rasche Klicks auf DASSELBE Feld DESSELBEN Presets lasen bislang beide
     denselben stale Stand, berechneten je einen vollstaendigen Ersatz, und
     der zuletzt ankommende PATCH ueberschrieb den anderen restlos — eine der
     beiden angestossenen Entfernungen ging wortlos verloren.
     preRmBusy sperrt NUR das betroffene (name, field)-Paar: Entfernungen aus
     VERSCHIEDENEN Feldern (minerals vs. locations) oder verschiedenen
     Presets sind beweisbar unabhaengig, weil jeder PATCH ausschliesslich
     seine eigene Spalte setzt — eine modulweite Sperre waere hier ein
     unnoetiger Bedienrueckschritt. Wird in BEIDEN Zweigen (Erfolg UND
     Netzwerkfehler) wieder geloescht, sonst haengt ein einziger
     Verbindungsabbruch das Feld dauerhaft fest. */
  var preRmBusy = {}; // Schluessel = name + ' ' + field
  function preRemoveEntry(name, field, value) {
    var key = name + ' ' + field;
    if (preRmBusy[key]) return; // zweiter Klick waehrend des laufenden PATCH: ignorieren, nicht heimlich mitrechnen
    var preset = null;
    for (var i = 0; i < presets.length; i++) if (presets[i].name === name) { preset = presets[i]; break; }
    if (!preset) return;
    var next = (preset[field] || []).filter(function (v) { return v !== value; });
    var body = {};
    body[field] = next;
    preRmBusy[key] = true;
    /* Treffer-Check (Review Phase 10, MEDIUM): Prefer: return=representation
       liefert die betroffene Zeile zurueck statt nur den blanken Status —
       PostgREST antwortet auf einen Filter, der null Zeilen trifft, TROTZDEM
       mit 200/kein Fehler (Cross-Device-Race: ein anderer Tab hat dieses
       Preset bereits geloescht). Ein leeres Array heisst "nichts getroffen"
       und wird als Fehlschlag gemeldet statt als Erfolg. */
    return window.VBAccount.rest(preSess, 'PATCH', TBL + '?name=eq.' + encodeURIComponent(name), body, 'return=representation')
      .then(function (r) {
        delete preRmBusy[key];
        if (!r.ok) { preSay(T.presetFail, 4000); return; }
        return r.json().then(function (rows) {
          if (!rows || !rows.length) { preSay(T.presetFail, 4000); return; }
          preSay(T.presetSaved);
          return preLoad();
        });
      })
      .catch(function () { delete preRmBusy[key]; preSay(T.presetFail, 4000); });
  }
  function preDrop(name) {
    /* Treffer-Check wie oben bei preRemoveEntry() — siehe dort. */
    return window.VBAccount.rest(preSess, 'DELETE', TBL + '?name=eq.' + encodeURIComponent(name), null, 'return=representation')
      .then(function (r) {
        if (!r.ok) { preSay(T.presetFail, 4000); return; }
        return r.json().then(function (rows) {
          if (!rows || !rows.length) { preSay(T.presetFail, 4000); return; }
          preSay(T.presetDeleted);
          preCur = '';
          return preLoad();
        });
      })
      .catch(function () { preSay(T.presetFail, 4000); });
  }
  /* Umbenennen (D-02, Form 1) — EIN PATCH auf den Primaerschluessel, gebaut
     nach dem PATCH-Vorbild hbWrite() in assets/account-lite.js Zeile 284.
     ⚠ Ausdruecklich NICHT als POST(neu)+DELETE(alt): nicht atomar, ein
     Netzwerkfehler dazwischen hinterliesse eine Dublette oder eine geloeschte
     Zeile ohne Ersatz. ⚠ Kein user_id-Filter im Query-String — die
     Beschraenkung auf eigene Zeilen kommt aus RLS, deckungsgleich mit dem
     bestehenden DELETE-Pfad (T-10-03). */
  function preRename(oldName, newName) {
    if (!newName || newName === oldName) { preMode(false); return; }
    /* Treffer-Check wie bei preRemoveEntry()/preDrop() — siehe dort. Die
       409-Kollisionsbehandlung bleibt ZUERST: ein Namenskonflikt ist kein
       "null Zeilen getroffen", sondern ein expliziter Fehlercode, den
       PostgREST vor jeder Repraesentation meldet. */
    return window.VBAccount.rest(preSess, 'PATCH',
      TBL + '?name=eq.' + encodeURIComponent(oldName), { name: newName }, 'return=representation')
      .then(function (r) {
        if (r.status === 409) { preSay(T.presetNameTaken, 4000); return; }
        if (!r.ok) { preSay(T.presetFail, 4000); return; }
        return r.json().then(function (rows) {
          if (!rows || !rows.length) { preSay(T.presetFail, 4000); return; }
          preSay(T.presetRenamed);
          if (preCur === oldName) preCur = newName;
          /* LOW-Fund (Review Phase 10): preOpen folgte bislang nicht -- eine
             aufgeklappte Zeile klappte nach ihrem eigenen Umbenennen unbemerkt
             zu, weil renderPresetList() pro Zeile preOpen === p.name prueft
             und der alte Name danach zu keiner Zeile mehr passt. */
          if (preOpen === oldName) preOpen = newName;
          return preLoad();
        });
      })
      .catch(function () { preSay(T.presetFail, 4000); });
  }
  function preApply(name) {
    for (var i = 0; i < presets.length; i++) {
      if (presets[i].name !== name) continue;
      S.pins = presets[i].minerals.slice();
      S.locPins = (presets[i].locations || []).slice();
      preCur = name;
      renderAll();
      return;
    }
  }
  /* preMode(true, null) = Neuanlage (Feld leer); preMode(true, '<alt>') =
     Umbenennen (Feld traegt den alten Namen, preEditFor merkt ihn sich).
     preMode(false) schliesst die Eingabe und setzt preEditFor zurueck. */
  function preMode(editing, oldName) {
    if (!prePick) return;
    prePick.hidden = editing;
    preEdit.hidden = !editing;
    if (editing) {
      preEditFor = oldName || null;
      preName.value = oldName || '';
      preName.focus();
      preName.select();
    } else {
      preEditFor = null;
    }
  }
  function preBoot() {
    if (!prePick || !window.VBAccount) return;
    if (preLogin) preLogin.href = window.VBAccount.loginHref();
    window.VBAccount.session().then(function (s) {
      preSess = s;
      var on = !!s;
      prePick.hidden = !on;
      preGuest.hidden = on;
      if (on) preLoad();
    }).catch(function () { /* Gast-Ansicht bleibt stehen */ });
  }
  if (window.VBAccount) preBoot();
  else addEventListener('vb-account-ready', preBoot, { once: true });

  if (prePick) {
    $('wb-pre-new').addEventListener('click', function () { preMode(true, null); });
    $('wb-pre-cancel').addEventListener('click', function () { preMode(false); });
    $('wb-pre-ok').addEventListener('click', function () {
      var n = (preName.value || '').trim();
      if (!n) { preName.focus(); return; }
      /* eq.null-Falle, prospektiver Teil (Review Phase 10, MEDIUM): PostgREST
         liest den literalen Text "null" hinter `eq.` als IS NULL statt als
         Gleichheit mit dem Text -- ein Preset mit genau diesem Namen liesse
         sich ueber diese Oberflaeche danach nie wieder umbenennen, loeschen
         oder ausduennen (Begruendung fuer den unquotierten Filter steht bei
         `var TBL` oben). Gilt fuer BEIDE Anlaesse dieses Feldes (Neuanlage
         UND Umbenennen), deshalb hier an der gemeinsamen Stelle geprueft,
         nicht erst in preSave(). */
      if (n.toLowerCase() === 'null') { preSay(T.presetFail, 4000); return; }
      var editFor = preEditFor;
      preMode(false);
      if (editFor) preRename(editFor, n); else preSave(n);
    });
    preName.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('wb-pre-ok').click(); }
      else if (e.key === 'Escape') { e.preventDefault(); preMode(false); }
    });
  }

  var grid = document.querySelector('.wb__grid');
  function mountSeg() {
    if (!grid || document.querySelector('.wb__seg')) return;
    var seg = document.createElement('div');
    seg.className = 'wb__seg';
    seg.setAttribute('role', 'tablist');
    var keys = [['list', T.minerals], ['view', T.view], ['sig', T.signatures]];
    seg.innerHTML = keys.map(function (k, i) {
      return '<button type="button" class="wb__chip' + (i === 0 ? ' is-on' : '') +
        '" data-seg="' + k[0] + '" role="tab" aria-selected="' + (i === 0) + '">' + esc(k[1]) + '</button>';
    }).join('');
    grid.parentNode.insertBefore(seg, grid);
    grid.classList.add('has-seg', 'seg-list');
  }
  mountSeg();

  /* Die Handler haengen am document und sehen JEDEN Klick der Seite — auch
     die im Refinery-Finder darunter. Ohne diesen Riegel koennte `closest`
     dort werfen oder ein gleichnamiges data-Attribut treffen. */
  function inWb(t) { return t && typeof t.closest === 'function' && !!t.closest('.wb'); }

  /* Alle vier delegierten Handler laufen ueber diese Anmeldung statt direkt
     ueber document.addEventListener. Grund: Ereignisse aus dem ausgelagerten
     Fenster steigen NICHT in dieses Dokument auf — sie enden an dessen
     eigenem document. Die Liste erlaubt, dieselben Handler beim Auslagern
     zusaetzlich dort anzumelden und beim Zurueckholen wieder abzumelden.
     ⚠ Die Handler duerfen deshalb nichts ueber `document` nachschlagen, was
     im Fremdfenster liegen kann — dafuer ist $() zustaendig (s.o.). */
  var DELEGATED = [];
  function onDoc(type, fn) { DELEGATED.push([type, fn]); document.addEventListener(type, fn); }

  onDoc('click', function (e) {
    var t = e.target;
    if (!inWb(t)) return;
    /* Rueckfragen (D-01 Loeschen, Betreiber-Befund 15.08.2026 Ueberschreiben)
       zuerst, noch vor Umbenennen/Auswahl: der zweite, bestaetigende Klick
       fuehrt die Aktion aus; der erste verwandelt den Knopf nur in eine
       beschriftete Zeile, ohne Netzwerkaufruf. */
    var delOk = t.closest('[data-pre-delok]');
    if (delOk) {
      var delRow = delOk.closest('[data-preset]');
      preAsk = null; preAskWhat = null;
      if (delRow) preDrop(delRow.getAttribute('data-preset'));
      return;
    }
    var updOk = t.closest('[data-pre-updok]');
    if (updOk) {
      var updOkRow = updOk.closest('[data-preset]');
      preAsk = null; preAskWhat = null;
      /* Ueberschreiben (D-02, Form 2): preSave() schreibt den AKTUELLEN
         Arbeitsstand unter demselben Namen per Upsert -- das IST bereits
         "ueberschreiben", nur die Rueckmeldung unterscheidet sich von
         "neu angelegt". Erst nach der zweiten, bestaetigenden Rueckfrage. */
      if (updOkRow) preSave(updOkRow.getAttribute('data-preset'), T.presetUpdated);
      return;
    }
    /* Beide bewaffnenden Klicks setzen preAsk/preAskWhat IMMER gemeinsam neu
       -- das entwaffnet automatisch jede andersartige oder andernorts offene
       Rueckfrage (nur eine gleichzeitig, s. Kommentar bei `var preAskWhat`). */
    var delAsk = t.closest('[data-pre-del]');
    if (delAsk) {
      var askRow = delAsk.closest('[data-preset]');
      preAsk = askRow ? askRow.getAttribute('data-preset') : null;
      preAskWhat = askRow ? 'del' : null;
      renderPresetList();
      return;
    }
    var updAsk = t.closest('[data-pre-update]');
    if (updAsk) {
      var updAskRow = updAsk.closest('[data-preset]');
      preAsk = updAskRow ? updAskRow.getAttribute('data-preset') : null;
      preAskWhat = updAskRow ? 'upd' : null;
      renderPresetList();
      return;
    }
    /* Ein Klick daneben bricht jede offene Rueckfrage ab, laeuft aber normal
       weiter (kein return hier) — der Klick kann z.B. gleichzeitig ein
       anderes Preset auswaehlen. ⚠ Der Handler steigt oben mit
       `if (!inWb(t)) return;` aus; ein Klick voellig ausserhalb der
       Werkbank laesst die Rueckfrage bewusst stehen — sie verlangt ohnehin
       einen zweiten, gezielten Klick, und ein Handler, der bei jedem
       Seitenklick neu zeichnet, waere teurer als der gewonnene Komfort. */
    if (preAsk) { preAsk = null; preAskWhat = null; renderPresetList(); }
    /* Presetzeile: Umbenennen-Stift und Namensflaeche, VOR jeder
       Interpretation als data-pin/data-locpin. Der Name kommt IMMER aus dem
       Zeilencontainer [data-preset], nie aus dem Knopf selbst — ein
       zusammengesetzter Attributwert waere bei einem Preset-Namen mit
       Trennzeichen darin mehrdeutig. */
    var preRen = t.closest('[data-pre-rename]');
    if (preRen) {
      var renRow = preRen.closest('[data-preset]');
      if (renRow) preMode(true, renRow.getAttribute('data-preset'));
      return;
    }
    var prePickBtn = t.closest('[data-pre-pick]');
    if (prePickBtn) {
      var pickRow = prePickBtn.closest('[data-preset]');
      if (pickRow) preApply(pickRow.getAttribute('data-preset'));
      return;
    }
    /* Zaehlzeile = Aufklapp-Griff (D-02 Form 3): NUR Ansehen, kein
       preApply(), kein Netzwerkaufruf -- das blosse Ansehen eines
       gespeicherten Presets darf weder den Arbeitsstand noch den
       gespeicherten Stand aendern. */
    var openBtn = t.closest('[data-pre-open]');
    if (openBtn) {
      var openRow = openBtn.closest('[data-preset]');
      var openName = openRow ? openRow.getAttribute('data-preset') : null;
      preOpen = preOpen === openName ? null : openName;
      renderPresetList();
      return;
    }
    /* Einzeleintrag entfernen (D-02, Form 3): der Wert kommt vom Knopf
       selbst (data-pre-rmmin/data-pre-rmloc), der Name der Zeile aus dem
       Zeilencontainer -- dieselbe Trennung wie bei Umbenennen/Auswahl. */
    var rmMin = t.closest('[data-pre-rmmin]');
    if (rmMin) {
      var rmMinRow = rmMin.closest('[data-preset]');
      if (rmMinRow) preRemoveEntry(rmMinRow.getAttribute('data-preset'), 'minerals', rmMin.getAttribute('data-pre-rmmin'));
      return;
    }
    var rmLoc = t.closest('[data-pre-rmloc]');
    if (rmLoc) {
      var rmLocRow = rmLoc.closest('[data-preset]');
      if (rmLocRow) preRemoveEntry(rmLocRow.getAttribute('data-preset'), 'locations', rmLoc.getAttribute('data-pre-rmloc'));
      return;
    }
    /* ⚠ Reihenfolge ist Pflicht: [data-locpin] MUSS vor [data-pin] geprueft
       werden. Die bestehende [data-pin]-Abfrage behandelt jedes Element mit
       data-pin gleich — landete ein Fundort-Paar dort, wanderte es in die
       Signaturenliste statt in die Merkliste. */
    var lp = t.closest('[data-locpin]');
    if (lp) {
      var lk = lp.getAttribute('data-locpin'), lat = S.locPins.indexOf(lk);
      if (lat >= 0) {
        S.locPins.splice(lat, 1);
      } else {
        /* Grenze mit Ansage (T-09-07): bei 128 Paaren wird NICHT angeheftet,
           die bestehende Meldungszeile #wb-pre-msg sagt es statt still zu
           schlucken. preSay() ist als Funktionsdeklaration weiter unten
           definiert und dadurch hier bereits sichtbar (hoisting). */
        if (S.locPins.length >= LOCPIN_MAX) { preSay(T.locPinsFull); return; }
        S.locPins.push(lk);
      }
      renderAll(); return;
    }
    /* Fundort-Ansicht (Phase 12, D-01/D-02): zwei neue Zweige NACH
       [data-locpin] (die Nadel bleibt vorrangig -- ein Klick auf sie oeffnet
       den Fundort NICHT zusaetzlich) und VOR [data-pin]. Geloest ausschliess-
       lich ueber die Reihenfolge der Abfragen, nie ueber ein Unterbinden der
       Ereignisweitergabe -- das kommt im ganzen Bestand nicht vor. */
    var back = t.closest('[data-back]');
    if (back) { S.view = 'ore'; S.selLoc = null; renderAll(); return; }
    var locRow = t.closest('[data-loc]');
    if (locRow) { S.selLoc = locRow.getAttribute('data-loc'); S.view = 'loc'; renderAll(); return; }
    /* Erzzeile INNERHALB der Fundort-Ansicht (Phase 12, D-02) -- der
       Rueckweg zum Erz. Derselbe Vorsichtsabgleich wie an anderer Stelle
       (locPinValid() gegen byName): ein unbekannter Name wird still
       verworfen, der Zweig endet aber TROTZDEM mit return, kein
       Durchfallen zu [data-pin]. Kein zweiter Render-Pfad fuer die
       Erz-Seite: renderDetail() bleibt die einzige Zeichenroutine des
       Erzes, renderLocation() schaltet nur die Sichtbarkeit -- zwei Wege
       zu derselben Ansicht waeren zwei Wahrheiten. */
    var oreRow = t.closest('[data-ore]');
    if (oreRow) {
      var oreName = oreRow.getAttribute('data-ore');
      if (byName[oreName]) { S.sel = oreName; S.view = 'ore'; S.selLoc = null; renderAll(); }
      return;
    }
    var pin = t.closest('[data-pin]');
    if (pin) {
      var pn = pin.getAttribute('data-pin'), at = S.pins.indexOf(pn);
      if (at >= 0) S.pins.splice(at, 1); else S.pins.push(pn);
      renderAll(); return;
    }
    var tile = t.closest('.wb__tile');
    /* Eine Erz-Auswahl bedeutet immer Erz-Ansicht (Claudes Ermessen, in
       CONTEXT.md festgelegt) -- sonst zeigte der Kopf weiter einen Ort,
       waehrend der zugehoerige Koerper verborgen ist. */
    if (tile) { S.sel = tile.getAttribute('data-min'); S.view = 'ore'; renderAll(); return; }
    var sys = t.closest('[data-sys]');
    if (sys) {
      var sv = sys.getAttribute('data-sys');
      S.sys = S.sys === sv ? null : sv;
      var all = document.querySelectorAll('[data-sys]');
      for (var i2 = 0; i2 < all.length; i2++) all[i2].classList.toggle('is-on', all[i2].getAttribute('data-sys') === S.sys);
      renderList(); return;
    }
    var seg = t.closest('[data-seg]');
    if (seg && grid) {
      var k = seg.getAttribute('data-seg');
      grid.classList.remove('seg-list', 'seg-view', 'seg-sig');
      grid.classList.add('seg-' + k);
      var tabs = document.querySelectorAll('[data-seg]');
      for (var i3 = 0; i3 < tabs.length; i3++) {
        var on = tabs[i3] === seg;
        tabs[i3].classList.toggle('is-on', on);
        tabs[i3].setAttribute('aria-selected', String(on));
      }
      return;
    }
  });

  onDoc('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!inWb(e.target)) return;
    var tile = e.target.closest('.wb__tile');
    if (tile) {
      e.preventDefault();
      S.sel = tile.getAttribute('data-min');
      S.view = 'ore';
      renderAll();
      return;
    }
    /* Fundort-Ansicht (Phase 12): liegt das Ziel innerhalb eines ECHTEN
       <button> (die Nadel in der Zeile, der Zurueck-Knopf), loest der
       Browser dort bereits von sich aus einen Klick aus -- die neuen Zweige
       bleiben dafuer aus, sonst zeichnete Enter/Space doppelt. Die Erzzeile
       traegt keinen verschachtelten Knopf (kein pinKey), der Fall tritt
       dort also nie ein -- der Vorbehalt bleibt trotzdem die eine
       gemeinsame Stelle, an der das entschieden wird, statt je Zweig neu. */
    if (e.target.closest('button')) return;
    var locRow = e.target.closest('[data-loc]');
    if (locRow) {
      e.preventDefault();
      S.selLoc = locRow.getAttribute('data-loc');
      S.view = 'loc';
      renderAll();
      return;
    }
    var oreRow = e.target.closest('[data-ore]');
    if (!oreRow) return;
    e.preventDefault();
    var oreName = oreRow.getAttribute('data-ore');
    if (byName[oreName]) { S.sel = oreName; S.view = 'ore'; S.selLoc = null; renderAll(); }
  });

  onDoc('change', function (e) {
    if (e.target.id === 'wb-ref') { S.ref = +e.target.value; renderDetail(); save(); }
  });

  onDoc('input', function (e) {
    if (e.target.id === 'wb-q') { S.q = e.target.value; renderList(); }
  });

  /* ==========================================================
     AUSLAGERN — die rechte Spalte als eigenes Fenster
     ==========================================================
     Wunsch des Betreibers (16.08.2026): die Signaturen- und die
     Fundortliste sollen sich "ueberall rumschieben" lassen, auch ueber
     andere Fenster und Programme. Das geht, und zwar ohne Erweiterung:

       1. documentPictureInPicture.requestWindow() — Chromium ab 116
          (Chrome, Edge, Opera). Liefert ein randloses Fenster, das UEBER
          allen anderen Fenstern liegt, auch ueber fremden Programmen.
          Das ist die Fassung, die der Wunsch meint.
       2. window.open('', …, 'popup=yes') — ueberall sonst (Firefox,
          Safari). Ein echtes, frei verschiebbares Fenster, aber KEIN
          Immer-obenauf: es faellt hinter das Fenster, das man anklickt.
          Auf einem zweiten Bildschirm ist das gleichwertig.

     ⚠ Was hier NICHT geht und wovon niemand ausgehen sollte: ueber ein
     Spiel im ECHTEN Vollbild legt sich kein Fenster — weder dieses noch
     ein anderes. Star Citizen muss im randlosen Fenstermodus laufen (oder
     auf dem zweiten Bildschirm stehen). Das steht so auch im Hilfetext,
     damit es nicht als Fehler zurueckkommt.

     VERFAHREN: nicht neu zeichnen, sondern UMZIEHEN. Beide Fenster teilen
     sich denselben JavaScript-Kontext, deshalb wandert der bestehende
     Knoten #wb-pop-body per adoptNode hinueber und bringt seine direkt
     angehefteten Handler (Preset-Knoepfe) mit. Was NICHT von allein
     mitkommt, sind genau zwei Dinge — beide oben geloest:
       · document.getElementById findet den Knoten danach nicht mehr  -> $()
       · Ereignisse steigen nicht ins Seitendokument auf              -> DELEGATED
     Ein Nachbau als zweite Zeichenroutine waere die Alternative gewesen und
     haette zwei Wahrheiten ueber denselben Zustand ergeben. */
  (function popout() {
    var btn = $('wb-pop'), slot = $('wb-pop-slot'), backBtn = $('wb-pop-back');
    var body = $('wb-pop-body');
    if (!btn || !slot || !backBtn || !body) return;
    var pane = body.parentNode;
    var win = null;
    var W = 360, H = 620;

    /* Das Fremdfenster bekommt SAEMTLICHE Stilquellen dieser Seite kopiert —
       die inline eingebetteten <style> (dort steht die Werkbank selbst) UND
       die gebuendelten <link> aus /_astro/ (dort steht das Farbthema).
       ⚠ Nur eine der beiden Quellen zu kopieren ist die naheliegende Falle:
       das Bündel ist im HTML nicht zu sehen, die inline-Bloecke sind es
       schon (dieselbe Verwechslung ist beim Menue-Eintritt schon einmal
       aufgelaufen). Ueber die ELEMENTE gehen, nicht ueber document.styleSheets
       — cssRules wirft bei fremder Herkunft. */
    function copyStyles(doc) {
      var src = document.querySelectorAll('link[rel="stylesheet"],style');
      for (var i = 0; i < src.length; i++) {
        var n = src[i], el;
        if (n.tagName === 'LINK') { el = doc.createElement('link'); el.rel = 'stylesheet'; el.href = n.href; }
        else { el = doc.createElement('style'); el.textContent = n.textContent; }
        doc.head.appendChild(el);
      }
      /* Zuletzt, damit es das kopierte Blatt schlaegt: das Fremdfenster IST
         die Seite, es hat keinen Textkoerper darum. Der Grundton steht mit
         hartem Rueckfall da — ohne ihn stuende bei einem fehlgeschlagenen
         Kopiervorgang schwarzer Text auf weissem Grund. */
      var base = doc.createElement('style');
      base.textContent = 'html,body{margin:0;padding:0;height:100%;overflow:hidden}' +
        'body{background:var(--bg,#0a0d12);color:var(--text,#dfe4ec)}';
      doc.head.appendChild(base);
    }

    /* Farbthema und Sprache haengen als Attribute am <html> der Seite; ohne
       sie greifen die kopierten Regeln fuer [data-theme] drueben ins Leere. */
    function mirrorRoot(doc) {
      var a = document.documentElement.attributes;
      for (var i = 0; i < a.length; i++) {
        try { doc.documentElement.setAttribute(a[i].name, a[i].value); } catch (e) { /* egal */ }
      }
      doc.body.className = document.body.className;
    }

    function mount(w) {
      var doc = w.document;
      try {
        win = w;
        doc.title = T.popoutTitle || 'verse-base';
        mirrorRoot(doc);
        copyStyles(doc);
        /* Dieselbe Klassenkette wie in der Seite: .wb ist der Riegel, gegen
           den inWb() prueft, .wb__pane--sig traegt die Spaltengestalt. */
        /* ⚠⚠ Das Symbol-Sprite MUSS mitkommen, und zwar als KOPIE. Die drei
           Preset-Knoepfe (Ueberschreiben, Umbenennen, Loeschen) und die Nadel
           in der Fundort-Zeile zeichnen ihre Symbole ueber
           `<use href="#wb-i-…">` — und ein <use> loest IMMER gegen sein
           EIGENES Dokument auf. Das Sprite liegt aber weit oben im Bauteil,
           ausserhalb von #wb-pop-body, zieht also nicht mit um: drueben
           standen an ihrer Stelle drei leere graue Kaesten (Betreiber,
           16.08.2026: „icons fehlen"). Verschieben statt kopieren waere die
           naheliegende und falsche Abhilfe — dann fehlten die Symbole
           stattdessen in der Seite, wo dieselben Kennungen die Nadeln der
           mittleren Spalte speisen.
           VOR dem Umzug der Huelle, damit die Kennungen schon dastehen, wenn
           die <use>-Verweise ankommen. */
        var sprite = document.querySelector('.wb__sprite');
        if (sprite) { try { doc.body.appendChild(doc.importNode(sprite, true)); } catch (e) { /* dann eben ohne */ } }
        /* ⚠ `wb__cscreen` ist hier kein Zierrat, sondern die Antwort auf
           „das Fenster spricht nicht unsere Design-Sprache": diese Klasse
           IST der Bildschirm des Geraets (Zeilenraster, Leuchtkegel,
           Verlauf), und in der Werkbank schwimmen die Paneele mit 8 px
           Abstand darauf. Das Fenster bekommt deshalb dieselbe Flaeche
           statt eines nachempfundenen flachen Grundes — es ist ein
           herausgeloestes Stueck desselben Schirms, kein Nachbau.
           Das Raster liegt dabei HINTER dem deckenden Paneel und kreuzt
           keine Glyphe; genau diese Ortswahl ist im Bildschirm-Durchgang
           erarbeitet worden. */
        var shell = doc.createElement('div');
        shell.className = 'wb wb--pop wb__cscreen';
        var host = doc.createElement('div');
        host.className = 'wb__pane wb__pane--sig chamf';
        shell.appendChild(host);
        doc.body.appendChild(shell);
        host.appendChild(doc.adoptNode(body));
        popDoc = doc;
        for (var i = 0; i < DELEGATED.length; i++) doc.addEventListener(DELEGATED[i][0], DELEGATED[i][1]);
        /* Der Elemente-Modus des Hilfe-Kastens muss mitkommen: drei der elf
           data-help-Anker der Werkbank (Presets, Signaturen, Fundorte) leben
           ab jetzt hier drueben. Ohne diese Anmeldung stand der Knopf „Wie
           funktioniert …? › Elemente" fuer ein Drittel des Werkzeugs still —
           je nach Klickreihenfolge ohne Sprechblase oder ganz ohne Wirkung.
           Guard, weil tool-help.js mit `defer` laedt; hier laeuft ohnehin
           erst ein Klick lange nach dem Laden. */
        if (window.VBToolHelp) window.VBToolHelp.addDoc(doc);
        btn.hidden = true;
        slot.hidden = false;
        /* Das Fensterkreuz ist der eine Rueckweg, der Knopf im Platzhalter
           der andere — beide enden hier. */
        w.addEventListener('pagehide', takeBack);
      } catch (e) { takeBack(); }
    }

    /* Idempotent: laeuft sowohl aus dem pagehide des Fremdfensters als auch
       aus dem Platzhalter-Knopf und aus dem Fehlerzweig von mount(). */
    function takeBack() {
      var doc = popDoc;
      popDoc = null;
      win = null;
      if (doc) {
        for (var i = 0; i < DELEGATED.length; i++) {
          try { doc.removeEventListener(DELEGATED[i][0], DELEGATED[i][1]); } catch (e) { /* egal */ }
        }
        // Gegenstueck zum addDoc() in mount(): sonst haelt tool-help.js ein
        // Dokument fest, das es nicht mehr gibt.
        if (window.VBToolHelp) { try { window.VBToolHelp.removeDoc(doc); } catch (e) { /* egal */ } }
      }
      /* ⚠ Das Zurueckhaengen haengt AUSDRUECKLICH nicht daran, ob popDoc stand.
         adoptNode() loest den Knoten aus diesem Dokument, BEVOR er drueben
         haengt — schlaegt das Anhaengen dazwischen fehl, ist er nirgends, und
         eine Wiederherstellung, die erst ein bekanntes Fremddokument verlangt,
         kaeme genau dann nicht mehr zum Zug. Gefragt wird deshalb der Knoten
         selbst, nicht der Merkzettel ueber ihn.
         Ans Ende der Spalte — dort stand er vorher, hinter Knopf und
         Platzhalter. */
      if (body.parentNode !== pane) {
        try { pane.appendChild(document.adoptNode(body)); } catch (e) { /* egal */ }
      }
      btn.hidden = false;
      slot.hidden = true;
      renderAll();
    }

    /* Rueckfallebene. ⚠ about:blank bekommt in manchen Browsern nach dem
       Oeffnen noch ein leeres Dokument nachgeschoben, das Eingefuegtes
       wieder wegnimmt; ein synchrones write()+close() friert das Dokument
       fest. Ohne Skript darin — das Fenster teilt sich unseren Kontext. */
    function openPlain() {
      var w = window.open('', 'vb-mining-lists',
        'popup=yes,width=' + W + ',height=' + H + ',menubar=no,toolbar=no,location=no,status=no,resizable=yes');
      if (!w) { preSay(T.popoutBlocked, 6000); return; }
      try {
        w.document.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
        w.document.close();
      } catch (e) { /* das vorgefundene about:blank tut es auch */ }
      if (!w.document || !w.document.body) { preSay(T.popoutBlocked, 6000); return; }
      mount(w);
    }

    function openPop() {
      if (win && !win.closed) { try { win.focus(); } catch (e) { /* egal */ } return; }
      /* Fenster weg, ohne dass pagehide durchkam — Zustand nachziehen, sonst
         zeigte die Spalte weiter den Platzhalter fuer ein Fenster, das es
         nicht mehr gibt. */
      if (win) takeBack();
      var p = null;
      try {
        if (window.documentPictureInPicture && window.documentPictureInPicture.requestWindow) {
          p = window.documentPictureInPicture.requestWindow({ width: W, height: H });
        }
      } catch (e) { p = null; }
      /* Der Rueckfall im .catch() laeuft noch innerhalb der kurzzeitigen
         Klick-Berechtigung des Browsers (einige Sekunden), window.open wird
         dort also nicht als unaufgeforderte Werbung geblockt. */
      if (p && typeof p.then === 'function') p.then(mount).catch(openPlain);
      else openPlain();
    }

    btn.addEventListener('click', openPop);
    backBtn.addEventListener('click', function () {
      if (win) { try { win.close(); } catch (e) { /* egal */ } }
      takeBack();
    });
    /* Kein verwaistes Fenster: verlaesst die Seite den Browser-Tab, geht das
       Popup mit. Es haengt an DIESEM Kontext — ohne ihn stuenden dort tote
       Knoepfe. (Das PiP-Fenster schliesst der Browser von sich aus.) */
    addEventListener('pagehide', function () {
      if (win) { try { win.close(); } catch (e) { /* egal */ } }
    });
  })();

  /* Tieflink ?mineral=<Name> aus der Crafting-Datenbank (miningLinks.ts:129,
     ueber 8000 Verweise). VORRANG vor dem gespeicherten Zustand: wer von dort
     kommt, will DIESES Erz sehen. */
  var deepLinked = false;
  (function fromQuery() {
    var want;
    try { want = new URLSearchParams(location.search).get('mineral'); } catch (e) { return; }
    if (!want) return;
    var key = want.trim().toLowerCase();
    for (var n in byName) if (n.toLowerCase() === key) { S.sel = n; deepLinked = true; return; }
  })();

  /* Tieflink ?fundort=<Ortsname> (Phase 12, D-04) -- ab Auslieferung eine
     OEFFENTLICHE ZUSAGE: der Name ist der Schluessel aus den Fundortdaten,
     geteilte Verweise brechen, wenn dieser Schluessel sich spaeter aendert
     (Bewertung "costly", nicht "one-way", siehe 12-03-PLAN.md). Dieselbe
     Bauform wie der Mineral-Zweig oben, nicht ein zweites Verfahren: Lesen
     in try/catch, frueher Ausstieg bei fehlendem Wert, Abgleich ueber
     trim()+toLowerCase() gegen die vorhandenen locIndex-Schluessel. Ein
     Treffer setzt S.selLoc auf den KANONISCHEN Schluessel (nie den
     gelesenen Wert) und S.view auf die Fundort-Ansicht; kein Treffer heisst:
     nichts tun -- kein Fehlertext, kein Konsolenausdruck, keine Umleitung.
     Laeuft NACH dem Laden des gespeicherten Zustands (oben) und VOR dem
     ersten renderAll() (unten) -- sonst gewinnt der gespeicherte Zustand.
     Beide Parameter vertragen sich: der Mineral-Zweig bestimmt weiterhin das
     gewaehlte Erz (Fusszeile), dieser Zweig nur die ANSICHT. */
  (function fromQueryLoc() {
    var want;
    try { want = new URLSearchParams(location.search).get('fundort'); } catch (e) { return; }
    if (!want) return;
    var key = want.trim().toLowerCase();
    for (var p in locIndex) if (p.toLowerCase() === key) { S.selLoc = p; S.view = 'loc'; return; }
  })();

  if ($('wb-ref')) $('wb-ref').value = String(S.ref);
  renderAll();

  /* Angesprungene Kachel ins Bild holen. Zwei Fallen: nicht ueber offsetTop
     rechnen (misst gegen das naechste positionierte Elternelement), und EIN
     rAF reicht nicht — die Rasterhoehe kommt aus clamp(…100vh…), im ersten
     Bild ist scrollHeight == clientHeight und die Zuweisung wird auf 0
     geklemmt. Deshalb warten, bis der Kasten scrollbar ist. */
  if (deepLinked) {
    var tries = 0;
    (function center() {
      var tile = listEl.querySelector('.wb__tile.is-sel');
      var box = tile && tile.closest('.wb__scroll');
      if (box && box.scrollHeight > box.clientHeight + 4) {
        var r = tile.getBoundingClientRect(), b = box.getBoundingClientRect();
        box.scrollTop += (r.top - b.top) - (b.height / 2 - r.height / 2);
        return;
      }
      if (tries++ < 20) requestAnimationFrame(center);
    })();
  }
})();
