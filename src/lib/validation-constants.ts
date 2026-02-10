import type {
  ConfidenceLabel,
  Priority,
  QuestionCategory,
} from "@/generated/prisma/client";

export const VALID_CONFIDENCE_LABELS: ConfidenceLabel[] = [
  "deprioritized",
  "low",
  "medium",
  "high",
];

export const VALID_PRIORITIES: Priority[] = [
  "deprioritized",
  "low",
  "medium",
  "high",
];

export const VALID_QUESTION_CATEGORIES: QuestionCategory[] = [
  "failure_mode",
  "evidence",
  "operating_context",
  "maintenance_history",
  "safety",
  "other",
];
