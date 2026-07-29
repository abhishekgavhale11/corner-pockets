import { formatDate } from "@/lib/utils/format";

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
  /** Narrow cards: shorter labels and truncating values. */
  compact?: boolean;
}) {
  if (!showPlaceholders && !receivedByUsername && !receivedAt) return null;

  const by = receivedByUsername?.trim() || null;
  const at = receivedAt || null;
  const byLabel = compact ? "By" : "Received By";
  const atLabel = compact ? "At" : "Received At";

  if (!showPlaceholders) {
    return (
      <div className="mt-1 space-y-0.5 text-left text-[10px] leading-tight text-gray-500">
        {by ? (
          <p className={compact ? "truncate" : undefined} title={by}>
            {byLabel}: <span className="font-semibold text-gray-700">{by}</span>
          </p>
        ) : null}
        {at ? (
          <p className={compact ? "truncate" : undefined}>
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
