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

    const hasChanges = ["status", "ownerUserId", "dueDate", "completionNotes"].some(
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
      include: { rcfa: { select: { createdByUserId: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Action item not found" },
        { status: 404 }
      );
    }

    if (
      existing.rcfa.createdByUserId !== userId &&
      existing.ownerUserId !== userId &&
      role !== "admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
          select: { displayName: true },
        });
        if (!newOwner) {
          return NextResponse.json(
            { error: "Owner user not found" },
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
        data.completionNotes =
          typeof body.completionNotes === "string"
            ? body.completionNotes.trim() || null
            : null;
      } else {
        data.completedAt = null;
        data.completedByUserId = null;
        data.completionNotes = null;
      }
    }

    if (body.ownerUserId !== undefined) {
      data.ownerUserId = body.ownerUserId;
    }

    if (body.dueDate !== undefined) {
      data.dueDate = body.dueDate
        ? new Date(body.dueDate + "T00:00:00Z")
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
                ...(body.status !== undefined &&
                  body.status !== "done" && body.status !== "canceled" &&
                  existing.completionNotes !== null && {
                    completionNotes: { from: existing.completionNotes, to: null },
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
