import { paymentMethodLabel } from "@/lib/constants/notebook-payments";
import { formatCurrency } from "@/lib/utils/format";
import { frameDueAmount, framePaidAmount } from "@/lib/utils/frame-payment";

/** Read-only status cell — same rules as Counter Due column. */
export function HistoryPaymentStatusCell({
  amount,
  paidAmount,
  paymentMethod,
}: {
  amount: number;
  paidAmount?: number;
  paymentMethod?: "CASH" | "GPAY" | "WALLET";
}) {
  const paid = framePaidAmount(paidAmount);
  const due = frameDueAmount(amount, paid);

  if (due <= 0) {
    if (paymentMethod === "CASH") {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
          {paymentMethodLabel("CASH")}
        </span>
      );
    }
    if (paymentMethod === "GPAY") {
      return (
        <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 ring-1 ring-sky-100">
          {paymentMethodLabel("GPAY")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
        Paid
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-orange-700 ring-1 ring-orange-100">
      Due {formatCurrency(due)}
    </span>
  );
}
