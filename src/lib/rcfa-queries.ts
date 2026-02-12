import { prisma } from "@/lib/prisma";

/**
 * Fetches a full RCFA by ID with all relations needed for both
 * the detail page and PDF export.
 *
 * Returns null if the RCFA does not exist or has been soft-deleted.
 */
export async function fetchRcfaById(id: string) {
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
    return null;
  }

  return rcfa;
}

/** The return type of fetchRcfaById when non-null. */
export type FullRcfa = NonNullable<Awaited<ReturnType<typeof fetchRcfaById>>>;
