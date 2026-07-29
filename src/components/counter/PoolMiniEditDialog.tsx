"use client";

import {
  SnookerFrameEditDialog,
} from "@/components/counter/SnookerFrameEditDialog";
import type { NotebookEntryDTO } from "@/types";

interface PoolMiniEditDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
}

/**
 * Pool & Mini edit — same Edit Frame UI as Big Snooker, without Split.
 * Kept as a thin alias so existing imports keep working.
 */
export function PoolMiniEditDialog({
  entry,
  onClose,
}: PoolMiniEditDialogProps) {
  return (
    <SnookerFrameEditDialog
      entry={entry}
      onClose={onClose}
      allowSplit={false}
    />
  );
}
