export const AUDIT_EVENT_TYPES = {
  CANDIDATE_GENERATED: "candidate_generated",
} as const;

export const AUDIT_SOURCES = {
  AI_INITIAL_ANALYSIS: "ai_initial_analysis",
  AI_REANALYSIS: "ai_reanalysis",
  AI_REANALYSIS_NO_CHANGE: "ai_reanalysis_no_change",
} as const;
