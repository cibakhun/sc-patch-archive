# Deferred Items — Phase 15

Funde, die WAEHREND dieser Phase entdeckt, aber NICHT von der aktuellen
Task/Welle verursacht wurden (Scope-Grenze, siehe Executor-Regeln). Nicht
angefasst, hier nur protokolliert.

## `#holoact` ("Hologramm aktivieren") ist trotz `hidden` sichtbar unter 820px

**Gefunden:** 15-01, Task 3 (S-0-Bildschirmfotos, 18.08.2026).
**Datei:** `src/components/ShipDetail.astro` Z. 1334 (Markup), Kollision mit
`assets/mobile-ux.css` (globale Mobil-Regel).

**Befund:** `#holoact` traegt das `hidden`-Attribut und *keinen*
Klick-Listener (bestaetigt, `grep -n "holoact" src/components/ShipDetail.astro`
findet nur die eine Markup-Zeile) — laut `15-UI-SPEC.md` Detailvertrag Punkt 10
("Bekannte Fallstricke") soll er bereits inert/unsichtbar sein. Das stimmt
NICHT: `assets/mobile-ux.css` traegt eine sitweite Regel
`@media(max-width:820px){button,[role="button"],summary{display:inline-flex;...}}`
(Touch-Zielgroessen-Reset). Autor-CSS mit einer `display`-Deklaration schlaegt
IMMER die UA-Regel `[hidden]{display:none}` (unabhaengig von Spezifitaet,
andere Kaskadenebene) — derselbe Fallstrick, den `assets/account-dossier.css`
Z. 48-54 bereits kennt und dort mit `.dsr [hidden]{display:none!important}`
absichert. `#holoact` hat diese Absicherung nicht.

**Sichtbare Folge:** unter 820px zeigt jede Schiffsseite mit Hologramm-Daten
einen funktionslosen "HOLOGRAMM AKTIVIEREN"/"ACTIVATE HOLOGRAM"-Knopf mittig
auf der Buehne (Bildschirmfoto: `carrack-anvl-carrack_en_360_A-unselektiert`,
15-01 Task 3). Klick tut nichts.

**Warum nicht in dieser Welle behoben:** Weder Markup noch die CSS-Regel
gehoeren zu den Dateien dieses Tasks (P-1/P-2/P-3); die Regel in
`mobile-ux.css` ist site-weit und wirkt auf JEDEN Knopf mit `hidden`, ein
Fix dort braucht eine eigene Gegenprobe ueber alle betroffenen Seiten.
Ausserdem: `15-01-PLAN.md` <artifacts_this_phase_produces> listet
`.holo__activate`/`#holoact` bereits unter "Getilgt, nicht neu" — der Knopf
wird laut `15-UI-SPEC.md` Detailvertrag Punkt 7 in einer spaeteren Welle
(Ladeausloeser Klick->Scroll, D-04) ohnehin ERSATZLOS ENTFERNT. Ein
Zwischen-Fix waere Arbeit an Markup, das in Kuerze verschwindet.

**Empfehlung:** beim Umsetzen von Detailvertrag Punkt 7 (voraussichtlich
15-02) den Knopf entfernen wie dort beschrieben — kein separater Fix noetig,
kein Blocker fuer 15-01.
