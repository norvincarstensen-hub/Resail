"use client";

import { useTransition } from "react";
import { deleteItem } from "./actions";

export function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const ok = window.confirm(
      `„${name}“ wirklich löschen? Zugehörige Verkäufe und Belege werden ebenfalls gelöscht.\n\nHinweis: Gelöschte Artikel zählen weiter zu deinen 20 kostenlosen Artikeln.`,
    );
    if (ok) startTransition(() => deleteItem(id));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg border border-red-300 px-4 py-3 text-red-700 disabled:opacity-60 dark:border-red-800 dark:text-red-300"
    >
      {pending ? "Wird gelöscht …" : "Artikel löschen"}
    </button>
  );
}
