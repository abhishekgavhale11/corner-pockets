"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { updateCustomerDetails } from "@/actions/customers";
import { formatCurrency } from "@/lib/utils/format";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CustomerNotesSection } from "@/components/customers/CustomerNotesSection";
import { ConvertToMemberForm } from "@/components/customers/ConvertToMemberForm";
import { CustomerActivityTimeline } from "@/components/customers/CustomerActivityTimeline";
import { RechargeDialog } from "@/components/wallet/RechargeDialog";
import type { CustomerActivityEventDTO } from "@/types";

interface CustomerDetailViewProps {
  customer: CustomerDTO;
  activity: CustomerActivityEventDTO[];
  canEditDetails: boolean;
  canReverseRecharges?: boolean;
  initialRechargeOpen?: boolean;
}

export function CustomerDetailView({
  customer,
  activity,
  canEditDetails,
  canReverseRecharges = false,
  initialRechargeOpen = false,
}: CustomerDetailViewProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(initialRechargeOpen);
  const base = `/customers/${customer.id}`;

  const closeRechargeDialog = () => {
    setRechargeOpen(false);
    const params = new URLSearchParams(window.location.search);
    if (params.has("recharge")) {
      params.delete("recharge");
      const qs = params.toString();
      router.replace(
        qs ? `${base}?${qs}` : base,
        { scroll: false }
      );
    }
  };

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
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
    <div>
      <Link
        href="/customers"
        className="mb-1 inline-block text-xs font-medium text-emerald-800 hover:underline"
      >
        ← Customers
      </Link>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,30%)_minmax(0,70%)]">
        <div className="space-y-2">
          <div className="border border-gray-200 bg-white px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h1 className="truncate text-base font-semibold text-gray-900">
                {customer.name}
              </h1>
              {canEditDetails && !isEditing && (
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-emerald-700 hover:underline"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <form action={formAction} className="space-y-2">
                <input type="hidden" name="customerId" value={customer.id} />
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={customer.name}
                  required
                  className="h-9 text-sm"
                />
                <Input
                  id="edit-phone"
                  name="phone"
                  type="tel"
                  defaultValue={customer.phone}
                  required
                  className="h-9 text-sm"
                />
                {customer.walletEnabled && (
                  <Input
                    id="edit-card-id"
                    name="cardId"
                    defaultValue={customer.cardId}
                    required
                    placeholder="Card ID"
                    className="h-9 text-sm uppercase"
                    autoCapitalize="characters"
                  />
                )}
                {state?.error && (
                  <p className="text-xs text-red-600">{state.error}</p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={isPending}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="font-medium">{customer.phone || "—"}</dd>
                </div>
                {customer.walletEnabled && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Card</dt>
                    <dd className="font-medium">{customer.cardId || "—"}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Balance</dt>
                  <dd className="font-semibold text-emerald-800">
                    {formatCurrency(customer.balance)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Member</dt>
                  <dd>{customer.walletEnabled ? (customer.isStudent ? "Student" : "Yes") : "No"}</dd>
                </div>
              </dl>
            )}
          </div>

          <div className="border border-gray-200 bg-white px-3 py-2">
            <CustomerNotesSection customer={customer} />
          </div>

          {!customer.walletEnabled && (
            <ConvertToMemberForm customer={customer} />
          )}

          <div className="flex flex-wrap gap-2 border border-gray-200 bg-white px-3 py-2">
            {customer.walletEnabled && (
              <>
                <Button size="sm" onClick={() => setRechargeOpen(true)}>
                  Recharge
                </Button>
                <Link href={`${base}/deduct`}>
                  <Button size="sm" variant="danger">
                    Deduct
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        <CustomerActivityTimeline
          customerId={customer.id}
          events={activity}
          canReverseRecharges={canReverseRecharges}
          fullHeight
        />
      </div>

      {customer.walletEnabled && (
        <RechargeDialog
          customer={customer}
          open={rechargeOpen}
          onClose={closeRechargeDialog}
        />
      )}
    </div>
  );
}
