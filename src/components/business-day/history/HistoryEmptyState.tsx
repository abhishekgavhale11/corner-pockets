import { historyUi } from "@/components/business-day/history/tokens";

interface HistoryEmptyStateProps {
  message: string;
}

export function HistoryEmptyState({ message }: HistoryEmptyStateProps) {
  return (
    <div
      className={`${historyUi.card} px-4 py-10 text-center text-sm text-gray-500`}
    >
      {message}
    </div>
  );
}

export function HistoryLoadingState({
  label = "Loading…",
}: {
  label?: string;
}) {
  return (
    <div
      className={`${historyUi.card} px-4 py-10 text-center text-sm text-gray-400`}
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  );
}
