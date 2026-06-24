"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { reverseNotebookEntry } from "@/actions/notebook-entries";
import { entryTypeLabel } from "@/lib/constants/notebook-entry-types";
import { NOTEBOOK_REVERSAL_REASONS } from "@/lib/constants/notebook-payments";
import type { NotebookReversalReasonKey } from "@/lib/constants/notebook-payments";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";
import type { CustomerDTO, NotebookEntryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface TabDetailProps {
  customer: CustomerDTO;
  entries: NotebookEntryDTO[];
}

export function TabDetail({ customer, entries }: TabDetailProps) {
  const router = useRouter();
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const [reverseEntryId, setReverseEntryId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] =
    useState<NotebookReversalReasonKey>("WRONG_AMOUNT");
  const [reversalReasonOther, setReversalReasonOther] = useState("");

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await reverseNotebookEntry(formData);
      if (result.success) {
        setReverseEntryId(null);
        router.refresh();
        return null;
      }
      return { error: result.error };
    },
    null
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle className="mb-2">{customer.name}</CardTitle>
        <p className="text-sm text-gray-600">
          {formatCustomerContactLine(customer)}
        </p>
        <p className="mt-4 text-3xl font-bold text-emerald-800">
          {formatCurrency(total)}
        </p>
        <p className="text-sm text-gray-500">Total pending</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href={`/notebook`} className="flex-1">
            <Button fullWidth variant="secondary">
              Add Entry
            </Button>
          </Link>
          <Link
            href={`/notebook/tabs/${customer.id}/settle`}
            className="flex-1"
          >
            <Button fullWidth disabled={entries.length === 0}>
              Settle Payment
            </Button>
          </Link>
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-4">Pending Entries</CardTitle>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">No pending entries.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {sectionLabel(entry.section)} — {entryTypeLabel(entry.type)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(entry.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(entry.amount)}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onClick={() => setReverseEntryId(entry.id)}
                  >
                    Reverse
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {reverseEntryId && (
        <Dialog open onClose={() => setReverseEntryId(null)} title="Reverse Entry">
          <div className="space-y-4">
            <div>
              <Label htmlFor="entry-reversal-reason">Reason</Label>
              <select
                id="entry-reversal-reason"
                value={reversalReason}
                onChange={(e) =>
                  setReversalReason(e.target.value as NotebookReversalReasonKey)
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3"
              >
                {NOTEBOOK_REVERSAL_REASONS.map((reason) => (
                  <option key={reason.key} value={reason.key}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>
            {reversalReason === "OTHER" && (
              <div>
                <Label htmlFor="entry-reversal-other">Details</Label>
                <Input
                  id="entry-reversal-other"
                  value={reversalReasonOther}
                  onChange={(e) => setReversalReasonOther(e.target.value)}
                />
              </div>
            )}
            {state?.error && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}
            <Button
              type="button"
              variant="danger"
              fullWidth
              disabled={isPending}
              onClick={() => {
                const formData = new FormData();
                formData.set("entryId", reverseEntryId);
                formData.set("reversalReason", reversalReason);
                if (reversalReason === "OTHER") {
                  formData.set("reversalReasonOther", reversalReasonOther);
                }
                formAction(formData);
              }}
            >
              {isPending ? "Reversing..." : "Confirm Reverse"}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
