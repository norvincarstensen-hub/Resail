"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";
import {
  ITEM_STATUSES,
  ITEM_TYPES,
  PURCHASE_SOURCES,
  isOneOf,
  type ItemStatus,
  type ItemType,
  type PurchaseSource,
} from "@/lib/items";

export type ItemFormState = { error?: string };

type ItemInput = {
  name: string;
  category: string | null;
  purchase_date: string | null;
  purchase_price_cents: number;
  purchase_source: PurchaseSource | null;
  item_type: ItemType;
  status: ItemStatus;
  note: string | null;
};

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// Prüft die Formulareingaben. Gibt entweder die Daten oder eine Fehlermeldung zurück.
function parseItemForm(formData: FormData): ItemInput | string {
  const name = text(formData, "name");
  if (!name) return "Bitte gib einen Namen ein.";
  if (name.length > 200) return "Der Name ist zu lang (höchstens 200 Zeichen).";

  const itemType = text(formData, "item_type");
  if (!isOneOf(ITEM_TYPES, itemType)) return "Bitte wähle aus, wie du den Artikel erworben hast.";

  const status = text(formData, "status");
  if (!isOneOf(ITEM_STATUSES, status)) return "Bitte wähle einen gültigen Status.";

  const source = text(formData, "purchase_source");
  if (source && !isOneOf(PURCHASE_SOURCES, source)) return "Bitte wähle eine gültige Bezugsquelle.";

  const priceInput = text(formData, "purchase_price");
  const price = priceInput === "" ? 0 : parseEuroToCents(priceInput);
  if (price === null) return "Der Einkaufspreis ist ungültig. Beispiel: 12,50";

  const date = text(formData, "purchase_date");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Das Kaufdatum ist ungültig.";

  return {
    name,
    category: text(formData, "category") || null,
    purchase_date: date || null,
    purchase_price_cents: price,
    purchase_source: (source || null) as PurchaseSource | null,
    item_type: itemType,
    status,
    note: text(formData, "note") || null,
  };
}

export async function createItem(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const input = parseItemForm(formData);
  if (typeof input === "string") return { error: input };

  const supabase = await createClient();
  const { error } = await supabase.from("items").insert(input);

  if (error) {
    if (error.hint === "free_item_limit_reached") {
      return {
        error:
          "Du hast die 20 kostenlosen Artikel aufgebraucht. Mit einem Abo kannst du unbegrenzt weitere anlegen.",
      };
    }
    return { error: "Der Artikel konnte nicht gespeichert werden. Bitte versuche es erneut." };
  }

  revalidatePath("/artikel");
  redirect("/artikel");
}

export async function updateItem(
  id: string,
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const input = parseItemForm(formData);
  if (typeof input === "string") return { error: input };

  const supabase = await createClient();
  const { data, error } = await supabase.from("items").update(input).eq("id", id).select("id");

  if (error || !data?.length) {
    return { error: "Der Artikel konnte nicht gespeichert werden. Bitte versuche es erneut." };
  }

  revalidatePath("/artikel");
  redirect("/artikel");
}

export async function deleteItem(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("items").delete().eq("id", id);
  revalidatePath("/artikel");
  redirect("/artikel");
}
