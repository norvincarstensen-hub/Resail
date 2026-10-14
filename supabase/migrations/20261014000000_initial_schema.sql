-- Grundschema Version 1: profiles, items, receipts, sales, settings
-- inkl. Row Level Security und automatischem Anlegen von profiles/settings bei Registrierung.
--
-- Ausführen: Supabase → SQL Editor → Inhalt einfügen → Run.

-- ---------------------------------------------------------------------------
-- Aufzählungstypen
-- ---------------------------------------------------------------------------

create type public.purchase_source as enum ('flohmarkt', 'vinted', 'privat', 'laden', 'sonstige');
create type public.item_type as enum ('eigener_gebrauchtgegenstand', 'weiterverkauf');
create type public.item_status as enum ('lager', 'gelistet', 'verkauft', 'retour');
create type public.receipt_type as enum ('kassenbon', 'ueberweisung', 'screenshot', 'sonstiges');
create type public.sale_platform as enum ('vinted', 'kleinanzeigen', 'ebay', 'sonstige');
create type public.subscription_status as enum ('trial', 'active', 'past_due', 'canceled');

-- ---------------------------------------------------------------------------
-- Tabellen
-- Alle Beträge als ganze Zahl in Cent.
-- Löscht ein Nutzer sein Konto (auth.users), werden alle seine Daten mitgelöscht.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  subscription_status public.subscription_status not null default 'trial',
  trial_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  report_threshold_sales integer not null default 30 check (report_threshold_sales > 0),
  report_threshold_revenue_cents integer not null default 200000 check (report_threshold_revenue_cents > 0)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text,
  purchase_date date,
  purchase_price_cents integer not null default 0 check (purchase_price_cents >= 0),
  purchase_source public.purchase_source,
  item_type public.item_type not null,
  status public.item_status not null default 'lager',
  photo_path text,
  note text,
  created_at timestamptz not null default now(),
  -- Ziel für die zusammengesetzten Fremdschlüssel in receipts und sales
  unique (id, user_id)
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_path text not null,
  type public.receipt_type not null default 'sonstiges',
  created_at timestamptz not null default now(),
  -- Ein Beleg kann nur an einen Artikel desselben Nutzers gehängt werden.
  foreign key (item_id, user_id) references public.items (id, user_id) on delete cascade
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sale_date date not null default current_date,
  platform public.sale_platform not null,
  sale_price_cents integer not null check (sale_price_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  packaging_cents integer not null default 0 check (packaging_cents >= 0),
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  -- Ein Verkauf kann nur zu einem Artikel desselben Nutzers gehören.
  foreign key (item_id, user_id) references public.items (id, user_id) on delete cascade
);

-- Höchstens ein aktiver (nicht stornierter) Verkauf pro Artikel.
create unique index sales_one_active_per_item on public.sales (item_id) where not cancelled;

-- Indizes für RLS-Filter und Fremdschlüssel
create index items_user_id_idx on public.items (user_id);
create index receipts_user_id_idx on public.receipts (user_id);
create index receipts_item_id_idx on public.receipts (item_id, user_id);
create index sales_user_id_idx on public.sales (user_id);
create index sales_item_id_idx on public.sales (item_id, user_id);
create index sales_user_date_idx on public.sales (user_id, sale_date);

-- ---------------------------------------------------------------------------
-- Row Level Security: Jeder Nutzer sieht und ändert nur seine eigenen Zeilen.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.items enable row level security;
alter table public.receipts enable row level security;
alter table public.sales enable row level security;

-- profiles: nur lesen. Der Abo-Status darf nicht vom Nutzer selbst geändert werden,
-- sonst könnte sich jeder kostenlos freischalten. Angelegt wird das Profil per Trigger,
-- geändert später nur serverseitig (z. B. durch den Stripe-Webhook).
create policy "Eigenes Profil lesen" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

-- settings: lesen und ändern. Anlegen per Trigger, gelöscht wird mit dem Konto.
create policy "Eigene Einstellungen lesen" on public.settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Eigene Einstellungen ändern" on public.settings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- items, receipts, sales: voller Zugriff auf eigene Zeilen
create policy "Eigene Artikel lesen" on public.items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Eigene Artikel anlegen" on public.items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Eigene Artikel ändern" on public.items
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Eigene Artikel löschen" on public.items
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Eigene Belege lesen" on public.receipts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Eigene Belege anlegen" on public.receipts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Eigene Belege ändern" on public.receipts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Eigene Belege löschen" on public.receipts
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Eigene Verkäufe lesen" on public.sales
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Eigene Verkäufe anlegen" on public.sales
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Eigene Verkäufe ändern" on public.sales
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Eigene Verkäufe löschen" on public.sales
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Nicht angemeldete Besucher (anon) bekommen gar keine Rechte auf diese Tabellen.
revoke all on public.profiles, public.settings, public.items, public.receipts, public.sales from anon;

-- ---------------------------------------------------------------------------
-- Bei Registrierung automatisch profiles- und settings-Eintrag anlegen
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nutzer, die sich schon vor dieser Migration registriert haben, nachtragen.
insert into public.profiles (id, email)
  select id, email from auth.users
  on conflict (id) do nothing;
insert into public.settings (user_id)
  select id from auth.users
  on conflict (user_id) do nothing;
