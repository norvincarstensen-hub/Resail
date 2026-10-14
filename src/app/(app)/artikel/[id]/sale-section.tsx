"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { centsToInput, formatCents } from "@/lib/money";
import {
  SALE_PLATFORMS,
  SALE_PLATFORM_LABELS,
  formatDate,
  profitCents,
  type Sale,
} from "@/lib/items";
import { cancelSale, createSale, updateSale, type SaleFormState } from "../actions";
import { SelectWrapper, selectClass } from "../select";

type Props = {
  itemId: string;
  purchasePriceCents: number;
  sales: Sale[];
  today: string;
};

const input =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 text-base dark:border-zinc-700";
const label = "text-sm font-medium";

export function SaleSection({ itemId, purchasePriceCents, sales, today }: Props) {
  const active = sales.find((s) => !s.cancelled) ?? null;
  const cancelled = sales.filter((s) => s.cancelled);
  const [editing, setEditing] = useState(false);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">Verkauf</h2>

      {active && !editing && (
        <ActiveSale
          sale={active}
          itemId={itemId}
          purchasePriceCents={purchasePriceCents}
          onEdit={() => setEditing(true)}
        />
      )}

      {active && editing && (
        <SaleForm
          key={active.id}
          action={updateSale.bind(null, active.id, itemId)}
          sale={active}
          today={today}
          submitLabel="Änderungen speichern"
          onDone={() => setEditing(false)}
        />
      )}

      {!active && !editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg bg-foreground px-4 py-3 font-medium text-background"
        >
          Als verkauft erfassen
        </button>
      )}

      {!active && editing && (
        <SaleForm
          action={createSale.bind(null, itemId)}
          today={today}
          submitLabel="Verkauf speichern"
          onDone={() => setEditing(false)}
        />
      )}

      {cancelled.length > 0 && (
        <div className="border-t border-zinc-200 pt-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          <p className="font-medium">Frühere, stornierte Verkäufe</p>
          <ul>
            {cancelled.map((s) => (
              <li key={s.id}>
                {formatDate(s.sale_date)} · {SALE_PLATFORM_LABELS[s.platform]} ·{" "}
                {formatCents(s.sale_price_cents)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ActiveSale({
  sale,
  itemId,
  purchasePriceCents,
  onEdit,
}: {
  sale: Sale;
  itemId: string;
  purchasePriceCents: number;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const profit = profitCents(purchasePriceCents, sale);

  function cancel(reason: "rueckgabe" | "storno") {
    const question =
      reason === "rueckgabe"
        ? "Rückgabe erfassen? Der Verkauf wird storniert und der Artikel bekommt den Status „Retour“."
        : "Verkauf stornieren? Der Artikel bekommt wieder den Status „Gelistet“.";
    if (!window.confirm(question)) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelSale(sale.id, itemId, reason);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  const row = (text: string, cents: number, sign: "+" | "−") => (
    <div className="flex justify-between">
      <dt>{text}</dt>
      <dd className="tabular-nums">
        {sign} {formatCents(cents)}
      </dd>
    </div>
  );

  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Verkauft am {formatDate(sale.sale_date)} über {SALE_PLATFORM_LABELS[sale.platform]}
      </p>
      <dl className="flex flex-col gap-1">
        {row("Verkaufspreis", sale.sale_price_cents, "+")}
        {row("Einkaufspreis", purchasePriceCents, "−")}
        {sale.platform_fee_cents > 0 && row("Gebühr", sale.platform_fee_cents, "−")}
        {sale.shipping_cents > 0 && row("Versand", sale.shipping_cents, "−")}
        {sale.packaging_cents > 0 && row("Verpackung", sale.packaging_cents, "−")}
        <div className="mt-1 flex justify-between border-t border-zinc-200 pt-2 text-lg font-semibold dark:border-zinc-800">
          <dt>Gewinn</dt>
          <dd className={`tabular-nums ${profit < 0 ? "text-red-600" : "text-green-700 dark:text-green-400"}`}>
            {formatCents(profit)}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-60 dark:border-zinc-700"
        >
          Bearbeiten
        </button>
        <button
          type="button"
          onClick={() => cancel("rueckgabe")}
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-60 dark:border-zinc-700"
        >
          Rückgabe
        </button>
        <button
          type="button"
          onClick={() => cancel("storno")}
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-60 dark:border-zinc-700"
        >
          Storno
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </>
  );
}

function SaleForm({
  action,
  sale,
  today,
  submitLabel,
  onDone,
}: {
  action: (prev: SaleFormState, formData: FormData) => Promise<SaleFormState>;
  sale?: Sale;
  today: string;
  submitLabel: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, {});

  // Nach erfolgreichem Speichern Formular schließen und Seite neu laden
  useEffect(() => {
    if (state.saved) {
      onDone();
      router.refresh();
    }
  }, [state.saved, onDone, router]);

  const money = (cents: number | undefined) => (cents ? centsToInput(cents) : "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="platform" className={label}>
            Plattform *
          </label>
          <SelectWrapper>
            <select
              id="platform"
              name="platform"
              required
              defaultValue={sale?.platform ?? ""}
              className={selectClass}
            >
              <option value="" disabled>
                Bitte wählen
              </option>
              {SALE_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {SALE_PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          </SelectWrapper>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sale_date" className={label}>
            Verkaufsdatum *
          </label>
          <input
            id="sale_date"
            name="sale_date"
            type="date"
            required
            defaultValue={sale?.sale_date ?? today}
            className={input}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="sale_price" className={label}>
          Verkaufspreis (€) *
        </label>
        <input
          id="sale_price"
          name="sale_price"
          inputMode="decimal"
          required
          placeholder="0,00"
          defaultValue={money(sale?.sale_price_cents)}
          className={input}
        />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Was der Käufer für den Artikel bezahlt hat, ohne Versand, den er extra zahlt.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="platform_fee" className={label}>
            Gebühr (€)
          </label>
          <input
            id="platform_fee"
            name="platform_fee"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={money(sale?.platform_fee_cents)}
            className={input}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="shipping" className={label}>
            Versand (€)
          </label>
          <input
            id="shipping"
            name="shipping"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={money(sale?.shipping_cents)}
            className={input}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="packaging" className={label}>
            Verpackung (€)
          </label>
          <input
            id="packaging"
            name="packaging"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={money(sale?.packaging_cents)}
            className={input}
          />
        </div>
      </div>
      <p className="-mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Nur Kosten, die du selbst getragen hast. Zahlt der Käufer den Versand direkt an die
        Plattform, bleibt das Feld leer.
      </p>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-foreground px-4 py-3 font-medium text-background disabled:opacity-60"
        >
          {pending ? "Wird gespeichert …" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
