import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isBillingConfigured, syncCustomer } from "@/lib/stripe";

// Stripe meldet hier Änderungen an Abos. Die Signatur beweist, dass die Nachricht
// wirklich von Stripe kommt. Danach wird der Abo-Status im Profil aktualisiert.
export async function POST(request: NextRequest) {
  if (!isBillingConfigured()) return NextResponse.json({ error: "Nicht eingerichtet" }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signatur fehlt" }, { status: 400 });

  const stripe = getStripe();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 400 });
  }

  let customerId: string | null = null;
  let userIdHint: string | null = null;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      customerId = typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
      userIdHint = session.client_reference_id;
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const sub = event.data.object;
      customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      userIdHint = sub.metadata?.user_id ?? null;
      break;
    }
    default:
      return NextResponse.json({ received: true });
  }

  if (customerId) {
    try {
      await syncCustomer(customerId, createAdminClient(), userIdHint);
    } catch {
      // Stripe versucht es bei einem Fehler automatisch erneut
      return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
