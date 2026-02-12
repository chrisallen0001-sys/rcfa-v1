# CLAUDE.md

AI-guided Root Cause Failure Analysis (RCFA) web application. Next.js 16 App Router, React 19, TypeScript, Prisma 7 (PostgreSQL), OpenAI API, TailwindCSS 4, TanStack React Table v8.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run test:run` | Run tests (Vitest) |
| `npx prisma migrate dev` | Run migrations |
| `npx prisma generate` | Generate Prisma client |

## Project Structure

```
src/app/                  Next.js App Router pages and API routes
src/app/api/              API routes (rcfa, action-items, ai, auth, users, admin)
src/app/dashboard/        Dashboard pages (rcfas, action-items, rcfa/[id] detail, admin/users)
src/components/           Shared components (DataTable/, AppHeader, ExportButtons, etc.)
src/components/DataTable/ Table system (DataTable, ColumnFilter, TablePagination, ActiveFilterChips)
src/lib/                  Utilities (export-utils, rcfa-utils, sql-utils, auth, validation-constants)
src/hooks/                Custom hooks (useUsers, useNavigationGuard, usePopoverPosition)
src/generated/prisma/     Generated Prisma client
prisma/                   Schema and migrations
docs/                     Product documentation (see README.md for links)
.claude/agents/           Claude Code agent definitions
```

## Coding Conventions

- **Server Components by default**, `"use client"` only when needed
- **API routes** use raw SQL via `$queryRawUnsafe` for complex queries (filtering, sorting, pagination); Prisma client for simple CRUD
- **TailwindCSS** for styling, dark mode via `dark:` variants
- **TypeScript strict mode** -- always run `npx tsc --noEmit` before committing
- **Column definitions** use TanStack `createColumnHelper` with `meta.filterType` for filter configuration
- **Path alias** `@/*` maps to `./src/*`

## Important Patterns

- **Dashboard tables** (RcfaTable, ActionItemsTable) use server-side filtering/sorting/pagination with URL state persistence
- **Default status filters** hide terminal statuses (closed/done/canceled) -- "Clear all" resets to defaults, not empty
- **DataTable component** supports both controlled (server-side) and uncontrolled (client-side) filtering modes
- **Export** uses `exportToCSV`/`exportToExcel` from `src/lib/export-utils.ts`
- **RCFA workflow**: `draft` -> `investigation` -> `actions_open` -> `closed` (manual transitions)
- **AI analysis** generates follow-up questions, root cause candidates, and action item candidates; users promote candidates to final records
- **Soft deletes** on RCFAs (GxP compliance -- preserves audit trail)

## Agent Workflow

| Agent | File | Role |
|-------|------|------|
| Senior Dev | `@.claude/agents/senior-dev.md` | Implementation (runs `tsc`, `lint`, `build` before committing) |
| Code Reviewer | `@.claude/agents/code-reviewer.md` | Reviews (correctness, security, performance, maintainability, accessibility) |
| Tech Lead | `@.claude/agents/tech-lead.md` | Planning, issue creation, architecture (does not write code) |
| Doc Writer | `@.claude/agents/documentation-writer.md` | Documentation updates (DRY principles) |

## Documentation Policy

Prefer code over docs. Only document architecture and workflows, not individual components or endpoints. See [README.md](./README.md) for links to existing documentation.
