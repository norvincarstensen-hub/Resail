-- Verkäufe und Artikelstatus
--
-- Regel: Ein Artikel hat genau dann den Status "verkauft", wenn es einen aktiven
-- (nicht stornierten) Verkauf gibt. Den Status setzt die Datenbank, nicht der Nutzer.
--
-- Ausführen: Supabase → SQL Editor → Inhalt einfügen → Run.

-- Neuer aktiver Verkauf → Artikel ist verkauft
create function public.mark_item_sold()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.cancelled then
    update public.items set status = 'verkauft'
      where id = new.item_id and status <> 'verkauft';
  end if;
  return new;
end;
$$;

create trigger mark_item_sold
  after insert on public.sales
  for each row execute function public.mark_item_sold();

-- Ein bereits stornierter Verkauf darf nicht wieder aktiv werden
-- (sonst stimmt der Artikelstatus nicht mehr). Stattdessen neuen Verkauf erfassen.
create function public.prevent_sale_reactivation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.cancelled and not new.cancelled then
    raise exception 'Ein stornierter Verkauf kann nicht wieder aktiviert werden.'
      using hint = 'sale_reactivation_not_allowed';
  end if;
  if new.item_id <> old.item_id then
    raise exception 'Ein Verkauf kann nicht zu einem anderen Artikel verschoben werden.';
  end if;
  return new;
end;
$$;

create trigger prevent_sale_reactivation
  before update on public.sales
  for each row execute function public.prevent_sale_reactivation();

-- "verkauft" nur mit aktivem Verkauf, und solange einer existiert, bleibt es dabei
create function public.guard_item_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  has_active_sale boolean;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select exists (
    select 1 from public.sales where item_id = new.id and not cancelled
  ) into has_active_sale;

  if new.status = 'verkauft' and not has_active_sale then
    raise exception 'Den Status "Verkauft" setzt die App, wenn ein Verkauf erfasst wird.'
      using hint = 'status_requires_sale';
  end if;
  if new.status <> 'verkauft' and has_active_sale then
    raise exception 'Der Artikel hat einen aktiven Verkauf. Erfasse eine Rückgabe oder ein Storno.'
      using hint = 'status_has_active_sale';
  end if;
  return new;
end;
$$;

create trigger guard_item_status
  before insert or update of status on public.items
  for each row execute function public.guard_item_status();

-- Rückgabe oder Storno in einem Schritt: Verkauf stornieren und Status setzen.
--   rueckgabe → Artikel kommt zurück, Status "retour"
--   storno    → Verkauf kam nicht zustande, Status "gelistet"
create function public.cancel_sale(sale_id uuid, reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sold_item uuid;
begin
  if reason not in ('rueckgabe', 'storno') then
    raise exception 'Ungültiger Grund: %', reason;
  end if;

  update public.sales set cancelled = true
    where id = sale_id and not cancelled
    returning item_id into sold_item;

  if sold_item is null then
    raise exception 'Verkauf nicht gefunden oder bereits storniert.'
      using hint = 'sale_not_found';
  end if;

  update public.items
    set status = (case when reason = 'rueckgabe' then 'retour' else 'gelistet' end)::public.item_status
    where id = sold_item;
end;
$$;

revoke execute on function public.cancel_sale(uuid, text) from public, anon;
grant execute on function public.cancel_sale(uuid, text) to authenticated;

-- Artikel, die bisher von Hand auf "verkauft" gesetzt wurden, ohne Verkauf:
-- zurück auf "gelistet", sonst verletzen sie die neue Regel.
alter table public.items disable trigger guard_item_status;
update public.items i set status = 'gelistet'
  where status = 'verkauft'
    and not exists (select 1 from public.sales s where s.item_id = i.id and not s.cancelled);
alter table public.items enable trigger guard_item_status;
