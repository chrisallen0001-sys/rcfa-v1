import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import type { ActionItemStatus } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const VALID_STATUSES: ActionItemStatus[] = [
  "open",
  "in_progress",
  "blocked",
  "done",
  "canceled",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ actionItemId: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    const { actionItemId } = await params;

    if (!UUID_RE.test(actionItemId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();

    // Validate fields
    if (
      body.status !== undefined &&
      !VALID_STATUSES.includes(body.status as ActionItemStatus)
    ) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    if (
      body.ownerUserId !== undefined &&
      body.ownerUserId !== null &&
      !UUID_RE.test(body.ownerUserId)
    ) {
      return NextResponse.json(
        { error: "Invalid ownerUserId" },
        { status: 400 }
      );
    }

    if (
      body.dueDate !== undefined &&
      body.dueDate !== null &&
      (typeof body.dueDate !== "string" || !ISO_DATE_RE.test(body.dueDate))
    ) {
      return NextResponse.json(
        { error: "dueDate must be YYYY-MM-DD or null" },
        { status: 400 }
      );
    }

    if (
      body.completionNotes !== undefined &&
      body.completionNotes !== null &&
      typeof body.completionNotes !== "string"
    ) {
      return NextResponse.json(
        { error: "completionNotes must be a string or null" },
        { status: 400 }
      );
    }
    if (
      typeof body.completionNotes === "string" &&
      body.completionNotes.length > 2000
    ) {
      return NextResponse.json(
        { error: "completionNotes must be 2000 characters or fewer" },
        { status: 400 }
      );
    }

    if (
      body.actionDescription !== undefined &&
      body.actionDescription !== null &&
      typeof body.actionDescription !== "string"
    ) {
      return NextResponse.json(
        { error: "actionDescription must be a string or null" },
        { status: 400 }
      );
    }

    if (
      body.workCompletedDate !== undefined &&
      body.workCompletedDate !== null &&
      (typeof body.workCompletedDate !== "string" ||
        !ISO_DATE_RE.test(body.workCompletedDate) ||
        isNaN(new Date(body.workCompletedDate + "T00:00:00Z").getTime()))
    ) {
      return NextResponse.json(
        { error: "workCompletedDate must be YYYY-MM-DD or null" },
        { status: 400 }
      );
    }

    const hasChanges = ["status", "ownerUserId", "dueDate", "completionNotes", "actionDescription", "workCompletedDate"].some(
      (k) => body[k] !== undefined
    );
    if (!hasChanges) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const existing = await prisma.rcfaActionItem.findUnique({
      where: { id: actionItemId },
      include: { rcfa: { select: { ownerUserId: true, status: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Action item not found" },
        { status: 404 }
      );
    }

    // Block transitioning a non-draft item TO draft — draft is system-controlled
    if (body.status === "draft" && existing.status !== "draft") {
      return NextResponse.json(
        { error: "Cannot manually set status to draft" },
        { status: 403 }
      );
    }

    if (existing.rcfa.status === "closed") {
      return NextResponse.json(
        { error: "Cannot modify action items on a closed RCFA" },
        { status: 403 }
      );
    }

    if (
      existing.rcfa.ownerUserId !== userId &&
      existing.ownerUserId !== userId &&
      role !== "admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Determine the user's role relative to this action item
    const isAdmin = role === "admin";
    const isRcfaOwner = existing.rcfa.ownerUserId === userId;
    const isItemOwnerOnly =
      existing.ownerUserId === userId && !isRcfaOwner && !isAdmin;

    // Phase-based restrictions during investigation
    if (existing.rcfa.status === "investigation") {
      // Item-owner-only users cannot edit anything during investigation (items are draft)
      if (isItemOwnerOnly) {
        return NextResponse.json(
          { error: "Action item owners cannot edit items during investigation phase" },
          { status: 403 }
        );
      }

      // Nobody can modify status, completionNotes, or workCompletedDate during investigation
      const restrictedFields: string[] = [];
      if (body.status !== undefined) restrictedFields.push("status");
      if (body.completionNotes !== undefined) restrictedFields.push("completionNotes");
      if (body.workCompletedDate !== undefined) restrictedFields.push("workCompletedDate");
      if (restrictedFields.length > 0) {
        return NextResponse.json(
          { error: "Status, action taken, and work completed date cannot be modified during investigation" },
          { status: 403 }
        );
      }
    }

    // Item-owner-only users can only update status, completionNotes, and workCompletedDate
    if (isItemOwnerOnly) {
      const restrictedFields = [
        "actionText",
        "actionDescription",
        "ownerUserId",
        "dueDate",
        "priority",
      ];
      const attemptedRestrictedFields = restrictedFields.filter(
        (f) => body[f] !== undefined
      );
      if (attemptedRestrictedFields.length > 0) {
        return NextResponse.json(
          {
            error:
              "Action item owners can only update status, action taken, and work completed date",
          },
          { status: 403 }
        );
      }
    }

    // Fetch owner names for audit trail (if owner is changing)
    let previousOwnerName: string | null = null;
    let newOwnerName: string | null = null;

    if (body.ownerUserId !== undefined) {
      // Fetch previous owner name if there was one
      if (existing.ownerUserId) {
        const previousOwner = await prisma.appUser.findUnique({
          where: { id: existing.ownerUserId },
          select: { displayName: true },
        });
        previousOwnerName = previousOwner?.displayName ?? null;
      }

      // Validate and fetch new owner if provided
      if (body.ownerUserId) {
        const newOwner = await prisma.appUser.findUnique({
          where: { id: body.ownerUserId },
          select: { displayName: true, status: true },
        });
        if (!newOwner) {
          return NextResponse.json(
            { error: "Owner user not found" },
            { status: 400 }
          );
        }
        if (newOwner.status !== "active") {
          return NextResponse.json(
            { error: "Cannot assign to a non-active user" },
            { status: 400 }
          );
        }
        newOwnerName = newOwner.displayName;
      }
    }

    const data: Record<string, unknown> = {
      updatedByUserId: userId,
    };

    const isCompletion =
      (body.status === "done" || body.status === "canceled") &&
      existing.status !== body.status;

    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === "done" || body.status === "canceled") {
        data.completedAt = new Date();
        data.completedByUserId = userId;
        // Set completionNotes if provided during completion
        if (body.completionNotes !== undefined) {
          data.completionNotes =
            typeof body.completionNotes === "string"
              ? body.completionNotes.trim() || null
              : null;
        }
      } else {
        data.completedAt = null;
        data.completedByUserId = null;
        // Don't clear completionNotes when reopening - preserve any notes
      }
    }

    // Allow completionNotes to be updated anytime (independent of status change)
    if (body.completionNotes !== undefined && body.status === undefined) {
      data.completionNotes =
        body.completionNotes === null
          ? null
          : typeof body.completionNotes === "string"
            ? body.completionNotes.trim() || null
            : existing.completionNotes;
    }

    if (body.ownerUserId !== undefined) {
      data.ownerUserId = body.ownerUserId;
    }

    if (body.dueDate !== undefined) {
      data.dueDate = body.dueDate
        ? new Date(body.dueDate + "T00:00:00Z")
        : null;
    }

    if (body.actionDescription !== undefined) {
      data.actionDescription =
        body.actionDescription === null
          ? null
          : typeof body.actionDescription === "string"
            ? body.actionDescription.trim() || null
            : existing.actionDescription;
    }

    if (body.workCompletedDate !== undefined) {
      data.workCompletedDate = body.workCompletedDate
        ? new Date(body.workCompletedDate + "T00:00:00Z")
        : null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.rcfaActionItem.update({
        where: { id: actionItemId },
        data,
      });

      if (!isCompletion) {
        await tx.rcfaAuditEvent.create({
          data: {
            rcfaId: existing.rcfaId,
            actorUserId: userId,
            eventType: "action_item_updated",
            eventPayload: {
              actionItemId,
              changes: {
                ...(body.status !== undefined && {
                  status: { from: existing.status, to: body.status },
                }),
                ...(body.ownerUserId !== undefined && {
                  owner: {
                    from: previousOwnerName,
                    to: newOwnerName,
                  },
                }),
                ...(body.dueDate !== undefined && {
                  dueDate: {
                    from: existing.dueDate?.toISOString().slice(0, 10) ?? null,
                    to: body.dueDate,
                  },
                }),
                ...(body.completionNotes !== undefined && {
                  completionNotes: {
                    from: existing.completionNotes,
                    to: data.completionNotes ?? null,
                  },
                }),
                ...(body.actionDescription !== undefined && {
                  actionDescription: {
                    from: existing.actionDescription,
                    to: data.actionDescription ?? null,
                  },
                }),
                ...(body.workCompletedDate !== undefined && {
                  workCompletedDate: {
                    from: existing.workCompletedDate?.toISOString().slice(0, 10) ?? null,
                    to: body.workCompletedDate ?? null,
                  },
                }),
              },
            },
          },
        });
      }

      if (isCompletion) {
        await tx.rcfaAuditEvent.create({
          data: {
            rcfaId: existing.rcfaId,
            actorUserId: userId,
            eventType: "action_completed",
            eventPayload: {
              actionItemId,
              status: body.status,
              completionNotes: data.completionNotes ?? null,
              workCompletedDate: body.workCompletedDate ?? null,
              previousStatus: existing.status,
            },
          },
        });
      }

      return record;
    });

    return NextResponse.json({ id: updated.id });
  } catch (error) {
    console.error("PATCH /api/action-items/[actionItemId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
