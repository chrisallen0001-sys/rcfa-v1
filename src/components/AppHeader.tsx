import UserMenu from "./UserMenu";

interface AppHeaderProps {
  displayName: string;
}

export default function AppHeader({ displayName }: AppHeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          RCFA
        </div>
        <UserMenu displayName={displayName} />
      </div>
    </header>
  );
}
