"use client";

import { useEffect, type ReactNode } from "react";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { NotebookSettlementDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/utils/cn";

export const CHECKOUT_PAYMENT_METHODS: {
  value: NotebookPaymentMethod;
  label: string;
}[] = [
  { value: "CASH", label: "Cash" },
  { value: "GPAY", label: "GPay" },
  { value: "WALLET", label: "Wallet" },
];

export function paymentMethodLabel(method: NotebookPaymentMethod): string {
  return (
    CHECKOUT_PAYMENT_METHODS.find((option) => option.value === method)?.label ??
    method
  );
}

export function parseCheckoutPayAmount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

interface PaymentMethodSelectorProps {
  value: NotebookPaymentMethod;
  onChange: (method: NotebookPaymentMethod) => void;
  walletEnabled?: boolean;
  compact?: boolean;
  large?: boolean;
}

export function PaymentMethodSelector({
  value,
  onChange,
  walletEnabled,
  compact = false,
  large = false,
}: PaymentMethodSelectorProps) {
  const walletDisabled = walletEnabled === false;

  useEffect(() => {
    if (walletDisabled && value === "WALLET") {
      onChange("CASH");
    }
  }, [walletDisabled, value, onChange]);

  const methodOptions = CHECKOUT_PAYMENT_METHODS.map((option) => ({
    ...option,
    disabled: option.value === "WALLET" ? walletDisabled : false,
  }));

  const content = (
    <>
      <p
        className={cn(
          "font-semibold text-gray-600",
          large ? "text-sm" : "text-xs"
        )}
      >
        Payment method
      </p>
      <SegmentedControl
        ariaLabel="Payment method"
        value={value}
        options={methodOptions}
        onChange={onChange}
        className={
          large
            ? "gap-2 border-gray-200 bg-white p-1.5"
            : undefined
        }
        buttonClassName={
          large ? "min-h-[44px] text-sm font-semibold" : undefined
        }
      />
      {walletDisabled ? (
        <p className="text-xs font-medium text-gray-500">
          Wallet is not enabled for this customer.
        </p>
      ) : null}
    </>
  );

  if (compact) {
    return <div className="space-y-2">{content}</div>;
  }

  return <Card className="space-y-2 p-2">{content}</Card>;
}

interface BillTotalSummaryProps {
  total: number;
  priorBalance?: number;
  compact?: boolean;
  hero?: boolean;
}

export function BillTotalSummary({
  total,
  priorBalance = 0,
  compact = false,
  hero = false,
}: BillTotalSummaryProps) {
  if (hero) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        {priorBalance > 0 ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-gray-500">This bill</span>
              <span className="text-base font-semibold tabular-nums text-gray-900">
                {formatCurrency(total)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-amber-800">Other outstanding</span>
              <span className="text-base font-semibold tabular-nums text-amber-900">
                {formatCurrency(priorBalance)}
              </span>
            </div>
            <div className="border-t border-gray-100 pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Total due
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-gray-950">
                {formatCurrency(total + priorBalance)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-end justify-between gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Total due
            </p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-950">
              {formatCurrency(total)}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (priorBalance > 0) {
    const rows = (
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-600">This bill</span>
          <span className="font-semibold tabular-nums text-gray-900">
            {formatCurrency(total)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-amber-800">Other outstanding</span>
          <span className="font-semibold tabular-nums text-amber-900">
            {formatCurrency(priorBalance)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-1">
          <span className="font-semibold text-gray-700">Total balance</span>
          <span className="font-bold tabular-nums text-gray-900">
            {formatCurrency(total + priorBalance)}
          </span>
        </div>
      </div>
    );

    return compact ? rows : <Card className="p-2">{rows}</Card>;
  }

  const row = (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="font-medium text-gray-600">Total due</span>
      <span className="font-bold tabular-nums text-gray-900">
        {formatCurrency(total)}
      </span>
    </div>
  );

  return compact ? row : <Card className="p-2">{row}</Card>;
}

interface VisitBillSummaryProps {
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  payLaterDue?: number;
  newChargesDue?: number;
  compact?: boolean;
  hero?: boolean;
}

export function VisitBillSummary({
  totalAmount,
  paidAmount,
  dueAmount,
  payLaterDue,
  newChargesDue,
  compact = false,
  hero = false,
}: VisitBillSummaryProps) {
  if (hero) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Bill
            </span>
            <span className="text-base font-semibold tabular-nums text-gray-900">
              {formatCurrency(totalAmount)}
            </span>
          </div>
          {paidAmount > 0 ? (
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Paid
              </span>
              <span className="text-base font-semibold tabular-nums text-emerald-700">
                {formatCurrency(paidAmount)}
              </span>
            </div>
          ) : null}
          {payLaterDue != null && payLaterDue > 0 ? (
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Pay later
              </span>
              <span className="text-base font-semibold tabular-nums text-amber-800">
                {formatCurrency(payLaterDue)}
              </span>
            </div>
          ) : null}
          {newChargesDue != null && newChargesDue > 0 ? (
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                New charges
              </span>
              <span className="text-base font-semibold tabular-nums text-gray-900">
                {formatCurrency(newChargesDue)}
              </span>
            </div>
          ) : null}
        </div>
        <div className="mt-2 flex items-end justify-between gap-4 border-t border-gray-100 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Due now
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-950">
            {formatCurrency(dueAmount)}
          </p>
        </div>
      </div>
    );
  }

  const rows = (
    <div className="space-y-1 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-600">Bill</span>
        <span className="font-semibold tabular-nums text-gray-900">
          {formatCurrency(totalAmount)}
        </span>
      </div>
      {paidAmount > 0 ? (
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-600">Paid</span>
          <span className="font-semibold tabular-nums text-emerald-800">
            {formatCurrency(paidAmount)}
          </span>
        </div>
      ) : null}
      {payLaterDue != null && payLaterDue > 0 ? (
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-amber-800">Pay later balance</span>
          <span className="font-semibold tabular-nums text-amber-900">
            {formatCurrency(payLaterDue)}
          </span>
        </div>
      ) : null}
      {newChargesDue != null && newChargesDue > 0 ? (
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-600">New charges</span>
          <span className="font-semibold tabular-nums text-gray-900">
            {formatCurrency(newChargesDue)}
          </span>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-1">
        <span className="font-semibold text-gray-700">Due now</span>
        <span className="font-bold tabular-nums text-gray-900">
          {formatCurrency(dueAmount)}
        </span>
      </div>
    </div>
  );

  return compact ? rows : <Card className="p-2">{rows}</Card>;
}

interface CheckoutPaymentAmountSectionProps {
  total: number;
  payAmount: string;
  onPayAmountChange: (value: string) => void;
  walletBalance?: number | null;
  walletEnabled?: boolean;
  compact?: boolean;
  hideHelper?: boolean;
  large?: boolean;
}

export function CheckoutPaymentAmountSection({
  total,
  payAmount,
  onPayAmountChange,
  walletBalance,
  walletEnabled,
  compact = false,
  hideHelper = false,
  large = false,
}: CheckoutPaymentAmountSectionProps) {
  const received = parseCheckoutPayAmount(payAmount);
  const balanceAfter =
    received > 0 && received < total ? Math.max(0, total - received) : 0;
  const isPartial = balanceAfter > 0;

  return (
    <div className="space-y-2">
      <div>
        <Label
          htmlFor="checkout-pay-amount"
          className={cn(
            "font-semibold text-gray-700",
            large ? "text-sm" : "text-xs"
          )}
        >
          Amount received
        </Label>
        <div className="relative mt-2">
          <span
            className={cn(
              "pointer-events-none absolute left-4 font-semibold text-gray-400",
              large ? "top-1/2 -translate-y-1/2 text-xl" : "top-2.5 text-base"
            )}
          >
            ₹
          </span>
          <Input
            id="checkout-pay-amount"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={payAmount}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "");
              if (!digits) {
                onPayAmountChange("");
                return;
              }
              const parsed = Number.parseInt(digits, 10);
              onPayAmountChange(parsed > total ? String(total) : digits);
            }}
            className={cn(
              "border-gray-300 pl-10 font-bold tabular-nums text-gray-950 shadow-sm",
              large
                ? "min-h-[52px] rounded-lg text-2xl tracking-tight"
                : compact
                  ? "mt-1 text-sm font-semibold"
                  : "mt-2 text-base font-semibold"
            )}
          />
        </div>
        {!hideHelper ? (
          <p className="mt-1 text-xs font-medium text-gray-500">
            Enter less than the full due to leave a balance on the account.
          </p>
        ) : null}
      </div>

      {walletEnabled && walletBalance != null ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
          <span className="font-medium text-gray-500">Wallet balance</span>
          <span className="font-semibold tabular-nums text-gray-900">
            {formatCurrency(walletBalance)}
          </span>
        </div>
      ) : null}

      {isPartial ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm">
          <span className="font-medium text-amber-900">Balance after payment</span>
          <span className="text-base font-bold tabular-nums text-amber-950">
            {formatCurrency(balanceAfter)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

interface CheckoutPaymentHistoryProps {
  settlements: NotebookSettlementDTO[];
  onRemove: (settlementId: string) => void;
  isPending?: boolean;
}

export function CheckoutPaymentHistory({
  settlements,
  onRemove,
  isPending = false,
}: CheckoutPaymentHistoryProps) {
  if (settlements.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Payments this visit
      </p>
      <ul className="mt-2 space-y-2">
        {settlements.map((settlement) => (
          <li
            key={settlement.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {paymentMethodLabel(settlement.paymentMethod)}{" "}
                <span className="tabular-nums">
                  {formatCurrency(settlement.totalAmount)}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                {formatDate(settlement.createdAt)}
                {settlement.paidByName ? ` · ${settlement.paidByName}` : ""}
              </p>
            </div>
            <button
              type="button"
              data-checkout-action="remove-payment"
              disabled={isPending}
              onClick={() => onRemove(settlement.id)}
              className="shrink-0 text-sm font-medium text-red-700 underline-offset-2 transition-colors hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-500">
        Remove a payment to edit frames on the counter again, then pay with a
        different method if needed.
      </p>
    </div>
  );
}

interface CheckoutPaymentReviewProps {
  total: number;
  priorBalance?: number;
  payAmount: string;
  onPayAmountChange: (value: string) => void;
  method: NotebookPaymentMethod;
  onMethodChange: (method: NotebookPaymentMethod) => void;
  walletBalance?: number | null;
  walletEnabled?: boolean;
  onPayClick: () => void;
  payDisabled?: boolean;
  onAddToBalance?: () => void;
  addToBalanceDisabled?: boolean;
  addToBalanceHint?: string | null;
  checkoutMode?: "new-bill" | "customer-balance";
  onCloseBill?: () => void;
  onFinishVisit?: () => void;
  finishVisitDisabled?: boolean;
  finishVisitHint?: string | null;
  checkoutSettlements?: NotebookSettlementDTO[];
  onRemovePayment?: (settlementId: string) => void;
  visitBillTotal?: number;
  visitBillPaid?: number;
  visitBillDue?: number;
  payLaterDue?: number;
  newChargesDue?: number;
  billDetails?: ReactNode;
  error?: string | null;
  isPending?: boolean;
}

export function CheckoutPaymentReview({
  total,
  priorBalance = 0,
  payAmount,
  onPayAmountChange,
  method,
  onMethodChange,
  walletBalance,
  walletEnabled,
  onPayClick,
  payDisabled,
  onAddToBalance,
  addToBalanceDisabled,
  addToBalanceHint,
  checkoutMode = "new-bill",
  onCloseBill,
  onFinishVisit,
  finishVisitDisabled,
  finishVisitHint,
  checkoutSettlements = [],
  onRemovePayment,
  visitBillTotal,
  visitBillPaid,
  visitBillDue,
  payLaterDue,
  newChargesDue,
  billDetails,
  error,
  isPending = false,
}: CheckoutPaymentReviewProps) {
  const received = parseCheckoutPayAmount(payAmount);
  const payLabel =
    received > 0 && received < total
      ? `Receive ${formatCurrency(received)}`
      : `Receive ${formatCurrency(total)}`;
  const isCustomerBalance = checkoutMode === "customer-balance";
  const showVisitBillSummary =
    visitBillTotal != null &&
    visitBillPaid != null &&
    visitBillDue != null &&
    !isCustomerBalance;

  return (
    <div className="space-y-3">
      {onFinishVisit ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Active visit
          </p>
          <p className="mt-1 text-sm text-emerald-950">
            Payments and edits stay open until you finish the visit.
          </p>
          {finishVisitHint ? (
            <p className="mt-2 text-sm font-medium text-amber-800">
              {finishVisitHint}
            </p>
          ) : null}
          <Button
            type="button"
            fullWidth
            size="lg"
            variant="secondary"
            data-checkout-action="finish-visit"
            disabled={finishVisitDisabled || isPending}
            onClick={onFinishVisit}
            className="mt-3 min-h-[44px] border-emerald-300 bg-white text-sm font-bold text-emerald-900 hover:bg-emerald-50"
          >
            {isPending ? "Finishing visit…" : "Finish Visit"}
          </Button>
        </div>
      ) : null}

      {checkoutSettlements.length > 0 && onRemovePayment ? (
        <CheckoutPaymentHistory
          settlements={checkoutSettlements}
          onRemove={onRemovePayment}
          isPending={isPending}
        />
      ) : null}

      {showVisitBillSummary ? (
        <VisitBillSummary
          totalAmount={visitBillTotal}
          paidAmount={visitBillPaid}
          dueAmount={visitBillDue}
          payLaterDue={payLaterDue}
          newChargesDue={newChargesDue}
          hero
        />
      ) : !isCustomerBalance ? (
        <BillTotalSummary total={total} priorBalance={priorBalance} hero />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-950">
          On balance — collect when they pay (part payments OK).
        </div>
      )}

      {billDetails ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2">
          {billDetails}
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <CheckoutPaymentAmountSection
          total={total}
          payAmount={payAmount}
          onPayAmountChange={onPayAmountChange}
          walletBalance={walletBalance}
          walletEnabled={walletEnabled}
          hideHelper={isCustomerBalance}
          large
        />

        <PaymentMethodSelector
          value={method}
          onChange={onMethodChange}
          walletEnabled={walletEnabled}
          compact
          large
        />

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          fullWidth
          size="lg"
          data-checkout-action="pay"
          disabled={payDisabled || received <= 0}
          onClick={onPayClick}
          className="min-h-[48px] text-sm font-bold shadow-md"
        >
          {payLabel}
        </Button>

        <div className="flex flex-col items-center gap-1 border-t border-gray-100 pt-2">
          {onCloseBill ? (
            <button
              type="button"
              data-checkout-action="pay-later"
              disabled={isPending}
              onClick={onCloseBill}
              className="text-sm font-medium text-gray-500 underline-offset-2 transition-colors hover:text-gray-800 hover:underline disabled:opacity-50"
            >
              {isPending
                ? "Recording…"
                : isCustomerBalance
                  ? "Close — they will pay later"
                  : `Leave ${formatCurrency(total)} due`}
            </button>
          ) : null}

          {onAddToBalance && !isCustomerBalance ? (
            <>
              {addToBalanceHint ? (
                <p className="text-center text-xs font-medium text-amber-800">
                  {addToBalanceHint}
                </p>
              ) : null}
              <button
                type="button"
                data-checkout-action="add-to-balance"
                disabled={addToBalanceDisabled || isPending}
                onClick={onAddToBalance}
                className="text-sm font-medium text-gray-500 underline-offset-2 transition-colors hover:text-gray-800 hover:underline disabled:opacity-50"
              >
                {isPending
                  ? "Recording…"
                  : `Leave ${formatCurrency(total)} due`}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface PaymentConfirmPanelProps {
  customerName: string;
  method: NotebookPaymentMethod;
  totalDue: number;
  payAmount: number;
  error: string | null;
  isPending: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function PaymentConfirmPanel({
  customerName,
  method,
  totalDue,
  payAmount,
  error,
  isPending,
  onConfirm,
  onBack,
}: PaymentConfirmPanelProps) {
  const balanceAfter =
    payAmount < totalDue ? Math.max(0, totalDue - payAmount) : 0;

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-base font-bold text-gray-900">Confirm payment</p>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Customer</dt>
          <dd className="font-semibold text-gray-900">{customerName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Method</dt>
          <dd className="font-semibold text-gray-900">
            {paymentMethodLabel(method)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Total due</dt>
          <dd className="font-semibold tabular-nums text-gray-900">
            {formatCurrency(totalDue)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-gray-100 pt-3">
          <dt className="font-semibold text-gray-700">Receiving</dt>
          <dd className="text-xl font-bold tabular-nums text-gray-950">
            {formatCurrency(payAmount)}
          </dd>
        </div>
        {balanceAfter > 0 ? (
          <div className="flex justify-between gap-4 rounded-lg bg-amber-50 px-3 py-2">
            <dt className="font-semibold text-amber-900">Balance after</dt>
            <dd className="font-bold tabular-nums text-amber-950">
              {formatCurrency(balanceAfter)}
            </dd>
          </div>
        ) : null}
      </dl>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          fullWidth
          size="lg"
          disabled={isPending}
          onClick={onConfirm}
          className="min-h-[52px] text-base font-bold"
        >
          {isPending ? "Processing…" : "Confirm payment"}
        </Button>
        <Button type="button" variant="ghost" fullWidth onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
