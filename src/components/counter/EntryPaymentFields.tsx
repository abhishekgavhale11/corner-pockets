"use client";

import { formatCurrency } from "@/lib/utils/format";
import { frameDueAmount } from "@/lib/utils/frame-payment";
import { computeWalletUsed } from "@/lib/wallet/wallet-payment-math";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export type EntryPaymentMode = "CASH" | "GPAY" | "WALLET";
export type RemainderPaymentMode = "CASH" | "GPAY";

interface EntryPaymentFieldsProps {
  amount: number;
  paidAmount: string;
  /** Remainder / full Cash-GPay mode. Empty when unpaid or fully covered by Wallet. */
  paymentMode: RemainderPaymentMode | "WALLET" | "";
  useWallet: boolean;
  disabled?: boolean;
  onPaidAmountChange: (value: string) => void;
  onPaymentModeChange: (value: RemainderPaymentMode | "WALLET" | "") => void;
  onUseWalletChange: (value: boolean) => void;
  idPrefix?: string;
  /** When true, Wallet option is shown (customer has wallet membership). */
  walletEnabled?: boolean;
  walletBalance?: number;
}

/**
 * Shared Frame/Cafe payment fields.
 * Wallet is auto-consumed: Wallet Used = min(balance, Received).
 * Remainder (if any) is Cash OR GPay only — never typed wallet amounts.
 */
export function EntryPaymentFields({
  amount,
  paidAmount,
  paymentMode,
  useWallet,
  disabled = false,
  onPaidAmountChange,
  onPaymentModeChange,
  onUseWalletChange,
  idPrefix = "entry",
  walletBalance,
  walletEnabled = false,
}: EntryPaymentFieldsProps) {
  const parsedPaid = Number.parseInt(paidAmount, 10) || 0;
  const dueAmount = frameDueAmount(amount, parsedPaid);
  const balance = walletBalance ?? 0;
  const showWallet = walletEnabled;
  const walletZero = balance <= 0;
  const walletUsed = computeWalletUsed({
    paidAmount: parsedPaid,
    useWallet: useWallet && !walletZero,
    availableBalance: balance,
  });
  const remainder = Math.max(0, parsedPaid - walletUsed);
  const needsRemainderMethod = parsedPaid > 0 && remainder > 0;
  const fullyCoveredByWallet =
    parsedPaid > 0 && useWallet && !walletZero && remainder === 0;

  const remainderModes: RemainderPaymentMode[] = ["CASH", "GPAY"];

  return (
    <div className="space-y-3">
      {showWallet ? (
        <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-gray-500">Wallet Balance</span>
            <span className="font-semibold tabular-nums text-gray-900">
              {formatCurrency(balance)}
            </span>
          </div>
          <label
            className={cn(
              "flex items-center justify-between gap-3 text-sm",
              (disabled || walletZero || parsedPaid <= 0) && "opacity-50"
            )}
          >
            <span className="font-medium text-gray-800">Use Wallet</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-700"
              checked={useWallet && !walletZero}
              disabled={disabled || walletZero || parsedPaid <= 0}
              onChange={(event) => {
                const next = event.target.checked;
                onUseWalletChange(next);
                if (!next) {
                  if (paymentMode === "WALLET") onPaymentModeChange("");
                } else {
                  const used = computeWalletUsed({
                    paidAmount: parsedPaid,
                    useWallet: true,
                    availableBalance: balance,
                  });
                  if (used >= parsedPaid && parsedPaid > 0) {
                    onPaymentModeChange("WALLET");
                  } else if (paymentMode === "WALLET") {
                    onPaymentModeChange("");
                  }
                }
              }}
            />
          </label>
          {walletZero ? (
            <p className="text-xs text-gray-500">
              Wallet payment disabled — balance is zero.
            </p>
          ) : null}
          {useWallet && !walletZero && parsedPaid > 0 ? (
            <dl className="grid grid-cols-2 gap-2 border-t border-gray-200/80 pt-2 text-sm">
              <div>
                <dt className="text-[11px] text-gray-500">Wallet Used</dt>
                <dd className="font-semibold tabular-nums text-emerald-900">
                  {formatCurrency(walletUsed)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-gray-500">Remaining</dt>
                <dd className="font-semibold tabular-nums text-gray-900">
                  {formatCurrency(remainder)}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      ) : null}

      <div>
        <Label htmlFor={`${idPrefix}-received-amount`}>Received Amount</Label>
        <Input
          id={`${idPrefix}-received-amount`}
          inputMode="numeric"
          value={paidAmount}
          onChange={(event) => {
            const next = event.target.value.replace(/[^\d]/g, "");
            const nextPaid = Number.parseInt(next, 10) || 0;
            onPaidAmountChange(next);
            if (nextPaid === 0) {
              onPaymentModeChange("");
              onUseWalletChange(false);
              return;
            }
            if (useWallet && !walletZero) {
              const used = computeWalletUsed({
                paidAmount: nextPaid,
                useWallet: true,
                availableBalance: balance,
              });
              if (used >= nextPaid) {
                onPaymentModeChange("WALLET");
              } else if (paymentMode === "WALLET") {
                onPaymentModeChange("");
              }
            }
          }}
          disabled={disabled}
          className="mt-1 h-10"
        />
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
          {fullyCoveredByWallet
            ? "Payment Mode"
            : useWallet && needsRemainderMethod
              ? "Remaining Payment"
              : "Payment Mode"}
        </p>
        {fullyCoveredByWallet ? (
          <p className="mt-1 rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900">
            Wallet
          </p>
        ) : parsedPaid <= 0 ? (
          <p className="mt-1 text-xs text-gray-500">Unassigned</p>
        ) : (
          <div className="mt-1 flex gap-1 rounded-lg bg-gray-100 p-1">
            {remainderModes.map((mode) => {
              const selected = paymentMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPaymentModeChange(mode)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                    selected
                      ? "bg-white text-emerald-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900",
                    disabled && "opacity-40"
                  )}
                >
                  {mode === "CASH" ? "Cash" : "GPay"}
                </button>
              );
            })}
          </div>
        )}
        {useWallet && needsRemainderMethod && !paymentMode ? (
          <p className="mt-1 text-xs text-amber-700">
            Select Cash or GPay for the remaining{" "}
            {formatCurrency(remainder)}.
          </p>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between gap-3 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
        <span className="text-gray-500">Due</span>
        <span
          className={cn(
            "font-bold tabular-nums",
            dueAmount > 0 ? "text-orange-700" : "text-emerald-800"
          )}
        >
          {dueAmount > 0
            ? formatCurrency(dueAmount)
            : fullyCoveredByWallet
              ? "Wallet"
              : paymentMode === "CASH"
                ? useWallet
                  ? `Wallet + Cash`
                  : "Cash"
                : paymentMode === "GPAY"
                  ? useWallet
                    ? `Wallet + GPay`
                    : "GPay"
                  : "Paid"}
        </span>
      </div>
    </div>
  );
}

/** Derive submit paymentMethod + useWallet from field state. */
export function resolveEntryPaymentSubmit(input: {
  paidAmount: number;
  useWallet: boolean;
  walletBalance: number;
  paymentMode: RemainderPaymentMode | "WALLET" | "";
}): {
  useWallet: boolean;
  paymentMethod: EntryPaymentMode | undefined;
  walletUsed: number;
  remainder: number;
  valid: boolean;
  error?: string;
} {
  const paid = Math.round(input.paidAmount);
  if (paid <= 0) {
    return {
      useWallet: false,
      paymentMethod: undefined,
      walletUsed: 0,
      remainder: 0,
      valid: true,
    };
  }

  const walletUsed = computeWalletUsed({
    paidAmount: paid,
    useWallet: input.useWallet && input.walletBalance > 0,
    availableBalance: input.walletBalance,
  });
  const remainder = paid - walletUsed;

  if (remainder === 0) {
    return {
      useWallet: true,
      paymentMethod: "WALLET",
      walletUsed,
      remainder: 0,
      valid: true,
    };
  }

  if (input.paymentMode !== "CASH" && input.paymentMode !== "GPAY") {
    return {
      useWallet: walletUsed > 0,
      paymentMethod: undefined,
      walletUsed,
      remainder,
      valid: false,
      error:
        walletUsed > 0
          ? "Select Cash or GPay for the remaining amount"
          : "Select Cash or GPay",
    };
  }

  return {
    useWallet: walletUsed > 0,
    paymentMethod: input.paymentMode,
    walletUsed,
    remainder,
    valid: true,
  };
}

/** Write payment fields onto FormData for Counter / Cafe actions. */
export function appendEntryPaymentFormData(
  formData: FormData,
  input: {
    paidAmount: number;
    useWallet: boolean;
    walletBalance: number;
    paymentMode: RemainderPaymentMode | "WALLET" | "";
  }
): { ok: true } | { ok: false; error: string } {
  const resolved = resolveEntryPaymentSubmit(input);
  if (!resolved.valid) {
    return { ok: false, error: resolved.error ?? "Invalid payment" };
  }
  formData.set("paidAmount", String(Math.round(input.paidAmount)));
  formData.set("useWallet", resolved.useWallet ? "true" : "false");
  if (resolved.paymentMethod) {
    formData.set("paymentMethod", resolved.paymentMethod);
  }
  return { ok: true };
}

/** Initialize Use Wallet from a saved operational payment. */
export function initialUseWalletFromPayment(input: {
  paymentMethod?: string | null;
  walletAmount?: number | null;
}): boolean {
  if (input.paymentMethod === "WALLET") return true;
  if (input.walletAmount != null && input.walletAmount > 0) return true;
  return false;
}
