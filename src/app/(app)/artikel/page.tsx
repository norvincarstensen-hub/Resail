import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { FILE_BUCKET, SIGNED_URL_SECONDS } from "@/lib/files";
import {
  ITEM_STATUSES,
  STATUS_LABELS,
  formatDate,
  isOneOf,
  profitCents,
  type Item,
  type Sale,
} from "@/lib/items";

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
      {used >= limit && (
        <>
          {" · "}
          <Link href="/konto" className="underline">
            Abo abschließen
          </Link>
        </>
      )}
    </p>
  );
}

type ListItem = Pick<
  Item,
  "id" | "name" | "category" | "purchase_date" | "purchase_price_cents" | "status" | "photo_path"
> & { sales: Sale[] };

function saleDate(item: ListItem): string | null {
  return item.sales.find((s) => !s.cancelled)?.sale_date ?? null;
}

function Amount({ item }: { item: ListItem }) {
  const sale = item.sales.find((s) => !s.cancelled);
  if (!sale) {
    return <span className="shrink-0 tabular-nums">{formatCents(item.purchase_price_cents)}</span>;
  }
  const profit = profitCents(item.purchase_price_cents, sale);
  return (
    <span className="shrink-0 text-right">
      <span
        className={`block tabular-nums font-medium ${profit < 0 ? "text-red-600" : "text-green-700 dark:text-green-400"}`}
      >
        {profit >= 0 ? "+" : ""}
        {formatCents(profit)}
      </span>
      <span className="block text-xs text-zinc-600 dark:text-zinc-400">Gewinn</span>
    </span>
  );
}

function Thumb({ url }: { url: string | null }) {
  if (!url) {
    return <span aria-hidden className="h-12 w-12 shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-900" />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- zeitlich begrenzter Link aus privatem Speicher
  return <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />;
}

async function ItemList({ searchParams }: { searchParams: PageProps<"/artikel">["searchParams"] }) {
  const { status: rawStatus } = await searchParams;
  const status = isOneOf(ITEM_STATUSES, rawStatus) ? rawStatus : null;

  const supabase = await createClient();
  let query = supabase
    .from("items")
    .select(
      "id, name, category, purchase_date, purchase_price_cents, status, photo_path, sales(id, sale_date, platform, sale_price_cents, platform_fee_cents, shipping_cents, packaging_cents, cancelled)",
    )
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data: items, error } = await query.returns<ListItem[]>();

  const photoPaths = (items ?? []).map((i) => i.photo_path).filter((p): p is string => Boolean(p));
  const { data: signed } = photoPaths.length
    ? await supabase.storage.from(FILE_BUCKET).createSignedUrls(photoPaths, SIGNED_URL_SECONDS)
    : { data: [] };
  const thumbFor = (path: string | null) =>
    (path && signed?.find((s) => s.path === path)?.signedUrl) || null;

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
        {items?.map((item) => (
          <li key={item.id}>
            <Link href={`/artikel/${item.id}`} className="flex items-center gap-3 py-3">
              <Thumb url={thumbFor(item.photo_path)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.name}</span>
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                  {STATUS_LABELS[item.status]}
                  {item.category && ` · ${item.category}`}
                  {saleDate(item)
                    ? ` · verkauft ${formatDate(saleDate(item)!)}`
                    : item.purchase_date && ` · ${formatDate(item.purchase_date)}`}
                </span>
              </span>
              <Amount item={item} />
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
