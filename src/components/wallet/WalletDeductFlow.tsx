"use client";

import { useState } from "react";
import type { VerificationMethod } from "@/lib/constants/verification";
import type { CustomerDTO } from "@/types";
import { CustomerVerification } from "@/components/wallet/CustomerVerification";
import { WalletCustomerConfirmation } from "@/components/wallet/WalletCustomerConfirmation";
import { DeductForm } from "@/components/transactions/DeductForm";

type WalletStep = "verify" | "confirm" | "operate";

interface WalletDeductFlowProps {
  initialCardId?: string;
}

export function WalletDeductFlow({ initialCardId }: WalletDeductFlowProps) {
  const [step, setStep] = useState<WalletStep>("verify");
  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [verificationMethod, setVerificationMethod] =
    useState<VerificationMethod | null>(null);

  const resetFlow = () => {
    setStep("verify");
    setCustomer(null);
    setVerificationMethod(null);
  };

  if (step === "verify") {
    return (
      <CustomerVerification
        initialCardId={initialCardId}
        onVerified={(verifiedCustomer, method) => {
          setCustomer(verifiedCustomer);
          setVerificationMethod(method);
          setStep("confirm");
        }}
      />
    );
  }

  if (step === "confirm" && customer && verificationMethod) {
    return (
      <WalletCustomerConfirmation
        customer={customer}
        verificationMethod={verificationMethod}
        onConfirm={() => setStep("operate")}
        onBack={resetFlow}
      />
    );
  }

  if (step === "operate" && customer && verificationMethod) {
    return (
      <div className="space-y-4">
        <DeductForm
          customerId={customer.id}
          currentBalance={customer.balance}
          verificationMethod={verificationMethod}
        />
        <button
          type="button"
          onClick={resetFlow}
          className="text-sm font-medium text-emerald-800 hover:underline"
        >
          Verify a different customer
        </button>
      </div>
    );
  }

  return null;
}
