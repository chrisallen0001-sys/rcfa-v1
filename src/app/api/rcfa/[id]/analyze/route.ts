import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";
import { getAuthContext } from "@/lib/auth-context";
import type {
  Rcfa,
  QuestionCategory,
  ConfidenceLabel,
  Priority,
} from "@/generated/prisma/client";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

const SYSTEM_PROMPT = `You are an expert reliability engineer performing a Root Cause Failure Analysis (RCFA). Analyze the intake data provided and return valid JSON only with the following structure:

{
  "followUpQuestions": [
    { "questionText": "string", "questionCategory": "failure_mode|evidence|operating_context|maintenance_history|safety|other" }
  ],
  "rootCauseCandidates": [
    { "causeText": "string", "rationaleText": "string", "confidenceLabel": "low|medium|high" }
  ],
  "actionItems": [
    { "actionText": "string", "rationaleText": "string", "priority": "low|medium|high", "timeframeText": "string", "successCriteria": "string" }
  ]
}

Requirements:
- followUpQuestions: 5 to 10 items. Choose the most relevant questionCategory for each.
- rootCauseCandidates: 3 to 6 items. Provide a rationale and confidence level for each.
- actionItems: 5 to 10 items. Include priority, a concrete timeframe, and measurable success criteria.
- Return ONLY valid JSON. No markdown, no commentary.`;

interface AnalysisResult {
  followUpQuestions: {
    questionText: string;
    questionCategory: QuestionCategory;
  }[];
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

function validateAnalysisResult(parsed: unknown): AnalysisResult {
  const obj = parsed as Record<string, unknown>;
  if (
    !Array.isArray(obj.followUpQuestions) ||
    !Array.isArray(obj.rootCauseCandidates) ||
    !Array.isArray(obj.actionItems)
  ) {
    throw new Error("Malformed analysis structure");
  }
  return obj as unknown as AnalysisResult;
}

function buildUserPrompt(rcfa: Rcfa): string {
  const lines = [
    `Equipment Description: ${rcfa.equipmentDescription}`,
    rcfa.equipmentMake && `Equipment Make: ${rcfa.equipmentMake}`,
    rcfa.equipmentModel && `Equipment Model: ${rcfa.equipmentModel}`,
    rcfa.equipmentSerialNumber && `Serial Number: ${rcfa.equipmentSerialNumber}`,
    rcfa.equipmentAgeYears != null && `Equipment Age (years): ${rcfa.equipmentAgeYears}`,
    `Operating Context: ${rcfa.operatingContext}`,
    rcfa.preFailureConditions && `Pre-Failure Conditions: ${rcfa.preFailureConditions}`,
    `Failure Description: ${rcfa.failureDescription}`,
    rcfa.workHistorySummary && `Work History Summary: ${rcfa.workHistorySummary}`,
    rcfa.activePmsSummary && `Active PMs Summary: ${rcfa.activePmsSummary}`,
    rcfa.additionalNotes && `Additional Notes: ${rcfa.additionalNotes}`,
  ];
  return lines.filter(Boolean).join("\n");
}

async function callOpenAI(userPrompt: string): Promise<AnalysisResult> {
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
  return validateAnalysisResult(JSON.parse(content));
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();

    const { id } = await params;

    const rcfa = await prisma.rcfa.findUnique({ where: { id } });
    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    if (rcfa.createdByUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (rcfa.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft RCFAs can be analyzed" },
        { status: 409 }
      );
    }

    const userPrompt = buildUserPrompt(rcfa);

    let result: AnalysisResult;
    try {
      result = await callOpenAI(userPrompt);
    } catch (firstError) {
      console.warn("OpenAI first attempt failed, retrying:", firstError);
      try {
        result = await callOpenAI(userPrompt);
      } catch (retryError) {
        console.error("POST /api/rcfa/[id]/analyze OpenAI error:", retryError);
        return NextResponse.json(
          { error: "Failed to analyze RCFA" },
          { status: 502 }
        );
      }
    }

    await prisma.$transaction([
      prisma.rcfaFollowupQuestion.createMany({
        data: result.followUpQuestions.map((q) => ({
          rcfaId: id,
          questionText: q.questionText,
          questionCategory: q.questionCategory,
          generatedBy: "ai" as const,
        })),
      }),
      prisma.rcfaRootCauseCandidate.createMany({
        data: result.rootCauseCandidates.map((c) => ({
          rcfaId: id,
          causeText: c.causeText,
          rationaleText: c.rationaleText,
          confidenceLabel: c.confidenceLabel,
          generatedBy: "ai" as const,
        })),
      }),
      prisma.rcfaActionItemCandidate.createMany({
        data: result.actionItems.map((a) => ({
          rcfaId: id,
          actionText: a.actionText,
          rationaleText: a.rationaleText,
          priority: a.priority,
          timeframeText: a.timeframeText,
          successCriteria: a.successCriteria,
          generatedBy: "ai" as const,
        })),
      }),
      prisma.rcfa.update({
        where: { id },
        data: { status: "investigation" },
      }),
    ]);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("POST /api/rcfa/[id]/analyze error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
