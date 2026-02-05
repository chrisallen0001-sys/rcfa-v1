import { NextRequest, NextResponse } from "next/server";
import { OperatingContext } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

const VALID_OPERATING_CONTEXTS: OperatingContext[] = [
  "running",
  "startup",
  "shutdown",
  "maintenance",
  "unknown",
];

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
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

    const trimmedTitle = title ? String(title).trim() : "";
    const trimmedEquipDesc = equipmentDescription ? String(equipmentDescription).trim() : "";
    const trimmedFailureDesc = failureDescription ? String(failureDescription).trim() : "";
    const trimmedContext = operatingContext ? String(operatingContext).trim() : "";

    if (!trimmedTitle || !trimmedEquipDesc || !trimmedFailureDesc || !trimmedContext) {
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

    if (
      !VALID_OPERATING_CONTEXTS.includes(trimmedContext as OperatingContext)
    ) {
      return NextResponse.json(
        { error: `operatingContext must be one of: ${VALID_OPERATING_CONTEXTS.join(", ")}` },
        { status: 400 }
      );
    }

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

    const rcfa = await prisma.rcfa.create({
      data: {
        rcfaNumber: Number(nextval),
        title: trimmedTitle,
        equipmentDescription: trimmedEquipDesc,
        failureDescription: trimmedFailureDesc,
        operatingContext: trimmedContext as OperatingContext,
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

    return NextResponse.json({ id: rcfa.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/rcfa error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
