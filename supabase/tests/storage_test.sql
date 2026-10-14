-- Test: Kommt ein Nutzer an die Fotos und Belege eines anderen?
--
-- Ausführen: Supabase → SQL Editor → Inhalt einfügen → Run.
-- Legt zwei Test-Nutzer an, spielt beide durch und macht am Ende alles rückgängig.
--
-- Ergebnis:
--   "Speicher-Tests bestanden"  → alles in Ordnung
--   Fehler mit "FEHLER: ..."    → die Meldung sagt, was nicht stimmt

begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-a@beispiel.de'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'test-b@beispiel.de');

-- 1. Speicher ist privat
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'item-files' and public = false) then
    raise exception 'FEHLER: Speicher "item-files" fehlt oder ist öffentlich';
  end if;
end $$;

-- 2. A legt einen Artikel an und lädt ein Foto hoch
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
declare
  item_a uuid;
  foto text;
begin
  insert into public.items (name, item_type) values ('Jacke von A', 'weiterverkauf')
    returning id into item_a;
  foto := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/' || item_a || '/foto.jpg';

  insert into storage.objects (bucket_id, name) values ('item-files', foto);
  update public.items set photo_path = foto where id = item_a;

  -- Datei zu einem Artikel, den es nicht gibt
  begin
    insert into storage.objects (bucket_id, name)
      values ('item-files', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/' || gen_random_uuid() || '/x.jpg');
    raise exception 'FEHLER: Datei zu nicht existierendem Artikel hochladbar';
  exception when insufficient_privilege then null;
  end;

  -- Foto-Pfad, der in einen fremden Ordner zeigt
  begin
    update public.items
      set photo_path = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/' || item_a || '/x.jpg'
      where id = item_a;
    raise exception 'FEHLER: Foto-Pfad darf in fremden Ordner zeigen';
  exception when check_violation then null;
  end;

  perform set_config('test.item_a', item_a::text, true);
end $$;

-- 3. B versucht, an A's Dateien zu kommen
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

do $$
declare
  item_a text := current_setting('test.item_a');
begin
  if exists (select 1 from storage.objects where bucket_id = 'item-files') then
    raise exception 'FEHLER: B sieht Dateien von A';
  end if;

  begin
    insert into storage.objects (bucket_id, name)
      values ('item-files', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/' || item_a || '/untergeschoben.jpg');
    raise exception 'FEHLER: B kann in A''s Ordner hochladen';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name)
      values ('item-files', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/' || item_a || '/x.jpg');
    raise exception 'FEHLER: B kann Dateien zu A''s Artikel hochladen';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 4. A sieht sein Foto weiterhin
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from storage.objects where bucket_id = 'item-files') <> 1 then
    raise exception 'FEHLER: A sieht sein eigenes Foto nicht';
  end if;
end $$;

-- 5. Nicht angemeldete Besucher sehen nichts
reset role;
set local role anon;

do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'item-files') then
    raise exception 'FEHLER: Nicht angemeldete Besucher sehen Dateien';
  end if;
exception when insufficient_privilege then null;
end $$;

reset role;
rollback;

select 'Speicher-Tests bestanden' as ergebnis;
