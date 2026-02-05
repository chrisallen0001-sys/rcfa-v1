import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";
import { prisma } from "@/lib/prisma";

const SALT_ROUNDS = 10;

export async function POST(request: NextRequest) {
  try {
    let body: { email?: string; displayName?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { email, displayName, password } = body;

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

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.appUser.create({
      data: {
        email: emailNormalized,
        displayName: displayName.trim(),
        passwordHash,
        status: "pending_approval",
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    console.error("POST /api/auth/register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
