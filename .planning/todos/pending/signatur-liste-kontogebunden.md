---
title: "Angeheftete Signatur-Minerale kontogebunden speichern (Tabelle + RLS)"
date: 2026-08-11
priority: medium
context: "Voraussetzung für die rechte Spalte der Mining-Werkbank"
---

# Angeheftete Signatur-Minerale kontogebunden speichern

## Warum

Die rechte Spalte der neuen Mining-Werkbank ist eine **von Hand kuratierte**
Signaturliste (Entscheidung 3 in `.planning/notes/mining-werkbank-redesign.md`).
Heute lebt diese Auswahl nur im `localStorage` des Browsers
(`SignatureIdentifier.astro:1-8`) — sie ist damit gerätegebunden und geht beim
Leeren des Browsers verloren. Nutzerwunsch: **kontogebunden.**

## Was zu tun ist

1. **Supabase-Tabelle** für angeheftete Minerale, Schlüssel = Mineral-Name bzw.
   sauberer Slug (nicht der DataCore-GUID — der wechselt mit dem Patch).
   RLS-Politik modelliert nach `favorites` (dasselbe Muster nutzt bereits das
   Refinery-Dashboard).
2. **Doppel-Ablage im Frontend** exakt wie in `assets/crafting-app.js:212`:
   nicht angemeldet → `localStorage` (Gast-Ablage), angemeldet → Konto,
   Gast-Marker für die Übernahme beim ersten Anmelden. `VB.session()` +
   `vb-account-session`-Ereignis sind dort schon verdrahtet.
3. Kein `supabase-js` auf der Mining-Seite — die Themen-/Werkzeugseiten nutzen
   `assets/account-lite.js`.
4. Migration in `supabase/` ablegen, damit sie nachvollziehbar bleibt.

## Vorsicht

- **Schlüssel = Name/Slug, nicht Index und nicht GUID.** Bei Crafting war genau
  das der dokumentierte Fehler: der DB-Index verschiebt sich mit jedem Rebuild
  (`crafting-app.js:33`).
- Die **Rig-Leiste** (Laser/Module/Gadget/Refinery, Entscheidung 2) ist ebenfalls
  kontogebunden gewünscht — sinnvollerweise in derselben Runde mitdenken, aber
  es ist ein anderer Datensatz (eine Einstellung, keine Liste).

## Fertig, wenn

- Anheften/Lösen überlebt einen Geräte-Wechsel bei angemeldetem Konto.
- Anheften funktioniert **ohne** Konto weiter (Gast-Ablage), und die Gast-Auswahl
  wandert beim Anmelden genau einmal ins Konto.
- RLS geprüft: fremde Zeilen sind weder les- noch schreibbar.
