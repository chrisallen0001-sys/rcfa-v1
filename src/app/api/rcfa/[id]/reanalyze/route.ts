import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";
import { getAuthContext } from "@/lib/auth-context";
import type {
  Rcfa,
  RcfaFollowupQuestion,
  ConfidenceLabel,
  Priority,
} from "@/generated/prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

const SYSTEM_PROMPT = `You are an expert reliability engineer performing a Root Cause Failure Analysis (RCFA). You previously analyzed intake data and generated follow-up questions. The user has now answered some of those questions. Re-analyze using both the original intake data AND the follow-up answers to produce updated, more precise results.

Return valid JSON only with the following structure:

{
  "rootCauseCandidates": [
    { "causeText": "string", "rationaleText": "string", "confidenceLabel": "low|medium|high" }
  ],
  "actionItems": [
    { "actionText": "string", "rationaleText": "string", "priority": "low|medium|high", "timeframeText": "string", "successCriteria": "string" }
  ]
}

Requirements:
- rootCauseCandidates: 3 to 6 items. Incorporate insights from the follow-up answers. Provide a rationale and confidence level for each.
- actionItems: 5 to 10 items. Include priority, a concrete timeframe, and measurable success criteria.
- Return ONLY valid JSON. No markdown, no commentary.`;

interface ReAnalysisResult {
  rootCauseCandidates: {
    causeText: string;
    rationaleText: string;
    confidenceLabel: ConfidenceLabel;
  }[];
  actionItems: {
    actionText: string;
    rationaleText: string;
    priority: Priority;
    timeframeText: string;
    successCriteria: string;
  }[];
}

const VALID_CONFIDENCE_LABELS: ConfidenceLabel[] = ["low", "medium", "high"];
const VALID_PRIORITIES: Priority[] = ["low", "medium", "high"];

function validateReAnalysisResult(parsed: unknown): ReAnalysisResult {
  const obj = parsed as Record<string, unknown>;
  if (
    !Array.isArray(obj.rootCauseCandidates) ||
    !Array.isArray(obj.actionItems)
  ) {
    throw new Error("Malformed re-analysis structure");
  }

  for (const c of obj.rootCauseCandidates) {
    if (!c?.causeText || typeof c.causeText !== "string") {
      throw new Error("Malformed rootCauseCandidate: missing causeText");
    }
    if (!VALID_CONFIDENCE_LABELS.includes(c.confidenceLabel)) {
      throw new Error(`Invalid confidenceLabel: ${c.confidenceLabel}`);
    }
  }

  for (const a of obj.actionItems) {
    if (!a?.actionText || typeof a.actionText !== "string") {
      throw new Error("Malformed actionItem: missing actionText");
    }
    if (!VALID_PRIORITIES.includes(a.priority)) {
      throw new Error(`Invalid priority: ${a.priority}`);
    }
  }

  return obj as unknown as ReAnalysisResult;
}

function buildReAnalyzePrompt(
  rcfa: Rcfa,
  allQuestions: RcfaFollowupQuestion[]
): string {
  const intakeLines = [
    `Equipment Description: ${rcfa.equipmentDescription}`,
    rcfa.equipmentMake && `Equipment Make: ${rcfa.equipmentMake}`,
    rcfa.equipmentModel && `Equipment Model: ${rcfa.equipmentModel}`,
    rcfa.equipmentSerialNumber && `Serial Number: ${rcfa.equipmentSerialNumber}`,
    rcfa.equipmentAgeYears != null &&
      `Equipment Age (years): ${rcfa.equipmentAgeYears}`,
    `Operating Context: ${rcfa.operatingContext}`,
    rcfa.preFailureConditions &&
      `Pre-Failure Conditions: ${rcfa.preFailureConditions}`,
    `Failure Description: ${rcfa.failureDescription}`,
    rcfa.workHistorySummary &&
      `Work History Summary: ${rcfa.workHistorySummary}`,
    rcfa.activePmsSummary && `Active PMs Summary: ${rcfa.activePmsSummary}`,
    rcfa.additionalNotes && `Additional Notes: ${rcfa.additionalNotes}`,
  ];

  const qaLines = allQuestions.map((q) =>
    q.answerText !== null
      ? `Q: ${q.questionText}\nA: ${q.answerText}`
      : `Q: ${q.questionText}\nA: (Not yet answered)`
  );

  return [
    "=== ORIGINAL INTAKE DATA ===",
    intakeLines.filter(Boolean).join("\n"),
    "",
    "=== FOLLOW-UP QUESTIONS & ANSWERS ===",
    qaLines.join("\n\n"),
  ].join("\n");
}

async function callOpenAI(userPrompt: string): Promise<ReAnalysisResult> {
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }
  return validateReAnalysisResult(JSON.parse(content));
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid RCFA id" }, { status: 400 });
    }

    const rcfa = await prisma.rcfa.findUnique({
      where: { id },
      include: {
        followupQuestions: { orderBy: { generatedAt: "asc" } },
      },
    });

    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    if (rcfa.createdByUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (rcfa.status !== "investigation") {
      return NextResponse.json(
        { error: "Only RCFAs in investigation status can be re-analyzed" },
        { status: 409 }
      );
    }

    const answeredQuestions = rcfa.followupQuestions.filter(
      (q) => q.answerText !== null
    );

    if (answeredQuestions.length === 0) {
      return NextResponse.json(
        { error: "At least one follow-up question must be answered before re-analyzing" },
        { status: 422 }
      );
    }

    const userPrompt = buildReAnalyzePrompt(rcfa, rcfa.followupQuestions);

    let result: ReAnalysisResult;
    try {
      result = await callOpenAI(userPrompt);
    } catch (firstError) {
      console.warn("OpenAI first attempt failed, retrying:", firstError);
      try {
        result = await callOpenAI(userPrompt);
      } catch (retryError) {
        console.error(
          "POST /api/rcfa/[id]/reanalyze OpenAI error:",
          retryError
        );
        return NextResponse.json(
          { error: "Failed to re-analyze RCFA" },
          { status: 502 }
        );
      }
    }

    // Replace old AI-generated candidates with new ones in a transaction
    await prisma.$transaction(async (tx) => {
      // Re-read with row lock to prevent race conditions
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "investigation") {
        throw new Error("RCFA_NOT_IN_INVESTIGATION");
      }

      // Delete old AI-generated candidates
      await tx.rcfaRootCauseCandidate.deleteMany({
        where: { rcfaId: id, generatedBy: "ai" },
      });
      await tx.rcfaActionItemCandidate.deleteMany({
        where: { rcfaId: id, generatedBy: "ai" },
      });

      // Insert new candidates
      await tx.rcfaRootCauseCandidate.createMany({
        data: result.rootCauseCandidates.map((c) => ({
          rcfaId: id,
          causeText: c.causeText,
          rationaleText: c.rationaleText,
          confidenceLabel: c.confidenceLabel,
          generatedBy: "ai" as const,
        })),
      });
      await tx.rcfaActionItemCandidate.createMany({
        data: result.actionItems.map((a) => ({
          rcfaId: id,
          actionText: a.actionText,
          rationaleText: a.rationaleText,
          priority: a.priority,
          timeframeText: a.timeframeText,
          successCriteria: a.successCriteria,
          generatedBy: "ai" as const,
        })),
      });
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RCFA_NOT_IN_INVESTIGATION"
    ) {
      return NextResponse.json(
        { error: "Only RCFAs in investigation status can be re-analyzed" },
        { status: 409 }
      );
    }
    console.error("POST /api/rcfa/[id]/reanalyze error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
