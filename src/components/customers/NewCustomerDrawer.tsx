"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuickCustomerForm } from "@/components/customers/QuickCustomerForm";
import { MembershipRegistrationForm } from "@/components/customers/MembershipRegistrationForm";
import { Button } from "@/components/ui/Button";

interface NewCustomerDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function NewCustomerDrawer({ open, onClose }: NewCustomerDrawerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"quick" | "membership">("quick");

  if (!open) return null;

  const handleSuccess = (customerId: string) => {
    onClose();
    router.push(`/customers/${customerId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-lg bg-white p-4 shadow-xl sm:rounded-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">New Customer</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "quick" ? "primary" : "secondary"}
            onClick={() => setMode("quick")}
          >
            Quick Customer
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "membership" ? "primary" : "secondary"}
            onClick={() => setMode("membership")}
          >
            Membership
          </Button>
        </div>

        {mode === "quick" ? (
          <QuickCustomerForm onSuccess={handleSuccess} onCancel={onClose} />
        ) : (
          <MembershipRegistrationForm
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}

interface NewCustomerButtonProps {
  autoOpen?: boolean;
}

export function NewCustomerButton({ autoOpen = false }: NewCustomerButtonProps) {
  const [open, setOpen] = useState(autoOpen);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 px-4 text-sm font-semibold shadow-sm"
      >
        + New Customer
      </Button>
      <NewCustomerDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
