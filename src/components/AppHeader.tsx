import Image from "next/image";
import Link from "next/link";
import UserMenu from "./UserMenu";
import type { AppUserRole } from "@/generated/prisma/client";

interface AppHeaderProps {
  displayName: string;
  role: AppUserRole;
}

export default function AppHeader({ displayName, role }: AppHeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center">
          <Image
            src="/aletheia_logo.png"
            alt="Aletheia"
            width={120}
            height={40}
            className="h-8 w-auto dark:invert"
            priority
          />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/intake"
            className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New RCFA</span>
          </Link>
          <UserMenu displayName={displayName} role={role} />
        </div>
      </div>
    </header>
  );
}
