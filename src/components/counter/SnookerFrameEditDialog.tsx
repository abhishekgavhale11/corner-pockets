"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignCounterEntryCustomer,
  setEntryContributors,
  updatePoolMiniEntry,
  updateSnookerFrameEntry,
} from "@/actions/notebook-entries";
import { searchNotebookCustomers } from "@/actions/notebook-ledger";
import type { SnookerFrameType } from "@/lib/constants/counter-sections";
import {
  inferRateTypeFromStoredAmount,
  type CounterRateType,
} from "@/lib/constants/counter-rates";
import type { CustomerDTO, NotebookEntryDTO } from "@/types";
import { entryToSnookerFrameType } from "@/lib/utils/snooker-frame";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import { isPoolMiniEntry } from "@/lib/utils/pool-mini-entry";
import { toTimeInputValue } from "@/lib/utils/format-time";
import { formatCustomerContactLine, getCustomerMembershipLabel } from "@/lib/utils/customer-display";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import {
  SnookerFrameField,
  SnookerFrameFields,
  snookerFrameControlClass,
  usePoolMiniAmountDefaults,
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
  resolveEntryPaymentSubmit,
} from "@/components/counter/EntryPaymentFields";
import type { PaymentRowInput } from "@/lib/utils/payment-allocations";
import {
  defaultPaymentRows,
  paymentRowsFromEntry,
  resolveEntryPayments,
  sumPaymentRowReceived,
} from "@/lib/utils/payment-allocations";
import { PaymentCustomerCard } from "@/components/counter/PaymentCustomerCard";
import { invalidateCustomerGlanceCache } from "@/components/counter/CustomerPreviewContext";
import {
  defaultReceivedForEdit,
  frameDueAmount,
  syncReceivedWithAmountChange,
} from "@/lib/utils/frame-payment";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface SnookerFrameEditDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
  onSaved?: (entry: NotebookEntryDTO) => void;
  /**
   * When false, Frame Ownership / Split is hidden (Pool & Mini).
   * Also forced off automatically for Pool/Mini entries.
   */
  allowSplit?: boolean;
}

/**
 * Counter Edit Frame dialog — shared by Big Snooker, Mini, and Pool.
 * Split / Frame Ownership only when allowSplit is true (Big Snooker).
 */
export function SnookerFrameEditDialog({
  entry,
  onClose,
  onSaved,
  allowSplit = true,
}: SnookerFrameEditDialogProps) {
  const router = useRouter();
  const [frameType, setFrameType] = useState<SnookerFrameType | "">("");
  const [rateType, setRateType] = useState<CounterRateType | "">("");
  const [amount, setAmount] = useState("");
  const [paymentRows, setPaymentRows] = useState<PaymentRowInput[]>(
    defaultPaymentRows()
  );
  const [playerCount, setPlayerCount] = useState("4");
  const [entryTime, setEntryTime] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerDTO[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState("");
  const [selectedMembershipLabel, setSelectedMembershipLabel] =
    useState("Regular Customer");
  const [contributorRows, setContributorRows] = useState<ContributorRow[]>([]);
  const [billingMode, setBillingMode] = useState<EntryBillingMode>("single");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [skipAmountReset, setSkipAmountReset] = useState(true);

  const open = entry !== null;
  const poolMini = entry ? isPoolMiniEntry(entry) : false;
  const canSplit = allowSplit && !poolMini;
  const poolMiniEntryType =
    entry?.type === "MINI" || entry?.type === "POOL" ? entry.type : "POOL";
  const hadContributors = entry ? entryHasContributors(entry) : false;
  const defaultSnookerAmount = useSnookerFrameAmountDefaults(
    frameType,
    playerCount
  );
  const defaultPoolMiniAmount = usePoolMiniAmountDefaults(
    poolMiniEntryType,
    rateType
  );
  const defaultAmount = poolMini ? defaultPoolMiniAmount : defaultSnookerAmount;

  const parsedAmount = Number.parseInt(amount, 10) || 0;
  const parsedPaid = sumPaymentRowReceived(paymentRows);
  const entryPaymentLoadKey = entry
    ? entry.paymentAllocations
        ?.map((row) => `${row.paymentMethod ?? ""}:${row.amount}`)
        .join("|") ??
      `single:${entry.paymentMethod ?? ""}:${entry.paidAmount ?? 0}`
    : "";

  useEffect(() => {
    if (!open || !entry) return;

    const isPoolMini = isPoolMiniEntry(entry);
    const hasSplit =
      !isPoolMini &&
      Boolean(entry.contributors && entry.contributors.length > 0);
    setBillingMode(hasSplit ? "split" : "single");

    if (isPoolMini) {
      const initialRate =
        entry.rateType === "REGULAR" || entry.rateType === "HAPPY_HOUR"
          ? entry.rateType
          : inferRateTypeFromStoredAmount(
              entry.type === "MINI" ? "MINI" : "POOL",
              entry.amount
            ) ?? "REGULAR";
      setRateType(initialRate);
      setFrameType("");
      setPlayerCount("4");
      setEntryTime(
        toTimeInputValue(entry.playStartedAt ?? entry.createdAt)
      );
    } else {
      const initialType = entryToSnookerFrameType(entry) ?? "";
      setFrameType(initialType);
      setRateType("");
      setPlayerCount(entry.playerCount ? String(entry.playerCount) : "4");
      setEntryTime(toTimeInputValue(entry.createdAt));
    }

    setAmount(String(entry.amount));
    setPaymentRows(
      paymentRowsFromEntry(entry, defaultReceivedForEdit)
    );
    setSelectedCustomerId(entry.customerId ?? "");
    setCustomerQuery(entry.customerName || "");
    setSelectedCustomerPhone("");
    setSelectedMembershipLabel("Regular Customer");
    setContributorRows(
      isPoolMini
        ? []
        : entry.contributors?.map((contributor) => ({
            customerId: contributor.customerId,
            customerName: contributor.customerName,
            amount: String(contributor.amount),
            paidAmount: defaultReceivedForEdit(
              contributor.amount,
              contributor.paidAmount
            ),
            paymentMethod:
              contributor.paymentMethod === "CASH" ||
              contributor.paymentMethod === "GPAY"
                ? contributor.paymentMethod
                : "",
            initialPaidAmount: contributor.paidAmount ?? 0,
            initialPaymentMethod:
              contributor.paymentMethod === "CASH" ||
              contributor.paymentMethod === "GPAY"
                ? contributor.paymentMethod
                : "",
          })) ?? []
    );
    setCustomerResults([]);
    setError(null);
    setSkipAmountReset(true);
  }, [open, entry?.id, entryPaymentLoadKey]);

  useEffect(() => {
    if (!open || skipAmountReset) return;
    if (poolMini && !rateType) return;
    if (!poolMini && !frameType) return;

    const previousAmount = Number.parseInt(amount, 10) || 0;
    const nextAmount = Number.parseInt(defaultAmount, 10) || 0;
    setAmount(defaultAmount);
    const synced = syncReceivedWithAmountChange({
      previousAmount,
      nextAmount,
      currentReceived: sumPaymentRowReceived(paymentRows),
    });
    if (synced != null) {
      setPaymentRows((rows) => [
        { ...rows[0], received: synced },
        ...rows.slice(1),
      ]);
    }
    // Only react to type / rate defaults — not every amount keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [
    open,
    skipAmountReset,
    poolMini,
    frameType,
    playerCount,
    rateType,
    defaultAmount,
  ]);

  const searchCustomers = async (q: string) => {
    const customers = await searchNotebookCustomers(q.trim() || undefined);
    setCustomerResults(customers);
  };

  const handleFrameTypeChange = (type: SnookerFrameType | "") => {
    setSkipAmountReset(false);
    setFrameType(type);
    setError(null);
  };

  const handleRateTypeChange = (type: CounterRateType | "") => {
    setSkipAmountReset(false);
    setRateType(type);
    setError(null);
  };

  const handlePlayerCountChange = (count: string) => {
    setSkipAmountReset(false);
    setPlayerCount(count);
    setError(null);
  };

  const submitPoolMini = () => {
    if (!entry || !rateType) {
      setError("Select a game type");
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
    if (!selectedCustomerId) {
      setError("Please assign a customer before saving.");
      return;
    }
    if (!Number.isFinite(parsedPaid) || parsedPaid < 0) {
      setError("Enter a valid received amount");
      return;
    }
    if (parsedPaid > parsedAmount) {
      setError("Received amount cannot exceed frame amount");
      return;
    }
    const paymentCheck = resolveEntryPaymentSubmit({
      frameAmount: parsedAmount,
      paymentRows,
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
      formData.set("startTime", entryTime);
      if (entry.playEndedAt) {
        formData.set("endTime", toTimeInputValue(entry.playEndedAt));
      }
      formData.set("notes", entry.notes ?? "");
      formData.set("customerId", selectedCustomerId);
      const paymentFields = appendEntryPaymentFormData(formData, {
        frameAmount: parsedAmount,
        paymentRows,
      });
      if (!paymentFields.ok) {
        setError(paymentFields.error);
        return;
      }

      const result = await updatePoolMiniEntry(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }

      onSaved?.(result.data);
      invalidateCustomerGlanceCache(selectedCustomerId || entry.customerId);
      router.refresh();
      onClose();
    });
  };

  const submitSnooker = () => {
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
        setError("Please assign a customer before saving.");
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
      if (!selectedCustomerId) {
        setError("Please assign a customer before saving.");
        return;
      }
      if (!Number.isFinite(parsedPaid) || parsedPaid < 0) {
        setError("Enter a valid received amount");
        return;
      }
      if (parsedPaid > parsedAmount) {
        setError("Received amount cannot exceed frame amount");
        return;
      }
      const paymentCheck = resolveEntryPaymentSubmit({
        frameAmount: parsedAmount,
        paymentRows,
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
          frameAmount: parsedAmount,
          paymentRows,
        });
        if (!paymentFields.ok) {
          setError(paymentFields.error);
          return;
        }
        if (selectedCustomerId && !hadContributors) {
          formData.set("customerId", selectedCustomerId);
        }
      } else {
        formData.set("splitBilling", "true");
      }

      const frameResult = await updateSnookerFrameEntry(formData);
      if (!frameResult.success) {
        setError(frameResult.error);
        return;
      }

      let savedEntry = frameResult.data;

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
        const paidForm = new FormData();
        paidForm.set("entryId", entry.id);
        paidForm.set("frameType", frameType);
        paidForm.set("amount", String(parsedAmount));
        const paidFields = appendEntryPaymentFormData(paidForm, {
          frameAmount: parsedAmount,
          paymentRows,
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
        savedEntry = paidResult.data;
      }

      onSaved?.(savedEntry);
      invalidateCustomerGlanceCache(selectedCustomerId || entry.customerId);
      for (const row of contributorRows) {
        invalidateCustomerGlanceCache(row.customerId);
      }
      router.refresh();
      onClose();
    });
  };

  const submit = () => {
    if (poolMini) {
      submitPoolMini();
      return;
    }
    submitSnooker();
  };

  if (!entry) return null;

  const effectiveBillingMode = canSplit ? billingMode : "single";

  const summaryReceived =
    effectiveBillingMode === "split"
      ? contributorRows.reduce((sum, row) => {
          const paid = Number.parseInt(row.paidAmount, 10);
          return sum + (Number.isFinite(paid) ? paid : 0);
        }, 0)
      : parsedPaid;
  const summaryDue = frameDueAmount(parsedAmount, summaryReceived);
  const hasCustomerAssignment =
    effectiveBillingMode === "split"
      ? contributorRows.length >= 2
      : Boolean(selectedCustomerId);
  const customerAssignmentMessage = !hasCustomerAssignment
    ? "Please assign a customer before saving."
    : null;
  const paymentResolution =
    effectiveBillingMode === "split"
      ? null
      : resolveEntryPayments({
          frameAmount: parsedAmount,
          rows: paymentRows,
        });
  const paymentModeRequired =
    hasCustomerAssignment &&
    (effectiveBillingMode === "split"
      ? contributorRows.some((row) => {
          const paid = Number.parseInt(row.paidAmount || "0", 10) || 0;
          return !resolveEntryPaymentSubmit({
            paidAmount: paid,
            paymentMode: row.paymentMethod,
          }).valid;
        })
      : !paymentResolution?.valid);
  const summaryFullyPaid =
    hasCustomerAssignment &&
    parsedAmount > 0 &&
    summaryDue <= 0 &&
    !paymentModeRequired;

  return (
    <Dialog open={open} onClose={onClose} title="Edit Frame" size="lg">
      <div className="space-y-3">
        <SnookerFrameFields
          variant="dialog"
          entryKind={poolMini ? "poolMini" : "snooker"}
          frameType={frameType}
          onFrameTypeChange={handleFrameTypeChange}
          rateType={rateType}
          onRateTypeChange={handleRateTypeChange}
          poolMiniEntryType={poolMiniEntryType}
          amount={amount}
          onAmountChange={(value) => {
            setSkipAmountReset(true);
            const sanitized = value.replace(/[^\d]/g, "");
            const previousAmount = Number.parseInt(amount, 10) || 0;
            setAmount(sanitized);
            setError(null);
            if (sanitized === "") return;

            const nextAmount = Number.parseInt(sanitized, 10) || 0;
            const synced = syncReceivedWithAmountChange({
              previousAmount,
              nextAmount,
              currentReceived: sumPaymentRowReceived(paymentRows),
            });
            if (synced != null) {
              setPaymentRows((rows) => [
                { ...rows[0], received: synced },
                ...rows.slice(1),
              ]);
            }
          }}
          playerCount={playerCount}
          onPlayerCountChange={handlePlayerCountChange}
          disabled={isPending}
          timeSlot={
            <SnookerFrameField label="Time">
              <div className="relative">
                <Input
                  id="frame-entry-time"
                  type="time"
                  value={entryTime}
                  onChange={(e) => {
                    setEntryTime(e.target.value);
                    setError(null);
                  }}
                  disabled={isPending}
                  className={cn(snookerFrameControlClass, "pr-9")}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="none"
                    aria-hidden
                  >
                    <circle
                      cx="10"
                      cy="10"
                      r="7"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M10 6.5V10l2.5 1.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </div>
            </SnookerFrameField>
          }
          ownershipSlot={
            canSplit ? (
              <BillingModeToggle
                value={billingMode}
                onChange={setBillingMode}
                disabled={isPending}
              />
            ) : undefined
          }
        />

        {effectiveBillingMode === "split" ? (
          <ContributorsSplitFields
            totalAmount={parsedAmount || entry.amount}
            rows={contributorRows}
            onRowsChange={setContributorRows}
            disabled={isPending}
          />
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-gray-200 bg-white shadow-sm shadow-gray-900/5">
            <div className="space-y-3 border-b border-gray-100 px-3.5 py-3.5 sm:px-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-gray-500">
                Customer
              </p>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <circle
                      cx="8.5"
                      cy="8.5"
                      r="5.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M12.5 12.5 16 16"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <Input
                  id="frame-entry-customer"
                  value={customerQuery}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value);
                    if (!e.target.value.trim()) {
                      setSelectedCustomerId("");
                      setSelectedCustomerPhone("");
                      setSelectedMembershipLabel("Regular Customer");
                      setPaymentRows(defaultPaymentRows());
                    }
                    void searchCustomers(e.target.value);
                  }}
                  onFocus={() => void searchCustomers(customerQuery)}
                  placeholder="Search name or mobile"
                  disabled={isPending}
                  className="h-11 rounded-[11px] border-gray-200 pl-9 pr-10 text-sm shadow-sm"
                  autoComplete="off"
                />
                {customerQuery.trim() ? (
                  <button
                    type="button"
                    aria-label="Clear customer"
                    disabled={isPending}
                    onClick={() => {
                      setCustomerQuery("");
                      setSelectedCustomerId("");
                      setSelectedCustomerPhone("");
                      setSelectedMembershipLabel("Regular Customer");
                      setPaymentRows(defaultPaymentRows());
                      setCustomerResults([]);
                      setError(null);
                    }}
                    className="absolute right-2.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                      <path
                        d="M4 4l8 8M12 4l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                ) : null}
              </div>
              {customerResults.length > 0 && (
                <ul className="max-h-28 overflow-y-auto rounded-[11px] border border-gray-200 bg-white shadow-sm">
                  {customerResults.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2 text-left text-xs hover:bg-emerald-50"
                        onClick={() => {
                          setSelectedCustomerId(customer.id);
                          setCustomerQuery(customer.name);
                          setSelectedCustomerPhone(customer.phone ?? "");
                          setSelectedMembershipLabel(
                            `${getCustomerMembershipLabel(customer)} Customer`
                          );
                          setCustomerResults([]);
                          setError(null);
                        }}
                      >
                        <span className="font-medium text-gray-900">
                          {customer.name}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {formatCustomerContactLine(customer)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {selectedCustomerId || customerQuery.trim() ? (
                <PaymentCustomerCard
                  name={customerQuery.trim() || "Customer"}
                  phone={selectedCustomerPhone || undefined}
                  membershipLabel={selectedMembershipLabel}
                />
              ) : null}
            </div>

            <div className="px-3.5 py-3.5 sm:px-4">
              <EntryPaymentFields
                key={`${entry.id}-${entry.paidAmount ?? 0}-${entry.paymentAllocations?.map((row) => `${row.paymentMethod ?? ""}:${row.amount}`).join("|") ?? "single"}`}
                layout="row"
                amount={parsedAmount}
                disabled={isPending}
                paymentDisabled={!selectedCustomerId}
                allowMultiplePaymentMethods={effectiveBillingMode === "single"}
                paymentRows={paymentRows}
                onPaymentRowsChange={(rows) => {
                  setPaymentRows(rows);
                  setError(null);
                }}
                idPrefix="frame"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Total Amount
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">
              {formatCurrency(parsedAmount)}
            </p>
          </div>
          <div className="px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Total Received
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-800">
              {formatCurrency(summaryReceived)}
            </p>
          </div>
          <div className="px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Total Due
            </p>
            <p
              className={cn(
                "mt-0.5 text-sm font-bold tabular-nums",
                paymentModeRequired && summaryDue <= 0
                  ? "text-amber-700"
                  : summaryDue > 0
                    ? "text-red-700"
                    : "text-emerald-800"
              )}
            >
              {paymentModeRequired && summaryDue <= 0
                ? "—"
                : formatCurrency(summaryDue)}
            </p>
          </div>
          <div className="px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Status
            </p>
            <p
              className={cn(
                "mt-0.5 inline-flex items-center gap-1 text-sm font-bold",
                summaryFullyPaid ? "text-emerald-800" : "text-amber-700"
              )}
            >
              {!hasCustomerAssignment ? (
                "Unpaid"
              ) : summaryFullyPaid ? (
                <>
                  <span aria-hidden>✓</span>
                  Fully Paid
                </>
              ) : paymentModeRequired ? (
                "Payment Mode Required"
              ) : summaryReceived > 0 ? (
                "Partial"
              ) : (
                "Unpaid"
              )}
            </p>
          </div>
        </div>

        {customerAssignmentMessage ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {customerAssignmentMessage}
          </p>
        ) : error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={
            isPending ||
            !hasCustomerAssignment ||
            paymentModeRequired
          }
          className="gap-1.5"
        >
          {!isPending ? (
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path
                d="M4 4.5A1.5 1.5 0 0 1 5.5 3H13l3 3v9.5A1.5 1.5 0 0 1 14.5 17h-9A1.5 1.5 0 0 1 4 15.5v-11Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M7 17v-5h6v5M7 3v4h5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : null}
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </Dialog>
  );
}
