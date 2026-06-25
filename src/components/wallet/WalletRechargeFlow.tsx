"use client";

import { useState } from "react";
import type { VerificationMethod } from "@/lib/constants/verification";
import { verificationMethodForKnownCustomer } from "@/lib/constants/verification";
import { getPlansForCustomer } from "@/lib/constants/recharge-plans";
import type { CustomerDTO } from "@/types";
import { CustomerVerification } from "@/components/wallet/CustomerVerification";
import { WalletCustomerConfirmation } from "@/components/wallet/WalletCustomerConfirmation";
import { RechargeForm } from "@/components/transactions/RechargeForm";

type WalletStep = "verify" | "confirm" | "operate";

interface WalletRechargeFlowProps {
  initialCardId?: string;
  initialCustomer?: CustomerDTO;
}

function initialStep(customer?: CustomerDTO): WalletStep {
  return customer ? "operate" : "verify";
}

export function WalletRechargeFlow({
  initialCardId,
  initialCustomer,
}: WalletRechargeFlowProps) {
  const [step, setStep] = useState<WalletStep>(() =>
    initialStep(initialCustomer)
  );
  const [customer, setCustomer] = useState<CustomerDTO | null>(
    initialCustomer ?? null
  );
  const [verificationMethod, setVerificationMethod] =
    useState<VerificationMethod | null>(() =>
      initialCustomer
        ? verificationMethodForKnownCustomer(initialCustomer)
        : null
    );

  const resetFlow = () => {
    if (initialCustomer) {
      setStep("operate");
      setCustomer(initialCustomer);
      setVerificationMethod(verificationMethodForKnownCustomer(initialCustomer));
      return;
    }
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
    const plans = getPlansForCustomer(customer.isStudent);
    const walletLabel = customer.isStudent ? "Student Wallet" : "Club Wallet";

    return (
      <div className="space-y-4">
        <RechargeForm
          customerId={customer.id}
          plans={plans}
          walletLabel={walletLabel}
          verificationMethod={verificationMethod}
        />
        {!initialCustomer && (
          <button
            type="button"
            onClick={resetFlow}
            className="text-sm font-medium text-emerald-800 hover:underline"
          >
            Verify a different customer
          </button>
        )}
      </div>
    );
  }

  return null;
}
