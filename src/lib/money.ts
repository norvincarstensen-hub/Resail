// Beträge werden immer als ganze Cent gespeichert, nie als Kommazahl.

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

// 123456 → "1.234,56 €"
export function formatCents(cents: number): string {
  return euro.format(cents / 100);
}

// 123456 → "1234,56" (für Eingabefelder)
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

// Liest einen eingegebenen Euro-Betrag und gibt Cent zurück, ohne Rundungsfehler.
// Akzeptiert "12", "12,5", "12,50", "1.234,56", "1234.56", "12 €".
// Gibt null zurück, wenn die Eingabe kein gültiger, nicht-negativer Betrag ist.
export function parseEuroToCents(input: string): number | null {
  let s = input.replace(/[\s€]/g, "");
  if (s === "") return null;

  // Punkte vor dem Komma sind nur als Tausendertrenner erlaubt (1.234.567).
  // Ohne Komma gilt "12.50" als Dezimalpunkt, so wie manche Tastaturen ihn liefern.
  let euroPart: string;
  let centPart = "";
  if (s.includes(",")) {
    [euroPart, centPart] = s.split(",", 2);
    if (s.split(",").length > 2) return null;
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    [euroPart, centPart] = s.split(".");
  } else {
    euroPart = s;
  }
  if (euroPart.includes(".")) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(euroPart)) return null;
    euroPart = euroPart.replace(/\./g, "");
  }
  s = centPart === "" && !s.includes(",") ? euroPart : `${euroPart}.${centPart}`;

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!match) return null;

  const euros = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const total = euros * 100 + cents;
  return Number.isSafeInteger(total) && total <= 2_147_483_647 ? total : null;
}
