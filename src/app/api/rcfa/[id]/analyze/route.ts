import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";
import { getAuthContext } from "@/lib/auth-context";

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
    questionCategory: string;
  }[];
  rootCauseCandidates: {
    causeText: string;
    rationaleText: string;
    confidenceLabel: string;
  }[];
  actionItems: {
    actionText: string;
    rationaleText: string;
    priority: string;
    timeframeText: string;
    successCriteria: string;
  }[];
}

function buildUserPrompt(rcfa: {
  equipmentDescription: string;
  equipmentMake: string | null;
  equipmentModel: string | null;
  equipmentSerialNumber: string | null;
  equipmentAgeYears: unknown;
  operatingContext: string;
  preFailureConditions: string | null;
  failureDescription: string;
  workHistorySummary: string | null;
  activePmsSummary: string | null;
  additionalNotes: string | null;
}): string {
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
  return JSON.parse(content) as AnalysisResult;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthContext();

    const { id } = await params;

    const rcfa = await prisma.rcfa.findUnique({ where: { id } });
    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    const userPrompt = buildUserPrompt(rcfa);

    let result: AnalysisResult;
    try {
      result = await callOpenAI(userPrompt);
    } catch {
      // Retry once on failure
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

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("POST /api/rcfa/[id]/analyze error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
