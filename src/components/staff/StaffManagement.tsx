"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  resetStaffPassword,
  setStaffActiveStatus,
  updateStaffRole,
} from "@/actions/staff";
import {
  canChangeRole,
  canResetPassword,
  canSetActiveStatus,
  roleLabel,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/auth/roles";
import { formatDate } from "@/lib/utils/format";
import type { StaffAccountDTO } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface StaffManagementProps {
  staffAccounts: StaffAccountDTO[];
  currentUserId: string;
  currentUserRole: StaffRole;
}

type DialogAction =
  | { type: "reset-password"; staff: StaffAccountDTO }
  | { type: "toggle-active"; staff: StaffAccountDTO; nextActive: boolean }
  | { type: "change-role"; staff: StaffAccountDTO; nextRole: StaffRole };

export function StaffManagement({
  staffAccounts,
  currentUserId,
  currentUserRole,
}: StaffManagementProps) {
  const router = useRouter();
  const [dialogAction, setDialogAction] = useState<DialogAction | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [state, formAction, isPending] = useActionState(
    async (
      _prev: { error?: string; success?: string } | null,
      formData: FormData
    ) => {
      const action = formData.get("action");

      if (action === "reset-password") {
        const result = await resetStaffPassword(formData);
        if (result.success) {
          setDialogAction(null);
          setNewPassword("");
          router.refresh();
          return { success: "Password reset successfully." };
        }
        return { error: result.error };
      }

      if (action === "toggle-active") {
        const result = await setStaffActiveStatus(formData);
        if (result.success) {
          setDialogAction(null);
          router.refresh();
          return {
            success: result.data.isActive
              ? "Account activated successfully."
              : "Account deactivated successfully.",
          };
        }
        return { error: result.error };
      }

      if (action === "change-role") {
        const result = await updateStaffRole(formData);
        if (result.success) {
          setDialogAction(null);
          router.refresh();
          return { success: "Role updated successfully." };
        }
        return { error: result.error };
      }

      return { error: "Unknown action" };
    },
    null
  );

  const closeDialog = () => {
    setDialogAction(null);
    setNewPassword("");
  };

  return (
    <>
      <Card>
        <CardTitle className="mb-4">Staff Accounts</CardTitle>

        {state?.error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </p>
        )}

        {state?.success && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {state.success}
          </p>
        )}

        {staffAccounts.length === 0 ? (
          <p className="text-sm text-gray-500">No staff accounts to manage.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {staffAccounts.map((staff) => {
              const isSelf = staff.id === currentUserId;
              const canReset =
                !isSelf && canResetPassword(currentUserRole, staff.role);
              const canToggleActive =
                !isSelf && canSetActiveStatus(currentUserRole, staff.role);
              const canEditRole = !isSelf && canChangeRole(currentUserRole);
              const assignableRoles = STAFF_ROLES.filter(
                (role) => role !== staff.role
              );

              return (
                <li
                  key={staff.id}
                  className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-gray-900">{staff.name}</p>
                      <Badge variant={staff.isActive ? "success" : "neutral"}>
                        {staff.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {isSelf && <Badge variant="neutral">You</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      @{staff.username} · {roleLabel(staff.role)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Created {formatDate(staff.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {canReset && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setNewPassword("");
                          setDialogAction({
                            type: "reset-password",
                            staff,
                          });
                        }}
                      >
                        Reset password
                      </Button>
                    )}

                    {canToggleActive && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setDialogAction({
                            type: "toggle-active",
                            staff,
                            nextActive: !staff.isActive,
                          })
                        }
                      >
                        {staff.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    )}

                    {canEditRole &&
                      assignableRoles.map((nextRole) => (
                        <Button
                          key={nextRole}
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setDialogAction({
                              type: "change-role",
                              staff,
                              nextRole,
                            })
                          }
                        >
                          Change to {roleLabel(nextRole)}
                        </Button>
                      ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {dialogAction?.type === "reset-password" && (
        <Dialog open onClose={closeDialog} title="Reset Password">
          <p className="text-sm text-gray-600">
            Set a new password for {dialogAction.staff.name} (@
            {dialogAction.staff.username}).
          </p>
          <form
            className="mt-4 space-y-4"
            action={formAction}
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              formData.set("action", "reset-password");
              formData.set("staffId", dialogAction.staff.id);
              formAction(formData);
            }}
          >
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <Button
                type="submit"
                disabled={isPending || newPassword.length < 6}
                fullWidth
              >
                {isPending ? "Saving..." : "Reset Password"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={closeDialog}
                disabled={isPending}
                fullWidth
              >
                Cancel
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {dialogAction?.type === "toggle-active" && (
        <ConfirmDialog
          open
          onClose={closeDialog}
          onConfirm={() => {
            const formData = new FormData();
            formData.set("action", "toggle-active");
            formData.set("staffId", dialogAction.staff.id);
            formData.set(
              "isActive",
              dialogAction.nextActive ? "true" : "false"
            );
            formAction(formData);
          }}
          title={
            dialogAction.nextActive ? "Activate Account" : "Deactivate Account"
          }
          message={
            dialogAction.nextActive
              ? `Activate ${dialogAction.staff.name}'s account? They will be able to sign in again.`
              : `Deactivate ${dialogAction.staff.name}'s account? They will not be able to sign in.`
          }
          confirmLabel={dialogAction.nextActive ? "Activate" : "Deactivate"}
          isLoading={isPending}
        />
      )}

      {dialogAction?.type === "change-role" && (
        <ConfirmDialog
          open
          onClose={closeDialog}
          onConfirm={() => {
            const formData = new FormData();
            formData.set("action", "change-role");
            formData.set("staffId", dialogAction.staff.id);
            formData.set("role", dialogAction.nextRole);
            formAction(formData);
          }}
          title="Change Role"
          message={`Change ${dialogAction.staff.name}'s role to ${roleLabel(dialogAction.nextRole)}?`}
          confirmLabel="Change Role"
          isLoading={isPending}
        />
      )}
    </>
  );
}
