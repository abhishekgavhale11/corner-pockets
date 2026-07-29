"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEntryContributors } from "@/actions/notebook-entries";
import type { NotebookEntryDTO } from "@/types";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import {
  ContributorsSplitFields,
  contributorRowsToPayload,
  validateContributorRows,
  type ContributorRow,
} from "@/components/counter/ContributorsSplitFields";
import { invalidateCustomerGlanceCache } from "@/components/counter/CustomerPreviewContext";

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

  useEffect(() => {
    if (!open || !entryId || !entry) return;
    if (entry.contributors?.length) {
      setRows(
        entry.contributors.map((contributor) => ({
          customerId: contributor.customerId,
          customerName: contributor.customerName,
          amount: String(contributor.amount),
          paidAmount: String(contributor.paidAmount ?? 0),
          paymentMethod:
            contributor.paymentMethod === "CASH" ||
            contributor.paymentMethod === "GPAY"
              ? contributor.paymentMethod
              : "",
        }))
      );
    } else {
      setRows([]);
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entry data read on open/entryId change only
  }, [open, entryId]);

  const submit = () => {
    if (!entry) return;

    const contributorError = validateContributorRows(rows, entry.amount, {
      requireAtLeastOne: true,
    });
    if (contributorError) {
      setError(contributorError);
      return;
    }

    const contributors = contributorRowsToPayload(rows);

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
    <Dialog open={open} onClose={onClose} title="Edit Split">
      {entry && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Total {formatCurrency(entry.amount)}
          </p>

          <ContributorsSplitFields
            totalAmount={entry.amount}
            rows={rows}
            onRowsChange={setRows}
            disabled={isPending}
          />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              type="button"
              fullWidth
              disabled={isPending}
              onClick={submit}
            >
              {isPending ? "Saving..." : "Save Split"}
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
