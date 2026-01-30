import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import type { Priority } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_PRIORITIES: Priority[] = ["low", "medium", "high"];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();
    const actionText =
      typeof body.actionText === "string" ? body.actionText.trim() : "";
    const successCriteria =
      typeof body.successCriteria === "string"
        ? body.successCriteria.trim() || null
        : null;
    const rawPriority = typeof body.priority === "string" ? body.priority : null;
    const priority: Priority =
      rawPriority && VALID_PRIORITIES.includes(rawPriority as Priority)
        ? (rawPriority as Priority)
        : "medium";
    const dueDate =
      typeof body.dueDate === "string" && ISO_DATE_RE.test(body.dueDate)
        ? new Date(body.dueDate + "T00:00:00Z")
        : null;

    if (!actionText) {
      return NextResponse.json(
        { error: "actionText is required" },
        { status: 400 }
      );
    }
    if (actionText.length > 2000) {
      return NextResponse.json(
        { error: "actionText must be 2000 characters or fewer" },
        { status: 400 }
      );
    }
    if (successCriteria && successCriteria.length > 2000) {
      return NextResponse.json(
        { error: "successCriteria must be 2000 characters or fewer" },
        { status: 400 }
      );
    }

    const rcfa = await prisma.rcfa.findUnique({ where: { id } });
    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }
    if (rcfa.createdByUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (rcfa.status !== "investigation") {
      return NextResponse.json(
        { error: "RCFA must be in investigation status" },
        { status: 409 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "investigation") {
        throw new Error("RCFA_NOT_IN_INVESTIGATION");
      }

      const record = await tx.rcfaActionItem.create({
        data: {
          rcfaId: id,
          actionText,
          successCriteria,
          priority,
          dueDate,
          selectedFromCandidateId: null,
          createdByUserId: userId,
          status: "open",
        },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "action_item_created",
          eventPayload: {
            actionItemId: record.id,
            actionText,
            priority,
            successCriteria,
            dueDate,
          },
        },
      });

      return record;
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RCFA_NOT_IN_INVESTIGATION"
    ) {
      return NextResponse.json(
        { error: "RCFA must be in investigation status" },
        { status: 409 }
      );
    }
    console.error("POST /api/rcfa/[id]/action-items/finals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
