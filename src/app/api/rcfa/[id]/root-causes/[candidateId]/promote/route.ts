import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; candidateId: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id, candidateId } = await params;

    if (!UUID_RE.test(id) || !UUID_RE.test(candidateId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    // Early auth/existence checks outside transaction
    const rcfa = await prisma.rcfa.findUnique({ where: { id } });
    if (!rcfa) {
      return NextResponse.json(
        { error: "RCFA not found" },
        { status: 404 }
      );
    }
    if (rcfa.createdByUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (rcfa.status !== "investigation") {
      return NextResponse.json(
        { error: "RCFA must be in investigation status to promote root causes" },
        { status: 409 }
      );
    }

    // Verify candidate exists and belongs to this RCFA
    const candidate = await prisma.rcfaRootCauseCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate || candidate.rcfaId !== id) {
      return NextResponse.json(
        { error: "Root cause candidate not found" },
        { status: 404 }
      );
    }

    // Transaction: create final root cause + audit event
    const finalRootCause = await prisma.$transaction(async (tx) => {
      // Row-level lock to re-check status
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "investigation") {
        throw new Error("RCFA_NOT_IN_INVESTIGATION");
      }

      const created = await tx.rcfaRootCauseFinal.create({
        data: {
          rcfaId: id,
          causeText: candidate.causeText,
          selectedFromCandidateId: candidateId,
          selectedByUserId: userId,
        },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "promoted_to_final",
          eventPayload: {
            candidateId,
            finalId: created.id,
            causeText: candidate.causeText,
          },
        },
      });

      return created;
    });

    return NextResponse.json(
      { id: finalRootCause.id },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RCFA_NOT_IN_INVESTIGATION"
    ) {
      return NextResponse.json(
        { error: "RCFA must be in investigation status to promote root causes" },
        { status: 409 }
      );
    }
    console.error(
      "POST /api/rcfa/[id]/root-causes/[candidateId]/promote error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
