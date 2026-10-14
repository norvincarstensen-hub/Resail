// Export der Jahresübersicht als CSV (für Excel/Numbers) und PDF.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { centsToInput, formatCents } from "./money";
import { ITEM_TYPE_LABELS, SALE_PLATFORM_LABELS, SALE_PLATFORMS, formatDate, profitCents } from "./items";
import { REPORTING_PLATFORMS, remaining, reportingLight, type Light } from "./stats";
import type { YearData } from "./year-data";

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];


// ---------------------------------------------------------------------------
// CSV: Semikolon und Dezimalkomma, damit deutsches Excel es direkt richtig öffnet
// ---------------------------------------------------------------------------

function csvField(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Freitext (Artikelname): Text, der mit = + - @ beginnt, würde Excel als Formel ausführen.
// Zahlen dürfen nicht so behandelt werden, sonst wird "-3,30" zu Text.
function csvText(value: string): string {
  return csvField(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
}

export function buildCsv(data: YearData): string {
  const header = [
    "Verkaufsdatum", "Artikel", "Erwerbsart", "Kaufdatum", "Plattform",
    "Verkaufspreis", "Einkaufspreis", "Gebühr", "Versand", "Verpackung", "Gewinn",
  ];
  const lines = [header.join(";")];
  for (const s of data.sales) {
    lines.push(
      [
        formatDate(s.sale_date),
        csvText(s.item_name),
        s.item_type ? ITEM_TYPE_LABELS[s.item_type] : "",
        s.purchase_date ? formatDate(s.purchase_date) : "",
        SALE_PLATFORM_LABELS[s.platform],
        centsToInput(s.sale_price_cents),
        centsToInput(s.purchase_price_cents),
        centsToInput(s.platform_fee_cents),
        centsToInput(s.shipping_cents),
        centsToInput(s.packaging_cents),
        centsToInput(profitCents(s.purchase_price_cents, s)),
      ]
        .map((v, i) => (i === 1 ? v : csvField(v)))
        .join(";"),
    );
  }
  // BOM, damit Excel Umlaute richtig erkennt
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

// Die Standardschrift kann nur westeuropäische Zeichen. Alles andere wird ersetzt.
const EXTRA = "€‚„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function safe(text: string): string {
  return Array.from(text.replace(/\s+/g, " "))
    .map((c) => {
      const code = c.codePointAt(0)!;
      return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || EXTRA.includes(c) ? c : "?";
    })
    .join("");
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;
const GREY = rgb(0.4, 0.4, 0.4);
const LIGHT_COLOR: Record<Light, ReturnType<typeof rgb>> = {
  gruen: rgb(0.09, 0.64, 0.29),
  gelb: rgb(0.96, 0.62, 0.04),
  rot: rgb(0.86, 0.15, 0.15),
};
const LIGHT_LABEL: Record<Light, string> = {
  gruen: "Unter der Grenze",
  gelb: "Bald erreicht",
  rot: "Grenze erreicht",
};

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(
    private doc: PDFDocument,
    public font: PDFFont,
    public bold: PDFFont,
  ) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.y = A4.h - MARGIN;
  }
  ensure(space: number) {
    if (this.y - space < MARGIN) this.newPage();
  }
  text(t: string, opts: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; right?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const s = safe(t);
    const x = opts.right !== undefined ? opts.right - font.widthOfTextAtSize(s, size) : (opts.x ?? MARGIN);
    this.page.drawText(s, { x, y: this.y, size, font, color: opts.color ?? rgb(0, 0, 0) });
  }
  line(height = 14) {
    this.y -= height;
  }
  rule() {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y + 4 },
      end: { x: A4.w - MARGIN, y: this.y + 4 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
  }
  // Text auf eine Breite kürzen
  fit(t: string, width: number, size = 10): string {
    let s = safe(t);
    if (this.font.widthOfTextAtSize(s, size) <= width) return s;
    while (s.length > 1 && this.font.widthOfTextAtSize(s + "…", size) > width) s = s.slice(0, -1);
    return s + "…";
  }
}

export async function buildPdf(data: YearData, email: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Jahresübersicht ${data.year}`);
  doc.setLanguage("de-DE");
  const w = new Writer(
    doc,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
  );
  const right = A4.w - MARGIN;

  w.text(`Jahresübersicht ${data.year}`, { size: 20, bold: true });
  w.line(18);
  w.text(`Reseller-Tracker · ${email} · erstellt am ${new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}`, { color: GREY, size: 9 });
  w.line(28);

  // Jahreswerte
  w.text("Gewinn", { color: GREY });
  w.text("Umsatz", { x: MARGIN + 170, color: GREY });
  w.text("Verkäufe", { x: MARGIN + 340, color: GREY });
  w.line(16);
  w.text(formatCents(data.totals.profitCents), { size: 14, bold: true });
  w.text(formatCents(data.totals.revenueCents), { x: MARGIN + 170, size: 14, bold: true });
  w.text(String(data.totals.count), { x: MARGIN + 340, size: 14, bold: true });
  w.line(30);

  // Melde-Ampel
  w.text("Melde-Ampel", { size: 13, bold: true });
  w.line(14);
  w.text(
    `Gemeldet wird ab ${data.limits.sales} Verkäufen oder mehr als ${formatCents(data.limits.revenueCents)} Umsatz je Plattform und Jahr.`,
    { size: 9, color: GREY },
  );
  w.line(18);
  for (const p of REPORTING_PLATFORMS) {
    const t = data.byPlatform[p];
    const light = reportingLight(t, data.limits);
    const left = remaining(t, data.limits);
    w.page.drawCircle({ x: MARGIN + 4, y: w.y + 3.5, size: 4, color: LIGHT_COLOR[light] });
    w.text(SALE_PLATFORM_LABELS[p], { x: MARGIN + 14, bold: true });
    w.text(`${t.count} / ${data.limits.sales} Verkäufe`, { x: MARGIN + 120 });
    w.text(`${formatCents(t.revenueCents)} / ${formatCents(data.limits.revenueCents)}`, { x: MARGIN + 240 });
    w.text(LIGHT_LABEL[light], { right });
    w.line(13);
    w.text(
      light === "rot"
        ? "Ab hier meldet die Plattform deine Verkäufe dieses Jahres ans Finanzamt."
        : `Noch ${left.sales} Verkäufe bzw. ${formatCents(left.revenueCents)} bis zur Meldegrenze.`,
      { x: MARGIN + 14, size: 9, color: GREY },
    );
    w.line(18);
  }
  w.line(8);

  // Nach Plattform und Monat
  w.text("Gewinn nach Plattform", { size: 13, bold: true });
  w.line(18);
  for (const p of SALE_PLATFORMS) {
    const t = data.byPlatform[p];
    if (!t.count) continue;
    w.text(SALE_PLATFORM_LABELS[p]);
    w.text(`${t.count} Verkäufe`, { x: MARGIN + 150 });
    w.text(`${formatCents(t.revenueCents)} Umsatz`, { x: MARGIN + 250 });
    w.text(formatCents(t.profitCents), { right });
    w.line(14);
  }
  if (!data.totals.count) {
    w.text("Keine Verkäufe in diesem Jahr.", { color: GREY });
    w.line(14);
  }
  w.line(12);

  w.ensure(60);
  w.text("Gewinn nach Monat", { size: 13, bold: true });
  w.line(18);
  data.byMonth.forEach((m, i) => {
    if (!m.count) return;
    w.text(MONTHS[i]);
    w.text(`${m.count} Verkäufe`, { x: MARGIN + 150 });
    w.text(`${formatCents(m.revenueCents)} Umsatz`, { x: MARGIN + 250 });
    w.text(formatCents(m.profitCents), { right });
    w.line(14);
  });
  w.line(12);

  // Einzelne Verkäufe
  if (data.sales.length) {
    const cols = { date: MARGIN, item: MARGIN + 58, platform: MARGIN + 220, price: MARGIN + 340, cost: MARGIN + 420 };
    const head = () => {
      w.text("Datum", { x: cols.date, size: 9, bold: true });
      w.text("Artikel", { x: cols.item, size: 9, bold: true });
      w.text("Plattform", { x: cols.platform, size: 9, bold: true });
      w.text("Verkauf", { right: cols.price, size: 9, bold: true });
      w.text("Kosten", { right: cols.cost, size: 9, bold: true });
      w.text("Gewinn", { right, size: 9, bold: true });
      w.line(4);
      w.rule();
      w.line(10);
    };
    w.ensure(80);
    w.text("Alle Verkäufe", { size: 13, bold: true });
    w.line(18);
    head();
    for (const s of data.sales) {
      if (w.y - 12 < MARGIN) {
        w.newPage();
        head();
      }
      const costs = s.purchase_price_cents + s.platform_fee_cents + s.shipping_cents + s.packaging_cents;
      w.text(formatDate(s.sale_date), { x: cols.date, size: 9 });
      w.text(w.fit(s.item_name, cols.platform - cols.item - 8, 9), { x: cols.item, size: 9 });
      w.text(SALE_PLATFORM_LABELS[s.platform], { x: cols.platform, size: 9 });
      w.text(formatCents(s.sale_price_cents), { right: cols.price, size: 9 });
      w.text(formatCents(costs), { right: cols.cost, size: 9 });
      w.text(formatCents(profitCents(s.purchase_price_cents, s)), { right, size: 9 });
      w.line(12);
    }
    w.text("Kosten = Einkaufspreis + Gebühr + Versand + Verpackung.", { size: 8, color: GREY });
    w.line(16);
  }

  w.ensure(40);
  w.text("Die App rechnet mit deinen Eingaben und erklärt allgemein. Was davon steuerlich für dich gilt,", { size: 8, color: GREY });
  w.line(10);
  w.text("hängt von deinem Einzelfall ab. Für die Meldegrenze wird der volle Verkaufspreis gezählt.", { size: 8, color: GREY });

  return doc.save();
}
