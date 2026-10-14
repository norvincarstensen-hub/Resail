"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FILE_BUCKET } from "@/lib/files";
import { parseEuroToCents } from "@/lib/money";

export type SettingsState = { error?: string; saved?: boolean };

export async function saveThresholds(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const salesInput = String(formData.get("sales") ?? "").trim();
  const revenueInput = String(formData.get("revenue") ?? "").trim();

  const sales = Number(salesInput);
  if (!/^\d+$/.test(salesInput) || sales < 1 || sales > 100000) {
    return { error: "Bitte gib bei Verkäufen eine ganze Zahl ab 1 ein." };
  }
  const revenueCents = parseEuroToCents(revenueInput);
  if (revenueCents === null || revenueCents < 100) {
    return { error: "Bitte gib beim Umsatz einen Betrag ab 1,00 € ein." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .update({ report_threshold_sales: sales, report_threshold_revenue_cents: revenueCents })
    .not("user_id", "is", null)
    .select("user_id");
  if (error || !data?.length) return { error: "Die Einstellungen konnten nicht gespeichert werden." };

  revalidatePath("/uebersicht");
  revalidatePath("/konto");
  return { saved: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type DeleteState = { error?: string };

// Löscht erst alle Dateien im eigenen Ordner, dann das Konto mit allen Daten.
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "LÖSCHEN") {
    return { error: "Bitte tippe LÖSCHEN in das Feld, um zu bestätigen." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  // Dateien liegen unter <user_id>/<item_id>/<datei>
  const storage = supabase.storage.from(FILE_BUCKET);
  const { data: folders, error: listError } = await storage.list(userId, { limit: 10000 });
  if (listError) return { error: "Deine Dateien konnten nicht gelöscht werden. Bitte versuche es erneut." };
  for (const folder of folders ?? []) {
    const prefix = `${userId}/${folder.name}`;
    const { data: files } = await storage.list(prefix, { limit: 10000 });
    if (files?.length) {
      const { error } = await storage.remove(files.map((f) => `${prefix}/${f.name}`));
      if (error) return { error: "Deine Dateien konnten nicht gelöscht werden. Bitte versuche es erneut." };
    }
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "Dein Konto konnte nicht gelöscht werden. Bitte versuche es erneut." };

  await supabase.auth.signOut();
  redirect("/login?geloescht=1");
}
