import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden · Reseller-Tracker" };

async function LinkError({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { fehler } = await searchParams;
  if (!fehler) return null;
  return (
    <p className="text-sm text-red-600">
      Der Anmelde-Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Anmelden</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Gib deine E-Mail-Adresse ein. Du bekommst einen Link, mit dem du dich ohne Passwort
          anmeldest.
        </p>
      </div>
      <Suspense>
        <LinkError searchParams={searchParams} />
      </Suspense>
      <LoginForm />
    </main>
  );
}
