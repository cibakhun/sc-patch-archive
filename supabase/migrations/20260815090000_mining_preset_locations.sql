-- Mining-Werkbank: Fundort-Merkliste ans bestehende Preset-System anhaengen.
--
-- Phase 9 baut die Mitte der Werkbank auf eine Spalte um und gibt der
-- Signaturenliste einen zweiten Reiter fuer angeheftete Fundort-Paare
-- („Erz — Fundort"). Der Betreiber hat ausdruecklich EIN gemeinsames
-- Preset-System verlangt (CONTEXT.md D-04): ein Preset traegt Signaturen
-- UND Fundorte, ein Wechsel tauscht beide Listen zugleich (D-07).
--
-- WARUM eine neue Spalte an der BESTEHENDEN Tabelle und nicht eine zweite
-- Tabelle oder ein drittes Schluesselfeld:
--   1. Verlustfreiheit schlaegt die saubere Trennung. `add column ...
--      default '{}'::text[]` fuellt Postgres bei JEDER bestehenden Zeile
--      ohne Tabellenumbau — Nutzer haben dort bereits Signaturen-Sets
--      liegen (Migration 20260812040000), und die bleiben zeichengleich
--      gueltig. Eine getrennte Preset-Liste je Reiter haette ein drittes
--      Feld (etwa `kind`) IM Primaerschluessel gebraucht: Schluessel
--      abbauen, Bestand nachtragen, Schluessel neu setzen — drei Schritte
--      an fremden Nutzerdaten statt einem.
--   2. RLS wirkt auf Tabellenebene. Die vier bestehenden Politiken
--      (select/insert/update/delete „own") decken die neue Spalte
--      automatisch ab — keine neue Politik, keine neue Tabelle, kein
--      zweiter Weg an den bestehenden Politiken vorbei.
--   3. Die Schreibstrecke bleibt EIN Upsert (siehe assets/mining-workbench.js
--      preSave()). Zwei Listen in zwei Zeilen koennten teilweise scheitern
--      und einen halben Zustand hinterlassen.
--
-- Eintragsformat: "<Erz>||<Fundort>", derselbe Trenner, mit dem
-- scripts/verify-mining.mjs (Zeile 68) die beiden Fundort-Sichten bereits
-- gegeneinander haelt. Gemessen (15.08.2026): keiner der 37 Mineralnamen
-- und keiner der 45 Fundortnamen enthaelt heute ein „|" — Task 3 dieses
-- Plans macht daraus einen Dauerwaechter in verify:mining.
--
-- ⚠ DIESE DATEI WIRD NICHT AUTOMATISCH ANGEWANDT. Die Migrationen dieses
-- Projekts wendet der Betreiber von Hand gegen `trgjhmbnodoarnfmlcqx` an.
-- Faellt die Anwendung vorerst aus, laeuft die Oberflaeche weiter: ein
-- fehlendes oder leeres `locations`-Feld ergibt beim Laden eine leere
-- Merkliste, keinen Fehler (D-04) — siehe preLoad() in
-- assets/mining-workbench.js.
alter table public.mining_sig_presets
  add column if not exists locations text[] not null default '{}'::text[];

alter table public.mining_sig_presets
  drop constraint if exists mining_sig_presets_locations_len;
alter table public.mining_sig_presets
  add constraint mining_sig_presets_locations_len
  check (array_length(locations, 1) is null or array_length(locations, 1) <= 128);

comment on column public.mining_sig_presets.locations is
  'Angeheftete Fundort-Paare des Presets. Eintragsformat "<Erz>||<Fundort>" — derselbe Trenner wie scripts/verify-mining.mjs. Leer bei Presets, die vor dieser Spalte gespeichert wurden.';
