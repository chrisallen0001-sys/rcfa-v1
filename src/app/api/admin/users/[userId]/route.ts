import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: currentUserId } = await getAuthContext();

    // Verify role from DB to guard against stale JWT
    const currentUser = await prisma.appUser.findUnique({
      where: { id: currentUserId },
      select: { role: true },
    });
    if (currentUser?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;

    let body: { role?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { role: newRole } = body;

    if (!newRole || (newRole !== "admin" && newRole !== "user")) {
      return NextResponse.json(
        { error: "role must be 'admin' or 'user'" },
        { status: 400 }
      );
    }

    // Prevent self-demotion
    if (userId === currentUserId && newRole !== "admin") {
      return NextResponse.json(
        { error: "Cannot demote yourself" },
        { status: 400 }
      );
    }

    const existing = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updated = await prisma.appUser.update({
      where: { id: userId },
      data: { role: newRole as "admin" | "user" },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/users/[userId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
