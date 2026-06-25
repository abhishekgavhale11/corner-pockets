"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerDetails } from "@/actions/customers";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { CustomerDTO } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface CustomerInfoProps {
  customer: CustomerDTO;
  canEditDetails?: boolean;
}

export function CustomerInfo({
  customer,
  canEditDetails = false,
}: CustomerInfoProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const [state, formAction, isPending] = useActionState(
    async (
      _prev: { error?: string; success?: boolean } | null,
      formData: FormData
    ) => {
      const result = await updateCustomerDetails(formData);
      if (result.success) {
        setIsEditing(false);
        router.refresh();
        return { success: true };
      }
      return { error: result.error };
    },
    null
  );

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Customer Details</h2>
        {!isEditing && canEditDetails && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            Edit name, phone & card
          </Button>
        )}
      </div>

      {isEditing ? (
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="customerId" value={customer.id} />

          <div>
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              name="name"
              defaultValue={customer.name}
              required
              autoComplete="name"
            />
          </div>

          <div>
            <Label htmlFor="edit-phone">Phone Number</Label>
            <Input
              id="edit-phone"
              name="phone"
              type="tel"
              defaultValue={customer.phone}
              required
              autoComplete="tel"
              placeholder="10-digit mobile number"
            />
          </div>

          {customer.walletEnabled && (
            <div>
              <Label htmlFor="edit-card-id">Card ID</Label>
              <Input
                id="edit-card-id"
                name="cardId"
                defaultValue={customer.cardId}
                required
                placeholder="e.g. CP0001"
                className="uppercase"
                autoCapitalize="characters"
              />
            </div>
          )}

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" disabled={isPending} fullWidth>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                setIsEditing(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2">
            <InfoItem label="Name" value={customer.name} />
            <InfoItem label="Card ID" value={customer.cardId} />
            <InfoItem label="Phone Number" value={customer.phone} />
            <InfoItem
              label="Student Status"
              value={
                <Badge variant={customer.isStudent ? "success" : "neutral"}>
                  {customer.isStudent ? "Student" : "Club Member"}
                </Badge>
              }
            />
            {customer.studentStatusChangedAt && (
              <div className="sm:col-span-2 text-xs text-gray-500">
                Status last changed {formatDate(customer.studentStatusChangedAt)}
                {customer.studentStatusChangedBy &&
                  ` by ${customer.studentStatusChangedBy}`}
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Current Balance</dt>
              <dd className="mt-1 text-3xl font-bold text-emerald-800">
                {formatCurrency(customer.balance)}
              </dd>
            </div>
          </dl>

          {state?.success && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Customer details updated successfully.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 font-medium text-gray-900">{value}</dd>
    </div>
  );
}
