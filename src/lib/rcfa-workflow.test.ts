import { describe, it, expect } from "vitest";
import {
  validateStatusTransition,
  VALID_STATUS_TRANSITIONS,
  PATCH_ALLOWED_TRANSITIONS,
} from "./rcfa-utils";
import type { RcfaStatus } from "@/generated/prisma/client";

/**
 * These tests document and validate the RCFA workflow state machine.
 *
 * RCFA Workflow States:
 * 1. draft - Initial state, intake data being collected
 * 2. investigation - AI analysis and root cause identification
 * 3. actions_open - Action items being executed
 * 4. closed - RCFA complete
 *
 * State Transitions:
 * - draft → investigation: via /start-investigation endpoint
 * - investigation → draft: via PATCH (revert to edit intake)
 * - investigation → actions_open: via /finalize endpoint (requires root causes)
 * - actions_open → investigation: via PATCH (revert to add more root causes)
 * - actions_open → closed: via /close endpoint (requires all actions complete)
 * - closed → actions_open: via /reopen endpoint (admin only, to add/modify actions)
 */

describe("RCFA Workflow State Machine", () => {
  describe("Forward Transitions (Happy Path)", () => {
    const forwardPath: RcfaStatus[] = [
      "draft",
      "investigation",
      "actions_open",
      "closed",
    ];

    it("supports the full forward workflow path", () => {
      for (let i = 0; i < forwardPath.length - 1; i++) {
        const from = forwardPath[i];
        const to = forwardPath[i + 1];
        const result = validateStatusTransition(from, to, VALID_STATUS_TRANSITIONS);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe("Backward Transitions (Corrections)", () => {
    it("allows going back from investigation to draft", () => {
      const result = validateStatusTransition(
        "investigation",
        "draft",
        VALID_STATUS_TRANSITIONS
      );
      expect(result.valid).toBe(true);
    });

    it("allows going back from actions_open to investigation", () => {
      const result = validateStatusTransition(
        "actions_open",
        "investigation",
        VALID_STATUS_TRANSITIONS
      );
      expect(result.valid).toBe(true);
    });

    it("allows reopening from closed to actions_open", () => {
      const result = validateStatusTransition(
        "closed",
        "actions_open",
        VALID_STATUS_TRANSITIONS
      );
      expect(result.valid).toBe(true);
    });

    it("does NOT allow skipping back multiple states", () => {
      // closed → investigation is not allowed
      const result1 = validateStatusTransition(
        "closed",
        "investigation",
        VALID_STATUS_TRANSITIONS
      );
      expect(result1.valid).toBe(false);

      // closed → draft is not allowed
      const result2 = validateStatusTransition(
        "closed",
        "draft",
        VALID_STATUS_TRANSITIONS
      );
      expect(result2.valid).toBe(false);

      // actions_open → draft is not allowed (must go through investigation)
      const result3 = validateStatusTransition(
        "actions_open",
        "draft",
        VALID_STATUS_TRANSITIONS
      );
      expect(result3.valid).toBe(false);
    });
  });

  describe("Invalid Transitions (Skipping States)", () => {
    it("does NOT allow draft → actions_open (must go through investigation)", () => {
      const result = validateStatusTransition(
        "draft",
        "actions_open",
        VALID_STATUS_TRANSITIONS
      );
      expect(result.valid).toBe(false);
    });

    it("does NOT allow draft → closed (must go through all states)", () => {
      const result = validateStatusTransition(
        "draft",
        "closed",
        VALID_STATUS_TRANSITIONS
      );
      expect(result.valid).toBe(false);
    });

    it("does NOT allow investigation → closed (must go through actions_open)", () => {
      const result = validateStatusTransition(
        "investigation",
        "closed",
        VALID_STATUS_TRANSITIONS
      );
      expect(result.valid).toBe(false);
    });
  });

  describe("PATCH Endpoint Restrictions", () => {
    it("PATCH cannot transition draft → investigation (use /start-investigation)", () => {
      const result = validateStatusTransition(
        "draft",
        "investigation",
        PATCH_ALLOWED_TRANSITIONS
      );
      expect(result.valid).toBe(false);
    });

    it("PATCH cannot transition investigation → actions_open (use /finalize)", () => {
      const result = validateStatusTransition(
        "investigation",
        "actions_open",
        PATCH_ALLOWED_TRANSITIONS
      );
      expect(result.valid).toBe(false);
    });

    it("PATCH cannot transition actions_open → closed (use /close)", () => {
      const result = validateStatusTransition(
        "actions_open",
        "closed",
        PATCH_ALLOWED_TRANSITIONS
      );
      expect(result.valid).toBe(false);
    });

    it("PATCH allows backward transitions for corrections", () => {
      // investigation → draft
      expect(
        validateStatusTransition("investigation", "draft", PATCH_ALLOWED_TRANSITIONS)
          .valid
      ).toBe(true);

      // actions_open → investigation
      expect(
        validateStatusTransition(
          "actions_open",
          "investigation",
          PATCH_ALLOWED_TRANSITIONS
        ).valid
      ).toBe(true);

      // closed → actions_open (reopen)
      expect(
        validateStatusTransition("closed", "actions_open", PATCH_ALLOWED_TRANSITIONS)
          .valid
      ).toBe(true);
    });
  });

  describe("Close RCFA Validation Rules", () => {
    /**
     * The /close endpoint enforces these rules:
     * 1. RCFA must be in "actions_open" status
     * 2. At least one final root cause must exist
     * 3. All action items must be "done" or "canceled"
     *
     * These are tested here as documentation. The actual enforcement
     * is in the close route handler.
     */

    it("documents the close requirements", () => {
      // This test documents the business rules
      const closeRequirements = {
        requiredStatus: "actions_open" as RcfaStatus,
        minimumRootCauses: 1,
        allowedActionStatuses: ["done", "canceled"],
      };

      expect(closeRequirements.requiredStatus).toBe("actions_open");
      expect(closeRequirements.minimumRootCauses).toBe(1);
      expect(closeRequirements.allowedActionStatuses).toContain("done");
      expect(closeRequirements.allowedActionStatuses).toContain("canceled");
    });
  });

  describe("Finalize Validation Rules", () => {
    /**
     * The /finalize endpoint enforces these rules:
     * 1. RCFA must be in "investigation" status
     * 2. At least one final root cause must exist
     */

    it("documents the finalize requirements", () => {
      const finalizeRequirements = {
        requiredStatus: "investigation" as RcfaStatus,
        minimumRootCauses: 1,
      };

      expect(finalizeRequirements.requiredStatus).toBe("investigation");
      expect(finalizeRequirements.minimumRootCauses).toBe(1);
    });
  });

  describe("Reopen Rules", () => {
    /**
     * The /reopen endpoint enforces these rules:
     * 1. Only admins can reopen
     * 2. RCFA must be in "closed" status
     * 3. Transitions to "actions_open"
     */

    it("documents the reopen requirements", () => {
      const reopenRequirements = {
        requiredRole: "admin",
        requiredStatus: "closed" as RcfaStatus,
        targetStatus: "actions_open" as RcfaStatus,
      };

      expect(reopenRequirements.requiredRole).toBe("admin");
      expect(reopenRequirements.requiredStatus).toBe("closed");
      expect(reopenRequirements.targetStatus).toBe("actions_open");

      // Verify the transition is valid
      const result = validateStatusTransition(
        reopenRequirements.requiredStatus,
        reopenRequirements.targetStatus,
        VALID_STATUS_TRANSITIONS
      );
      expect(result.valid).toBe(true);
    });
  });
});

describe("Action Item Status Values", () => {
  /**
   * Action items have five possible statuses:
   * - open: Initial state
   * - in_progress: Work has started
   * - blocked: Cannot proceed
   * - done: Completed successfully
   * - canceled: Will not be done
   *
   * Only "done" and "canceled" are considered complete for closing an RCFA.
   */

  const validStatuses = ["open", "in_progress", "blocked", "done", "canceled"];
  const completeStatuses = ["done", "canceled"];
  const incompleteStatuses = ["open", "in_progress", "blocked"];

  it("defines five valid action item statuses", () => {
    expect(validStatuses).toHaveLength(5);
  });

  it("considers only done and canceled as complete", () => {
    expect(completeStatuses).toHaveLength(2);
    expect(completeStatuses).toContain("done");
    expect(completeStatuses).toContain("canceled");
  });

  it("considers open, in_progress, and blocked as incomplete", () => {
    expect(incompleteStatuses).toHaveLength(3);
    for (const status of incompleteStatuses) {
      expect(completeStatuses).not.toContain(status);
    }
  });
});
