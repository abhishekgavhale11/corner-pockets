"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPoolMiniEntry } from "@/actions/notebook-entries";
import {
  sectionLabel,
  sectionShortLabel,
  type NotebookSection,
} from "@/lib/constants/notebook-sections";
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
  SnookerFrameFields,
  counterAddControlsShellClass,
  counterAddFrameButtonClass,
  counterTableBadgeClass,
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
    <div className="py-2">
      <div className={counterAddControlsShellClass}>
        <SnookerFrameFields
          amount={amount}
          onAmountChange={(value) => {
            setAmount(value);
            setError(null);
          }}
          disabled={isPending}
          onKeyDown={handleKeyDown}
          leadingSlot={
            <span
              className={cn(counterTableBadgeClass, "w-auto min-w-10 px-1.5")}
              title={sectionLabel(section)}
            >
              {sectionShortLabel(section)}
            </span>
          }
          typeSlot={
            <div
              className="flex h-10 min-w-0 flex-1 overflow-hidden rounded-md border border-gray-300 bg-white"
              role="group"
              aria-label="Type"
            >
              {COUNTER_RATE_TYPES.map((option, index) => {
                const optionAmount =
                  rateOptions.find((row) => row.rateType === option)?.amount ??
                  0;
                const label = option === "REGULAR" ? "Regular" : "HH";
                const selected = rateType === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => applyRateType(option)}
                    disabled={isPending}
                    className={cn(
                      "h-full min-w-0 flex-1 px-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                      index > 0 && "border-l border-gray-300",
                      selected
                        ? "bg-emerald-800 text-white"
                        : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-900"
                    )}
                    title={`${option === "REGULAR" ? "Regular" : "Happy Hour"} · ₹${optionAmount}`}
                  >
                    {label} ₹{optionAmount}
                  </button>
                );
              })}
            </div>
          }
          submitSlot={
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className={counterAddFrameButtonClass}
            >
              {isPending ? "Adding…" : "+ Add"}
            </button>
          }
        />
      </div>
      <p className="mt-1.5 text-[10px] text-gray-500">
        Amount can still be edited — software does not auto-calculate time
      </p>
      {error && (
        <p className="mt-1 text-[11px] font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
