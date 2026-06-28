"use client";

import type {
  CompactSessionCheckoutLineDTO,
  CustomerDTO,
  SessionCheckoutDetailsDTO,
  SessionOpenTabSummaryDTO,
} from "@/types";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import {
  formatAssignedCustomers,
  formatCheckoutSessionTitle,
} from "@/lib/utils/session-display";
import { formatSessionTimeRange } from "@/lib/utils/session-timer";
import { Button } from "@/components/ui/Button";
import { CustomerVerification } from "@/components/wallet/CustomerVerification";
import { WalletCustomerConfirmation } from "@/components/wallet/WalletCustomerConfirmation";
import type { VerificationMethod } from "@/lib/constants/verification";
import {
  CheckoutPaymentReview,
  PaymentConfirmPanel,
  parseCheckoutPayAmount,
} from "@/components/checkout/checkout-payment";
import {
  BillLineRow,
  CheckoutBillDetailsCard,
  CompactBillGroup,
} from "@/components/checkout/checkout-bill-lines";

interface SessionCheckoutPanelProps {
  tab: SessionOpenTabSummaryDTO;
  details: SessionCheckoutDetailsDTO;
  total: number;
  priorBalance?: number;
  payAmount: string;
  onPayAmountChange: (value: string) => void;
  walletBalance?: number | null;
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
  onAddToBalance?: () => void;
  addToBalanceDisabled?: boolean;
  addToBalanceHint?: string | null;
}

export function SessionCheckoutPanel({
  tab,
  details,
  total,
  priorBalance = 0,
  payAmount,
  onPayAmountChange,
  walletBalance,
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
  onAddToBalance,
  addToBalanceDisabled,
  addToBalanceHint,
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
  const gameLine = timeline.find(
    (line): line is Extract<CompactSessionCheckoutLineDTO, { kind: "game" }> =>
      line.kind === "game"
  );
  const cafeLines = timeline.filter(
    (line): line is Extract<CompactSessionCheckoutLineDTO, { kind: "cafe" }> =>
      line.kind === "cafe"
  );
  const received = parseCheckoutPayAmount(payAmount);

  const billDetails =
    gameLine || cafeLines.length > 0 ? (
      <CheckoutBillDetailsCard>
        <CompactBillGroup title={title}>
          {gameLine ? (
            <li>
              <BillLineRow
                label="Table time"
                amount={gameLine.amount}
                note={formatSessionTimeRange(
                  session.startedAt,
                  endedAt,
                  session.activePlayMs
                )}
              />
            </li>
          ) : null}
          {cafeLines.map((line, index) => (
            <li key={`cafe-${line.at}-${index}`}>
              <BillLineRow label={line.label} amount={line.amount} />
            </li>
          ))}
        </CompactBillGroup>
      </CheckoutBillDetailsCard>
    ) : null;

  return (
    <div className="space-y-4">
      {step === "review" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Customer
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">
                {assignedLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                data-checkout-action="select-customer"
                onClick={onSelectCustomer}
              >
                {checkoutCustomer ? "Change" : "Select customer"}
              </Button>
              {tab.tableId !== "MINI_SNOOKER" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={onSplitBill}
                >
                  Split bill
                </Button>
              ) : null}
            </div>
          </div>

          <CheckoutPaymentReview
            total={total}
            priorBalance={priorBalance}
            payAmount={payAmount}
            onPayAmountChange={onPayAmountChange}
            method={method}
            onMethodChange={onMethodChange}
            walletBalance={walletBalance}
            walletEnabled={checkoutCustomer?.walletEnabled}
            onPayClick={onPayClick}
            payDisabled={!checkoutCustomer || received <= 0}
            onAddToBalance={onAddToBalance}
            addToBalanceDisabled={addToBalanceDisabled}
            addToBalanceHint={addToBalanceHint}
            checkoutMode="new-bill"
            billDetails={billDetails}
            error={error}
            isPending={isPending}
          />
        </>
      ) : null}

      {step === "wallet-verify" && checkoutCustomer ? (
        <CustomerVerification
          initialCardId={
            checkoutCustomer.walletEnabled ? checkoutCustomer.cardId : undefined
          }
          onVerified={onWalletVerified}
        />
      ) : null}

      {step === "wallet-confirm" && walletPayer && verificationMethod ? (
        <WalletCustomerConfirmation
          customer={walletPayer}
          verificationMethod={verificationMethod}
          onConfirm={onWalletConfirm}
          onBack={onWalletBack}
        />
      ) : null}

      {step === "confirm" ? (
        <PaymentConfirmPanel
          customerName={checkoutCustomer?.name ?? title}
          method={method}
          totalDue={total}
          payAmount={received > 0 ? received : total}
          error={error}
          isPending={isPending}
          onConfirm={onConfirmPayment}
          onBack={onBackToReview}
        />
      ) : null}
    </div>
  );
}
