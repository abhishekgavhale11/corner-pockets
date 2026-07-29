import { formatCurrency } from "@/lib/utils/format";
import {
  historyToneText,
  historyUi,
  type HistoryTone,
} from "@/components/business-day/history/tokens";

interface AmountCellProps {
  amount: number;
  tone?: HistoryTone;
  prefix?: string;
  label?: string;
  align?: "left" | "right";
}

export function AmountCell({
  amount,
  tone = "neutral",
  prefix = "",
  label,
  align = "right",
}: AmountCellProps) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      {label ? <p className={historyUi.label}>{label}</p> : null}
      <p
        className={`${label ? "mt-1" : ""} whitespace-nowrap ${historyUi.amount} ${historyToneText(tone)}`}
      >
        {prefix}
        {formatCurrency(amount)}
      </p>
    </div>
  );
}
