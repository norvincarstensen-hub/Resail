-- Test: Konto löschen
--
-- Ausführen: Supabase → SQL Editor → Inhalt einfügen → Run.
-- Legt zwei Test-Nutzer an, A löscht sein Konto, B bleibt unberührt.
-- Am Ende wird alles rückgängig gemacht.
--
-- Ergebnis:
--   "Konto-Tests bestanden"  → alles in Ordnung
--   Fehler mit "FEHLER: ..." → die Meldung sagt, was nicht stimmt

begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-a@beispiel.de'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'test-b@beispiel.de');

set local role authenticated;

-- A und B legen je einen Artikel mit Verkauf und Beleg an
do $$
declare
  u text;
  item uuid;
begin
  foreach u in array array['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    insert into public.items (name, item_type, status) values ('Testartikel', 'weiterverkauf', 'gelistet')
      returning id into item;
    insert into public.sales (item_id, platform, sale_price_cents) values (item, 'vinted', 1000);
    insert into public.receipts (item_id, file_path) values (item, u || '/' || item || '/beleg.jpg');
  end loop;
end $$;

-- A löscht sein Konto
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select public.delete_my_account();

reset role;

do $$
declare
  a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
begin
  if exists (select 1 from auth.users where id = a) then
    raise exception 'FEHLER: Nutzer A existiert noch';
  end if;
  if exists (select 1 from public.profiles where id = a)
     or exists (select 1 from public.settings where user_id = a)
     or exists (select 1 from public.items where user_id = a)
     or exists (select 1 from public.sales where user_id = a)
     or exists (select 1 from public.receipts where user_id = a) then
    raise exception 'FEHLER: Daten von A wurden nicht vollständig gelöscht';
  end if;
  if not exists (select 1 from auth.users where id = b)
     or (select count(*) from public.items where user_id = b) <> 1
     or (select count(*) from public.sales where user_id = b) <> 1
     or (select count(*) from public.receipts where user_id = b) <> 1 then
    raise exception 'FEHLER: Daten von B wurden beschädigt';
  end if;
end $$;

-- Nicht angemeldete Besucher können niemanden löschen
set local role anon;
do $$
begin
  perform public.delete_my_account();
  raise exception 'FEHLER: Nicht angemeldete Besucher können die Löschfunktion aufrufen';
exception when insufficient_privilege then null;
end $$;

-- Angemeldet, aber ohne gültige Nutzer-ID: nichts passiert
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$
begin
  perform public.delete_my_account();
  raise exception 'FEHLER: Löschen ohne Nutzer-ID ließ sich aufrufen';
exception when raise_exception then
  if sqlerrm like 'FEHLER:%' then raise; end if;
end $$;

reset role;
rollback;

select 'Konto-Tests bestanden' as ergebnis;
