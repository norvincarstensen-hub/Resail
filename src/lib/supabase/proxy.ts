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
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Nicht angemeldet → zur Anmeldung, außer auf den öffentlichen Seiten.
  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth");
  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  // Wichtig: immer `response` zurückgeben, damit die Session-Cookies erhalten bleiben.
  return response;
}
