"use client";

import { useCallback, useRef, type ReactNode } from "react";
import RcfaActionBar from "./RcfaActionBar";
import FollowupQuestions, {
  type FollowupQuestionsHandle,
} from "./FollowupQuestions";
import AddInformationSection, {
  type AddInformationSectionHandle,
} from "./AddInformationSection";
import CollapsibleSection from "@/components/CollapsibleSection";
import type { SectionStatus } from "@/components/SectionStatusIndicator";
import type { QuestionCategory } from "@/generated/prisma/client";

interface FollowupQuestion {
  id: string;
  questionText: string;
  questionCategory: QuestionCategory;
  answerText: string | null;
  answeredAt: string | null;
  answeredBy: { email: string } | null;
}

interface InvestigationWrapperProps {
  rcfaId: string;
  status: "investigation" | "actions_open";
  canEdit: boolean;
  isAdmin: boolean;
  hasAnsweredQuestions: boolean;
  hasNewDataForReanalysis: boolean;
  allActionItemsComplete: boolean;
  totalActionItems: number;
  /** Total action items including drafts (used for finalize gate). */
  totalAllActionItems: number;
  questions: FollowupQuestion[];
  isInvestigation: boolean;
  /** Content rendered before follow-up questions section (e.g., Intake Summary) */
  beforeQuestions?: ReactNode;
  /** Content rendered after AddInformationSection (e.g., Root Causes, Action Items) */
  afterAddInfo?: ReactNode;
  /** Status indicator for follow-up questions section */
  followupQuestionsStatus?: SectionStatus;
  /** Initial notes for AddInformationSection */
  initialInvestigationNotes: string | null;
  /** Status indicator for AddInformationSection */
  addInformationStatus?: SectionStatus;
}

export default function InvestigationWrapper({
  rcfaId,
  status,
  canEdit,
  isAdmin,
  hasAnsweredQuestions,
  hasNewDataForReanalysis,
  allActionItemsComplete,
  totalActionItems,
  totalAllActionItems,
  questions,
  isInvestigation,
  beforeQuestions,
  afterAddInfo,
  followupQuestionsStatus,
  initialInvestigationNotes,
  addInformationStatus,
}: InvestigationWrapperProps) {
  const followupQuestionsRef = useRef<FollowupQuestionsHandle>(null);
  const addInfoRef = useRef<AddInformationSectionHandle>(null);

  const handleFlushAnswers = useCallback(async () => {
    // Flush both follow-up questions and supporting info in parallel
    const flushPromises: Promise<void>[] = [];

    if (followupQuestionsRef.current) {
      flushPromises.push(followupQuestionsRef.current.flushPendingSaves());
    }
    if (addInfoRef.current) {
      flushPromises.push(addInfoRef.current.flush());
    }

    await Promise.all(flushPromises);
  }, []);

  return (
    <>
      <div className="space-y-4">
        {beforeQuestions}
        {questions.length > 0 && (
          <CollapsibleSection title="Follow-up Questions" status={followupQuestionsStatus}>
            <FollowupQuestions
              ref={followupQuestionsRef}
              rcfaId={rcfaId}
              questions={questions}
              isInvestigation={isInvestigation}
            />
          </CollapsibleSection>
        )}
        {/* Add Information Section - rendered here for flush coordination */}
        {canEdit && (
          <AddInformationSection
            ref={addInfoRef}
            rcfaId={rcfaId}
            initialNotes={initialInvestigationNotes}
            status={addInformationStatus}
          />
        )}
        {afterAddInfo}
      </div>
      <RcfaActionBar
        rcfaId={rcfaId}
        status={status}
        canEdit={canEdit}
        isAdmin={isAdmin}
        hasAnsweredQuestions={hasAnsweredQuestions}
        hasNewDataForReanalysis={hasNewDataForReanalysis}
        onFlushAnswers={handleFlushAnswers}
        allActionItemsComplete={allActionItemsComplete}
        totalActionItems={totalActionItems}
        totalAllActionItems={totalAllActionItems}
      />
    </>
  );
}
