"use client";

import { useEffect, useState } from "react";
import { CollectPaymentDialog } from "@/components/customers/CollectPaymentDialog";
import { ActiveVisitCheckoutDialog } from "@/components/customers/ActiveVisitCheckoutDialog";
import { Button } from "@/components/ui/Button";
import type { CustomerDTO } from "@/types";

interface CollectPaymentTriggerProps {
  customer: Pick<
    CustomerDTO,
    "id" | "name" | "walletEnabled" | "cardId" | "phone"
  >;
  outstandingAmount: number;
  hasActiveVisitWithDue: boolean;
  activeVisitDueAmount: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CollectPaymentTrigger({
  customer,
  outstandingAmount,
  hasActiveVisitWithDue,
  activeVisitDueAmount,
  size = "sm",
  className,
}: CollectPaymentTriggerProps) {
  const [collectOpen, setCollectOpen] = useState(false);
  const [activeVisitModalOpen, setActiveVisitModalOpen] = useState(false);

  useEffect(() => {
    if (!hasActiveVisitWithDue) return;
    setCollectOpen(false);
  }, [hasActiveVisitWithDue]);

  const handleCollectClick = () => {
    if (hasActiveVisitWithDue) {
      setCollectOpen(false);
      setActiveVisitModalOpen(true);
      return;
    }
    setActiveVisitModalOpen(false);
    setCollectOpen(true);
  };

  if (outstandingAmount <= 0) {
    return null;
  }

  return (
    <>
      <Button size={size} className={className} onClick={handleCollectClick}>
        Collect Payment
      </Button>

      {hasActiveVisitWithDue ? (
        <ActiveVisitCheckoutDialog
          customerId={customer.id}
          activeVisitDueAmount={activeVisitDueAmount}
          open={activeVisitModalOpen}
          onClose={() => setActiveVisitModalOpen(false)}
        />
      ) : (
        <CollectPaymentDialog
          customer={customer}
          outstandingAmount={outstandingAmount}
          open={collectOpen}
          onClose={() => setCollectOpen(false)}
        />
      )}
    </>
  );
}
