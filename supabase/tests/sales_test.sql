-- Test: Verkäufe, Rückgabe, Storno und Artikelstatus
--
-- Ausführen: Supabase → SQL Editor → Inhalt einfügen → Run.
-- Legt zwei Test-Nutzer an, spielt alles durch und macht am Ende alles rückgängig.
--
-- Ergebnis:
--   "Verkaufs-Tests bestanden"  → alles in Ordnung
--   Fehler mit "FEHLER: ..."    → die Meldung sagt, was nicht stimmt

begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-a@beispiel.de'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'test-b@beispiel.de');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
declare
  item uuid;
  sale uuid;
  st public.item_status;
begin
  -- 1. Artikel kann nicht direkt als "verkauft" angelegt werden
  begin
    insert into public.items (name, item_type, status) values ('X', 'weiterverkauf', 'verkauft');
    raise exception 'FEHLER: Artikel ließ sich ohne Verkauf als "verkauft" anlegen';
  exception when raise_exception then
    if sqlerrm like 'FEHLER:%' then raise; end if;
  end;

  insert into public.items (name, item_type, status) values ('Jacke', 'weiterverkauf', 'gelistet')
    returning id into item;

  -- 2. "verkauft" nicht von Hand setzbar
  begin
    update public.items set status = 'verkauft' where id = item;
    raise exception 'FEHLER: Status "verkauft" ließ sich ohne Verkauf setzen';
  exception when raise_exception then
    if sqlerrm like 'FEHLER:%' then raise; end if;
  end;

  -- 3. Verkauf erfassen → Status "verkauft"
  insert into public.sales (item_id, platform, sale_price_cents, platform_fee_cents, shipping_cents)
    values (item, 'vinted', 3000, 0, 0) returning id into sale;
  select status into st from public.items where id = item;
  if st <> 'verkauft' then
    raise exception 'FEHLER: Nach dem Verkauf ist der Status nicht "verkauft", sondern %', st;
  end if;

  -- 4. Zweiter aktiver Verkauf nicht möglich
  begin
    insert into public.sales (item_id, platform, sale_price_cents) values (item, 'ebay', 100);
    raise exception 'FEHLER: Zweiter aktiver Verkauf möglich';
  exception when unique_violation then null;
  end;

  -- 5. Solange verkauft, kein Statuswechsel von Hand
  begin
    update public.items set status = 'lager' where id = item;
    raise exception 'FEHLER: Status ließ sich trotz aktivem Verkauf ändern';
  exception when raise_exception then
    if sqlerrm like 'FEHLER:%' then raise; end if;
  end;

  -- 6. Rückgabe → Status "retour", Verkauf storniert
  perform public.cancel_sale(sale, 'rueckgabe');
  select status into st from public.items where id = item;
  if st <> 'retour' then raise exception 'FEHLER: Nach Rückgabe ist der Status %', st; end if;
  if not (select cancelled from public.sales where id = sale) then
    raise exception 'FEHLER: Verkauf wurde bei Rückgabe nicht storniert';
  end if;

  -- 7. Stornierter Verkauf kann nicht wieder aktiv werden
  begin
    update public.sales set cancelled = false where id = sale;
    raise exception 'FEHLER: Stornierter Verkauf ließ sich wieder aktivieren';
  exception when raise_exception then
    if sqlerrm like 'FEHLER:%' then raise; end if;
  end;

  -- 8. Erneut verkaufen, dann Storno → "gelistet"
  insert into public.sales (item_id, platform, sale_price_cents) values (item, 'kleinanzeigen', 2500)
    returning id into sale;
  perform public.cancel_sale(sale, 'storno');
  select status into st from public.items where id = item;
  if st <> 'gelistet' then raise exception 'FEHLER: Nach Storno ist der Status %', st; end if;

  -- 9. Nochmal verkaufen für den Test mit Nutzer B
  insert into public.sales (item_id, platform, sale_price_cents) values (item, 'ebay', 2800)
    returning id into sale;
  perform set_config('test.sale_a', sale::text, true);
end $$;

-- 10. B kann A's Verkauf nicht stornieren
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

do $$
begin
  begin
    perform public.cancel_sale(current_setting('test.sale_a')::uuid, 'storno');
    raise exception 'FEHLER: B konnte A''s Verkauf stornieren';
  exception when raise_exception then
    if sqlerrm like 'FEHLER:%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
begin
  if (select cancelled from public.sales where id = current_setting('test.sale_a')::uuid) then
    raise exception 'FEHLER: A''s Verkauf wurde durch B storniert';
  end if;
end $$;

-- 11. Nicht angemeldete Besucher können nichts stornieren
reset role;
set local role anon;
do $$
begin
  perform public.cancel_sale(current_setting('test.sale_a')::uuid, 'storno');
  raise exception 'FEHLER: Nicht angemeldete Besucher können stornieren';
exception when insufficient_privilege then null;
end $$;

reset role;
rollback;

select 'Verkaufs-Tests bestanden' as ergebnis;
