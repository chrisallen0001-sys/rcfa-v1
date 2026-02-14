import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

const SALT_ROUNDS = 10;

export async function GET() {
  try {
    const { forbidden } = await requireAdmin();
    if (forbidden) return forbidden;

    const users = await prisma.appUser.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        mustResetPassword: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { forbidden } = await requireAdmin();
    if (forbidden) return forbidden;

    let body: {
      email?: string;
      displayName?: string;
      password?: string;
      role?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { email, displayName, password, role: newRole } = body;

    if (!email || !displayName || !password) {
      return NextResponse.json(
        { error: "email, displayName, and password are required" },
        { status: 400 }
      );
    }

    const emailNormalized = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (newRole && newRole !== "admin" && newRole !== "user") {
      return NextResponse.json(
        { error: "role must be 'admin' or 'user'" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.appUser.create({
      data: {
        email: emailNormalized,
        displayName: displayName.trim(),
        passwordHash,
        mustResetPassword: true,
        ...(newRole ? { role: newRole as "admin" | "user" } : {}),
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        mustResetPassword: user.mustResetPassword,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    console.error("POST /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
