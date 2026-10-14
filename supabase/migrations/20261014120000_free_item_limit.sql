-- Kostenlos bis 20 Artikel, danach Abo.
--
-- Gezählt wird jeder jemals angelegte Artikel. Löschen macht keinen Platz frei,
-- sonst ließe sich die Grenze umgehen, indem man verkaufte Artikel löscht.
-- Statt einer zeitlichen Testphase gibt es nur diese Grenze.
--
-- Ausführen: Supabase → SQL Editor → Inhalt einfügen → Run.

-- "trial" heißt jetzt "free", die zeitliche Testphase entfällt.
alter type public.subscription_status rename value 'trial' to 'free';
alter table public.profiles drop column trial_ends_at;

-- Zähler für angelegte Artikel. Liegt in profiles, das Nutzer nur lesen dürfen,
-- und kann deshalb nicht vom Nutzer zurückgesetzt werden.
alter table public.profiles
  add column items_created_count integer not null default 0 check (items_created_count >= 0);

update public.profiles p
  set items_created_count = (select count(*) from public.items i where i.user_id = p.id);

-- Die Grenze an einer Stelle. Die App kann sie abfragen, um "12 von 20" anzuzeigen.
create function public.free_item_limit()
returns integer
language sql
immutable
as $$ select 20 $$;

-- Prüft vor jedem neuen Artikel die Grenze und zählt hoch.
create function public.enforce_free_item_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  status public.subscription_status;
  created integer;
begin
  -- Zeile sperren, damit gleichzeitige Anfragen die Grenze nicht überholen.
  select subscription_status, items_created_count
    into status, created
    from public.profiles
    where id = new.user_id
    for update;

  if not found then
    raise exception 'Kein Profil für diesen Nutzer gefunden';
  end if;

  -- Mit aktivem Abo unbegrenzt. Bei Zahlungsproblemen (past_due) noch nicht sperren,
  -- Stripe versucht die Zahlung dann mehrfach erneut.
  if status not in ('active', 'past_due') and created >= public.free_item_limit() then
    raise exception 'Du hast die kostenlose Grenze von % Artikeln erreicht.', public.free_item_limit()
      using hint = 'free_item_limit_reached';
  end if;

  update public.profiles set items_created_count = created + 1 where id = new.user_id;
  return new;
end;
$$;

revoke execute on function public.enforce_free_item_limit() from public, anon, authenticated;

create trigger enforce_free_item_limit
  before insert on public.items
  for each row execute function public.enforce_free_item_limit();
