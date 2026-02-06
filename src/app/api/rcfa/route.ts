import { NextRequest, NextResponse } from "next/server";
import type { OperatingContext } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import { VALID_OPERATING_CONTEXTS } from "@/lib/rcfa-utils";

/**
 * POST /api/rcfa - Create a new RCFA
 *
 * Supports two modes:
 * 1. Quick create (empty body or {}): Creates RCFA with minimal defaults
 * 2. Full create (with fields): Validates and creates with provided data
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();

    let body: Record<string, unknown> = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      title,
      equipmentDescription,
      failureDescription,
      operatingContext,
      equipmentMake,
      equipmentModel,
      equipmentSerialNumber,
      equipmentAgeYears,
      downtimeMinutes,
      productionCostUsd,
      maintenanceCostUsd,
      preFailureConditions,
      workHistorySummary,
      activePmsSummary,
      additionalNotes,
    } = body as Record<string, string | number | undefined>;

    // Determine if this is a quick create (empty/minimal body) or full create
    const hasRequiredFields =
      title || equipmentDescription || failureDescription || operatingContext;

    let trimmedTitle = "";
    let trimmedEquipDesc = "";
    let trimmedFailureDesc = "";
    let trimmedContext: OperatingContext = "unknown";

    if (hasRequiredFields) {
      // Full create mode: validate all required fields
      trimmedTitle = title ? String(title).trim() : "";
      trimmedEquipDesc = equipmentDescription
        ? String(equipmentDescription).trim()
        : "";
      trimmedFailureDesc = failureDescription
        ? String(failureDescription).trim()
        : "";
      const contextStr = operatingContext
        ? String(operatingContext).trim()
        : "";

      if (
        !trimmedTitle ||
        !trimmedEquipDesc ||
        !trimmedFailureDesc ||
        !contextStr
      ) {
        return NextResponse.json(
          {
            error:
              "title, equipmentDescription, failureDescription, and operatingContext are required",
          },
          { status: 400 }
        );
      }

      if (trimmedTitle.length > 200) {
        return NextResponse.json(
          { error: "title must be 200 characters or fewer" },
          { status: 400 }
        );
      }

      if (!VALID_OPERATING_CONTEXTS.includes(contextStr as OperatingContext)) {
        return NextResponse.json(
          {
            error: `operatingContext must be one of: ${VALID_OPERATING_CONTEXTS.join(", ")}`,
          },
          { status: 400 }
        );
      }

      trimmedContext = contextStr as OperatingContext;
    }
    // else: Quick create mode - use defaults (empty strings, "unknown" context)

    // Validate optional numeric fields (applies to both modes)
    if (equipmentAgeYears != null) {
      const age = Number(equipmentAgeYears);
      if (isNaN(age) || age < 0 || age > 9999) {
        return NextResponse.json(
          { error: "equipmentAgeYears must be a non-negative number" },
          { status: 400 }
        );
      }
    }

    if (downtimeMinutes != null) {
      const mins = Number(downtimeMinutes);
      if (!Number.isInteger(mins) || mins < 0) {
        return NextResponse.json(
          { error: "downtimeMinutes must be a non-negative integer" },
          { status: 400 }
        );
      }
    }

    if (productionCostUsd != null) {
      const cost = Number(productionCostUsd);
      if (isNaN(cost) || cost < 0) {
        return NextResponse.json(
          { error: "productionCostUsd must be a non-negative number" },
          { status: 400 }
        );
      }
    }

    if (maintenanceCostUsd != null) {
      const cost = Number(maintenanceCostUsd);
      if (isNaN(cost) || cost < 0) {
        return NextResponse.json(
          { error: "maintenanceCostUsd must be a non-negative number" },
          { status: 400 }
        );
      }
    }

    const trimOpt = (v: string | number | undefined) =>
      v ? String(v).trim() || undefined : undefined;

    // Get next RCFA number from sequence
    const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('rcfa_number_seq')
    `;

    const rcfaNumber = Number(nextval);
    const isQuickCreate = !hasRequiredFields;

    const rcfa = await prisma.$transaction(async (tx) => {
      const created = await tx.rcfa.create({
        data: {
          rcfaNumber,
          title: trimmedTitle,
          equipmentDescription: trimmedEquipDesc,
          failureDescription: trimmedFailureDesc,
          operatingContext: trimmedContext,
          equipmentMake: trimOpt(equipmentMake),
          equipmentModel: trimOpt(equipmentModel),
          equipmentSerialNumber: trimOpt(equipmentSerialNumber),
          equipmentAgeYears:
            equipmentAgeYears != null ? Number(equipmentAgeYears) : undefined,
          downtimeMinutes:
            downtimeMinutes != null ? Number(downtimeMinutes) : undefined,
          productionCostUsd:
            productionCostUsd != null ? Number(productionCostUsd) : undefined,
          maintenanceCostUsd:
            maintenanceCostUsd != null ? Number(maintenanceCostUsd) : undefined,
          preFailureConditions: trimOpt(preFailureConditions),
          workHistorySummary: trimOpt(workHistorySummary),
          activePmsSummary: trimOpt(activePmsSummary),
          additionalNotes: trimOpt(additionalNotes),
          status: "draft",
          createdByUserId: userId,
          ownerUserId: userId,
        },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: created.id,
          actorUserId: userId,
          eventType: "rcfa_created",
          eventPayload: {
            rcfaNumber,
            quickCreate: isQuickCreate,
          },
        },
      });

      return created;
    });

    return NextResponse.json(
      { id: rcfa.id, rcfaNumber: rcfa.rcfaNumber },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/rcfa error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
