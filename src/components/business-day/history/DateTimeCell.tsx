import {
  formatBusinessDayDate,
  formatBusinessDayTime,
} from "@/lib/business-day/format";
import { historyUi } from "@/components/business-day/history/tokens";

interface DateTimeCellProps {
  value: string;
}

export function DateTimeCell({ value }: DateTimeCellProps) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-medium tabular-nums text-gray-800">
        {formatBusinessDayDate(value)}
      </p>
      <p className={`mt-0.5 tabular-nums ${historyUi.metadata}`}>
        {formatBusinessDayTime(value)}
      </p>
    </div>
  );
}
