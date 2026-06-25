"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { rechargeWallet } from "@/actions/transactions";
import {
  getBonusAmount,
  type RechargePlan,
} from "@/lib/constants/recharge-plans";
import { formatCurrency } from "@/lib/utils/format";
import type { VerificationMethod } from "@/lib/constants/verification";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";

interface RechargeFormProps {
  customerId: string;
  plans: RechargePlan[];
  walletLabel: string;
  verificationMethod: VerificationMethod;
  embedded?: boolean;
  onSuccess?: () => void;
}

export function RechargeForm({
  customerId,
  plans,
  walletLabel,
  verificationMethod,
  embedded = false,
  onSuccess,
}: RechargeFormProps) {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);

  const [state, formAction, isPending] = useActionState(
    async (
      _prev: {
        error?: string;
        success?: { balanceAfter: number };
      } | null,
      formData: FormData
    ) => {
      const result = await rechargeWallet(formData);
      if (result.success) {
        setFormKey((k) => k + 1);
        router.refresh();
        onSuccess?.();
        return {
          success: { balanceAfter: result.data.balanceAfter },
        };
      }
      return { error: result.error };
    },
    null
  );

  const form = (
    <form key={formKey} action={formAction} className="space-y-4">
      <input type="hidden" name="customerId" value={customerId} />
      <input
        type="hidden"
        name="verificationMethod"
        value={verificationMethod}
      />
      <input type="hidden" name="customerConfirmed" value="true" />

      <p className="text-sm font-medium text-gray-700">Select a plan</p>
      <div className="grid gap-3">
        {plans.map((plan) => {
          const bonusAmount = getBonusAmount(plan);

          return (
            <label
              key={plan.key}
              className="flex cursor-pointer flex-col gap-3 rounded-lg border border-gray-200 p-4 transition-colors has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="planKey"
                  value={plan.key}
                  required
                  className="mt-1 h-5 w-5 accent-emerald-800"
                />
                <div>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(plan.paidAmount)}
                  </p>
                  <div className="mt-1 space-y-1 text-sm text-gray-600">
                    <p>
                      Paid:{" "}
                      <span className="font-medium text-gray-900">
                        {formatCurrency(plan.paidAmount)}
                      </span>
                    </p>
                    <p>
                      Bonus:{" "}
                      <span className="font-medium text-emerald-700">
                        {formatCurrency(bonusAmount)}
                      </span>
                    </p>
                    <p>
                      Credited:{" "}
                      <span className="font-medium text-emerald-800">
                        {formatCurrency(plan.creditedAmount)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state?.success && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-medium">Recharge successful</p>
          <p className="mt-1">
            Updated balance:{" "}
            <strong>{formatCurrency(state.success.balanceAfter)}</strong>
          </p>
        </div>
      )}

      <Button type="submit" disabled={isPending} fullWidth size="lg">
        {isPending ? "Processing..." : "Confirm Recharge"}
      </Button>
    </form>
  );

  if (embedded) {
    return (
      <div>
        <p className="mb-4 text-sm text-gray-500">
          {walletLabel} — paid, bonus, and credited amounts are calculated
          automatically.
        </p>
        {form}
      </div>
    );
  }

  return (
    <Card>
      <CardTitle className="mb-1">Recharge Wallet</CardTitle>
      <p className="mb-6 text-sm text-gray-500">
        {walletLabel} — paid, bonus, and credited amounts are calculated
        automatically.
      </p>
      {form}
    </Card>
  );
}
