-- Test: Sieht ein Nutzer die Daten eines anderen?
--
-- Ausführen: Supabase → SQL Editor → Inhalt einfügen → Run.
-- Legt zwei Test-Nutzer A und B an, spielt beide durch und macht am Ende alles
-- rückgängig (rollback). In deiner Datenbank bleibt nichts zurück.
--
-- Ergebnis:
--   "Alle Tests bestanden"     → alles in Ordnung
--   Fehler mit "FEHLER: ..."   → die Meldung sagt, was nicht stimmt

begin;

-- Zwei Test-Nutzer registrieren (löst den Trigger aus)
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-a@beispiel.de'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'test-b@beispiel.de');

-- 1. Wurden profiles und settings automatisch angelegt?
do $$
begin
  if (select count(*) from public.profiles
      where id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')) <> 2 then
    raise exception 'FEHLER: profiles-Einträge wurden nicht automatisch angelegt';
  end if;
  if (select count(*) from public.settings
      where user_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
        and report_threshold_sales = 30
        and report_threshold_revenue_cents = 200000) <> 2 then
    raise exception 'FEHLER: settings-Einträge mit Standard-Grenzen fehlen';
  end if;
  if (select count(*) from public.profiles
      where id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
        and subscription_status = 'trial'
        and trial_ends_at between now() + interval '7 days' - interval '1 minute'
                              and now() + interval '7 days' + interval '1 minute') <> 2 then
    raise exception 'FEHLER: Testphase (7 Tage) wird nicht gesetzt';
  end if;
end $$;

-- 2. Als Nutzer A anmelden und Daten anlegen
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
declare
  item_a uuid;
begin
  insert into public.items (name, item_type, purchase_price_cents)
    values ('Jacke von A', 'weiterverkauf', 500)
    returning id into item_a;
  insert into public.sales (item_id, platform, sale_price_cents)
    values (item_a, 'vinted', 2000);
  insert into public.receipts (item_id, file_path)
    values (item_a, 'a/beleg.jpg');
  -- Artikel-ID merken, damit B gleich versuchen kann, darauf zuzugreifen
  perform set_config('test.item_a', item_a::text, true);
end $$;

-- 3. Als Nutzer B anmelden und versuchen, an A's Daten zu kommen
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

do $$
declare
  item_a uuid := current_setting('test.item_a')::uuid;
  n integer;
begin
  -- Lesen
  if exists (select 1 from public.items) then
    raise exception 'FEHLER: B sieht Artikel von A';
  end if;
  if exists (select 1 from public.sales) then
    raise exception 'FEHLER: B sieht Verkäufe von A';
  end if;
  if exists (select 1 from public.receipts) then
    raise exception 'FEHLER: B sieht Belege von A';
  end if;
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'FEHLER: B sieht fremde Profile';
  end if;
  if (select count(*) from public.settings) <> 1 then
    raise exception 'FEHLER: B sieht fremde Einstellungen';
  end if;

  -- Ändern und Löschen
  update public.items set name = 'gehackt' where id = item_a;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FEHLER: B konnte Artikel von A ändern'; end if;

  delete from public.items where id = item_a;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FEHLER: B konnte Artikel von A löschen'; end if;

  update public.settings set report_threshold_sales = 999
    where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FEHLER: B konnte Einstellungen von A ändern'; end if;

  -- Eigenen Abo-Status freischalten darf niemand
  update public.profiles set subscription_status = 'active';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FEHLER: Nutzer kann seinen Abo-Status selbst ändern'; end if;

  -- Artikel im Namen von A anlegen
  begin
    insert into public.items (user_id, name, item_type)
      values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'untergeschoben', 'weiterverkauf');
    raise exception 'FEHLER: B konnte einen Artikel für A anlegen';
  exception when insufficient_privilege then null;
  end;

  -- Verkauf bzw. Beleg an A's Artikel hängen
  begin
    -- cancelled = true, damit nur die Nutzer-Prüfung greift, nicht die Regel "ein aktiver Verkauf"
    insert into public.sales (item_id, platform, sale_price_cents, cancelled)
      values (item_a, 'ebay', 100, true);
    raise exception 'FEHLER: B konnte einen Verkauf an A''s Artikel hängen';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.receipts (item_id, file_path) values (item_a, 'b/beleg.jpg');
    raise exception 'FEHLER: B konnte einen Beleg an A''s Artikel hängen';
  exception when foreign_key_violation then null;
  end;
end $$;

-- 4. A sieht seine Daten weiterhin unverändert
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.items where name = 'Jacke von A') <> 1 then
    raise exception 'FEHLER: A sieht seinen eigenen Artikel nicht (mehr)';
  end if;
  if (select count(*) from public.sales) <> 1 or (select count(*) from public.receipts) <> 1 then
    raise exception 'FEHLER: A sieht seinen Verkauf oder Beleg nicht';
  end if;
  if (select report_threshold_sales from public.settings) <> 30 then
    raise exception 'FEHLER: Einstellungen von A wurden verändert';
  end if;
end $$;

-- 5. Nicht angemeldete Besucher sehen gar nichts
reset role;
set local role anon;

do $$
begin
  begin
    perform 1 from public.items;
    raise exception 'FEHLER: Nicht angemeldete Besucher können Artikel abfragen';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
rollback;

select 'Alle Tests bestanden' as ergebnis;
