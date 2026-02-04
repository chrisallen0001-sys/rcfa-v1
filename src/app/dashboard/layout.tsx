import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import AppHeader from "@/components/AppHeader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await getAuthContext();

  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });

  const displayName = user?.displayName ?? "User";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppHeader displayName={displayName} />
      <main>{children}</main>
    </div>
  );
}
