"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignCounterEntryCustomer,
  setEntryContributors,
  updateSnookerFrameEntry,
} from "@/actions/notebook-entries";
import { getCustomerWalletInfo } from "@/actions/customers";
import { searchNotebookCustomers } from "@/actions/notebook-ledger";
import type { SnookerFrameType } from "@/lib/constants/counter-sections";
import type { CustomerDTO, NotebookEntryDTO } from "@/types";
import { entryToSnookerFrameType } from "@/lib/utils/snooker-frame";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import { toTimeInputValue } from "@/lib/utils/format-time";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  SnookerFrameFields,
  snookerFrameControlClass,
  useSnookerFrameAmountDefaults,
} from "@/components/counter/SnookerFrameFields";
import {
  ContributorsSplitFields,
  contributorRowsToPayload,
  validateContributorRows,
  type ContributorRow,
} from "@/components/counter/ContributorsSplitFields";
import {
  BillingModeToggle,
  type EntryBillingMode,
} from "@/components/counter/BillingModeToggle";
import {
  EntryPaymentFields,
  appendEntryPaymentFormData,
  initialUseWalletFromPayment,
  resolveEntryPaymentSubmit,
  type EntryPaymentMode,
} from "@/components/counter/EntryPaymentFields";
import { invalidateCustomerGlanceCache } from "@/components/counter/CustomerPreviewContext";

interface SnookerFrameEditDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
}

/**
 * Counter Edit Frame dialog.
 * Frame ownership: single customer or split.
 * Payment: per frame (single) or per contributor (split). Due is always calculated.
 */
export function SnookerFrameEditDialog({
  entry,
  onClose,
}: SnookerFrameEditDialogProps) {
  const router = useRouter();
  const [frameType, setFrameType] = useState<SnookerFrameType | "">("");
  const [amount, setAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [paymentMode, setPaymentMode] = useState<EntryPaymentMode | "">("");
  const [useWallet, setUseWallet] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | undefined>();
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [playerCount, setPlayerCount] = useState("4");
  const [entryTime, setEntryTime] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerDTO[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [contributorRows, setContributorRows] = useState<ContributorRow[]>([]);
  const [billingMode, setBillingMode] = useState<EntryBillingMode>("single");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [skipAmountReset, setSkipAmountReset] = useState(true);

  const open = entry !== null;
  const hadContributors = entry ? entryHasContributors(entry) : false;
  const defaultAmount = useSnookerFrameAmountDefaults(frameType, playerCount);

  const parsedAmount = Number.parseInt(amount, 10) || 0;
  const parsedPaid = Number.parseInt(paidAmount, 10) || 0;

  useEffect(() => {
    if (!open || !entry) return;

    const initialType = entryToSnookerFrameType(entry) ?? "";
    const hasSplit = Boolean(entry.contributors && entry.contributors.length > 0);
    setBillingMode(hasSplit ? "split" : "single");
    setFrameType(initialType);
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
    setPlayerCount(entry.playerCount ? String(entry.playerCount) : "4");
    setEntryTime(toTimeInputValue(entry.createdAt));
    setSelectedCustomerId(entry.customerId ?? "");
    setCustomerQuery(entry.customerName || "");
    setContributorRows(
      entry.contributors?.map((contributor) => ({
        customerId: contributor.customerId,
        customerName: contributor.customerName,
        amount: String(contributor.amount),
        paidAmount: String(contributor.paidAmount ?? 0),
        paymentMethod:
          contributor.paymentMethod === "CASH" ||
          contributor.paymentMethod === "GPAY" ||
          contributor.paymentMethod === "WALLET"
            ? contributor.paymentMethod
            : "",
        useWallet: initialUseWalletFromPayment({
          paymentMethod: contributor.paymentMethod,
          walletAmount: contributor.walletAmount,
        }),
      })) ?? []
    );
    setCustomerResults([]);
    setError(null);
    setSkipAmountReset(true);
    setWalletBalance(undefined);
    setWalletEnabled(false);

    if (entry.contributors && entry.contributors.length > 0) {
      void Promise.all(
        entry.contributors.map(async (contributor) => {
          const info = await getCustomerWalletInfo(contributor.customerId);
          return {
            customerId: contributor.customerId,
            balance: info?.balance,
            walletEnabled: info?.walletEnabled,
          };
        })
      ).then((infos) => {
        setContributorRows((rows) =>
          rows.map((row) => {
            const match = infos.find((info) => info.customerId === row.customerId);
            if (!match) return row;
            return {
              ...row,
              walletBalance: match.balance,
              walletEnabled: match.walletEnabled,
            };
          })
        );
      });
    }
  }, [open, entry]);

  useEffect(() => {
    if (!open || !selectedCustomerId || billingMode !== "single") {
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
  }, [open, selectedCustomerId, billingMode]);

  useEffect(() => {
    if (!open || skipAmountReset || !frameType) return;
    setAmount(defaultAmount);
  }, [open, skipAmountReset, frameType, playerCount, defaultAmount]);

  const searchCustomers = async (q: string) => {
    const customers = await searchNotebookCustomers(q.trim() || undefined);
    setCustomerResults(customers);
  };

  const handleFrameTypeChange = (type: SnookerFrameType | "") => {
    setSkipAmountReset(false);
    setFrameType(type);
    setError(null);
  };

  const handlePlayerCountChange = (count: string) => {
    setSkipAmountReset(false);
    setPlayerCount(count);
    setError(null);
  };

  const submit = () => {
    if (!entry || !frameType) {
      setError("Select a frame type");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid frame amount");
      return;
    }

    if (!entryTime) {
      setError("Enter a valid time");
      return;
    }

    if (billingMode === "split") {
      if (contributorRows.length < 2) {
        setError("Split requires at least two customers");
        return;
      }
      const contributorError = validateContributorRows(
        contributorRows,
        parsedAmount
      );
      if (contributorError) {
        setError(contributorError);
        return;
      }
    } else {
      if (!Number.isFinite(parsedPaid) || parsedPaid < 0) {
        setError("Enter a valid received amount");
        return;
      }
      if (parsedPaid > parsedAmount) {
        setError("Received amount cannot exceed frame amount");
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
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("entryId", entry.id);
      formData.set("frameType", frameType);
      formData.set("amount", String(parsedAmount));
      formData.set("entryTime", entryTime);
      if (frameType === "RUMMY") {
        formData.set("playerCount", playerCount);
      }

      if (billingMode === "single") {
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
        if (selectedCustomerId && !hadContributors) {
          formData.set("customerId", selectedCustomerId);
        }
      } else {
        // Payment lives on contributors — setEntryContributors owns received totals.
        formData.set("splitBilling", "true");
      }

      const frameResult = await updateSnookerFrameEntry(formData);
      if (!frameResult.success) {
        setError(frameResult.error);
        return;
      }

      if (billingMode === "split") {
        const splitFormData = new FormData();
        splitFormData.set("entryId", entry.id);
        splitFormData.set(
          "contributors",
          JSON.stringify(contributorRowsToPayload(contributorRows))
        );
        const splitResult = await setEntryContributors(splitFormData);
        if (!splitResult.success) {
          setError(splitResult.error);
          return;
        }
      } else if (hadContributors) {
        const clearFormData = new FormData();
        clearFormData.set("entryId", entry.id);
        clearFormData.set("contributors", "[]");
        const clearResult = await setEntryContributors(clearFormData);
        if (!clearResult.success) {
          setError(clearResult.error);
          return;
        }
        if (selectedCustomerId) {
          const assignFormData = new FormData();
          assignFormData.set("entryId", entry.id);
          assignFormData.set("customerId", selectedCustomerId);
          const assignResult = await assignCounterEntryCustomer(assignFormData);
          if (!assignResult.success) {
            setError(assignResult.error);
            return;
          }
        }
        // Re-apply single paid after clearing split.
        const paidForm = new FormData();
        paidForm.set("entryId", entry.id);
        paidForm.set("frameType", frameType);
        paidForm.set("amount", String(parsedAmount));
        const paidFields = appendEntryPaymentFormData(paidForm, {
          paidAmount: parsedPaid,
          useWallet,
          walletBalance: walletBalance ?? 0,
          paymentMode,
        });
        if (!paidFields.ok) {
          setError(paidFields.error);
          return;
        }
        paidForm.set("entryTime", entryTime);
        if (frameType === "RUMMY") {
          paidForm.set("playerCount", playerCount);
        }
        if (selectedCustomerId) {
          paidForm.set("customerId", selectedCustomerId);
        }
        const paidResult = await updateSnookerFrameEntry(paidForm);
        if (!paidResult.success) {
          setError(paidResult.error);
          return;
        }
      }

      invalidateCustomerGlanceCache(selectedCustomerId || entry.customerId);
      for (const row of contributorRows) {
        invalidateCustomerGlanceCache(row.customerId);
      }
      router.refresh();
      onClose();
    });
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Edit Frame">
      <div className="space-y-3">
        <div>
          <Label htmlFor="frame-entry-time">Time</Label>
          <Input
            id="frame-entry-time"
            type="time"
            value={entryTime}
            onChange={(e) => {
              setEntryTime(e.target.value);
              setError(null);
            }}
            disabled={isPending}
            className={`mt-1 ${snookerFrameControlClass}`}
          />
        </div>

        <SnookerFrameFields
          variant="dialog"
          frameType={frameType}
          onFrameTypeChange={handleFrameTypeChange}
          amount={amount}
          onAmountChange={(value) => {
            setSkipAmountReset(true);
            setAmount(value);
            setError(null);
          }}
          playerCount={playerCount}
          onPlayerCountChange={handlePlayerCountChange}
          disabled={isPending}
        />

        <BillingModeToggle
          value={billingMode}
          onChange={setBillingMode}
          disabled={isPending}
        />

        {billingMode === "split" ? (
          <ContributorsSplitFields
            totalAmount={parsedAmount || entry.amount}
            rows={contributorRows}
            onRowsChange={setContributorRows}
            disabled={isPending}
          />
        ) : (
          <>
            <div>
              <Label htmlFor="frame-entry-customer">Customer</Label>
              <Input
                id="frame-entry-customer"
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
              idPrefix="frame"
              walletEnabled={walletEnabled && Boolean(selectedCustomerId)}
              walletBalance={walletBalance}
            />
          </>
        )}

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
