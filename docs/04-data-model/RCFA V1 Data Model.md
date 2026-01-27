**RCFA AI Tool (V1) — Data Model Spec**

Version: Draft v1  
Last updated: 2026-01-22

# 1. Purpose

This document defines the V1 data model for the RCFA AI Tool. It is the product and implementation contract for what information is stored, how it relates, and how the RCFA record is finalized as a defensible system of record.

# 2. Core Product Behaviors

V1 must support the following behaviors:

- Create an RCFA record (structured intake).

- Generate AI follow-up questions and store them.

- Allow users to answer any/all/none of the follow-up questions; store answers per question.

- Generate AI root cause candidates and AI action item candidates; store them as non-authoritative suggestions.

- Allow users to select which candidates to move forward with (promote to Final / tracked records).

- Allow users to edit/add/delete Final root causes and Final action items during RCFA finalization.

- Assign action items to users; track status through completion.

- Close the RCFA with an authoritative set of Final root causes and (ideally) completed action items.

- Search and review historical RCFA records (system of record).

- Maintain lightweight audit events to improve defensibility (who changed what, when).

# 3. Design Principles

- Separate AI suggestions from human-validated decisions: Candidates vs Finals.

- Final records are authoritative and editable; candidates preserve AI history and rationale.

- Support multiple final root causes per RCFA (common in real investigations).

- Keep V1 boring and reliable: local auth, minimal constraints, no CMMS integration.

# 4. Entity Overview

The V1 data model contains the following entities:

- RCFA: The parent system-of-record investigation record with lifecycle status.

- Users: Local user accounts used for ownership, assignment, and traceability.

- Follow-up Questions: AI- (or human-) generated questions and user answers stored per question.

- Root Cause Candidates: AI suggestions (non-authoritative).

- Final Root Causes: Human-validated authoritative root causes (editable; supports multiple per RCFA).

- Action Item Candidates: AI suggested corrective actions (non-authoritative).

- Final Action Items: Tracked action items selected/promoted by users (editable; assignable; status-tracked).

- Audit Events: Lightweight event log supporting defensibility and change traceability.

# 5. Detailed Entity Definitions

## 5.1 RCFA

Purpose: Represents one failure investigation record and is the parent for all other entities.

Key fields:

- id (UUID) — unique RCFA ID

- title — short label for list views

- equipment_description — free text for V1 (CMMS integration is out of scope)

- equipment_make / model / serial_number (optional)

- equipment_age_years (optional; explicitly years)

- operating_context — running/startup/shutdown/maintenance/unknown

- pre_failure_conditions (optional)

- failure_description

- work_history_summary / active_pms_summary / additional_notes (optional)

- downtime_minutes / production_cost_usd / maintenance_cost_usd (optional)

- status — draft/investigation/actions_open/closed

- created_by_user_id and timestamps

Notes:

- Status is used to drive workflow and dashboards.

- The RCFA record is authoritative only when finalized (typically when status = closed).

## 5.2 Users

Purpose: Local user accounts used for ownership, assignment, and auditability.

Key fields:

- id (UUID)

- email (unique)

- display_name

- role — admin/user

- password_hash

- created_at / updated_at

Notes:

- V1 explicitly does not include SSO/AD integration.

## 5.3 Follow-up Questions

Purpose: Stores AI-generated (or human-added) follow-up questions and user answers per question.

Key fields:

- id (UUID)

- rcfa_id (FK)

- question_text

- question_category — failure_mode/evidence/operating_context/maintenance_history/safety/other

- generated_by — ai/human

- answer_text (nullable)

- answered_by_user_id / answered_at (nullable)

Notes:

- Users may answer all, some, or none of the questions.

- Answers are stored at the question level to preserve investigation history.

## 5.4 Root Cause Candidates

Purpose: Stores AI-generated root cause contenders that are not authoritative.

Key fields:

- id (UUID)

- rcfa_id (FK)

- cause_text

- rationale_text (optional)

- confidence_label — low/medium/high

- generated_by — ai/human

- generated_at

Notes:

- Candidates exist to support selection/promotion into Final root causes.

## 5.5 Final Root Causes

Purpose: Stores the authoritative, human-validated root causes for an RCFA (multiple allowed).

Key fields:

- id (UUID)

- rcfa_id (FK)

- cause_text (editable)

- evidence_summary (optional but recommended)

- selected_from_candidate_id (nullable FK)

- selected_by_user_id / selected_at

- updated_by_user_id / updated_at

Notes:

- Multiple final root causes are allowed per RCFA.

- Users can edit/add/delete final root causes during finalization.

- selected_from_candidate_id is nullable to support user-authored final root causes.

## 5.6 Action Item Candidates

Purpose: Stores AI suggested corrective actions that are not tracked until promoted.

Key fields:

- id (UUID)

- rcfa_id (FK)

- action_text

- rationale_text (optional)

- priority — low/medium/high

- timeframe_text (optional)

- success_criteria (optional)

- generated_by — ai/human

- generated_at

Notes:

- Candidates exist to support selection/promotion into Final (tracked) action items.

## 5.7 Final Action Items

Purpose: Stores tracked action items the user commits to move forward with; supports assignment and completion tracking.

Key fields:

- id (UUID)

- rcfa_id (FK)

- action_text (editable)

- success_criteria (editable)

- owner_user_id (nullable)

- priority — low/medium/high

- due_date (optional)

- status — open/in_progress/blocked/done/canceled

- selected_from_candidate_id (nullable FK)

- completion fields (completed_at, completed_by_user_id, completion_notes)

- created/updated fields

Notes:

- Users can edit/add/delete action items during finalization.

- After finalization, action items are tracked to completion and support dashboards (open/overdue).

## 5.8 Audit Events

Purpose: Lightweight event log for defensibility and traceability (who did what, when).

Key fields:

- id (UUID)

- rcfa_id (FK)

- actor_user_id (nullable for system)

- event_type (string)

- event_payload (JSON)

- created_at

Notes:

- Recommended event types: candidate_generated, promoted_to_final, final_updated, final_deleted, status_changed, action_completed.

- V1 does not require full record versioning; event logs are sufficient.

# 6. Promotion and Finalization Rules (App Logic)

- Promotion: selecting candidates creates Final records (root causes and action items) with selected_from_candidate_id populated.

- User-authored finals: user can create a Final root cause/action item without a candidate (selected_from_candidate_id = null).

- Edits: final records are editable; updates should set updated_by_user_id and updated_at and write an audit event.

- Deletes: deleting final records should write an audit event; candidates are typically kept as history.

- Closure (recommended): RCFA cannot be closed unless it has at least one Final root cause and (optionally) no open action items.

# 7. Workflow States

- draft — intake captured; investigation not started or incomplete

- investigation — follow-ups generated/answered; candidates generated

- actions_open — final root causes selected; action items being tracked

- closed — RCFA finalized and closed out (typically all actions done/canceled)

# 8. Deliverables

This spec is implemented by the companion SQL file: v1_schema.sql
