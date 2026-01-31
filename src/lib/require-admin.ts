import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

type AdminResult =
  | { forbidden: NextResponse; userId: string }
  | { forbidden: null; userId: string };

export async function requireAdmin(): Promise<AdminResult> {
  const { userId } = await getAuthContext();
  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role !== "admin") {
    return {
      forbidden: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId,
    };
  }
  return { forbidden: null, userId };
}
