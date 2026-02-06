import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { getAuthContext } from "@/lib/auth-context";
import type { RcfaStatus } from "@/generated/prisma/client";
import {
  validateStatusTransition,
  RCFA_STATUS_LABELS,
  PATCH_ALLOWED_TRANSITIONS,
  ALL_RCFA_STATUSES,
} from "@/lib/rcfa-utils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { forbidden, userId } = await requireAdmin();
    if (forbidden) return forbidden;

    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid RCFA id" }, { status: 400 });
    }

    const rcfa = await prisma.rcfa.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        equipmentDescription: true,
        deletedAt: true,
      },
    });

    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    // Already soft-deleted
    if (rcfa.deletedAt) {
      return NextResponse.json(
        { error: "RCFA has already been deleted" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Soft delete: set deletedAt and deletedByUserId
      await tx.rcfa.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedByUserId: userId,
        },
      });

      // Write audit event for soft delete (GxP compliance)
      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "rcfa_soft_deleted",
          eventPayload: {
            title: rcfa.title,
            status: rcfa.status,
            equipmentDescription: rcfa.equipmentDescription,
          },
        },
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/rcfa/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/rcfa/[id] - Update RCFA status with transition validation
 */
export async function PATCH(
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
    const newStatus = body.status as RcfaStatus | undefined;

    if (!newStatus) {
      return NextResponse.json(
        { error: "Missing status field" },
        { status: 400 }
      );
    }

    if (!ALL_RCFA_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status value: ${newStatus}` },
        { status: 400 }
      );
    }

    const rcfa = await prisma.rcfa.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        ownerUserId: true,
      },
    });

    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    // Check permission: owner or admin
    if (rcfa.ownerUserId !== userId && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate the status transition (PATCH only allows backward transitions)
    // Forward transitions must use dedicated endpoints: /start-investigation, /finalize, /close
    const validation = validateStatusTransition(
      rcfa.status,
      newStatus,
      PATCH_ALLOWED_TRANSITIONS
    );
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.error,
          allowedTransitions: validation.allowedTransitions.map((s) => ({
            status: s,
            label: RCFA_STATUS_LABELS[s],
          })),
        },
        { status: 409 }
      );
    }

    // No change needed
    if (rcfa.status === newStatus) {
      return NextResponse.json(
        { status: newStatus, message: "No change" },
        { status: 200 }
      );
    }

    // Perform the transition in a transaction
    await prisma.$transaction(async (tx) => {
      // Re-check status inside transaction to prevent race conditions
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      const revalidation = validateStatusTransition(
        locked.status,
        newStatus,
        PATCH_ALLOWED_TRANSITIONS
      );
      if (!revalidation.valid) {
        throw new Error("TRANSITION_INVALID");
      }

      await tx.rcfa.update({
        where: { id },
        data: { status: newStatus },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "status_changed",
          eventPayload: { from: rcfa.status, to: newStatus },
        },
      });
    });

    return NextResponse.json({ status: newStatus }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "TRANSITION_INVALID") {
      return NextResponse.json(
        { error: "Status transition is no longer valid" },
        { status: 409 }
      );
    }
    console.error("PATCH /api/rcfa/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
