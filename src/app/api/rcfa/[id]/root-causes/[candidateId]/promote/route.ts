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
    const { userId, role } = await getAuthContext();
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
    if (rcfa.createdByUserId !== userId && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (rcfa.status !== "investigation") {
      return NextResponse.json(
        { error: "RCFA must be in investigation status to promote root causes" },
        { status: 409 }
      );
    }

    // Verify candidate exists and belongs to this RCFA (early check)
    const candidateCheck = await prisma.rcfaRootCauseCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidateCheck || candidateCheck.rcfaId !== id) {
      return NextResponse.json(
        { error: "Root cause candidate not found" },
        { status: 404 }
      );
    }

    // Transaction: re-read candidate, check for duplicates, create final + audit
    const finalRootCause = await prisma.$transaction(async (tx) => {
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "investigation") {
        throw new Error("RCFA_NOT_IN_INVESTIGATION");
      }

      // Re-read candidate inside transaction for consistency
      const candidate = await tx.rcfaRootCauseCandidate.findUniqueOrThrow({
        where: { id: candidateId },
      });

      // Prevent duplicate promotion of the same candidate
      const existing = await tx.rcfaRootCauseFinal.findFirst({
        where: { selectedFromCandidateId: candidateId },
      });
      if (existing) {
        throw new Error("ALREADY_PROMOTED");
      }

      const created = await tx.rcfaRootCauseFinal.create({
        data: {
          rcfaId: id,
          causeText: candidate.causeText,
          evidenceSummary: candidate.rationaleText,
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
            evidenceSummary: candidate.rationaleText,
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
    if (error instanceof Error) {
      if (error.message === "RCFA_NOT_IN_INVESTIGATION") {
        return NextResponse.json(
          { error: "RCFA must be in investigation status to promote root causes" },
          { status: 409 }
        );
      }
      if (error.message === "ALREADY_PROMOTED") {
        return NextResponse.json(
          { error: "This candidate has already been promoted" },
          { status: 409 }
        );
      }
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
