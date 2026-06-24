"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { enableWalletMembership } from "@/actions/customers";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface ConvertToMemberFormProps {
  customer: CustomerDTO;
}

export function ConvertToMemberForm({ customer }: ConvertToMemberFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await enableWalletMembership(formData);
      if (result.success) {
        router.refresh();
        return { success: true };
      }
      return { error: result.error };
    },
    null
  );

  if (customer.walletEnabled) {
    return null;
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-gray-200 p-3">
      <p className="text-xs font-medium text-gray-700">Convert to Member</p>
      <input type="hidden" name="customerId" value={customer.id} />
      {!customer.phone?.trim() && (
        <div>
          <Label htmlFor="convert-phone">Phone (required)</Label>
          <Input id="convert-phone" name="phone" type="tel" required />
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          name="isStudent"
          value="true"
          className="h-4 w-4 accent-emerald-800"
        />
        Student membership
      </label>
      {state?.error && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-emerald-700">Wallet membership enabled.</p>
      )}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Converting..." : "Enable Wallet"}
      </Button>
    </form>
  );
}
