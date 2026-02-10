import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import { VALID_PRIORITIES } from "@/lib/validation-constants";
import type { Priority, ActionItemStatus } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_STATUSES: ActionItemStatus[] = [
  "open",
  "in_progress",
  "blocked",
  "done",
  "canceled",
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; actionItemId: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    const { id, actionItemId } = await params;

    if (!UUID_RE.test(id) || !UUID_RE.test(actionItemId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();
    const actionText =
      typeof body.actionText === "string" ? body.actionText.trim() : "";
    if (
      typeof body.priority === "string" &&
      !VALID_PRIORITIES.includes(body.priority as Priority)
    ) {
      return NextResponse.json(
        { error: "priority must be low, medium, or high" },
        { status: 400 }
      );
    }
    const priority: Priority =
      typeof body.priority === "string" &&
      VALID_PRIORITIES.includes(body.priority as Priority)
        ? (body.priority as Priority)
        : "medium";
    const dueDate =
      typeof body.dueDate === "string" && ISO_DATE_RE.test(body.dueDate)
        ? new Date(body.dueDate + "T00:00:00Z")
        : body.dueDate === null
          ? null
          : undefined;
    const ownerUserId =
      typeof body.ownerUserId === "string" && UUID_RE.test(body.ownerUserId)
        ? body.ownerUserId
        : body.ownerUserId === null
          ? null
          : undefined;
    if (
      typeof body.status === "string" &&
      !VALID_STATUSES.includes(body.status as ActionItemStatus)
    ) {
      return NextResponse.json(
        { error: "status must be open, in_progress, blocked, done, or canceled" },
        { status: 400 }
      );
    }
    const status: ActionItemStatus | undefined =
      typeof body.status === "string" &&
      VALID_STATUSES.includes(body.status as ActionItemStatus)
        ? (body.status as ActionItemStatus)
        : undefined;
    const actionDescription =
      body.actionDescription === null
        ? null
        : typeof body.actionDescription === "string"
          ? body.actionDescription.trim() || null
          : undefined;

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

    const updated = await prisma.$transaction(async (tx) => {
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "investigation" && locked.status !== "actions_open") {
        throw new Error("RCFA_STATUS_INVALID");
      }

      const existing = await tx.rcfaActionItem.findUnique({
        where: { id: actionItemId },
      });
      if (!existing || existing.rcfaId !== id) {
        throw new Error("NOT_FOUND");
      }

      const record = await tx.rcfaActionItem.update({
        where: { id: actionItemId },
        data: {
          actionText,
          priority,
          ...(dueDate !== undefined && { dueDate }),
          ...(ownerUserId !== undefined && { ownerUserId }),
          ...(status !== undefined && { status }),
          ...(actionDescription !== undefined && { actionDescription }),
          updatedByUserId: userId,
        },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "action_item_updated",
          eventPayload: {
            actionItemId,
            previousActionText: existing.actionText,
            previousActionDescription: existing.actionDescription,
            previousPriority: existing.priority,
            previousDueDate: existing.dueDate,
            previousOwnerUserId: existing.ownerUserId,
            previousStatus: existing.status,
            actionText,
            actionDescription,
            priority,
            dueDate,
            ownerUserId,
            status,
          },
        },
      });

      return record;
    });

    return NextResponse.json({ id: updated.id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RCFA_STATUS_INVALID") {
        return NextResponse.json(
          { error: "RCFA must be in investigation or actions_open status" },
          { status: 409 }
        );
      }
      if (error.message === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Action item not found" },
          { status: 404 }
        );
      }
    }
    console.error(
      "PATCH /api/rcfa/[id]/action-items/finals/[actionItemId] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; actionItemId: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    const { id, actionItemId } = await params;

    if (!UUID_RE.test(id) || !UUID_RE.test(actionItemId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
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

    await prisma.$transaction(async (tx) => {
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "investigation" && locked.status !== "actions_open") {
        throw new Error("RCFA_STATUS_INVALID");
      }

      const existing = await tx.rcfaActionItem.findUnique({
        where: { id: actionItemId },
      });
      if (!existing || existing.rcfaId !== id) {
        throw new Error("NOT_FOUND");
      }

      await tx.rcfaActionItem.delete({ where: { id: actionItemId } });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "action_item_deleted",
          eventPayload: {
            actionItemId,
            actionText: existing.actionText,
            priority: existing.priority,
          },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RCFA_STATUS_INVALID") {
        return NextResponse.json(
          { error: "RCFA must be in investigation or actions_open status" },
          { status: 409 }
        );
      }
      if (error.message === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Action item not found" },
          { status: 404 }
        );
      }
    }
    console.error(
      "DELETE /api/rcfa/[id]/action-items/finals/[actionItemId] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
