"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "@/actions/customers";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardTitle } from "@/components/ui/Card";

export function CustomerForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await createCustomer(formData);
      if (result.success) {
        router.push(`/customers/${result.data.id}`);
        return null;
      }
      return { error: result.error };
    },
    null
  );

  return (
    <Card>
      <CardTitle className="mb-6">Register Customer</CardTitle>
      <form action={formAction} className="space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="firstName">Name *</Label>
            <Input
              id="firstName"
              name="firstName"
              required
              autoComplete="given-name"
              autoFocus
              placeholder="Name"
            />
          </div>
          <div>
            <Label htmlFor="lastName">Surname *</Label>
            <Input
              id="lastName"
              name="lastName"
              required
              autoComplete="family-name"
              placeholder="Surname"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="10-digit mobile number"
          />
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
          <input
            id="isStudent"
            name="isStudent"
            type="checkbox"
            value="true"
            className="mt-1 h-5 w-5 accent-emerald-800"
          />
          <div>
            <Label htmlFor="isStudent" className="mb-0 cursor-pointer">
              Student Status
            </Label>
            <p className="mt-1 text-sm text-gray-500">
              Check if this customer qualifies for Student wallet recharge plans.
              Card ID is assigned automatically.
            </p>
          </div>
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={isPending} fullWidth>
            {isPending ? "Registering..." : "Register Customer"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
