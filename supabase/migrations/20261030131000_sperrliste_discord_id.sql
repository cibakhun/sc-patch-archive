-- Testpilot-Sperrliste auch nach Discord-ID (30.10.2026). Noch NICHT live
-- eingespielt; der Hauptstrang spielt sie nach Freigabe durch den Betreiber
-- ein, NACH 20261030130000_discord_trennen_raeumt_auf.sql.
--
-- AUSGANGSLAGE: public.tester_blocklist kannte nur die Konto-ID, mit
-- ON DELETE CASCADE auf auth.users. Ein gesperrtes Konto, das sich selbst
-- loeschte, nahm seinen Sperreintrag mit; ein neues Konto mit demselben
-- Discord-Konto bekam vom Bot die Testpilot-Rolle wieder gespiegelt und kam
-- durchs Tor (gate_verdict prueft nur Konto-ID).
--
-- WAS SICH AENDERT
--   1. tester_blocklist bekommt discord_user_id und einen eigenen
--      Primaerschluessel id (uuid). user_id bleibt eindeutig, wird aber
--      nullbar; der Fremdschluessel auf auth.users wechselt von CASCADE auf
--      SET NULL.
--   2. Kaskade beim Loeschen eines Kontos, Absicht:
--        * Eintrag MIT Discord-ID: bleibt stehen, user_id wird null. Die
--          Sperre haengt ab dann an der Discord-ID.
--        * Eintrag OHNE Discord-ID: verschwindet mit dem Konto wie bisher
--          (Trigger tester_blocklist_drop_empty), weil er nichts mehr sperren
--          kann.
--   3. Die Discord-ID kommt automatisch dazu: beim Eintragen aus der
--      gepruefen Identitaet (auth.identities, sonst discord_role_state;
--      Trigger tester_blocklist_fill_discord), und wenn ein gesperrtes Konto
--      Discord erst spaeter verbindet (sync_discord_identity, eigener
--      abgesicherter Block).
--   4. gate_verdict sperrt, wenn die Konto-ID ODER eine mit dem Konto
--      verbundene Discord-Identitaet auf der Liste steht. Admins gehen weiter
--      vor (Betreiberentscheidung 20.08.2026, WINDOWS.md id 39).
--   5. sync_discord_identity setzt is_tester auf false, wenn sich die
--      gespiegelte Discord-ID aendert (die Rolle gehoerte dem alten
--      Discord-Konto; der Bot spiegelt sie fuer das neue beim naechsten
--      Abgleich).
--
-- SPERREN BLEIBT EIN HANDGRIFF DES BETREIBERS (SQL, service_role):
--   insert into public.tester_blocklist (user_id, reason) values ('<uuid>', '<Grund>');
-- discord_user_id fuellt der Trigger. Nur eine Discord-ID sperren:
--   insert into public.tester_blocklist (discord_user_id, reason) values ('<id>', '<Grund>');
--
-- WAS ES FUER DIE SEITE BEDEUTET: nichts Sichtbares. Fuer Clients bleibt die
-- Tabelle unsichtbar (RLS ohne Policy). Datenschutz: die Discord-ID eines
-- gesperrten Kontos bleibt nach dessen Loeschung als Sperrgrund gespeichert;
-- das gehoert in die Datenschutzerklaerung (Hinweis an den Betreiber).
-- Live am 29.10.2026 gezaehlt: 0 Eintraege.

-- -------------------------------------------- 1. Tabelle --------------------
alter table public.tester_blocklist
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists discord_user_id text;

alter table public.tester_blocklist drop constraint if exists tester_blocklist_pkey;
alter table public.tester_blocklist add constraint tester_blocklist_pkey primary key (id);
alter table public.tester_blocklist alter column user_id drop not null;
alter table public.tester_blocklist add constraint tester_blocklist_user_id_key unique (user_id);
alter table public.tester_blocklist drop constraint if exists tester_blocklist_user_id_fkey;
alter table public.tester_blocklist
  add constraint tester_blocklist_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
create index if not exists idx_tester_blocklist_discord_user_id
  on public.tester_blocklist (discord_user_id)
  where discord_user_id is not null;

comment on column public.tester_blocklist.discord_user_id is
  'Discord-ID des gesperrten Kontos. Fuellt der Trigger tester_blocklist_fill_discord '
  'beim Eintragen bzw. sync_discord_identity beim spaeteren Verbinden. Bleibt nach '
  'der Loeschung des Kontos stehen (user_id wird null); gate_verdict sperrt jedes '
  'Konto, das diese Discord-ID verbindet.';

-- -------------------------------------------- 2. Trigger an der Tabelle -----
create or replace function public.tester_blocklist_fill_discord()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.discord_user_id is null and new.user_id is not null then
    select coalesce(
             (select i.provider_id from auth.identities i
               where i.user_id = new.user_id and i.provider = 'discord'
               order by i.created_at desc nulls last limit 1),
             (select d.discord_user_id from public.discord_role_state d
               where d.user_id = new.user_id))
      into new.discord_user_id;
  end if;
  return new;
end;
$$;

create or replace function public.tester_blocklist_drop_empty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tester_blocklist where id = new.id;
  return null;
end;
$$;

revoke all on function public.tester_blocklist_fill_discord() from public, anon, authenticated;
revoke all on function public.tester_blocklist_drop_empty() from public, anon, authenticated;

drop trigger if exists trg_tester_blocklist_fill_discord on public.tester_blocklist;
create trigger trg_tester_blocklist_fill_discord
  before insert or update of user_id, discord_user_id on public.tester_blocklist
  for each row execute function public.tester_blocklist_fill_discord();

drop trigger if exists trg_tester_blocklist_drop_empty on public.tester_blocklist;
create trigger trg_tester_blocklist_drop_empty
  after update on public.tester_blocklist
  for each row
  when (new.user_id is null and new.discord_user_id is null)
  execute function public.tester_blocklist_drop_empty();

-- Bestehende Eintraege einmal ergaenzen (feuert den Fill-Trigger).
update public.tester_blocklist set user_id = user_id where discord_user_id is null and user_id is not null;

-- -------------------------------------------- 3. gate_verdict ---------------
-- Live-Fassung (pg_get_functiondef, 29.10.2026), geaendert nur Schritt 3.
create or replace function public.gate_verdict()
returns json
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_uid    uuid := auth.uid();
  v_reason text;
begin
  -- 1. Keine Sitzung -> kein Zugang.
  if v_uid is null then
    return json_build_object('allowed', false, 'grund', 'keine-sitzung');
  end if;

  -- 2. Admin-Aussperr-Riegel (D-04) -- haengt an keiner Discord-Bedingung UND
  --    seit dem 20.08. auch an keinem Sperrlisteneintrag.
  if exists (
    select 1 from public.user_roles
    where user_id = v_uid and role = 'admin'
  ) then
    v_reason := 'admin';

  -- 3. Sperrliste (D-10) -- Sofort-Rauswurf fuer alle ausser Admins. Greift
  --    an der Konto-ID und seit dem 30.10. auch an jeder Discord-Identitaet,
  --    die das Konto gerade verbunden hat.
  elsif exists (
    select 1 from public.tester_blocklist b
    where b.user_id = v_uid
       or (b.discord_user_id is not null and b.discord_user_id in (
             select i.provider_id from auth.identities i
             where i.user_id = v_uid and i.provider = 'discord'))
  ) then
    return json_build_object('allowed', false, 'grund', 'gesperrt');

  -- 4. Discord-Testpilot-Rolle (D-03/D-08).
  elsif exists (
    select 1 from public.discord_role_state
    where user_id = v_uid and is_tester = true
  ) then
    v_reason := 'tester';
  else
    return json_build_object('allowed', false, 'grund', 'kein-testpilot');
  end if;

  insert into public.discord_role_state (user_id, last_staging_seen)
  values (v_uid, now())
  on conflict (user_id) do update
    set last_staging_seen = excluded.last_staging_seen;

  return json_build_object(
    'allowed', true,
    'grund', v_reason,
    'sub', v_uid,
    'exp_hint', 300
  );
end;
$function$;

-- -------------------------------------------- 4. sync_discord_identity ------
-- Live-Fassung (pg_get_functiondef, 29.10.2026). Geaendert: is_tester faellt
-- beim Wechsel der Discord-ID, und ein Sperreintrag des Kontos bekommt die
-- Discord-ID nachgetragen. Alles andere wortgleich.
create or replace function public.sync_discord_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.provider <> 'discord' then
    return new;
  end if;

  if new.provider_id is null then
    return new;
  end if;

  begin
    insert into public.discord_role_state (user_id, discord_user_id)
    values (new.user_id, new.provider_id)
    on conflict (user_id) do update
      set discord_user_id = excluded.discord_user_id,
          is_tester = case
            when discord_role_state.discord_user_id is distinct from excluded.discord_user_id then false
            else discord_role_state.is_tester
          end;
  exception
    when unique_violation then
      raise exception 'Dieser Discord-Account ist bereits mit einem anderen Konto verknuepft.'
        using errcode = 'unique_violation',
              hint = 'discord_role_state.discord_user_id ist bereits an ein anderes Konto gebunden';
    when foreign_key_violation then
      raise warning 'sync_discord_identity: FK-Verletzung beim Spiegeln von user_id %, Identitaet wird trotzdem angelegt', new.user_id;
    when others then
      raise warning 'sync_discord_identity: unerwarteter Fehler beim Spiegeln von user_id %: %', new.user_id, sqlerrm;
  end;

  -- Steht das Konto auf der Sperrliste, haengt die Sperre ab jetzt auch an
  -- dieser Discord-ID. Ein Fehler hier darf das Verbinden nie verhindern.
  begin
    update public.tester_blocklist
       set discord_user_id = new.provider_id
     where user_id = new.user_id
       and discord_user_id is null;
  exception
    when others then
      raise warning 'sync_discord_identity: Sperrliste fuer user_id % nicht ergaenzt: %', new.user_id, sqlerrm;
  end;

  return new;
end;
$function$;

-- ============================================================================
-- RUECKBAU (Eintraege mit user_id = null gehen dabei verloren, sie lassen sich
-- in der alten Form nicht halten):
--   drop trigger if exists trg_tester_blocklist_drop_empty on public.tester_blocklist;
--   drop trigger if exists trg_tester_blocklist_fill_discord on public.tester_blocklist;
--   drop function if exists public.tester_blocklist_drop_empty();
--   drop function if exists public.tester_blocklist_fill_discord();
--   delete from public.tester_blocklist where user_id is null;
--   alter table public.tester_blocklist drop constraint tester_blocklist_user_id_fkey;
--   alter table public.tester_blocklist add constraint tester_blocklist_user_id_fkey
--     foreign key (user_id) references auth.users(id) on delete cascade;
--   alter table public.tester_blocklist drop constraint tester_blocklist_pkey;
--   alter table public.tester_blocklist drop constraint tester_blocklist_user_id_key;
--   alter table public.tester_blocklist alter column user_id set not null;
--   alter table public.tester_blocklist add constraint tester_blocklist_pkey primary key (user_id);
--   alter table public.tester_blocklist drop column id, drop column discord_user_id;
--   gate_verdict und sync_discord_identity: die Live-Fassungen von vor
--   dieser Migration erneut einspielen (vor dem Einspielen per
--   pg_get_functiondef sichern). Im Repo stehen sie in
--   20260820210000_admin_schlaegt_sperrliste.sql bzw.
--   20260818000000_discord_tester_gate.sql (nach der Umbenennung auf die
--   Live-Versionen: 20260821071105_... bzw. 20260817192747_...).
-- ============================================================================
