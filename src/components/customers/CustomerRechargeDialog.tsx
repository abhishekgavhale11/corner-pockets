"use client";

import { useMemo, useState, useTransition } from "react";
import { rechargeCustomerWalletAction } from "@/actions/transactions";
import {
  RECHARGE_AMOUNT_PRESETS,
  RECHARGE_OFFER_LABELS,
  resolveRechargeCredit,
} from "@/lib/wallet/recharge-credit";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface CustomerRechargeDialogProps {
  open: boolean;
  customerId: string;
  currentBalance: number;
  outstandingAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function CustomerRechargeDialog({
  open,
  customerId,
  currentBalance,
  outstandingAmount,
  onClose,
  onSuccess,
}: CustomerRechargeDialogProps) {
  const [preset, setPreset] = useState<number | "custom" | null>(3000);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "GPAY">("CASH");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const blockedByOutstanding = outstandingAmount > 0;

  const paidAmount = useMemo(() => {
    if (preset === "custom") {
      return Number.parseInt(customAmount, 10) || 0;
    }
    return preset ?? 0;
  }, [preset, customAmount]);

  const credit = useMemo(() => resolveRechargeCredit(paidAmount), [paidAmount]);

  const canSave = paidAmount > 0 && !blockedByOutstanding;

  const handleSave = () => {
    if (blockedByOutstanding) {
      setError(
        "Please collect the customer's outstanding before recharging the wallet."
      );
      return;
    }
    if (!canSave) {
      setError("Enter a recharge amount");
      return;
    }
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("customerId", customerId);
      formData.set("paidAmount", String(paidAmount));
      formData.set("paymentMethod", paymentMethod);
      const result = await rechargeCustomerWalletAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSuccess();
      onClose();
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Recharge Wallet">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-500">Current Wallet Balance</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900">
            {formatCurrency(currentBalance)}
          </p>
        </div>

        {blockedByOutstanding ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
            Please collect the customer&apos;s outstanding before recharging the
            wallet.
          </div>
        ) : (
          <>
            <div>
              <Label>Amount</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {RECHARGE_AMOUNT_PRESETS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => {
                      setPreset(amount);
                      setError(null);
                    }}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-sm font-semibold tabular-nums",
                      preset === amount
                        ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPreset("custom");
                    setError(null);
                  }}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-sm font-semibold",
                    preset === "custom"
                      ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  )}
                >
                  Custom
                </button>
              </div>
              {preset === "custom" ? (
                <Input
                  className="mt-2"
                  inputMode="numeric"
                  placeholder="Enter amount (no bonus)"
                  value={customAmount}
                  onChange={(event) =>
                    setCustomAmount(event.target.value.replace(/[^\d]/g, ""))
                  }
                />
              ) : null}
            </div>

            <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
                Current Offers
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-amber-950">
                {RECHARGE_OFFER_LABELS.map((offer) => (
                  <li key={offer.paid}>
                    {formatCurrency(offer.paid)} →{" "}
                    {formatCurrency(offer.credited)}
                  </li>
                ))}
                <li className="text-amber-800/80">Custom Amount (No Bonus)</li>
              </ul>
            </div>

            {paidAmount > 0 ? (
              <dl className="grid grid-cols-3 gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm">
                <div>
                  <dt className="text-[11px] text-gray-500">Paid</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatCurrency(credit.paidAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-gray-500">Bonus</dt>
                  <dd className="font-semibold tabular-nums text-emerald-800">
                    {formatCurrency(credit.bonusAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-gray-500">Wallet Credit</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatCurrency(credit.creditedAmount)}
                  </dd>
                </div>
              </dl>
            ) : null}

            <div>
              <Label>Payment Method</Label>
              <div className="mt-1.5 flex gap-2">
                {(["CASH", "GPAY"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold",
                      paymentMethod === method
                        ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {method === "CASH" ? "Cash" : "GPay"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            fullWidth
            disabled={!canSave || isPending}
            onClick={handleSave}
          >
            {isPending ? "Saving..." : "Recharge"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
