"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MissedPaymentDialog } from "@/components/customers/MissedPaymentDialog";
import { CorrectOutstandingDialog } from "@/components/customers/CorrectOutstandingDialog";
import type { FinancialCorrectionEligibleDayDTO } from "@/types";

interface CustomerCorrectionsAdjustmentsProps {
  customerId: string;
  customerName: string;
  eligibleDays: FinancialCorrectionEligibleDayDTO[];
}

function IconAdjust({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 4.5 7v5.2c0 4.3 3.1 7.4 7.5 8.3 4.4-.9 7.5-4 7.5-8.3V7L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.1 11 14l3.8-4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CustomerCorrectionsAdjustments({
  customerId,
  customerName,
  eligibleDays,
}: CustomerCorrectionsAdjustmentsProps) {
  const [missedOpen, setMissedOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);

  if (eligibleDays.length === 0) return null;

  return (
    <>
      <section className="rounded-[12px] border border-gray-200 bg-white p-4 shadow-sm shadow-gray-900/5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gray-100 text-gray-600">
            <IconAdjust className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-gray-900">
              Corrections & Adjustments
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-gray-500">
              Use these only to correct a past financial record.
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setMissedOpen(true)}
            className="h-10 justify-center px-3 text-[13px] font-semibold"
          >
            Record Missed Payment
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setCorrectOpen(true)}
            className="h-10 justify-center px-3 text-[13px] font-semibold"
          >
            Correct Outstanding
          </Button>
        </div>
      </section>

      <MissedPaymentDialog
        open={missedOpen}
        customerId={customerId}
        customerName={customerName}
        eligibleDays={eligibleDays}
        onClose={() => setMissedOpen(false)}
      />
      <CorrectOutstandingDialog
        open={correctOpen}
        customerId={customerId}
        customerName={customerName}
        eligibleDays={eligibleDays}
        onClose={() => setCorrectOpen(false)}
      />
    </>
  );
}
