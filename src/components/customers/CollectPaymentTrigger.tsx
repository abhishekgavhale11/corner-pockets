"use client";

import { useState } from "react";
import { CollectPaymentDialog } from "@/components/customers/CollectPaymentDialog";
import { Button } from "@/components/ui/Button";
import type { CustomerDTO } from "@/types";

interface CollectPaymentTriggerProps {
  customer: Pick<CustomerDTO, "id" | "name" | "cardId" | "phone">;
  outstandingAmount: number;
  hasActiveVisitWithDue: boolean;
  activeVisitDueAmount: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CollectPaymentTrigger({
  customer,
  outstandingAmount,
  hasActiveVisitWithDue: _hasActiveVisitWithDue,
  activeVisitDueAmount: _activeVisitDueAmount,
  size = "sm",
  className,
}: CollectPaymentTriggerProps) {
  const [collectOpen, setCollectOpen] = useState(false);

  if (outstandingAmount <= 0) {
    return null;
  }

  return (
    <>
      <Button size={size} className={className} onClick={() => setCollectOpen(true)}>
        Collect Payment
      </Button>

      <CollectPaymentDialog
        customer={customer}
        outstandingAmount={outstandingAmount}
        open={collectOpen}
        onClose={() => setCollectOpen(false)}
      />
    </>
  );
}
