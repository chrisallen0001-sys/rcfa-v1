import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await params;

    const rcfa = await prisma.rcfa.findUnique({ where: { id } });
    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    if (rcfa.createdByUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (rcfa.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft RCFAs can be moved to investigation" },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.rcfa.update({
        where: { id },
        data: { status: "investigation" },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "status_changed",
          eventPayload: { from: "draft", to: "investigation" },
        },
      });
    });

    return NextResponse.json({ status: "investigation" }, { status: 200 });
  } catch (error) {
    console.error("POST /api/rcfa/[id]/start-investigation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
