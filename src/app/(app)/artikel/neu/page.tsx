import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { todayInBerlin } from "@/lib/items";
import { createItem } from "../actions";
import { ItemForm } from "../item-form";

export const metadata: Metadata = { title: "Neuer Artikel · Reseller-Tracker" };

async function NewItemForm() {
  // Datum zur Anfragezeit bestimmen, nicht beim Build.
  await connection();
  return <ItemForm action={createItem} today={todayInBerlin()} submitLabel="Artikel anlegen" />;
}

export default function NeuerArtikelPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Neuer Artikel</h1>
      <Suspense fallback={<p>Wird geladen …</p>}>
        <NewItemForm />
      </Suspense>
    </>
  );
}
