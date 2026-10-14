-- Privater Speicher für Artikelfotos und Belege.
--
-- Dateien liegen unter  <user_id>/<item_id>/<dateiname>.
-- Jeder Nutzer kann nur Dateien in seinem eigenen Ordner und nur zu eigenen Artikeln
-- hochladen, sehen und löschen. Angezeigt werden sie über zeitlich begrenzte Links.
--
-- Ausführen: Supabase → SQL Editor → Inhalt einfügen → Run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-files',
  'item-files',
  false,
  10485760, -- 10 MB pro Datei
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
);

-- Gehört der Pfad dem angemeldeten Nutzer und einem seiner Artikel?
create function public.owns_item_file(path text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (storage.foldername(path))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.items
      where id::text = (storage.foldername(path))[2]
        and user_id = (select auth.uid())
    );
$$;

create policy "Eigene Artikeldateien lesen" on storage.objects
  for select to authenticated
  using (bucket_id = 'item-files' and public.owns_item_file(name));

create policy "Eigene Artikeldateien hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-files' and public.owns_item_file(name));

create policy "Eigene Artikeldateien ändern" on storage.objects
  for update to authenticated
  using (bucket_id = 'item-files' and public.owns_item_file(name))
  with check (bucket_id = 'item-files' and public.owns_item_file(name));

create policy "Eigene Artikeldateien löschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-files' and public.owns_item_file(name));

-- Datenbank-Einträge dürfen nur auf Dateien im eigenen Ordner des Artikels zeigen.
alter table public.items
  add constraint items_photo_path_own_folder
  check (photo_path is null or photo_path like user_id::text || '/' || id::text || '/%');

alter table public.receipts
  add constraint receipts_file_path_own_folder
  check (file_path like user_id::text || '/' || item_id::text || '/%');
