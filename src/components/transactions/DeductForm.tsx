"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deductWallet } from "@/actions/transactions";
import { formatCurrency } from "@/lib/utils/format";
import type { VerificationMethod } from "@/lib/constants/verification";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Dialog";

interface DeductFormProps {
  customerId: string;
  currentBalance: number;
  verificationMethod: VerificationMethod;
}

export function DeductForm({
  customerId,
  currentBalance,
  verificationMethod,
}: DeductFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  const [state, formAction, isPending] = useActionState(
    async (
      _prev: {
        error?: string;
        success?: { balanceAfter: number };
      } | null,
      formData: FormData
    ) => {
      const result = await deductWallet(formData);
      if (result.success) {
        formRef.current?.reset();
        router.refresh();
        return {
          success: { balanceAfter: result.data.balanceAfter },
        };
      }
      return { error: result.error };
    },
    null
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get("amount"));

    if (amount > currentBalance) {
      return;
    }

    setPendingFormData(formData);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    if (pendingFormData) {
      formAction(pendingFormData);
      setShowConfirm(false);
      setPendingFormData(null);
    }
  };

  const confirmAmount = pendingFormData
    ? Number(pendingFormData.get("amount"))
    : 0;
  const confirmDescription =
    pendingFormData?.get("description")?.toString() ?? "";

  return (
    <>
      <Card>
        <CardTitle className="mb-1">Deduct from Wallet</CardTitle>
        <p className="mb-6 text-sm text-gray-500">
          Enter the amount payable by the customer. Current balance:{" "}
          <strong>{formatCurrency(currentBalance)}</strong>
        </p>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="customerId" value={customerId} />
          <input
            type="hidden"
            name="verificationMethod"
            value={verificationMethod}
          />
          <input type="hidden" name="customerConfirmed" value="true" />

          <div>
            <Label htmlFor="amount">Amount Payable (₹)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="1"
              min="1"
              max={currentBalance}
              required
              placeholder="Enter amount"
            />
            {currentBalance === 0 && (
              <p className="mt-2 text-sm text-amber-700">
                Wallet balance is zero. Recharge before deducting.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              required
              placeholder="e.g. Table 2 — 1 hour"
            />
          </div>

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </p>
          )}

          {state?.success && (
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p className="font-medium">Deduction successful</p>
              <p className="mt-1">
                Updated balance:{" "}
                <strong>{formatCurrency(state.success.balanceAfter)}</strong>
              </p>
            </div>
          )}

          <Button
            type="submit"
            variant="danger"
            disabled={isPending || currentBalance === 0}
            fullWidth
            size="lg"
          >
            {isPending ? "Processing..." : "Deduct Amount"}
          </Button>
        </form>
      </Card>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setPendingFormData(null);
        }}
        onConfirm={handleConfirm}
        title="Confirm Deduction"
        message={`Deduct ${formatCurrency(confirmAmount)} for "${confirmDescription}"?`}
        confirmLabel="Yes, Deduct"
        isLoading={isPending}
      />
    </>
  );
}
