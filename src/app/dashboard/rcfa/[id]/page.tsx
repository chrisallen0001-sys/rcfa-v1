import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import { formatRcfaNumber, RCFA_STATUS_LABELS, RCFA_STATUS_COLORS } from "@/lib/rcfa-utils";
import { AUDIT_EVENT_TYPES, AUDIT_SOURCES } from "@/lib/audit-constants";
import FollowupQuestions from "./FollowupQuestions";
import ReAnalyzeButton from "./ReAnalyzeButton";
import StartInvestigationButton from "./StartInvestigationButton";
import AnalyzeWithAIButton from "./AnalyzeWithAIButton";
import PromoteRootCauseButton from "./PromoteRootCauseButton";
import PromoteActionItemButton from "./PromoteActionItemButton";
import AddRootCauseForm from "./AddRootCauseForm";
import EditableRootCause from "./EditableRootCause";
import FinalizeInvestigationButton from "./FinalizeInvestigationButton";
import AddActionItemForm from "./AddActionItemForm";
import EditableActionItem from "./EditableActionItem";
import CloseRcfaButton from "./CloseRcfaButton";
import DeleteRcfaButton from "./DeleteRcfaButton";
import ReassignOwnerButton from "./ReassignOwnerButton";
import AuditLogSection from "./AuditLogSection";
import EditableIntakeForm from "./EditableIntakeForm";
import AddInformationSection from "./AddInformationSection";
import type {
  ConfidenceLabel,
  Priority,
  OperatingContext,
} from "@/generated/prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONFIDENCE_COLORS: Record<ConfidenceLabel, string> = {
  low: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const CONFIDENCE_ORDER: Record<ConfidenceLabel, number> = { high: 0, medium: 1, low: 2 };

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

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatUsd(value: unknown): string | null {
  return value != null ? usdFormatter.format(Number(value)) : null;
}

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
  const isEmpty = !value;
  return (
    <div className="rounded-md border border-zinc-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <dt className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
        {label}
      </dt>
      <dd
        className={`mt-1 whitespace-pre-wrap text-sm ${
          isEmpty
            ? "text-zinc-400 dark:text-zinc-500"
            : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {value || "—"}
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId, role } = await getAuthContext();
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const rcfa = await prisma.rcfa.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, displayName: true } },
      followupQuestions: {
        orderBy: [{ generatedAt: "asc" }, { id: "asc" }],
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
        include: {
          createdBy: { select: { email: true } },
          owner: { select: { id: true, displayName: true } },
        },
      },
      auditEvents: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { email: true } } },
      },
    },
  });

  if (!rcfa || rcfa.deletedAt) {
    notFound();
  }

  const isOwner = rcfa.ownerUserId === userId;
  const isAdmin = role === "admin";
  const canEdit = isOwner || isAdmin;

  const sortedRootCauseCandidates = [...rcfa.rootCauseCandidates].sort(
    (a, b) => CONFIDENCE_ORDER[a.confidenceLabel] - CONFIDENCE_ORDER[b.confidenceLabel]
  );

  const hasAnalysis = rcfa.status !== "draft";
  const hasAnsweredQuestions = rcfa.followupQuestions.some(
    (q) => q.answerText !== null
  );

  // Find the latest re-analysis audit event (events are ordered desc by createdAt)
  const reanalysisSources: Set<string> = new Set([
    AUDIT_SOURCES.AI_REANALYSIS,
    AUDIT_SOURCES.AI_REANALYSIS_NO_CHANGE,
  ]);
  const lastReanalysis = rcfa.auditEvents.find(
    (e) =>
      e.eventType === AUDIT_EVENT_TYPES.CANDIDATE_GENERATED &&
      reanalysisSources.has(
        (e.eventPayload as Record<string, unknown>)?.source as string
      )
  );

  // Enable Re-Analyze when answers or investigation notes have changed since the last re-analysis
  const hasNewAnswers = lastReanalysis
    ? rcfa.followupQuestions.some(
        (q) => q.answeredAt !== null && q.answeredAt > lastReanalysis.createdAt
      )
    : hasAnsweredQuestions;

  const hasNewInvestigationNotes = lastReanalysis
    ? rcfa.investigationNotesUpdatedAt !== null &&
      rcfa.investigationNotesUpdatedAt > lastReanalysis.createdAt
    : rcfa.investigationNotes !== null && rcfa.investigationNotes.length > 0;

  const hasNewDataForReanalysis = hasNewAnswers || hasNewInvestigationNotes;

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

  // Find the timestamp to mark candidates as "new" (added in latest re-analysis)
  // Candidates generated after the second-most-recent analysis are "new"
  const candidateGeneratedEvents = rcfa.auditEvents.filter(
    (e) => e.eventType === AUDIT_EVENT_TYPES.CANDIDATE_GENERATED
  );
  // Events are already ordered desc by createdAt, so [1] is the second-most-recent
  const previousAnalysisTimestamp =
    candidateGeneratedEvents.length > 1
      ? candidateGeneratedEvents[1].createdAt
      : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-2">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Dashboard
        </Link>
      </div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="shrink-0 rounded bg-zinc-100 px-2 py-1 text-sm font-mono font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {formatRcfaNumber(rcfa.rcfaNumber)}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {rcfa.title || "RCFA Detail"}
          </h1>
        </div>
        <Badge
          label={RCFA_STATUS_LABELS[rcfa.status]}
          colorClass={RCFA_STATUS_COLORS[rcfa.status]}
        />
      </div>
      <div className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-medium">Owner:</span> {rcfa.owner.displayName}
      </div>

      {rcfa.status === "draft" && canEdit && (
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <AnalyzeWithAIButton rcfaId={rcfa.id} />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">or</span>
            <StartInvestigationButton rcfaId={rcfa.id} />
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            AI analysis generates follow-up questions, root cause candidates, and action items. You can also start without AI and add these manually.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Intake Summary - editable when draft */}
        {rcfa.status === "draft" && canEdit ? (
          <EditableIntakeForm
            rcfaId={rcfa.id}
            initialData={{
              title: rcfa.title,
              equipmentDescription: rcfa.equipmentDescription,
              operatingContext: rcfa.operatingContext,
              equipmentMake: rcfa.equipmentMake,
              equipmentModel: rcfa.equipmentModel,
              equipmentSerialNumber: rcfa.equipmentSerialNumber,
              equipmentAgeYears: rcfa.equipmentAgeYears
                ? Number(rcfa.equipmentAgeYears)
                : null,
              downtimeMinutes: rcfa.downtimeMinutes,
              productionCostUsd: rcfa.productionCostUsd
                ? Number(rcfa.productionCostUsd)
                : null,
              maintenanceCostUsd: rcfa.maintenanceCostUsd
                ? Number(rcfa.maintenanceCostUsd)
                : null,
              failureDescription: rcfa.failureDescription,
              preFailureConditions: rcfa.preFailureConditions,
              workHistorySummary: rcfa.workHistorySummary,
              activePmsSummary: rcfa.activePmsSummary,
              additionalNotes: rcfa.additionalNotes,
            }}
          />
        ) : (
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
                value={formatUsd(rcfa.productionCostUsd)}
              />
              <Field
                label="Maintenance Cost (USD)"
                value={formatUsd(rcfa.maintenanceCostUsd)}
              />
              <Field
                label="Total Cost (USD)"
                value={
                  rcfa.productionCostUsd != null || rcfa.maintenanceCostUsd != null
                    ? formatUsd(
                        Number(rcfa.productionCostUsd ?? 0) +
                          Number(rcfa.maintenanceCostUsd ?? 0)
                      )
                    : null
                }
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
        )}

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
              isInvestigation={rcfa.status === "investigation" && canEdit}
            />
          </Section>
        )}

        {/* Add Information Section */}
        {rcfa.status === "investigation" && canEdit && (
          <AddInformationSection
            rcfaId={rcfa.id}
            initialNotes={rcfa.investigationNotes}
          />
        )}

        {/* Re-Analyze Button */}
        {rcfa.status === "investigation" && canEdit && (
          <ReAnalyzeButton
            rcfaId={rcfa.id}
            hasAnsweredQuestions={hasAnsweredQuestions}
            hasNewAnswers={hasNewDataForReanalysis}
          />
        )}

        {/* Root Cause Candidates */}
        {hasAnalysis && sortedRootCauseCandidates.length > 0 && (
          <Section title="Root Cause Candidates">
            <div className="space-y-4">
              {sortedRootCauseCandidates.map((c) => {
                const isNew =
                  previousAnalysisTimestamp !== null &&
                  c.generatedAt > previousAnalysisTimestamp;
                return (
                  <div
                    key={c.id}
                    className={`rounded-md border p-4 ${
                      isNew
                        ? "border-purple-300 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20"
                        : "border-zinc-100 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {c.causeText}
                        </p>
                        {isNew && (
                          <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                            New
                          </span>
                        )}
                      </div>
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
                    {rcfa.status === "investigation" && canEdit &&
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
                );
              })}
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
                  isInvestigation={rcfa.status === "investigation" && canEdit}
                />
              ))}
              {rcfa.status === "investigation" && canEdit && (
                <AddRootCauseForm rcfaId={rcfa.id} />
              )}
            </div>
          </Section>
        )}

        {/* Finalize Investigation Button */}
        {rcfa.status === "investigation" && canEdit && (
          <FinalizeInvestigationButton rcfaId={rcfa.id} />
        )}

        {/* Action Item Candidates */}
        {hasAnalysis && rcfa.actionItemCandidates.length > 0 && (
          <Section title="Action Item Candidates">
            <div className="space-y-4">
              {rcfa.actionItemCandidates.map((a) => {
                const isNew =
                  previousAnalysisTimestamp !== null &&
                  a.generatedAt > previousAnalysisTimestamp;
                return (
                  <div
                    key={a.id}
                    className={`rounded-md border p-4 ${
                      isNew
                        ? "border-purple-300 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20"
                        : "border-zinc-100 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {a.actionText}
                        </p>
                        {isNew && (
                          <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                            New
                          </span>
                        )}
                      </div>
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
                    {rcfa.status === "investigation" && canEdit &&
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
                );
              })}
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
                  ownerUserId={a.owner?.id ?? null}
                  ownerName={a.owner?.displayName ?? null}
                  createdByEmail={a.createdBy.email}
                  createdAt={a.createdAt.toISOString().slice(0, 10)}
                  isInvestigation={rcfa.status === "investigation" && canEdit}
                />
              ))}
              {rcfa.status === "investigation" && canEdit && (
                <AddActionItemForm rcfaId={rcfa.id} />
              )}
            </div>
          </Section>
        )}

        {/* Close RCFA Button */}
        {rcfa.status === "actions_open" && canEdit && (
          <CloseRcfaButton rcfaId={rcfa.id} />
        )}

        {/* Audit Log */}
        {rcfa.auditEvents.length > 0 && (
          <AuditLogSection
            events={rcfa.auditEvents.map((e) => ({
              id: e.id,
              eventType: e.eventType,
              eventPayload: e.eventPayload as Record<string, unknown>,
              createdAt: e.createdAt.toISOString(),
              actorEmail: e.actor?.email ?? null,
            }))}
          />
        )}

        {/* Admin Actions */}
        {isAdmin && (
          <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              Admin actions
            </p>
            <div className="space-y-4">
              <ReassignOwnerButton
                rcfaId={rcfa.id}
                currentOwnerId={rcfa.owner.id}
                currentOwnerName={rcfa.owner.displayName}
              />
              <DeleteRcfaButton rcfaId={rcfa.id} rcfaTitle={rcfa.title} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
