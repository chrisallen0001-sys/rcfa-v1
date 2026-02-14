import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    const { id } = await params;

    // Only admins can reassign ownership
    if (role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can reassign RCFA ownership" },
        { status: 403 }
      );
    }

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid RCFA ID" }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { newOwnerUserId } = body as { newOwnerUserId?: string };

    if (!newOwnerUserId || !UUID_RE.test(newOwnerUserId)) {
      return NextResponse.json(
        { error: "newOwnerUserId is required and must be a valid UUID" },
        { status: 400 }
      );
    }

    // Verify the new owner exists and is active (outside transaction since it won't change)
    const newOwner = await prisma.appUser.findUnique({
      where: { id: newOwnerUserId },
      select: { id: true, displayName: true, status: true },
    });

    if (!newOwner) {
      return NextResponse.json({ error: "Owner user not found" }, { status: 400 });
    }

    if (newOwner.status !== "active") {
      return NextResponse.json(
        { error: "Cannot assign to a non-active user" },
        { status: 400 }
      );
    }

    // Use interactive transaction to ensure consistent reads and writes
    const result = await prisma.$transaction(async (tx) => {
      // Verify the RCFA exists and is not deleted
      const rcfa = await tx.rcfa.findUnique({
        where: { id },
        select: { id: true, ownerUserId: true, deletedAt: true },
      });

      if (!rcfa || rcfa.deletedAt) {
        return { error: "RCFA not found", status: 404 } as const;
      }

      // Skip if already the owner
      if (rcfa.ownerUserId === newOwnerUserId) {
        return {
          success: true,
          ownerUserId: newOwnerUserId,
          ownerDisplayName: newOwner.displayName,
        } as const;
      }

      // Get the previous owner for audit trail (inside transaction for consistency)
      const previousOwner = await tx.appUser.findUnique({
        where: { id: rcfa.ownerUserId },
        select: { displayName: true },
      });

      // Update owner
      await tx.rcfa.update({
        where: { id },
        data: { ownerUserId: newOwnerUserId },
      });

      // Create audit event
      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "owner_changed",
          eventPayload: {
            previousOwnerId: rcfa.ownerUserId,
            previousOwnerName: previousOwner?.displayName ?? "Unknown",
            newOwnerId: newOwnerUserId,
            newOwnerName: newOwner.displayName,
          },
        },
      });

      return {
        success: true,
        ownerUserId: newOwnerUserId,
        ownerDisplayName: newOwner.displayName,
      } as const;
    });

    // Handle transaction result
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /api/rcfa/[id]/owner error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
