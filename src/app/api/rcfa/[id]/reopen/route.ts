import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid RCFA id" }, { status: 400 });
    }

    // Only admins can reopen closed RCFAs
    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rcfa = await prisma.rcfa.findUnique({ where: { id } });
    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    if (rcfa.status !== "closed") {
      return NextResponse.json(
        { error: "Only closed RCFAs can be reopened" },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "closed") {
        throw new Error("RCFA_NOT_CLOSED");
      }

      await tx.rcfa.update({
        where: { id },
        data: {
          status: "actions_open",
          // Clear closed fields - RCFA is now open again
          closedAt: null,
          closedByUserId: null,
          closingNotes: null,
        },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "status_changed",
          eventPayload: {
            from: "closed",
            to: "actions_open",
            reason: "reopened",
            previousClosedAt: locked.closedAt,
            previousClosedByUserId: locked.closedByUserId,
            previousClosingNotes: locked.closingNotes,
          },
        },
      });
    });

    return NextResponse.json({ status: "actions_open" }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "RCFA_NOT_CLOSED") {
      return NextResponse.json(
        { error: "Only closed RCFAs can be reopened" },
        { status: 409 }
      );
    }
    console.error("POST /api/rcfa/[id]/reopen error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
