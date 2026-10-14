import "server-only";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANS, bestSubscription, type Plan } from "./billing";

// Ist Stripe eingerichtet? Ohne Schlüssel zeigt die App das Abo einfach noch nicht an.
export function isBillingConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_YEARLY &&
      process.env.SUPABASE_SECRET_KEY,
  );
}

let client: Stripe | null = null;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt.");
  client ??= new Stripe(key);
  return client;
}

export function priceIdFor(plan: Plan): string {
  const id = process.env[PLANS[plan].env];
  if (!id) throw new Error(`${PLANS[plan].env} fehlt.`);
  return id;
}

// Holt alle Abos eines Kunden bei Stripe und schreibt den besten Status ins Profil.
export async function syncCustomer(
  customerId: string,
  admin: SupabaseClient,
  userIdHint?: string | null,
) {
  const subs = await getStripe().subscriptions.list({ customer: customerId, status: "all", limit: 20 });
  const best = bestSubscription(subs.data.map((s) => ({ id: s.id, status: s.status })));

  const update = {
    subscription_status: best.status,
    stripe_subscription_id: best.subscriptionId,
  };
  const { data } = await admin
    .from("profiles")
    .update(update)
    .eq("stripe_customer_id", customerId)
    .select("id");

  // Falls der Kunde noch nicht am Profil hängt: über die mitgeschickte Nutzer-ID zuordnen
  if (!data?.length && userIdHint) {
    await admin
      .from("profiles")
      .update({ ...update, stripe_customer_id: customerId })
      .eq("id", userIdHint)
      .is("stripe_customer_id", null);
  }
}
