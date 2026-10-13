import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

async function Account() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims.email;

  if (!email) redirect("/login");

  return (
    <div className="flex flex-col gap-4">
      <p>
        Angemeldet als <strong>{email}</strong>
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700"
        >
          Abmelden
        </button>
      </form>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Reseller-Tracker</h1>
      <Suspense fallback={<p>Wird geladen …</p>}>
        <Account />
      </Suspense>
    </main>
  );
}
