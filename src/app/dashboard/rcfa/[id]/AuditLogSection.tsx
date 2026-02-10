"use client";

import { useState } from "react";
import { AUDIT_EVENT_TYPES, AUDIT_SOURCES } from "@/lib/audit-constants";

interface AuditEvent {
  id: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  createdAt: string;
  actorEmail: string | null;
}

interface AuditLogSectionProps {
  events: AuditEvent[];
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  status_changed: "Status Changed",
  [AUDIT_EVENT_TYPES.CANDIDATE_GENERATED]: "Candidates Generated",
  [AUDIT_EVENT_TYPES.CANDIDATE_UPDATED]: "Candidate Updated",
  [AUDIT_EVENT_TYPES.ANSWER_SUBMITTED]: "Answer Submitted",
  [AUDIT_EVENT_TYPES.ANSWER_UPDATED]: "Answer Updated",
  promoted_to_final: "Promoted to Final",
  final_updated: "Root Cause Updated",
  final_deleted: "Root Cause Deleted",
  final_created: "Root Cause Created",
  action_item_promoted: "Action Item Promoted",
  action_item_updated: "Action Item Updated",
  action_item_deleted: "Action Item Deleted",
  action_item_created: "Action Item Created",
  action_completed: "Action Completed",
  rcfa_deleted: "RCFA Deleted",
  rcfa_soft_deleted: "RCFA Deleted",
  owner_changed: "Owner Changed",
};

// Labels for payload fields to make them human-readable
const FIELD_LABELS: Record<string, string> = {
  causeText: "Root Cause",
  previousCauseText: "Previous Root Cause",
  evidenceSummary: "Evidence Summary",
  previousEvidenceSummary: "Previous Evidence Summary",
  actionText: "Action Item",
  previousActionText: "Previous Action Item",
  priority: "Priority",
  previousPriority: "Previous Priority",
  successCriteria: "Success Criteria",
  previousSuccessCriteria: "Previous Success Criteria",
  dueDate: "Due Date",
  previousDueDate: "Previous Due Date",
  status: "Status",
  previousStatus: "Previous Status",
  from: "From",
  to: "To",
  title: "Title",
  equipmentDescription: "Equipment Description",
  rootCauseCandidateCount: "Root Cause Candidates",
  actionItemCandidateCount: "Action Item Candidates",
  followUpQuestionCount: "Follow-up Questions",
  source: "Source",
  materialityReasoning: "Materiality Reasoning",
  finalId: "Root Cause ID",
  actionItemId: "Action Item ID",
  candidateId: "Candidate ID",
  candidateType: "Candidate Type",
  previousConfidence: "Previous Confidence",
  newConfidence: "New Confidence",
  updateReason: "Reason",
  completionNotes: "Action Taken",
  owner: "Owner",
  ownerUserId: "Owner",
  previousOwnerUserId: "Previous Owner",
  // Owner change event fields
  previousOwnerId: "Previous Owner",
  previousOwnerName: "Previous Owner",
  newOwnerId: "New Owner",
  newOwnerName: "New Owner",
};

// Fields that represent "before" values for update events (previousXxx -> xxx pattern)
const PREVIOUS_FIELD_MAP: Record<string, string> = {
  previousCauseText: "causeText",
  previousEvidenceSummary: "evidenceSummary",
  previousActionText: "actionText",
  previousPriority: "priority",
  previousSuccessCriteria: "successCriteria",
  previousDueDate: "dueDate",
  previousStatus: "status",
  previousOwnerUserId: "ownerUserId",
  // Owner change event - only show name (ID is not user-friendly)
  previousOwnerName: "newOwnerName",
  // Candidate update events (only confidence - priority already mapped above for action_item_updated)
  previousConfidence: "newConfidence",
};

function formatEventType(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType.replace(/_/g, " ");
}

function formatPayloadSummary(
  eventType: string,
  payload: Record<string, unknown>
): string {
  switch (eventType) {
    case "status_changed":
      return `${payload.from} → ${payload.to}`;
    case AUDIT_EVENT_TYPES.CANDIDATE_GENERATED: {
      const parts: string[] = [];
      if (payload.rootCauseCandidateCount) {
        parts.push(`${payload.rootCauseCandidateCount} root causes`);
      }
      if (payload.actionItemCandidateCount) {
        parts.push(`${payload.actionItemCandidateCount} action items`);
      }
      if (payload.followUpQuestionCount) {
        parts.push(`${payload.followUpQuestionCount} questions`);
      }
      const source =
        payload.source === AUDIT_SOURCES.AI_REANALYSIS_NO_CHANGE
          ? "Re-analysis (no material change)"
          : payload.source === AUDIT_SOURCES.AI_REANALYSIS
            ? "Re-analysis"
            : "Initial analysis";
      return parts.length > 0 ? `${source}: ${parts.join(", ")}` : source;
    }
    case "promoted_to_final":
      return payload.causeText
        ? truncate(String(payload.causeText), 60)
        : "Root cause promoted";
    case "final_updated":
    case "final_created":
      return payload.causeText
        ? truncate(String(payload.causeText), 60)
        : "";
    case "final_deleted":
      return payload.causeText
        ? `Deleted: ${truncate(String(payload.causeText), 50)}`
        : "Root cause deleted";
    case "action_item_promoted":
    case "action_item_created":
    case "action_item_updated":
      return payload.actionText
        ? truncate(String(payload.actionText), 60)
        : "";
    case "action_item_deleted":
      return payload.actionText
        ? `Deleted: ${truncate(String(payload.actionText), 50)}`
        : "Action item deleted";
    case "action_completed":
      return payload.actionText
        ? truncate(String(payload.actionText), 60)
        : "Action completed";
    case "rcfa_deleted":
    case "rcfa_soft_deleted":
      return payload.title
        ? `"${truncate(String(payload.title), 50)}"`
        : "RCFA deleted";
    case "owner_changed":
      if (payload.previousOwnerName && payload.newOwnerName) {
        return `${payload.previousOwnerName} → ${payload.newOwnerName}`;
      }
      return "Owner reassigned";
    case AUDIT_EVENT_TYPES.ANSWER_SUBMITTED:
      return payload.questionText
        ? truncate(String(payload.questionText), 60)
        : "Answer submitted";
    case AUDIT_EVENT_TYPES.ANSWER_UPDATED:
      return payload.questionText
        ? truncate(String(payload.questionText), 60)
        : "Answer updated";
    case AUDIT_EVENT_TYPES.CANDIDATE_UPDATED: {
      const text = payload.causeText || payload.actionText;
      const prevLevel = payload.previousConfidence || payload.previousPriority;
      const newLevel = payload.newConfidence || payload.newPriority;
      const levelChange = prevLevel && newLevel ? ` (${prevLevel} → ${newLevel})` : "";
      return text ? truncate(String(text), 50) + levelChange : "Candidate updated";
    }
    default:
      return "";
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatFieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "string") {
    // Check if it's an ISO date string
    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    }
    return value || "—";
  }
  if (typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

function isUpdateEvent(eventType: string): boolean {
  return (
    eventType === "final_updated" ||
    eventType === "action_item_updated" ||
    eventType === "owner_changed" ||
    eventType === AUDIT_EVENT_TYPES.ANSWER_UPDATED ||
    eventType === AUDIT_EVENT_TYPES.CANDIDATE_UPDATED
  );
}

function getChangedFields(payload: Record<string, unknown>): Array<{
  field: string;
  label: string;
  previousValue: unknown;
  currentValue: unknown;
}> {
  const changes: Array<{
    field: string;
    label: string;
    previousValue: unknown;
    currentValue: unknown;
  }> = [];

  // Handle nested "changes" structure from action items API
  // Format: { changes: { field: { from, to } } }
  if (payload.changes && typeof payload.changes === "object") {
    const changesObj = payload.changes as Record<string, { from?: unknown; to?: unknown }>;
    for (const [field, change] of Object.entries(changesObj)) {
      if (change && typeof change === "object" && ("from" in change || "to" in change)) {
        const previousValue = change.from;
        const currentValue = change.to;
        // Only show if value actually changed
        if (JSON.stringify(previousValue) !== JSON.stringify(currentValue)) {
          changes.push({
            field,
            label: formatFieldLabel(field),
            previousValue,
            currentValue,
          });
        }
      }
    }
    return changes;
  }

  // Handle flat previousXxx/xxx pattern from finals routes and owner changes
  for (const [prevKey, currentKey] of Object.entries(PREVIOUS_FIELD_MAP)) {
    if (prevKey in payload) {
      const previousValue = payload[prevKey];
      const currentValue = payload[currentKey];
      // Only show if value actually changed
      if (JSON.stringify(previousValue) !== JSON.stringify(currentValue)) {
        // Use a display-friendly label for owner changes
        const displayLabel = prevKey === "previousOwnerName" ? "Owner" : formatFieldLabel(currentKey);
        changes.push({
          field: currentKey,
          label: displayLabel,
          previousValue,
          currentValue,
        });
      }
    }
  }

  return changes;
}

function PayloadDetail({ eventType, payload }: { eventType: string; payload: Record<string, unknown> }) {
  // Special handling for answer_submitted events
  if (eventType === AUDIT_EVENT_TYPES.ANSWER_SUBMITTED) {
    return (
      <dl className="space-y-3">
        <div className="grid grid-cols-[auto_1fr] gap-2 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400 font-medium">Question:</dt>
          <dd className="text-zinc-700 dark:text-zinc-300 break-words">
            {formatValue(payload.questionText)}
          </dd>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400 font-medium">Answer:</dt>
          <dd className="text-zinc-700 dark:text-zinc-300 break-words">
            {formatValue(payload.answerText)}
          </dd>
        </div>
      </dl>
    );
  }

  // Special handling for answer_updated events
  if (eventType === AUDIT_EVENT_TYPES.ANSWER_UPDATED) {
    return (
      <dl className="space-y-3">
        <div className="grid grid-cols-[auto_1fr] gap-2 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400 font-medium">Question:</dt>
          <dd className="text-zinc-700 dark:text-zinc-300 break-words">
            {formatValue(payload.questionText)}
          </dd>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400 font-medium">Previous:</dt>
          <dd className="text-zinc-700 dark:text-zinc-300 break-words">
            {formatValue(payload.previousAnswer)}
          </dd>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400 font-medium">New:</dt>
          <dd className="text-zinc-700 dark:text-zinc-300 break-words">
            {formatValue(payload.newAnswer)}
          </dd>
        </div>
      </dl>
    );
  }

  // Special handling for candidate_updated events
  if (eventType === AUDIT_EVENT_TYPES.CANDIDATE_UPDATED) {
    const isRootCause = payload.candidateType === "rootCause";
    const rawText = isRootCause ? payload.causeText : payload.actionText;
    const candidateText = rawText ? String(rawText) : "Unknown candidate";
    const levelLabel = isRootCause ? "Confidence" : "Priority";
    const previousLevel = isRootCause ? payload.previousConfidence : payload.previousPriority;
    const newLevel = isRootCause ? payload.newConfidence : payload.newPriority;

    return (
      <dl className="space-y-3">
        <div className="grid grid-cols-[auto_1fr] gap-2 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400 font-medium">
            {isRootCause ? "Root Cause:" : "Action Item:"}
          </dt>
          <dd className="text-zinc-700 dark:text-zinc-300 break-words">
            {candidateText}
          </dd>
        </div>
        <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
            {levelLabel}
          </p>
          <div className="flex items-start gap-2 text-sm">
            <span className="flex-shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Before
            </span>
            <span className="text-zinc-700 dark:text-zinc-300 break-words min-w-0">
              {formatValue(previousLevel)}
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm mt-2">
            <span className="flex-shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              After
            </span>
            <span className="text-zinc-700 dark:text-zinc-300 break-words min-w-0">
              {formatValue(newLevel)}
            </span>
          </div>
        </div>
        {payload.updateReason != null && (
          <div className="grid grid-cols-[auto_1fr] gap-2 text-sm">
            <dt className="text-zinc-500 dark:text-zinc-400 font-medium">Reason:</dt>
            <dd className="text-zinc-700 dark:text-zinc-300 break-words">
              {formatValue(payload.updateReason)}
            </dd>
          </div>
        )}
      </dl>
    );
  }

  if (isUpdateEvent(eventType)) {
    const changes = getChangedFields(payload);
    if (changes.length === 0) {
      return (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
          No changes detected
        </p>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          Changes
        </p>
        {changes.map(({ field, label, previousValue, currentValue }) => (
          <div key={field} className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              {label}
            </p>
            <div className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                Before
              </span>
              <span className="text-zinc-700 dark:text-zinc-300 break-words min-w-0">
                {formatValue(previousValue)}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm mt-2">
              <span className="flex-shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                After
              </span>
              <span className="text-zinc-700 dark:text-zinc-300 break-words min-w-0">
                {formatValue(currentValue)}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // For non-update events, show all payload fields
  // Exclude internal tracking fields: source, previous*, answerSnapshot
  const entries = Object.entries(payload).filter(
    ([key]) => !key.startsWith("previous") && key !== "source" && key !== "answerSnapshot"
  );

  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
        No additional details
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
        Details
      </p>
      <dl className="grid gap-2">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[auto_1fr] gap-2 text-sm">
            <dt className="text-zinc-500 dark:text-zinc-400">
              {formatFieldLabel(key)}:
            </dt>
            <dd className="text-zinc-700 dark:text-zinc-300 break-words">
              {formatValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const summary = formatPayloadSummary(event.eventType, event.eventPayload);
  const hasDetails = Object.keys(event.eventPayload).length > 0;

  return (
    <div className="px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {formatEventType(event.eventType)}
            </p>
            {hasDetails && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex-shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse details" : "Expand details"}
              >
                <svg
                  className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}
          </div>
          {summary && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {summary}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatTimestamp(event.createdAt)}
          </p>
          {event.actorEmail && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {event.actorEmail}
            </p>
          )}
        </div>
      </div>
      {isExpanded && hasDetails && (
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <PayloadDetail eventType={event.eventType} payload={event.eventPayload} />
        </div>
      )}
    </div>
  );
}

export default function AuditLogSection({ events }: AuditLogSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between p-6 text-left"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Audit Log
          <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
            ({events.length} {events.length === 1 ? "event" : "events"})
          </span>
        </h2>
        <svg
          className={`h-5 w-5 text-zinc-500 transition-transform dark:text-zinc-400 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {events.map((event) => (
              <AuditEventRow key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
