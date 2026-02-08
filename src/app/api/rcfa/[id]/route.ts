import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { getAuthContext } from "@/lib/auth-context";
import type { RcfaStatus, OperatingContext } from "@/generated/prisma/client";
import {
  validateStatusTransition,
  RCFA_STATUS_LABELS,
  PATCH_ALLOWED_TRANSITIONS,
  ALL_RCFA_STATUSES,
  VALID_OPERATING_CONTEXTS,
} from "@/lib/rcfa-utils";

/** Fields that can be updated via PATCH when status is draft */
const EDITABLE_DRAFT_FIELDS = [
  "title",
  "equipmentDescription",
  "equipmentMake",
  "equipmentModel",
  "equipmentSerialNumber",
  "equipmentAgeYears",
  "operatingContext",
  "preFailureConditions",
  "failureDescription",
  "workHistorySummary",
  "activePmsSummary",
  "additionalNotes",
  "downtimeMinutes",
  "productionCostUsd",
  "maintenanceCostUsd",
] as const;

/** Fields that can be updated during investigation status */
const EDITABLE_INVESTIGATION_FIELDS = ["investigationNotes"] as const;

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
 * PATCH /api/rcfa/[id] - Update RCFA fields or status
 *
 * Supports two modes:
 * 1. Field updates (when status is draft): Update intake fields
 * 2. Status changes: Update status with transition validation
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

    // Determine if this is a field update or status change
    const hasFieldUpdates = EDITABLE_DRAFT_FIELDS.some(
      (field) => body[field] !== undefined
    );
    const hasInvestigationFieldUpdates = EDITABLE_INVESTIGATION_FIELDS.some(
      (field) => body[field] !== undefined
    );

    const rcfa = await prisma.rcfa.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        ownerUserId: true,
        title: true,
        equipmentDescription: true,
        equipmentMake: true,
        equipmentModel: true,
        equipmentSerialNumber: true,
        equipmentAgeYears: true,
        operatingContext: true,
        preFailureConditions: true,
        failureDescription: true,
        workHistorySummary: true,
        activePmsSummary: true,
        additionalNotes: true,
        investigationNotes: true,
        downtimeMinutes: true,
        productionCostUsd: true,
        maintenanceCostUsd: true,
      },
    });

    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    // Check permission: owner or admin
    if (rcfa.ownerUserId !== userId && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Handle investigation notes updates (allowed during investigation or actions_open status)
    if (hasInvestigationFieldUpdates) {
      if (rcfa.status !== "investigation" && rcfa.status !== "actions_open") {
        return NextResponse.json(
          { error: "Investigation notes can only be updated during investigation or actions_open status" },
          { status: 409 }
        );
      }

      const trimmed = body.investigationNotes
        ? String(body.investigationNotes).trim()
        : null;
      const current = rcfa.investigationNotes;

      if (trimmed === current) {
        return NextResponse.json({ message: "No changes" }, { status: 200 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.rcfa.update({
          where: { id },
          data: {
            investigationNotes: trimmed || null,
            investigationNotesUpdatedAt: new Date(),
          },
        });

        await tx.rcfaAuditEvent.create({
          data: {
            rcfaId: id,
            actorUserId: userId,
            eventType: "investigation_notes_updated",
            eventPayload: {
              changes: {
                investigationNotes: { from: current, to: trimmed || null },
              },
            },
          },
        });
      });

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Handle field updates (only allowed in draft status)
    if (hasFieldUpdates) {
      if (rcfa.status !== "draft") {
        return NextResponse.json(
          { error: "Field updates are only allowed when status is draft" },
          { status: 409 }
        );
      }

      // Validate and build update data
      const updateData: Record<string, unknown> = {};

      // String fields (title has max length)
      if (body.title !== undefined) {
        const trimmed = String(body.title).trim();
        if (trimmed.length > 200) {
          return NextResponse.json(
            { error: "title must be 200 characters or fewer" },
            { status: 400 }
          );
        }
        if (trimmed !== rcfa.title) {
          updateData.title = trimmed;
        }
      }

      // Required string fields
      for (const field of [
        "equipmentDescription",
        "failureDescription",
      ] as const) {
        if (body[field] !== undefined) {
          const trimmed = String(body[field]).trim();
          if (trimmed !== rcfa[field]) {
            updateData[field] = trimmed;
          }
        }
      }

      // Optional string fields
      for (const field of [
        "equipmentMake",
        "equipmentModel",
        "equipmentSerialNumber",
        "preFailureConditions",
        "workHistorySummary",
        "activePmsSummary",
        "additionalNotes",
      ] as const) {
        if (body[field] !== undefined) {
          const trimmed = body[field] ? String(body[field]).trim() : null;
          const current = rcfa[field];
          if (trimmed !== current) {
            updateData[field] = trimmed || null;
          }
        }
      }

      // Operating context (enum)
      if (body.operatingContext !== undefined) {
        const context = String(body.operatingContext).trim();
        if (!VALID_OPERATING_CONTEXTS.includes(context as OperatingContext)) {
          return NextResponse.json(
            {
              error: `operatingContext must be one of: ${VALID_OPERATING_CONTEXTS.join(", ")}`,
            },
            { status: 400 }
          );
        }
        if (context !== rcfa.operatingContext) {
          updateData.operatingContext = context;
        }
      }

      // Numeric fields
      if (body.equipmentAgeYears !== undefined) {
        const value =
          body.equipmentAgeYears === null || body.equipmentAgeYears === ""
            ? null
            : Number(body.equipmentAgeYears);
        if (value !== null && (isNaN(value) || value < 0 || value > 9999)) {
          return NextResponse.json(
            { error: "equipmentAgeYears must be a non-negative number" },
            { status: 400 }
          );
        }
        const current = rcfa.equipmentAgeYears
          ? Number(rcfa.equipmentAgeYears)
          : null;
        if (value !== current) {
          updateData.equipmentAgeYears = value;
        }
      }

      if (body.downtimeMinutes !== undefined) {
        const value =
          body.downtimeMinutes === null || body.downtimeMinutes === ""
            ? null
            : Number(body.downtimeMinutes);
        if (value !== null && (!Number.isInteger(value) || value < 0)) {
          return NextResponse.json(
            { error: "downtimeMinutes must be a non-negative integer" },
            { status: 400 }
          );
        }
        if (value !== rcfa.downtimeMinutes) {
          updateData.downtimeMinutes = value;
        }
      }

      for (const field of ["productionCostUsd", "maintenanceCostUsd"] as const) {
        if (body[field] !== undefined) {
          const value =
            body[field] === null || body[field] === ""
              ? null
              : Number(body[field]);
          if (value !== null && (isNaN(value) || value < 0)) {
            return NextResponse.json(
              { error: `${field} must be a non-negative number` },
              { status: 400 }
            );
          }
          const current = rcfa[field] ? Number(rcfa[field]) : null;
          if (value !== current) {
            updateData[field] = value;
          }
        }
      }

      // No changes detected
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ message: "No changes" }, { status: 200 });
      }

      // Perform update (no audit logging for draft field edits per issue #204)
      await prisma.rcfa.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Handle status change
    if (!newStatus) {
      return NextResponse.json(
        { error: "Missing status, intake fields, or investigation notes" },
        { status: 400 }
      );
    }

    if (!ALL_RCFA_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status value: ${newStatus}` },
        { status: 400 }
      );
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
