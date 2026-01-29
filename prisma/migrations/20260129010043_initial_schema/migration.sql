-- CreateEnum
CREATE TYPE "AppUserRole" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "RcfaStatus" AS ENUM ('draft', 'investigation', 'actions_open', 'closed');

-- CreateEnum
CREATE TYPE "OperatingContext" AS ENUM ('running', 'startup', 'shutdown', 'maintenance', 'unknown');

-- CreateEnum
CREATE TYPE "QuestionCategory" AS ENUM ('failure_mode', 'evidence', 'operating_context', 'maintenance_history', 'safety', 'other');

-- CreateEnum
CREATE TYPE "GeneratedBy" AS ENUM ('ai', 'human');

-- CreateEnum
CREATE TYPE "ConfidenceLabel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('open', 'in_progress', 'blocked', 'done', 'canceled');

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "AppUserRole" NOT NULL DEFAULT 'user',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rcfa" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "equipment_description" TEXT NOT NULL,
    "equipment_make" TEXT,
    "equipment_model" TEXT,
    "equipment_serial_number" TEXT,
    "equipment_age_years" DECIMAL(6,2),
    "operating_context" "OperatingContext" NOT NULL DEFAULT 'unknown',
    "pre_failure_conditions" TEXT,
    "failure_description" TEXT NOT NULL,
    "work_history_summary" TEXT,
    "active_pms_summary" TEXT,
    "additional_notes" TEXT,
    "downtime_minutes" INTEGER,
    "production_cost_usd" DECIMAL(12,2),
    "maintenance_cost_usd" DECIMAL(12,2),
    "status" "RcfaStatus" NOT NULL DEFAULT 'draft',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,

    CONSTRAINT "rcfa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rcfa_followup_question" (
    "id" UUID NOT NULL,
    "rcfa_id" UUID NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_category" "QuestionCategory" NOT NULL DEFAULT 'other',
    "generated_by" "GeneratedBy" NOT NULL DEFAULT 'ai',
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answer_text" TEXT,
    "answered_by_user_id" UUID,
    "answered_at" TIMESTAMPTZ,

    CONSTRAINT "rcfa_followup_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rcfa_root_cause_candidate" (
    "id" UUID NOT NULL,
    "rcfa_id" UUID NOT NULL,
    "cause_text" TEXT NOT NULL,
    "rationale_text" TEXT,
    "confidence_label" "ConfidenceLabel" NOT NULL DEFAULT 'medium',
    "generated_by" "GeneratedBy" NOT NULL DEFAULT 'ai',
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rcfa_root_cause_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rcfa_root_cause_final" (
    "id" UUID NOT NULL,
    "rcfa_id" UUID NOT NULL,
    "cause_text" TEXT NOT NULL,
    "evidence_summary" TEXT,
    "selected_from_candidate_id" UUID,
    "selected_by_user_id" UUID NOT NULL,
    "selected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_user_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rcfa_root_cause_final_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rcfa_action_item_candidate" (
    "id" UUID NOT NULL,
    "rcfa_id" UUID NOT NULL,
    "action_text" TEXT NOT NULL,
    "rationale_text" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "timeframe_text" TEXT,
    "success_criteria" TEXT,
    "generated_by" "GeneratedBy" NOT NULL DEFAULT 'ai',
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rcfa_action_item_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rcfa_action_item" (
    "id" UUID NOT NULL,
    "rcfa_id" UUID NOT NULL,
    "action_text" TEXT NOT NULL,
    "success_criteria" TEXT,
    "owner_user_id" UUID,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "due_date" DATE,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'open',
    "selected_from_candidate_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_user_id" UUID,
    "completed_at" TIMESTAMPTZ,
    "completed_by_user_id" UUID,
    "completion_notes" TEXT,

    CONSTRAINT "rcfa_action_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rcfa_audit_event" (
    "id" UUID NOT NULL,
    "rcfa_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "event_type" TEXT NOT NULL,
    "event_payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rcfa_audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "rcfa_status_idx" ON "rcfa"("status");

-- CreateIndex
CREATE INDEX "rcfa_created_at_idx" ON "rcfa"("created_at");

-- CreateIndex
CREATE INDEX "rcfa_followup_question_rcfa_id_idx" ON "rcfa_followup_question"("rcfa_id");

-- CreateIndex
CREATE INDEX "rcfa_root_cause_candidate_rcfa_id_idx" ON "rcfa_root_cause_candidate"("rcfa_id");

-- CreateIndex
CREATE INDEX "rcfa_root_cause_final_rcfa_id_idx" ON "rcfa_root_cause_final"("rcfa_id");

-- CreateIndex
CREATE INDEX "rcfa_action_item_candidate_rcfa_id_idx" ON "rcfa_action_item_candidate"("rcfa_id");

-- CreateIndex
CREATE INDEX "rcfa_action_item_rcfa_id_idx" ON "rcfa_action_item"("rcfa_id");

-- CreateIndex
CREATE INDEX "rcfa_action_item_owner_user_id_idx" ON "rcfa_action_item"("owner_user_id");

-- CreateIndex
CREATE INDEX "rcfa_action_item_status_idx" ON "rcfa_action_item"("status");

-- CreateIndex
CREATE INDEX "rcfa_action_item_due_date_idx" ON "rcfa_action_item"("due_date");

-- CreateIndex
CREATE INDEX "rcfa_audit_event_rcfa_id_idx" ON "rcfa_audit_event"("rcfa_id");

-- CreateIndex
CREATE INDEX "rcfa_audit_event_created_at_idx" ON "rcfa_audit_event"("created_at");

-- AddForeignKey
ALTER TABLE "rcfa" ADD CONSTRAINT "rcfa_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_followup_question" ADD CONSTRAINT "rcfa_followup_question_rcfa_id_fkey" FOREIGN KEY ("rcfa_id") REFERENCES "rcfa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_followup_question" ADD CONSTRAINT "rcfa_followup_question_answered_by_user_id_fkey" FOREIGN KEY ("answered_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_root_cause_candidate" ADD CONSTRAINT "rcfa_root_cause_candidate_rcfa_id_fkey" FOREIGN KEY ("rcfa_id") REFERENCES "rcfa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_root_cause_final" ADD CONSTRAINT "rcfa_root_cause_final_rcfa_id_fkey" FOREIGN KEY ("rcfa_id") REFERENCES "rcfa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_root_cause_final" ADD CONSTRAINT "rcfa_root_cause_final_selected_from_candidate_id_fkey" FOREIGN KEY ("selected_from_candidate_id") REFERENCES "rcfa_root_cause_candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_root_cause_final" ADD CONSTRAINT "rcfa_root_cause_final_selected_by_user_id_fkey" FOREIGN KEY ("selected_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_root_cause_final" ADD CONSTRAINT "rcfa_root_cause_final_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_action_item_candidate" ADD CONSTRAINT "rcfa_action_item_candidate_rcfa_id_fkey" FOREIGN KEY ("rcfa_id") REFERENCES "rcfa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_action_item" ADD CONSTRAINT "rcfa_action_item_rcfa_id_fkey" FOREIGN KEY ("rcfa_id") REFERENCES "rcfa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_action_item" ADD CONSTRAINT "rcfa_action_item_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_action_item" ADD CONSTRAINT "rcfa_action_item_selected_from_candidate_id_fkey" FOREIGN KEY ("selected_from_candidate_id") REFERENCES "rcfa_action_item_candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_action_item" ADD CONSTRAINT "rcfa_action_item_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_action_item" ADD CONSTRAINT "rcfa_action_item_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_action_item" ADD CONSTRAINT "rcfa_action_item_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_audit_event" ADD CONSTRAINT "rcfa_audit_event_rcfa_id_fkey" FOREIGN KEY ("rcfa_id") REFERENCES "rcfa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rcfa_audit_event" ADD CONSTRAINT "rcfa_audit_event_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
