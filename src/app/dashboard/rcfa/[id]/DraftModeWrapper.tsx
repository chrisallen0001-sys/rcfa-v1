"use client";

import { useRef, useCallback, useState } from "react";
import EditableIntakeForm, { type RequiredField } from "./EditableIntakeForm";
import RcfaActionBar from "./RcfaActionBar";
import { useDraftNavigation } from "./DraftNavigationContext";
import type { OperatingContext } from "@/generated/prisma/client";

interface DraftModeWrapperProps {
  rcfaId: string;
  initialData: {
    title: string;
    equipmentDescription: string;
    operatingContext: OperatingContext;
    equipmentMake: string | null;
    equipmentModel: string | null;
    equipmentSerialNumber: string | null;
    equipmentAgeYears: number | null;
    downtimeMinutes: number | null;
    productionCostUsd: number | null;
    maintenanceCostUsd: number | null;
    failureDescription: string;
    preFailureConditions: string | null;
    workHistorySummary: string | null;
    activePmsSummary: string | null;
    additionalNotes: string | null;
  };
}

export default function DraftModeWrapper({
  rcfaId,
  initialData,
}: DraftModeWrapperProps) {
  // Ref to hold the save function exposed by EditableIntakeForm
  const saveFormRef = useRef<(() => Promise<boolean>) | null>(null);
  const draftNav = useDraftNavigation();
  const [missingFields, setMissingFields] = useState<RequiredField[]>([]);

  const handleSaveForm = useCallback(async (): Promise<boolean> => {
    if (saveFormRef.current) {
      return await saveFormRef.current();
    }
    return true; // If no save function, assume already saved
  }, []);

  const handleDirtyChange = useCallback((isDirty: boolean) => {
    draftNav?.setIsDirty(isDirty);
  }, [draftNav]);

  const handleMissingFieldsChange = useCallback((fields: RequiredField[]) => {
    setMissingFields(fields);
  }, []);

  return (
    <>
      {/* isAdmin=false: Draft state has no admin-specific actions (Reopen is only for closed state) */}
      <RcfaActionBar
        rcfaId={rcfaId}
        status="draft"
        canEdit={true}
        isAdmin={false}
        onSaveForm={handleSaveForm}
        missingRequiredFields={missingFields}
      />
      <EditableIntakeForm
        rcfaId={rcfaId}
        initialData={initialData}
        onSaveRef={saveFormRef}
        onDirtyChange={handleDirtyChange}
        onMissingFieldsChange={handleMissingFieldsChange}
      />
    </>
  );
}
