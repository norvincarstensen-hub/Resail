import { Suspense } from "react";
import { connection } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Prüft, ob Supabase mit den Werten aus .env.local erreichbar ist.
async function checkSupabase(): Promise<{ ok: boolean; message: string }> {
  // Erst zur Anfragezeit prüfen, nicht beim Build.
  await connection();
  let env;
  try {
    env = getSupabaseEnv();
  } catch {
    return {
      ok: false,
      message: "Umgebungsvariablen fehlen – bitte .env.local anlegen.",
    };
  }

  try {
    const res = await fetch(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.publishableKey },
      cache: "no-store",
    });
    if (res.ok) return { ok: true, message: "Supabase ist verbunden." };
    return {
      ok: false,
      message: `Supabase antwortet mit Fehler ${res.status} – Schlüssel prüfen.`,
    };
  } catch {
    return {
      ok: false,
      message: "Supabase nicht erreichbar – Projekt-URL prüfen.",
    };
  }
}

async function SupabaseStatus() {
  const { ok, message } = await checkSupabase();
  return <p className={ok ? "text-green-700" : "text-red-600"}>{message}</p>;
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Reseller-Tracker</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Grundgerüst steht. Als Nächstes: Login per E-Mail.
      </p>
      <Suspense fallback={<p>Verbindung wird geprüft …</p>}>
        <SupabaseStatus />
      </Suspense>
    </main>
  );
}
