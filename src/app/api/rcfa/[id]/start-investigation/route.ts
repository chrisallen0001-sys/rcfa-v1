import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid RCFA id" }, { status: 400 });
    }

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
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "draft") {
        throw new Error("RCFA_NOT_DRAFT");
      }

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
    if (error instanceof Error && error.message === "RCFA_NOT_DRAFT") {
      return NextResponse.json(
        { error: "Only draft RCFAs can be moved to investigation" },
        { status: 409 }
      );
    }
    console.error("POST /api/rcfa/[id]/start-investigation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
