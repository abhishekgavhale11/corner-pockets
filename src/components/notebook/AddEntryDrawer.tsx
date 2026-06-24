"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createNotebookEntry } from "@/actions/notebook-entries";
import type { NotebookPreset } from "@/lib/constants/notebook-presets";
import { getPresetsForSection } from "@/lib/constants/notebook-presets";
import {
  getRateOptionsForPreset,
  isRatedCounterEntryType,
  resolveCounterRateAmount,
  type CounterRateType,
  type SnookerGame,
} from "@/lib/constants/counter-rates";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { NotebookCustomerSearch } from "@/components/notebook/NotebookCustomerSearch";

interface AddEntryDrawerProps {
  section: NotebookSection;
  open: boolean;
  onClose: () => void;
  requireCustomerFirst?: boolean;
}

export function AddEntryDrawer({
  section,
  open,
  onClose,
  requireCustomerFirst = false,
}: AddEntryDrawerProps) {
  const router = useRouter();
  const presets = getPresetsForSection(section);
  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(
    null
  );
  const [amount, setAmount] = useState("");
  const [rateType, setRateType] = useState<CounterRateType | undefined>();
  const [snookerGame, setSnookerGame] = useState<SnookerGame | undefined>();

  const [state, formAction, isPending] = useActionState(
    async (
      _prev: { error?: string; success?: boolean } | null,
      formData: FormData
    ) => {
      const result = await createNotebookEntry(formData);
      if (result.success) {
        router.refresh();
        onClose();
        return { success: true };
      }
      return { error: result.error };
    },
    null
  );

  useEffect(() => {
    if (!open) {
      setCustomer(null);
      setSelectedPresetKey(null);
      setAmount("");
      setRateType(undefined);
      setSnookerGame(undefined);
    }
  }, [open]);

  const applyPreset = (preset: NotebookPreset) => {
    if (requireCustomerFirst && !customer) return;
    setSelectedPresetKey(preset.key);
    setAmount("");
    setRateType("REGULAR");
    setSnookerGame(preset.snookerGame);

    if (preset.type === "SNOOKER" && preset.snookerGame) {
      const resolved = resolveCounterRateAmount({
        type: "SNOOKER",
        rateType: "REGULAR",
        snookerGame: preset.snookerGame,
      });
      setAmount(resolved ? String(resolved) : "");
      return;
    }

    if (preset.type === "MINI" || preset.type === "POOL") {
      const resolved = resolveCounterRateAmount({
        type: preset.type,
        rateType: "REGULAR",
      });
      setAmount(resolved ? String(resolved) : "");
      return;
    }

    setSnookerGame(undefined);
    setRateType(undefined);
  };

  const selectedPreset = presets.find((p) => p.key === selectedPresetKey) ?? null;
  const selectedType = selectedPreset?.type ?? null;
  const isRatedPreset =
    selectedType !== null && isRatedCounterEntryType(selectedType);

  const rateOptions =
    isRatedPreset && selectedType
      ? getRateOptionsForPreset({
          type: selectedType,
          snookerGame,
        })
      : [];

  const applyRateType = (nextRateType: CounterRateType) => {
    if (!selectedType || !isRatedCounterEntryType(selectedType)) return;
    setRateType(nextRateType);
    const resolved = resolveCounterRateAmount({
      type: selectedType,
      rateType: nextRateType,
      snookerGame,
    });
    if (resolved !== null) {
      setAmount(String(resolved));
    }
  };

  const canSelectPreset = !requireCustomerFirst || !!customer;
  const canSubmit =
    customer && selectedType && amount && Number(amount) > 0 && !isPending;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Add Entry — {sectionLabel(section)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <NotebookCustomerSearch
            selectedCustomer={customer}
            onSelect={setCustomer}
          />

          {(!requireCustomerFirst || customer) && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Entry type
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => (
                    <Button
                      key={preset.key}
                      type="button"
                      variant={
                        selectedPresetKey === preset.key ? "primary" : "secondary"
                      }
                      size="sm"
                      disabled={!canSelectPreset}
                      onClick={() => applyPreset(preset)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              <form action={formAction} className="space-y-4">
                <input type="hidden" name="section" value={section} />
                <input
                  type="hidden"
                  name="customerId"
                  value={customer?.id ?? ""}
                />
                <input type="hidden" name="type" value={selectedType ?? ""} />
                {isRatedPreset && (
                  <>
                    <input type="hidden" name="rateType" value={rateType} />
                    {snookerGame && (
                      <input
                        type="hidden"
                        name="snookerGame"
                        value={snookerGame}
                      />
                    )}
                  </>
                )}

                {isRatedPreset && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-700">
                      Rate type
                    </p>
                    <div className="space-y-2">
                      {rateOptions.map((option) => (
                        <label
                          key={option.rateType}
                          className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                        >
                          <span className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="rateTypeChoice"
                              checked={rateType === option.rateType}
                              onChange={() => applyRateType(option.rateType)}
                            />
                            {option.rateType === "REGULAR"
                              ? "Regular"
                              : "Happy Hour"}
                          </span>
                          <span className="text-sm font-semibold">
                            ₹{option.amount}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="drawer-amount">Amount (₹)</Label>
                  <Input
                    id="drawer-amount"
                    name="amount"
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    readOnly={isRatedPreset}
                    required
                  />
                </div>

                {state?.error && (
                  <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    {state.error}
                  </p>
                )}

                <Button type="submit" fullWidth size="lg" disabled={!canSubmit}>
                  {isPending ? "Saving..." : "Save Entry"}
                </Button>
              </form>
            </>
          )}

          {requireCustomerFirst && !customer && (
            <p className="text-sm text-gray-500">
              Select a customer first, then choose a cafe item.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
