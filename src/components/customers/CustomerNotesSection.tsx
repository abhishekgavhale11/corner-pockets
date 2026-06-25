"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerNotes } from "@/actions/customers";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

interface CustomerNotesSectionProps {
  customer: CustomerDTO;
}

export function CustomerNotesSection({ customer }: CustomerNotesSectionProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await updateCustomerNotes(formData);
      if (result.success) {
        router.refresh();
        return { success: true };
      }
      return { error: result.error };
    },
    null
  );

  return (
    <form action={formAction} className="flex items-start gap-2">
      <input type="hidden" name="customerId" value={customer.id} />
      <Textarea
        id="customer-notes"
        name="notes"
        defaultValue={customer.notes ?? ""}
        rows={2}
        className="min-h-[2.5rem] flex-1 resize-none py-1.5 text-sm"
        placeholder="Notes…"
      />
      <Button type="submit" size="sm" className="shrink-0" disabled={isPending}>
        {isPending ? "…" : "Save"}
      </Button>
      {state?.error && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
    </form>
  );
}
