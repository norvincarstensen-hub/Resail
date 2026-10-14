"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";
import { FILE_BUCKET, isItemFilePath } from "@/lib/files";
import {
  ITEM_STATUSES,
  ITEM_TYPES,
  PURCHASE_SOURCES,
  RECEIPT_TYPES,
  SALE_PLATFORMS,
  isOneOf,
  type ItemStatus,
  type ItemType,
  type PurchaseSource,
  type SalePlatform,
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
  const { data, error } = await supabase.from("items").insert(input).select("id").single();

  if (error || !data) {
    if (error.hint === "free_item_limit_reached") {
      return {
        error:
          "Du hast die 20 kostenlosen Artikel aufgebraucht. Mit einem Abo kannst du unbegrenzt weitere anlegen.",
      };
    }
    return { error: "Der Artikel konnte nicht gespeichert werden. Bitte versuche es erneut." };
  }

  revalidatePath("/artikel");
  // Direkt zur Artikelseite, damit man gleich ein Foto hinzufügen kann.
  redirect(`/artikel/${data.id}?neu=1`);
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

  if (error?.hint === "status_has_active_sale") {
    return { error: "Der Artikel ist verkauft. Erfasse eine Rückgabe oder ein Storno, um den Status zu ändern." };
  }
  if (error?.hint === "status_requires_sale") {
    return { error: "Den Status „Verkauft“ setzt die App, wenn du einen Verkauf erfasst." };
  }
  if (error || !data?.length) {
    return { error: "Der Artikel konnte nicht gespeichert werden. Bitte versuche es erneut." };
  }

  revalidatePath("/artikel");
  redirect("/artikel");
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}

export async function deleteItem(id: string): Promise<void> {
  const supabase = await createClient();
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  // Erst die Dateien löschen: Die Speicher-Regeln erlauben das nur, solange der Artikel existiert.
  const folder = `${userId}/${id}`;
  const { data: files } = await supabase.storage.from(FILE_BUCKET).list(folder, { limit: 1000 });
  if (files?.length) {
    await supabase.storage.from(FILE_BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
  }

  await supabase.from("items").delete().eq("id", id);
  revalidatePath("/artikel");
  redirect("/artikel");
}

export type FileActionResult = { error?: string };

// Speichert ein bereits hochgeladenes Foto am Artikel und löscht das vorherige.
export async function setItemPhoto(itemId: string, path: string | null): Promise<FileActionResult> {
  const userId = await currentUserId();
  if (!userId) return { error: "Bitte melde dich erneut an." };
  if (path !== null && !isItemFilePath(path, userId, itemId)) return { error: "Ungültiger Dateipfad." };

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select("photo_path")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { error: "Artikel nicht gefunden." };

  const { error } = await supabase.from("items").update({ photo_path: path }).eq("id", itemId);
  if (error) return { error: "Das Foto konnte nicht gespeichert werden." };

  if (item.photo_path && item.photo_path !== path) {
    await supabase.storage.from(FILE_BUCKET).remove([item.photo_path]);
  }

  revalidatePath("/artikel");
  revalidatePath(`/artikel/${itemId}`);
  return {};
}

// Legt zu einer bereits hochgeladenen Datei einen Beleg-Eintrag an.
export async function addReceipt(
  itemId: string,
  path: string,
  type: string,
): Promise<FileActionResult> {
  const userId = await currentUserId();
  if (!userId) return { error: "Bitte melde dich erneut an." };
  if (!isItemFilePath(path, userId, itemId)) return { error: "Ungültiger Dateipfad." };
  if (!isOneOf(RECEIPT_TYPES, type)) return { error: "Bitte wähle eine Belegart." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("receipts")
    .insert({ item_id: itemId, file_path: path, type });
  if (error) return { error: "Der Beleg konnte nicht gespeichert werden." };

  revalidatePath(`/artikel/${itemId}`);
  return {};
}

export async function deleteReceipt(receiptId: string): Promise<FileActionResult> {
  const supabase = await createClient();
  const { data: receipt } = await supabase
    .from("receipts")
    .select("item_id, file_path")
    .eq("id", receiptId)
    .maybeSingle();
  if (!receipt) return { error: "Beleg nicht gefunden." };

  await supabase.storage.from(FILE_BUCKET).remove([receipt.file_path]);
  const { error } = await supabase.from("receipts").delete().eq("id", receiptId);
  if (error) return { error: "Der Beleg konnte nicht gelöscht werden." };

  revalidatePath(`/artikel/${receipt.item_id}`);
  return {};
}

// ---------------------------------------------------------------------------
// Verkäufe
// ---------------------------------------------------------------------------

export type SaleFormState = { error?: string; saved?: number };

type SaleInput = {
  sale_date: string;
  platform: SalePlatform;
  sale_price_cents: number;
  platform_fee_cents: number;
  shipping_cents: number;
  packaging_cents: number;
};

function parseCents(formData: FormData, key: string, label: string, required = false): number | string {
  const value = text(formData, key);
  if (value === "") return required ? `Bitte gib den ${label} ein.` : 0;
  const cents = parseEuroToCents(value);
  return cents === null ? `Der Betrag bei „${label}“ ist ungültig. Beispiel: 12,50` : cents;
}

function parseSaleForm(formData: FormData): SaleInput | string {
  const platform = text(formData, "platform");
  if (!isOneOf(SALE_PLATFORMS, platform)) return "Bitte wähle die Plattform.";

  const date = text(formData, "sale_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Bitte gib das Verkaufsdatum ein.";

  const price = parseCents(formData, "sale_price", "Verkaufspreis", true);
  if (typeof price === "string") return price;
  const fee = parseCents(formData, "platform_fee", "Gebühr");
  if (typeof fee === "string") return fee;
  const shipping = parseCents(formData, "shipping", "Versand");
  if (typeof shipping === "string") return shipping;
  const packaging = parseCents(formData, "packaging", "Verpackung");
  if (typeof packaging === "string") return packaging;

  return {
    sale_date: date,
    platform,
    sale_price_cents: price,
    platform_fee_cents: fee,
    shipping_cents: shipping,
    packaging_cents: packaging,
  };
}

export async function createSale(
  itemId: string,
  _prev: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  const input = parseSaleForm(formData);
  if (typeof input === "string") return { error: input };

  const supabase = await createClient();
  const { error } = await supabase.from("sales").insert({ ...input, item_id: itemId });
  if (error?.code === "23505") {
    return { error: "Für diesen Artikel ist schon ein Verkauf erfasst." };
  }
  if (error) return { error: "Der Verkauf konnte nicht gespeichert werden. Bitte versuche es erneut." };

  revalidatePath("/artikel");
  revalidatePath(`/artikel/${itemId}`);
  return { saved: Date.now() };
}

export async function updateSale(
  saleId: string,
  itemId: string,
  _prev: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  const input = parseSaleForm(formData);
  if (typeof input === "string") return { error: input };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales")
    .update(input)
    .eq("id", saleId)
    .eq("cancelled", false)
    .select("id");
  if (error || !data?.length) {
    return { error: "Der Verkauf konnte nicht gespeichert werden. Bitte versuche es erneut." };
  }

  revalidatePath("/artikel");
  revalidatePath(`/artikel/${itemId}`);
  return { saved: Date.now() };
}

export async function cancelSale(
  saleId: string,
  itemId: string,
  reason: "rueckgabe" | "storno",
): Promise<FileActionResult> {
  if (reason !== "rueckgabe" && reason !== "storno") return { error: "Ungültiger Grund." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_sale", { sale_id: saleId, reason });
  if (error) return { error: "Das hat nicht geklappt. Bitte lade die Seite neu und versuche es erneut." };

  revalidatePath("/artikel");
  revalidatePath(`/artikel/${itemId}`);
  return {};
}
