"use client";

import { useState } from "react";

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
  candidate_generated: "Candidates Generated",
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
    case "candidate_generated": {
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
      const source = payload.source === "ai_reanalysis" ? "Re-analysis" : "Initial analysis";
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
            {events.map((event) => {
              const summary = formatPayloadSummary(event.eventType, event.eventPayload);
              return (
                <div key={event.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {formatEventType(event.eventType)}
                      </p>
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
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
