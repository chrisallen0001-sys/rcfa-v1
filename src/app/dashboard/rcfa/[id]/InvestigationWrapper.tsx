"use client";

import { useCallback, useRef, type ReactNode } from "react";
import RcfaActionBar from "./RcfaActionBar";
import FollowupQuestions, {
  type FollowupQuestionsHandle,
} from "./FollowupQuestions";
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
  questions: FollowupQuestion[];
  isInvestigation: boolean;
  /** Content rendered before follow-up questions section (e.g., Intake Summary) */
  beforeQuestions?: ReactNode;
  /** Content rendered after follow-up questions section (e.g., Add Information, Root Causes) */
  afterQuestions?: ReactNode;
  /** Status indicator for follow-up questions section */
  followupQuestionsStatus?: SectionStatus;
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
  questions,
  isInvestigation,
  beforeQuestions,
  afterQuestions,
  followupQuestionsStatus,
}: InvestigationWrapperProps) {
  const followupQuestionsRef = useRef<FollowupQuestionsHandle>(null);

  const handleFlushAnswers = useCallback(async () => {
    if (followupQuestionsRef.current) {
      await followupQuestionsRef.current.flushPendingSaves();
    }
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
        {afterQuestions}
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
      />
    </>
  );
}
