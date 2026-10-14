import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { FILE_BUCKET, SIGNED_URL_SECONDS } from "@/lib/files";
import { todayInBerlin, type Item, type Receipt, type Sale } from "@/lib/items";
import { updateItem } from "../actions";
import { DeleteButton } from "../delete-button";
import { ItemForm } from "../item-form";
import { PhotoUpload } from "./photo-upload";
import { Receipts } from "./receipts";
import { SaleSection } from "./sale-section";

export const metadata: Metadata = { title: "Artikel bearbeiten · Reseller-Tracker" };

type PageArgs = PageProps<"/artikel/[id]">;

async function EditItem({ params }: { params: PageArgs["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: claims }, { data: item }, { data: receipts }, { data: sales }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("items")
      .select(
        "id, name, category, purchase_date, purchase_price_cents, purchase_source, item_type, status, photo_path, note, created_at",
      )
      .eq("id", id)
      .maybeSingle<Item>(),
    supabase
      .from("receipts")
      .select("id, file_path, type, created_at")
      .eq("item_id", id)
      .order("created_at")
      .returns<Receipt[]>(),
    supabase
      .from("sales")
      .select(
        "id, sale_date, platform, sale_price_cents, platform_fee_cents, shipping_cents, packaging_cents, cancelled",
      )
      .eq("item_id", id)
      .order("created_at", { ascending: false })
      .returns<Sale[]>(),
  ]);

  // Fremde Artikel liefert die Datenbank (RLS) gar nicht erst aus.
  const userId = claims?.claims.sub;
  if (!item || !userId) notFound();

  // Private Dateien nur über zeitlich begrenzte Links anzeigen
  const paths = [item.photo_path, ...(receipts ?? []).map((r) => r.file_path)].filter(
    (p): p is string => Boolean(p),
  );
  const { data: signed } = paths.length
    ? await supabase.storage.from(FILE_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
    : { data: [] };
  const urlFor = (path: string | null) =>
    (path && signed?.find((s) => s.path === path)?.signedUrl) || null;

  return (
    <>
      <PhotoUpload itemId={item.id} userId={userId} photoUrl={urlFor(item.photo_path)} />
      <SaleSection
        itemId={item.id}
        purchasePriceCents={item.purchase_price_cents}
        sales={sales ?? []}
        today={todayInBerlin()}
      />
      <ItemForm
        action={updateItem.bind(null, item.id)}
        item={item}
        today={todayInBerlin()}
        submitLabel="Speichern"
      />
      <Receipts
        itemId={item.id}
        userId={userId}
        receipts={(receipts ?? []).map((r) => ({
          id: r.id,
          type: r.type,
          created_at: r.created_at,
          url: urlFor(r.file_path),
        }))}
      />
      <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
        <DeleteButton id={item.id} name={item.name} />
      </div>
    </>
  );
}

async function NewItemNotice({ searchParams }: { searchParams: PageArgs["searchParams"] }) {
  const { neu } = await searchParams;
  if (!neu) return null;
  return (
    <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-100">
      Artikel angelegt. Du kannst jetzt ein Foto und Belege hinzufügen.
    </p>
  );
}

export default function ArtikelBearbeitenPage({ params, searchParams }: PageArgs) {
  return (
    <>
      <h1 className="text-2xl font-semibold">Artikel</h1>
      <Suspense>
        <NewItemNotice searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<p>Wird geladen …</p>}>
        <EditItem params={params} />
      </Suspense>
    </>
  );
}
