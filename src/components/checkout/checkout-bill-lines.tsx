import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function BillLineRow({
  label,
  amount,
  note,
}: {
  label: string;
  amount: number;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <div className="min-w-0 flex-1">
        <span className="font-medium text-gray-800">{label}</span>
        {note ? (
          <span className="mt-0.5 block text-xs font-medium text-gray-500">
            {note}
          </span>
        ) : null}
      </div>
      <span className="shrink-0 text-base font-semibold tabular-nums text-gray-900">
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

export function CompactBillGroup({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </p>
      <ul className="divide-y divide-gray-200/80">{children}</ul>
    </div>
  );
}

/** Single card wrapping all bill line groups */
export function CheckoutBillDetailsCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Bill details
      </p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
