"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPoolMiniEntry } from "@/actions/notebook-entries";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import {
  poolMiniDefaultAmount,
  poolMiniEntryTypeForSection,
  POOL_MINI_SECTIONS,
} from "@/lib/constants/counter-sections";
import {
  COUNTER_RATE_TYPES,
  getRateOptionsForPreset,
  type CounterRateType,
} from "@/lib/constants/counter-rates";
import {
  SnookerFrameField,
  snookerFrameControlClass,
} from "@/components/counter/SnookerFrameFields";
import { invalidateCustomerGlanceCache } from "@/components/counter/CustomerPreviewContext";
import { cn } from "@/lib/utils/cn";

type PoolMiniSection = (typeof POOL_MINI_SECTIONS)[number];

interface PoolMiniAddRowProps {
  section: NotebookSection;
}

export function PoolMiniAddRow({ section }: PoolMiniAddRowProps) {
  const router = useRouter();
  const poolSection = section as PoolMiniSection;
  const entryType = poolMiniEntryTypeForSection(poolSection);
  const [rateType, setRateType] = useState<CounterRateType>("REGULAR");
  const [amount, setAmount] = useState(() =>
    String(poolMiniDefaultAmount(poolSection, "REGULAR"))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rateOptions = useMemo(
    () => getRateOptionsForPreset({ type: entryType }),
    [entryType]
  );

  useEffect(() => {
    setRateType("REGULAR");
    setAmount(String(poolMiniDefaultAmount(poolSection, "REGULAR")));
    setError(null);
  }, [poolSection]);

  const applyRateType = (next: CounterRateType) => {
    setRateType(next);
    setAmount(String(poolMiniDefaultAmount(poolSection, next)));
    setError(null);
  };

  const resetForm = () => {
    setRateType("REGULAR");
    setAmount(String(poolMiniDefaultAmount(poolSection, "REGULAR")));
    setError(null);
  };

  const submit = () => {
    const parsedAmount = Number.parseInt(amount, 10);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("section", section);
      formData.set("amount", String(parsedAmount));
      formData.set("rateType", rateType);

      const result = await createPoolMiniEntry(formData);
      if (result.success) {
        invalidateCustomerGlanceCache();
        router.refresh();
        resetForm();
        return;
      }
      setError(result.error);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isPending) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-b border-emerald-200/80 bg-gradient-to-b from-emerald-50 to-emerald-50/40 px-3 py-3">
      <div className="flex flex-wrap items-end gap-2">
        <SnookerFrameField label="Rate" className="min-w-[9.5rem] flex-[1.2]">
          <div className="flex gap-1">
            {COUNTER_RATE_TYPES.map((option) => {
              const optionAmount =
                rateOptions.find((row) => row.rateType === option)?.amount ?? 0;
              const label = option === "REGULAR" ? "Regular" : "HH";
              const selected = rateType === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => applyRateType(option)}
                  disabled={isPending}
                  className={cn(
                    "h-9 flex-1 rounded-lg border px-2 text-[12px] font-bold transition-colors",
                    selected
                      ? "border-emerald-700 bg-emerald-800 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:border-emerald-400 hover:bg-emerald-50"
                  )}
                  title={`${option === "REGULAR" ? "Regular" : "Happy Hour"} · ₹${optionAmount}`}
                >
                  {label} ₹{optionAmount}
                </button>
              );
            })}
          </div>
        </SnookerFrameField>
        <SnookerFrameField label="Amount" className="min-w-[6.5rem] flex-1">
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d]/g, ""));
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={isPending}
            className={snookerFrameControlClass}
            aria-label="Amount"
          />
        </SnookerFrameField>
        <div className="shrink-0 pb-0.5">
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="h-9 whitespace-nowrap rounded-lg bg-emerald-800 px-4 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isPending ? "Adding…" : "+ Add"}
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-emerald-800/70">
        Amount can still be edited — software does not auto-calculate time
      </p>
      {error && (
        <p className="mt-2 text-[11px] font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
