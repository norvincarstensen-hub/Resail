"use client";

import Link from "next/link";
import { useActionState } from "react";
import { centsToInput } from "@/lib/money";
import {
  ITEM_TYPES,
  MANUAL_STATUSES,
  ITEM_TYPE_HINTS,
  ITEM_TYPE_LABELS,
  PURCHASE_SOURCES,
  PURCHASE_SOURCE_LABELS,
  STATUS_LABELS,
  type Item,
} from "@/lib/items";
import type { ItemFormState } from "./actions";
import { SelectWrapper, selectClass } from "./select";

type Props = {
  action: (prev: ItemFormState, formData: FormData) => Promise<ItemFormState>;
  item?: Item;
  today: string;
  submitLabel: string;
};

const field = "flex flex-col gap-1";
const label = "text-sm font-medium";
const input =
  "rounded-lg border border-zinc-300 bg-transparent px-3 py-3 text-base dark:border-zinc-700";

export function ItemForm({ action, item, today, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className={field}>
        <label htmlFor="name" className={label}>
          Name *
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={200}
          defaultValue={item?.name}
          placeholder="z. B. Levi's 501, Größe 32"
          className={input}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${label} mb-1`}>Wie hast du den Artikel erworben? *</legend>
        {ITEM_TYPES.map((type) => (
          <label
            key={type}
            className="flex gap-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700"
          >
            <input
              type="radio"
              name="item_type"
              value={type}
              required
              defaultChecked={item?.item_type === type}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">{ITEM_TYPE_LABELS[type]}</span>
              <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                {ITEM_TYPE_HINTS[type]}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className={field}>
          <label htmlFor="purchase_price" className={label}>
            Einkaufspreis (€)
          </label>
          <input
            id="purchase_price"
            name="purchase_price"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={item ? centsToInput(item.purchase_price_cents) : ""}
            className={input}
          />
        </div>
        <div className={field}>
          <label htmlFor="purchase_date" className={label}>
            Kaufdatum
          </label>
          <input
            id="purchase_date"
            name="purchase_date"
            type="date"
            defaultValue={item ? (item.purchase_date ?? "") : today}
            className={input}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={field}>
          <label htmlFor="purchase_source" className={label}>
            Gekauft bei
          </label>
          <SelectWrapper>
          <select
            id="purchase_source"
            name="purchase_source"
            defaultValue={item?.purchase_source ?? ""}
            className={selectClass}
          >
            <option value="">–</option>
            {PURCHASE_SOURCES.map((source) => (
              <option key={source} value={source}>
                {PURCHASE_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
          </SelectWrapper>
        </div>
        <div className={field}>
          <label htmlFor="status" className={label}>
            Status
          </label>
          {item?.status === "verkauft" ? (
            // Verkauft bleibt verkauft, bis eine Rückgabe oder ein Storno erfasst wird.
            <>
              <input type="hidden" name="status" value="verkauft" />
              <p id="status" className="rounded-lg border border-zinc-200 px-3 py-3 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                {STATUS_LABELS.verkauft}
              </p>
            </>
          ) : (
            <SelectWrapper>
              <select
                id="status"
                name="status"
                defaultValue={item?.status ?? "lager"}
                className={selectClass}
              >
                {MANUAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </SelectWrapper>
          )}
        </div>
      </div>

      <div className={field}>
        <label htmlFor="category" className={label}>
          Kategorie
        </label>
        <input
          id="category"
          name="category"
          defaultValue={item?.category ?? ""}
          placeholder="z. B. Hosen"
          className={input}
        />
      </div>

      <div className={field}>
        <label htmlFor="note" className={label}>
          Notiz
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={item?.note ?? ""}
          className={input}
        />
      </div>

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
        <Link
          href="/artikel"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-center dark:border-zinc-700"
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
