"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctCafeEntry } from "@/actions/notebook-entries";
import { entryTypeLabel } from "@/lib/constants/notebook-entry-types";
import type { NotebookEntryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  EntryPaymentFields,
  appendEntryPaymentFormData,
  resolveEntryPaymentSubmit,
  type EntryPaymentMode,
} from "@/components/counter/EntryPaymentFields";
import { formatCorrectionHistoryEntry } from "@/lib/utils/entry-corrections";
import { formatCurrency } from "@/lib/utils/format";
import { framePaidAmount } from "@/lib/utils/frame-payment";

interface CafeEntryEditDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
}

export function CafeEntryEditDialog({ entry, onClose }: CafeEntryEditDialogProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [paymentMode, setPaymentMode] = useState<EntryPaymentMode | "">("");
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
    setPaidAmount(String(framePaidAmount(entry.paidAmount)));
    setPaymentMode(
      entry.paymentMethod === "CASH" || entry.paymentMethod === "GPAY"
        ? entry.paymentMethod
        : ""
    );
    setReason("");
    setError(null);
  }, [open, entry]);

  const effectiveAmount = useMemo(() => {
    if (!entry) return 0;
    if (isFood) {
      return Number.parseInt(amount, 10) || 0;
    }
    const nextQty = Number.parseInt(quantity, 10) || 1;
    const unitPrice =
      entry.unitPrice ??
      (entry.quantity ? entry.amount / entry.quantity : entry.amount);
    return unitPrice * nextQty;
  }, [entry, isFood, amount, quantity]);

  if (!entry) return null;

  const submit = () => {
    const formData = new FormData();
    formData.set("entryId", entry.id);

    let contentChanged = false;

    if (isFood) {
      const nextAmount = Number.parseInt(amount, 10);
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
        contentChanged = true;
      }
      if (itemNote.trim() !== (entry.itemNote ?? "").trim()) {
        formData.set("itemNote", itemNote.trim());
        contentChanged = true;
      }
    } else {
      const nextQty = Number.parseInt(quantity, 10);
      if (!nextQty || nextQty < 1) {
        setError("Enter a valid quantity");
        return;
      }
      if (nextQty !== (entry.quantity ?? 1)) {
        formData.set("quantity", String(nextQty));
        contentChanged = true;
      }
    }

    const parsedPaid = Number.parseInt(paidAmount, 10) || 0;
    if (parsedPaid > effectiveAmount) {
      setError("Received amount cannot exceed item amount");
      return;
    }
    const paymentCheck = resolveEntryPaymentSubmit({
      paidAmount: parsedPaid,
      paymentMode,
    });
    if (!paymentCheck.valid) {
      setError(paymentCheck.error ?? "Select Cash or GPay");
      return;
    }

    const paymentFields = appendEntryPaymentFormData(formData, {
      paidAmount: parsedPaid,
      paymentMode,
    });
    if (!paymentFields.ok) {
      setError(paymentFields.error);
      return;
    }

    if (contentChanged) {
      if (reason.trim().length < 3) {
        setError("Please provide a correction reason");
        return;
      }
      formData.set("correctionReason", reason.trim());
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
          {entryTypeLabel(entry.type)} · {formatCurrency(entry.amount)}
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

        <EntryPaymentFields
          idPrefix="cafe-edit"
          amount={effectiveAmount}
          paidAmount={paidAmount}
          paymentMode={paymentMode}
          disabled={isPending}
          onPaidAmountChange={(value) => {
            setPaidAmount(value);
            setError(null);
          }}
          onPaymentModeChange={(value) => {
            setPaymentMode(value);
            setError(null);
          }}
        />

        <div>
          <Label htmlFor="cafe-edit-reason">
            Reason{" "}
            <span className="font-normal text-gray-400">
              (required for qty/amount changes)
            </span>
          </Label>
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
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
