"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  getBusinessDayHistoryPresetRange,
  matchBusinessDayHistoryPreset,
  type BusinessDayHistoryPreset,
} from "@/lib/utils/business-date";

export type BusinessDayHistoryFilterValues = {
  from: string;
  to: string;
  preset?: BusinessDayHistoryPreset | null;
};

interface BusinessDayHistoryFiltersProps {
  from: string;
  to: string;
}

const PRESET_CHIPS: {
  id: Exclude<BusinessDayHistoryPreset, "custom">;
  label: string;
}[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

function buildHistoryUrl(values: BusinessDayHistoryFilterValues): string {
  const params = new URLSearchParams();
  params.set("from", values.from);
  params.set("to", values.to);
  if (values.preset && values.preset !== "custom") {
    params.set("preset", values.preset);
  }
  return `/business-day/history?${params.toString()}`;
}

export function BusinessDayHistoryFilters({
  from,
  to,
}: BusinessDayHistoryFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const activePreset = matchBusinessDayHistoryPreset(from, to);

  const apply = (values: BusinessDayHistoryFilterValues) => {
    startTransition(() => {
      router.push(buildHistoryUrl(values));
    });
  };

  const handlePreset = (
    preset: Exclude<BusinessDayHistoryPreset, "custom">
  ) => {
    const range = getBusinessDayHistoryPresetRange(preset);
    setDraftFrom(range.from);
    setDraftTo(range.to);
    apply({ ...range, preset });
  };

  const handleApplyCustom = () => {
    apply({ from: draftFrom, to: draftTo, preset: "custom" });
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Filter
      </h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESET_CHIPS.map((chip) => {
          const selected = activePreset === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              disabled={isPending}
              onClick={() => handlePreset(chip.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                selected
                  ? "bg-emerald-700 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              } disabled:opacity-60`}
            >
              {chip.label}
            </button>
          );
        })}
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            activePreset === "custom"
              ? "bg-emerald-700 text-white"
              : "bg-gray-50 text-gray-400"
          }`}
        >
          Custom Range
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <Label htmlFor="history-from">From Date</Label>
          <Input
            id="history-from"
            type="date"
            value={draftFrom}
            onChange={(event) => setDraftFrom(event.target.value)}
            disabled={isPending}
            className="mt-1"
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <Label htmlFor="history-to">To Date</Label>
          <Input
            id="history-to"
            type="date"
            value={draftTo}
            onChange={(event) => setDraftTo(event.target.value)}
            disabled={isPending}
            className="mt-1"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleApplyCustom}
            disabled={isPending || !draftFrom || !draftTo}
          >
            Apply
          </Button>
        </div>
      </div>
    </section>
  );
}
