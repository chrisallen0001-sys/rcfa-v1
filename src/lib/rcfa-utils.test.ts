import { describe, it, expect } from "vitest";
import {
  formatRcfaNumber,
  validateStatusTransition,
  VALID_STATUS_TRANSITIONS,
  PATCH_ALLOWED_TRANSITIONS,
  RCFA_STATUS_LABELS,
  VALID_OPERATING_CONTEXTS,
  ALL_RCFA_STATUSES,
} from "./rcfa-utils";
import type { RcfaStatus } from "@/generated/prisma/client";

describe("rcfa-utils", () => {
  describe("formatRcfaNumber", () => {
    it("formats single digit numbers with leading zeros", () => {
      expect(formatRcfaNumber(1)).toBe("RCFA-001");
      expect(formatRcfaNumber(9)).toBe("RCFA-009");
    });

    it("formats double digit numbers with leading zero", () => {
      expect(formatRcfaNumber(10)).toBe("RCFA-010");
      expect(formatRcfaNumber(99)).toBe("RCFA-099");
    });

    it("formats triple digit numbers without padding", () => {
      expect(formatRcfaNumber(100)).toBe("RCFA-100");
      expect(formatRcfaNumber(999)).toBe("RCFA-999");
    });

    it("handles numbers larger than 3 digits", () => {
      expect(formatRcfaNumber(1000)).toBe("RCFA-1000");
      expect(formatRcfaNumber(12345)).toBe("RCFA-12345");
    });
  });

  describe("VALID_OPERATING_CONTEXTS", () => {
    it("contains all expected operating contexts", () => {
      expect(VALID_OPERATING_CONTEXTS).toContain("running");
      expect(VALID_OPERATING_CONTEXTS).toContain("startup");
      expect(VALID_OPERATING_CONTEXTS).toContain("shutdown");
      expect(VALID_OPERATING_CONTEXTS).toContain("maintenance");
      expect(VALID_OPERATING_CONTEXTS).toContain("unknown");
      expect(VALID_OPERATING_CONTEXTS).toHaveLength(5);
    });
  });

  describe("ALL_RCFA_STATUSES", () => {
    it("contains all four status values", () => {
      expect(ALL_RCFA_STATUSES).toContain("draft");
      expect(ALL_RCFA_STATUSES).toContain("investigation");
      expect(ALL_RCFA_STATUSES).toContain("actions_open");
      expect(ALL_RCFA_STATUSES).toContain("closed");
      expect(ALL_RCFA_STATUSES).toHaveLength(4);
    });
  });

  describe("RCFA_STATUS_LABELS", () => {
    it("has human-readable labels for all statuses", () => {
      expect(RCFA_STATUS_LABELS.draft).toBe("In Draft");
      expect(RCFA_STATUS_LABELS.investigation).toBe("Investigation");
      expect(RCFA_STATUS_LABELS.actions_open).toBe("Action Items in Progress");
      expect(RCFA_STATUS_LABELS.closed).toBe("Closed");
    });
  });

  describe("validateStatusTransition", () => {
    describe("with VALID_STATUS_TRANSITIONS (full workflow)", () => {
      it("allows draft → investigation", () => {
        const result = validateStatusTransition(
          "draft",
          "investigation",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(true);
      });

      it("allows investigation → draft (back)", () => {
        const result = validateStatusTransition(
          "investigation",
          "draft",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(true);
      });

      it("allows investigation → actions_open", () => {
        const result = validateStatusTransition(
          "investigation",
          "actions_open",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(true);
      });

      it("allows actions_open → investigation (back)", () => {
        const result = validateStatusTransition(
          "actions_open",
          "investigation",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(true);
      });

      it("allows actions_open → closed", () => {
        const result = validateStatusTransition(
          "actions_open",
          "closed",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(true);
      });

      it("allows closed → actions_open (reopen)", () => {
        const result = validateStatusTransition(
          "closed",
          "actions_open",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(true);
      });

      it("allows same status (no-op)", () => {
        const statuses: RcfaStatus[] = [
          "draft",
          "investigation",
          "actions_open",
          "closed",
        ];
        for (const status of statuses) {
          const result = validateStatusTransition(
            status,
            status,
            VALID_STATUS_TRANSITIONS
          );
          expect(result.valid).toBe(true);
        }
      });

      it("rejects draft → actions_open (skip)", () => {
        const result = validateStatusTransition(
          "draft",
          "actions_open",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.allowedTransitions).toEqual(["investigation"]);
          expect(result.error).toContain("Cannot transition");
        }
      });

      it("rejects draft → closed (skip)", () => {
        const result = validateStatusTransition(
          "draft",
          "closed",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.allowedTransitions).toEqual(["investigation"]);
        }
      });

      it("rejects investigation → closed (skip)", () => {
        const result = validateStatusTransition(
          "investigation",
          "closed",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.allowedTransitions).toContain("draft");
          expect(result.allowedTransitions).toContain("actions_open");
        }
      });

      it("rejects closed → draft (too far back)", () => {
        const result = validateStatusTransition(
          "closed",
          "draft",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.allowedTransitions).toEqual(["actions_open"]);
        }
      });

      it("rejects closed → investigation (skip)", () => {
        const result = validateStatusTransition(
          "closed",
          "investigation",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.allowedTransitions).toEqual(["actions_open"]);
        }
      });
    });

    describe("with PATCH_ALLOWED_TRANSITIONS (backward only)", () => {
      it("rejects draft → investigation (must use /start-investigation)", () => {
        const result = validateStatusTransition(
          "draft",
          "investigation",
          PATCH_ALLOWED_TRANSITIONS
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.allowedTransitions).toEqual([]);
        }
      });

      it("allows investigation → draft", () => {
        const result = validateStatusTransition(
          "investigation",
          "draft",
          PATCH_ALLOWED_TRANSITIONS
        );
        expect(result.valid).toBe(true);
      });

      it("rejects investigation → actions_open (must use /finalize)", () => {
        const result = validateStatusTransition(
          "investigation",
          "actions_open",
          PATCH_ALLOWED_TRANSITIONS
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.allowedTransitions).toEqual(["draft"]);
        }
      });

      it("allows actions_open → investigation", () => {
        const result = validateStatusTransition(
          "actions_open",
          "investigation",
          PATCH_ALLOWED_TRANSITIONS
        );
        expect(result.valid).toBe(true);
      });

      it("rejects actions_open → closed (must use /close)", () => {
        const result = validateStatusTransition(
          "actions_open",
          "closed",
          PATCH_ALLOWED_TRANSITIONS
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.allowedTransitions).toEqual(["investigation"]);
        }
      });

      it("allows closed → actions_open (reopen)", () => {
        const result = validateStatusTransition(
          "closed",
          "actions_open",
          PATCH_ALLOWED_TRANSITIONS
        );
        expect(result.valid).toBe(true);
      });
    });

    describe("error messages", () => {
      it("includes human-readable status labels in error", () => {
        const result = validateStatusTransition(
          "draft",
          "closed",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toContain("In Draft");
          expect(result.error).toContain("Closed");
        }
      });

      it("lists allowed transitions in error", () => {
        const result = validateStatusTransition(
          "investigation",
          "closed",
          VALID_STATUS_TRANSITIONS
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toContain("In Draft");
          expect(result.error).toContain("Action Items in Progress");
        }
      });
    });
  });
});
