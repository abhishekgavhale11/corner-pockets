"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { settleNotebookEntries } from "@/actions/notebook-settlements";
import { checkoutEntryGroup } from "@/lib/constants/counter-sections";
import { formatCurrency } from "@/lib/utils/format";
import { formatTime } from "@/lib/utils/format-time";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import type { CustomerDTO, NotebookEntryDTO } from "@/types";
import type { OpenTabSummaryDTO } from "@/types";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import { Button } from "@/components/ui/Button";
import { CustomerVerification } from "@/components/wallet/CustomerVerification";
import { WalletCustomerConfirmation } from "@/components/wallet/WalletCustomerConfirmation";
import type { VerificationMethod } from "@/lib/constants/verification";

interface CheckoutDrawerProps {
  tab: OpenTabSummaryDTO | null;
  entries: NotebookEntryDTO[];
  onClose: () => void;
}

export function CheckoutDrawer({ tab, entries, onClose }: CheckoutDrawerProps) {
  const router = useRouter();
  const [step, setStep] = useState<"review" | "confirm" | "wallet-verify" | "wallet-confirm">(
    "review"
  );
  const [method, setMethod] = useState<NotebookPaymentMethod>("CASH");
  const [walletPayer, setWalletPayer] = useState<CustomerDTO | null>(null);
  const [verificationMethod, setVerificationMethod] =
    useState<VerificationMethod | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const grouped = useMemo(() => {
    const groups = {
      snooker: [] as NotebookEntryDTO[],
      poolMini: [] as NotebookEntryDTO[],
      cafe: [] as NotebookEntryDTO[],
    };
    for (const entry of entries) {
      groups[checkoutEntryGroup(entry.section)].push(entry);
    }
    return groups;
  }, [entries]);

  const total = entries.reduce((s, e) => s + e.amount, 0);

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await settleNotebookEntries(formData);
      if (result.success) {
        router.refresh();
        onClose();
        return null;
      }
      return { error: result.error };
    },
    null
  );

  if (!tab) return null;

  const title =
    tab.kind === "table"
      ? tab.tableName
      : tab.kind === "session"
        ? tab.displayLabel
        : tab.customerName;
  const customerId = tab.kind === "customer" ? tab.customerId : null;
  const walletEnabled = tab.kind === "customer" ? tab.walletEnabled : false;
  const cardId = tab.kind === "customer" ? tab.cardId : undefined;

  useEffect(() => {
    if (method === "WALLET" && !walletEnabled) {
      setMethod("CASH");
    }
  }, [method, walletEnabled]);

  const submit = () => {
    if (submitted) return;
    const formData = new FormData();
    entries.forEach((e) => formData.append("entryIds", e.id));
    formData.set("paymentMethod", method);
    formData.set("paidByName", title);
    formData.set("idempotencyKey", crypto.randomUUID());
    if (customerId) {
      formData.set("paidByCustomerId", customerId);
    }
    if (method === "WALLET" && walletPayer && verificationMethod) {
      formData.set("paidByCustomerId", walletPayer.id);
      formData.set("verificationMethod", verificationMethod);
      formData.set("customerConfirmed", "true");
    }
    setSubmitted(true);
    formAction(formData);
  };

  const renderGroup = (title: string, items: NotebookEntryDTO[]) =>
    items.length > 0 && (
      <div className="mb-2">
        <p className="text-[10px] font-semibold uppercase text-gray-400">{title}</p>
        {items.map((entry) => (
          <p key={entry.id} className="text-xs text-gray-700">
            {formatTime(entry.createdAt)}{" "}
            {getEntryDisplayLabel(entry)}{" "}
            {formatCurrency(entry.amount)}
          </p>
        ))}
      </div>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-lg bg-white p-3 shadow-xl sm:rounded-lg">
        <div className="mb-2 flex items-center justify-between">
          {customerId ? (
            <Link
              href={`/customers/${customerId}`}
              className="text-sm font-semibold text-emerald-800 hover:underline"
            >
              {title}
            </Link>
          ) : (
            <p className="text-sm font-semibold text-gray-900">{title}</p>
          )}
          <button type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        {step === "review" && (
          <>
            {renderGroup("Snooker", grouped.snooker)}
            {renderGroup("Pool / Mini", grouped.poolMini)}
            {renderGroup("Cafe", grouped.cafe)}
            <p className="border-t pt-2 text-sm font-bold">
              TOTAL {formatCurrency(total)}
            </p>
            <div className="mt-2 flex gap-1">
              {(["CASH", "GPAY", "WALLET"] as const).map((m) => {
                const disabled = m === "WALLET" && !walletEnabled;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (!disabled) setMethod(m);
                    }}
                    className={`flex-1 rounded py-1.5 text-xs font-medium ${
                      method === m
                        ? "bg-emerald-800 text-white"
                        : "bg-gray-100 text-gray-700"
                    } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    {m === "CASH" ? "Cash" : m === "GPAY" ? "GPay" : "Wallet"}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              fullWidth
              size="sm"
              className="mt-2"
              onClick={() => {
                if (method === "WALLET") {
                  setStep("wallet-verify");
                } else {
                  setStep("confirm");
                }
              }}
            >
              Pay {formatCurrency(total)}
            </Button>
          </>
        )}

        {step === "wallet-verify" && (
          <CustomerVerification
            initialCardId={walletEnabled ? cardId : undefined}
            onVerified={(customer, vMethod) => {
              setWalletPayer(customer);
              setVerificationMethod(vMethod);
              setStep("wallet-confirm");
            }}
          />
        )}

        {step === "wallet-confirm" && walletPayer && verificationMethod && (
          <WalletCustomerConfirmation
            customer={walletPayer}
            verificationMethod={verificationMethod}
            onConfirm={() => setStep("confirm")}
            onBack={() => setStep("wallet-verify")}
          />
        )}

        {step === "confirm" && (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-gray-500">Customer:</span> {title}
            </p>
            <p>
              <span className="text-gray-500">Total:</span> {formatCurrency(total)}
            </p>
            <p>
              <span className="text-gray-500">Method:</span> {method}
            </p>
            {state?.error && (
              <p className="text-xs text-red-600">{state.error}</p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                fullWidth
                size="sm"
                disabled={isPending || submitted}
                onClick={submit}
              >
                {isPending ? "Processing..." : "Confirm"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setStep("review")}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
