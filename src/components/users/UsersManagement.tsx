"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createUserAction,
  deleteUserAction,
  resetUserPasswordAction,
  updateUserAction,
} from "@/actions/staff";
import {
  roleLabel,
  toProductRole,
  type UserProductRole,
} from "@/lib/auth/roles";
import type { StaffAccountDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils/cn";

interface UsersManagementProps {
  users: StaffAccountDTO[];
  currentUserId: string;
}

type DialogMode =
  | { type: "create" }
  | { type: "edit"; user: StaffAccountDTO };

export function UsersManagement({
  users,
  currentUserId,
}: UsersManagementProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogMode | null>(null);

  const [state, formAction, isPending] = useActionState(
    async (
      _prev: { error?: string; success?: string } | null,
      formData: FormData
    ) => {
      const mode = String(formData.get("mode") ?? "");
      const result =
        mode === "create"
          ? await createUserAction(formData)
          : await updateUserAction(formData);

      if (result.success) {
        setDialog(null);
        router.refresh();
        return {
          success: mode === "create" ? "User created." : "User saved.",
        };
      }
      return { error: result.error };
    },
    null
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Users
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Login accounts for people who use CPOS.
          </p>
        </div>
        <Button type="button" onClick={() => setDialog({ type: "create" })}>
          + Add User
        </Button>
      </div>

      {state?.error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-3 py-3 text-left">Username</th>
                <th className="px-3 py-3 text-left">Role</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-gray-400"
                  >
                    No users yet. Add the first login account.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <tr
                      key={user.id}
                      className="border-t border-gray-50 transition hover:bg-emerald-50/30"
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {user.name}
                      </td>
                      <td className="px-3 py-3 text-gray-700">
                        {user.username}
                      </td>
                      <td className="px-3 py-3 text-gray-800">
                        {roleLabel(user.role)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusLabel active={user.isActive} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isSelf ? (
                          <span className="text-xs font-medium text-gray-400">
                            You
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setDialog({ type: "edit", user })}
                          >
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {dialog ? (
        <UserFormDialog
          mode={dialog}
          isPending={isPending}
          formAction={formAction}
          onClose={() => setDialog(null)}
          onPasswordReset={() => router.refresh()}
          onDeleted={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function StatusLabel({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-700">
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          active ? "bg-emerald-500" : "bg-gray-300"
        )}
        aria-hidden
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function UserFormDialog({
  mode,
  isPending,
  formAction,
  onClose,
  onPasswordReset,
  onDeleted,
}: {
  mode: DialogMode;
  isPending: boolean;
  formAction: (payload: FormData) => void;
  onClose: () => void;
  onPasswordReset: () => void;
  onDeleted: () => void;
}) {
  const isCreate = mode.type === "create";
  const user = mode.type === "edit" ? mode.user : null;
  const [role, setRole] = useState<UserProductRole>(
    user ? toProductRole(user.role) : "STAFF"
  );
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isResetting, startReset] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const handleResetPassword = () => {
    if (!user) return;
    setResetError(null);
    setResetSuccess(null);
    startReset(async () => {
      const formData = new FormData();
      formData.set("userId", user.id);
      formData.set("password", resetPassword);
      const result = await resetUserPasswordAction(formData);
      if (!result.success) {
        setResetError(result.error);
        return;
      }
      setResetPassword("");
      setResetSuccess("Password updated.");
      onPasswordReset();
    });
  };

  const handleDelete = () => {
    if (!user) return;
    setDeleteError(null);
    startDelete(async () => {
      const formData = new FormData();
      formData.set("userId", user.id);
      const result = await deleteUserAction(formData);
      if (!result.success) {
        setDeleteError(result.error);
        setConfirmDelete(false);
        return;
      }
      setConfirmDelete(false);
      onDeleted();
    });
  };

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={isCreate ? "Add User" : "Edit User"}
      >
        <form className="space-y-3" action={formAction}>
          <input type="hidden" name="mode" value={isCreate ? "create" : "edit"} />
          {!isCreate && user ? (
            <input type="hidden" name="userId" value={user.id} />
          ) : null}

          <div>
            <Label htmlFor="user-name">Name *</Label>
            <Input
              id="user-name"
              name="name"
              required
              defaultValue={user?.name ?? ""}
              className="mt-1"
              autoComplete="name"
            />
          </div>

          <div>
            <Label htmlFor="user-username">Username *</Label>
            <Input
              id="user-username"
              name="username"
              required
              defaultValue={user?.username ?? ""}
              className="mt-1"
              autoComplete="username"
            />
          </div>

          {isCreate ? (
            <div>
              <Label htmlFor="user-password">Password *</Label>
              <Input
                id="user-password"
                name="password"
                type="password"
                required
                minLength={6}
                className="mt-1"
                autoComplete="new-password"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="user-reset-password">Password</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="user-reset-password"
                  type="password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  minLength={6}
                  placeholder="New password"
                  className="flex-1"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isResetting || resetPassword.trim().length < 6}
                  onClick={handleResetPassword}
                  className="shrink-0"
                >
                  {isResetting ? "Saving..." : "Reset Password"}
                </Button>
              </div>
              {resetError ? (
                <p className="mt-1.5 text-sm text-red-600">{resetError}</p>
              ) : null}
              {resetSuccess ? (
                <p className="mt-1.5 text-sm text-emerald-700">{resetSuccess}</p>
              ) : null}
            </div>
          )}

          <div>
            <Label htmlFor="user-role">Role</Label>
            <select
              id="user-role"
              name="role"
              value={role}
              onChange={(event) =>
                setRole(event.target.value as UserProductRole)
              }
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>

          <div>
            <Label htmlFor="user-status">Status</Label>
            <select
              id="user-status"
              name="isActive"
              value={isActive ? "true" : "false"}
              onChange={(event) => setIsActive(event.target.value === "true")}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          {deleteError ? (
            <p className="text-sm text-red-600">{deleteError}</p>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={isPending || isResetting || isDeleting}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              fullWidth
              disabled={isPending || isResetting || isDeleting}
            >
              {isPending ? "Saving..." : isCreate ? "Save User" : "Save"}
            </Button>
          </div>

          {!isCreate && user ? (
            <div className="border-t border-gray-100 pt-3">
              <Button
                type="button"
                variant="danger"
                fullWidth
                disabled={isPending || isResetting || isDeleting}
                onClick={() => {
                  setDeleteError(null);
                  setConfirmDelete(true);
                }}
              >
                Delete User
              </Button>
            </div>
          ) : null}
        </form>
      </Dialog>

      {!isCreate && user ? (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => !isDeleting && setConfirmDelete(false)}
          onConfirm={handleDelete}
          title="Delete User"
          message={`Delete “${user.name}” (@${user.username})? This removes their login account and cannot be undone.`}
          confirmLabel="Delete"
          isLoading={isDeleting}
        />
      ) : null}
    </>
  );
}
