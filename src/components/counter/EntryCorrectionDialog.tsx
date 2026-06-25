"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctCounterEntry, setEntryContributors } from "@/actions/notebook-entries";
import { searchNotebookCustomers } from "@/actions/notebook-ledger";
import {
  getRateOptionsForPreset,
  SNOOKER_GAMES,
  SNOOKER_GAME_LABELS,
} from "@/lib/constants/counter-rates";
import {
  RUMMY_DEFAULT_AMOUNTS,
  RUMMY_PLAYER_PRESETS,
} from "@/lib/constants/snooker-pricing";
import type { CustomerDTO, NotebookEntryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";
import { invalidateCustomerGlanceCache } from "@/components/counter/CafeCustomerGlanceHover";
import {
  BillingModeToggle,
  type EntryBillingMode,
} from "@/components/counter/BillingModeToggle";
import {
  ContributorsSplitFields,
  validateContributorRows,
  type ContributorRow,
} from "@/components/counter/ContributorsSplitFields";
import { assignCounterEntryCustomer } from "@/actions/notebook-entries";

interface EntryCorrectionDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
}

export function EntryCorrectionDialog({
  entry,
  onClose,
}: EntryCorrectionDialogProps) {
  const router = useRouter();
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerDTO[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [players, setPlayers] = useState("");
  const [reason, setReason] = useState("");
  const [billingMode, setBillingMode] = useState<EntryBillingMode>("single");
  const [contributorRows, setContributorRows] = useState<ContributorRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = entry !== null;

  useEffect(() => {
    if (!open || !entry) return;
    const hasSplit = Boolean(entry.contributors && entry.contributors.length > 0);
    setBillingMode(hasSplit ? "split" : "single");
    setContributorRows(
      entry.contributors?.map((contributor) => ({
        customerId: contributor.customerId,
        customerName: contributor.customerName,
        amount: String(contributor.amount),
      })) ?? []
    );
    setSelectedCustomerId(entry.customerId ?? "");
    setAmount(String(entry.amount));
    setPlayers(entry.playerCount ? String(entry.playerCount) : "4");
    setCustomerQuery(entry.customerName || "");
    setReason("");
    setError(null);
    setCustomerResults([]);
  }, [open, entry]);

  if (!entry) return null;

  const searchCustomers = async (q: string) => {
    const customers = await searchNotebookCustomers(q.trim() || undefined);
    setCustomerResults(customers);
  };

  const applyRummyPreset = (count: (typeof RUMMY_PLAYER_PRESETS)[number]) => {
    setPlayers(String(count));
    setAmount(String(RUMMY_DEFAULT_AMOUNTS[count]));
  };

  const submit = () => {
    if (reason.trim().length < 3) {
      setError("Please provide a correction reason");
      return;
    }

    const parsedAmount = Number.parseInt(amount, 10);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount");
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

    const formData = new FormData();
    formData.set("entryId", entry.id);
    formData.set("correctionReason", reason.trim());
    formData.set("amount", String(parsedAmount));

    if (billingMode === "single" && selectedCustomerId) {
      formData.set("customerId", selectedCustomerId);
    }

    if (entry.type === "RUMMY") {
      const playerCount = Number.parseInt(players, 10);
      if (!Number.isFinite(playerCount) || playerCount < 2) {
        setError("Enter a valid player count");
        return;
      }
      formData.set("playerCount", String(playerCount));
    }

    setError(null);
    startTransition(async () => {
      const result = await correctCounterEntry(formData);
      if (!result.success) {
        setError(result.error);
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
      } else if (entry.contributors && entry.contributors.length > 0) {
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

  const canChangeCustomer = Boolean(entry?.assignedAt);
  const showBillingToggle =
    entry.type === "RUMMY" || entry.type === "SNOOKER";

  return (
    <Dialog open={open} onClose={onClose} title="Correct Entry">
      <div className="space-y-3">
        {showBillingToggle && (
          <BillingModeToggle
            value={billingMode}
            onChange={setBillingMode}
            disabled={isPending}
          />
        )}

        {billingMode === "single" && canChangeCustomer && (
          <div>
            <Label htmlFor="correction-customer">Customer</Label>
            <Input
              id="correction-customer"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                void searchCustomers(e.target.value);
              }}
              onFocus={() => void searchCustomers(customerQuery)}
              placeholder="Search name, phone, or card"
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
          </div>
        )}

        {billingMode === "split" && (
          <ContributorsSplitFields
            totalAmount={Number.parseInt(amount, 10) || entry.amount}
            rows={contributorRows}
            onRowsChange={setContributorRows}
            disabled={isPending}
          />
        )}

        {entry.type === "SNOOKER" && (
          <div>
            <Label>Game type & rate</Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {SNOOKER_GAMES.flatMap((game) =>
                getRateOptionsForPreset({
                  type: "SNOOKER",
                  snookerGame: game,
                }).map((option) => (
                  <button
                    key={`${game}-${option.rateType}`}
                    type="button"
                    onClick={() => setAmount(String(option.amount))}
                    className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    {SNOOKER_GAME_LABELS[game]}
                    {option.rateType === "HAPPY_HOUR" ? " HH" : ""} ₹
                    {option.amount}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {entry.type === "RUMMY" && (
          <div>
            <Label htmlFor="correction-players">Players</Label>
            <Input
              id="correction-players"
              type="number"
              min={2}
              max={20}
              value={players}
              onChange={(e) => setPlayers(e.target.value)}
              className="mt-1 text-sm"
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {RUMMY_PLAYER_PRESETS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => applyRummyPreset(count)}
                  className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="correction-amount">Amount (₹)</Label>
          <Input
            id="correction-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 text-sm"
          />
        </div>

        <div>
          <Label htmlFor="correction-reason">Reason</Label>
          <Input
            id="correction-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being corrected?"
            className="mt-1 text-sm"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="button" fullWidth disabled={isPending} onClick={submit}>
            {isPending ? "Saving..." : "Save Correction"}
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
