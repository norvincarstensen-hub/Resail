-- Testphase: 7 Tage ab Registrierung.
--
-- Ausführen: Supabase → SQL Editor → Inhalt einfügen → Run.

-- Neue Nutzer bekommen beim Registrieren ein Testphasen-Ende.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, trial_ends_at)
    values (new.id, new.email, now() + interval '7 days');
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$;

-- Bestehende Nutzer in der Testphase nachtragen.
update public.profiles
  set trial_ends_at = created_at + interval '7 days'
  where trial_ends_at is null and subscription_status = 'trial';
