import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

/**
 * GET /api/users - List users for dropdowns
 *
 * Query parameters:
 * - status: "active" (default) returns only active users for assignment dropdowns;
 *           "all" returns all users regardless of status (for table filter dropdowns
 *           that need historically-assigned inactive users).
 */
export async function GET(request: NextRequest) {
  try {
    await getAuthContext();

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    // Default to active-only so assignment dropdowns exclude disabled/pending users.
    // Pass ?status=all to include all users (e.g., for table filter dropdowns).
    const activeOnly = statusParam !== "all";

    const users = await prisma.appUser.findMany({
      select: { id: true, displayName: true },
      ...(activeOnly && { where: { status: "active" } }),
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
