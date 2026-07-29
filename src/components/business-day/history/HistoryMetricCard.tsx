import type { ReactNode } from "react";
import {
  historyToneSurface,
  historyToneText,
  historyUi,
  type HistoryTone,
} from "@/components/business-day/history/tokens";

interface HistoryMetricCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: HistoryTone;
  icon?: ReactNode;
}

export function HistoryMetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: HistoryMetricCardProps) {
  return (
    <div
      className={`rounded-[12px] border px-4 py-3.5 shadow-sm shadow-gray-900/5 ${historyToneSurface(tone)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={historyUi.label}>{label}</p>
        {icon ? (
          <span className={`shrink-0 ${historyToneText(tone)}`}>{icon}</span>
        ) : null}
      </div>
      <p className={`mt-2 ${historyUi.cardValue} ${historyToneText(tone)}`}>
        {value}
      </p>
      {hint ? <p className={`mt-1.5 ${historyUi.metadata}`}>{hint}</p> : null}
    </div>
  );
}
