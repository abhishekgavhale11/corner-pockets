"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateStudentStatus } from "@/actions/customers";
import { formatDate } from "@/lib/utils/format";
import type { CustomerDTO } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Dialog";

interface StudentStatusManagerProps {
  customer: CustomerDTO;
}

export function StudentStatusManager({ customer }: StudentStatusManagerProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const nextIsStudent = !customer.isStudent;

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await updateStudentStatus(formData);
      if (result.success) {
        setShowConfirm(false);
        router.refresh();
        return { success: true };
      }
      return { error: result.error };
    },
    null
  );

  const nextLabel = nextIsStudent ? "Student" : "Club Member";
  const currentLabel = customer.isStudent ? "Student" : "Club Member";

  return (
    <>
      <Card>
        <CardTitle className="mb-4">Student Status</CardTitle>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-500">Current status</p>
            <div className="mt-1">
              <Badge variant={customer.isStudent ? "success" : "neutral"}>
                {currentLabel}
              </Badge>
            </div>
            {customer.studentStatusChangedAt && (
              <p className="mt-2 text-xs text-gray-500">
                Last changed {formatDate(customer.studentStatusChangedAt)}
                {customer.studentStatusChangedBy &&
                  ` by ${customer.studentStatusChangedBy}`}
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowConfirm(true)}
            disabled={isPending}
          >
            Change to {nextLabel}
          </Button>
        </div>

        {state?.error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </p>
        )}

        {state?.success && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Student status updated successfully.
          </p>
        )}
      </Card>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          const formData = new FormData();
          formData.set("customerId", customer.id);
          formData.set("isStudent", nextIsStudent ? "true" : "false");
          formAction(formData);
        }}
        title="Confirm Status Change"
        message={`Change ${customer.name} from ${currentLabel} to ${nextLabel}? This affects which recharge plans they can use.`}
        confirmLabel={`Change to ${nextLabel}`}
        isLoading={isPending}
      />
    </>
  );
}
