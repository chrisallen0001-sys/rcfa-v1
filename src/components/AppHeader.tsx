import GuardedLink from "./GuardedLink";
import UserMenu from "./UserMenu";
import AletheiaLogo from "./AletheiaLogo";
import DashboardNav from "./DashboardNav";
import HeaderHeightPublisher from "./HeaderHeightPublisher";
import type { AppUserRole } from "@/generated/prisma/client";

interface AppHeaderProps {
  displayName: string;
  role: AppUserRole;
}

export default function AppHeader({ displayName, role }: AppHeaderProps) {
  return (
    <HeaderHeightPublisher className="sticky top-0 z-40 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4">
        {/* Top row: Logo and user menu */}
        <div className="flex items-center justify-between py-3">
          <GuardedLink href="/dashboard" className="flex items-center">
            <AletheiaLogo className="h-8 w-auto text-zinc-900 dark:text-zinc-50" />
          </GuardedLink>
          <UserMenu displayName={displayName} role={role} />
        </div>
        {/* Navigation row */}
        <div className="-mb-px flex items-center overflow-x-auto pb-3">
          <DashboardNav />
        </div>
      </div>
    </HeaderHeightPublisher>
  );
}
