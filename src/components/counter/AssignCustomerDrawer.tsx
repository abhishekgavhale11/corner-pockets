"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { assignCounterEntryCustomer } from "@/actions/notebook-entries";
import type { NotebookEntryDTO } from "@/types";
import { formatCurrency } from "@/lib/utils/format";
import { formatTime } from "@/lib/utils/format-time";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import { CustomerPickerDialog } from "@/components/customers/CustomerPickerDialog";
import { invalidateCustomerGlanceCache } from "@/components/counter/CustomerPreviewContext";

interface AssignCustomerDrawerProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
}

export function AssignCustomerDrawer({ entry, onClose }: AssignCustomerDrawerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!entry) return null;

  const assign = (customerId: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("entryId", entry.id);
      formData.set("customerId", customerId);
      const result = await assignCounterEntryCustomer(formData);
      if (result.success) {
        invalidateCustomerGlanceCache(customerId);
        router.refresh();
        onClose();
      }
    });
  };

  return (
    <CustomerPickerDialog
      open
      onClose={onClose}
      onSelect={(customer) => assign(customer.id)}
      disabled={isPending}
      title="Assign customer"
      subtitle={`${formatTime(entry.createdAt)} · ${getEntryDisplayLabel(entry)} · ${formatCurrency(entry.amount)}`}
      selectLabel="Create & assign"
    />
  );
}
