"use client";

import { useEffect, useRef, useState } from "react";
import type { SectionStatus } from "@/components/SectionStatusIndicator";
import SectionStatusIndicator from "@/components/SectionStatusIndicator";
import { isActionItemComplete } from "@/lib/rcfa-utils";
import type { ActionItemStatus } from "@/generated/prisma/client";
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
  /** When provided, auto-open the drawer in "view" mode for this action item on mount */
  initialOpenItemId?: string;
  /** Current authenticated user ID for item-owner permission checks */
  currentUserId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FinalActionItemsSection({
  rcfaId,
  actionItems,
  canEdit,
  status,
  initialOpenItemId,
  currentUserId,
}: FinalActionItemsSectionProps) {
  // Use a primitive string (or null) as the deep-link dependency for referential stability
  const deepLinkTargetId = initialOpenItemId
    ? actionItems.find((a) => a.actionItemId === initialOpenItemId)?.actionItemId ?? null
    : null;

  // Drawer state — pre-open when deep-linked
  const [drawerOpen, setDrawerOpen] = useState(!!deepLinkTargetId);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(deepLinkTargetId);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(deepLinkTargetId ? "view" : "view");

  // Progress tracking
  const totalActionItems = actionItems.length;
  const completedActionItems = actionItems.filter(
    (a) => isActionItemComplete(a.status as ActionItemStatus)
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

  // Scroll the section into view when deep-linking opens the drawer on mount
  const hasScrolled = useRef(false);
  useEffect(() => {
    if (!deepLinkTargetId || hasScrolled.current) return;
    hasScrolled.current = true;

    document
      .getElementById("final-action-items")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [deepLinkTargetId]);

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
    // Wait for drawer close animation (200ms defined in ActionItemDrawer.tsx @keyframes) before resetting state
    setTimeout(() => {
      setSelectedItemId(null);
      setDrawerMode("view");
    }, 200);

    // Remove expandItem query param from the URL without triggering navigation
    if (typeof window !== "undefined" && window.location.search.includes("expandItem")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("expandItem");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }

  function handleModeChange(mode: DrawerMode) {
    setDrawerMode(mode);
  }

  return (
    <section
      id="final-action-items"
      className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      {/* Section header -- matches CollapsibleSection visual style but without collapse */}
      <div className="flex w-full items-center justify-between px-6 py-4">
        <div className="flex flex-1 items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Final Action Items
          </h2>
          <div className="flex items-center gap-3">
            {totalActionItems > 0 && (
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-24 rounded-full bg-zinc-200 dark:bg-zinc-700"
                  role="progressbar"
                  aria-valuenow={completedActionItems}
                  aria-valuemax={totalActionItems}
                  aria-label={`${completedActionItems} of ${totalActionItems} action items complete`}
                >
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
            aria-label="Add Action Item"
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
          currentUserId={currentUserId}
        />
      </ActionItemDrawer>
    </section>
  );
}
