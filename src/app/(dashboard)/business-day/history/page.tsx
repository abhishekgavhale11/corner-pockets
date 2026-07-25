import { getBusinessDayHistoryListAction } from "@/actions/business-day-history";
import { BusinessDayHistoryFilters } from "@/components/business-day/BusinessDayHistoryFilters";
import { BusinessDayHistoryList } from "@/components/business-day/BusinessDayHistoryList";
import { BusinessDayHistorySummary } from "@/components/business-day/BusinessDayHistorySummary";
import { getDefaultBusinessDayHistoryRange } from "@/lib/utils/business-date";

interface BusinessDayHistoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

export default async function BusinessDayHistoryPage({
  searchParams,
}: BusinessDayHistoryPageProps) {
  const params = await searchParams;
  const defaults = getDefaultBusinessDayHistoryRange();
  const from = readParam(params.from) ?? defaults.from;
  const to = readParam(params.to) ?? defaults.to;

  const result = await getBusinessDayHistoryListAction({ from, to });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Business Day History
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Closed Business Days — scan revenue, cash, GPay, and outstanding in
          seconds. Read-only.
        </p>
      </div>

      <BusinessDayHistoryFilters
        key={`${result.from}-${result.to}`}
        from={result.from}
        to={result.to}
      />

      <BusinessDayHistorySummary
        summary={result.summary}
        from={result.from}
        to={result.to}
      />

      <BusinessDayHistoryList items={result.items} />
    </div>
  );
}
