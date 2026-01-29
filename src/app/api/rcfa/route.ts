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

    if (!equipmentDescription || !failureDescription || !operatingContext) {
      return NextResponse.json(
        {
          error:
            "equipmentDescription, failureDescription, and operatingContext are required",
        },
        { status: 400 }
      );
    }

    if (
      !VALID_OPERATING_CONTEXTS.includes(operatingContext as OperatingContext)
    ) {
      return NextResponse.json(
        { error: `operatingContext must be one of: ${VALID_OPERATING_CONTEXTS.join(", ")}` },
        { status: 400 }
      );
    }

    const rcfa = await prisma.rcfa.create({
      data: {
        equipmentDescription: String(equipmentDescription),
        failureDescription: String(failureDescription),
        operatingContext: operatingContext as OperatingContext,
        equipmentMake: equipmentMake ? String(equipmentMake) : undefined,
        equipmentModel: equipmentModel ? String(equipmentModel) : undefined,
        equipmentSerialNumber: equipmentSerialNumber
          ? String(equipmentSerialNumber)
          : undefined,
        equipmentAgeYears:
          equipmentAgeYears != null ? Number(equipmentAgeYears) : undefined,
        preFailureConditions: preFailureConditions
          ? String(preFailureConditions)
          : undefined,
        workHistorySummary: workHistorySummary
          ? String(workHistorySummary)
          : undefined,
        activePmsSummary: activePmsSummary
          ? String(activePmsSummary)
          : undefined,
        additionalNotes: additionalNotes
          ? String(additionalNotes)
          : undefined,
        status: "draft",
        createdByUserId: userId,
      },
    });

    return NextResponse.json(rcfa, { status: 201 });
  } catch (error) {
    console.error("POST /api/rcfa error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
