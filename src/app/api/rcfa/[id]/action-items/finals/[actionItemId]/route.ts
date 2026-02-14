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
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
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

    // workCompletedDate: YYYY-MM-DD string, null to clear, or undefined to skip
    if (
      body.workCompletedDate !== undefined &&
      body.workCompletedDate !== null
    ) {
      if (
        typeof body.workCompletedDate !== "string" ||
        !ISO_DATE_RE.test(body.workCompletedDate) ||
        isNaN(new Date(body.workCompletedDate + "T00:00:00Z").getTime())
      ) {
        return NextResponse.json(
          { error: "workCompletedDate must be YYYY-MM-DD or null" },
          { status: 400 }
        );
      }
    }
    const workCompletedDate =
      typeof body.workCompletedDate === "string" &&
      ISO_DATE_RE.test(body.workCompletedDate)
        ? new Date(body.workCompletedDate + "T00:00:00Z")
        : body.workCompletedDate === null
          ? null
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

    // Validate assigned owner is an active user (only when setting a non-null owner)
    if (typeof ownerUserId === "string") {
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

      // Block transitioning a non-draft item TO draft — draft is system-controlled
      if (status === "draft" && existing.status !== "draft") {
        throw new Error("CANNOT_SET_DRAFT");
      }

      // Phase-based field restrictions: during investigation, status/completionNotes/workCompletedDate cannot be modified
      if (locked.status === "investigation") {
        const restrictedFields: string[] = [];
        if (status !== undefined && status !== existing.status) {
          restrictedFields.push("status");
        }
        if (body.completionNotes !== undefined) {
          restrictedFields.push("completionNotes");
        }
        if (workCompletedDate !== undefined) {
          restrictedFields.push("workCompletedDate");
        }
        if (restrictedFields.length > 0) {
          throw new Error("INVESTIGATION_FIELD_RESTRICTED");
        }
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
          ...(workCompletedDate !== undefined && { workCompletedDate }),
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
            previousWorkCompletedDate: existing.workCompletedDate,
            actionText,
            actionDescription,
            priority,
            dueDate,
            ownerUserId,
            status,
            workCompletedDate,
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
      if (error.message === "CANNOT_SET_DRAFT") {
        return NextResponse.json(
          { error: "Cannot manually set status to draft" },
          { status: 403 }
        );
      }
      if (error.message === "INVESTIGATION_FIELD_RESTRICTED") {
        return NextResponse.json(
          { error: "Status, action taken, and work completed date cannot be modified during investigation" },
          { status: 403 }
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
