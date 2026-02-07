"use client";

import { useRef, useCallback } from "react";
import EditableIntakeForm from "./EditableIntakeForm";
import RcfaActionBar from "./RcfaActionBar";
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

  const handleSaveForm = useCallback(async (): Promise<boolean> => {
    if (saveFormRef.current) {
      return await saveFormRef.current();
    }
    return true; // If no save function, assume already saved
  }, []);

  return (
    <>
      <RcfaActionBar
        rcfaId={rcfaId}
        status="draft"
        canEdit={true}
        isAdmin={false}
        onSaveForm={handleSaveForm}
      />
      <EditableIntakeForm
        rcfaId={rcfaId}
        initialData={initialData}
        onSaveRef={saveFormRef}
      />
    </>
  );
}
