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
      },
    });

    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Write audit event before deletion (captures RCFA info for record)
      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "rcfa_deleted",
          eventPayload: {
            title: rcfa.title,
            status: rcfa.status,
            equipmentDescription: rcfa.equipmentDescription,
          },
        },
      });

      // Delete the RCFA (cascades to all child records via ON DELETE CASCADE)
      await tx.rcfa.delete({ where: { id } });
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
