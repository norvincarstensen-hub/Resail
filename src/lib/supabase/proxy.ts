import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

// Frischt bei jeder Anfrage die Login-Session auf und schreibt die
// aktualisierten Cookies in Anfrage und Antwort.
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Zwischen createServerClient und getClaims keinen weiteren Code einfügen,
  // sonst können Nutzer zufällig ausgeloggt werden.
  await supabase.auth.getClaims();

  // Weiterleitung auf /login für geschützte Seiten folgt mit dem Login-Schritt.

  return response;
}
