import type { HistoryTone } from "@/components/business-day/history/tokens";

interface StatusBadgeProps {
  label: string;
  tone?: HistoryTone;
}

function classFor(tone: HistoryTone): string {
  switch (tone) {
    case "positive":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "negative":
      return "border-red-100 bg-red-50 text-[#B71C1C]";
    case "info":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "bonus":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "muted":
      return "border-gray-200 bg-gray-50 text-gray-500";
    default:
      return "border-gray-200 bg-white text-gray-700";
  }
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold tabular-nums ${classFor(tone)}`}
    >
      {label}
    </span>
  );
}
