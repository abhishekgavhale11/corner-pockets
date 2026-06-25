"use client";

import { getPlansForCustomer } from "@/lib/constants/recharge-plans";
import { verificationMethodForKnownCustomer } from "@/lib/constants/verification";
import { formatCurrency } from "@/lib/utils/format";
import type { CustomerDTO } from "@/types";
import { RechargeForm } from "@/components/transactions/RechargeForm";
import { Button } from "@/components/ui/Button";

interface RechargeDialogProps {
  customer: CustomerDTO;
  open: boolean;
  onClose: () => void;
}

export function RechargeDialog({
  customer,
  open,
  onClose,
}: RechargeDialogProps) {
  if (!open) return null;

  const plans = getPlansForCustomer(customer.isStudent);
  const walletLabel = customer.isStudent ? "Student Wallet" : "Club Wallet";
  const verificationMethod = verificationMethodForKnownCustomer(customer);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="recharge-dialog-title"
        className="relative z-10 flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="shrink-0 border-b border-gray-100 px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="recharge-dialog-title"
                className="text-lg font-bold text-gray-900"
              >
                Recharge wallet
              </h2>
              <p className="mt-0.5 truncate text-sm text-gray-600">
                {customer.name}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Balance:{" "}
                <span className="font-semibold text-emerald-800">
                  {formatCurrency(customer.balance)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <span className="text-lg leading-none">✕</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <RechargeForm
            customerId={customer.id}
            plans={plans}
            walletLabel={walletLabel}
            verificationMethod={verificationMethod}
            embedded
            onSuccess={onClose}
          />
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-3">
          <Button
            type="button"
            variant="secondary"
            className="h-10 w-full text-sm font-semibold"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
