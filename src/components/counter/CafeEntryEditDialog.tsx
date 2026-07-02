"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctCafeEntry } from "@/actions/notebook-entries";
import { entryTypeLabel } from "@/lib/constants/notebook-entry-types";
import type { NotebookEntryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { formatCorrectionHistoryEntry } from "@/lib/utils/entry-corrections";
import { formatCurrency } from "@/lib/utils/format";
import { ENTRY_LOCKED_MESSAGE } from "@/lib/visit-bill/entry-edit-lock-constants";
import { isNotebookEntryEditLocked } from "@/lib/visit-bill/entry-edit-lock-utils";
import { EntryLockIndicator } from "@/components/counter/EntryLockIndicator";

interface CafeEntryEditDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
}

export function CafeEntryEditDialog({ entry, onClose }: CafeEntryEditDialogProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = entry !== null;
  const isFood = entry?.type === "FOOD";

  useEffect(() => {
    if (!open || !entry) return;
    setQuantity(String(entry.quantity ?? 1));
    setAmount(String(entry.amount));
    setItemNote(entry.itemNote ?? "");
    setReason("");
    setError(null);
  }, [open, entry]);

  if (!entry) return null;

  if (isNotebookEntryEditLocked(entry)) {
    return (
      <Dialog open={open} onClose={onClose} title="Item locked">
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <EntryLockIndicator className="mt-0.5 shrink-0" />
            <p className="text-sm text-gray-700">{ENTRY_LOCKED_MESSAGE}</p>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    );
  }

  const submit = () => {
    if (reason.trim().length < 3) {
      setError("Please provide a correction reason");
      return;
    }

    const formData = new FormData();
    formData.set("entryId", entry.id);
    formData.set("correctionReason", reason.trim());

    if (isFood) {
      const nextAmount = Number(amount);
      if (!nextAmount || nextAmount <= 0) {
        setError("Enter a valid amount");
        return;
      }
      if (!itemNote.trim()) {
        setError("Food note is required");
        return;
      }
      if (nextAmount !== entry.amount) {
        formData.set("amount", String(nextAmount));
      }
      if (itemNote.trim() !== (entry.itemNote ?? "").trim()) {
        formData.set("itemNote", itemNote.trim());
      }
    } else {
      const nextQty = Number(quantity);
      if (!nextQty || nextQty < 1) {
        setError("Enter a valid quantity");
        return;
      }
      if (nextQty !== (entry.quantity ?? 1)) {
        formData.set("quantity", String(nextQty));
      }
    }

    startTransition(async () => {
      const result = await correctCafeEntry(formData);
      if (result.success) {
        onClose();
        router.refresh();
        return;
      }
      setError(result.error);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Edit cafe item">
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          {entryTypeLabel(entry.type)} · current {formatCurrency(entry.amount)}
        </p>

        {isFood ? (
          <>
            <div>
              <Label htmlFor="cafe-edit-amount">Amount</Label>
              <Input
                id="cafe-edit-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cafe-edit-note">Note</Label>
              <Input
                id="cafe-edit-note"
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                className="mt-1"
                placeholder="e.g. Chicken Sandwich"
              />
            </div>
          </>
        ) : (
          <div>
            <Label htmlFor="cafe-edit-qty">Quantity</Label>
            <Input
              id="cafe-edit-qty"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
              className="mt-1"
            />
          </div>
        )}

        <div>
          <Label htmlFor="cafe-edit-reason">Reason</Label>
          <Input
            id="cafe-edit-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1"
            placeholder="Why is this being changed?"
          />
        </div>

        {entry.corrections && entry.corrections.length > 0 && (
          <div className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Audit history
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-gray-600">
              {entry.corrections.map((correction, index) => (
                <li key={`${correction.correctedAt}-${index}`}>
                  {formatCorrectionHistoryEntry(correction)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={submit}>
            Save correction
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
