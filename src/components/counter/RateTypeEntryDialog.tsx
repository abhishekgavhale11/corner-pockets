"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createQuickCounterEntry } from "@/actions/notebook-entries";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import {
  COUNTER_RATE_TYPES,
  getRateOptionsForPreset,
  type CounterRateType,
  type SnookerGame,
} from "@/lib/constants/counter-rates";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils/cn";

export type RatedEntryPreset = {
  key: string;
  label: string;
  type: "SNOOKER" | "MINI" | "POOL";
  snookerGame?: SnookerGame;
};

interface RateTypeEntryDialogProps {
  preset: RatedEntryPreset | null;
  section: NotebookSection | null;
  onClose: () => void;
}

export function RateTypeEntryDialog({
  preset,
  section,
  onClose,
}: RateTypeEntryDialogProps) {
  const router = useRouter();
  const [rateType, setRateType] = useState<CounterRateType>("REGULAR");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = preset !== null && section !== null;

  useEffect(() => {
    if (!open) return;
    setRateType("REGULAR");
    setError(null);
  }, [open, preset?.key, section]);

  if (!preset || !section) return null;

  const rateOptions = getRateOptionsForPreset({
    type: preset.type,
    snookerGame: preset.snookerGame,
  });

  const selectedAmount =
    rateOptions.find((option) => option.rateType === rateType)?.amount ?? 0;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("section", section);
      formData.set("type", preset.type);
      formData.set("rateType", rateType);
      if (preset.snookerGame) {
        formData.set("snookerGame", preset.snookerGame);
      }
      const result = await createQuickCounterEntry(formData);
      if (result.success) {
        router.refresh();
        onClose();
        return;
      }
      setError(result.error);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={preset.label}>
      <div className="space-y-4">
        <div>
          <Label>Rate Type</Label>
          <div className="mt-2 space-y-2">
            {COUNTER_RATE_TYPES.map((option) => {
              const amount =
                rateOptions.find((row) => row.rateType === option)?.amount ?? 0;
              const label = option === "REGULAR" ? "Regular" : "Happy Hour";
              return (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5",
                    rateType === option
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <input
                      type="radio"
                      name="rateType"
                      value={option}
                      checked={rateType === option}
                      onChange={() => setRateType(option)}
                      className="text-emerald-700 focus:ring-emerald-600"
                    />
                    {label}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-gray-900">
                    {formatCurrency(amount)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <p className="text-sm text-gray-600">
          Total:{" "}
          <span className="font-bold text-gray-900">
            {formatCurrency(selectedAmount)}
          </span>
        </p>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="button" fullWidth disabled={isPending} onClick={submit}>
            {isPending ? "Adding..." : `Add ${preset.label}`}
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
