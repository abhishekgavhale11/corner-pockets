import { BusinessDayHistoryInsightCards } from "@/components/business-day/BusinessDayHistoryInsightCards";
import { BusinessDayHistoryWalletActivity } from "@/components/business-day/BusinessDayHistoryWalletActivity";
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
    <div className="space-y-5">
      <BusinessDayHistoryInsightCards
        insights={summary.insights}
        overallHint={`${summary.totalBusinessDays} closed Business Day${
          summary.totalBusinessDays === 1 ? "" : "s"
        } · ${rangeLabel}`}
      />
      <BusinessDayHistoryWalletActivity
        activity={summary.walletActivity}
        rangeHint={rangeLabel}
      />
    </div>
  );
}
