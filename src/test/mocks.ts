import { vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

/**
 * Creates a mock auth context for testing
 */
export function createMockAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "test-user-id",
    email: "test@example.com",
    role: "user",
    displayName: "Test User",
    ...overrides,
  };
}

/**
 * Creates mock headers for auth
 */
export function createMockHeaders(auth: AuthContext): Map<string, string> {
  const headers = new Map<string, string>();
  headers.set("x-user-id", auth.userId);
  headers.set("x-user-email", auth.email);
  headers.set("x-user-role", auth.role);
  headers.set("x-user-display-name", auth.displayName);
  return headers;
}

/**
 * Mock Prisma client for testing
 */
export function createMockPrismaClient() {
  return {
    rcfa: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    rcfaAuditEvent: {
      create: vi.fn(),
    },
    rcfaRootCauseFinal: {
      count: vi.fn(),
    },
    rcfaActionItem: {
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback({
      rcfa: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      rcfaAuditEvent: {
        create: vi.fn(),
      },
      rcfaRootCauseFinal: {
        count: vi.fn(),
      },
      rcfaActionItem: {
        count: vi.fn(),
      },
    })),
  };
}

/**
 * Mock RCFA data for testing
 */
export function createMockRcfa(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-rcfa-id",
    rcfaNumber: 1,
    title: "Test RCFA",
    equipmentDescription: "Test Equipment",
    failureDescription: "Test Failure",
    operatingContext: "running",
    status: "draft" as const,
    ownerUserId: "test-user-id",
    createdByUserId: "test-user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}
