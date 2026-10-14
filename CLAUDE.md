# Reseller-Tracker

Web-App (PWA) für Reseller auf Vinted, Kleinanzeigen und eBay. Zeigt den echten Gewinn pro Artikel und warnt, bevor die Plattform-Meldegrenzen ans Finanzamt erreicht sind (ab 30 Verkäufen oder mehr als 2.000 € Umsatz pro Plattform und Kalenderjahr; befreit ist nur, wer unter 30 Verkäufen UND höchstens 2.000 € bleibt).

Ziel: erste zahlende Version Anfang Januar 2027.

## Stack

- Next.js (App Router) mit TypeScript
- Tailwind CSS
- Supabase: Postgres, Auth (E-Mail), Storage für Fotos und Belege, Region Frankfurt
- Stripe für Abos (erst Phase 3)
- Hosting: Vercel
- Als PWA installierbar

## Regeln

- Oberfläche komplett auf Deutsch, mobil zuerst gestalten.
- Beträge immer als ganze Zahl in Cent speichern, nie als Kommazahl. Anzeige im deutschen Format (1.234,56 €).
- Row Level Security auf allen Tabellen: Jeder Nutzer sieht nur seine eigenen Daten.
- Meldegrenzen (30 Verkäufe / 2.000 €) als Einstellung speichern, nicht fest im Code.
- Preismodell: kostenlos bis 20 Artikel, danach Abo. Gezählt wird jeder je angelegte Artikel (Löschen schafft keinen Platz). Keine zeitliche Testphase. Die Grenze wird in der Datenbank durchgesetzt (`free_item_limit()`), nicht nur in der Oberfläche.
- Status "verkauft" setzt nur die Datenbank: genau dann, wenn ein aktiver (nicht stornierter) Verkauf existiert. Rückgabe → "retour", Storno → "gelistet" (Funktion `cancel_sale`).
- Keine Automatisierung auf Vinted oder anderen Plattformen: kein Scraping, kein Relisting, kein Crossposting, kein Zugriff auf Nutzerkonten dort.
- Keine Steuerberatung in Texten: Die App rechnet und erklärt allgemein, beurteilt aber nie den Einzelfall (z. B. nicht "Du bist gewerblich"). Formulierungen wie "Ab hier meldet die Plattform deine Verkäufe ans Finanzamt" sind okay.
- "Vinted" nicht im App-Namen oder Logo verwenden.
- Kleine, verständliche Schritte. Nach jeder Funktion kurz erklären, was gebaut wurde und wie man es testet.

## Datenmodell (Version 1)

- **profiles**: id (= auth user), email, subscription_status (free | active | past_due | canceled), items_created_count, created_at. Für Nutzer nur lesbar.
- **items**: id, user_id, name, category, purchase_date, purchase_price_cents, purchase_source (flohmarkt | vinted | privat | laden | sonstige), item_type (eigener_gebrauchtgegenstand | weiterverkauf), status (lager | gelistet | verkauft | retour), photo_path, note, created_at
- **receipts**: id, item_id, user_id, file_path, type (kassenbon | ueberweisung | screenshot | sonstiges), created_at
- **sales**: id, item_id, user_id, sale_date, platform (vinted | kleinanzeigen | ebay | sonstige), sale_price_cents, platform_fee_cents, shipping_cents, packaging_cents, cancelled (bool), created_at. Höchstens ein aktiver Verkauf pro Artikel.
- **settings**: user_id, report_threshold_sales (Standard 30), report_threshold_revenue_cents (Standard 200000)

Gewinn, Monats-/Jahreswerte und Melde-Ampel werden berechnet, nicht gespeichert.
Gewinn pro Artikel = sale_price − purchase_price − platform_fee − shipping − packaging.

## Funktionsumfang Version 1

1. Artikel anlegen, bearbeiten, löschen, Liste mit Filter nach Status
2. Foto und Beleg pro Artikel hochladen
3. Verkauf erfassen (inkl. Gebühr, Versand, Verpackung), Rückgabe/Storno
4. Übersicht: Gewinn pro Artikel, Monat, Jahr, Plattform
5. Melde-Ampel pro Plattform und Kalenderjahr (grün / gelb ab 80 % / rot ab Grenze)
6. Export der Jahresübersicht als CSV und PDF
7. Login, Konto und Daten löschen, Daten exportieren

Später (nicht jetzt bauen): Screenshot-Import mit KI, Ausgaben ohne Artikelbezug, Gewerbe-Modus, Ladenhüter-Ansicht, Gebührenrechner.

## Phase 1 · Fundament (abgeschlossen)

- [x] Next.js-Projekt aufsetzen, Supabase anbinden, Umgebungsvariablen in `.env.local` (nie committen)
- [x] Login per E-Mail (Magic Link)
- [x] Tabellen per SQL-Migration anlegen, inkl. Row Level Security
- [x] Artikel anlegen, bearbeiten, löschen, Liste mit Statusfilter
- [x] Foto und Beleg hochladen (Supabase Storage, privater Bucket)

## Aktuelle Phase: 2 · Verkäufe und Auswertung

- [x] Verkauf erfassen (inkl. Gebühr, Versand, Verpackung), Rückgabe/Storno
- [x] Übersicht: Gewinn pro Artikel, Monat, Jahr, Plattform
- [x] Melde-Ampel pro Plattform und Kalenderjahr (rot ab Grenze, gelb ab 80 %; Umsatz = voller Verkaufspreis, damit eher zu früh gewarnt wird)

## Datenbank-Änderungen

Migrationen liegen in `supabase/migrations/` und werden im Supabase SQL Editor ausgeführt.
Tests in `supabase/tests/` laufen ebenfalls dort und machen am Ende alles rückgängig.
Nach jeder Migration alle Tests erneut ausführen.
