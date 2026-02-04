import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();

    let body: { currentPassword?: string; newPassword?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "currentPassword and newPassword are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await prisma.appUser.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/change-password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
