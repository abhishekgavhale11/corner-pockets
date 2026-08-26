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
  heading?: string;
  subheading?: string;
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
  heading,
  subheading,
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
    <section className="rounded-[12px] border border-gray-200 bg-white p-4 shadow-sm shadow-gray-900/5">
      {heading ? (
        <div className="mb-3 flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 19V9M10 19V5M16 19v-7M22 19H2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">
              {heading}
            </h1>
            {subheading ? (
              <p className="mt-0.5 text-[13px] text-gray-500">{subheading}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {PRESET_CHIPS.map((chip) => {
            const selected = activePreset === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                disabled={isPending}
                onClick={() => handlePreset(chip.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50"
                } disabled:opacity-60`}
              >
                {chip.label}
              </button>
            );
          })}
          <span
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              activePreset === "custom"
                ? "bg-emerald-700 text-white shadow-sm"
                : "border border-gray-200 bg-gray-50 text-gray-500"
            }`}
          >
            Custom Range
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[9.5rem]">
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
          <div className="min-w-[9.5rem]">
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
  return `rounded-md px-3 py-1.5 text-center text-[13px] font-semibold transition ${
    active
      ? "bg-white text-gray-900 shadow-sm shadow-gray-900/10"
      : "text-gray-500 hover:bg-white/70 hover:text-gray-800"
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
      className="inline-flex gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5"
      role="tablist"
      aria-label="Business History sections"
    >
      <Link
        href={daysHref}
        role="tab"
        aria-selected={tab === "days"}
        className={tabClass(tab === "days")}
      >
        Business
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
