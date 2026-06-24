"use client";

import type {
  CompactSessionCheckoutLineDTO,
  CustomerDTO,
  SessionCheckoutDetailsDTO,
  SessionOpenTabSummaryDTO,
} from "@/types";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import { formatCurrency } from "@/lib/utils/format";
import {
  formatAssignedCustomers,
  formatCheckoutSessionTitle,
} from "@/lib/utils/session-display";
import { formatSessionTimeRange } from "@/lib/utils/session-timer";
import { Button } from "@/components/ui/Button";
import { CustomerVerification } from "@/components/wallet/CustomerVerification";
import { WalletCustomerConfirmation } from "@/components/wallet/WalletCustomerConfirmation";
import type { VerificationMethod } from "@/lib/constants/verification";
import { cn } from "@/lib/utils/cn";

const PAYMENT_METHODS: { id: NotebookPaymentMethod; label: string }[] = [
  { id: "CASH", label: "Cash" },
  { id: "GPay", label: "GPay" },
  { id: "WALLET", label: "Wallet" },
];

function BillLine({
  label,
  amount,
  muted,
}: {
  label: string;
  amount: number;
  muted?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 text-sm",
        muted && "text-gray-500"
      )}
    >
      <span className={cn("min-w-0 font-medium", !muted && "text-gray-900")}>
        {label}
      </span>
      <span className="shrink-0 font-bold tabular-nums text-gray-900">
        {formatCurrency(amount)}
      </span>
    </li>
  );
}

interface SessionCheckoutPanelProps {
  tab: SessionOpenTabSummaryDTO;
  details: SessionCheckoutDetailsDTO;
  total: number;
  checkoutCustomer: {
    id: string;
    name: string;
    walletEnabled: boolean;
    cardId?: string;
  } | null;
  step: "review" | "confirm" | "wallet-verify" | "wallet-confirm";
  method: NotebookPaymentMethod;
  walletPayer: CustomerDTO | null;
  verificationMethod: VerificationMethod | null;
  error: string | null;
  isPending: boolean;
  onSelectCustomer: () => void;
  onSplitBill: () => void;
  onMethodChange: (method: NotebookPaymentMethod) => void;
  onPayClick: () => void;
  onWalletVerified: (
    customer: CustomerDTO,
    verificationMethod: VerificationMethod
  ) => void;
  onWalletConfirm: () => void;
  onWalletBack: () => void;
  onConfirmPayment: () => void;
  onBackToReview: () => void;
}

export function SessionCheckoutPanel({
  tab,
  details,
  total,
  checkoutCustomer,
  step,
  method,
  walletPayer,
  verificationMethod,
  error,
  isPending,
  onSelectCustomer,
  onSplitBill,
  onMethodChange,
  onPayClick,
  onWalletVerified,
  onWalletConfirm,
  onWalletBack,
  onConfirmPayment,
  onBackToReview,
}: SessionCheckoutPanelProps) {
  const { session, timeline } = details;
  const assignedLabel = checkoutCustomer
    ? checkoutCustomer.name
    : formatAssignedCustomers(session.assignedCustomerNames);
  const title = formatCheckoutSessionTitle(
    tab.tableId,
    tab.tableSessionNumber
  );
  const endedAt = session.endedAt ?? session.startedAt;
  const cafeLines = timeline.filter(
    (line): line is Extract<CompactSessionCheckoutLineDTO, { kind: "cafe" }> =>
      line.kind === "cafe"
  );

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        <li className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-gray-900">{title}</span>
            <span className="shrink-0 font-bold tabular-nums text-gray-900">
              {formatCurrency(tab.gameAmount)}
            </span>
          </div>
          <p className="mt-0.5 text-xs tabular-nums text-gray-500">
            {formatSessionTimeRange(
              session.startedAt,
              endedAt,
              session.activePlayMs
            )}
          </p>
        </li>
        {cafeLines.map((line, index) => (
          <BillLine
            key={`cafe-${line.at}-${index}`}
            label={line.label}
            amount={line.amount}
          />
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Customer
          </p>
          <p className="text-sm font-medium text-gray-900">{assignedLabel}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-checkout-action="select-customer"
            onClick={onSelectCustomer}
          >
            {checkoutCustomer ? "Change" : "Select"}
          </Button>
          {tab.tableId !== "MINI_SNOOKER" && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onSplitBill}
            >
              Split
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5">
        <span className="text-sm font-semibold text-gray-700">Total due</span>
        <span className="text-lg font-bold tabular-nums text-gray-900">
          {formatCurrency(total)}
        </span>
      </div>

      {step === "review" && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onMethodChange(option.id)}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors",
                  method === option.id
                    ? "border-emerald-700 bg-emerald-800 text-white shadow-sm"
                    : "border-gray-300 bg-white text-gray-800 hover:border-gray-400 hover:bg-gray-50"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            fullWidth
            size="lg"
            className="text-base"
            data-checkout-action="pay"
            disabled={!checkoutCustomer}
            onClick={onPayClick}
          >
            Pay {formatCurrency(total)}
          </Button>
        </div>
      )}

      {step === "wallet-verify" && checkoutCustomer && (
        <CustomerVerification
          initialCardId={
            checkoutCustomer.walletEnabled
              ? checkoutCustomer.cardId
              : undefined
          }
          onVerified={onWalletVerified}
        />
      )}

      {step === "wallet-confirm" && walletPayer && verificationMethod && (
        <WalletCustomerConfirmation
          customer={walletPayer}
          verificationMethod={verificationMethod}
          onConfirm={onWalletConfirm}
          onBack={onWalletBack}
        />
      )}

      {step === "confirm" && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-sm font-semibold text-gray-900">Confirm payment</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Customer</dt>
              <dd className="font-medium text-gray-900">
                {checkoutCustomer?.name ?? title}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Method</dt>
              <dd className="font-medium text-gray-900">
                {method === "CASH"
                  ? "Cash"
                  : method === "GPAY"
                    ? "GPay"
                    : "Wallet"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-gray-100 pt-2">
              <dt className="font-semibold text-gray-700">Amount</dt>
              <dd className="text-base font-bold tabular-nums text-gray-900">
                {formatCurrency(total)}
              </dd>
            </div>
          </dl>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              fullWidth
              size="lg"
              disabled={isPending}
              onClick={onConfirmPayment}
            >
              {isPending ? "Processing…" : "Confirm payment"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              onClick={onBackToReview}
            >
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
