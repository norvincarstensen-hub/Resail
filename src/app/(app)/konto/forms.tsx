"use client";

import { useActionState } from "react";
import { centsToInput } from "@/lib/money";
import { DEFAULT_THRESHOLDS } from "@/lib/stats";
import {
  deleteAccount,
  saveThresholds,
  type DeleteState,
  type SettingsState,
} from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 text-base dark:border-zinc-700";

export function ThresholdsForm({ sales, revenueCents }: { sales: number; revenueCents: number }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveThresholds, {});
  const isDefault = sales === DEFAULT_THRESHOLDS.sales && revenueCents === DEFAULT_THRESHOLDS.revenueCents;

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="sales" className="text-sm font-medium">
            Verkäufe pro Jahr
          </label>
          <input id="sales" name="sales" inputMode="numeric" defaultValue={sales} className={input} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="revenue" className="text-sm font-medium">
            Umsatz pro Jahr (€)
          </label>
          <input
            id="revenue"
            name="revenue"
            inputMode="decimal"
            defaultValue={centsToInput(revenueCents)}
            className={input}
          />
        </div>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Standard: {DEFAULT_THRESHOLDS.sales} Verkäufe und 2.000,00 €. Ändere die Werte nur, wenn sich
        die gesetzlichen Grenzen ändern.
        {!isDefault && " Du verwendest gerade eigene Werte."}
      </p>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.saved && !state.error && <p className="text-sm text-green-700 dark:text-green-400">Gespeichert.</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-foreground px-4 py-3 font-medium text-background disabled:opacity-60"
        >
          {pending ? "Wird gespeichert …" : "Speichern"}
        </button>
        {!isDefault && (
          <button
            type="submit"
            disabled={pending}
            onClick={(e) => {
              const form = e.currentTarget.form!;
              (form.elements.namedItem("sales") as HTMLInputElement).value = String(DEFAULT_THRESHOLDS.sales);
              (form.elements.namedItem("revenue") as HTMLInputElement).value = centsToInput(DEFAULT_THRESHOLDS.revenueCents);
            }}
            className="rounded-lg border border-zinc-300 px-4 py-3 disabled:opacity-60 dark:border-zinc-700"
          >
            Standard wiederherstellen
          </button>
        )}
      </div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm">
        Löscht dein Konto mit allen Artikeln, Verkäufen, Fotos und Belegen. Das lässt sich nicht
        rückgängig machen. Lade vorher deine Daten herunter, wenn du sie behalten willst.
      </p>
      <label htmlFor="confirm" className="text-sm font-medium">
        Zum Bestätigen LÖSCHEN eintippen
      </label>
      <input id="confirm" name="confirm" autoComplete="off" className={input} />
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-red-300 px-4 py-3 text-red-700 disabled:opacity-60 dark:border-red-800 dark:text-red-300"
      >
        {pending ? "Wird gelöscht …" : "Konto endgültig löschen"}
      </button>
    </form>
  );
}
