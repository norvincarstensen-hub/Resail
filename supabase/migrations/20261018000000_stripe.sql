-- Abo über Stripe
--
-- Verknüpft das Profil mit dem Stripe-Kunden und dem Abo. Beide Felder (und
-- subscription_status) schreibt nur der Server mit dem geheimen Schlüssel,
-- Nutzer können ihr Profil weiterhin nur lesen.
--
-- Ausführen: Supabase → SQL Editor → Inhalt einfügen → Run.

alter table public.profiles
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text;
