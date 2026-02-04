import Image from "next/image";
import Link from "next/link";
import UserMenu from "./UserMenu";

interface AppHeaderProps {
  displayName: string;
}

export default function AppHeader({ displayName }: AppHeaderProps) {
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
        <UserMenu displayName={displayName} />
      </div>
    </header>
  );
}
