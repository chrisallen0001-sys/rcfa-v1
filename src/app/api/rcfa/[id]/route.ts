import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { forbidden, userId } = await requireAdmin();
    if (forbidden) return forbidden;

    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid RCFA id" }, { status: 400 });
    }

    const rcfa = await prisma.rcfa.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        equipmentDescription: true,
        deletedAt: true,
      },
    });

    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    // Already soft-deleted
    if (rcfa.deletedAt) {
      return NextResponse.json(
        { error: "RCFA has already been deleted" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Soft delete: set deletedAt and deletedByUserId
      await tx.rcfa.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedByUserId: userId,
        },
      });

      // Write audit event for soft delete (GxP compliance)
      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "rcfa_soft_deleted",
          eventPayload: {
            title: rcfa.title,
            status: rcfa.status,
            equipmentDescription: rcfa.equipmentDescription,
          },
        },
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/rcfa/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
