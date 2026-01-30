import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";
import { getAuthContext } from "@/lib/auth-context";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id: rcfaId, questionId } = await params;

    // Verify the RCFA belongs to this user
    const rcfa = await prisma.rcfa.findUnique({
      where: { id: rcfaId },
      select: { createdByUserId: true },
    });

    if (!rcfa || rcfa.createdByUserId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const answerText =
      typeof body.answerText === "string" ? body.answerText.trim() : null;

    if (!answerText) {
      return NextResponse.json(
        { error: "answerText is required" },
        { status: 400 }
      );
    }

    if (answerText.length > 10000) {
      return NextResponse.json(
        { error: "answerText must not exceed 10000 characters" },
        { status: 400 }
      );
    }

    const updated = await prisma.rcfaFollowupQuestion.update({
      where: { id: questionId, rcfaId },
      data: {
        answerText,
        answeredByUserId: userId,
        answeredAt: new Date(),
      },
      include: {
        answeredBy: { select: { email: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }
    console.error("Failed to save followup answer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
