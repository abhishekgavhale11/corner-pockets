"use client";

import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils/format";
import { checkoutHrefForCustomer } from "@/lib/utils/checkout-navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface ActiveVisitCheckoutDialogProps {
  customerId: string;
  activeVisitDueAmount: number;
  open: boolean;
  onClose: () => void;
}

export function ActiveVisitCheckoutDialog({
  customerId,
  activeVisitDueAmount,
  open,
  onClose,
}: ActiveVisitCheckoutDialogProps) {
  const router = useRouter();

  const openCheckout = () => {
    onClose();
    router.push(checkoutHrefForCustomer(customerId));
  };

  return (
    <Dialog open={open} onClose={onClose} title="Active Visit Detected">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          This customer currently has an active visit with a pending bill.
        </p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Current Visit Due
          </p>
          <p className="text-lg font-bold text-amber-900">
            {formatCurrency(activeVisitDueAmount)}
          </p>
        </div>
        <p className="text-sm text-gray-700">
          Today&apos;s visit payments must be collected from Checkout. Outstanding
          balance payments are blocked until the visit bill is settled.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={openCheckout}>
            Open Checkout
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
