import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import { formatRcfaNumber, RCFA_STATUS_LABELS, RCFA_STATUS_COLORS } from "@/lib/rcfa-utils";
import { AUDIT_EVENT_TYPES, AUDIT_SOURCES } from "@/lib/audit-constants";
import InvestigationWrapper from "./InvestigationWrapper";
import FollowupQuestions from "./FollowupQuestions";
import PromoteRootCauseButton from "./PromoteRootCauseButton";
import PromoteActionItemButton from "./PromoteActionItemButton";
import AddRootCauseForm from "./AddRootCauseForm";
import EditableRootCause from "./EditableRootCause";
import AddActionItemForm from "./AddActionItemForm";
import EditableActionItem from "./EditableActionItem";
import DeleteRcfaButton from "./DeleteRcfaButton";
import ReassignOwnerButton from "./ReassignOwnerButton";
import AuditLogSection from "./AuditLogSection";
import AddInformationSection from "./AddInformationSection";
import CollapsibleSection from "@/components/CollapsibleSection";
import ChevronLeftIcon from "@/components/ChevronLeftIcon";
import type { SectionStatus } from "@/components/SectionStatusIndicator";
import RcfaActionBar from "./RcfaActionBar";
import DraftModeWrapper from "./DraftModeWrapper";
import DraftPageContent from "./DraftPageContent";
import type {
  ConfidenceLabel,
  Priority,
  OperatingContext,
} from "@/generated/prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONFIDENCE_COLORS: Record<ConfidenceLabel, string> = {
  deprioritized: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  low: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const CONFIDENCE_ORDER: Record<ConfidenceLabel, number> = { high: 0, medium: 1, low: 2, deprioritized: 3 };

const OPERATING_CONTEXT_LABELS: Record<OperatingContext, string> = {
  running: "Running",
  startup: "Startup",
  shutdown: "Shutdown",
  maintenance: "Maintenance",
  unknown: "Unknown",
};


const PRIORITY_COLORS: Record<Priority, string> = {
  deprioritized: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
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

interface SectionStatusData {
  status: string;
  followupQuestions: { answerText: string | null }[];
  investigationNotes: string | null;
  rootCauseFinals: unknown[];
  actionItems: unknown[];
  rootCauseCandidates: { id: string }[];
  actionItemCandidates: { id: string }[];
}

type SectionStatuses = {
  intake: SectionStatus;
  followupQuestions: SectionStatus;
  addInformation: SectionStatus;
  rootCauseCandidates: SectionStatus;
  finalRootCauses: SectionStatus;
  actionCandidates: SectionStatus;
  trackedActions: SectionStatus;
  auditLog: SectionStatus;
};

/**
 * Computes section status indicators for workflow guidance.
 * Returns statuses for investigation and actions_open states; null otherwise.
 */
function computeSectionStatuses(
  rcfa: SectionStatusData,
  promotedCandidateIds: Set<string | null>,
  promotedActionCandidateIds: Set<string | null>,
  allActionItemsComplete: boolean
): SectionStatuses | null {
  if (rcfa.status === "investigation") {
    return {
      intake: "complete",
      followupQuestions:
        rcfa.followupQuestions.length > 0 &&
        rcfa.followupQuestions.every((q) => q.answerText)
          ? "complete"
          : "optional",
      addInformation:
        rcfa.investigationNotes && rcfa.investigationNotes.trim().length > 0
          ? "complete"
          : "optional",
      rootCauseCandidates:
        rcfa.rootCauseCandidates.length > 0 &&
        rcfa.rootCauseCandidates.some((c) => !promotedCandidateIds.has(c.id))
          ? "review"
          : "none",
      finalRootCauses: rcfa.rootCauseFinals.length > 0 ? "complete" : "required",
      actionCandidates:
        rcfa.actionItemCandidates.length > 0 &&
        rcfa.actionItemCandidates.some((a) => !promotedActionCandidateIds.has(a.id))
          ? "review"
          : "none",
      trackedActions: rcfa.actionItems.length > 0 ? "complete" : "required",
      auditLog: "none",
    };
  }

  if (rcfa.status === "actions_open") {
    return {
      intake: "complete",
      followupQuestions: "complete",
      addInformation: "none", // section is hidden in this state
      rootCauseCandidates: "none",
      finalRootCauses: "complete",
      actionCandidates: "none",
      trackedActions: allActionItemsComplete ? "complete" : "required",
      auditLog: "none",
    };
  }

  // Closed and other states: no indicators
  return null;
}

function Section({
  title,
  children,
  headerContent,
  status,
}: {
  title: string;
  children: React.ReactNode;
  headerContent?: React.ReactNode;
  status?: SectionStatus;
}) {
  return (
    <CollapsibleSection title={title} headerContent={headerContent} status={status}>
      {children}
    </CollapsibleSection>
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { userId, role } = await getAuthContext();
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const isNewRcfa = isNew === "true";

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const rcfa = await prisma.rcfa.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, displayName: true } },
      closedBy: { select: { email: true } },
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

  // Helper to determine if a candidate was added in the latest re-analysis
  const isNewCandidate = (generatedAt: Date): boolean =>
    previousAnalysisTimestamp !== null && generatedAt > previousAnalysisTimestamp;

  // Action items progress tracking
  const completedActionItems = rcfa.actionItems.filter(
    (a) => a.status === "done" || a.status === "canceled"
  ).length;
  const totalActionItems = rcfa.actionItems.length;
  const allActionItemsComplete = totalActionItems > 0 && completedActionItems === totalActionItems;

  // Helper for statuses that allow action item editing
  const canEditActionItems = (rcfa.status === "investigation" || rcfa.status === "actions_open") && canEdit;

  // Shared header content (RCFA number, title, badge, owner)
  const headerContent = (
    <>
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
    </>
  );

  // Compute section statuses for workflow guidance
  const sectionStatuses = computeSectionStatuses(
    rcfa,
    promotedCandidateIds,
    promotedActionCandidateIds,
    allActionItemsComplete
  );

  // Shared audit log and admin section
  const auditAndAdminContent = (
    <>
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
    </>
  );

  // Draft mode with edit permission: use guarded navigation
  if (rcfa.status === "draft" && canEdit) {
    return (
      <DraftPageContent>
        {headerContent}
        <div className="space-y-4">
          <DraftModeWrapper
            rcfaId={rcfa.id}
            defaultExpanded={isNewRcfa}
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
          {auditAndAdminContent}
        </div>
      </DraftPageContent>
    );
  }

  // Non-draft modes or draft without edit permission: regular navigation
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          aria-label="Back to Dashboard"
        >
          <ChevronLeftIcon />
        </Link>
      </div>
      {headerContent}

      {/* Investigation/Actions Open - uses wrapper for flush coordination */}
      {(rcfa.status === "investigation" || rcfa.status === "actions_open") && (
        <InvestigationWrapper
          rcfaId={rcfa.id}
          status={rcfa.status}
          canEdit={canEdit}
          isAdmin={isAdmin}
          hasAnsweredQuestions={hasAnsweredQuestions}
          hasNewDataForReanalysis={hasNewDataForReanalysis}
          allActionItemsComplete={allActionItemsComplete}
          totalActionItems={totalActionItems}
          questions={rcfa.followupQuestions.map((q) => ({
            id: q.id,
            questionText: q.questionText,
            questionCategory: q.questionCategory,
            answerText: q.answerText,
            answeredAt: q.answeredAt?.toISOString() ?? null,
            answeredBy: q.answeredBy,
          }))}
          isInvestigation={rcfa.status === "investigation" && canEdit}
          followupQuestionsStatus={sectionStatuses?.followupQuestions}
          beforeQuestions={
            <Section title="Intake Summary" status={sectionStatuses?.intake}>
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
          }
          afterQuestions={
            <>
              {/* Add Information Section */}
              {canEdit && (
                <AddInformationSection
                  rcfaId={rcfa.id}
                  initialNotes={rcfa.investigationNotes}
                  status={sectionStatuses?.addInformation}
                />
              )}

              {/* Root Cause Candidates */}
              {sortedRootCauseCandidates.length > 0 && (
                <Section title="Root Cause Candidates" status={sectionStatuses?.rootCauseCandidates}>
                  <div className="space-y-4">
                    {sortedRootCauseCandidates.map((c) => {
                      const isNew = isNewCandidate(c.generatedAt);
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
              {(rcfa.rootCauseFinals.length > 0 || rcfa.status === "investigation") && (
                <Section title="Final Root Causes" status={sectionStatuses?.finalRootCauses}>
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

              {/* Action Item Candidates */}
              {rcfa.actionItemCandidates.length > 0 && (
                <Section title="Action Item Candidates" status={sectionStatuses?.actionCandidates}>
                  <div className="space-y-4">
                    {rcfa.actionItemCandidates.map((a) => {
                      const isNew = isNewCandidate(a.generatedAt);
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

              {/* Final Action Items */}
              {(rcfa.actionItems.length > 0 || rcfa.status === "investigation" || rcfa.status === "actions_open") && (
                <Section
                  title="Final Action Items"
                  status={sectionStatuses?.trackedActions}
                  headerContent={
                    totalActionItems > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-zinc-200 dark:bg-zinc-700">
                          <div
                            className="h-2 rounded-full bg-green-500 transition-all"
                            style={{ width: `${(completedActionItems / totalActionItems) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {completedActionItems} of {totalActionItems} complete
                        </span>
                      </div>
                    ) : undefined
                  }
                >
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
                        canEdit={canEditActionItems}
                      />
                    ))}
                    {canEditActionItems && (
                      <AddActionItemForm rcfaId={rcfa.id} />
                    )}
                  </div>
                </Section>
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
            </>
          }
        />
      )}

      {/* Draft (read-only) and Closed states - use standard space-y-4 layout */}
      {/* Note: Draft with canEdit is handled in early return above */}
      {((rcfa.status === "draft" && !canEdit) || rcfa.status === "closed") && (
      <div className="space-y-4">
        {/* Intake Summary - read-only */}
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

        {/* Follow-up Questions - read-only for closed state */}
        {rcfa.status === "closed" && rcfa.followupQuestions.length > 0 && (
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
              isInvestigation={false}
            />
          </Section>
        )}

        {/* Root Cause Candidates - read-only for closed state */}
        {rcfa.status === "closed" && sortedRootCauseCandidates.length > 0 && (
          <Section title="Root Cause Candidates">
            <div className="space-y-4">
              {sortedRootCauseCandidates.map((c) => (
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

        {/* Final Root Causes - read-only for closed state */}
        {rcfa.status === "closed" && rcfa.rootCauseFinals.length > 0 && (
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
                  isInvestigation={false}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Action Item Candidates - read-only for closed state */}
        {rcfa.status === "closed" && rcfa.actionItemCandidates.length > 0 && (
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

        {/* Final Action Items - read-only for closed state */}
        {rcfa.status === "closed" && rcfa.actionItems.length > 0 && (
          <Section
            title="Final Action Items"
            headerContent={
              totalActionItems > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-2 rounded-full bg-green-500 transition-all"
                      style={{ width: `${(completedActionItems / totalActionItems) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {completedActionItems} of {totalActionItems} complete
                  </span>
                </div>
              ) : undefined
            }
          >
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
                  canEdit={false}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Closed RCFA Info */}
        {rcfa.status === "closed" && (
          <Section title="Closed">
            <div className="space-y-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                This RCFA was closed on{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {rcfa.closedAt?.toISOString().slice(0, 10) ?? "—"}
                </span>
                {rcfa.closedBy && (
                  <> by <span className="font-medium text-zinc-900 dark:text-zinc-100">{rcfa.closedBy.email}</span></>
                )}
              </p>
              {rcfa.closingNotes && (
                <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Closing Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">
                    {rcfa.closingNotes}
                  </p>
                </div>
              )}
            </div>
          </Section>
        )}

        {auditAndAdminContent}

        {/* Bottom sticky action bar for closed state (Reopen for admins) */}
        {rcfa.status === "closed" && (
          <RcfaActionBar
            rcfaId={rcfa.id}
            status={rcfa.status}
            canEdit={canEdit}
            isAdmin={isAdmin}
          />
        )}
      </div>
      )}
    </div>
  );
}
