import { formatDate } from "@/lib/utils/format";
import { formatBusinessDayTime } from "@/lib/business-day/format";

/** Compact payment receipt lines for history surfaces only. */
export function HistoryPaymentReceiptMeta({
  receivedByUsername,
  receivedAt,
  showPlaceholders = false,
  compact = false,
}: {
  receivedByUsername?: string;
  receivedAt?: string;
  /** When true, always render both lines (missing values as "—"). */
  showPlaceholders?: boolean;
  /** Narrow cards: one line, no By/At labels, hide empty placeholders. */
  compact?: boolean;
}) {
  const by = receivedByUsername?.trim() || null;
  const at = receivedAt || null;

  if (compact) {
    if (!by && !at) return null;

    const time = at ? formatBusinessDayTime(at) : null;
    const title = [by, at ? formatDate(at) : null].filter(Boolean).join(" · ");

    return (
      <p
        className="mt-0.5 min-w-0 truncate text-[9px] leading-tight text-gray-500"
        title={title}
      >
        {by ? (
          <span className="font-semibold text-gray-700">{by}</span>
        ) : null}
        {by && time ? <span className="text-gray-400"> · </span> : null}
        {time ? <span className="font-medium text-gray-600">{time}</span> : null}
      </p>
    );
  }

  if (!showPlaceholders && !by && !at) return null;

  const byLabel = "Received By";
  const atLabel = "Received At";

  if (!showPlaceholders) {
    return (
      <div className="mt-1 space-y-0.5 text-left text-[10px] leading-tight text-gray-500">
        {by ? (
          <p>
            {byLabel}: <span className="font-semibold text-gray-700">{by}</span>
          </p>
        ) : null}
        {at ? (
          <p>
            {atLabel}:{" "}
            <span className="font-medium text-gray-600">{formatDate(at)}</span>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-1 min-w-0 space-y-0.5 text-left text-[9px] leading-tight text-gray-500">
      <p className="truncate" title={by ?? undefined}>
        {byLabel}:{" "}
        <span className="font-semibold text-gray-700">{by ?? "—"}</span>
      </p>
      <p className="truncate">
        {atLabel}:{" "}
        <span className="font-medium text-gray-600">
          {at ? formatDate(at) : "—"}
        </span>
      </p>
    </div>
  );
}
