import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import FollowupQuestions from "./FollowupQuestions";
import ReAnalyzeButton from "./ReAnalyzeButton";
import StartInvestigationButton from "./StartInvestigationButton";
import PromoteRootCauseButton from "./PromoteRootCauseButton";
import PromoteActionItemButton from "./PromoteActionItemButton";
import AddRootCauseForm from "./AddRootCauseForm";
import EditableRootCause from "./EditableRootCause";
import FinalizeInvestigationButton from "./FinalizeInvestigationButton";
import AddActionItemForm from "./AddActionItemForm";
import EditableActionItem from "./EditableActionItem";
import type {
  RcfaStatus,
  ConfidenceLabel,
  Priority,
  OperatingContext,
} from "@/generated/prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_LABELS: Record<RcfaStatus, string> = {
  draft: "Draft",
  investigation: "Investigation",
  actions_open: "Actions Open",
  closed: "Closed",
};

const STATUS_COLORS: Record<RcfaStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  investigation: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  actions_open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  closed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const CONFIDENCE_COLORS: Record<ConfidenceLabel, string> = {
  low: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const OPERATING_CONTEXT_LABELS: Record<OperatingContext, string> = {
  running: "Running",
  startup: "Startup",
  shutdown: "Shutdown",
  maintenance: "Maintenance",
  unknown: "Unknown",
};


const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">
        {value}
      </dd>
    </div>
  );
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}

export default async function RcfaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ analyzeError?: string }>;
}) {
  const { userId } = await getAuthContext();
  const { id } = await params;
  const { analyzeError } = await searchParams;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const rcfa = await prisma.rcfa.findUnique({
    where: { id },
    include: {
      followupQuestions: {
        orderBy: { generatedAt: "asc" },
        include: { answeredBy: { select: { email: true } } },
      },
      rootCauseCandidates: { orderBy: { generatedAt: "asc" } },
      rootCauseFinals: {
        orderBy: { selectedAt: "asc" },
        include: { selectedBy: { select: { email: true } } },
      },
      actionItemCandidates: { orderBy: { generatedAt: "asc" } },
      actionItems: {
        orderBy: { createdAt: "asc" },
        include: { createdBy: { select: { email: true } } },
      },
    },
  });

  if (!rcfa || rcfa.createdByUserId !== userId) {
    notFound();
  }

  const hasAnalysis = rcfa.status !== "draft";
  const hasAnsweredQuestions = rcfa.followupQuestions.some(
    (q) => q.answerText !== null
  );
  const promotedCandidateIds = new Set(
    rcfa.rootCauseFinals
      .map((f) => f.selectedFromCandidateId)
      .filter(Boolean)
  );
  const promotedActionCandidateIds = new Set(
    rcfa.actionItems
      .map((a) => a.selectedFromCandidateId)
      .filter(Boolean)
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {rcfa.title || "RCFA Detail"}
        </h1>
        <Badge
          label={STATUS_LABELS[rcfa.status]}
          colorClass={STATUS_COLORS[rcfa.status]}
        />
      </div>

      {analyzeError && (
        <div className="mb-6 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          AI analysis could not be completed. Your RCFA has been saved as a draft.
        </div>
      )}

      {rcfa.status === "draft" && (
        <div className="mb-6">
          <StartInvestigationButton rcfaId={rcfa.id} />
        </div>
      )}

      <div className="space-y-6">
        {/* Intake Summary */}
        <Section title="Intake Summary">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Equipment Description" value={rcfa.equipmentDescription} />
            <Field label="Operating Context" value={OPERATING_CONTEXT_LABELS[rcfa.operatingContext]} />
            <Field label="Make" value={rcfa.equipmentMake} />
            <Field label="Model" value={rcfa.equipmentModel} />
            <Field label="Serial Number" value={rcfa.equipmentSerialNumber} />
            <Field
              label="Equipment Age (years)"
              value={rcfa.equipmentAgeYears?.toString() ?? null}
            />
            <Field
              label="Downtime (minutes)"
              value={rcfa.downtimeMinutes?.toString() ?? null}
            />
            <Field
              label="Production Cost (USD)"
              value={rcfa.productionCostUsd?.toString() ?? null}
            />
            <Field
              label="Maintenance Cost (USD)"
              value={rcfa.maintenanceCostUsd?.toString() ?? null}
            />
          </dl>
          <dl className="mt-4 grid gap-4">
            <Field label="Failure Description" value={rcfa.failureDescription} />
            <Field label="Pre-Failure Conditions" value={rcfa.preFailureConditions} />
            <Field label="Work History Summary" value={rcfa.workHistorySummary} />
            <Field label="Active PMs Summary" value={rcfa.activePmsSummary} />
            <Field label="Additional Notes" value={rcfa.additionalNotes} />
          </dl>
        </Section>

        {/* Follow-up Questions */}
        {hasAnalysis && rcfa.followupQuestions.length > 0 && (
          <Section title="Follow-up Questions">
            <FollowupQuestions
              rcfaId={rcfa.id}
              questions={rcfa.followupQuestions.map((q) => ({
                id: q.id,
                questionText: q.questionText,
                questionCategory: q.questionCategory,
                answerText: q.answerText,
                answeredAt: q.answeredAt?.toISOString() ?? null,
                answeredBy: q.answeredBy,
              }))}
            />
          </Section>
        )}

        {/* Re-Analyze Button */}
        {rcfa.status === "investigation" && (
          <ReAnalyzeButton
            rcfaId={rcfa.id}
            hasAnsweredQuestions={hasAnsweredQuestions}
          />
        )}

        {/* Root Cause Candidates */}
        {hasAnalysis && rcfa.rootCauseCandidates.length > 0 && (
          <Section title="Root Cause Candidates">
            <div className="space-y-4">
              {rcfa.rootCauseCandidates.map((c) => (
                <div
                  key={c.id}
                  className="rounded-md border border-zinc-100 p-4 dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {c.causeText}
                    </p>
                    <Badge
                      label={c.confidenceLabel}
                      colorClass={CONFIDENCE_COLORS[c.confidenceLabel]}
                    />
                  </div>
                  {c.rationaleText && (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {c.rationaleText}
                    </p>
                  )}
                  {rcfa.status === "investigation" &&
                    !promotedCandidateIds.has(c.id) && (
                      <div className="mt-3">
                        <PromoteRootCauseButton
                          rcfaId={rcfa.id}
                          candidateId={c.id}
                        />
                      </div>
                    )}
                  {promotedCandidateIds.has(c.id) && (
                    <p className="mt-2 text-xs font-medium text-green-600 dark:text-green-400">
                      Promoted to final
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Final Root Causes */}
        {hasAnalysis && (rcfa.rootCauseFinals.length > 0 || rcfa.status === "investigation") && (
          <Section title="Final Root Causes">
            <div className="space-y-4">
              {rcfa.rootCauseFinals.map((f) => (
                <EditableRootCause
                  key={f.id}
                  rcfaId={rcfa.id}
                  finalId={f.id}
                  causeText={f.causeText}
                  evidenceSummary={f.evidenceSummary}
                  selectedByEmail={f.selectedBy.email}
                  selectedAt={f.selectedAt.toISOString().slice(0, 10)}
                  isInvestigation={rcfa.status === "investigation"}
                />
              ))}
              {rcfa.status === "investigation" && (
                <AddRootCauseForm rcfaId={rcfa.id} />
              )}
            </div>
          </Section>
        )}

        {/* Finalize Investigation Button */}
        {rcfa.status === "investigation" && (
          <FinalizeInvestigationButton rcfaId={rcfa.id} />
        )}

        {/* Action Item Candidates */}
        {hasAnalysis && rcfa.actionItemCandidates.length > 0 && (
          <Section title="Action Item Candidates">
            <div className="space-y-4">
              {rcfa.actionItemCandidates.map((a) => (
                <div
                  key={a.id}
                  className="rounded-md border border-zinc-100 p-4 dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {a.actionText}
                    </p>
                    <Badge
                      label={a.priority}
                      colorClass={PRIORITY_COLORS[a.priority]}
                    />
                  </div>
                  {a.rationaleText && (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {a.rationaleText}
                    </p>
                  )}
                  <div className="mt-2 flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    {a.timeframeText && <span>Timeframe: {a.timeframeText}</span>}
                    {a.successCriteria && (
                      <span>Success: {a.successCriteria}</span>
                    )}
                  </div>
                  {rcfa.status === "investigation" &&
                    !promotedActionCandidateIds.has(a.id) && (
                      <div className="mt-3">
                        <PromoteActionItemButton
                          rcfaId={rcfa.id}
                          candidateId={a.id}
                        />
                      </div>
                    )}
                  {promotedActionCandidateIds.has(a.id) && (
                    <p className="mt-2 text-xs font-medium text-green-600 dark:text-green-400">
                      Promoted to tracked
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Tracked Action Items */}
        {hasAnalysis && (rcfa.actionItems.length > 0 || rcfa.status === "investigation") && (
          <Section title="Tracked Action Items">
            <div className="space-y-4">
              {rcfa.actionItems.map((a) => (
                <EditableActionItem
                  key={a.id}
                  rcfaId={rcfa.id}
                  actionItemId={a.id}
                  actionText={a.actionText}
                  priority={a.priority}
                  status={a.status}
                  successCriteria={a.successCriteria}
                  dueDate={a.dueDate?.toISOString().slice(0, 10) ?? null}
                  createdByEmail={a.createdBy.email}
                  createdAt={a.createdAt.toISOString().slice(0, 10)}
                  isInvestigation={rcfa.status === "investigation"}
                />
              ))}
              {rcfa.status === "investigation" && (
                <AddActionItemForm rcfaId={rcfa.id} />
              )}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
