import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

const VALID_STATUSES: UserStatus[] = ["active", "disabled"];
const SALT_ROUNDS = 10;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { forbidden, userId: currentUserId } = await requireAdmin();
    if (forbidden) return forbidden;

    const { userId } = await params;

    let body: { role?: string; status?: string; mustResetPassword?: boolean; temporaryPassword?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { role: newRole, status: newStatus, mustResetPassword, temporaryPassword } = body;

    // Validate mustResetPassword type if provided
    if (mustResetPassword !== undefined && typeof mustResetPassword !== "boolean") {
      return NextResponse.json(
        { error: "mustResetPassword must be a boolean" },
        { status: 400 }
      );
    }

    // Validate that at least one field is provided
    if (!newRole && !newStatus && mustResetPassword === undefined && !temporaryPassword) {
      return NextResponse.json(
        { error: "At least one of role, status, mustResetPassword, or temporaryPassword is required" },
        { status: 400 }
      );
    }

    // Prevent setting temporary password on own account
    if (userId === currentUserId && temporaryPassword) {
      return NextResponse.json(
        { error: "Cannot set temporary password on your own account" },
        { status: 400 }
      );
    }

    // Validate temporary password length
    if (temporaryPassword && temporaryPassword.length < 8) {
      return NextResponse.json(
        { error: "Temporary password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate role if provided
    if (newRole && newRole !== "admin" && newRole !== "user") {
      return NextResponse.json(
        { error: "role must be 'admin' or 'user'" },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (newStatus && !VALID_STATUSES.includes(newStatus as UserStatus)) {
      return NextResponse.json(
        { error: "status must be 'active' or 'disabled'" },
        { status: 400 }
      );
    }

    // Prevent self-demotion
    if (userId === currentUserId && newRole && newRole !== "admin") {
      return NextResponse.json(
        { error: "Cannot demote yourself" },
        { status: 400 }
      );
    }

    // Prevent self-disable
    if (userId === currentUserId && newStatus && newStatus !== "active") {
      return NextResponse.json(
        { error: "Cannot disable yourself" },
        { status: 400 }
      );
    }

    const existing = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent setting temporary password on non-active users
    if (temporaryPassword && existing.status !== "active") {
      return NextResponse.json(
        { error: "Cannot set temporary password for a non-active user" },
        { status: 400 }
      );
    }

    const updateData: { role?: "admin" | "user"; status?: UserStatus; mustResetPassword?: boolean; passwordHash?: string } = {};
    if (newRole) {
      updateData.role = newRole as "admin" | "user";
    }
    if (newStatus) {
      updateData.status = newStatus as UserStatus;
    }
    if (mustResetPassword !== undefined) {
      updateData.mustResetPassword = mustResetPassword;
    }
    if (temporaryPassword) {
      updateData.passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
      updateData.mustResetPassword = true;
    }

    const updated = await prisma.appUser.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        mustResetPassword: true,
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
