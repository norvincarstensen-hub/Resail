import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { ITEM_STATUSES, STATUS_LABELS, formatDate, isOneOf, type Item } from "@/lib/items";

export const metadata: Metadata = { title: "Artikel · Reseller-Tracker" };

async function FreeLimit() {
  const supabase = await createClient();
  const [{ data: profile }, { data: limit }] = await Promise.all([
    supabase.from("profiles").select("subscription_status, items_created_count").single(),
    supabase.rpc("free_item_limit"),
  ]);
  if (!profile || typeof limit !== "number") return null;
  if (profile.subscription_status === "active" || profile.subscription_status === "past_due") {
    return null;
  }

  const used = Math.min(profile.items_created_count, limit);
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      {used} von {limit} kostenlosen Artikeln angelegt
    </p>
  );
}

async function ItemList({ searchParams }: { searchParams: PageProps<"/artikel">["searchParams"] }) {
  const { status: rawStatus } = await searchParams;
  const status = isOneOf(ITEM_STATUSES, rawStatus) ? rawStatus : null;

  const supabase = await createClient();
  let query = supabase
    .from("items")
    .select("id, name, category, purchase_date, purchase_price_cents, status")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data: items, error } = await query;

  const tab = (value: string | null, text: string) => {
    const active = value === status;
    return (
      <Link
        key={value ?? "alle"}
        href={value ? `/artikel?status=${value}` : "/artikel"}
        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
          active
            ? "bg-foreground text-background"
            : "border border-zinc-300 dark:border-zinc-700"
        }`}
      >
        {text}
      </Link>
    );
  };

  return (
    <>
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Nach Status filtern">
        {tab(null, "Alle")}
        {ITEM_STATUSES.map((s) => tab(s, STATUS_LABELS[s]))}
      </nav>

      {error && <p className="text-red-600">Die Artikel konnten nicht geladen werden.</p>}

      {items && items.length === 0 && (
        <p className="py-8 text-center text-zinc-600 dark:text-zinc-400">
          {status ? "Keine Artikel mit diesem Status." : "Noch keine Artikel. Leg deinen ersten an!"}
        </p>
      )}

      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {(items as Pick<Item, "id" | "name" | "category" | "purchase_date" | "purchase_price_cents" | "status">[] | null)?.map((item) => (
          <li key={item.id}>
            <Link href={`/artikel/${item.id}`} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.name}</span>
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                  {STATUS_LABELS[item.status]}
                  {item.category && ` · ${item.category}`}
                  {item.purchase_date && ` · ${formatDate(item.purchase_date)}`}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{formatCents(item.purchase_price_cents)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function ArtikelPage({ searchParams }: PageProps<"/artikel">) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Artikel</h1>
        <Link
          href="/artikel/neu"
          className="rounded-lg bg-foreground px-4 py-2 font-medium text-background"
        >
          + Neu
        </Link>
      </div>
      <Suspense>
        <FreeLimit />
      </Suspense>
      <Suspense fallback={<p>Wird geladen …</p>}>
        <ItemList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
