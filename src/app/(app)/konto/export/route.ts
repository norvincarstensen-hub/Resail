import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FILE_BUCKET } from "@/lib/files";
import { todayInBerlin } from "@/lib/items";

const LINK_DAYS = 7;

// Alle eigenen Daten als JSON-Datei (Datenauskunft nach DSGVO).
// Fotos und Belege sind als Download-Links enthalten, die 7 Tage gültig sind.
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const [profile, settings, items, sales, receipts] = await Promise.all([
    supabase.from("profiles").select("*").single(),
    supabase.from("settings").select("*").single(),
    supabase.from("items").select("*").order("created_at"),
    supabase.from("sales").select("*").order("created_at"),
    supabase.from("receipts").select("*").order("created_at"),
  ]);
  if (profile.error || settings.error || items.error || sales.error || receipts.error) {
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }

  const paths = [
    ...(items.data ?? []).map((i) => i.photo_path as string | null),
    ...(receipts.data ?? []).map((r) => r.file_path as string),
  ].filter((p): p is string => Boolean(p));
  const { data: signed } = paths.length
    ? await supabase.storage.from(FILE_BUCKET).createSignedUrls(paths, LINK_DAYS * 24 * 60 * 60)
    : { data: [] };
  const links = Object.fromEntries((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const body = {
    erstellt_am: new Date().toISOString(),
    hinweis: `Beträge in Cent. Die Links zu Fotos und Belegen sind ${LINK_DAYS} Tage gültig.`,
    profil: profile.data,
    einstellungen: settings.data,
    artikel: (items.data ?? []).map((i) => ({ ...i, foto_link: i.photo_path ? links[i.photo_path] ?? null : null })),
    verkaeufe: sales.data,
    belege: (receipts.data ?? []).map((r) => ({ ...r, datei_link: links[r.file_path] ?? null })),
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="reseller-tracker-daten-${todayInBerlin()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
