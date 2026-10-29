-- Raffinerie-Auftraege: Form der Eintraege festlegen (29.10.2026).
-- Noch NICHT live eingespielt; der Hauptstrang spielt sie nach Freigabe durch
-- den Betreiber ein.
--
-- WAS SICH AENDERT: public.refinery_jobs bekommt drei CHECK-Regeln zu den
-- bestehenden (items ist ein Array, method 1-60 und station 1-80 Zeichen,
-- status active/done, Betraege >= 0):
--   refinery_jobs_items_shape   items hat hoechstens 30 Eintraege und
--                               hoechstens 8000 Zeichen; jeder Eintrag ist
--                               ein Objekt, ore (falls da) ist ein Text ohne
--                               < oder >, rawScu/yieldScu (falls da) sind
--                               Zahlen.
--   refinery_jobs_method_text   method ohne < oder >
--   refinery_jobs_station_text  station ohne < oder >
--
-- WARUM: items ist jsonb, und bisher prueften die Regeln nur, DASS es ein
-- Array ist, nicht, was darin steht. Das Dashboard schreibt immer
-- {ore: <Name aus der Liste>, rawScu: <Zahl>, yieldScu: <Zahl>}; Methode und
-- Station kommen aus festen Listen (assets/refinery-data.json: 9 Methoden,
-- 20 Stationen, 26 Erze, hoechstens 31 Zeichen, keines enthaelt < oder >).
-- Die Seite selbst gibt diese Werte seit derselben Aenderung nur noch als
-- Text aus (RefineryDashboard.astro); die Regeln hier halten zusaetzlich den
-- Bestand in der Form, die jede Ausgabe erwartet.
--
-- Die Typpruefung laeuft im strict-Modus von jsonpath: im lax-Modus wird ein
-- verschachteltes Array automatisch ausgepackt, und ein Wert wie
-- {"ore": [["…"]]} saehe fuer eine reine Musterpruefung wie Text aus.
-- .type() meldet dagegen "array", und strict packt nichts aus. Fehler
-- INNERHALB eines Filters (fehlender Schluessel, Muster auf Nicht-Text)
-- werden zu "unbekannt" und waehlen nichts aus; deshalb steht die
-- Typpruefung von ore als eigene Bedingung neben dem Muster. Das CASE haelt
-- jsonb_array_length von einem Nicht-Array fern (sonst Fehler 22023 statt
-- einer sauberen Regelverletzung).
--
-- WAS ES FUER DIE SEITE BEDEUTET: nichts, solange das Dashboard schreibt, was
-- es heute schreibt. Ein Eintrag, der die Regeln verletzt, wird mit 23514
-- (check_violation) abgelehnt; das Formular zeigt dann seinen normalen
-- Fehlerhinweis. Rechte, Policies und Spalten bleiben unveraendert, es
-- entsteht kein neues Objekt (keine Default-Privilegien-Falle).
--
-- Bestand: die Regeln gelten auch fuer vorhandene Zeilen. Verletzt eine
-- davon die Regeln, bricht die Migration als Ganzes ab und aendert nichts.

alter table public.refinery_jobs
  add constraint refinery_jobs_items_shape check (
    case
      when jsonb_typeof(items) is distinct from 'array' then false
      else jsonb_array_length(items) <= 30
        and octet_length(items::text) <= 8000
        and not jsonb_path_exists(items, 'strict $[*] ? (@.type() != "object")')
        and not jsonb_path_exists(items, 'strict $[*] ? (exists (@.ore) && @.ore.type() != "string")')
        and not jsonb_path_exists(items, 'strict $[*] ? (@.ore like_regex "[<>]")')
        and not jsonb_path_exists(items, 'strict $[*] ? (exists (@.rawScu) && @.rawScu.type() != "number")')
        and not jsonb_path_exists(items, 'strict $[*] ? (exists (@.yieldScu) && @.yieldScu.type() != "number")')
    end
  ),
  add constraint refinery_jobs_method_text check (method !~ '[<>]'),
  add constraint refinery_jobs_station_text check (station !~ '[<>]');
