import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCsv, buildPdf } from "@/lib/export";
import { loadYear, parseYear } from "@/lib/year-data";

// Jahresübersicht als Datei: /uebersicht/export?jahr=2026&format=csv|pdf
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const format = params.get("format") === "csv" ? "csv" : "pdf";
  const year = parseYear(params.get("jahr"));

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const data = await loadYear(supabase, year);
  if (!data) return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });

  const headers = { "Cache-Control": "no-store" };
  if (format === "csv") {
    return new NextResponse(buildCsv(data), {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="jahresuebersicht-${year}.csv"`,
      },
    });
  }

  const pdf = await buildPdf(data, String(claims.claims.email ?? ""));
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="jahresuebersicht-${year}.pdf"`,
    },
  });
}
