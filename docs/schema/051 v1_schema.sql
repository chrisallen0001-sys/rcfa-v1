-- RCFA AI Tool (V1) - Clean Database Schema
-- Target: PostgreSQL (works well with Supabase)
-- Notes:
--  - Uses UUID primary keys (pgcrypto)
--  - Separates AI "candidates" from user-validated "final" records
--  - Supports multiple final root causes per RCFA
--  - Includes audit event logging table (app populates events)

begin;

-- Extensions
create extension if not exists "pgcrypto";

-- -----------------------------
-- Enum-like domains (CHECK constraints)
-- -----------------------------

-- Users
-- role: 'admin' | 'user'

-- RCFA
-- status: 'draft' | 'investigation' | 'actions_open' | 'closed'
-- operating_context: 'running' | 'startup' | 'shutdown' | 'maintenance' | 'unknown'

-- Follow-up questions
-- question_category: 'failure_mode' | 'evidence' | 'operating_context' | 'maintenance_history' | 'safety' | 'other'
-- generated_by: 'ai' | 'human'

-- Root causes
-- confidence_label: 'low' | 'medium' | 'high'

-- Action items
-- priority: 'low' | 'medium' | 'high'
-- status: 'open' | 'in_progress' | 'blocked' | 'done' | 'canceled'

-- -----------------------------
-- USERS (local accounts)
-- -----------------------------
create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  role text not null default 'user',
  password_hash text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ck_app_user_role
    check (role in ('admin','user'))
);

create index if not exists idx_app_user_email on app_user(email);

-- -----------------------------
-- RCFA (system-of-record parent)
-- -----------------------------
create table if not exists rcfa (
  id uuid primary key default gen_random_uuid(),

  title text not null default '',
  equipment_description text not null,

  equipment_make text,
  equipment_model text,
  equipment_serial_number text,

  -- Explicitly years (supports decimals)
  equipment_age_years numeric(6,2),

  operating_context text not null default 'unknown',

  pre_failure_conditions text,
  failure_description text not null,

  work_history_summary text,
  active_pms_summary text,
  additional_notes text,

  downtime_minutes integer,
  production_cost_usd numeric(12,2),
  maintenance_cost_usd numeric(12,2),

  status text not null default 'draft',
  created_by_user_id uuid not null references app_user(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,

  constraint ck_rcfa_operating_context
    check (operating_context in ('running','startup','shutdown','maintenance','unknown')),

  constraint ck_rcfa_status
    check (status in ('draft','investigation','actions_open','closed')),

  constraint ck_rcfa_costs_nonnegative
    check (
      (production_cost_usd is null or production_cost_usd >= 0)
      and (maintenance_cost_usd is null or maintenance_cost_usd >= 0)
      and (downtime_minutes is null or downtime_minutes >= 0)
      and (equipment_age_years is null or equipment_age_years >= 0)
    )
);

create index if not exists idx_rcfa_status on rcfa(status);
create index if not exists idx_rcfa_created_at on rcfa(created_at);
create index if not exists idx_rcfa_equipment_desc on rcfa using gin (to_tsvector('english', equipment_description));
create index if not exists idx_rcfa_failure_desc on rcfa using gin (to_tsvector('english', failure_description));

-- -----------------------------
-- FOLLOW-UP QUESTIONS (AI and human)
-- -----------------------------
create table if not exists rcfa_followup_question (
  id uuid primary key default gen_random_uuid(),
  rcfa_id uuid not null references rcfa(id) on delete cascade,

  question_text text not null,
  question_category text not null default 'other',

  generated_by text not null default 'ai',
  generated_at timestamptz not null default now(),

  -- Answer fields (nullable until answered)
  answer_text text,
  answered_by_user_id uuid references app_user(id),
  answered_at timestamptz,

  constraint ck_followup_category
    check (question_category in ('failure_mode','evidence','operating_context','maintenance_history','safety','other')),

  constraint ck_followup_generated_by
    check (generated_by in ('ai','human'))
);

create index if not exists idx_followup_rcfa on rcfa_followup_question(rcfa_id);

-- -----------------------------
-- ROOT CAUSE CANDIDATES (AI suggestions; not authoritative)
-- -----------------------------
create table if not exists rcfa_root_cause_candidate (
  id uuid primary key default gen_random_uuid(),
  rcfa_id uuid not null references rcfa(id) on delete cascade,

  cause_text text not null,
  rationale_text text,
  confidence_label text not null default 'medium',

  generated_by text not null default 'ai',
  generated_at timestamptz not null default now(),

  constraint ck_cause_confidence
    check (confidence_label in ('low','medium','high')),

  constraint ck_cause_generated_by
    check (generated_by in ('ai','human'))
);

create index if not exists idx_cause_candidate_rcfa on rcfa_root_cause_candidate(rcfa_id);

-- -----------------------------
-- FINAL ROOT CAUSES (user-validated; authoritative set)
-- Supports multiple final root causes per RCFA.
-- -----------------------------
create table if not exists rcfa_root_cause_final (
  id uuid primary key default gen_random_uuid(),
  rcfa_id uuid not null references rcfa(id) on delete cascade,

  cause_text text not null,
  evidence_summary text,

  -- lineage to a candidate (nullable for user-authored finals)
  selected_from_candidate_id uuid references rcfa_root_cause_candidate(id),

  selected_by_user_id uuid not null references app_user(id),
  selected_at timestamptz not null default now(),

  updated_by_user_id uuid references app_user(id),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cause_final_rcfa on rcfa_root_cause_final(rcfa_id);

-- -----------------------------
-- ACTION ITEM CANDIDATES (AI suggestions; not tracked yet)
-- -----------------------------
create table if not exists rcfa_action_item_candidate (
  id uuid primary key default gen_random_uuid(),
  rcfa_id uuid not null references rcfa(id) on delete cascade,

  action_text text not null,
  rationale_text text,
  priority text not null default 'medium',
  timeframe_text text,
  success_criteria text,

  generated_by text not null default 'ai',
  generated_at timestamptz not null default now(),

  constraint ck_action_candidate_priority
    check (priority in ('low','medium','high')),

  constraint ck_action_candidate_generated_by
    check (generated_by in ('ai','human'))
);

create index if not exists idx_action_candidate_rcfa on rcfa_action_item_candidate(rcfa_id);

-- -----------------------------
-- ACTION ITEMS (final tracked items)
-- These are the "move forward with" actions the user commits to track.
-- -----------------------------
create table if not exists rcfa_action_item (
  id uuid primary key default gen_random_uuid(),
  rcfa_id uuid not null references rcfa(id) on delete cascade,

  action_text text not null,
  success_criteria text,

  owner_user_id uuid references app_user(id),
  priority text not null default 'medium',
  due_date date,
  status text not null default 'open',

  -- lineage to a candidate (nullable for user-authored finals)
  selected_from_candidate_id uuid references rcfa_action_item_candidate(id),

  created_by_user_id uuid not null references app_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references app_user(id),

  completed_at timestamptz,
  completed_by_user_id uuid references app_user(id),
  completion_notes text,

  constraint ck_action_priority
    check (priority in ('low','medium','high')),

  constraint ck_action_status
    check (status in ('open','in_progress','blocked','done','canceled')),

  constraint ck_action_completion_consistency
    check (
      (status in ('done','canceled') and completed_at is not null)
      or (status not in ('done','canceled') and completed_at is null)
      or (status in ('done','canceled') and completed_at is null) -- allow app to set status first, timestamp second
    )
);

create index if not exists idx_action_rcfa on rcfa_action_item(rcfa_id);
create index if not exists idx_action_owner on rcfa_action_item(owner_user_id);
create index if not exists idx_action_status on rcfa_action_item(status);
create index if not exists idx_action_due_date on rcfa_action_item(due_date);

-- -----------------------------
-- AUDIT EVENTS (lightweight defensibility)
-- App writes events for key changes (promote/edit/delete/status changes)
-- -----------------------------
create table if not exists rcfa_audit_event (
  id uuid primary key default gen_random_uuid(),
  rcfa_id uuid not null references rcfa(id) on delete cascade,

  actor_user_id uuid references app_user(id), -- nullable if system event
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_audit_rcfa on rcfa_audit_event(rcfa_id);
create index if not exists idx_audit_created_at on rcfa_audit_event(created_at);

-- -----------------------------
-- Helpful VIEW: RCFA summary for dashboards
-- -----------------------------
create or replace view rcfa_summary as
select
  r.id,
  r.title,
  r.equipment_description,
  r.status,
  r.operating_context,
  r.created_at,
  r.updated_at,
  r.closed_at,
  (select count(*) from rcfa_root_cause_final f where f.rcfa_id = r.id) as final_root_cause_count,
  (select count(*) from rcfa_action_item a where a.rcfa_id = r.id) as action_item_count,
  (select count(*) from rcfa_action_item a where a.rcfa_id = r.id and a.status not in ('done','canceled')) as open_action_item_count
from rcfa r;

commit;
