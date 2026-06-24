"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { updateCustomerDetails } from "@/actions/customers";
import { formatCurrency } from "@/lib/utils/format";
import { hasMembershipCardId } from "@/lib/utils/customer-display";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CustomerNotesSection } from "@/components/customers/CustomerNotesSection";
import { ConvertToMemberForm } from "@/components/customers/ConvertToMemberForm";
import { CustomerActivityTimeline } from "@/components/customers/CustomerActivityTimeline";
import type { CustomerActivityEventDTO } from "@/types";

interface CustomerDetailViewProps {
  customer: CustomerDTO;
  activity: CustomerActivityEventDTO[];
  canEditDetails: boolean;
  canReverseSettlements?: boolean;
}

export function CustomerDetailView({
  customer,
  activity,
  canEditDetails,
  canReverseSettlements = false,
}: CustomerDetailViewProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const base = `/customers/${customer.id}`;

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
        className="mb-0.5 inline-block text-[10px] font-medium text-emerald-800 hover:underline"
      >
        ← Customers
      </Link>

      <div className="grid gap-1 lg:grid-cols-[minmax(0,30%)_minmax(0,70%)]">
        <div className="space-y-1">
          <div className="border border-gray-200 bg-white px-2 py-1.5">
            <div className="mb-1 flex items-center justify-between gap-1">
              <h1 className="truncate text-[13px] font-semibold text-gray-900">
                {customer.name}
              </h1>
              {canEditDetails && !isEditing && (
                <button
                  type="button"
                  className="shrink-0 text-[10px] font-medium text-emerald-700 hover:underline"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <form action={formAction} className="space-y-1">
                <input type="hidden" name="customerId" value={customer.id} />
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={customer.name}
                  required
                  className="h-6 text-[11px]"
                />
                <Input
                  id="edit-phone"
                  name="phone"
                  type="tel"
                  defaultValue={customer.phone}
                  required
                  className="h-6 text-[11px]"
                />
                {state?.error && (
                  <p className="text-[10px] text-red-600">{state.error}</p>
                )}
                <div className="flex gap-1">
                  <Button type="submit" size="sm" className="h-6 text-[10px]" disabled={isPending}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="space-y-0.5 text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="font-medium">{customer.phone || "—"}</dd>
                </div>
                {hasMembershipCardId(customer) && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Card</dt>
                    <dd className="font-medium">{customer.cardId}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Balance</dt>
                  <dd className="font-semibold text-emerald-800">
                    {formatCurrency(customer.balance)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Member</dt>
                  <dd>{customer.walletEnabled ? (customer.isStudent ? "Student" : "Yes") : "No"}</dd>
                </div>
              </dl>
            )}
          </div>

          <div className="border border-gray-200 bg-white px-2 py-1">
            <CustomerNotesSection customer={customer} />
          </div>

          {!customer.walletEnabled && (
            <ConvertToMemberForm customer={customer} />
          )}

          <div className="flex flex-wrap gap-1 border border-gray-200 bg-white px-2 py-1">
            {customer.walletEnabled && (
              <>
                <Link href={`${base}/recharge`}>
                  <Button size="sm" className="h-6 px-2 text-[10px]">
                    Recharge
                  </Button>
                </Link>
                <Link href={`${base}/deduct`}>
                  <Button size="sm" variant="danger" className="h-6 px-2 text-[10px]">
                    Deduct
                  </Button>
                </Link>
              </>
            )}
            <Link href={`${base}/transactions`}>
              <Button size="sm" variant="secondary" className="h-6 px-2 text-[10px]">
                Txns
              </Button>
            </Link>
          </div>
        </div>

        <CustomerActivityTimeline
          customerId={customer.id}
          events={activity}
          canReverseSettlements={canReverseSettlements}
          fullHeight
        />
      </div>
    </div>
  );
}
