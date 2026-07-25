"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePoolMiniEntry } from "@/actions/notebook-entries";
import { getCustomerWalletInfo } from "@/actions/customers";
import { searchNotebookCustomers } from "@/actions/notebook-ledger";
import type { CustomerDTO, NotebookEntryDTO } from "@/types";
import { toTimeInputValue } from "@/lib/utils/format-time";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { snookerFrameControlClass } from "@/components/counter/SnookerFrameFields";
import {
  EntryPaymentFields,
  appendEntryPaymentFormData,
  initialUseWalletFromPayment,
  resolveEntryPaymentSubmit,
  type EntryPaymentMode,
} from "@/components/counter/EntryPaymentFields";
import { invalidateCustomerGlanceCache } from "@/components/counter/CustomerPreviewContext";

interface PoolMiniEditDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
}

/**
 * Pool & Mini edit dialog — same payment model as Big Snooker frames, no Split.
 * Cashier enters start/end time and final amount (no auto hourly calculation).
 */
export function PoolMiniEditDialog({
  entry,
  onClose,
}: PoolMiniEditDialogProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [paymentMode, setPaymentMode] = useState<EntryPaymentMode | "">("");
  const [useWallet, setUseWallet] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | undefined>();
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerDTO[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = entry !== null;

  const parsedAmount = Number.parseInt(amount, 10) || 0;
  const parsedPaid = Number.parseInt(paidAmount, 10) || 0;

  useEffect(() => {
    if (!open || !entry) return;

    setAmount(String(entry.amount));
    setPaidAmount(String(entry.paidAmount ?? 0));
    setPaymentMode(
      entry.paymentMethod === "CASH" ||
        entry.paymentMethod === "GPAY" ||
        entry.paymentMethod === "WALLET"
        ? entry.paymentMethod
        : ""
    );
    setUseWallet(
      initialUseWalletFromPayment({
        paymentMethod: entry.paymentMethod,
        walletAmount: entry.walletAmount,
      })
    );
    const startSource = entry.playStartedAt ?? entry.createdAt;
    setStartTime(toTimeInputValue(startSource));
    setEndTime(entry.playEndedAt ? toTimeInputValue(entry.playEndedAt) : "");
    setNotes(entry.notes ?? "");
    setSelectedCustomerId(entry.customerId ?? "");
    setCustomerQuery(entry.customerName || "");
    setCustomerResults([]);
    setError(null);
    setWalletBalance(undefined);
    setWalletEnabled(false);
  }, [open, entry]);

  useEffect(() => {
    if (!open || !selectedCustomerId) {
      if (!selectedCustomerId) {
        setWalletBalance(undefined);
        setWalletEnabled(false);
      }
      return;
    }

    let cancelled = false;
    void getCustomerWalletInfo(selectedCustomerId).then((info) => {
      if (cancelled || !info) return;
      setWalletBalance(info.balance);
      setWalletEnabled(info.walletEnabled);
    });
    return () => {
      cancelled = true;
    };
  }, [open, selectedCustomerId]);

  const searchCustomers = async (q: string) => {
    const customers = await searchNotebookCustomers(q.trim() || undefined);
    setCustomerResults(customers);
  };

  const submit = () => {
    if (!entry) return;

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!startTime) {
      setError("Enter a valid start time");
      return;
    }
    if (!Number.isFinite(parsedPaid) || parsedPaid < 0) {
      setError("Enter a valid received amount");
      return;
    }
    if (parsedPaid > parsedAmount) {
      setError("Received amount cannot exceed amount");
      return;
    }
    const paymentCheck = resolveEntryPaymentSubmit({
      paidAmount: parsedPaid,
      useWallet,
      walletBalance: walletBalance ?? 0,
      paymentMode,
    });
    if (!paymentCheck.valid) {
      setError(paymentCheck.error ?? "Select payment mode");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("entryId", entry.id);
      formData.set("amount", String(parsedAmount));
      formData.set("startTime", startTime);
      if (endTime) {
        formData.set("endTime", endTime);
      }
      formData.set("notes", notes);
      const paymentFields = appendEntryPaymentFormData(formData, {
        paidAmount: parsedPaid,
        useWallet,
        walletBalance: walletBalance ?? 0,
        paymentMode,
      });
      if (!paymentFields.ok) {
        setError(paymentFields.error);
        return;
      }
      if (selectedCustomerId) {
        formData.set("customerId", selectedCustomerId);
      }

      const result = await updatePoolMiniEntry(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }

      invalidateCustomerGlanceCache(selectedCustomerId || entry.customerId);
      router.refresh();
      onClose();
    });
  };

  if (!entry) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Edit ${getEntryDisplayLabel(entry)}`}
    >
      <div className="space-y-3">
        <div>
          <Label htmlFor="pool-mini-customer">Customer</Label>
          <Input
            id="pool-mini-customer"
            value={customerQuery}
            onChange={(e) => {
              setCustomerQuery(e.target.value);
              if (!e.target.value.trim()) {
                setSelectedCustomerId("");
                setWalletBalance(undefined);
                setWalletEnabled(false);
              }
              void searchCustomers(e.target.value);
            }}
            onFocus={() => void searchCustomers(customerQuery)}
            placeholder="Search name or mobile"
            disabled={isPending}
            className={`mt-1 ${snookerFrameControlClass}`}
            autoComplete="off"
          />
          {customerResults.length > 0 && (
            <ul className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              {customerResults.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-emerald-50"
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setCustomerQuery(customer.name);
                      setWalletBalance(customer.balance);
                      setWalletEnabled(customer.walletEnabled);
                      setCustomerResults([]);
                      setError(null);
                    }}
                  >
                    <span className="font-medium text-gray-900">
                      {customer.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatCustomerContactLine(customer)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pool-mini-start">Start Time</Label>
            <Input
              id="pool-mini-start"
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setError(null);
              }}
              disabled={isPending}
              className={`mt-1 ${snookerFrameControlClass}`}
            />
          </div>
          <div>
            <Label htmlFor="pool-mini-end">End Time</Label>
            <Input
              id="pool-mini-end"
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setError(null);
              }}
              disabled={isPending}
              className={`mt-1 ${snookerFrameControlClass}`}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="pool-mini-amount">Amount</Label>
          <Input
            id="pool-mini-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d]/g, ""));
              setError(null);
            }}
            disabled={isPending}
            className={`mt-1 ${snookerFrameControlClass}`}
          />
        </div>

        <EntryPaymentFields
          amount={parsedAmount}
          paidAmount={paidAmount}
          paymentMode={paymentMode}
          useWallet={useWallet}
          disabled={isPending}
          onPaidAmountChange={(value) => {
            setPaidAmount(value);
            setError(null);
          }}
          onPaymentModeChange={(mode) => {
            setPaymentMode(mode);
            setError(null);
          }}
          onUseWalletChange={(value) => {
            setUseWallet(value);
            setError(null);
          }}
          idPrefix="pool-mini"
          walletEnabled={walletEnabled && Boolean(selectedCustomerId)}
          walletBalance={walletBalance}
        />

        <div>
          <Label htmlFor="pool-mini-notes">Notes (optional)</Label>
          <Input
            id="pool-mini-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isPending}
            className={`mt-1 ${snookerFrameControlClass}`}
            placeholder="Optional note"
          />
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
        <Button type="button" onClick={submit} disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
