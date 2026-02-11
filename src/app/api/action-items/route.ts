import { NextRequest, NextResponse } from "next/server";
import type { ActionItemStatus, Priority } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";

/**
 * Row shape for action items table listing.
 */
type ActionItemRow = {
  id: string;
  action_item_number: number;
  action_text: string;
  action_description: string | null;
  priority: Priority;
  status: ActionItemStatus;
  due_date: Date | null;
  created_at: Date;
  owner_user_id: string | null;
  owner_display_name: string | null;
  rcfa_id: string;
  rcfa_number: number;
  rcfa_title: string;
  total_count: bigint;
};

const VALID_SORT_COLUMNS = [
  "action_item_number",
  "action_text",
  "priority",
  "status",
  "due_date",
  "created_at",
  "owner_display_name",
  "rcfa_number",
];

const VALID_STATUSES: ActionItemStatus[] = [
  "open",
  "in_progress",
  "blocked",
  "done",
  "canceled",
];

const VALID_PRIORITIES: Priority[] = [
  "deprioritized",
  "low",
  "medium",
  "high",
];

/**
 * Maps a database row to the API response format.
 */
function mapRowToResponse(r: ActionItemRow) {
  return {
    id: r.id,
    actionItemNumber: r.action_item_number,
    actionText: r.action_text,
    actionDescription: r.action_description,
    priority: r.priority,
    status: r.status,
    dueDate: r.due_date?.toISOString().slice(0, 10) ?? null,
    createdAt: new Date(r.created_at).toISOString().slice(0, 10),
    ownerUserId: r.owner_user_id,
    ownerDisplayName: r.owner_display_name,
    rcfaId: r.rcfa_id,
    rcfaNumber: r.rcfa_number,
    rcfaTitle: r.rcfa_title || "Untitled RCFA",
  };
}

/**
 * GET /api/action-items - List action items with filtering, sorting, and pagination
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 25, max: 100)
 * - sortBy: Column to sort by (default: due_date)
 * - sortOrder: asc or desc (default: asc)
 * - status: Comma-separated status values to filter
 * - priority: Comma-separated priority values to filter
 * - owner: Owner user ID to filter
 * - filter: Special filter ("mine" = current user's action items)
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
    const sortBy = searchParams.get("sortBy") ?? "due_date";
    const sortOrder = searchParams.get("sortOrder")?.toLowerCase() === "desc" ? "DESC" : "ASC";
    const validatedSortBy = VALID_SORT_COLUMNS.includes(sortBy) ? sortBy : "due_date";

    // Parse filters
    const statusFilter = searchParams.get("status");
    const priorityFilter = searchParams.get("priority");
    const ownerFilter = searchParams.get("owner");
    const specialFilter = searchParams.get("filter");

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: (string | number | Date)[] = [];
    let paramIndex = 1;

    // Always exclude deleted RCFAs
    conditions.push(`r.deleted_at IS NULL`);

    // Special filter: "mine" = current user's action items
    if (specialFilter === "mine") {
      conditions.push(`ai.owner_user_id = $${paramIndex++}`);
      params.push(userId);
    }

    // Status filter - use IN clause with individual placeholders
    if (statusFilter) {
      const statuses = statusFilter.split(",").filter((s) => VALID_STATUSES.includes(s as ActionItemStatus));
      if (statuses.length > 0) {
        const placeholders = statuses.map(() => `$${paramIndex++}`).join(", ");
        conditions.push(`ai.status IN (${placeholders})`);
        statuses.forEach((s) => params.push(s));
      }
    }

    // Priority filter - use IN clause with individual placeholders
    if (priorityFilter) {
      const priorities = priorityFilter.split(",").filter((p) => VALID_PRIORITIES.includes(p as Priority));
      if (priorities.length > 0) {
        const placeholders = priorities.map(() => `$${paramIndex++}`).join(", ");
        conditions.push(`ai.priority IN (${placeholders})`);
        priorities.forEach((p) => params.push(p));
      }
    }

    // Owner filter (only if not using "mine" filter)
    if (ownerFilter && !specialFilter) {
      conditions.push(`ai.owner_user_id = $${paramIndex++}`);
      params.push(ownerFilter);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Handle NULL sorting for due_date (NULLs last for ASC, first for DESC)
    const orderByClause = validatedSortBy === "due_date"
      ? `ORDER BY ai.due_date IS NULL ${sortOrder === "ASC" ? "ASC" : "DESC"}, ai.due_date ${sortOrder}`
      : `ORDER BY ${validatedSortBy === "owner_display_name" ? "u.display_name" : validatedSortBy === "rcfa_number" ? "r.rcfa_number" : `ai.${validatedSortBy}`} ${sortOrder}`;

    const sql = `
      SELECT
        ai.id,
        ai.action_item_number,
        ai.action_text,
        ai.action_description,
        ai.priority,
        ai.status,
        ai.due_date,
        ai.created_at,
        ai.owner_user_id,
        u.display_name AS owner_display_name,
        r.id AS rcfa_id,
        r.rcfa_number,
        r.title AS rcfa_title,
        COUNT(*) OVER() AS total_count
      FROM rcfa_action_item ai
      JOIN rcfa r ON r.id = ai.rcfa_id
      LEFT JOIN app_user u ON u.id = ai.owner_user_id
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const results = await prisma.$queryRawUnsafe<ActionItemRow[]>(
      sql,
      ...params,
      pageSize,
      offset
    );

    const total = results.length > 0 ? Number(results[0].total_count) : 0;
    const rows = results.map((r) => mapRowToResponse(r));

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("GET /api/action-items error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
