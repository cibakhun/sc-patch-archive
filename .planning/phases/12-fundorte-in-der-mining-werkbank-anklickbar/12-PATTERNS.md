# Phase 12: Fundorte in der Mining-Werkbank anklickbar - Pattern Map

**Kartiert:** 2026-08-15
**Analysierte Dateien:** 4 (alle bestehend — diese Phase legt keine neue Datei an)
**Analoga gefunden:** 4 / 4 (jedes Analog liegt IN der jeweils zu ändernden Datei selbst)

> Besonderheit dieser Phase: Es gibt keine "neuen Dateien" im üblichen Sinn.
> Jede Änderung landet in einer Datei, die bereits eine strukturell identische
> Nachbarfunktion enthält. Die folgende Karte zeigt deshalb für jede Änderung
> die konkrete Nachbarstelle, deren Form zu kopieren ist — nicht ein fremdes
> Modul.

## File Classification

| Zu ändernde Datei | Rolle | Datenfluss | Analog (dieselbe Datei) | Trefferqualität |
|---|---|---|---|---|
| `assets/mining-workbench.js` | Client-Controller (ES5-IIFE, kein Build) | event-driven (delegierter Klick) + request-response (Deep-Link) | `row2()` (Z. 212-225), delegierter `document`-Click-Handler (Z. 767-897), `fromQuery()` (Z. 920-927) | exakt |
| `src/components/MiningWorkbench.astro` | Astro-Komponente: Markup-Gerüst + inline `<style>` + Payload-Bau | server-render (baut `payload`, keine Laufzeit-Logik) | `.wb__tile`-Markup (Z. 296-302), `S_DE`/`S_EN` (Z. 140-193), SVG-Sprite (Z. 235-263), `.wb__id`/`.wb__idrow`-Kopf (Z. 317-335) | exakt |
| `src/i18n/help.ts` | i18n-Konstanten (Werkzeug-Hilfe) | CRUD (Text-Nachschlag über Schlüssel) | `mining.ctl.locpin`/`mining.ctl.shortlist`, je DE (Z. 99-100) und EN (Z. 304-305) | exakt (bestehende Schlüssel werden inhaltlich korrigiert, keine neuen) |
| `tests/e2e/helpers/mining-dom.js` + `tests/e2e/mining-shortlist.test.js` | Test-Fixture (Mock-DOM) + e2e-Test | request-response (synchroner Rundlauf gegen Mock-VM) | `makeMiningDomContext()` (Z. 309-419), `buildPayload()` (Z. 197-265), `tilePinBtn()`/`fire()`-Nutzung in den Tests | exakt — **muss laut RESEARCH.md explizit in die Datei-Liste jedes Plans**, sonst droht dieselbe Blocking-Deviation wie in 09-01/09-02/10-02 |

## Pattern Assignments

### `assets/mining-workbench.js` — Fundort-Index, Ansichtsumschaltung, Klick, Deep-Link

**Analog 1 — `byName`-Index als Vorbild für `locIndex`** (Z. 27-28):
```javascript
var byName = {};
for (var i = 0; i < D.minerals.length; i++) byName[D.minerals[i].name] = D.minerals[i];
```
Muss identisch bleiben: Aufbau-Ort (gleich nach `T`/`LS`, vor allen Funktionsdefinitionen, einmalig beim IIFE-Start), Schleifenform (`for`, kein `Array.forEach`, ES5). Legitim anders: `locIndex` gruppiert (ein Ortsname → Liste von Einträgen), `byName` bildet 1:1 ab — der Aufbau iteriert daher zusätzlich über `m.locs[]` (siehe RESEARCH.md Pattern 2, Code-Beispiel Z. 490-504). **Kein `DB.bodies` senden** — der Index wird ausschließlich aus `D.minerals[].locs[]` abgeleitet (0 zusätzliche Payload-Bytes, mit `verify-mining.mjs` Zusicherung 9 garantiert deckungsgleich mit `bodies[]`).

**Analog 2 — `row2(main, sub, barPct, right, amber, mark, pinKey)` und der optionale 7. Parameter** (Z. 208-225):
```javascript
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
```
Aufrufstellen zum Vergleich (dieselbe Funktion, zwei Aufrufweisen):
- Fundort-Zeile, **7-stellig** (Z. 275): `row2(locName(l), sub ? ort + ' · ' + sub : ort, bar, pctRight(l), false, false, m.name + '||' + l.p)`
- Stationszeile, **6-stellig, kein `pinKey`** (Z. 296-297): `row2(r.n, r.s + ' · ' + (mine ? T.yourPick : T.yieldMod), Math.abs(r.y) / maxAbs * 100, (r.y > 0 ? '+' : '') + r.y + ' %', r.y >= 0, mine)`

Muss identisch bleiben: `row2()` selbst wird **nicht** verändert — die neuen Erzzeilen der Fundort-Ansicht rufen sie **6-stellig** auf (kein `pinKey`, da an einem Fundort kein einzelnes Erz "angeheftet" werden kann — UI-SPEC Abschnitt 2). Für die Zeilen-Klickbarkeit selbst (D-01/D-02) reicht `row2()` nicht — dafür braucht es ein neues Wrapper-Attribut (`data-loc="…"` / `data-ore="…"`) auf dem von `row2()` erzeugten `.wb__row2`-Div, analog zum `pinKey`-Mechanismus, aber ein zusätzliches Argument bzw. ein Post-Processing-Schritt, da `row2()` selbst kein Attribut auf dem äußeren Div setzt. Legitim anders: Signatur von `row2()` wird ggf. um einen 8. Parameter erweitert ODER der Aufrufer hängt das Attribut nach dem `row2()`-Aufruf String-seitig an — RESEARCH.md Assumption A1 lässt das ausdrücklich offen (Planer-Ermessen).

**Analog 3 — Reihenfolge im delegierten Klick-Handler entscheidet Konflikte, nicht `stopPropagation()`** (Z. 849-875, drei bereits im Code laufende Präzedenzfälle):
```javascript
/* ⚠ Reihenfolge ist Pflicht: [data-locpin] MUSS vor [data-pin] geprueft
   werden. Die bestehende [data-pin]-Abfrage behandelt jedes Element mit
   data-pin gleich — landete ein Fundort-Paar dort, wanderte es in die
   Signaturenliste statt in die Merkliste. */
var lp = t.closest('[data-locpin]');
if (lp) {
  var lk = lp.getAttribute('data-locpin'), lat = S.locPins.indexOf(lk);
  if (lat >= 0) { S.locPins.splice(lat, 1); }
  else {
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
```
Muss identisch bleiben: **Reihenfolge**. Der neue `[data-loc]`/`[data-ore]`-Zweig gehört **nach** `[data-locpin]` (die Nadel bleibt vorrangig — D-01-Nebenbedingung) und **vor** dem generischen `.wb__tile`-Zweig; jeder Treffer endet mit `return`, kein Durchfallen. Kein `stopPropagation()` — nirgends im Bestand verwendet, RESEARCH.md nennt das explizit als Anti-Pattern. Legitim anders: der neue Zweig prüft `t.closest('[data-loc]')` bzw. `t.closest('[data-ore]')` statt eines bestehenden Attributs.

**Analog 4 — Deep-Link `?mineral=`, Vorlage für `?fundort=`** (Z. 920-927):
```javascript
var deepLinked = false;
(function fromQuery() {
  var want;
  try { want = new URLSearchParams(location.search).get('mineral'); } catch (e) { return; }
  if (!want) return;
  var key = want.trim().toLowerCase();
  for (var n in byName) if (n.toLowerCase() === key) { S.sel = n; deepLinked = true; return; }
})();
```
Muss identisch bleiben: `try/catch` um `URLSearchParams`, `trim().toLowerCase()`-Vergleich, Allow-List-Abgleich gegen **bekannte Schlüssel** (hier `locIndex`-Schlüssel statt `byName`), niemals der rohe Query-Wert ins DOM. Ein unbekannter Wert fällt **still** auf die Erz-Ansicht zurück — keine neue Fehlermeldung (UI-SPEC Copywriting Contract, Zeile "Error state"). Legitim anders: `S.view`/`S.selLoc` statt `S.sel` wird gesetzt (neues Zustandsfeld, siehe unten); kein Scroll-Zentrieren nötig, weil die Fundort-Ansicht bei `scrollTop:0` neu gezeichnet wird, nicht zu einer bestehenden Zeile scrollt (RESEARCH.md Open Question 3).

**Zustand `S` erweitern** (Z. 67):
```javascript
var S = { sel: D.minerals[0].name, pins: [], locPins: [], ref: 0, q: '', sys: null };
```
Neues Feld (z. B. `S.view`/`S.selLoc`) ergänzt diese Zeile. Muss identisch bleiben: Objekt-Literal-Stil, keine Klasse. Legitim anders/Ermessen: Feldname; **nicht** in `save()`/`localStorage` aufnehmen (Z. 82-86) — dieselbe Nichtpersistenz wie bei `?mineral=` heute (CONTEXT.md "Claudes Ermessen").

**Zweite Zeichenfunktion neben `renderDetail()`** (Z. 227-336 ist die einzige bestehende Zeichenroutine der Mittelspalte; `renderPins()` Z. 338-364 und `renderLocPins()` Z. 371-404 sind die nächstliegenden Vorbilder für "eine weitere `render*()`-Funktion, die per `$(id).innerHTML = …` einen Kasten neu zeichnet"). RESEARCH.md/CONTEXT.md empfehlen `renderLocation()` als eigene Funktion neben `renderDetail()`, aufgerufen aus `renderAll()` (Z. 406) abhängig von `S.view`. Das ist der einzige Verzweigungspunkt, den `renderAll()` heute schon hat — dort ist die Stelle, um zwischen `renderDetail()` und `renderLocation()` zu wählen.

**Keyboard-Aktivierung** (Z. 899-907) — heute ausschließlich für `.wb__tile`:
```javascript
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (!inWb(e.target)) return;
  var tile = e.target.closest('.wb__tile');
  if (!tile) return;
  e.preventDefault();
  S.sel = tile.getAttribute('data-min');
  renderAll();
});
```
Muss identisch bleiben: derselbe `document`-`keydown`-Listener, derselbe `inWb()`-Wächter, derselbe `Enter`/`Space`-Test, `e.preventDefault()` vor der Zustandsänderung. Neue klickbare Zeilen (`.wb__row2[data-loc]`/`[data-ore]`) brauchen einen zusätzlichen `closest()`-Zweig in genau diesem Handler (oder eine Erweiterung der bestehenden `if`-Kette) — **kein zweiter `keydown`-Listener**.

---

### `src/components/MiningWorkbench.astro` — Kopf-Markup, S_DE/S_EN, SVG-Sprite

**Analog 1 — Ganze Kachel klickbar, verschachtelter Knopf bleibt eigenständig** (Z. 296-301), der Präzedenzfall, dem `.wb__row2[data-loc]` folgen muss:
```astro
<div class={`wb__tile${m.name === sel.name ? ' is-sel' : ''}`} data-min={m.name} role="button" tabindex="0" title={m.name}>
  <span class="wb__tn" set:text={m.name} />
  <span class="wb__ts num" set:text={m.sig ? String(m.sig) : '—'} />
  <button type="button" class="wb__pin" data-pin={m.name} aria-pressed="false" aria-label={`${S.pin}: ${m.name}`}>
    <svg class="wb__pin__i" aria-hidden="true" focusable="false"><use href="#wb-i-pin" /></svg>
  </button>
</div>
```
Muss identisch bleiben: `role="button" tabindex="0"` auf dem äußeren, ganzflächig klickbaren Element; der verschachtelte `<button>` bleibt ein eigenständiges `<button type="button">` mit eigenem `data-*`-Attribut, kein `<a>`, kein zweites `role`. `.wb__row2[data-loc]`/`[data-ore]` bekommt exakt dieselben zwei Attribute (`role="button" tabindex="0"`) — UI-SPEC Abschnitt 1 zieht diesen Vergleich ausdrücklich. Da `row2()` in `mining-workbench.js` (nicht in `.astro`) generiert, muss dort dieselbe Attributkombination in den String-Templates ergänzt werden, nicht hier.

**Analog 2 — `S_DE`/`S_EN` als Paar mit Build-Zeit-Paritätsprüfung** (Z. 140-213):
```typescript
const S_DE = {
  minerals: 'Minerale', view: 'Ansicht', signatures: 'Signaturen', locations: 'Fundorte',
  // …
};
const S_EN = {
  minerals: 'Minerals', view: 'View', signatures: 'Signatures', locations: 'Locations',
  // …
};
function assertMiningLangParity(): void {
  const deKeys = Object.keys(S_DE);
  const enKeys = Object.keys(S_EN);
  // … wirft bei Abweichung
}
assertMiningLangParity();
```
Muss identisch bleiben: jeder neue Schlüssel (z. B. `backToOre`, `trace`) MUSS in **beiden** Objekten stehen, sonst bricht `npm run build`. Reihenfolge/Gruppierung ist beliebig, aber die Parität ist nicht verhandelbar. Legitim anders: konkrete Schlüsselnamen — CONTEXT.md nennt das ausdrücklich als Ermessen. UI-SPEC liefert Wortlaut-Vorschläge (Zurück-Knopf, "Spur"-Abzeichen).

**Analog 3 — SVG-`<symbol>` in der Sprite und `<use href="#…">`-Aufrufstelle** (Z. 235-263 Definition, Z. 300 Aufruf):
```astro
<svg class="wb__sprite" aria-hidden="true" focusable="false" width="0" height="0">
  <symbol id="wb-i-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.5 3h5M11 3v6.2L7.4 13h9.2L13 9.2V3M12 13v8" />
  </symbol>
  <!-- … weitere <symbol>-Einträge … -->
</svg>
```
Aufruf: `<svg class="wb__pin__i" aria-hidden="true" focusable="false"><use href="#wb-i-pin" /></svg>`.
Muss identisch bleiben: `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"` (dieselbe Stilfamilie für alle Symbole), ein Kommentar direkt über dem neuen `<symbol>`, der Zweck und Praezedenz nennt (jedes bestehende Symbol hat einen). Neues Symbol laut UI-SPEC: `#wb-i-back` (Zurück-Pfeil), Pfadvorschlag `M11 4 4 12l7 8M4 12h16`. Legitim anders: der exakte Pfad `d`-Wert (Design-Freiheit, Stilfamilie bindend laut UI-SPEC).

**Analog 4 — `.wb__id`/`.wb__idrow`-Kopf als struktureller Ersatz, nicht Zusatzblock** (Z. 317-335):
```astro
<div class="wb__id">
  <div class="wb__idrow">
    <div class="wb__idl">
      <h2 id="wb-name" set:text={sel.name} />
      <div class="wb__tags" id="wb-tags"></div>
    </div>
    <div class="wb__sigbox"> … </div>
    <button type="button" class="wb__pinbig" id="wb-pinsel" aria-pressed="false" data-help={hlp('pinbtn')}> … </button>
  </div>
</div>
```
Muss identisch bleiben: Padding `11px 14px 9px` an `.wb__id`, `display:flex;align-items:flex-start;gap:10px` an `.wb__idrow` (Z. 554-555 CSS) — **exakt übernehmen, nicht vergrößern** (Pitfall 6, `--wb-chrome:236px`-Budget). Legitim anders (D-11): der Fundort-Kopf ersetzt `.wb__sigbox` + `.wb__pinbig` durch **nichts** (kein Platzhalter) und stellt links einen neuen Zurück-Knopf in `.wb__pin`-Bauform (28×28, NICHT toggle-artig, kein `is-on`/`aria-pressed`) vor den Textblock.

**CSS-Dämpfung für Spurenzeilen — `color`, nicht `background`** (Kopfkommentar Z. 40-42 des Stilblocks referenziert in CONTEXT.md/RESEARCH.md; konkrete Zielregeln laut UI-SPEC Abschnitt 5):
```css
.wb__row2.is-trace .p{color:color-mix(in srgb,var(--text) 62%,transparent)}
.wb__row2.is-trace .s{color:color-mix(in srgb,var(--muted) 65%,transparent)}
.wb__row2.is-trace em{color:color-mix(in srgb,var(--muted) 65%,transparent)}
.wb__row2.is-trace .wb__bar{opacity:.6}
```
Muss identisch bleiben: **niemals** `background`/`background-color` für die Dämpfung verwenden — `build-light-overrides.mjs` (`PROPS`, Zeile 85) deckt das nicht ab, der Hellmodus bekäme lautlos keine Entsprechung (Pitfall 3, mehrfach in dieser Codebasis dokumentiert). Die Zeilen-**Fläche** (`background` von `.wb__row2`) bleibt unverändert. Legitim anders: die exakten Prozentwerte (62/65 %) sind Ausgangspunkt, kein Freigabewert — vor Auslieferung an echten Bildpunkten messen (≥ 4,5:1 in beiden Farbmodi).

---

### `src/i18n/help.ts` — bestehende Schlüssel inhaltlich nachziehen (Pitfall 1)

**Analog — DE/EN-Paar, das heute falsch ist und aktualisiert werden MUSS** (DE Z. 99-100, EN Z. 304-305):
```typescript
// DE (Zeile 99-100)
'mining.ctl.locpin': 'Heftet einen Fundort an die Fundort-Merkliste darunter — dieselbe Nadel wie bei den Erzen.',
'mining.ctl.shortlist': 'Die angehefteten Fundorte über alle Erze hinweg, als „Erz — Fundort".',
// EN (Zeile 304-305)
'mining.ctl.locpin': 'Pins a location to the shortlist underneath — same pin as on the ore.',
'mining.ctl.shortlist': 'The pinned locations across every ore, as "Ore — Location".',
```
Muss identisch bleiben: Schlüsselnamen (`mining.ctl.locpin`, `mining.ctl.shortlist`) — **keine neuen Schlüssel**, nur der Wert wird korrigiert, weil die Fundort-Zeile jetzt zwei Bedeutungen trägt (Öffnen der Fundort-Ansicht UND Anheften über die Nadel). UI-SPEC liefert den Wortlaut-Vorschlag beider Sprachen (Copywriting Contract, Zeile `mining.ctl.locpin`/`mining.ctl.shortlist`). ⚠ `verify-help.mjs` prüft nur, dass der Anker existiert und nicht leer ist — **nicht**, dass der Text stimmt (Pitfall 1). Gegenlesen ist Pflicht.

---

### `tests/e2e/helpers/mining-dom.js` + `tests/e2e/mining-shortlist.test.js` — Mock-DOM, MUSS in jedem Plan explizit gelistet sein

**Was diese Datei mockt** (bestätigt gegen den Code):
- `document.getElementById`/`querySelector(All)` über ein eigenes `MockElement` (Import aus `dom-mock.js`), plus lokal ergänztem `closest()` (Z. 51-76), das exakt die Selektor-Formen abdeckt, die `mining-workbench.js` tatsächlich benutzt (`'.wb'`, `'[data-pin]'`, `'.wb__tile'`, `'[data-sys]'`, `'[data-seg]'`, `'[data-locpin]'`, seit Phase 10 zusätzlich `'[data-preset]'` etc. — Z. 12-15). **Für Phase 12 müssen `'[data-loc]'`/`'[data-ore]'` und jede neue ID (`wb-loc-name`, Zurück-Knopf-ID o. ä.) hier registriert werden**, sonst liefert `document.getElementById()` `null` und das Skript wirft.
- `window.VBAccount`-Attrappe mit In-Memory-Rundlauf für `mining_sig_presets` (Z. 121-194) — von dieser Phase nicht berührt, bleibt unverändert.
- `buildPayload()` (Z. 197-265) — **Zweitschreibung** des Astro-Payloads, absichtlich unabhängig von `MiningWorkbench.astro` aufgebaut (Kommentar Z. 36-39: "ein Fehler in der Astro-Nutzlast soll sich hier nicht hinter derselben Quelle verstecken können"). Trägt bereits `l.mi`/`l.ms`/`l.ch`/`l.ef` — die Felder, die der `locIndex`-Aufbau braucht, sind also **bereits im Mock-Payload vorhanden**, es muss nur die Sprach-Platzhalter-Tabelle (`t`, Z. 226-251) um neue Schlüssel ergänzt werden (z. B. `backToOre: 'BACK'`, `trace: 'TRACE'`), analog zum bestehenden Muster `chance: 'CHANCE'`.
- `makeMiningDomContext()` (Z. 309-419) registriert jedes Markup-Element von Hand über `reg(mk(tag, id, className))`. **Neue IDs der Fundort-Ansicht müssen hier als eigene `reg(mk(...))`-Zeilen ergänzt werden**, im Stil der bestehenden Blöcke ("Mitte — Kopf + Fundorte + Beste Stationen + Verweise", Z. 338-349).
- `fire(el, type)` (Z. 391-394) — feuert erst das Element-Event, dann das delegierte Dokument-Event; Testfälle rufen es als `ctx.fire(tile, 'click')` (Beispiel Z. 40 in `mining-shortlist.test.js`).

**Muss identisch bleiben:** die Fixture bleibt **eigenständig** (kein gemeinsamer Import mit `MiningWorkbench.astro`) — das ist eine bewusste Entscheidung (Zweitschreibung als Fehlerabsicherung), keine Abkürzung. Neue Test-IDs/-Attribute folgen demselben `reg(mk(...))`-Muster.
**Warnzeichen bei Auslassung (dreifach belegt, 09-01/09-02/10-02):** `node --test tests/e2e/mining-shortlist.test.js` schlägt mit `Cannot read properties of null` fehl, sobald ein Testfall die neue Fundort-Ansicht simuliert, falls `mining-dom.js` nicht mitgezogen wurde.

**Test-Aufrufmuster (Vorlage für neue Fälle)** — Klick auf ein registriertes Element und Weiterlauf-Assert, z. B. Z. 40 und 610 in `mining-shortlist.test.js`:
```javascript
ctx.fire(tile, 'click');
// …
ctx.fire(tilePinBtn(ctx, 'Gold'), 'click');
```
Für neue Fälle (Zeilenklick auf `.wb__row2[data-loc]`, Zurück-Pfeil, `?fundort=`-Deep-Link) gilt dasselbe Muster: Element aus `ctx.elements`/`ctx.root.querySelector(...)` holen, `ctx.fire(el, 'click')`, danach Zustand über `ctx.elements[...]`/`ctx.root.querySelector(...)` prüfen — kein neuer Assert-Stil nötig.

---

## Shared Patterns

### Escaping bei jeder Text-Ausgabe
**Quelle:** `esc()` (`assets/mining-workbench.js:89-93`)
```javascript
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
```
**Gilt für:** jeden neuen Render-Pfad (Fundort-Kopf, Erzzeilen, "Spur"-Abzeichen) — genau wie `renderDetail()`/`renderLocPins()` es heute tun. Ortsnamen und Erznamen laufen durch `esc()`, bevor sie in `innerHTML`/Template-Strings landen.

### Deep-Link-Sicherheit — Allow-List, nie Rohtext ins DOM
**Quelle:** `fromQuery()` (`assets/mining-workbench.js:920-927`), siehe Analog 4 oben.
**Gilt für:** `?fundort=` genau wie für `?mineral=` — Abgleich gegen bekannte `locIndex`-Schlüssel, case-insensitive, der rohe `want`-Wert wird nur als Vergleichsschlüssel benutzt, nie gerendert.

### Delegierter `document`-Click-Handler statt mehrerer Listener
**Quelle:** `assets/mining-workbench.js:767-897` (ein einziger Listener), `inWb(t)`-Wächter Z. 765.
**Gilt für:** jeden neuen Klick-Zweig (Fundort-Zeile, Erzzeile in der Fundort-Ansicht, Zurück-Pfeil) — kein zweiter `document.addEventListener('click', …)`, kein `stopPropagation()`.

### `S_DE`/`S_EN`-Parität ist ein Build-Gate
**Quelle:** `assertMiningLangParity()` (`src/components/MiningWorkbench.astro:199-213`).
**Gilt für:** jeden neuen Text dieser Phase (Zurück-Knopf-Label, "Spur"-Abzeichen, `mining.ctl.locpin`/`shortlist`-Korrektur zieht keinen neuen Schlüssel nach sich, aber jeder tatsächlich neue Schlüssel muss in beiden Objekten stehen).

### Dämpfung über `color`/`opacity`, nie `background`
**Quelle:** Kopfkommentar `MiningWorkbench.astro` Z. 40-42 ("Zustandsfarben über `currentColor` + `color`"), `PROPS`-Konstante in `scripts/build-light-overrides.mjs:85` (deckt kein `background` ab).
**Gilt für:** die Spurenzeilen-Dämpfung (D-07) — verbindlich, nicht optional; ein Verstoß bleibt im Hellmodus unbemerkt grün, weil kein Tor das prüft.

## No Analog Found

Keine — jede Änderung dieser Phase hat ein direktes, bereits ausgeliefertes Vorbild in derselben Datei. Es gibt keine Datei, für die ein fremdes Analog nötig wäre.

## Metadata

**Analog-Suchraum:** `assets/mining-workbench.js`, `src/components/MiningWorkbench.astro`, `src/i18n/help.ts`, `tests/e2e/helpers/mining-dom.js`, `tests/e2e/mining-shortlist.test.js` — alle fünf vollständig gelesen (kein Ausschnitt).
**Dateien gescannt:** 5 (0 externe Analoga nötig — alle Muster sind Bestandteil derselben Dateien)
**Kartierungsdatum:** 2026-08-15
