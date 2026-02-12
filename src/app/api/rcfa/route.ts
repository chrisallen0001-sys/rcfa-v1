import { NextRequest, NextResponse } from "next/server";
import type { OperatingContext, RcfaStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import { VALID_OPERATING_CONTEXTS } from "@/lib/rcfa-utils";
import { UUID_RE, escapeLike, isValidISODate } from "@/lib/sql-utils";

/**
 * Row shape from rcfa_summary view for table listing.
 */
type SummaryRow = {
  id: string;
  rcfa_number: number;
  title: string;
  equipment_description: string;
  status: RcfaStatus;
  operating_context: OperatingContext;
  created_at: Date;
  owner_user_id: string;
  owner_display_name: string;
  final_root_cause_count: bigint;
  action_item_count: bigint;
  open_action_item_count: bigint;
  total_count: bigint;
};

type SearchResultRow = SummaryRow & {
  equip_headline: string;
  failure_headline: string;
  rank: number;
};

const VALID_SORT_COLUMNS = [
  "rcfa_number",
  "title",
  "status",
  "owner_display_name",
  "created_at",
  "equipment_description",
  "operating_context",
  "final_root_cause_count",
  "action_item_count",
];

const VALID_STATUSES: RcfaStatus[] = ["draft", "investigation", "actions_open", "closed"];

/**
 * HTML-escape a string, then replace neutral highlight delimiters with <mark>.
 */
function sanitizeHighlight(raw: string): string {
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return escaped
    .replace(/\[\[HL\]\]/g, "<mark>")
    .replace(/\[\[\/HL\]\]/g, "</mark>");
}

/**
 * Maps a database row to the API response format.
 */
function mapRowToResponse(
  r: SummaryRow,
  highlights?: { equip: string; failure: string }
) {
  return {
    id: r.id,
    rcfaNumber: r.rcfa_number,
    title: r.title || "Untitled RCFA",
    equipmentDescription: r.equipment_description,
    status: r.status,
    operatingContext: r.operating_context,
    createdAt: new Date(r.created_at).toISOString().slice(0, 10),
    ownerUserId: r.owner_user_id,
    ownerDisplayName: r.owner_display_name,
    rootCauseCount: Number(r.final_root_cause_count),
    actionItemCount: Number(r.action_item_count),
    openActionCount: Number(r.open_action_item_count),
    ...(highlights && {
      equipmentHighlight: sanitizeHighlight(highlights.equip),
      failureHighlight: sanitizeHighlight(highlights.failure),
    }),
  };
}

/**
 * GET /api/rcfa - List RCFAs with filtering, sorting, and pagination
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 25, max: 100)
 * - sortBy: Column to sort by (default: created_at)
 * - sortOrder: asc or desc (default: desc)
 * - status: Comma-separated status values to filter
 * - owner: Comma-separated owner user IDs to filter
 * - filter: Special filter ("mine" = current user's open RCFAs)
 * - dateFrom: ISO date string for created_at >= filter
 * - dateTo: ISO date string for created_at <= filter
 * - q: Full-text search query
 * - rcfaNumber: Text search on RCFA number
 * - title: Text search on title (case-insensitive)
 * - equipment: Text search on equipment description (case-insensitive)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    const { searchParams } = new URL(request.url);

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10) || 25));
    const offset = (page - 1) * pageSize;

    // Parse sorting
    const sortBy = searchParams.get("sortBy") ?? "created_at";
    const sortOrder = searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "ASC" : "DESC";
    const validatedSortBy = VALID_SORT_COLUMNS.includes(sortBy) ? sortBy : "created_at";

    // Parse filters
    const statusFilter = searchParams.get("status");
    const ownerFilter = searchParams.get("owner");
    const specialFilter = searchParams.get("filter");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const searchQuery = searchParams.get("q")?.trim() ?? "";
    const rcfaNumberFilter = searchParams.get("rcfaNumber");
    const titleFilter = searchParams.get("title");
    const equipmentFilter = searchParams.get("equipment");

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: (string | number | Date)[] = [];
    let paramIndex = 1;

    // Backward-compatible "mine" filter (used by dashboard until #325 migrates to column filters).
    // Intentionally excludes closed RCFAs — "my RCFAs" means active work.
    // The action-items route does NOT have this status restriction since
    // action items don't have a terminal "closed" lifecycle state.
    if (specialFilter === "mine") {
      conditions.push(`s.owner_user_id = $${paramIndex++}`);
      params.push(userId);
      conditions.push(`s.status != 'closed'`);
    }

    // Status filter - use IN clause with individual placeholders for proper PostgreSQL handling
    if (statusFilter) {
      const statuses = statusFilter.split(",").filter((s) => VALID_STATUSES.includes(s as RcfaStatus));
      if (statuses.length > 0) {
        const placeholders = statuses.map(() => `$${paramIndex++}`).join(", ");
        conditions.push(`s.status IN (${placeholders})`);
        statuses.forEach((s) => params.push(s));
      }
    }

    // Owner filter - accepts comma-separated UUIDs (skipped when filter=mine is active)
    if (ownerFilter && specialFilter !== "mine") {
      const ownerIds = ownerFilter.split(",").filter((id) => UUID_RE.test(id.trim()));
      if (ownerIds.length === 1) {
        conditions.push(`s.owner_user_id = $${paramIndex++}`);
        params.push(ownerIds[0].trim());
      } else if (ownerIds.length > 1) {
        const placeholders = ownerIds.map(() => `$${paramIndex++}`).join(", ");
        conditions.push(`s.owner_user_id IN (${placeholders})`);
        ownerIds.forEach((id) => params.push(id.trim()));
      } else {
        // All provided UUIDs were invalid — match nothing
        conditions.push(`FALSE`);
      }
    }

    // Date range filters (validate format and semantic validity before parsing)
    for (const [label, val] of [
      ["dateFrom", dateFrom],
      ["dateTo", dateTo],
    ] as const) {
      if (val && !isValidISODate(val)) {
        return NextResponse.json(
          { error: `Invalid ${label} (expected a valid yyyy-MM-dd date)` },
          { status: 400 }
        );
      }
    }
    if (dateFrom) {
      conditions.push(`s.created_at >= $${paramIndex++}`);
      params.push(new Date(dateFrom));
    }
    if (dateTo) {
      conditions.push(`s.created_at <= $${paramIndex++}`);
      params.push(new Date(dateTo + "T23:59:59.999Z"));
    }

    // Text search filters
    if (rcfaNumberFilter) {
      conditions.push(`CAST(s.rcfa_number AS TEXT) LIKE $${paramIndex++}`);
      params.push(`%${escapeLike(rcfaNumberFilter)}%`);
    }

    if (titleFilter) {
      conditions.push(`s.title ILIKE $${paramIndex++}`);
      params.push(`%${escapeLike(titleFilter)}%`);
    }

    if (equipmentFilter) {
      conditions.push(`s.equipment_description ILIKE $${paramIndex++}`);
      params.push(`%${escapeLike(equipmentFilter)}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    if (searchQuery) {
      // Full-text search query
      const searchSql = `
        WITH matches AS (
          SELECT
            s.*,
            ts_rank(
              to_tsvector('english', s.equipment_description) ||
              to_tsvector('english', r.failure_description),
              plainto_tsquery('english', $${paramIndex})
            ) AS rank,
            ts_headline('english', s.equipment_description, plainto_tsquery('english', $${paramIndex}),
              'StartSel=[[HL]], StopSel=[[/HL]], MaxFragments=1, MaxWords=30') AS equip_headline,
            ts_headline('english', r.failure_description, plainto_tsquery('english', $${paramIndex}),
              'StartSel=[[HL]], StopSel=[[/HL]], MaxFragments=1, MaxWords=30') AS failure_headline
          FROM rcfa_summary s
          JOIN rcfa r ON r.id = s.id
          ${whereClause ? whereClause + " AND " : "WHERE "}
          (
            to_tsvector('english', s.equipment_description) ||
            to_tsvector('english', r.failure_description)
          ) @@ plainto_tsquery('english', $${paramIndex})
        )
        SELECT
          m.*,
          COUNT(*) OVER() AS total_count
        FROM matches m
        ORDER BY m.rank DESC, m.${validatedSortBy} ${sortOrder}
        LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
      `;

      const searchResults = await prisma.$queryRawUnsafe<SearchResultRow[]>(
        searchSql,
        ...params,
        searchQuery,
        pageSize,
        offset
      );

      const total = searchResults.length > 0 ? Number(searchResults[0].total_count) : 0;
      const rows = searchResults.map((r) =>
        mapRowToResponse(r, { equip: r.equip_headline, failure: r.failure_headline })
      );

      return NextResponse.json({
        rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    }

    // Browse query (no search)
    const browseSql = `
      SELECT
        s.*,
        COUNT(*) OVER() AS total_count
      FROM rcfa_summary s
      ${whereClause}
      ORDER BY s.${validatedSortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const browseResults = await prisma.$queryRawUnsafe<SummaryRow[]>(
      browseSql,
      ...params,
      pageSize,
      offset
    );

    const total = browseResults.length > 0 ? Number(browseResults[0].total_count) : 0;
    const rows = browseResults.map((r) => mapRowToResponse(r));

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("GET /api/rcfa error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rcfa - Create a new RCFA
 *
 * Supports two modes:
 * 1. Quick create (empty body or {}): Creates RCFA with minimal defaults
 * 2. Full create (with fields): Validates and creates with provided data
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();

    let body: Record<string, unknown> = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      title,
      equipmentDescription,
      failureDescription,
      operatingContext,
      equipmentMake,
      equipmentModel,
      equipmentSerialNumber,
      equipmentAgeYears,
      downtimeMinutes,
      productionCostUsd,
      maintenanceCostUsd,
      preFailureConditions,
      workHistorySummary,
      activePmsSummary,
      additionalNotes,
    } = body as Record<string, string | number | undefined>;

    // Determine if this is a quick create (empty/minimal body) or full create
    const hasRequiredFields =
      title || equipmentDescription || failureDescription || operatingContext;

    let trimmedTitle = "";
    let trimmedEquipDesc = "";
    let trimmedFailureDesc = "";
    let trimmedContext: OperatingContext = "unknown";

    if (hasRequiredFields) {
      // Full create mode: validate all required fields
      trimmedTitle = title ? String(title).trim() : "";
      trimmedEquipDesc = equipmentDescription
        ? String(equipmentDescription).trim()
        : "";
      trimmedFailureDesc = failureDescription
        ? String(failureDescription).trim()
        : "";
      const contextStr = operatingContext
        ? String(operatingContext).trim()
        : "";

      if (
        !trimmedTitle ||
        !trimmedEquipDesc ||
        !trimmedFailureDesc ||
        !contextStr
      ) {
        return NextResponse.json(
          {
            error:
              "title, equipmentDescription, failureDescription, and operatingContext are required",
          },
          { status: 400 }
        );
      }

      if (trimmedTitle.length > 200) {
        return NextResponse.json(
          { error: "title must be 200 characters or fewer" },
          { status: 400 }
        );
      }

      if (!VALID_OPERATING_CONTEXTS.includes(contextStr as OperatingContext)) {
        return NextResponse.json(
          {
            error: `operatingContext must be one of: ${VALID_OPERATING_CONTEXTS.join(", ")}`,
          },
          { status: 400 }
        );
      }

      trimmedContext = contextStr as OperatingContext;
    }
    // else: Quick create mode - use defaults (empty strings, "unknown" context)

    // Validate optional numeric fields (applies to both modes)
    if (equipmentAgeYears != null) {
      const age = Number(equipmentAgeYears);
      if (isNaN(age) || age < 0 || age > 9999) {
        return NextResponse.json(
          { error: "equipmentAgeYears must be a non-negative number" },
          { status: 400 }
        );
      }
    }

    if (downtimeMinutes != null) {
      const mins = Number(downtimeMinutes);
      if (!Number.isInteger(mins) || mins < 0) {
        return NextResponse.json(
          { error: "downtimeMinutes must be a non-negative integer" },
          { status: 400 }
        );
      }
    }

    if (productionCostUsd != null) {
      const cost = Number(productionCostUsd);
      if (isNaN(cost) || cost < 0) {
        return NextResponse.json(
          { error: "productionCostUsd must be a non-negative number" },
          { status: 400 }
        );
      }
    }

    if (maintenanceCostUsd != null) {
      const cost = Number(maintenanceCostUsd);
      if (isNaN(cost) || cost < 0) {
        return NextResponse.json(
          { error: "maintenanceCostUsd must be a non-negative number" },
          { status: 400 }
        );
      }
    }

    const trimOpt = (v: string | number | undefined) =>
      v ? String(v).trim() || undefined : undefined;

    // Get next RCFA number from sequence
    const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('rcfa_number_seq')
    `;

    const rcfaNumber = Number(nextval);
    const isQuickCreate = !hasRequiredFields;

    const rcfa = await prisma.$transaction(async (tx) => {
      const created = await tx.rcfa.create({
        data: {
          rcfaNumber,
          title: trimmedTitle,
          equipmentDescription: trimmedEquipDesc,
          failureDescription: trimmedFailureDesc,
          operatingContext: trimmedContext,
          equipmentMake: trimOpt(equipmentMake),
          equipmentModel: trimOpt(equipmentModel),
          equipmentSerialNumber: trimOpt(equipmentSerialNumber),
          equipmentAgeYears:
            equipmentAgeYears != null ? Number(equipmentAgeYears) : undefined,
          downtimeMinutes:
            downtimeMinutes != null ? Number(downtimeMinutes) : undefined,
          productionCostUsd:
            productionCostUsd != null ? Number(productionCostUsd) : undefined,
          maintenanceCostUsd:
            maintenanceCostUsd != null ? Number(maintenanceCostUsd) : undefined,
          preFailureConditions: trimOpt(preFailureConditions),
          workHistorySummary: trimOpt(workHistorySummary),
          activePmsSummary: trimOpt(activePmsSummary),
          additionalNotes: trimOpt(additionalNotes),
          status: "draft",
          createdByUserId: userId,
          ownerUserId: userId,
        },
      });

      await tx.rcfaAuditEvent.create({
        data: {
          rcfaId: created.id,
          actorUserId: userId,
          eventType: "rcfa_created",
          eventPayload: {
            rcfaNumber,
            quickCreate: isQuickCreate,
          },
        },
      });

      return created;
    });

    return NextResponse.json(
      { id: rcfa.id, rcfaNumber: rcfa.rcfaNumber },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/rcfa error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
