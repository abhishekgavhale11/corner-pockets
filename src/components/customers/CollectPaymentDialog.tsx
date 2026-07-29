"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { recordCustomerBalancePayment } from "@/actions/customer-balance-payments";
import { CUSTOMER_PAGE_PAYMENT_BLOCK_MESSAGE } from "@/lib/constants/customer-page-payments";
import { formatCurrency } from "@/lib/utils/format";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils/cn";

const PAYMENT_METHODS: { id: NotebookPaymentMethod; label: string }[] = [
  { id: "CASH", label: "Cash" },
  { id: "GPAY", label: "GPay" },
];

interface CollectPaymentDialogProps {
  customer: Pick<CustomerDTO, "id" | "name" | "cardId" | "phone">;
  outstandingAmount: number;
  open: boolean;
  onClose: () => void;
  paymentBlocked?: boolean;
}

export function CollectPaymentDialog({
  customer,
  outstandingAmount,
  open,
  onClose,
  paymentBlocked = false,
}: CollectPaymentDialogProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<NotebookPaymentMethod>("CASH");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setAmount("");
    setMethod("CASH");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    if (paymentBlocked) {
      onClose();
    }
  }, [open, paymentBlocked, onClose]);

  const canSave = Number.parseInt(amount, 10) > 0;

  const save = () => {
    if (paymentBlocked) {
      setError(CUSTOMER_PAGE_PAYMENT_BLOCK_MESSAGE);
      return;
    }

    const parsedAmount = Number.parseInt(amount, 10);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("customerId", customer.id);
      formData.set("amount", String(parsedAmount));
      formData.set("paymentMethod", method);

      const result = await recordCustomerBalancePayment(formData);
      if (result.success) {
        handleClose();
        router.refresh();
        return;
      }
      setError(result.error);
    });
  };

  if (!open || paymentBlocked) {
    return null;
  }

  return (
    <Dialog open={open} onClose={handleClose} title={`Collect Payment — ${customer.name}`}>
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-red-800">
            Outstanding
          </p>
          <p className="text-xl font-bold text-red-900">
            {formatCurrency(outstandingAmount)}
          </p>
        </div>

        <div>
          <Label htmlFor="collect-amount">Amount Received</Label>
          <Input
            id="collect-amount"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={amount}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "");
              if (!digits) {
                setAmount("");
                return;
              }
              setAmount(digits);
            }}
            placeholder="0"
            className="mt-1 text-lg font-semibold"
            autoFocus
          />
        </div>

        <div>
          <Label>Payment Method</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setMethod(option.id);
                  setError(null);
                }}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                  method === option.id
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-gray-300 bg-white text-gray-800 hover:border-emerald-400"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            onClick={save}
            disabled={!canSave || isPending}
            fullWidth
          >
            {isPending ? "Saving…" : "Save Payment"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
