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
      equipmentDescription,
      failureDescription,
      operatingContext,
      equipmentMake,
      equipmentModel,
      equipmentSerialNumber,
      equipmentAgeYears,
      preFailureConditions,
      workHistorySummary,
      activePmsSummary,
      additionalNotes,
    } = body as Record<string, string | number | undefined>;

    const trimmedEquipDesc = equipmentDescription ? String(equipmentDescription).trim() : "";
    const trimmedFailureDesc = failureDescription ? String(failureDescription).trim() : "";
    const trimmedContext = operatingContext ? String(operatingContext).trim() : "";

    if (!trimmedEquipDesc || !trimmedFailureDesc || !trimmedContext) {
      return NextResponse.json(
        {
          error:
            "equipmentDescription, failureDescription, and operatingContext are required",
        },
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

    const trimOpt = (v: string | number | undefined) =>
      v ? String(v).trim() || undefined : undefined;

    const rcfa = await prisma.rcfa.create({
      data: {
        equipmentDescription: trimmedEquipDesc,
        failureDescription: trimmedFailureDesc,
        operatingContext: trimmedContext as OperatingContext,
        equipmentMake: trimOpt(equipmentMake),
        equipmentModel: trimOpt(equipmentModel),
        equipmentSerialNumber: trimOpt(equipmentSerialNumber),
        equipmentAgeYears:
          equipmentAgeYears != null ? Number(equipmentAgeYears) : undefined,
        preFailureConditions: trimOpt(preFailureConditions),
        workHistorySummary: trimOpt(workHistorySummary),
        activePmsSummary: trimOpt(activePmsSummary),
        additionalNotes: trimOpt(additionalNotes),
        status: "draft",
        createdByUserId: userId,
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
