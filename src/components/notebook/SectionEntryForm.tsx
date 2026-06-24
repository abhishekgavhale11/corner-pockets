"use client";

import { useActionState, useState } from "react";
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
import type { NotebookEntryType } from "@/lib/constants/notebook-entry-types";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { NotebookCustomerPicker } from "@/components/notebook/NotebookCustomerPicker";

interface SectionEntryFormProps {
  section: NotebookSection;
}

export function SectionEntryForm({ section }: SectionEntryFormProps) {
  const router = useRouter();
  const presets = getPresetsForSection(section);
  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [selectedType, setSelectedType] = useState<NotebookEntryType | null>(
    null
  );
  const [amount, setAmount] = useState("");
  const [rateType, setRateType] = useState<CounterRateType | undefined>();
  const [snookerGame, setSnookerGame] = useState<SnookerGame | undefined>();

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await createNotebookEntry(formData);
      if (result.success) {
        router.push(`/notebook/tabs/${result.data.customerId}`);
        router.refresh();
        return { success: true };
      }
      return { error: result.error };
    },
    null
  );

  const applyPreset = (preset: NotebookPreset) => {
    setSelectedType(preset.type);
    setSnookerGame(preset.snookerGame);
    setRateType("REGULAR");
    setAmount("");

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

  const canSubmit =
    customer && selectedType && amount && Number(amount) > 0 && !isPending;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle className="mb-4">{sectionLabel(section)}</CardTitle>
        <p className="mb-4 text-sm text-gray-500">Quick presets</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {presets.map((preset) => (
            <Button
              key={preset.key}
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </Card>

      <NotebookCustomerPicker
        selectedCustomer={customer}
        onSelect={setCustomer}
      />

      <Card>
        <CardTitle className="mb-4">Entry Details</CardTitle>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="section" value={section} />
          <input type="hidden" name="customerId" value={customer?.id ?? ""} />
          <input type="hidden" name="type" value={selectedType ?? ""} />
          {isRatedPreset && rateType && (
            <>
              <input type="hidden" name="rateType" value={rateType} />
              {snookerGame && (
                <input type="hidden" name="snookerGame" value={snookerGame} />
              )}
            </>
          )}

          {isRatedPreset && (
            <div>
              <Label>Rate type</Label>
              <div className="mt-2 space-y-2">
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
                      {option.rateType === "REGULAR" ? "Regular" : "Happy Hour"}
                    </span>
                    <span className="text-sm font-semibold">₹{option.amount}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
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

          {selectedType && (
            <p className="text-sm text-gray-600">
              Type: <strong>{selectedType.replace(/_/g, " ")}</strong>
            </p>
          )}

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" disabled={!canSubmit}>
            {isPending ? "Saving..." : "Save Entry"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
