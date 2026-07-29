"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

interface CustomerFiltersProps {
  allCount: number;
  outstandingCount: number;
}

export function CustomerFilters({
  allCount,
  outstandingCount,
}: CustomerFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("filter") ?? "all";

  const setFilter = (filter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", filter);
    }
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `/customers?${qs}` : "/customers");
  };

  const filters = [
    { id: "all", label: "All", count: allCount },
    { id: "outstanding", label: "Outstanding", count: outstandingCount },
  ] as const;

  return (
    <div
      className="inline-flex h-[42px] items-stretch gap-1 rounded-[11px] border border-gray-200 bg-gray-50 p-1"
      role="tablist"
      aria-label="Customer filters"
    >
      {filters.map((filter) => {
        const isActive = active === filter.id;
        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setFilter(filter.id)}
            className={cn(
              "inline-flex items-center rounded-[9px] px-3.5 text-[13px] font-semibold transition-all duration-150",
              isActive
                ? "bg-white text-gray-900 shadow-sm shadow-gray-900/10"
                : "text-gray-500 hover:bg-white/70 hover:text-gray-800"
            )}
          >
            {filter.label}
            <span
              className={cn(
                "ml-1.5 tabular-nums",
                isActive ? "text-emerald-700" : "text-gray-400"
              )}
            >
              ({filter.count})
            </span>
          </button>
        );
      })}
    </div>
  );
}
