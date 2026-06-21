"use client";

import { useState } from "react";
import {
  verifyCustomerByCardId,
  verifyCustomersByPhone,
} from "@/actions/customers";
import type { VerificationMethod } from "@/lib/constants/verification";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils/cn";

interface CustomerVerificationProps {
  initialCardId?: string;
  onVerified: (customer: CustomerDTO, method: VerificationMethod) => void;
}

export function CustomerVerification({
  initialCardId,
  onVerified,
}: CustomerVerificationProps) {
  const [mode, setMode] = useState<"CARD" | "PHONE">("CARD");
  const [cardId, setCardId] = useState(initialCardId ?? "");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [phoneMatches, setPhoneMatches] = useState<CustomerDTO[]>([]);

  const handleCardSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPhoneMatches([]);
    setIsLoading(true);

    const formData = new FormData();
    formData.set("cardId", cardId);

    const result = await verifyCustomerByCardId(formData);
    setIsLoading(false);

    if (result.success) {
      onVerified(result.data, "CARD");
      return;
    }

    setError(result.error);
  };

  const handlePhoneSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPhoneMatches([]);
    setIsLoading(true);

    const formData = new FormData();
    formData.set("phone", phone);

    const result = await verifyCustomersByPhone(formData);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    if (result.data.length === 1) {
      onVerified(result.data[0], "PHONE");
      return;
    }

    setPhoneMatches(result.data);
  };

  return (
    <Card>
      <CardTitle className="mb-1">Verify Customer</CardTitle>
      <p className="mb-6 text-sm text-gray-500">
        Verify the customer using Card ID (preferred) or registered phone number.
        Name alone cannot be used for wallet operations.
      </p>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("CARD");
            setError(null);
            setPhoneMatches([]);
          }}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            mode === "CARD"
              ? "bg-emerald-800 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          Card ID
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("PHONE");
            setError(null);
            setPhoneMatches([]);
          }}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            mode === "PHONE"
              ? "bg-emerald-800 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          Phone Number
        </button>
      </div>

      {mode === "CARD" ? (
        <form onSubmit={handleCardSearch} className="space-y-4">
          <div>
            <Label htmlFor="verify-card-id">Card ID</Label>
            <Input
              id="verify-card-id"
              value={cardId}
              onChange={(event) => setCardId(event.target.value.toUpperCase())}
              placeholder="e.g. CP0001"
              required
              autoComplete="off"
            />
            <p className="mt-2 text-xs text-gray-500">
              Preferred when the customer presents their PVC card.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isLoading} fullWidth>
            {isLoading ? "Searching..." : "Find Customer by Card ID"}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <form onSubmit={handlePhoneSearch} className="space-y-4">
            <div>
              <Label htmlFor="verify-phone">Phone Number</Label>
              <Input
                id="verify-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Registered mobile number"
                required
                autoComplete="tel"
              />
              <p className="mt-2 text-xs text-gray-500">
                Use when the customer forgot their card. Select the correct
                customer if multiple records match.
              </p>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button type="submit" disabled={isLoading} fullWidth>
              {isLoading ? "Searching..." : "Find Customer by Phone"}
            </Button>
          </form>

          {phoneMatches.length > 1 && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-900">
                Multiple customers found — select the correct one:
              </p>
              {phoneMatches.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => onVerified(customer, "PHONE")}
                  className="flex w-full flex-col rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-emerald-600 hover:bg-emerald-50"
                >
                  <span className="font-medium text-gray-900">
                    {customer.name}
                  </span>
                  <span className="mt-1 text-sm text-gray-600">
                    {customer.cardId} ·{" "}
                    {customer.isStudent ? "Student" : "Club Member"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
