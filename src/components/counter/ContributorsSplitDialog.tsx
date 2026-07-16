"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEntryContributors } from "@/actions/notebook-entries";
import type { NotebookEntryDTO } from "@/types";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import {
  ContributorsSplitFields,
  validateContributorRows,
  type ContributorRow,
} from "@/components/counter/ContributorsSplitFields";
import { invalidateCustomerGlanceCache } from "@/components/counter/CustomerPreviewContext";
import {
  FRAME_PARTIAL_LOCK_REASSIGN_HINT,
  isContributorAssignmentLocked,
  frameHasPartialPaymentLock,
  splitEntryHasEditableContributor,
} from "@/lib/visit-bill/entry-edit-lock-utils";
import { VISIT_FINISHED_LOCK_MESSAGE } from "@/lib/visit-bill/entry-edit-lock-constants";

interface ContributorsSplitDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
}

export function ContributorsSplitDialog({
  entry,
  onClose,
}: ContributorsSplitDialogProps) {
  const router = useRouter();
  const [rows, setRows] = useState<ContributorRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = entry !== null;
  const entryId = entry?.id;

  const entryFullyLocked = entry
    ? !splitEntryHasEditableContributor({
        status: entry.status,
        visitStatus: entry.visitStatus,
        paidAmount: entry.paidAmount,
        balanceCollectedAmount: entry.balanceCollectedAmount,
        contributors: entry.contributors,
      })
    : false;

  const partiallyLocked = entry
    ? frameHasPartialPaymentLock({
        status: entry.status,
        visitStatus: entry.visitStatus,
        paidAmount: entry.paidAmount,
        balanceCollectedAmount: entry.balanceCollectedAmount,
        contributors: entry.contributors,
      })
    : false;

  const lockedRowIndexes = useMemo(() => {
    if (!entry?.contributors?.length) {
      return [];
    }
    return entry.contributors.reduce<number[]>((indexes, contributor, index) => {
      if (
        isContributorAssignmentLocked({
          status: contributor.status,
          visitStatus: contributor.visitStatus,
          paidAmount: contributor.paidAmount,
          balanceCollectedAmount: contributor.balanceCollectedAmount,
        })
      ) {
        indexes.push(index);
      }
      return indexes;
    }, []);
  }, [entry]);

  useEffect(() => {
    if (!open || !entryId || !entry) return;
    if (entry.contributors?.length) {
      setRows(
        entry.contributors.map((contributor) => ({
          customerId: contributor.customerId,
          customerName: contributor.customerName,
          amount: String(contributor.amount),
        }))
      );
    } else {
      setRows([]);
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entry data read on open/entryId change only
  }, [open, entryId]);

  const submit = () => {
    if (!entry || entryFullyLocked) return;

    const contributorError = validateContributorRows(rows, entry.amount, {
      requireAtLeastOne: true,
    });
    if (contributorError) {
      setError(contributorError);
      return;
    }

    const contributors = rows.map((row) => ({
      customerId: row.customerId,
      amount: Number.parseInt(row.amount, 10),
    }));

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("entryId", entry.id);
      formData.set("contributors", JSON.stringify(contributors));
      const result = await setEntryContributors(formData);
      if (result.success) {
        invalidateCustomerGlanceCache();
        router.refresh();
        onClose();
        return;
      }
      setError(result.error);
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={partiallyLocked ? "Reassign Split" : "Edit Split"}
    >
      {entry && (
        <div className="space-y-3">
          {entryFullyLocked ? (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {entry.contributors?.every(
                (contributor) => contributor.visitStatus === "FINISHED"
              )
                ? VISIT_FINISHED_LOCK_MESSAGE
                : "All contributors on this frame are locked."}
            </p>
          ) : partiallyLocked ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {FRAME_PARTIAL_LOCK_REASSIGN_HINT}
            </p>
          ) : null}
          <p className="text-sm text-gray-600">
            Total {formatCurrency(entry.amount)}
          </p>

          <ContributorsSplitFields
            totalAmount={entry.amount}
            rows={rows}
            onRowsChange={setRows}
            disabled={isPending || entryFullyLocked}
            lockedRowIndexes={lockedRowIndexes}
            partiallyLocked={partiallyLocked}
          />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              type="button"
              fullWidth
              disabled={isPending || entryFullyLocked}
              onClick={submit}
            >
              {isPending ? "Saving..." : partiallyLocked ? "Save" : "Save Split"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
