// Typen und Beschriftungen für Artikel, passend zur Datenbank (supabase/migrations).

export const ITEM_STATUSES = ["lager", "gelistet", "verkauft", "retour"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_TYPES = ["weiterverkauf", "eigener_gebrauchtgegenstand"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const PURCHASE_SOURCES = ["flohmarkt", "vinted", "privat", "laden", "sonstige"] as const;
export type PurchaseSource = (typeof PURCHASE_SOURCES)[number];

export type Item = {
  id: string;
  name: string;
  category: string | null;
  purchase_date: string | null;
  purchase_price_cents: number;
  purchase_source: PurchaseSource | null;
  item_type: ItemType;
  status: ItemStatus;
  note: string | null;
  created_at: string;
};

export const STATUS_LABELS: Record<ItemStatus, string> = {
  lager: "Im Lager",
  gelistet: "Gelistet",
  verkauft: "Verkauft",
  retour: "Retour",
};

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  weiterverkauf: "Zum Weiterverkauf gekauft",
  eigener_gebrauchtgegenstand: "Eigener Gebrauchtgegenstand",
};

export const ITEM_TYPE_HINTS: Record<ItemType, string> = {
  weiterverkauf: "Du hast den Artikel gekauft, um ihn wieder zu verkaufen.",
  eigener_gebrauchtgegenstand: "Du hast den Artikel selbst genutzt und verkaufst ihn jetzt.",
};

export const PURCHASE_SOURCE_LABELS: Record<PurchaseSource, string> = {
  flohmarkt: "Flohmarkt",
  vinted: "Vinted",
  privat: "Privat",
  laden: "Laden",
  sonstige: "Sonstige",
};

export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

// Heutiges Datum in deutscher Zeit als YYYY-MM-DD (für Datumsfelder).
export function todayInBerlin(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

// "2026-10-14" → "14.10.2026"
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}
