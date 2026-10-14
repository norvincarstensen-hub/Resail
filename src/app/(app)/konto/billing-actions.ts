"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPaidAccess, PLANS, type Plan } from "@/lib/billing";
import { getStripe, isBillingConfigured, priceIdFor } from "@/lib/stripe";

async function origin() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

// Stripe-Kunde zum Profil holen oder anlegen
async function customerFor(userId: string, email: string | null, existing: string | null) {
  if (existing) return existing;
  const customer = await getStripe().customers.create({
    email: email ?? undefined,
    metadata: { user_id: userId },
  });
  // Nur der Server darf das Profil ändern
  await createAdminClient().from("profiles").update({ stripe_customer_id: customer.id }).eq("id", userId);
  return customer.id;
}

export async function startCheckout(plan: Plan): Promise<{ error?: string }> {
  if (!isBillingConfigured()) return { error: "Das Abo ist noch nicht verfügbar." };
  if (!(plan in PLANS)) return { error: "Unbekannter Tarif." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, subscription_status, stripe_customer_id")
    .single();
  if (!profile) return { error: "Profil nicht gefunden." };
  if (hasPaidAccess(profile.subscription_status)) {
    return { error: "Du hast bereits ein Abo. Verwalte es über „Abo verwalten“." };
  }

  let url: string | null = null;
  try {
    const customer = await customerFor(userId, profile.email, profile.stripe_customer_id);
    const base = await origin();
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: userId,
      line_items: [{ price: priceIdFor(plan), quantity: 1 }],
      subscription_data: { metadata: { user_id: userId } },
      allow_promotion_codes: true,
      locale: "de",
      success_url: `${base}/konto?abo=danke`,
      cancel_url: `${base}/konto`,
    });
    url = session.url;
  } catch {
    return { error: "Die Bezahlseite konnte nicht geöffnet werden. Bitte versuche es erneut." };
  }
  if (!url) return { error: "Die Bezahlseite konnte nicht geöffnet werden." };
  redirect(url);
}

// Stripe-Kundenbereich: Abo kündigen, Zahlungsart ändern, Rechnungen
export async function openBillingPortal(): Promise<{ error?: string }> {
  if (!isBillingConfigured()) return { error: "Das Abo ist noch nicht verfügbar." };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").single();
  if (!profile?.stripe_customer_id) return { error: "Kein Abo gefunden." };

  let url: string;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${await origin()}/konto`,
      locale: "de",
    });
    url = session.url;
  } catch {
    return { error: "Die Abo-Verwaltung konnte nicht geöffnet werden. Bitte versuche es erneut." };
  }
  redirect(url);
}
