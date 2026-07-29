import { BusinessDayHistoryInsightCards } from "@/components/business-day/BusinessDayHistoryInsightCards";
import { formatBusinessDayDate } from "@/lib/business-day/format";
import type { BusinessDayHistorySummaryDTO } from "@/types";

interface BusinessDayHistorySummaryProps {
  summary: BusinessDayHistorySummaryDTO;
  from: string;
  to: string;
}

export function BusinessDayHistorySummary({
  summary,
  from,
  to,
}: BusinessDayHistorySummaryProps) {
  const rangeLabel =
    from === to
      ? formatBusinessDayDate(`${from}T12:00:00+05:30`)
      : `${formatBusinessDayDate(`${from}T12:00:00+05:30`)} → ${formatBusinessDayDate(`${to}T12:00:00+05:30`)}`;

  return (
    <BusinessDayHistoryInsightCards
      insights={summary.insights}
      overallTitle="Business Overview"
      overallHint={`${summary.totalBusinessDays} closed Business Day${
        summary.totalBusinessDays === 1 ? "" : "s"
      } · ${rangeLabel}`}
    />
  );
}
