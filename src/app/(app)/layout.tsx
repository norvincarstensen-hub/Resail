import { Suspense } from "react";
import { NavLink } from "./nav-link";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <nav className="flex gap-1" aria-label="Hauptnavigation">
            {/* Hervorhebung hängt an der Adresse, deshalb in eigenem Ladebereich */}
            <Suspense fallback={<NavLink href="/uebersicht" static>Übersicht</NavLink>}>
              <NavLink href="/uebersicht">Übersicht</NavLink>
            </Suspense>
            <Suspense fallback={<NavLink href="/artikel" static>Artikel</NavLink>}>
              <NavLink href="/artikel">Artikel</NavLink>
            </Suspense>
          </nav>
          <Suspense fallback={<NavLink href="/konto" static>Konto</NavLink>}>
            <NavLink href="/konto">Konto</NavLink>
          </Suspense>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
