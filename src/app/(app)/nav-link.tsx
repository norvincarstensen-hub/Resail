"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const base = "rounded-full px-3 py-1.5 text-sm";
const inactive = "text-zinc-600 dark:text-zinc-400";

function ActiveNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${base} ${active ? "bg-foreground text-background" : inactive}`}
    >
      {children}
    </Link>
  );
}

// "static": ohne Hervorhebung, als Platzhalter während die Adresse noch geladen wird
export function NavLink({
  href,
  children,
  static: isStatic = false,
}: {
  href: string;
  children: React.ReactNode;
  static?: boolean;
}) {
  if (isStatic) {
    return (
      <Link href={href} className={`${base} ${inactive}`}>
        {children}
      </Link>
    );
  }
  return <ActiveNavLink href={href}>{children}</ActiveNavLink>;
}
