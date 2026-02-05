import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import { notFound } from "next/navigation";
import Link from "next/link";
import UserManagement from "./UserManagement";

export const metadata: Metadata = {
  title: "User Management – RCFA",
};

export default async function AdminUsersPage() {
  const { userId, role } = await getAuthContext();
  if (role !== "admin") {
    notFound();
  }

  const users = await prisma.appUser.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Sort pending users to the top, then by createdAt
  const sortedUsers = [...users].sort((a, b) => {
    if (a.status === "pending_approval" && b.status !== "pending_approval") return -1;
    if (a.status !== "pending_approval" && b.status === "pending_approval") return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const pendingCount = users.filter((u) => u.status === "pending_approval").length;

  const serialized = sortedUsers.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role as string,
    status: u.status as string,
    createdAt: u.createdAt.toISOString().slice(0, 10),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            User Management
          </h1>
          {pendingCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {pendingCount} pending
            </span>
          )}
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Dashboard
        </Link>
      </div>
      <UserManagement initialUsers={serialized} currentUserId={userId} />
    </div>
  );
}
