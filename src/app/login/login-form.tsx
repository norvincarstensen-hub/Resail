"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <div className="rounded-lg border border-green-600/30 bg-green-50 p-4 text-green-900 dark:bg-green-950 dark:text-green-100">
        <p className="font-medium">Schau in dein Postfach.</p>
        <p className="mt-1 text-sm">
          Wir haben einen Anmelde-Link an <strong>{state.message}</strong> geschickt. Öffne ihn
          in diesem Browser.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        E-Mail-Adresse
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="du@beispiel.de"
        className="rounded-lg border border-zinc-300 bg-transparent px-3 py-3 text-base dark:border-zinc-700"
      />
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground px-4 py-3 font-medium text-background disabled:opacity-60"
      >
        {pending ? "Wird gesendet …" : "Anmelde-Link senden"}
      </button>
    </form>
  );
}
