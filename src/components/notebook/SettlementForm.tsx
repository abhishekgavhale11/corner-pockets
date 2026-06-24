"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { settleNotebookEntries } from "@/actions/notebook-settlements";
import { paymentMethodLabel } from "@/lib/constants/notebook-payments";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import { entryTypeLabel } from "@/lib/constants/notebook-entry-types";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { formatCurrency } from "@/lib/utils/format";
import type { CustomerDTO, NotebookEntryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { CustomerVerification } from "@/components/wallet/CustomerVerification";
import { WalletCustomerConfirmation } from "@/components/wallet/WalletCustomerConfirmation";
import type { VerificationMethod } from "@/lib/constants/verification";

interface SettlementFormProps {
  entries: NotebookEntryDTO[];
  defaultPayer?: CustomerDTO;
}

export function SettlementForm({ entries, defaultPayer }: SettlementFormProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(
    entries.map((entry) => entry.id)
  );
  const [paymentMethod, setPaymentMethod] =
    useState<NotebookPaymentMethod>("CASH");
  const [paidByName, setPaidByName] = useState(defaultPayer?.name ?? "");
  const [walletStep, setWalletStep] = useState<
    "form" | "verify" | "confirm"
  >("form");
  const [walletPayer, setWalletPayer] = useState<CustomerDTO | null>(
    defaultPayer?.walletEnabled ? defaultPayer : null
  );
  const [verificationMethod, setVerificationMethod] =
    useState<VerificationMethod | null>(null);

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedIds.includes(entry.id)),
    [entries, selectedIds]
  );
  const total = selectedEntries.reduce((sum, entry) => sum + entry.amount, 0);

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await settleNotebookEntries(formData);
      if (result.success) {
        router.push("/notebook/tabs");
        router.refresh();
        return { success: true };
      }
      return { error: result.error };
    },
    null
  );

  const toggleEntry = (entryId: string) => {
    setSelectedIds((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId]
    );
  };

  const submitSettlement = () => {
    const formData = new FormData();
    selectedIds.forEach((id) => formData.append("entryIds", id));
    formData.set("paymentMethod", paymentMethod);
    formData.set("paidByName", paidByName);
    formData.set("idempotencyKey", crypto.randomUUID());
    if (paymentMethod === "WALLET" && walletPayer && verificationMethod) {
      formData.set("paidByCustomerId", walletPayer.id);
      formData.set("verificationMethod", verificationMethod);
      formData.set("customerConfirmed", "true");
    }
    formAction(formData);
  };

  if (paymentMethod === "WALLET" && walletStep === "verify") {
    return (
      <CustomerVerification
        initialCardId={walletPayer?.cardId}
        onVerified={(customer, method) => {
          setWalletPayer(customer);
          setVerificationMethod(method);
          setPaidByName(customer.name);
          setWalletStep("confirm");
        }}
      />
    );
  }

  if (paymentMethod === "WALLET" && walletStep === "confirm" && walletPayer && verificationMethod) {
    return (
      <WalletCustomerConfirmation
        customer={walletPayer}
        verificationMethod={verificationMethod}
        onConfirm={() => setWalletStep("form")}
        onBack={() => setWalletStep("verify")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle className="mb-4">Select Entries</CardTitle>
        <ul className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 py-3 first:pt-0">
              <input
                type="checkbox"
                checked={selectedIds.includes(entry.id)}
                onChange={() => toggleEntry(entry.id)}
                className="mt-1 h-5 w-5 accent-emerald-800"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {entry.customerName} — {sectionLabel(entry.section)}
                </p>
                <p className="text-sm text-gray-600">
                  {entryTypeLabel(entry.type)} · {formatCurrency(entry.amount)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xl font-bold text-emerald-800">
          Total: {formatCurrency(total)}
        </p>
      </Card>

      <Card>
        <CardTitle className="mb-4">Payment</CardTitle>
        <div className="space-y-4">
          <div>
            <Label htmlFor="paid-by-name">Paid by</Label>
            <Input
              id="paid-by-name"
              value={paidByName}
              onChange={(e) => setPaidByName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["CASH", "GPAY", "WALLET"] as const).map((method) => (
              <Button
                key={method}
                type="button"
                variant={paymentMethod === method ? "primary" : "secondary"}
                onClick={() => {
                  setPaymentMethod(method);
                  if (method === "WALLET") setWalletStep("verify");
                }}
              >
                {paymentMethodLabel(method)}
              </Button>
            ))}
          </div>

          {paymentMethod === "WALLET" && walletPayer && verificationMethod && (
            <p className="text-sm text-emerald-800">
              Wallet payer verified: {walletPayer.name} ({walletPayer.cardId})
            </p>
          )}

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Button
            type="button"
            fullWidth
            size="lg"
            disabled={
              isPending ||
              selectedIds.length === 0 ||
              !paidByName.trim() ||
              total <= 0 ||
              (paymentMethod === "WALLET" &&
                (!walletPayer || !verificationMethod || !walletPayer.walletEnabled))
            }
            onClick={submitSettlement}
          >
            {isPending ? "Processing..." : `Settle ${formatCurrency(total)}`}
          </Button>
        </div>
      </Card>
    </div>
  );
}
