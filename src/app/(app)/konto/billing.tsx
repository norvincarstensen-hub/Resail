"use client";

import { useState, useTransition } from "react";
import { PLANS, type Plan } from "@/lib/billing";
import { openBillingPortal, startCheckout } from "./billing-actions";

type Props = {
  status: string;
  itemsUsed: number;
  limit: number;
  justPaid: boolean;
};

export function Billing({ status, itemsUsed, limit, justPaid }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
    });
  };

  if (status === "active" || status === "past_due") {
    return (
      <div className="flex flex-col gap-3">
        <p>
          {status === "active"
            ? "Dein Abo ist aktiv. Du kannst unbegrenzt Artikel anlegen."
            : "Bei deiner letzten Zahlung gab es ein Problem. Bitte prüfe deine Zahlungsart, sonst endet das Abo."}
        </p>
        <button
          type="button"
          onClick={() => run(openBillingPortal)}
          disabled={pending}
          className="self-start rounded-lg border border-zinc-300 px-4 py-3 disabled:opacity-60 dark:border-zinc-700"
        >
          {pending ? "Wird geöffnet …" : "Abo verwalten oder kündigen"}
        </button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {justPaid ? (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-100">
          Danke! Deine Zahlung wird gerade bestätigt. Lade die Seite in ein paar Sekunden neu.
        </p>
      ) : (
        <p>
          Du nutzt die kostenlose Version: {Math.min(itemsUsed, limit)} von {limit} Artikeln angelegt.
          Mit einem Abo legst du unbegrenzt viele Artikel an.
          {status === "canceled" && " Dein früheres Abo ist beendet."}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(PLANS) as Plan[]).map((plan) => (
          <button
            key={plan}
            type="button"
            onClick={() => run(() => startCheckout(plan))}
            disabled={pending}
            className="flex flex-col items-start rounded-lg border border-zinc-300 p-4 text-left disabled:opacity-60 dark:border-zinc-700"
          >
            <span className="font-semibold">{PLANS[plan].label}</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {PLANS[plan].hint}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Du wirst zur sicheren Bezahlseite von Stripe weitergeleitet. Kündigen kannst du jederzeit
        über „Abo verwalten“.
      </p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
