"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createQuickCustomer } from "@/actions/customers";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface QuickCustomerFormProps {
  onSuccess: (customerId: string) => void;
  onCancel: () => void;
}

export function QuickCustomerForm({ onSuccess, onCancel }: QuickCustomerFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await createQuickCustomer(formData);
      if (result.success) {
        router.refresh();
        onSuccess(result.data.id);
        return null;
      }
      return { error: result.error };
    },
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="quick-first-name">Name</Label>
          <Input
            id="quick-first-name"
            name="firstName"
            required
            autoFocus
            placeholder="Name"
          />
        </div>
        <div>
          <Label htmlFor="quick-last-name">Surname</Label>
          <Input
            id="quick-last-name"
            name="lastName"
            required
            placeholder="Surname"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="quick-phone">Phone (optional)</Label>
        <Input id="quick-phone" name="phone" type="tel" />
      </div>
      <p className="text-xs text-gray-500">
        Saved to the main customer database. Add a membership card from their profile later.
      </p>
      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} className="flex-1">
          {isPending ? "Creating..." : "Create"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
