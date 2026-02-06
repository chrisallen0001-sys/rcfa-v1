import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid RCFA id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const closingNotes =
      typeof body.closingNotes === "string"
        ? body.closingNotes.trim() || null
        : null;

    const rcfa = await prisma.rcfa.findUnique({ where: { id } });
    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    if (rcfa.ownerUserId !== userId && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (rcfa.status !== "actions_open") {
      return NextResponse.json(
        { error: "Only RCFAs with status actions_open can be closed" },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "actions_open") {
        throw new Error("RCFA_NOT_ACTIONS_OPEN");
      }

      const finalRootCauseCount = await tx.rcfaRootCauseFinal.count({
        where: { rcfaId: id },
      });
      if (finalRootCauseCount === 0) {
        throw new Error("RCFA_NO_ROOT_CAUSES");
      }

      const incompleteActionCount = await tx.rcfaActionItem.count({
        where: {
          rcfaId: id,
          status: { notIn: ["done", "canceled"] },
        },
      });
      if (incompleteActionCount > 0) {
        throw new Error("RCFA_INCOMPLETE_ACTIONS");
      }

      await tx.rcfa.update({
        where: { id },
        data: {
          status: "closed",
          closedAt: new Date(),
          closedByUserId: userId,
          closingNotes,
        },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "status_changed",
          eventPayload: {
            from: "actions_open",
            to: "closed",
            closingNotes,
          },
        },
      });
    });

    return NextResponse.json({ status: "closed" }, { status: 200 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RCFA_NOT_ACTIONS_OPEN"
    ) {
      return NextResponse.json(
        { error: "Only RCFAs with status actions_open can be closed" },
        { status: 409 }
      );
    }
    if (
      error instanceof Error &&
      error.message === "RCFA_NO_ROOT_CAUSES"
    ) {
      return NextResponse.json(
        { error: "At least one final root cause is required to close the RCFA" },
        { status: 422 }
      );
    }
    if (
      error instanceof Error &&
      error.message === "RCFA_INCOMPLETE_ACTIONS"
    ) {
      return NextResponse.json(
        { error: "All action items must be done or canceled before closing" },
        { status: 422 }
      );
    }
    console.error("POST /api/rcfa/[id]/close error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
