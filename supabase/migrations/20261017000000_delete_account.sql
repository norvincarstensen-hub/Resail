-- Konto löschen: Der angemeldete Nutzer löscht sich selbst.
--
-- Löscht den Eintrag in auth.users. Profil, Einstellungen, Artikel, Belege und
-- Verkäufe werden über "on delete cascade" mitgelöscht. Die Dateien im Speicher
-- löscht die App vorher über die Speicher-Schnittstelle (die kann SQL nicht löschen).
--
-- Ausführen: Supabase → SQL Editor → Inhalt einfügen → Run.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Nicht angemeldet';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
