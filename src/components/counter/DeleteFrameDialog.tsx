"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { deleteFrame } from "@/actions/notebook-entries";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import { formatCurrency } from "@/lib/utils/format";
import type { NotebookEntryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface DeleteFrameDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
}

export function DeleteFrameDialog({ entry, onClose }: DeleteFrameDialogProps) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await deleteFrame(formData);
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

  const isSplit = entryHasContributors(entry);
  const gameLabel = getEntryDisplayLabel(entry);
  const contributors = entry.contributors ?? [];

  return (
    <Dialog open onClose={onClose} title="Delete Frame?">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          This removes the frame from today&apos;s notebook. It cannot be undone
          after the Business Day closes.
        </p>

        <dl className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Game</dt>
            <dd className="font-semibold text-gray-900">{gameLabel}</dd>
          </div>

          {isSplit ? (
            <>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Total Amount</dt>
                <dd className="font-bold tabular-nums text-gray-900">
                  {formatCurrency(entry.amount)}
                </dd>
              </div>
              <div className="border-t border-gray-200 pt-2">
                <dt className="mb-1.5 text-gray-500">Contributors</dt>
                <dd>
                  <ul className="space-y-1">
                    {contributors.map((row) => (
                      <li
                        key={row.customerId}
                        className="flex justify-between gap-3 text-gray-900"
                      >
                        <span className="font-medium">{row.customerName}</span>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(row.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Customer</dt>
                <dd className="font-semibold text-gray-900">
                  {entry.isUnassigned || !entry.customerName
                    ? "Unassigned"
                    : entry.customerName}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Amount</dt>
                <dd className="font-bold tabular-nums text-gray-900">
                  {formatCurrency(entry.amount)}
                </dd>
              </div>
            </>
          )}
        </dl>

        {isSplit ? (
          <p className="text-xs text-orange-700">
            Deleting this frame will remove all split contributions.
          </p>
        ) : null}

        {state?.error ? (
          <p className="text-xs text-red-600">{state.error}</p>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            fullWidth
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            fullWidth
            disabled={isPending}
            onClick={() => {
              const formData = new FormData();
              formData.set("entryId", entry.id);
              formAction(formData);
            }}
          >
            {isPending ? "Deleting..." : "Delete Frame"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
