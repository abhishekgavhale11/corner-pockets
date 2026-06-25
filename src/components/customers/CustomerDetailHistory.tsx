import { formatDate } from "@/lib/utils/format";
import type { CustomerDetailChangeDTO } from "@/types";
import { Card, CardTitle } from "@/components/ui/Card";

interface CustomerDetailHistoryProps {
  detailChanges: CustomerDetailChangeDTO[];
}

const fieldLabels = {
  name: "Name",
  phone: "Phone",
  cardId: "Card ID",
} as const;

export function CustomerDetailHistory({
  detailChanges,
}: CustomerDetailHistoryProps) {
  return (
    <Card>
      <CardTitle className="mb-4">Detail Change History</CardTitle>

      {detailChanges.length === 0 ? (
        <p className="text-sm text-gray-500">
          No name, phone, or card ID changes recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {detailChanges.map((entry) => (
            <li key={entry.changedAt} className="py-4 first:pt-0 last:pb-0">
              <p className="text-sm text-gray-500">
                {formatDate(entry.changedAt)} · {entry.changedBy}
              </p>
              <ul className="mt-2 space-y-1">
                {entry.changes.map((change) => (
                  <li
                    key={`${entry.changedAt}-${change.field}`}
                    className="text-sm text-gray-900"
                  >
                    <span className="font-medium">
                      {fieldLabels[change.field]}:
                    </span>{" "}
                    <span className="text-gray-600 line-through">
                      {change.from}
                    </span>{" "}
                    <span className="text-gray-400">→</span>{" "}
                    <span className="font-medium">{change.to}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
