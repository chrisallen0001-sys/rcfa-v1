import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";
import { getAuthContext } from "@/lib/auth-context";
import { AUDIT_EVENT_TYPES, AUDIT_SOURCES } from "@/lib/audit-constants";
import {
  VALID_CONFIDENCE_LABELS,
  VALID_PRIORITIES,
  VALID_QUESTION_CATEGORIES,
} from "@/lib/validation-constants";
import type {
  Rcfa,
  QuestionCategory,
  ConfidenceLabel,
  Priority,
} from "@/generated/prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
    { "actionText": "string (max 90 chars, action-oriented title)", "rationaleText": "string (detailed description: what needs to be done, why, and what systems are involved)", "priority": "low|medium|high", "timeframeText": "string", "suggestedDueDate": "YYYY-MM-DD" }
  ]
}

Requirements:
- followUpQuestions: 5 to 10 items. Choose the most relevant questionCategory for each.
- rootCauseCandidates: 3 to 6 items. Provide a rationale and confidence level for each.
- actionItems: 5 to 10 items. actionText should be a concise, action-oriented title (max 90 characters). rationaleText should be a detailed description explaining what needs to be done, why it matters, and what systems or components are involved. suggestedDueDate should be a reasonable ISO date (YYYY-MM-DD) based on urgency and effort, using today's date from the prompt as reference.
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
    suggestedDueDate?: string;
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

  for (const q of obj.followUpQuestions) {
    if (!q?.questionText || typeof q.questionText !== "string") {
      throw new Error("Malformed followUpQuestion: missing questionText");
    }
    // Category is non-critical; fall back gracefully rather than rejecting the entire analysis
    if (!VALID_QUESTION_CATEGORIES.includes(q.questionCategory)) {
      q.questionCategory = "other";
    }
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

  return obj as unknown as AnalysisResult;
}

function buildUserPrompt(rcfa: Rcfa): string {
  const today = new Date().toISOString().split("T")[0];
  const lines = [
    `Today's date is ${today}. Use this to calculate suggested due dates for action items.`,
    "",
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
    const { userId, role } = await getAuthContext();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid RCFA id" }, { status: 400 });
    }

    // Read outside transaction for early auth/404 checks
    const rcfa = await prisma.rcfa.findUnique({ where: { id } });
    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    if (rcfa.ownerUserId !== userId && role !== "admin") {
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

    // Use interactive transaction with row lock to prevent duplicate writes
    await prisma.$transaction(async (tx) => {
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "draft") {
        throw new Error("RCFA_ALREADY_ANALYZED");
      }

      await tx.rcfaFollowupQuestion.createMany({
        data: result.followUpQuestions.map((q) => ({
          rcfaId: id,
          questionText: q.questionText,
          questionCategory: q.questionCategory,
          generatedBy: "ai" as const,
        })),
      });
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
          generatedBy: "ai" as const,
        })),
      });
      await tx.rcfa.update({
        where: { id },
        data: { status: "investigation" },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: AUDIT_EVENT_TYPES.CANDIDATE_GENERATED,
          eventPayload: {
            source: AUDIT_SOURCES.AI_INITIAL_ANALYSIS,
            rootCauseCandidateCount: result.rootCauseCandidates.length,
            actionItemCandidateCount: result.actionItems.length,
            followUpQuestionCount: result.followUpQuestions.length,
            answerSnapshot: {},
          },
        },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: "status_changed",
          eventPayload: { from: "draft", to: "investigation" },
        },
      });
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "RCFA_ALREADY_ANALYZED") {
      return NextResponse.json(
        { error: "Only draft RCFAs can be analyzed" },
        { status: 409 }
      );
    }
    console.error("POST /api/rcfa/[id]/analyze error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
