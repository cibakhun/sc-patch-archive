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

  var S = { sel: D.minerals[0].name, pins: [], locPins: [], ref: 0, q: '', sys: null };
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

  var $ = function (id) { return document.getElementById(id); };
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
  function pctRight(l) {
    return (l.ch != null ? nPct(l.ch) + ' %' : '—') +
      (l.ms != null ? ' · ' + T.upTo + ' ' + nPct(l.ms) + ' %' : '');
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
     ("Taranite (Raw)"), der Katalog fuehrt den sauberen Namen. */
  function yieldFor(profId, name) {
    var prof = D.profiles[profId];
    if (!prof) return null;
    var keys = [name, name + ' (Ore)', name + ' (Raw)', name + ' (Pure)'];
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
    for (var i = 0; i < tiles.length; i++) {
      var el = tiles[i], m = byName[el.getAttribute('data-min')];
      if (!m) continue;
      var hit = !q || m.name.toLowerCase().indexOf(q) >= 0 ||
        m.locs.some(function (l) { return (l.p || '').toLowerCase().indexOf(q) >= 0; });
      if (hit && S.sys) hit = m.systems.indexOf(S.sys) >= 0;
      el.style.display = hit ? '' : 'none';
      el.classList.toggle('is-sel', m.name === S.sel);
      /* Der Zustand steckt in der Klasse, nicht im Zeichen: das Symbol bleibt
         stehen, nur die Flaeche faerbt sich (wie bei .wb__chip.is-on). Fuer
         Screenreader traegt ihn aria-pressed — ein Umschalter, kein Link. */
      var pin = el.querySelector('.wb__pin'), on = S.pins.indexOf(m.name) >= 0;
      pin.classList.toggle('is-on', on);
      pin.setAttribute('aria-pressed', String(on));
      pin.setAttribute('aria-label', (on ? T.unpin : T.pin) + ': ' + m.name);
      if (hit) shown++;
    }
    $('wb-count').textContent = shown === D.minerals.length ? String(shown) : shown + '/' + D.minerals.length;
  }

  /* Siebter Parameter pinKey (optional): NUR der Fundort-Aufruf uebergibt
     ihn. Die drei Stations-Aufrufe (#wb-refs) und der Ersatzeintrag der
     gewaehlten Station bleiben sechsstellig — sie bekommen dadurch keinen
     Nadelknopf (D-05, Nebenbedingung 2 der Phase). */
  function row2(main, sub, barPct, right, amber, mark, pinKey) {
    var pin = '';
    if (pinKey) {
      var pinOn = S.locPins.indexOf(pinKey) >= 0;
      pin = '<button type="button" class="wb__lpin' + (pinOn ? ' is-on' : '') + '" data-locpin="' + esc(pinKey) +
        '" aria-pressed="' + pinOn + '" aria-label="' + esc((pinOn ? T.unpin : T.pin) + ': ' + pinKey.replace('||', ' — ')) +
        '"><svg class="wb__lpin__i" aria-hidden="true" focusable="false"><use href="#wb-i-pin" /></svg></button>';
    }
    return '<div class="wb__row2' + (mark ? ' is-pick' : '') + '"><span><span class="p">' + esc(main) + '</span>' +
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
      '<span class="wb__tag">' + esc(methodLabel(m.method)) + '</span>' +
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
          return row2(l.p, l.s, bar, pctRight(l), false, false, m.name + '||' + l.p);
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

  function renderPins() {
    var scan = parseInt(($('wb-scan').value || '').replace(/[^0-9]/g, ''), 10);
    if (!S.pins.length) {
      $('wb-pins').innerHTML = '<p class="wb__empty">' + esc(T.pinHint) + '</p>';
      return;
    }
    $('wb-pins').innerHTML = S.pins.map(function (name) {
      var m = byName[name];
      if (!m || !m.sig) return '';
      var max = MAXCLUSTER[m.rarity] || 4, mult = '';
      for (var k = 1; k <= max; k++) {
        var val = k * m.sig, hit = scan && Math.abs(val - scan) / scan <= 0.10;
        mult += '<i class="' + (hit ? 'is-hit' : '') + '" title="×' + k + '">' + NF.format(val) + '</i>';
      }
      return '<div class="wb__pin-item"><div class="wb__pin-top">' +
        '<span class="nm">' + esc(m.name) + '</span>' +
        '<button type="button" data-pin="' + esc(m.name) + '" aria-label="' + esc(T.unpin + ': ' + m.name) + '">×</button>' +
        '</div><div class="wb__mult">' + mult + '</div></div>';
    }).join('');
  }

  /* Die Fundort-Merkliste im zweiten Reiter — erz-uebergreifend (D-06).
     Eintrag "Erz — Fundort" mit Geviertstrich, derselbe ×-Knopf traegt dasselbe
     data-locpin wie die Nadel in der Fundort-Zeile: EIN Attribut, zwei
     Richtungen (Praezedenz: data-pin bei den Signaturen). */
  function renderLocPins() {
    var box = $('wb-locpins');
    /* Zaehler in der Reiter-Beschriftung, Form wie #wb-loch: Beschriftung,
       Trennpunkt, Zahl -- nur sobald mindestens ein Paar angeheftet ist. Guard
       gegen fehlendes Element, wie ueberall sonst in dieser Datei ($()===null). */
    var tabBtn = $('wb-tab-loc');
    if (tabBtn) tabBtn.textContent = T.locations + (S.locPins.length ? ' · ' + S.locPins.length : '');
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
      var meta = l
        ? '<div class="wb__lmeta"><span>' + esc(l.s || '') + '</span><em>' + esc(pctRight(l)) + '</em></div>'
        : '';
      return '<div class="wb__pin-item"><div class="wb__pin-top">' +
        '<span class="nm">' + esc(label) + '</span>' +
        '<button type="button" data-locpin="' + esc(pair) + '" aria-label="' + esc(T.unpin + ': ' + label) + '">×</button>' +
        '</div>' + meta + '</div>';
    }).join('');
  }

  function renderAll() { renderList(); renderDetail(); renderPins(); renderLocPins(); renderPresetList(); save(); }

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
     Eindeutigkeitsverletzung, die PostgREST als HTTP 409 meldet. */
  var TBL = 'mining_sig_presets';
  var preList = $('wb-preset-list'), prePick = $('wb-pre-pick'), preEdit = $('wb-pre-edit');
  var preMsg = $('wb-pre-msg'), preGuest = $('wb-pre-guest'), preName = $('wb-pre-name');
  var preLogin = $('wb-pre-login');
  var presets = [];   // [{name, minerals, locations}]
  var preSess = null; // gueltige Session oder null (= Gast)
  var preCur = '';    // Name der aktuell markierten Zeile (is-sel)
  var preEditFor = null; // null = Neuanlage, sonst der alte Name beim Umbenennen
  var preAsk = null;  // Name der Zeile mit offener Loesch-Rueckfrage (D-01), sonst null
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
      /* Traegt die Zeile die offene Loesch-Rueckfrage (D-01), ersetzt eine
         volle Zeilenbreite beschriftete Schaltflaeche die gesamte
         Aktionszeile -- die einzige Aktion im Bauteil mit Worten statt
         eines Zeichens, an einem anderen Ort als jedes ×. */
      var head;
      if (preAsk === p.name) {
        head = '<button type="button" class="wb__pre-ask" data-pre-delok="1">' + esc(T.presetDelAsk) + '</button>';
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
          '<button type="button" class="wb__pre-a" data-pre-update="1" aria-label="' + esc(T.presetUpdate) + '">' +
            '<svg aria-hidden="true" focusable="false"><use href="#wb-i-save" /></svg>' +
          '</button>' +
          '<button type="button" class="wb__pre-a" data-pre-rename="1" aria-label="' + esc(T.presetRename) + '">' +
            '<svg aria-hidden="true" focusable="false"><use href="#wb-i-edit" /></svg>' +
          '</button>' +
          '<button type="button" class="wb__pre-a wb__pre-a--del" data-pre-del="1" aria-label="' + esc(T.presetDel) + '">' +
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
  function preRemoveEntry(name, field, value) {
    var preset = null;
    for (var i = 0; i < presets.length; i++) if (presets[i].name === name) { preset = presets[i]; break; }
    if (!preset) return;
    var next = (preset[field] || []).filter(function (v) { return v !== value; });
    var body = {};
    body[field] = next;
    return window.VBAccount.rest(preSess, 'PATCH', TBL + '?name=eq.' + encodeURIComponent(name), body)
      .then(function (r) {
        if (!r.ok) { preSay(T.presetFail, 4000); return; }
        preSay(T.presetSaved);
        return preLoad();
      })
      .catch(function () { preSay(T.presetFail, 4000); });
  }
  function preDrop(name) {
    return window.VBAccount.rest(preSess, 'DELETE', TBL + '?name=eq.' + encodeURIComponent(name))
      .then(function (r) {
        if (!r.ok) { preSay(T.presetFail, 4000); return; }
        preSay(T.presetDeleted);
        preCur = '';
        return preLoad();
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
    return window.VBAccount.rest(preSess, 'PATCH',
      TBL + '?name=eq.' + encodeURIComponent(oldName), { name: newName })
      .then(function (r) {
        if (r.status === 409) { preSay(T.presetNameTaken, 4000); return; }
        if (!r.ok) { preSay(T.presetFail, 4000); return; }
        preSay(T.presetRenamed);
        if (preCur === oldName) preCur = newName;
        return preLoad();
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

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!inWb(t)) return;
    /* Loesch-Rueckfrage (D-01) zuerst, noch vor Umbenennen/Auswahl: der
       zweite, bestaetigende Klick loescht; der erste verwandelt den
       Muelleimer nur in eine beschriftete Zeile, ohne Netzwerkaufruf. */
    var delOk = t.closest('[data-pre-delok]');
    if (delOk) {
      var delRow = delOk.closest('[data-preset]');
      preAsk = null;
      if (delRow) preDrop(delRow.getAttribute('data-preset'));
      return;
    }
    var delAsk = t.closest('[data-pre-del]');
    if (delAsk) {
      var askRow = delAsk.closest('[data-preset]');
      preAsk = askRow ? askRow.getAttribute('data-preset') : null;
      renderPresetList();
      return;
    }
    /* Ein Klick daneben bricht die Rueckfrage ab, laeuft aber normal weiter
       (kein return hier) — der Klick kann z.B. gleichzeitig ein anderes
       Preset auswaehlen. ⚠ Der Handler steigt oben mit `if (!inWb(t)) return;`
       aus; ein Klick voellig ausserhalb der Werkbank laesst die Rueckfrage
       bewusst stehen — sie verlangt ohnehin einen zweiten, gezielten Klick,
       und ein Handler, der bei jedem Seitenklick neu zeichnet, waere teurer
       als der gewonnene Komfort. */
    if (preAsk) { preAsk = null; renderPresetList(); }
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
    /* Ueberschreiben (D-02, Form 2): preSave() schreibt den AKTUELLEN
       Arbeitsstand unter demselben Namen per Upsert -- das IST bereits
       "ueberschreiben", nur die Rueckmeldung unterscheidet sich von
       "neu angelegt". */
    var updateBtn = t.closest('[data-pre-update]');
    if (updateBtn) {
      var updateRow = updateBtn.closest('[data-preset]');
      if (updateRow) preSave(updateRow.getAttribute('data-preset'), T.presetUpdated);
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
    var pin = t.closest('[data-pin]');
    if (pin) {
      var pn = pin.getAttribute('data-pin'), at = S.pins.indexOf(pn);
      if (at >= 0) S.pins.splice(at, 1); else S.pins.push(pn);
      renderAll(); return;
    }
    var tile = t.closest('.wb__tile');
    if (tile) { S.sel = tile.getAttribute('data-min'); renderAll(); return; }
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
    /* Reiterleiste Signaturen/Fundorte rechts — eigenes Attribut data-tab,
       bewusst nicht data-seg (das gehoert der mobilen Segmentleiste oben und
       wuerde dort kollidieren). */
    var tab = t.closest('[data-tab]');
    if (tab) {
      var tk = tab.getAttribute('data-tab');
      var sigPane = $('wb-sig-pane'), locPane = $('wb-loc-pane');
      var sigTab = $('wb-tab-sig'), locTab = $('wb-tab-loc');
      if (sigPane) sigPane.hidden = tk !== 'sig';
      if (locPane) locPane.hidden = tk !== 'loc';
      if (sigTab) { sigTab.classList.toggle('is-on', tk === 'sig'); sigTab.setAttribute('aria-selected', String(tk === 'sig')); }
      if (locTab) { locTab.classList.toggle('is-on', tk === 'loc'); locTab.setAttribute('aria-selected', String(tk === 'loc')); }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!inWb(e.target)) return;
    var tile = e.target.closest('.wb__tile');
    if (!tile) return;
    e.preventDefault();
    S.sel = tile.getAttribute('data-min');
    renderAll();
  });

  document.addEventListener('change', function (e) {
    if (e.target.id === 'wb-ref') { S.ref = +e.target.value; renderDetail(); save(); }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'wb-q') { S.q = e.target.value; renderList(); }
    else if (e.target.id === 'wb-scan') { renderPins(); }
  });

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
