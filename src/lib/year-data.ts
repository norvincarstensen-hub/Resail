// Lädt alle Daten für ein Kalenderjahr: Meldegrenzen und aktive Verkäufe mit Artikelangaben.
// Wird von der Übersicht und vom Export genutzt, damit beide dasselbe zeigen.

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayInBerlin, type ItemType, type Sale } from "./items";
import { summarize, type SaleWithItem, type Thresholds } from "./stats";

export type YearSale = SaleWithItem & {
  item_name: string;
  item_type: ItemType | null;
  purchase_date: string | null;
};

type Row = Sale & {
  items: {
    name: string;
    item_type: ItemType;
    purchase_date: string | null;
    purchase_price_cents: number;
  } | null;
};

export function currentYear(): number {
  return Number(todayInBerlin().slice(0, 4));
}

// Jahr aus der Adresse lesen; ungültig oder in der Zukunft → aktuelles Jahr
export function parseYear(value: unknown): number {
  const now = currentYear();
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= now ? year : now;
}

export async function loadYear(supabase: SupabaseClient, year: number) {
  const [{ data: settings }, { data: rows, error }] = await Promise.all([
    supabase.from("settings").select("report_threshold_sales, report_threshold_revenue_cents").single(),
    supabase
      .from("sales")
      .select(
        "id, sale_date, platform, sale_price_cents, platform_fee_cents, shipping_cents, packaging_cents, cancelled, items(name, item_type, purchase_date, purchase_price_cents)",
      )
      .gte("sale_date", `${year}-01-01`)
      .lte("sale_date", `${year}-12-31`)
      .eq("cancelled", false)
      .order("sale_date")
      .returns<Row[]>(),
  ]);

  if (error || !settings) return null;

  const limits: Thresholds = {
    sales: settings.report_threshold_sales,
    revenueCents: settings.report_threshold_revenue_cents,
  };
  const sales: YearSale[] = (rows ?? []).map(({ items, ...sale }) => ({
    ...sale,
    purchase_price_cents: items?.purchase_price_cents ?? 0,
    item_name: items?.name ?? "",
    item_type: items?.item_type ?? null,
    purchase_date: items?.purchase_date ?? null,
  }));

  const { year: totals, byMonth, byPlatform } = summarize(sales);
  return { year, limits, sales, totals, byMonth, byPlatform };
}

export type YearData = NonNullable<Awaited<ReturnType<typeof loadYear>>>;
