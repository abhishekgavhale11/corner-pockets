import { cn } from "@/lib/utils/cn";

/** Shared History design tokens — spacing, type, surfaces. */
export const historyUi = {
  pageTitle: "text-[32px] font-semibold tracking-tight text-gray-900",
  pageSubtitle: "mt-1 text-sm text-gray-500",
  sectionTitle: "text-[18px] font-semibold tracking-tight text-gray-900",
  sectionSubtitle: "mt-1 text-[12px] text-gray-500",
  label: "text-[12px] font-medium uppercase tracking-wide text-gray-500",
  metadata: "text-[12px] text-gray-500",
  cardValue: "text-[28px] font-bold leading-none tabular-nums tracking-tight",
  amount: "text-[18px] font-bold leading-none tabular-nums",
  card:
    "rounded-[12px] border border-gray-200 bg-white shadow-sm shadow-gray-900/5",
  cardPad: "p-4 sm:p-6",
  rowHover: "transition-colors hover:bg-slate-50/80",
  spaceY: "space-y-6",
  gapMetrics: "gap-3 sm:gap-4",
} as const;

export type HistoryTone =
  | "neutral"
  | "positive"
  | "negative"
  | "info"
  | "bonus"
  | "muted";

export function historyToneText(tone: HistoryTone): string {
  switch (tone) {
    case "positive":
      return "text-emerald-800";
    case "negative":
      return "text-[#B71C1C]";
    case "info":
      return "text-sky-800";
    case "bonus":
      return "text-violet-700";
    case "muted":
      return "text-gray-500";
    default:
      return "text-gray-900";
  }
}

export function historyToneSurface(tone: HistoryTone): string {
  switch (tone) {
    case "positive":
      return "border-emerald-200 bg-emerald-50/70";
    case "negative":
      return "border-red-100 bg-red-50/50";
    case "info":
      return "border-sky-200 bg-sky-50/60";
    case "bonus":
      return "border-violet-200 bg-violet-50/60";
    case "muted":
      return "border-gray-200 bg-gray-50/80";
    default:
      return "border-gray-200 bg-white";
  }
}

export function historyToneIcon(tone: HistoryTone): string {
  switch (tone) {
    case "positive":
      return "bg-emerald-50 text-emerald-700";
    case "negative":
      return "bg-red-50 text-[#B71C1C]";
    case "info":
      return "bg-sky-50 text-sky-700";
    case "bonus":
      return "bg-violet-50 text-violet-700";
    case "muted":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function historyCn(...parts: Array<string | false | null | undefined>) {
  return cn(...parts);
}
