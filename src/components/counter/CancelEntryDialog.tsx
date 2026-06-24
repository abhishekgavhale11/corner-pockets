"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { cancelCounterEntry } from "@/actions/notebook-entries";
import {
  NOTEBOOK_REVERSAL_REASONS,
  type NotebookReversalReasonKey,
} from "@/lib/constants/notebook-payments";
import type { NotebookEntryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useState } from "react";

interface CancelEntryDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
}

export function CancelEntryDialog({ entry, onClose }: CancelEntryDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState<NotebookReversalReasonKey>("WRONG_AMOUNT");
  const [reasonOther, setReasonOther] = useState("");

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await cancelCounterEntry(formData);
      if (result.success) {
        onClose();
        router.refresh();
        return null;
      }
      return { error: result.error };
    },
    null
  );

  if (!entry) return null;

  return (
    <Dialog open onClose={onClose} title="Cancel Entry">
      <div className="space-y-2">
        <p className="text-xs text-gray-600">
          Entry is preserved with cancelled status. Timestamp will not change.
        </p>
        <div>
          <Label htmlFor="cancel-reason">Reason</Label>
          <select
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as NotebookReversalReasonKey)}
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
          >
            {NOTEBOOK_REVERSAL_REASONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {reason === "OTHER" && (
          <div>
            <Label htmlFor="cancel-other">Details</Label>
            <Input
              id="cancel-other"
              value={reasonOther}
              onChange={(e) => setReasonOther(e.target.value)}
              className="text-xs"
            />
          </div>
        )}
        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        <Button
          type="button"
          variant="danger"
          size="sm"
          fullWidth
          disabled={
            isPending ||
            (reason === "OTHER" && reasonOther.trim().length < 3)
          }
          onClick={() => {
            const formData = new FormData();
            formData.set("entryId", entry.id);
            formData.set("cancellationReason", reason);
            if (reason === "OTHER") {
              formData.set("cancellationReasonOther", reasonOther);
            }
            formAction(formData);
          }}
        >
          {isPending ? "Cancelling..." : "Confirm Cancel"}
        </Button>
      </div>
    </Dialog>
  );
}
