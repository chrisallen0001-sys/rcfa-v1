import { describe, it, expect } from "vitest";
import { escapeLike, isValidISODate, stripNumericPrefix } from "./sql-utils";

describe("sql-utils", () => {
  describe("escapeLike", () => {
    it("escapes percent signs", () => {
      expect(escapeLike("100%")).toBe("100\\%");
    });

    it("escapes underscores", () => {
      expect(escapeLike("a_b")).toBe("a\\_b");
    });

    it("escapes backslashes", () => {
      expect(escapeLike("a\\b")).toBe("a\\\\b");
    });

    it("returns plain strings unchanged", () => {
      expect(escapeLike("hello")).toBe("hello");
    });
  });

  describe("isValidISODate", () => {
    it("accepts valid dates", () => {
      expect(isValidISODate("2024-01-15")).toBe(true);
      expect(isValidISODate("2024-12-31")).toBe(true);
    });

    it("rejects invalid format", () => {
      expect(isValidISODate("01-15-2024")).toBe(false);
      expect(isValidISODate("not-a-date")).toBe(false);
    });

    it("rejects month 13 as invalid", () => {
      expect(isValidISODate("2024-13-01")).toBe(false);
    });
  });

  describe("stripNumericPrefix", () => {
    describe("with RCFA- prefix", () => {
      it("strips RCFA- prefix and leading zeros", () => {
        expect(stripNumericPrefix("RCFA-049", "RCFA-")).toBe("49");
      });

      it("strips prefix case-insensitively", () => {
        expect(stripNumericPrefix("rcfa-049", "RCFA-")).toBe("49");
        expect(stripNumericPrefix("Rcfa-049", "RCFA-")).toBe("49");
      });

      it("strips leading zeros without prefix", () => {
        expect(stripNumericPrefix("049", "RCFA-")).toBe("49");
        expect(stripNumericPrefix("007", "RCFA-")).toBe("7");
      });

      it("preserves a single zero", () => {
        expect(stripNumericPrefix("0", "RCFA-")).toBe("0");
        expect(stripNumericPrefix("000", "RCFA-")).toBe("0");
      });

      it("passes through plain numbers unchanged", () => {
        expect(stripNumericPrefix("49", "RCFA-")).toBe("49");
        expect(stripNumericPrefix("100", "RCFA-")).toBe("100");
      });

      it("passes through non-matching input unchanged", () => {
        expect(stripNumericPrefix("something", "RCFA-")).toBe("something");
      });
    });

    describe("with AI- prefix", () => {
      it("strips AI- prefix and leading zeros", () => {
        expect(stripNumericPrefix("AI-003", "AI-")).toBe("3");
        expect(stripNumericPrefix("AI-0100", "AI-")).toBe("100");
      });

      it("strips prefix case-insensitively", () => {
        expect(stripNumericPrefix("ai-003", "AI-")).toBe("3");
      });

      it("strips leading zeros without prefix", () => {
        expect(stripNumericPrefix("0003", "AI-")).toBe("3");
      });

      it("passes through plain numbers unchanged", () => {
        expect(stripNumericPrefix("42", "AI-")).toBe("42");
      });
    });
  });
});
