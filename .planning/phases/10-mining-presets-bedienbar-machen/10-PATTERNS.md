# Phase 10: Mining-Presets bedienbar machen - Pattern Map

**Kartiert:** 2026-08-15
**Analysierte Dateien:** 4 geänderte Bestandsdateien (kein Neubau)
**Analoga gefunden:** 4 / 4 (alle Muster liegen bereits im selben Repository, teils im selben Bauteil)

Diese Phase legt keine neuen Dateien an. Alle fünf Vorgaben aus CONTEXT.md
(D-01 bis D-07) werden durch Umbau bestehender Dateien umgesetzt. Entsprechend
liefert diese Pattern-Map für jede zu ändernde Stelle das **im Repository
bereits etablierte Vorbild**, nicht ein aus RESEARCH.md abgeleitetes
Wunschmuster.

## Dateiübersicht (geändert, keine Neuanlage)

| Datei | Rolle | Datenfluss | Nächstliegendes Vorbild | Trefferqualität |
|---|---|---|---|---|
| `src/components/MiningWorkbench.astro` | component (Astro-Markup + i18n-Objekte + inline CSS) | request-response (PostgREST) + reiner UI-Zustand | sich selbst (Preset-Leiste `wb-pre*`, Kacheln `.wb__tile`, Zeilen `.wb__pin-item`) | exakt — Muster liegt im selben Bauteil |
| `assets/mining-workbench.js` | utility/controller (Vanilla-JS, DOM-Rendering + Klick-Logik) | CRUD gegen `mining_sig_presets` via PostgREST | sich selbst (`preSave`/`preDrop`/`preFill`/`renderPins`/`renderLocPins`) | exakt |
| `src/i18n/help.ts` | config (statisches Text-/Hilfe-Objekt) | — | sich selbst (`mining.ctl.*`-Einträge) | exakt |
| `tests/e2e/mining-shortlist.test.js` + `tests/e2e/helpers/mining-dom.js` | test (e2e, Mock-DOM) | event-driven (`ctx.fire(el, 'click')`) | sich selbst (`selectMineral()`/`tilePinBtn()`-Helfer in derselben Datei) | exakt |

Alle vier Dateien sind **beide Rollen zugleich**: Ziel der Änderung UND
eigenes Vorbild für den Rest der Änderung. Für die im Auftrag ausdrücklich
angefragten Einzelmuster (PATCH-Call, Bestätigungs-UI, Listenzeile statt
`<select>`, Scroll-Box-Registrierung, e2e-Klick-Test) liegen die Vorbilder
zusätzlich in zwei Nachbarbauteilen (`assets/account-lite.js`,
`src/components/account/AccountDashboard.astro`).

## Pattern Assignments

### `assets/mining-workbench.js` — PATCH-Aufruf für das Umbenennen (D-02, Form 1)

**Analog:** `assets/account-lite.js`, Funktion `hbWrite()` (Zeilen 284-291),
aufbauend auf der generischen `rest()`-Hilfsfunktion (Zeilen 59-70).

`rest()` ist die einzige Stelle im Bestand, die PostgREST-Aufrufe mit
beliebiger HTTP-Methode baut — Header, `Prefer`-Vorgabe und Body-Serialisierung
liegen dort zentral:

```js
// assets/account-lite.js Zeilen 59-70
function rest(sess, method, path, body, prefer) {
  return fetch(SB_URL + '/rest/v1/' + path, {
    method: method,
    headers: {
      apikey: SB_KEY,
      Authorization: 'Bearer ' + sess.access_token,
      'Content-Type': 'application/json',
      Prefer: prefer || (method === 'POST' ? 'return=minimal' : 'count=none'),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
```

`window.VBAccount.rest` ist der öffentlich freigegebene Verweis darauf
(`assets/account-lite.js` Zeilen 82-86: `rest: rest, // Authentifizierter
PostgREST-Aufruf: rest(sess, 'GET', 'tabelle?select=*')`). `mining-workbench.js`
nutzt exakt diesen Weg bereits für den Upsert (`preSave()`, laut RESEARCH.md
Zeilen 419-437 mit `POST ... ?on_conflict=user_id,name`).

**Konkretes PATCH-Vorbild** (`hbWrite()`, `assets/account-lite.js`
Zeilen 284-291):

```js
function hbWrite() {
  ensureSession().then(function (sess) {
    if (!sess || !sess.user || !sess.user.id) return;
    rest(sess, 'PATCH', 'profiles?id=eq.' + sess.user.id, {
      last_seen: new Date().toISOString(),
      last_active: new Date(hbLastActivity).toISOString()
    }).catch(function () { /* noop */ });
  }).catch(function () { /* noop */ });
}
```

**Zu übertragendes Muster für das Umbenennen** (Zielort: neue Funktion,
z. B. `preRename(oldName, newName)` in `assets/mining-workbench.js`, neben
den bestehenden `preSave()`/`preDrop()`):

```js
window.VBAccount.rest(preSess, 'PATCH',
  'mining_sig_presets?name=eq.' + encodeURIComponent(oldName), { name: newName })
  .then(function (r) {
    if (r.status === 409) { preSay(T.presetNameTaken, 4000); return; }
    if (!r.ok) { preSay(T.presetFail, 4000); return; }
    preSay(T.presetSaved);
    return preLoad().then(function () { preFill(newName); });
  });
```

Abweichend von `hbWrite()`: `hbWrite()` schluckt Fehler bewusst still
(`.catch(function () {})`), weil ein Heartbeat unkritisch ist. Der
Umbenennen-Aufruf braucht dagegen die in `preSay()`/dem bestehenden
Preset-Fehlerpfad etablierte sichtbare Rückmeldung (409 → eigener
Text `presetNameTaken`, siehe unten unter „Geteilte Muster").

### `src/components/MiningWorkbench.astro` + `assets/mining-workbench.js` — Bestätigungsschritt vor dem Löschen (D-01)

**Analog:** `src/components/account/AccountDashboard.astro`,
Gefahrenzone-Formular `#deleteForm` (Zeilen ~340-354) — als Symbol- und
Farbvorbild, NICHT als 1:1-Mechanik-Vorbild (RESEARCH.md hält fest, dass die
dortige Tipp-Bestätigung für ein Preset zu schwer ist; nur das Trash-Icon und
die Rot/Gefahr-Sprache werden übernommen).

**Symbol-Vorbild** (`#ic-trash`, zweifach definiert im selben Sprite —
einmal im `<svg><defs>`-Block, einmal am Verwendungsort belegt):

```html
<!-- src/components/account/AccountDashboard.astro Zeile 351 (defs) -->
<g id="ic-trash" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/></g>

<!-- Zeile 661, Verwendung -->
<h3><svg viewBox="0 0 24 24" style="width:18px;height:18px"><use href="#ic-trash"/></svg> {COPY.secDanger}</h3>
```

`MiningWorkbench.astro` verwendet dasselbe `<use href="#…">`-Verweismuster
bereits für ein eigenes Icon (`#wb-i-pin`, siehe
`<svg class="wb__pin__i" aria-hidden="true" focusable="false"><use href="#wb-i-pin" /></svg>`,
im Bauteil vorhanden) — ein `#wb-i-trash`-Eintrag im selben `<defs>`-Stil des
Bauteils ist die konsistente Fortsetzung, keine neue Technik.

**Der zu ersetzende, fehlerhafte Bestandscode** (BEIDE Knöpfe teilen sich
Klasse und Ort — das ist der zu behebende Fehler, nicht das Vorbild):

```astro
<!-- src/components/MiningWorkbench.astro, Ausgangslage -->
Zeile 328  <button ... id="wb-pre-new" title={S.presetSave} ...>+</button>
Zeile 329  <button ... id="wb-pre-del" title={S.presetDel} ... disabled>×</button>   <!-- LÖSCHT ohne Rückfrage -->
...
Zeile 336  <button ... id="wb-pre-ok" class="... is-go" title={S.presetSave} ...>✓</button>
Zeile 337  <button ... id="wb-pre-cancel" title={S.presetCancel} ...>×</button>       <!-- bricht nur ab -->
```

```js
// assets/mining-workbench.js, Ausgangslage (Zeilen ~480-482)
preDel.addEventListener('click', function () {
  if (preSel.value) preDrop(preSel.value);   // keine Rückfrage
});
```

**Begründung gegen native Dialoge — bereits im selben Bauteil dokumentiert**
(Kommentar im Bestand, RESEARCH.md Zeilen 356-360 zitiert ihn): der
Editier-Zustand `wb-pre-edit` existiert ausdrücklich, „statt
`window.prompt()`: der Dialog ist in vielen Browsern unterdrückt, sieht
überall anders aus und lässt sich nicht beschriften". Dasselbe Argument gilt
gegen `window.confirm()` — **kein natives Fenster**, sondern ein weiterer
eigener Inline-Zustand nach demselben Muster wie `preMode(editing)`:

```js
// assets/mining-workbench.js, Vorbild fuer den Zustandswechsel
function preMode(editing) {
  if (!prePick) return;
  prePick.hidden = editing;
  preEdit.hidden = !editing;
  if (editing) { preName.value = preSel.value || ''; preName.focus(); preName.select(); }
}
```

Der Löschen-Bestätigungszustand ist als DRITTER `hidden`-umgeschalteter
Block nach demselben Muster zu bauen (nicht als `window.confirm()`), mit dem
Trash-Icon aus `#ic-trash` und einer eigenen Rot-Einfärbung über
`color-mix(in srgb, var(--accent) …)` (siehe „Geteilte Muster" unten —
keine Hex-Werte, das Bauteil verbietet eigene Farbtoken).

### `src/components/MiningWorkbench.astro` + `assets/mining-workbench.js` — Listenzeile statt `<select>` (D-05)

**Analog 1 — Auswahlzustand:** `.wb__tile` mit `is-sel`-Klasse
(`src/components/MiningWorkbench.astro` Zeile 253, CSS Zeile 479):

```astro
<div class={`wb__tile${m.name === sel.name ? ' is-sel' : ''}`} data-min={m.name} role="button" tabindex="0" title={m.name}>
  <span class="wb__tn" set:text={m.name} />
  <span class="wb__ts num" set:text={m.sig ? String(m.sig) : '—'} />
  <button type="button" class="wb__pin" data-pin={m.name} aria-pressed="false" aria-label={`${S.pin}: ${m.name}`}>
    <svg class="wb__pin__i" aria-hidden="true" focusable="false"><use href="#wb-i-pin" /></svg>
  </button>
</div>
```

```css
/* Zeile 479 */
.wb__tile.is-sel{background:color-mix(in srgb,var(--accent-2) 20%,transparent);
```

**Analog 2 — Name-plus-Aktion-Zeile (Löschknopf inline):**
`renderPins()` in `assets/mining-workbench.js` (Zeilen 298-317), CSS
`.wb__pin-item`/`.wb__pin-top` (Zeilen 621-626):

```js
// assets/mining-workbench.js Zeilen 298-317 (renderPins, vollstaendig als Bauform)
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
```

```css
/* Zeilen 621-626 */
.wb__pin-item{padding:7px 9px;margin:0 6px 3px;border-radius:8px;
.wb__pin-top{display:flex;align-items:center;gap:7px}
.wb__pin-top .nm{font-size:var(--fs-5);font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb__pin-top button{margin-left:auto;background:0;border:0;color:color-mix(in srgb,var(--muted) 80%,transparent);
```

**Zu übertragendes Muster:** Eine neue `renderPresetList()` (Vorbild
`renderPins()` als Textbaustein-Funktion, die `.innerHTML` per `.map().join('')`
setzt) erzeugt je Preset EINE `.wb__pin-item`-Zeile, ergänzt um die
`is-sel`-Klasse von `.wb__tile` für den aktuell gewählten Eintrag. Die
Zeile selbst wird klickbar (Klick = `preApply()`, analog zum
`role="button" tabindex="0"`-Muster der Kachel), der bestehende
`data-pin`-Lösch-Knopf-Platz wird zum neuen Umbenennen-/Löschen-Aktionspaar.

Ersetzt wird damit das bestehende `<select>`-Element:

```astro
<!-- Ausgangslage, src/components/MiningWorkbench.astro Zeile 325 -->
<select class="wb__pre__sel" id="wb-preset" ...>
```

### `tests/e2e/mining-shortlist.test.js` + `tests/e2e/helpers/mining-dom.js` — Klick auf Listenzeile statt `<select>.value` (Testfolge von D-05)

**Analog:** `selectMineral()` und `tilePinBtn()`, beide bereits in
`tests/e2e/mining-shortlist.test.js` (Zeilen 36-45 laut Grep) definiert und
im selben Test-File verwendet — sie treiben Klicks auf `.wb__tile`-Elemente
statt Werte zu setzen:

```js
// tests/e2e/mining-shortlist.test.js Zeilen 36-41
function selectMineral(ctx, name) {
  const tile = ctx.document.getElementById('wb-list').querySelectorAll('.wb__tile')
    .find((t) => t.getAttribute('data-min') === name);
  assert.ok(tile, `Kachel fuer "${name}" nicht im Mock-DOM gefunden`);
  ctx.fire(tile, 'click');
}
```

**Zu übertragendes Muster** für die sechs Testfälle, die heute
`ctx.elements['wb-preset'].value = '<Name>'` setzen (RESEARCH.md Vertiefung 7
listet die Zeilen: 108, 125, 202, 225/231, 282, 416): ein neuer Helfer
`selectPreset(ctx, name)` nach demselben Bauplan wie `selectMineral()`, der
statt `.wb__tile` die neue Preset-Zeilenklasse sucht (z. B. per
`data-preset="<Name>"`-Attribut, konsistent mit `data-min`/`data-pin` als
bestehende Attributnamenskonvention im selben Bauteil) und `ctx.fire(row,
'click')` auslöst. `tests/e2e/helpers/mining-dom.js` Zeile 335
(`root.appendChild(reg(mk('select', 'wb-preset')));`) muss auf das neue
Zeilen-Markup umgestellt werden — dasselbe Mock-Registrierungsmuster
(`reg(mk('div', 'wb-preset-list'))` o. ä.) wie für die anderen Container im
selben Helper.

## Geteilte Muster (Shared Patterns)

### PostgREST-Zugriff nur über `window.VBAccount.rest()`

**Quelle:** `assets/account-lite.js` Zeilen 59-70 (`rest()`) und
Zeilen 78-88 (`window.VBAccount`-Objekt).
**Anwenden auf:** jede neue Schreiboperation in `assets/mining-workbench.js`
(Umbenennen-PATCH, Einzeleintrag-Entfernen-PATCH). Kein `fetch()` direkt
aufrufen — immer über den zentralen Wrapper, der Header/Auth/Prefer bereits
korrekt setzt.

### Kein natives `window.confirm()`/`window.prompt()`

**Quelle:** Kommentar im Bestand über `wb-pre-edit`
(`src/components/MiningWorkbench.astro`, RESEARCH.md zitiert ihn wörtlich:
„Eigene Zeile statt `window.prompt()`: der Dialog ist in vielen Browsern
unterdrückt, sieht überall anders aus und lässt sich nicht beschriften").
**Anwenden auf:** die neue Löschen-Bestätigung (D-01) — eigener
Inline-Zustand nach dem `preMode(editing)`-Muster, kein Browser-Dialog.

### Farbtoken nur über `color-mix(in srgb, var(--accent) …)`

**Quelle:** durchgängig im Bauteil, z. B. `.wb__tile.is-sel` (Zeile 479)
und `.wb__scroll`-Registrierung in `assets/mobile-ux.css` (siehe unten).
**Anwenden auf:** jede neue Farbe (Löschen-Rot, Auswahlzustand der
Preset-Zeile) — keine Hex-Werte, wie im Bauteil-Kopfkommentar zu
„KEINE eigenen Farbtoken" gefordert.

### Scroll-Box-Registrierung ist bereits klassenbasiert erledigt

**Quelle:** `assets/mobile-ux.css` Zeilen 605-652 (Abschnitt „5d Eigener
Bildlaufbereich"), bestätigt durch Lesen:

```css
/* assets/mobile-ux.css Zeilen 605-621 (gekürzt um die anderen Praefixe) */
.vb-scrollbox,
...
/* Mining-Werkbank: VIER senkrechte Kaesten auf einer Seite (Mineralliste,
   Ansicht, Fundorte, Signaturen). Bewusst .wb__scroll statt .vb-scrollbox —
   dessen max-height:calc(100vh…) wuerde mit der Flex-Hoehe der Spalten
   kollidieren, die das Raster selbst setzt. */
.wb__scroll,
.wb__filters .tool-help__body,
/* Fracturing-Rechner (/fracturing.html) — dieselbe Bauart, eigener Praefix. */
.fc__scroll,
.fc__filters .tool-help__body {
  scrollbar-width: thin !important;
  scrollbar-color: color-mix(in srgb, var(--tone-1, var(--accent)) 55%, transparent) transparent;
}
.wb__scroll::-webkit-scrollbar, ... { display: block !important; width: 8px !important; height: 8px !important; background: transparent !important; }
.wb__scroll::-webkit-scrollbar-thumb, ... { background: color-mix(in srgb, var(--tone-1, var(--accent)) 55%, transparent); border-radius: 999px; }
```

**Anwenden auf:** die beiden gestapelten Listen aus D-03 (Signaturenliste,
Fundort-Merkliste) UND die neue Preset-Liste aus D-05, sofern sie selbst
scrollt. Solange jeder neue/umgebaute Kasten weiterhin `class="wb__scroll"`
trägt, ist **kein neuer Eintrag in `mobile-ux.css` nötig** — die
Registrierung ist bereits klassenbasiert, nicht instanzbasiert
(bestätigt durch obiges Zitat).

### `[hidden]`-Regel muss NACH der `display`-Regel stehen

**Quelle:** Bereits zweimal im selben Bauteil korrekt gelöst
(`.wb__pre__row[hidden]`, `.wb__tabpane[hidden]`), siehe RESEARCH.md
Pitfall 2.
**Anwenden auf:** jeden neuen `hidden`-umgeschalteten Zustand (Löschen-
Bestätigung, Umbenennen-Zeile in der neuen Preset-Liste).

### `.wb__pane{overflow:hidden}` verbietet Overlay-Positionierung

**Quelle:** Kommentar Zeilen 442-449 im Bauteil selbst; RESEARCH.md
Pitfall 1 bestätigt die Sackgasse als bereits einmal vorgeführt und
zurückgenommen.
**Anwenden auf:** die neue Preset-Liste (D-05) und den Löschen-
Bestätigungszustand — beide bleiben INNERHALB der Panel-Grenzen, keine
`position:absolute`-Ausklappung relativ zum `.wb__pane`.

## Ohne echten Übernahmefall

Keine Datei dieser Phase hat KEIN Vorbild — RESEARCH.md bestätigt
ausdrücklich (Abschnitt „Don't Hand-Roll" / „Key insight"), dass jede der
sieben Kernfragen mit einem bereits im Repository etablierten Baustein löst.
Die einzige offene Stelle ist keine Musterfrage, sondern eine
Produktentscheidung: **D-02, dritte Form** („einzelne Einträge entfernen,
ohne das Preset neu zu bauen") — RESEARCH.md hält zwei Lesarten offen
(Auto-Save vs. gezielter PATCH auf die gespeicherte Zeile direkt aus der
Preset-Listenzeile heraus) und empfiehlt Letzteres. Das technische Muster
dafür ist identisch mit dem Umbenennen-PATCH oben (`rest()`/`hbWrite()`-
Vorbild) — nur der Pfad-Query und der Body unterscheiden sich
(`?name=eq.<Name>` mit `{ minerals: [...] }` bzw. `{ locations: [...] }`
statt `{ name: newName }`).

## Metadata

**Analog-Suchbereich:** `assets/`, `src/components/`, `src/components/account/`,
`tests/e2e/` (per Grep auf konkrete Fundstellen aus RESEARCH.md, ergänzt um
gezielte Lesungen der genannten Zeilenbereiche).
**Gelesene Dateien:** `assets/account-lite.js`, `src/components/account/AccountDashboard.astro`,
`assets/mobile-ux.css`, `assets/mining-workbench.js`,
`src/components/MiningWorkbench.astro`, `tests/e2e/mining-shortlist.test.js`.
**Kartierungsdatum:** 2026-08-15
