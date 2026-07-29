type PaymentKind = "CASH" | "GPAY" | string | null | undefined;

function labelFor(method: PaymentKind): string {
  if (method === "CASH") return "Cash";
  if (method === "GPAY") return "GPay";
  if (!method) return "—";
  return method;
}

function classFor(method: PaymentKind): string {
  if (method === "CASH") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (method === "GPAY") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }
  return "border-gray-200 bg-gray-50 text-gray-500";
}

interface PaymentBadgeProps {
  method: PaymentKind;
}

export function PaymentBadge({ method }: PaymentBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold ${classFor(method)}`}
    >
      {labelFor(method)}
    </span>
  );
}
