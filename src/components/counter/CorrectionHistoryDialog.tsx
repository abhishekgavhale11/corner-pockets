"use client";

import type { NotebookEntryCorrectionDTO } from "@/types";
import { formatCompactDateTime } from "@/lib/utils/activity-display";
import { CorrectionChangeLine } from "@/components/counter/CorrectionChangeLine";
import { Dialog } from "@/components/ui/Dialog";

interface CorrectionHistoryDialogProps {
  corrections: NotebookEntryCorrectionDTO[] | null | undefined;
  onClose: () => void;
}

export function CorrectionHistoryDialog({
  corrections,
  onClose,
}: CorrectionHistoryDialogProps) {
  const open = Boolean(corrections?.length);

  return (
    <Dialog open={open} onClose={onClose} title="Correction History">
      <div className="space-y-4">
        {corrections?.map((correction, index) => (
          <div
            key={`${correction.correctedAt}-${index}`}
            className="rounded-lg border border-gray-200 bg-gray-50 p-3"
          >
            <p className="text-xs font-semibold text-gray-700">
              {formatCompactDateTime(correction.correctedAt)} ·{" "}
              {correction.correctedBy}
            </p>
            <div className="mt-2 space-y-1">
              {correction.changes.map((change, changeIndex) => (
                <CorrectionChangeLine
                  key={`${change.field}-${changeIndex}`}
                  from={change.fromLabel}
                  to={change.toLabel}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Reason: {correction.correctionReason}
            </p>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
