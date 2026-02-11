"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", exact: true },
  { href: "/dashboard/rcfas", label: "RCFAs", exact: false },
  { href: "/dashboard/action-items", label: "Action Items", exact: false },
];

export default function DashboardNav() {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean): boolean {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
