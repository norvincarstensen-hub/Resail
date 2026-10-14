import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { SALE_PLATFORM_LABELS, type SalePlatform } from "@/lib/items";
import { currentYear as getCurrentYear, loadYear, parseYear } from "@/lib/year-data";
import {
  REPORTING_PLATFORMS,
  remaining,
  reportingLight,
  type Light,
  type Thresholds,
  type Totals,
} from "@/lib/stats";

export const metadata: Metadata = { title: "Übersicht · Reseller-Tracker" };

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

const LIGHT_STYLE: Record<Light, { color: string; label: string }> = {
  gruen: { color: "bg-green-600", label: "Unter der Grenze" },
  gelb: { color: "bg-amber-500", label: "Bald erreicht" },
  rot: { color: "bg-red-600", label: "Grenze erreicht" },
};

function profitTone(cents: number) {
  return cents > 0
    ? "text-green-700 dark:text-green-400"
    : cents < 0
      ? "text-red-600"
      : "";
}

function Meter({
  label,
  value,
  max,
  text,
  light,
}: {
  label: string;
  value: number;
  max: number;
  text: string;
  light: Light;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className="tabular-nums">{text}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full ${LIGHT_STYLE[light].color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Eine Plattform mit Verkäufen: Ampel, Fortschritt und Gewinn in einer Karte
function PlatformCard({
  platform,
  totals,
  limits,
}: {
  platform: SalePlatform;
  totals: Totals;
  limits: Thresholds;
}) {
  const reporting = (REPORTING_PLATFORMS as readonly SalePlatform[]).includes(
    platform,
  );
  const light = reporting ? reportingLight(totals, limits) : null;
  const left = remaining(totals, limits);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{SALE_PLATFORM_LABELS[platform]}</h3>
        {light && (
          <span className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className={`h-3 w-3 rounded-full ${LIGHT_STYLE[light].color}`}
            />
            {LIGHT_STYLE[light].label}
          </span>
        )}
      </div>

      {light ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
          <Meter
            label="Verkäufe"
            value={totals.count}
            max={limits.sales}
            text={`${totals.count} / ${limits.sales}`}
            light={light}
          />
          <Meter
            label="Umsatz"
            value={totals.revenueCents}
            max={limits.revenueCents}
            text={`${formatCents(totals.revenueCents)} / ${formatCents(limits.revenueCents)}`}
            light={light}
          />
        </div>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {totals.count} {totals.count === 1 ? "Verkauf" : "Verkäufe"} ·{" "}
          {formatCents(totals.revenueCents)} Umsatz
        </p>
      )}

      <div className="flex items-end justify-between gap-3 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">
          {light === "rot"
            ? "Ab hier meldet die Plattform deine Verkäufe dieses Jahres ans Finanzamt."
            : light
              ? `Noch ${left.sales} ${left.sales === 1 ? "Verkauf" : "Verkäufe"} bzw. ${formatCents(left.revenueCents)}`
              : "Keine Meldegrenze, da mehrere Plattformen zusammengefasst sind."}
        </span>
        <span
          className={`shrink-0 font-medium tabular-nums ${profitTone(totals.profitCents)}`}
        >
          {formatCents(totals.profitCents)} Gewinn
        </span>
      </div>
    </li>
  );
}

async function Overview({
  searchParams,
}: {
  searchParams: PageProps<"/uebersicht">["searchParams"];
}) {
  await connection();
  const currentYear = getCurrentYear();
  const { jahr } = await searchParams;
  const year = parseYear(jahr);

  const supabase = await createClient();
  const data = await loadYear(supabase, year);
  if (!data) {
    return <p className="text-red-600">Die Übersicht konnte nicht geladen werden.</p>;
  }
  const { limits, totals, byMonth, byPlatform } = data;

  // Plattformen mit Verkäufen, die mit der höchsten Ampelstufe zuerst
  const order: Record<Light, number> = { rot: 0, gelb: 1, gruen: 2 };
  const used = (Object.keys(byPlatform) as SalePlatform[])
    .filter((p) => byPlatform[p].count > 0)
    .sort((a, b) => {
      const la = (REPORTING_PLATFORMS as readonly string[]).includes(a)
        ? order[reportingLight(byPlatform[a], limits)]
        : 3;
      const lb = (REPORTING_PLATFORMS as readonly string[]).includes(b)
        ? order[reportingLight(byPlatform[b], limits)]
        : 3;
      return la - lb || byPlatform[b].count - byPlatform[a].count;
    });
  const unused = REPORTING_PLATFORMS.filter((p) => byPlatform[p].count === 0);
  const months = byMonth
    .map((m, i) => ({ ...m, name: MONTHS[i] }))
    .filter((m) => m.count > 0);

  return (
    <>
      <nav
        className="flex items-center justify-between"
        aria-label="Jahr wählen"
      >
        <Link
          href={`/uebersicht?jahr=${year - 1}`}
          className="px-2 py-1 text-zinc-600 dark:text-zinc-400"
        >
          ‹ {year - 1}
        </Link>
        <span className="text-lg font-semibold">{year}</span>
        {year < currentYear ? (
          <Link
            href={`/uebersicht?jahr=${year + 1}`}
            className="px-2 py-1 text-zinc-600 dark:text-zinc-400"
          >
            {year + 1} ›
          </Link>
        ) : (
          <span className="w-14" />
        )}
      </nav>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Gewinn</p>
          <p
            className={`text-xl font-semibold tabular-nums ${profitTone(totals.profitCents)}`}
          >
            {formatCents(totals.profitCents)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Umsatz</p>
          <p className="text-xl font-semibold tabular-nums">
            {formatCents(totals.revenueCents)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Verkäufe</p>
          <p className="text-xl font-semibold tabular-nums">{totals.count}</p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Melde-Ampel</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Plattformen melden Verkäufe ans Finanzamt ab {limits.sales}{" "}
            Verkäufen oder mehr als {formatCents(limits.revenueCents)} Umsatz im
            Jahr, je Plattform. Gelb ab 80 %.
          </p>
        </div>

        {used.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            {year === currentYear
              ? "Noch keine Verkäufe in diesem Jahr."
              : `Keine Verkäufe in ${year}.`}{" "}
            Sobald du bei einem{" "}
            <Link href="/artikel" className="underline">
              Artikel
            </Link>{" "}
            einen Verkauf erfasst, siehst du hier, wie nah du an der Meldegrenze
            bist.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {used.map((p) => (
              <PlatformCard
                key={p}
                platform={p}
                totals={byPlatform[p]}
                limits={limits}
              />
            ))}
          </ul>
        )}

        {used.length > 0 && unused.length > 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Keine Verkäufe über{" "}
            {unused.map((p) => SALE_PLATFORM_LABELS[p]).join(" und ")}.
          </p>
        )}
      </section>

      {months.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Nach Monat</h2>
          <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {months.map((m) => (
              <li
                key={m.name}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>
                  {m.name}
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {" "}
                    · {m.count} {m.count === 1 ? "Verkauf" : "Verkäufe"}
                  </span>
                </span>
                <span className={`tabular-nums ${profitTone(m.profitCents)}`}>
                  {formatCents(m.profitCents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {totals.count > 0 && (
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Jahresübersicht exportieren</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Alle Verkäufe {year} mit Gewinn, zum Beispiel für deine Unterlagen. CSV lässt sich in Excel
          oder Numbers öffnen.
        </p>
        <div className="flex gap-3">
          <a
            href={`/uebersicht/export?jahr=${year}&format=pdf`}
            className="rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
          >
            PDF
          </a>
          <a
            href={`/uebersicht/export?jahr=${year}&format=csv`}
            className="rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
          >
            CSV
          </a>
        </div>
      </section>
      )}

      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Gezählt werden alle nicht stornierten Verkäufe, die du hier erfasst
        hast. Für die Meldegrenze nimmt die App den vollen Verkaufspreis, damit
        die Warnung eher zu früh als zu spät kommt. Gewinn = Verkaufspreis −
        Einkaufspreis − Gebühr − Versand − Verpackung, im Jahr des Verkaufs. Die
        App rechnet mit deinen Eingaben und erklärt allgemein. Was davon
        steuerlich für dich gilt, hängt von deinem Einzelfall ab.
      </p>
    </>
  );
}

export default function UebersichtPage({
  searchParams,
}: PageProps<"/uebersicht">) {
  return (
    <>
      <h1 className="text-2xl font-semibold">Übersicht</h1>
      <Suspense fallback={<p>Wird geladen …</p>}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </>
  );
}
