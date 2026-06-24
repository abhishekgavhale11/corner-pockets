"use client";

import { useEffect, useState, useTransition } from "react";
import { createQuickCustomer } from "@/actions/customers";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface CafeNewTabDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: CustomerDTO) => void;
}

export function CafeNewTabDialog({
  open,
  onClose,
  onCreated,
}: CafeNewTabDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setName("");
      setPhone("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name.trim());
      if (phone.trim()) {
        formData.set("phone", phone.trim());
      }
      const result = await createQuickCustomer(formData);
      if (result.success) {
        onCreated(result.data);
        onClose();
        return;
      }
      setError(result.error);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl">
        <h2 className="text-lg font-bold text-gray-900">New Customer</h2>
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div>
            <Label htmlFor="cafe-tab-name">Name *</Label>
            <Input
              id="cafe-tab-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="mt-1 h-10 text-base"
            />
          </div>
          <div>
            <Label htmlFor="cafe-tab-phone">Phone (optional)</Label>
            <Input
              id="cafe-tab-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 h-10 text-base"
            />
          </div>
          {error && (
            <p className="rounded bg-red-50 px-2 py-1.5 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              className="h-10 flex-1 text-sm font-semibold"
              disabled={isPending}
            >
              {isPending ? "Creating..." : "Create & Add Item"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-10 text-sm"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
