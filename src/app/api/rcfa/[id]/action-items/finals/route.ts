import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import { VALID_PRIORITIES } from "@/lib/validation-constants";
import type { Priority } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();
    const actionText =
      typeof body.actionText === "string" ? body.actionText.trim() : "";
    const rawPriority = typeof body.priority === "string" ? body.priority : null;
    const priority: Priority =
      rawPriority && VALID_PRIORITIES.includes(rawPriority as Priority)
        ? (rawPriority as Priority)
        : "medium";
    const dueDate =
      typeof body.dueDate === "string" && ISO_DATE_RE.test(body.dueDate)
        ? new Date(body.dueDate + "T00:00:00Z")
        : null;
    const ownerUserId =
      typeof body.ownerUserId === "string" && UUID_RE.test(body.ownerUserId)
        ? body.ownerUserId
        : null;
    const actionDescription =
      typeof body.actionDescription === "string"
        ? body.actionDescription.trim() || null
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
    const rcfa = await prisma.rcfa.findUnique({ where: { id } });
    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }
    if (rcfa.ownerUserId !== userId && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (rcfa.status !== "investigation" && rcfa.status !== "actions_open") {
      return NextResponse.json(
        { error: "RCFA must be in investigation or actions_open status" },
        { status: 409 }
      );
    }

    // Validate assigned owner is an active user
    if (ownerUserId) {
      const owner = await prisma.appUser.findUnique({
        where: { id: ownerUserId },
        select: { status: true },
      });
      if (!owner) {
        return NextResponse.json(
          { error: "Owner user not found" },
          { status: 400 }
        );
      }
      if (owner.status !== "active") {
        return NextResponse.json(
          { error: "Cannot assign to a non-active user" },
          { status: 400 }
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "investigation" && locked.status !== "actions_open") {
        throw new Error("RCFA_STATUS_INVALID");
      }

      // Get next action item number from sequence
      const [{ nextval }] = await tx.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('action_item_number_seq')
      `;
      const actionItemNumber = Number(nextval);

      const record = await tx.rcfaActionItem.create({
        data: {
          rcfaId: id,
          actionItemNumber,
          actionText,
          actionDescription,
          priority,
          dueDate,
          ownerUserId,
          selectedFromCandidateId: null,
          createdByUserId: userId,
          status: locked.status === "investigation" ? "draft" : "open",
        },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "action_item_created",
          eventPayload: {
            actionItemId: record.id,
            actionItemNumber,
            actionText,
            actionDescription,
            priority,
            dueDate,
            ownerUserId,
            status: record.status,
          },
        },
      });

      return record;
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RCFA_STATUS_INVALID"
    ) {
      return NextResponse.json(
        { error: "RCFA must be in investigation or actions_open status" },
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
