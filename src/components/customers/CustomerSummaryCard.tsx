"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { collectCustomerOutstandingAction } from "@/actions/outstanding";
import {
  EntryPaymentFields,
  appendEntryPaymentFormData,
  type RemainderPaymentMode,
} from "@/components/counter/EntryPaymentFields";
import { formatLastVisitLabel } from "@/lib/utils/customer-ledger-display";
import { formatCurrency } from "@/lib/utils/format";
import type { CustomerDTO, CustomerLedgerSummaryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils/cn";
import { CustomerRechargeDialog } from "@/components/customers/CustomerRechargeDialog";

function memberStatusLabel(customer: CustomerDTO): string {
  if (!customer.walletEnabled) return "No";
  return customer.isStudent ? "Student" : "Yes";
}

interface CustomerSummaryCardProps {
  customer: CustomerDTO;
  summary: CustomerLedgerSummaryDTO;
}

export function CustomerSummaryCard({
  customer,
  summary,
}: CustomerSummaryCardProps) {
  const router = useRouter();
  const [collectOpen, setCollectOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<RemainderPaymentMode | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const outstandingAmount = summary.outstandingAmount;
  const walletBalance = summary.walletBalance;
  const parsedAmount = Number.parseInt(receivedAmount, 10) || 0;

  const canCollect =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= outstandingAmount;

  const resetCollectDialog = () => {
    setReceivedAmount("");
    setPaymentMode("");
    setError(null);
  };

  const closeCollectDialog = () => {
    resetCollectDialog();
    setCollectOpen(false);
  };

  const handleCollect = () => {
    if (!canCollect) {
      setError("Enter a valid amount up to the outstanding balance");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("customerId", customer.id);
      const payment = appendEntryPaymentFormData(formData, {
        paidAmount: parsedAmount,
        useWallet: false,
        walletBalance: 0,
        paymentMode,
      });
      if (!payment.ok) {
        setError(payment.error);
        return;
      }
      // Outstanding collect schema uses receivedAmount (not paidAmount).
      formData.set("receivedAmount", String(parsedAmount));

      const result = await collectCustomerOutstandingAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }

      closeCollectDialog();
      router.refresh();
    });
  };

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
            <p className="mt-0.5 text-sm text-gray-500">{customer.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {outstandingAmount > 0 ? (
              <Button
                type="button"
                onClick={() => {
                  resetCollectDialog();
                  setCollectOpen(true);
                }}
              >
                Collect Outstanding
              </Button>
            ) : null}
            {customer.walletEnabled ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRechargeOpen(true)}
                disabled={outstandingAmount > 0}
                title={
                  outstandingAmount > 0
                    ? "Collect outstanding before recharging"
                    : undefined
                }
              >
                Recharge Wallet
              </Button>
            ) : null}
          </div>
        </div>

        <dl className="mt-4 divide-y divide-gray-100 text-sm">
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-gray-500">Outstanding</dt>
            <dd
              className={cn(
                "font-semibold tabular-nums",
                outstandingAmount > 0 ? "text-[#B71C1C]" : "text-gray-900"
              )}
            >
              {formatCurrency(outstandingAmount)}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-gray-500">Wallet Balance</dt>
            <dd className="font-semibold tabular-nums text-violet-700">
              {formatCurrency(walletBalance)}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-gray-500">Member</dt>
            <dd className="font-medium text-gray-900">
              {memberStatusLabel(customer)}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-gray-500">Last Visit</dt>
            <dd className="font-medium text-gray-900">
              {formatLastVisitLabel(summary.lastVisitAt)}
            </dd>
          </div>
        </dl>
      </div>

      <Dialog
        open={collectOpen}
        onClose={closeCollectDialog}
        title="Collect Outstanding"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Outstanding Balance</p>
            <p className="text-2xl font-bold tabular-nums text-[#B71C1C]">
              {formatCurrency(outstandingAmount)}
            </p>
          </div>

          <EntryPaymentFields
            idPrefix="outstanding-collect"
            amount={outstandingAmount}
            paidAmount={receivedAmount}
            paymentMode={paymentMode}
            useWallet={false}
            disabled={isPending}
            walletEnabled={false}
            walletBalance={0}
            onPaidAmountChange={(value) => {
              setReceivedAmount(value);
              setError(null);
            }}
            onPaymentModeChange={(mode) => {
              if (mode === "WALLET") return;
              setPaymentMode(mode);
              setError(null);
            }}
            onUseWalletChange={() => undefined}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={closeCollectDialog}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCollect} disabled={!canCollect || isPending}>
              {isPending ? "Collecting…" : "Collect"}
            </Button>
          </div>
        </div>
      </Dialog>

      <CustomerRechargeDialog
        open={rechargeOpen}
        customerId={customer.id}
        currentBalance={walletBalance}
        outstandingAmount={outstandingAmount}
        onClose={() => setRechargeOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
