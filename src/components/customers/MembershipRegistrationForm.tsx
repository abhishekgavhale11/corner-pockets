"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "@/actions/customers";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface MembershipRegistrationFormProps {
  onSuccess: (customerId: string) => void;
  onCancel: () => void;
}

export function MembershipRegistrationForm({
  onSuccess,
  onCancel,
}: MembershipRegistrationFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await createCustomer(formData);
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
          <Label htmlFor="member-first-name">Name</Label>
          <Input
            id="member-first-name"
            name="firstName"
            required
            placeholder="Name"
          />
        </div>
        <div>
          <Label htmlFor="member-last-name">Surname</Label>
          <Input
            id="member-last-name"
            name="lastName"
            required
            placeholder="Surname"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="member-phone">Phone</Label>
        <Input id="member-phone" name="phone" type="tel" required />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="isStudent"
          value="true"
          className="h-4 w-4 accent-emerald-800"
        />
        Student membership
      </label>
      <p className="text-xs text-gray-500">
        Wallet enabled. Card ID assigned automatically.
      </p>
      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} className="flex-1">
          {isPending ? "Creating..." : "Register"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
