// Auswertungen für die Übersicht. Alles wird aus den Verkäufen berechnet, nichts gespeichert.

import { SALE_PLATFORMS, type Sale, type SalePlatform, profitCents } from "./items";

export type SaleWithItem = Sale & { purchase_price_cents: number };

export type Totals = {
  count: number;
  revenueCents: number; // Summe der Verkaufspreise
  profitCents: number;
};

const empty = (): Totals => ({ count: 0, revenueCents: 0, profitCents: 0 });

function add(t: Totals, sale: SaleWithItem) {
  t.count += 1;
  t.revenueCents += sale.sale_price_cents;
  t.profitCents += profitCents(sale.purchase_price_cents, sale);
}

// Nur aktive Verkäufe zählen. Stornos und Rückgaben fallen heraus.
export function summarize(sales: SaleWithItem[]) {
  const active = sales.filter((s) => !s.cancelled);
  const year = empty();
  const byMonth = Array.from({ length: 12 }, empty);
  const byPlatform = Object.fromEntries(SALE_PLATFORMS.map((p) => [p, empty()])) as Record<
    SalePlatform,
    Totals
  >;

  for (const sale of active) {
    add(year, sale);
    add(byMonth[Number(sale.sale_date.slice(5, 7)) - 1], sale);
    add(byPlatform[sale.platform], sale);
  }
  return { year, byMonth, byPlatform };
}

// ---------------------------------------------------------------------------
// Melde-Ampel
//
// Plattformen sind von der Meldung nur befreit, wenn ein Verkäufer im Kalenderjahr
// weniger als 30 Verkäufe UND höchstens 2.000 € erzielt. Gemeldet wird also ab dem
// 30. Verkauf oder ab mehr als 2.000 €. Die Grenzen kommen aus den Einstellungen.
// Gelb ab 80 % einer der beiden Grenzen.
// ---------------------------------------------------------------------------

export type Thresholds = { sales: number; revenueCents: number };
export type Light = "gruen" | "gelb" | "rot";

export const WARN_RATIO = 0.8;

// Plattformen, für die eine Meldegrenze gilt. "Sonstige" ist keine einzelne Plattform.
export const REPORTING_PLATFORMS = ["vinted", "kleinanzeigen", "ebay"] as const satisfies readonly SalePlatform[];

export function reportingLight(t: Totals, limits: Thresholds): Light {
  if (t.count >= limits.sales || t.revenueCents > limits.revenueCents) return "rot";
  if (t.count >= limits.sales * WARN_RATIO || t.revenueCents >= limits.revenueCents * WARN_RATIO) {
    return "gelb";
  }
  return "gruen";
}

// Wie viel noch fehlt, bis gemeldet wird (nie negativ)
export function remaining(t: Totals, limits: Thresholds) {
  return {
    sales: Math.max(0, limits.sales - t.count),
    revenueCents: Math.max(0, limits.revenueCents - t.revenueCents),
  };
}
