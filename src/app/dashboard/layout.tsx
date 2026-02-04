import { getAuthContext } from "@/lib/auth-context";
import AppHeader from "@/components/AppHeader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { displayName } = await getAuthContext();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppHeader displayName={displayName} />
      <main>{children}</main>
    </div>
  );
}
