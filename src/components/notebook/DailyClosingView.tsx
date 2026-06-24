import { formatCurrency } from "@/lib/utils/format";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { DailyClosingDTO } from "@/types";
import { Card, CardTitle } from "@/components/ui/Card";

interface DailyClosingViewProps {
  closing: DailyClosingDTO;
}

export function DailyClosingView({ closing }: DailyClosingViewProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle className="mb-4">Payment Summary — {closing.date}</CardTitle>
        <dl className="grid gap-3 sm:grid-cols-2">
          <SummaryItem label="Cash Collection" value={closing.cashCollection} />
          <SummaryItem label="GPay Collection" value={closing.gpayCollection} />
          <SummaryItem
            label="Wallet Collection"
            value={closing.walletCollection}
          />
          <SummaryItem label="Pending Amount" value={closing.pendingAmount} />
          <div className="sm:col-span-2 border-t pt-3">
            <SummaryItem label="Grand Total" value={closing.grandTotal} bold />
          </div>
        </dl>
      </Card>

      <Card>
        <CardTitle className="mb-4">Section Summary (Paid Today)</CardTitle>
        <ul className="space-y-2">
          {closing.sectionSummary.map((row) => (
            <li
              key={row.section}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-700">{sectionLabel(row.section)}</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(row.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd
        className={
          bold
            ? "mt-1 text-2xl font-bold text-emerald-800"
            : "mt-1 text-lg font-semibold text-gray-900"
        }
      >
        {formatCurrency(value)}
      </dd>
    </div>
  );
}
