"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createOpeningOutstandingAction } from "@/actions/outstanding";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils/format";

interface OpeningOutstandingDialogProps {
  open: boolean;
  customerId: string;
  customerName: string;
  onClose: () => void;
}

export function OpeningOutstandingDialog({
  open,
  customerId,
  customerName,
  onClose,
}: OpeningOutstandingDialogProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsedAmount = Number.parseInt(amount, 10) || 0;
  const canSubmit =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && !isPending;

  const reset = () => {
    setAmount("");
    setReason("");
    setEffectiveDate("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("customerId", customerId);
      formData.set("amount", String(parsedAmount));
      formData.set("reason", reason);
      formData.set("effectiveDate", effectiveDate);

      const result = await createOpeningOutstandingAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }

      handleClose();
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add Opening Outstanding"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Records pre-CPOS debt for <span className="font-medium text-gray-900">{customerName}</span>.
          This does not create a Business Day, Frame, Cafe Order, or Payment.
        </p>

        <div>
          <label
            htmlFor="opening-outstanding-amount"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Amount <span className="text-red-600">*</span>
          </label>
          <Input
            id="opening-outstanding-amount"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={amount}
            disabled={isPending}
            placeholder="e.g. 4500"
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
          />
          {parsedAmount > 0 ? (
            <p className="mt-1 text-xs text-gray-500">
              Will set Outstanding to at least {formatCurrency(parsedAmount)}{" "}
              (plus any existing Business Day Outstanding).
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="opening-outstanding-reason"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Reason <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <Input
            id="opening-outstanding-reason"
            value={reason}
            disabled={isPending}
            maxLength={500}
            placeholder="e.g. Notebook balance before go-live"
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <div>
          <label
            htmlFor="opening-outstanding-effective-date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Effective Date{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <Input
            id="opening-outstanding-effective-date"
            type="date"
            value={effectiveDate}
            disabled={isPending}
            onChange={(event) => setEffectiveDate(event.target.value)}
          />
        </div>

        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Opening Outstanding cannot be edited or deleted after creation. One
          per customer only.
        </p>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? "Saving…" : "Add Opening Outstanding"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
