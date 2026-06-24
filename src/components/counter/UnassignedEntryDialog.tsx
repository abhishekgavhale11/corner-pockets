"use client";

import type { NotebookEntryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface UnassignedEntryDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
  onAssign: (entry: NotebookEntryDTO) => void;
  onSplit: (entry: NotebookEntryDTO) => void;
}

export function UnassignedEntryDialog({
  entry,
  onClose,
  onAssign,
  onSplit,
}: UnassignedEntryDialogProps) {
  const open = entry !== null;

  return (
    <Dialog open={open} onClose={onClose} title="Unassigned Entry">
      {entry && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-600">
            Assign one customer or split between contributors.
          </p>
          <Button
            type="button"
            fullWidth
            onClick={() => {
              onClose();
              onAssign(entry);
            }}
          >
            Assign Customer
          </Button>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={() => {
              onClose();
              onSplit(entry);
            }}
          >
            Split Bill
          </Button>
        </div>
      )}
    </Dialog>
  );
}
