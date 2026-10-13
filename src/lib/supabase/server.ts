import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

// Supabase-Client für Server Components, Server Functions und Route Handler.
// Pro Anfrage neu erzeugen, nie global zwischenspeichern.
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // In Server Components dürfen keine Cookies gesetzt werden.
          // Unkritisch, weil der Proxy (src/proxy.ts) die Session auffrischt.
        }
      },
    },
  });
}
