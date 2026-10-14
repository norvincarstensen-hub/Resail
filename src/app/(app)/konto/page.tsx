import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { DeleteAccountForm, ThresholdsForm } from "./forms";
import { Billing } from "./billing";
import { isBillingConfigured } from "@/lib/stripe";

export const metadata: Metadata = { title: "Konto · Reseller-Tracker" };

const section = "flex flex-col gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800";

async function Account({ searchParams }: { searchParams: PageProps<"/konto">["searchParams"] }) {
  const { abo } = await searchParams;
  const supabase = await createClient();
  const [{ data: profile }, { data: settings }, { data: limit }] = await Promise.all([
    supabase.from("profiles").select("email, subscription_status, items_created_count").single(),
    supabase.from("settings").select("report_threshold_sales, report_threshold_revenue_cents").single(),
    supabase.rpc("free_item_limit"),
  ]);

  return (
    <>
      <section className="flex flex-col gap-3">
        <p>
          Angemeldet als <strong>{profile?.email}</strong>
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700"
          >
            Abmelden
          </button>
        </form>
      </section>

      {profile && isBillingConfigured() && (
        <section className={section}>
          <h2 className="text-lg font-semibold">Abo</h2>
          <Billing
            status={profile.subscription_status}
            itemsUsed={profile.items_created_count}
            limit={typeof limit === "number" ? limit : 20}
            justPaid={abo === "danke"}
          />
        </section>
      )}

      {settings && (
        <section className={section}>
          <h2 className="text-lg font-semibold">Meldegrenzen</h2>
          <ThresholdsForm
            sales={settings.report_threshold_sales}
            revenueCents={settings.report_threshold_revenue_cents}
          />
        </section>
      )}

      <section className={section}>
        <h2 className="text-lg font-semibold">Deine Daten herunterladen</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Alle deine Artikel, Verkäufe, Belege und Einstellungen als Datei (JSON). Fotos und Belege
          sind als Download-Links enthalten, die 7 Tage gültig sind.
        </p>
        <a
          href="/konto/export"
          className="self-start rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
        >
          Daten herunterladen
        </a>
      </section>

      <section className={section}>
        <h2 className="text-lg font-semibold">Konto löschen</h2>
        <DeleteAccountForm />
      </section>
    </>
  );
}

export default function KontoPage({ searchParams }: PageProps<"/konto">) {
  return (
    <>
      <h1 className="text-2xl font-semibold">Konto</h1>
      <Suspense fallback={<p>Wird geladen …</p>}>
        <Account searchParams={searchParams} />
      </Suspense>
    </>
  );
}
