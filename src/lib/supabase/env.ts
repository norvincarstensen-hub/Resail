// Liest die Supabase-Umgebungsvariablen und bricht mit einer klaren Meldung ab,
// wenn sie fehlen (statt später mit einem kryptischen Fehler).
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase-Umgebungsvariablen fehlen. Lege .env.local nach dem Muster von .env.example an.",
    );
  }

  return { url, publishableKey };
}
