import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; finalId: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    const { id, finalId } = await params;

    if (!UUID_RE.test(id) || !UUID_RE.test(finalId)) {
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
    if (rcfa.ownerUserId !== userId && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (rcfa.status !== "investigation") {
      return NextResponse.json(
        { error: "RCFA must be in investigation status" },
        { status: 409 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "investigation") {
        throw new Error("RCFA_NOT_IN_INVESTIGATION");
      }

      const existing = await tx.rcfaRootCauseFinal.findUnique({
        where: { id: finalId },
      });
      if (!existing || existing.rcfaId !== id) {
        throw new Error("NOT_FOUND");
      }

      const record = await tx.rcfaRootCauseFinal.update({
        where: { id: finalId },
        data: {
          causeText,
          evidenceSummary,
          updatedByUserId: userId,
        },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "final_updated",
          eventPayload: {
            finalId,
            previousCauseText: existing.causeText,
            previousEvidenceSummary: existing.evidenceSummary,
            causeText,
            evidenceSummary,
          },
        },
      });

      return record;
    });

    return NextResponse.json({ id: updated.id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RCFA_NOT_IN_INVESTIGATION") {
        return NextResponse.json(
          { error: "RCFA must be in investigation status" },
          { status: 409 }
        );
      }
      if (error.message === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Root cause not found" },
          { status: 404 }
        );
      }
    }
    console.error(
      "PATCH /api/rcfa/[id]/root-causes/finals/[finalId] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; finalId: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    const { id, finalId } = await params;

    if (!UUID_RE.test(id) || !UUID_RE.test(finalId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
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
        { error: "RCFA must be in investigation status" },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "investigation") {
        throw new Error("RCFA_NOT_IN_INVESTIGATION");
      }

      const existing = await tx.rcfaRootCauseFinal.findUnique({
        where: { id: finalId },
      });
      if (!existing || existing.rcfaId !== id) {
        throw new Error("NOT_FOUND");
      }

      await tx.rcfaRootCauseFinal.delete({ where: { id: finalId } });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "final_deleted",
          eventPayload: {
            finalId,
            causeText: existing.causeText,
          },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RCFA_NOT_IN_INVESTIGATION") {
        return NextResponse.json(
          { error: "RCFA must be in investigation status" },
          { status: 409 }
        );
      }
      if (error.message === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Root cause not found" },
          { status: 404 }
        );
      }
    }
    console.error(
      "DELETE /api/rcfa/[id]/root-causes/finals/[finalId] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
