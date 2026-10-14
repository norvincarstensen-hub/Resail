// Abo-Logik ohne Stripe-Aufrufe, damit sie sich testen lässt.

export const PLANS = {
  monatlich: { label: "4,99 € im Monat", hint: "monatlich kündbar", env: "STRIPE_PRICE_MONTHLY" },
  jaehrlich: { label: "39 € im Jahr", hint: "entspricht 3,25 € im Monat", env: "STRIPE_PRICE_YEARLY" },
} as const;
export type Plan = keyof typeof PLANS;

export type SubscriptionStatus = "free" | "active" | "past_due" | "canceled";

// Stripe-Status → Status in der App
//   active, trialing   → active   (voller Zugriff)
//   past_due           → past_due (Zahlung hakt, Stripe versucht es erneut; noch Zugriff)
//   unpaid, paused, canceled, incomplete_expired → canceled
//   incomplete         → free     (erste Zahlung noch nicht abgeschlossen)
export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "incomplete":
      return "free";
    default:
      return "canceled";
  }
}

const RANK: Record<SubscriptionStatus, number> = { active: 3, past_due: 2, canceled: 1, free: 0 };

// Hat ein Kunde mehrere Abos (z. B. ein altes gekündigtes und ein neues), zählt das beste.
// So ist das Ergebnis auch richtig, wenn Stripe-Nachrichten in falscher Reihenfolge ankommen.
export function bestSubscription(subs: { id: string; status: string }[]): {
  status: SubscriptionStatus;
  subscriptionId: string | null;
} {
  let best: { status: SubscriptionStatus; subscriptionId: string | null } = {
    status: subs.length ? "canceled" : "free",
    subscriptionId: null,
  };
  for (const sub of subs) {
    const status = mapStripeStatus(sub.status);
    if (RANK[status] > RANK[best.status] || (best.subscriptionId === null && RANK[status] === RANK[best.status])) {
      best = { status, subscriptionId: sub.id };
    }
  }
  return best;
}

export function hasPaidAccess(status: SubscriptionStatus | string | null | undefined): boolean {
  return status === "active" || status === "past_due";
}
