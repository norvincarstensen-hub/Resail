import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { todayInBerlin, type Item } from "@/lib/items";
import { updateItem } from "../actions";
import { DeleteButton } from "../delete-button";
import { ItemForm } from "../item-form";

export const metadata: Metadata = { title: "Artikel bearbeiten · Reseller-Tracker" };

async function EditItem({ params }: { params: PageProps<"/artikel/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select(
      "id, name, category, purchase_date, purchase_price_cents, purchase_source, item_type, status, note, created_at",
    )
    .eq("id", id)
    .maybeSingle<Item>();

  // Fremde Artikel liefert die Datenbank (RLS) gar nicht erst aus.
  if (!item) notFound();

  return (
    <>
      <ItemForm
        action={updateItem.bind(null, item.id)}
        item={item}
        today={todayInBerlin()}
        submitLabel="Speichern"
      />
      <DeleteButton id={item.id} name={item.name} />
    </>
  );
}

export default function ArtikelBearbeitenPage({ params }: PageProps<"/artikel/[id]">) {
  return (
    <>
      <h1 className="text-2xl font-semibold">Artikel bearbeiten</h1>
      <Suspense fallback={<p>Wird geladen …</p>}>
        <EditItem params={params} />
      </Suspense>
    </>
  );
}
