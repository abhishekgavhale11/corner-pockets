"use client";

import { useState } from "react";
import type { VerificationMethod } from "@/lib/constants/verification";
import { formatCurrency } from "@/lib/utils/format";
import { maskPhone } from "@/lib/utils/phone";
import type { CustomerDTO } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";

interface WalletCustomerConfirmationProps {
  customer: CustomerDTO;
  verificationMethod: VerificationMethod;
  onConfirm: () => void;
  onBack: () => void;
}

export function WalletCustomerConfirmation({
  customer,
  verificationMethod,
  onConfirm,
  onBack,
}: WalletCustomerConfirmationProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Card>
      <CardTitle className="mb-4">Confirm Customer</CardTitle>
      <p className="mb-6 text-sm text-gray-500">
        Review the customer details below before continuing. Verified using{" "}
        <strong>{verificationMethod}</strong>.
      </p>

      <dl className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-gray-500">Customer Name</dt>
          <dd className="mt-1 font-medium text-gray-900">{customer.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Card ID</dt>
          <dd className="mt-1 font-medium text-gray-900">{customer.cardId}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Phone Number</dt>
          <dd className="mt-1 font-medium text-gray-900">
            {maskPhone(customer.phone)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Student / Club Status</dt>
          <dd className="mt-1">
            <Badge variant={customer.isStudent ? "success" : "neutral"}>
              {customer.isStudent ? "Student" : "Club Member"}
            </Badge>
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-gray-500">Current Balance</dt>
          <dd className="mt-1 text-2xl font-bold text-emerald-800">
            {formatCurrency(customer.balance)}
          </dd>
        </div>
      </dl>

      <label className="mt-6 flex items-start gap-3 rounded-lg border border-gray-200 p-4">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 h-5 w-5 accent-emerald-800"
        />
        <span className="text-sm text-gray-900">
          I confirm this is the correct customer.
        </span>
      </label>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          onClick={onConfirm}
          disabled={!confirmed}
          fullWidth
        >
          Continue
        </Button>
        <Button type="button" variant="secondary" onClick={onBack} fullWidth>
          Search Again
        </Button>
      </div>
    </Card>
  );
}
