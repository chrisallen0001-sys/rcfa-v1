import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();
    const causeText = typeof body.causeText === "string" ? body.causeText.trim() : "";
    const evidenceSummary =
      typeof body.evidenceSummary === "string" ? body.evidenceSummary.trim() || null : null;

    if (!causeText) {
      return NextResponse.json(
        { error: "causeText is required" },
        { status: 400 }
      );
    }
    if (causeText.length > 2000) {
      return NextResponse.json(
        { error: "causeText must be 2000 characters or fewer" },
        { status: 400 }
      );
    }
    if (evidenceSummary && evidenceSummary.length > 2000) {
      return NextResponse.json(
        { error: "evidenceSummary must be 2000 characters or fewer" },
        { status: 400 }
      );
    }

    const rcfa = await prisma.rcfa.findUnique({ where: { id } });
    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }
    if (rcfa.createdByUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (rcfa.status !== "investigation") {
      return NextResponse.json(
        { error: "RCFA must be in investigation status" },
        { status: 409 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "investigation") {
        throw new Error("RCFA_NOT_IN_INVESTIGATION");
      }

      const record = await tx.rcfaRootCauseFinal.create({
        data: {
          rcfaId: id,
          causeText,
          evidenceSummary,
          selectedFromCandidateId: null,
          selectedByUserId: userId,
        },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "final_created",
          eventPayload: {
            finalId: record.id,
            causeText,
            evidenceSummary,
          },
        },
      });

      return record;
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RCFA_NOT_IN_INVESTIGATION"
    ) {
      return NextResponse.json(
        { error: "RCFA must be in investigation status" },
        { status: 409 }
      );
    }
    console.error("POST /api/rcfa/[id]/root-causes/finals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
