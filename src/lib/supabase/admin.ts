import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

// Supabase mit dem geheimen Schlüssel: umgeht Row Level Security.
// Nur für Server-Aufgaben, die kein Nutzer selbst darf (z. B. Abo-Status setzen).
// Niemals im Browser verwenden.
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY fehlt.");
  const { url } = getSupabaseEnv();
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
