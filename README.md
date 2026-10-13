# Reseller-Tracker

Web-App für Reseller (Vinted, Kleinanzeigen, eBay). Projektregeln und Plan stehen in [`CLAUDE.md`](CLAUDE.md).

## Lokal starten

```bash
npm install
cp .env.example .env.local   # Werte aus Supabase eintragen
npm run dev
```

Dann http://localhost:3000 öffnen. Die Startseite zeigt, ob Supabase erreichbar ist.

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Supabase (`@supabase/ssr`).
Supabase-Clients liegen in `src/lib/supabase/`, die Session wird in `src/proxy.ts` aufgefrischt.
