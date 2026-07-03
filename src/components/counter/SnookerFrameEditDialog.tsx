"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setEntryContributors,
  updateSnookerFrameEntry,
  assignCounterEntryCustomer,
} from "@/actions/notebook-entries";
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
  validateContributorRows,
  type ContributorRow,
} from "@/components/counter/ContributorsSplitFields";
import { invalidateCustomerGlanceCache } from "@/components/counter/CustomerPreviewContext";
import { ENTRY_CUSTOMER_REASSIGN_BLOCKED_MESSAGE, ENTRY_LOCKED_MESSAGE } from "@/lib/visit-bill/entry-edit-lock-constants";
import { entryBlocksCustomerReassignment, isNotebookEntryEditLocked } from "@/lib/visit-bill/entry-edit-lock-utils";
import { EntryLockIndicator } from "@/components/counter/EntryLockIndicator";
import {
  BillingModeToggle,
  type EntryBillingMode,
} from "@/components/counter/BillingModeToggle";

interface SnookerFrameEditDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
}

export function SnookerFrameEditDialog({
  entry,
  onClose,
}: SnookerFrameEditDialogProps) {
  const router = useRouter();
  const [frameType, setFrameType] = useState<SnookerFrameType | "">("");
  const [amount, setAmount] = useState("");
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

  useEffect(() => {
    if (!open || !entry) return;

    const initialType = entryToSnookerFrameType(entry) ?? "";
    const hasSplit = Boolean(entry.contributors && entry.contributors.length > 0);
    setBillingMode(hasSplit ? "split" : "single");
    setFrameType(initialType);
    setAmount(String(entry.amount));
    setPlayerCount(entry.playerCount ? String(entry.playerCount) : "4");
    setEntryTime(toTimeInputValue(entry.createdAt));
    setSelectedCustomerId(entry.customerId ?? "");
    setCustomerQuery(entry.customerName || "");
    setContributorRows(
      entry.contributors?.map((contributor) => ({
        customerId: contributor.customerId,
        customerName: contributor.customerName,
        amount: String(contributor.amount),
      })) ?? []
    );
    setCustomerResults([]);
    setError(null);
    setSkipAmountReset(true);
  }, [open, entry]);

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

    const parsedAmount = Number.parseInt(amount, 10);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    if (!entryTime) {
      setError("Enter a valid time");
      return;
    }

    if (billingMode === "split" && contributorRows.length > 0) {
      const contributorError = validateContributorRows(
        contributorRows,
        parsedAmount
      );
      if (contributorError) {
        setError(contributorError);
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
      if (billingMode === "single" && selectedCustomerId && !hadContributors && !customerReassignmentBlocked) {
        formData.set("customerId", selectedCustomerId);
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
          JSON.stringify(
            contributorRows.map((row) => ({
              customerId: row.customerId,
              amount: Number.parseInt(row.amount, 10),
            }))
          )
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
      }

      invalidateCustomerGlanceCache();
      router.refresh();
      onClose();
    });
  };

  if (!entry) return null;

  const customerReassignmentBlocked = entryBlocksCustomerReassignment(entry);

  if (isNotebookEntryEditLocked(entry)) {
    const lockMessage = entryBlocksCustomerReassignment(entry)
      ? ENTRY_CUSTOMER_REASSIGN_BLOCKED_MESSAGE
      : ENTRY_LOCKED_MESSAGE;
    return (
      <Dialog open={open} onClose={onClose} title="Frame locked">
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <EntryLockIndicator className="mt-0.5 shrink-0" />
            <p className="text-sm text-gray-700">{lockMessage}</p>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    );
  }

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
            totalAmount={Number.parseInt(amount, 10) || entry.amount}
            rows={contributorRows}
            onRowsChange={setContributorRows}
            disabled={isPending}
          />
        ) : (
          <div>
            <Label htmlFor="frame-entry-customer">Customer</Label>
            {customerReassignmentBlocked ? (
              <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {ENTRY_CUSTOMER_REASSIGN_BLOCKED_MESSAGE}
              </p>
            ) : (
              <>
            <Input
              id="frame-entry-customer"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                if (!e.target.value.trim()) {
                  setSelectedCustomerId("");
                }
                void searchCustomers(e.target.value);
              }}
              onFocus={() => void searchCustomers(customerQuery)}
              placeholder="Search name, phone, or card"
              disabled={isPending}
              className="mt-1 text-sm"
            />
            {customerResults.length > 0 && (
              <ul className="mt-1 max-h-32 overflow-y-auto rounded border border-gray-200">
                {customerResults.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      className={`w-full px-2 py-1.5 text-left text-xs hover:bg-emerald-50 ${
                        selectedCustomerId === customer.id ? "bg-emerald-50" : ""
                      }`}
                      onClick={() => {
                        setSelectedCustomerId(customer.id);
                        setCustomerQuery(customer.name);
                        setCustomerResults([]);
                      }}
                    >
                      <span className="font-medium">{customer.name}</span>
                      <span className="ml-2 text-gray-500">
                        {formatCustomerContactLine(customer)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!selectedCustomerId && (
              <p className="mt-1 text-[11px] text-gray-500">
                Leave empty to keep unassigned
              </p>
            )}
              </>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            type="button"
            fullWidth
            disabled={isPending || !frameType}
            onClick={submit}
          >
            {isPending ? "Saving…" : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
