"use client";

import Link from "next/link";
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

export type BusinessDayHistoryListTab = "days" | "outstanding";

export type BusinessDayHistoryFilterValues = {
  from: string;
  to: string;
  preset?: BusinessDayHistoryPreset | null;
  tab?: BusinessDayHistoryListTab;
};

interface BusinessDayHistoryFiltersProps {
  from: string;
  to: string;
  tab: BusinessDayHistoryListTab;
}

const PRESET_CHIPS: {
  id: Exclude<BusinessDayHistoryPreset, "custom">;
  label: string;
}[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
];

export function buildHistoryUrl(values: BusinessDayHistoryFilterValues): string {
  const params = new URLSearchParams();
  params.set("from", values.from);
  params.set("to", values.to);
  if (values.preset && values.preset !== "custom") {
    params.set("preset", values.preset);
  }
  if (values.tab && values.tab !== "days") {
    params.set("tab", values.tab);
  }
  return `/business-day/history?${params.toString()}`;
}

export function BusinessDayHistoryFilters({
  from,
  to,
  tab,
}: BusinessDayHistoryFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const activePreset = matchBusinessDayHistoryPreset(from, to);

  const apply = (values: BusinessDayHistoryFilterValues) => {
    startTransition(() => {
      router.push(buildHistoryUrl({ ...values, tab: values.tab ?? tab }));
    });
  };

  const handlePreset = (
    preset: Exclude<BusinessDayHistoryPreset, "custom">
  ) => {
    const range = getBusinessDayHistoryPresetRange(preset);
    setDraftFrom(range.from);
    setDraftTo(range.to);
    apply({ ...range, preset, tab });
  };

  const handleApplyCustom = () => {
    apply({ from: draftFrom, to: draftTo, preset: "custom", tab });
  };

  return (
    <section className="rounded-[12px] border border-gray-200 bg-white p-4 shadow-sm shadow-gray-900/5 sm:p-5">
      <h2 className="text-[12px] font-medium uppercase tracking-wide text-gray-500">
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
                  ? "bg-emerald-800 text-white shadow-sm"
                  : "border border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50"
              } disabled:opacity-60`}
            >
              {chip.label}
            </button>
          );
        })}
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            activePreset === "custom"
              ? "bg-emerald-800 text-white shadow-sm"
              : "border border-gray-100 bg-gray-50 text-gray-400"
          }`}
        >
          Custom Range
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
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

interface BusinessDayHistoryTabsProps {
  tab: BusinessDayHistoryListTab;
  from: string;
  to: string;
}

function tabClass(active: boolean): string {
  return `flex-1 rounded-[10px] px-3 py-2.5 text-center text-sm font-semibold transition ${
    active
      ? "bg-white text-gray-900 shadow-sm shadow-gray-900/10"
      : "text-gray-500 hover:bg-white/60 hover:text-gray-800"
  }`;
}

export function BusinessDayHistoryTabs({
  tab,
  from,
  to,
}: BusinessDayHistoryTabsProps) {
  const daysHref = buildHistoryUrl({ from, to, tab: "days" });
  const outstandingHref = buildHistoryUrl({ from, to, tab: "outstanding" });

  return (
    <div
      className="flex gap-1 rounded-[12px] border border-gray-200 bg-gray-50 p-1.5"
      role="tablist"
      aria-label="Business Day History sections"
    >
      <Link
        href={daysHref}
        role="tab"
        aria-selected={tab === "days"}
        className={tabClass(tab === "days")}
      >
        Business Days
      </Link>
      <Link
        href={outstandingHref}
        role="tab"
        aria-selected={tab === "outstanding"}
        className={tabClass(tab === "outstanding")}
      >
        Outstanding
      </Link>
    </div>
  );
}
