import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

export async function GET() {
  try {
    await getAuthContext();

    const users = await prisma.appUser.findMany({
      select: { id: true, email: true, displayName: true },
      orderBy: { displayName: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
