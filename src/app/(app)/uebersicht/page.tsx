import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { SALE_PLATFORMS, SALE_PLATFORM_LABELS, todayInBerlin, type Sale } from "@/lib/items";
import {
  REPORTING_PLATFORMS,
  remaining,
  reportingLight,
  summarize,
  type Light,
  type SaleWithItem,
  type Thresholds,
  type Totals,
} from "@/lib/stats";

export const metadata: Metadata = { title: "Übersicht · Reseller-Tracker" };

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const LIGHT_STYLE: Record<Light, { dot: string; bar: string; label: string }> = {
  gruen: { dot: "bg-green-600", bar: "bg-green-600", label: "Unter der Meldegrenze" },
  gelb: { dot: "bg-amber-500", bar: "bg-amber-500", label: "Meldegrenze bald erreicht" },
  rot: { dot: "bg-red-600", bar: "bg-red-600", label: "Meldegrenze erreicht" },
};

function Progress({ value, max, light }: { value: number; max: number; light: Light }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div className={`h-full ${LIGHT_STYLE[light].bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ReportingCard({
  platform,
  totals,
  limits,
}: {
  platform: (typeof REPORTING_PLATFORMS)[number];
  totals: Totals;
  limits: Thresholds;
}) {
  const light = reportingLight(totals, limits);
  const left = remaining(totals, limits);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{SALE_PLATFORM_LABELS[platform]}</h3>
        <span className="flex items-center gap-2 text-sm">
          <span aria-hidden className={`h-3 w-3 rounded-full ${LIGHT_STYLE[light].dot}`} />
          {LIGHT_STYLE[light].label}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-sm">
          <span>Verkäufe</span>
          <span className="tabular-nums">
            {totals.count} von {limits.sales}
          </span>
        </div>
        <Progress value={totals.count} max={limits.sales} light={light} />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-sm">
          <span>Umsatz</span>
          <span className="tabular-nums">
            {formatCents(totals.revenueCents)} von {formatCents(limits.revenueCents)}
          </span>
        </div>
        <Progress value={totals.revenueCents} max={limits.revenueCents} light={light} />
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {light === "rot"
          ? "Ab hier meldet die Plattform deine Verkäufe dieses Jahres ans Finanzamt."
          : `Gemeldet wird ab ${limits.sales} Verkäufen oder mehr als ${formatCents(limits.revenueCents)} Umsatz. Noch ${left.sales} ${left.sales === 1 ? "Verkauf" : "Verkäufe"} bzw. ${formatCents(left.revenueCents)} bis dahin.`}
      </p>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const color =
    tone === "pos" ? "text-green-700 dark:text-green-400" : tone === "neg" ? "text-red-600" : "";
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function profitTone(cents: number) {
  return cents > 0 ? "text-green-700 dark:text-green-400" : cents < 0 ? "text-red-600" : "";
}

async function Overview({ searchParams }: { searchParams: PageProps<"/uebersicht">["searchParams"] }) {
  await connection();
  const currentYear = Number(todayInBerlin().slice(0, 4));
  const { jahr } = await searchParams;
  const parsed = Number(jahr);
  const year = Number.isInteger(parsed) && parsed >= 2000 && parsed <= currentYear ? parsed : currentYear;

  const supabase = await createClient();
  const [{ data: settings }, { data: rows, error }] = await Promise.all([
    supabase.from("settings").select("report_threshold_sales, report_threshold_revenue_cents").single(),
    supabase
      .from("sales")
      .select(
        "id, sale_date, platform, sale_price_cents, platform_fee_cents, shipping_cents, packaging_cents, cancelled, items(purchase_price_cents)",
      )
      .gte("sale_date", `${year}-01-01`)
      .lte("sale_date", `${year}-12-31`)
      .eq("cancelled", false)
      .returns<(Sale & { items: { purchase_price_cents: number } | null })[]>(),
  ]);

  if (error || !settings) {
    return <p className="text-red-600">Die Übersicht konnte nicht geladen werden.</p>;
  }

  const limits: Thresholds = {
    sales: settings.report_threshold_sales,
    revenueCents: settings.report_threshold_revenue_cents,
  };
  const sales: SaleWithItem[] = (rows ?? []).map(({ items, ...sale }) => ({
    ...sale,
    purchase_price_cents: items?.purchase_price_cents ?? 0,
  }));
  const { year: totals, byMonth, byPlatform } = summarize(sales);

  return (
    <>
      <nav className="flex items-center justify-between" aria-label="Jahr wählen">
        <Link href={`/uebersicht?jahr=${year - 1}`} className="px-2 py-1 text-zinc-600 dark:text-zinc-400">
          ‹ {year - 1}
        </Link>
        <span className="text-lg font-semibold">{year}</span>
        {year < currentYear ? (
          <Link href={`/uebersicht?jahr=${year + 1}`} className="px-2 py-1 text-zinc-600 dark:text-zinc-400">
            {year + 1} ›
          </Link>
        ) : (
          <span className="w-14" />
        )}
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Melde-Ampel</h2>
        {REPORTING_PLATFORMS.map((p) => (
          <ReportingCard key={p} platform={p} totals={byPlatform[p]} limits={limits} />
        ))}
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Gezählt werden alle nicht stornierten Verkäufe, die du hier erfasst hast. Für den Umsatz
          nimmt die App den vollen Verkaufspreis, damit die Warnung eher zu früh als zu spät kommt.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Gewinn {year}</h2>
        <div className="grid grid-cols-3 gap-2">
          <Tile
            label="Gewinn"
            value={formatCents(totals.profitCents)}
            tone={totals.profitCents > 0 ? "pos" : totals.profitCents < 0 ? "neg" : undefined}
          />
          <Tile label="Umsatz" value={formatCents(totals.revenueCents)} />
          <Tile label="Verkäufe" value={String(totals.count)} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Nach Plattform</h2>
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {SALE_PLATFORMS.map((p) => (
            <li key={p} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="block">{SALE_PLATFORM_LABELS[p]}</span>
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                  {byPlatform[p].count} Verkäufe · {formatCents(byPlatform[p].revenueCents)} Umsatz
                </span>
              </span>
              <span className={`tabular-nums ${profitTone(byPlatform[p].profitCents)}`}>
                {formatCents(byPlatform[p].profitCents)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Nach Monat</h2>
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {byMonth.map((m, i) => (
            <li
              key={MONTHS[i]}
              className={`flex items-center justify-between gap-3 py-2 ${m.count === 0 ? "text-zinc-400 dark:text-zinc-600" : ""}`}
            >
              <span>
                {MONTHS[i]}
                {m.count > 0 && (
                  <span className="text-sm text-zinc-600 dark:text-zinc-400"> · {m.count} Verkäufe</span>
                )}
              </span>
              <span className={`tabular-nums ${m.count ? profitTone(m.profitCents) : ""}`}>
                {formatCents(m.profitCents)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Gewinn = Verkaufspreis − Einkaufspreis − Gebühr − Versand − Verpackung, jeweils im Jahr des
        Verkaufs. Die App rechnet mit deinen Eingaben und erklärt allgemein. Was davon steuerlich für
        dich gilt, hängt von deinem Einzelfall ab.
      </p>
    </>
  );
}

export default function UebersichtPage({ searchParams }: PageProps<"/uebersicht">) {
  return (
    <>
      <h1 className="text-2xl font-semibold">Übersicht</h1>
      <Suspense fallback={<p>Wird geladen …</p>}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </>
  );
}
