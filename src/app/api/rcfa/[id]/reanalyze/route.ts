import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";
import { getAuthContext } from "@/lib/auth-context";
import { AUDIT_EVENT_TYPES, AUDIT_SOURCES } from "@/lib/audit-constants";
import {
  VALID_CONFIDENCE_LABELS,
  VALID_PRIORITIES,
} from "@/lib/validation-constants";
import type {
  Rcfa,
  RcfaFollowupQuestion,
  RcfaRootCauseCandidate,
  RcfaActionItemCandidate,
  ConfidenceLabel,
  Priority,
} from "@/generated/prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

const SYSTEM_PROMPT = `You are an expert reliability engineer performing a Root Cause Failure Analysis (RCFA). You previously analyzed intake data and generated follow-up questions. The user has now answered some of those questions.

The user message contains:
1. Original intake data
2. Investigation notes (new findings added during investigation)
3. Follow-up questions and answers
4. The EXISTING root cause candidates and action item candidates currently on file (with their UUIDs and generatedBy field)

Your task has three steps:

STEP 1 — MATERIALITY ASSESSMENT. Review the follow-up answers AND investigation notes alongside the EXISTING root cause candidates and action items. Your goal is to determine whether the new information (answers or investigation notes) introduces anything that would materially alter the existing candidates. Focus on whether the engineering conclusions and failure hypotheses change — not on whether the text itself looks different.

Ask yourself these specific questions:
  a) Does any answer reveal a NEW failure mechanism not already captured by an existing candidate?
  b) Does any answer CONTRADICT an existing candidate with evidence that disproves it?
  c) Does any answer shift the relative likelihood of root causes enough to change confidence levels?
  d) Does any answer make an existing action item irrelevant or demand a new category of action?
  e) Does any answer shift the priority or urgency of an existing action item?

If the answer to ALL of the above is "no," set noMaterialChange to true and return empty arrays for all candidate fields.

STEP 2A — RE-EVALUATE EXISTING AI CANDIDATES (only if Step 1 determined material change exists).
For each existing candidate where generatedBy="ai", determine if the new evidence:
- CONFIRMS the candidate → keep or INCREASE confidence/priority
- CONTRADICTS the candidate → LOWER confidence/priority, or set to "deprioritized"
- HAS NO EFFECT → keep current level (do not include in existingCandidateUpdates)

IMPORTANT RULES:
- Candidates where generatedBy="human" MUST NOT be re-evaluated. Never include them in existingCandidateUpdates.
- Use "deprioritized" when new evidence strongly contradicts a previous hypothesis or makes an action item irrelevant.
- Only include candidates in existingCandidateUpdates if their confidence/priority should CHANGE. Do not include unchanged candidates.
- Always provide an updateReason explaining WHY the confidence/priority changed based on the new evidence.

STEP 2B — PRODUCE ONLY NEW CANDIDATES (only if Step 1 determined material change exists). If and only if Step 1 identified a genuine material change, produce ONLY NEW root cause candidates and action items that differ from the existing ones. Do NOT repeat or rephrase existing candidates. The new candidates you provide will be APPENDED to the existing list, so only include genuinely new hypotheses or actions that are not already captured.

A material change requires that the ENGINEERING CONCLUSIONS change, not merely that the answer text looks different. Specifically, a material change means ANY of the following:
- A new root cause should be added that is not substantively covered by any existing candidate
- An existing root cause should be removed because evidence now contradicts it
- The confidence level of a root cause candidate should change
- A new category of action item is warranted that is not covered by existing items
- An existing action item is no longer relevant given the new evidence
- The priority of an action item should change significantly

The following do NOT constitute material change — when any of these are the ONLY differences, you MUST return noMaterialChange: true:

FORMAT CHANGES:
- An answer reformatted from bullet points to prose paragraphs, or vice versa, that conveys the same information
- Changes in answer structure, headings, or organization that do not alter the technical content
- Addition of narrative context or explanatory prose around the same data points

NUMERIC / MEASUREMENT VARIANCE:
- Small variations in reported measurement values (e.g., 190 ppm vs 210 ppm, or 240 ppm vs 260 ppm) where both values fall within the same diagnostic category and lead to the same engineering conclusion
- Rounding differences or approximation differences (e.g., "~190 ppm" vs "210 ppm" vs "approximately 200 ppm")
- Slightly different numeric ranges that describe the same condition (e.g., "1,500-1,800 ppm" vs "1,600-1,900 ppm" when both indicate the same severity of contamination)

TEXTUAL EQUIVALENCE:
- Cosmetic rewording or minor rephrasing of existing candidates
- Reordering candidates without changing their substance
- Slight variations in rationale text that reach the same conclusion
- More verbose or more concise expression of the same technical finding
- Paraphrasing of the same evidence using different terminology (e.g., "elevated moisture" vs "significantly elevated Karl Fischer water content" when referring to the same condition)

IMPORTANT: Before deciding on noMaterialChange, summarize in one sentence what NEW engineering insight (if any) the updated answers provide that was not already reflected in the existing candidates. If you cannot identify a specific new insight that would change a root cause hypothesis or action item, the answer is noMaterialChange: true.

Return valid JSON only with the following structure:

{
  "materialityReasoning": "string",
  "noMaterialChange": true | false,
  "existingCandidateUpdates": {
    "rootCauses": [
      { "id": "uuid", "confidenceLabel": "deprioritized|low|medium|high", "updateReason": "string" }
    ],
    "actionItems": [
      { "id": "uuid", "priority": "deprioritized|low|medium|high", "updateReason": "string" }
    ]
  },
  "rootCauseCandidates": [
    { "causeText": "string", "rationaleText": "string", "confidenceLabel": "low|medium|high" }
  ],
  "actionItems": [
    { "actionText": "string", "rationaleText": "string", "priority": "low|medium|high", "timeframeText": "string", "successCriteria": "string" }
  ]
}

Requirements:
- materialityReasoning: A concise explanation (max 45 words) summarizing what new engineering insight the updated answers provide and how it affects the analysis. If there is no new insight, state that explicitly (e.g., "The updated answers convey the same failure evidence and diagnostic conclusions as previously provided.").
- noMaterialChange: Set to true when the existing candidates already correctly capture the root cause hypotheses and action items supported by the evidence. The bar for material change is HIGH: the new answers must introduce a genuinely new failure hypothesis, contradict an existing one with evidence, or shift confidence/priority levels. Reformatting, paraphrasing, or minor numeric variance in answers that reach the same engineering conclusions is NEVER material change. When true, all candidate arrays should be empty. If no existing candidates are on file (both sections show "(none)"), you MUST set noMaterialChange to false and provide your full analysis.
- existingCandidateUpdates: Contains updates to existing AI-generated candidates. Only include candidates whose confidence/priority should change. Each update must have the candidate's UUID (from the prompt), the new confidence/priority level, and an updateReason. NEVER include human-generated candidates here.
- When noMaterialChange is false: rootCauseCandidates should have 0 to 6 NEW items (0 if only existing candidates need updates), actionItems should have 0 to 10 NEW items.
- rootCauseCandidates: ONLY genuinely NEW hypotheses. Incorporate insights from the follow-up answers. Provide a rationale and confidence level for each.
- actionItems: ONLY genuinely NEW action items. Include priority, a concrete timeframe, and measurable success criteria.
- Return ONLY valid JSON. No markdown, no commentary.`;

interface ExistingCandidateUpdate {
  rootCauses: {
    id: string;
    confidenceLabel: ConfidenceLabel;
    updateReason: string;
  }[];
  actionItems: {
    id: string;
    priority: Priority;
    updateReason: string;
  }[];
}

interface ReAnalysisResult {
  materialityReasoning?: string;
  noMaterialChange: boolean;
  existingCandidateUpdates: ExistingCandidateUpdate;
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

function validateReAnalysisResult(parsed: unknown): ReAnalysisResult {
  const obj = parsed as Record<string, unknown>;
  if (
    !Array.isArray(obj.rootCauseCandidates) ||
    !Array.isArray(obj.actionItems)
  ) {
    throw new Error("Malformed re-analysis structure");
  }

  const noMaterialChange = obj.noMaterialChange === true;
  const materialityReasoning =
    typeof obj.materialityReasoning === "string"
      ? obj.materialityReasoning
      : undefined;

  // Parse and validate existingCandidateUpdates
  const rawUpdates = obj.existingCandidateUpdates as Record<string, unknown> | undefined;
  const existingCandidateUpdates: ExistingCandidateUpdate = {
    rootCauses: [],
    actionItems: [],
  };

  if (rawUpdates && typeof rawUpdates === "object") {
    // Validate root cause updates
    if (Array.isArray(rawUpdates.rootCauses)) {
      for (const update of rawUpdates.rootCauses) {
        if (!update?.id || typeof update.id !== "string" || !UUID_RE.test(update.id)) {
          throw new Error(`Invalid root cause update: missing or invalid id`);
        }
        if (!VALID_CONFIDENCE_LABELS.includes(update.confidenceLabel)) {
          throw new Error(`Invalid root cause update confidenceLabel: ${update.confidenceLabel}`);
        }
        if (!update.updateReason || typeof update.updateReason !== "string") {
          throw new Error(`Invalid root cause update: missing updateReason for id ${update.id}`);
        }
        existingCandidateUpdates.rootCauses.push({
          id: update.id,
          confidenceLabel: update.confidenceLabel as ConfidenceLabel,
          updateReason: update.updateReason,
        });
      }
    }

    // Validate action item updates
    if (Array.isArray(rawUpdates.actionItems)) {
      for (const update of rawUpdates.actionItems) {
        if (!update?.id || typeof update.id !== "string" || !UUID_RE.test(update.id)) {
          throw new Error(`Invalid action item update: missing or invalid id`);
        }
        if (!VALID_PRIORITIES.includes(update.priority)) {
          throw new Error(`Invalid action item update priority: ${update.priority}`);
        }
        if (!update.updateReason || typeof update.updateReason !== "string") {
          throw new Error(`Invalid action item update: missing updateReason for id ${update.id}`);
        }
        existingCandidateUpdates.actionItems.push({
          id: update.id,
          priority: update.priority as Priority,
          updateReason: update.updateReason,
        });
      }
    }
  }

  if (noMaterialChange) {
    // When noMaterialChange is true, all arrays should be empty
    if (obj.rootCauseCandidates.length > 0 || obj.actionItems.length > 0) {
      console.warn("AI returned noMaterialChange=true with non-empty new candidate arrays; discarding");
    }
    if (existingCandidateUpdates.rootCauses.length > 0 || existingCandidateUpdates.actionItems.length > 0) {
      console.warn("AI returned noMaterialChange=true with non-empty existingCandidateUpdates; discarding");
    }
    return {
      materialityReasoning,
      noMaterialChange,
      existingCandidateUpdates: { rootCauses: [], actionItems: [] },
      rootCauseCandidates: [],
      actionItems: [],
    };
  }

  // When noMaterialChange is false, we need either new candidates OR updates to existing ones
  const hasNewCandidates = obj.rootCauseCandidates.length > 0 || obj.actionItems.length > 0;
  const hasUpdates = existingCandidateUpdates.rootCauses.length > 0 || existingCandidateUpdates.actionItems.length > 0;

  if (!hasNewCandidates && !hasUpdates) {
    throw new Error(
      "AI returned noMaterialChange=false but provided no new candidates and no updates; aborting to prevent data loss"
    );
  }

  // Validate new candidates
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

  return {
    materialityReasoning,
    noMaterialChange,
    existingCandidateUpdates,
    rootCauseCandidates: obj.rootCauseCandidates,
    actionItems: obj.actionItems,
  } as ReAnalysisResult;
}

/** Truncate a text field to a safe length for inclusion in the LLM prompt. */
function truncateField(text: string | null, maxLen = 1000): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

function buildReAnalyzePrompt(
  rcfa: Rcfa,
  allQuestions: RcfaFollowupQuestion[],
  rootCauseCandidates: RcfaRootCauseCandidate[],
  actionItemCandidates: RcfaActionItemCandidate[]
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

  const investigationNotesSection = rcfa.investigationNotes
    ? `\n=== INVESTIGATION NOTES (NEW FINDINGS) ===\n${truncateField(rcfa.investigationNotes, 2000)}`
    : "";

  const qaLines = allQuestions.map((q) =>
    q.answerText !== null
      ? `Q: ${q.questionText}\nA: ${q.answerText}`
      : `Q: ${q.questionText}\nA: (Not yet answered)`
  );

  const rcLines =
    rootCauseCandidates.length > 0
      ? rootCauseCandidates.map((c, i) => {
          const humanMarker = c.generatedBy === "human" ? " [DO NOT RE-EVALUATE]" : "";
          return `[${i + 1}] id="${c.id}" | generatedBy="${c.generatedBy}"${humanMarker} | ${truncateField(c.causeText)} | Confidence: ${c.confidenceLabel}${c.rationaleText ? ` | Rationale: ${truncateField(c.rationaleText)}` : ""}`;
        })
      : ["(none)"];

  const aiLines =
    actionItemCandidates.length > 0
      ? actionItemCandidates.map((a, i) => {
          const humanMarker = a.generatedBy === "human" ? " [DO NOT RE-EVALUATE]" : "";
          return `[${i + 1}] id="${a.id}" | generatedBy="${a.generatedBy}"${humanMarker} | ${truncateField(a.actionText)} | Priority: ${a.priority}${a.timeframeText ? ` | Timeframe: ${truncateField(a.timeframeText)}` : ""}${a.rationaleText ? ` | Rationale: ${truncateField(a.rationaleText)}` : ""}${a.successCriteria ? ` | Success Criteria: ${truncateField(a.successCriteria)}` : ""}`;
        })
      : ["(none)"];

  return [
    "=== ORIGINAL INTAKE DATA ===",
    intakeLines.filter(Boolean).join("\n"),
    investigationNotesSection,
    "",
    "=== FOLLOW-UP QUESTIONS & ANSWERS ===",
    qaLines.join("\n\n"),
    "",
    "=== EXISTING ROOT CAUSE CANDIDATES ===",
    rcLines.join("\n"),
    "",
    "=== EXISTING ACTION ITEM CANDIDATES ===",
    aiLines.join("\n"),
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
    const { userId, role } = await getAuthContext();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid RCFA id" }, { status: 400 });
    }

    const rcfa = await prisma.rcfa.findUnique({
      where: { id },
      include: {
        followupQuestions: { orderBy: [{ generatedAt: "asc" }, { id: "asc" }] },
        rootCauseCandidates: { orderBy: { generatedAt: "asc" } },
        actionItemCandidates: { orderBy: { generatedAt: "asc" } },
      },
    });

    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    if (rcfa.ownerUserId !== userId && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (rcfa.status !== "investigation" && rcfa.status !== "actions_open") {
      return NextResponse.json(
        { error: "Only RCFAs in investigation or actions_open status can be re-analyzed" },
        { status: 409 }
      );
    }

    const answeredQuestions = rcfa.followupQuestions.filter(
      (q) => q.answerText !== null
    );

    const hasInvestigationNotes =
      rcfa.investigationNotes !== null && rcfa.investigationNotes.length > 0;

    // Require either answered questions OR investigation notes
    if (answeredQuestions.length === 0 && !hasInvestigationNotes) {
      return NextResponse.json(
        { error: "Answer at least one follow-up question or add investigation notes before re-analyzing" },
        { status: 422 }
      );
    }

    // Get the last analysis event to compare answer snapshots
    const lastAnalysis = await prisma.rcfaAuditEvent.findFirst({
      where: {
        rcfaId: id,
        eventType: AUDIT_EVENT_TYPES.CANDIDATE_GENERATED,
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, eventPayload: true },
    });

    // Extract previous answer snapshot (map of questionId -> answerText)
    const previousAnswerSnapshot: Record<string, string | null> = {};
    if (lastAnalysis?.eventPayload && typeof lastAnalysis.eventPayload === "object") {
      const payload = lastAnalysis.eventPayload as Record<string, unknown>;
      if (payload.answerSnapshot && typeof payload.answerSnapshot === "object") {
        Object.assign(previousAnswerSnapshot, payload.answerSnapshot);
      }
    }

    // Guard: reject if no answers or investigation notes have changed since the last re-analysis
    const isReanalysis = lastAnalysis?.eventPayload &&
      typeof lastAnalysis.eventPayload === "object" &&
      ((lastAnalysis.eventPayload as Record<string, unknown>).source === AUDIT_SOURCES.AI_REANALYSIS ||
       (lastAnalysis.eventPayload as Record<string, unknown>).source === AUDIT_SOURCES.AI_REANALYSIS_NO_CHANGE);

    if (isReanalysis) {
      const hasNewAnswers = answeredQuestions.some(
        (q) => q.answeredAt !== null && q.answeredAt > lastAnalysis.createdAt
      );
      const hasNewInvestigationNotes =
        rcfa.investigationNotesUpdatedAt !== null &&
        rcfa.investigationNotesUpdatedAt > lastAnalysis.createdAt;

      if (!hasNewAnswers && !hasNewInvestigationNotes) {
        return NextResponse.json(
          { error: "No new answers or investigation notes since the last re-analysis" },
          { status: 422 }
        );
      }
    }

    // Build current answer snapshot and detect changes for audit logging
    const currentAnswerSnapshot: Record<string, string | null> = {};
    const answerAuditEvents: Array<{
      eventType: string;
      eventPayload: { [key: string]: string | null };
    }> = [];

    for (const q of rcfa.followupQuestions) {
      currentAnswerSnapshot[q.id] = q.answerText;

      const previousAnswer = previousAnswerSnapshot[q.id] ?? null;
      const currentAnswer = q.answerText;

      // First-time answer (was null, now has value)
      if (previousAnswer === null && currentAnswer !== null) {
        answerAuditEvents.push({
          eventType: AUDIT_EVENT_TYPES.ANSWER_SUBMITTED,
          eventPayload: {
            questionId: q.id,
            questionText: q.questionText,
            answerText: currentAnswer,
          },
        });
      }
      // Answer updated (had value, now different value)
      else if (previousAnswer !== null && currentAnswer !== null && previousAnswer !== currentAnswer) {
        answerAuditEvents.push({
          eventType: AUDIT_EVENT_TYPES.ANSWER_UPDATED,
          eventPayload: {
            questionId: q.id,
            questionText: q.questionText,
            previousAnswer,
            newAnswer: currentAnswer,
          },
        });
      }
    }

    const userPrompt = buildReAnalyzePrompt(
      rcfa,
      rcfa.followupQuestions,
      rcfa.rootCauseCandidates,
      rcfa.actionItemCandidates
    );

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

    // Cap materialityReasoning for audit storage (prompt asks for one sentence)
    const materialityReasoning = result.materialityReasoning
      ? truncateField(result.materialityReasoning, 500)
      : null;

    if (result.materialityReasoning) {
      console.log(
        `POST /api/rcfa/${id}/reanalyze materiality reasoning:`,
        result.materialityReasoning
      );
    }

    if (result.noMaterialChange) {
      // No material change — preserve existing candidates, log for traceability.
      // Use transaction to log answer changes atomically with the analysis event.
      await prisma.$transaction(async (tx) => {
        // Log answer audit events
        for (const event of answerAuditEvents) {
          await tx.rcfaAuditEvent.create({
            data: {
              rcfaId: id,
              actorUserId: userId,
              eventType: event.eventType,
              eventPayload: event.eventPayload,
            },
          });
        }

        await tx.rcfaAuditEvent.create({
          data: {
            rcfaId: id,
            actorUserId: userId,
            eventType: AUDIT_EVENT_TYPES.CANDIDATE_GENERATED,
            eventPayload: {
              source: AUDIT_SOURCES.AI_REANALYSIS_NO_CHANGE,
              materialityReasoning,
              rootCauseCandidateCount: 0,
              actionItemCandidateCount: 0,
              answerSnapshot: currentAnswerSnapshot,
            },
          },
        });
      });

      return NextResponse.json(
        {
          noMaterialChange: true,
          materialityReasoning: materialityReasoning ?? null,
          existingCandidateUpdates: { rootCauses: [], actionItems: [] },
        },
        { status: 200 }
      );
    }

    // Update existing candidates and append new ones
    let updatedRootCauseCount = 0;
    let updatedActionItemCount = 0;

    await prisma.$transaction(async (tx) => {
      // Re-read with row lock to prevent race conditions
      const locked = await tx.rcfa.findUniqueOrThrow({ where: { id } });
      if (locked.status !== "investigation" && locked.status !== "actions_open") {
        throw new Error("RCFA_STATUS_INVALID");
      }

      // Update existing AI-generated root cause candidates
      for (const update of result.existingCandidateUpdates.rootCauses) {
        // Fetch existing candidate to get previous value for audit logging
        const existing = await tx.rcfaRootCauseCandidate.findFirst({
          where: { id: update.id, rcfaId: id, generatedBy: "ai" },
          select: { id: true, confidenceLabel: true, causeText: true },
        });

        if (!existing) {
          console.warn(
            `Root cause candidate ${update.id} not found or not AI-generated; skipping update`
          );
          continue;
        }

        // Only update if confidence actually changed
        if (existing.confidenceLabel !== update.confidenceLabel) {
          await tx.rcfaRootCauseCandidate.update({
            where: { id: update.id },
            data: { confidenceLabel: update.confidenceLabel },
          });

          updatedRootCauseCount++;

          // Log audit event for this update
          await tx.rcfaAuditEvent.create({
            data: {
              rcfaId: id,
              actorUserId: userId,
              eventType: AUDIT_EVENT_TYPES.CANDIDATE_UPDATED,
              eventPayload: {
                candidateId: update.id,
                candidateType: "rootCause",
                causeText: truncateField(existing.causeText, 200),
                previousConfidence: existing.confidenceLabel,
                newConfidence: update.confidenceLabel,
                updateReason: update.updateReason,
              },
            },
          });
        }
      }

      // Update existing AI-generated action item candidates
      for (const update of result.existingCandidateUpdates.actionItems) {
        // Fetch existing candidate to get previous value for audit logging
        const existing = await tx.rcfaActionItemCandidate.findFirst({
          where: { id: update.id, rcfaId: id, generatedBy: "ai" },
          select: { id: true, priority: true, actionText: true },
        });

        if (!existing) {
          console.warn(
            `Action item candidate ${update.id} not found or not AI-generated; skipping update`
          );
          continue;
        }

        // Only update if priority actually changed
        if (existing.priority !== update.priority) {
          await tx.rcfaActionItemCandidate.update({
            where: { id: update.id },
            data: { priority: update.priority },
          });

          updatedActionItemCount++;

          // Log audit event for this update
          await tx.rcfaAuditEvent.create({
            data: {
              rcfaId: id,
              actorUserId: userId,
              eventType: AUDIT_EVENT_TYPES.CANDIDATE_UPDATED,
              eventPayload: {
                candidateId: update.id,
                candidateType: "actionItem",
                actionText: truncateField(existing.actionText, 200),
                previousPriority: existing.priority,
                newPriority: update.priority,
                updateReason: update.updateReason,
              },
            },
          });
        }
      }

      // Insert new candidates (keeping existing ones - they can be identified by generatedAt timestamp)
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

      // Log answer audit events
      for (const event of answerAuditEvents) {
        await tx.rcfaAuditEvent.create({
          data: {
            rcfaId: id,
            actorUserId: userId,
            eventType: event.eventType,
            eventPayload: event.eventPayload,
          },
        });
      }

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: id,
          actorUserId: userId,
          eventType: AUDIT_EVENT_TYPES.CANDIDATE_GENERATED,
          eventPayload: {
            source: AUDIT_SOURCES.AI_REANALYSIS,
            materialityReasoning,
            updatedRootCauseCount,
            updatedActionItemCount,
            rootCauseCandidateCount: result.rootCauseCandidates.length,
            actionItemCandidateCount: result.actionItems.length,
            answerSnapshot: currentAnswerSnapshot,
          },
        },
      });
    });

    return NextResponse.json(
      {
        noMaterialChange: result.noMaterialChange,
        materialityReasoning: materialityReasoning ?? null,
        existingCandidateUpdates: result.existingCandidateUpdates,
        rootCauseCandidates: result.rootCauseCandidates,
        actionItems: result.actionItems,
      },
      { status: 200 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RCFA_STATUS_INVALID"
    ) {
      return NextResponse.json(
        { error: "Only RCFAs in investigation or actions_open status can be re-analyzed" },
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
