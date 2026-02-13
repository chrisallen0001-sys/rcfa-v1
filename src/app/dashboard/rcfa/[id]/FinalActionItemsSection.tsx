"use client";

import { useState } from "react";
import type { SectionStatus } from "@/components/SectionStatusIndicator";
import SectionStatusIndicator from "@/components/SectionStatusIndicator";
import ActionItemCard from "./ActionItemCard";
import ActionItemDrawer from "./ActionItemDrawer";
import ActionItemDrawerContent, {
  type DrawerMode,
  type ActionItemData,
} from "./ActionItemDrawerContent";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FinalActionItemsSectionProps {
  rcfaId: string;
  actionItems: ActionItemData[];
  canEdit: boolean;
  /** Section status indicator for workflow guidance */
  status?: SectionStatus;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FinalActionItemsSection({
  rcfaId,
  actionItems,
  canEdit,
  status,
}: FinalActionItemsSectionProps) {
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("view");

  // Progress tracking
  const totalActionItems = actionItems.length;
  const completedActionItems = actionItems.filter(
    (a) => a.status === "done" || a.status === "canceled"
  ).length;

  // Derive the selected action item data from the current list
  const selectedItem = selectedItemId
    ? actionItems.find((a) => a.actionItemId === selectedItemId) ?? null
    : null;

  // Drawer title based on mode
  const drawerTitle =
    drawerMode === "add"
      ? "Add Action Item"
      : drawerMode === "edit"
        ? "Edit Action Item"
        : "Action Item Details";

  // Handlers
  function handleCardClick(actionItemId: string) {
    setSelectedItemId(actionItemId);
    setDrawerMode("view");
    setDrawerOpen(true);
  }

  function handleAddClick() {
    setSelectedItemId(null);
    setDrawerMode("add");
    setDrawerOpen(true);
  }

  function handleDrawerClose() {
    setDrawerOpen(false);
    // Reset selection after close animation completes
    setTimeout(() => {
      setSelectedItemId(null);
      setDrawerMode("view");
    }, 200);
  }

  function handleModeChange(mode: DrawerMode) {
    setDrawerMode(mode);
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Section header -- matches CollapsibleSection visual style but without collapse */}
      <div className="flex w-full items-center justify-between px-6 py-4">
        <div className="flex flex-1 items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Final Action Items
          </h2>
          <div className="flex items-center gap-3">
            {totalActionItems > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{
                      width: `${(completedActionItems / totalActionItems) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {completedActionItems} of {totalActionItems} complete
                </span>
              </div>
            )}
            {status && <SectionStatusIndicator status={status} />}
          </div>
        </div>
      </div>

      {/* Action item cards list */}
      <div className="px-6 pb-6">
        {actionItems.length > 0 ? (
          <div className="space-y-3">
            {actionItems.map((item) => (
              <ActionItemCard
                key={item.actionItemId}
                actionItemNumber={item.actionItemNumber}
                actionText={item.actionText}
                priority={item.priority}
                status={item.status}
                dueDate={item.dueDate}
                ownerName={item.ownerName}
                onClick={() => handleCardClick(item.actionItemId)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No action items yet.
          </p>
        )}

        {/* "+ Add Action Item" button */}
        {canEdit && (
          <button
            type="button"
            onClick={handleAddClick}
            className="mt-4 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            + Add Action Item
          </button>
        )}
      </div>

      {/* Drawer */}
      <ActionItemDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) handleDrawerClose();
        }}
        title={drawerTitle}
      >
        <ActionItemDrawerContent
          mode={drawerMode}
          rcfaId={rcfaId}
          canEdit={canEdit}
          actionItem={selectedItem ?? undefined}
          onClose={handleDrawerClose}
          onModeChange={handleModeChange}
        />
      </ActionItemDrawer>
    </section>
  );
}
