import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

// Supabase-Client für Client Components (läuft im Browser).
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
