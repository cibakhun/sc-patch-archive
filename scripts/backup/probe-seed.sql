-- ============================================================
-- probe-seed.sql — ERFUNDENE Daten fuer die Backup-Sonde.
--
-- Nur fuer .github/workflows/probe-backup.yml: ein lokaler Supabase-Stack,
-- aufgebaut aus supabase/migrations/, bekommt hier einen Bestand, der wie
-- Live aussieht (Konten mit Discord-Verknuepfung und zweitem Faktor,
-- Freundschaften, Nachrichten, Layouts, Rollen, Spenden, Zeilen in private),
-- aber keinen einzigen echten Datensatz enthaelt. Die Sonde sichert diesen
-- Stack mit denselben Skripten wie den Live-Lauf und spielt ihn in einen
-- zweiten, frischen Stack zurueck.
--
-- Die Konten entstehen vorher ueber die Admin-API des lokalen Auth-Dienstes
-- (probe-backup.yml), damit der Trigger on_auth_user_created wie live die
-- Profile anlegt. Hier wird nur ergaenzt.
-- ============================================================
set search_path = public;

do $$
declare
  ids uuid[];
  a uuid; b uuid; c uuid;
begin
  select array_agg(id order by email) into ids from auth.users where email like '%@probe.invalid';
  if coalesce(array_length(ids, 1), 0) < 3 then
    raise exception 'probe-seed: erwartet mindestens 3 Probe-Konten, gefunden %', coalesce(array_length(ids, 1), 0);
  end if;
  a := ids[1]; b := ids[2]; c := ids[3];

  -- Discord-Verknuepfung wie bei einer echten Anmeldung: der Trigger
  -- trg_sync_discord_identity spiegelt die ID nach discord_role_state.
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values ('100000000000000001', a,
          jsonb_build_object('sub', '100000000000000001', 'provider_id', '100000000000000001', 'full_name', 'probe_a'),
          'discord', now(), now(), now());

  -- zweiter Faktor (TOTP) fuer das Admin-Konto
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
  values (gen_random_uuid(), a, 'probe-totp', 'totp', 'verified', now(), now(), 'PROBEPROBEPROBEPROBEPROBEPROBE12');

  update profiles set handle = 'probe_' || substr(replace(id::text, '-', ''), 1, 6),
                      display_name = 'Probe ' || substr(id::text, 1, 4),
                      bio = 'Erfundenes Konto fuer die Backup-Sonde.'
   where id = any(ids);

  insert into user_roles (user_id, role) values (a, 'admin') on conflict do nothing;
  insert into tester_blocklist (user_id, reason) values (c, 'Probe: gesperrt');

  insert into favorites (user_id, kind, slug, label) values
    (a, 'ship', 'aegs-gladius', 'Gladius'), (a, 'item', 'fs-9', 'FS-9'), (b, 'ship', 'drak-cutlass-black', 'Cutlass');

  insert into hangar_layouts (user_id, id, rev, entry) values
    (a, 'probe1', 1, '{"id":"probe1","ship":"aegs-gladius","name":"Probe","slots":{"nose":"fs-9"}}'::jsonb),
    (b, 'probe2', 3, '{"id":"probe2","ship":"drak-cutlass-black","name":"Fracht","slots":{}}'::jsonb);

  insert into friends (user_id, friend_id) values (a, b), (b, a);
  insert into friend_requests (sender_id, receiver_id, status) values (c, a, 'pending');
  insert into direct_messages (sender_id, receiver_id, body) values
    (a, b, 'Hallo aus der Sonde'), (b, a, 'Antwort mit Umlauten: äöü ß und Tab	Zeichen');

  insert into refinery_jobs (user_id, station, method, items, input_scu, ready_at, status)
  values (a, 'ARC-L1', 'dinyx', '[{"ore":"quantanium","rawScu":12,"yieldScu":9.5}]'::jsonb, 12, now() + interval '2 hours', 'active');

  insert into mining_sig_presets (user_id, name, minerals, locations)
  values (b, 'Probe', array['quantanium','gold'], array['aberdeen']);

  insert into notification_settings (user_id, lang) values (a, 'de') on conflict do nothing;
  insert into crafting_entries (user_id, slug, owned, plan_qty) values (a, 'probe-blueprint', true, 2);

  insert into donations (stripe_event_id, amount_cents, currency, livemode)
  values ('evt_probe_1', 500, 'eur', false);

  insert into private.register_attempts (ip_hash) values ('probe-hash');
  insert into private.rsi_challenges (user_id, handle_key, rsi_handle, code) values (b, 'probe', 'Probe', 'VB-0A1B-2C3D-4E5F');
end $$;

-- Pruefobjekte ohne Gegenstueck auf Live: je ein Enum, eine Domain, ein
-- Composite-Typ und ein Aggregat im eigenen Schema, damit die Sonde auch
-- diese Katalog-Kategorien (typen, aggregate) einmal hin und zurueck traegt.
create type private.vb_probe_stufe as enum ('roh', 'fertig');
create domain private.vb_probe_kennung as text not null check (value ~ '^[a-z]+$');
create type private.vb_probe_paar as (menge int, einheit text);
create aggregate private.vb_probe_summe(int) (sfunc = int4pl, stype = int, initcond = '0');
