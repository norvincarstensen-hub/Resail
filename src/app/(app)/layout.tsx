import Link from "next/link";
import { signOut } from "./actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/artikel" className="font-semibold">
            Reseller-Tracker
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-sm text-zinc-600 dark:text-zinc-400">
              Abmelden
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
