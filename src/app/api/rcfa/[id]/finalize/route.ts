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

    const rcfa = await prisma.rcfa.findUnique({ where: { id } });
    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    if (rcfa.ownerUserId !== userId && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (rcfa.status !== "investigation") {
      return NextResponse.json(
        { error: "Only investigation RCFAs can be finalized" },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "investigation") {
        throw new Error("RCFA_NOT_IN_INVESTIGATION");
      }

      const finalCount = await tx.rcfaRootCauseFinal.count({
        where: { rcfaId: id },
      });
      if (finalCount === 0) {
        throw new Error("RCFA_NO_ROOT_CAUSES");
      }

      const actionItemCount = await tx.rcfaActionItem.count({
        where: { rcfaId: id },
      });
      if (actionItemCount === 0) {
        throw new Error("RCFA_NO_ACTION_ITEMS");
      }

      // Validate draft action items have all required fields before finalizing
      const draftItems = await tx.rcfaActionItem.findMany({
        where: { rcfaId: id, status: "draft" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          actionItemNumber: true,
          actionText: true,
          actionDescription: true,
          ownerUserId: true,
          dueDate: true,
          priority: true,
        },
      });

      const incompleteItems: {
        actionItemNumber: number;
        missingFields: string[];
      }[] = [];

      for (const item of draftItems) {
        const missingFields: string[] = [];

        if (!item.actionText || item.actionText.trim().length === 0) {
          missingFields.push("actionText");
        }
        if (
          !item.actionDescription ||
          item.actionDescription.trim().length === 0
        ) {
          missingFields.push("actionDescription");
        }
        if (!item.ownerUserId) {
          missingFields.push("ownerUserId");
        }
        if (!item.dueDate) {
          missingFields.push("dueDate");
        }
        // priority has a DB default of 'medium' — defensive check only
        if (!item.priority) {
          missingFields.push("priority");
        }

        if (missingFields.length > 0) {
          incompleteItems.push({
            actionItemNumber: item.actionItemNumber,
            missingFields,
          });
        }
      }

      if (incompleteItems.length > 0) {
        const err = new Error("RCFA_DRAFT_ITEMS_INCOMPLETE");
        (err as Error & { payload: unknown }).payload = incompleteItems;
        throw err;
      }

      // Verify all assigned owners are still active before transitioning to open.
      // An owner could have been deactivated after being assigned to a draft item.
      const ownerUserIds = [
        ...new Set(
          draftItems
            .map((item) => item.ownerUserId)
            .filter((uid): uid is string => uid !== null)
        ),
      ];

      if (ownerUserIds.length > 0) {
        const activeOwners = await tx.appUser.findMany({
          where: { id: { in: ownerUserIds }, status: "active" },
          select: { id: true },
        });
        const activeOwnerIdSet = new Set(activeOwners.map((o) => o.id));

        const inactiveOwnerItems = draftItems
          .filter(
            (item) =>
              item.ownerUserId !== null &&
              !activeOwnerIdSet.has(item.ownerUserId)
          )
          .map((item) => ({
            actionItemNumber: item.actionItemNumber,
            ownerUserId: item.ownerUserId,
          }));

        if (inactiveOwnerItems.length > 0) {
          const err = new Error("RCFA_DRAFT_ITEMS_INACTIVE_OWNERS");
          (err as Error & { payload: unknown }).payload = inactiveOwnerItems;
          throw err;
        }
      }

      // Activate all draft items by setting status to open
      if (draftItems.length > 0) {
        await tx.rcfaActionItem.updateMany({
          where: { rcfaId: id, status: "draft" },
          data: { status: "open" },
        });
      }

      await tx.rcfa.update({
        where: { id },
        data: { status: "actions_open" },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "status_changed",
          eventPayload: { from: "investigation", to: "actions_open" },
        },
      });

      // Record audit event for draft item activation
      if (draftItems.length > 0) {
        const activatedItemIds = draftItems.map((item) => item.id);
        await tx.rcfaAuditEvent.create({
          data: {
            rcfaId: id,
            actorUserId: userId,
            eventType: "draft_items_activated",
            eventPayload: {
              activatedItemIds,
              count: activatedItemIds.length,
            },
          },
        });
      }
    });

    return NextResponse.json({ status: "actions_open" }, { status: 200 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RCFA_NOT_IN_INVESTIGATION"
    ) {
      return NextResponse.json(
        { error: "Only investigation RCFAs can be finalized" },
        { status: 409 }
      );
    }
    if (
      error instanceof Error &&
      error.message === "RCFA_NO_ROOT_CAUSES"
    ) {
      return NextResponse.json(
        { error: "At least one root cause must be finalized before advancing" },
        { status: 422 }
      );
    }
    if (
      error instanceof Error &&
      error.message === "RCFA_NO_ACTION_ITEMS"
    ) {
      return NextResponse.json(
        { error: "At least one action item is required before finalizing investigation" },
        { status: 422 }
      );
    }
    if (
      error instanceof Error &&
      error.message === "RCFA_DRAFT_ITEMS_INCOMPLETE"
    ) {
      return NextResponse.json(
        {
          error: "Some action items are incomplete",
          incompleteItems: (error as Error & { payload: unknown }).payload,
        },
        { status: 422 }
      );
    }
    if (
      error instanceof Error &&
      error.message === "RCFA_DRAFT_ITEMS_INACTIVE_OWNERS"
    ) {
      return NextResponse.json(
        {
          error: "Some action items are assigned to inactive users",
          inactiveOwnerItems: (error as Error & { payload: unknown }).payload,
        },
        { status: 422 }
      );
    }
    console.error("POST /api/rcfa/[id]/finalize error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
