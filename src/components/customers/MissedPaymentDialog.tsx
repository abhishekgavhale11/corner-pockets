"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { recordMissedPaymentAction } from "@/actions/financial-corrections";
import { Button } from "@/components/ui/Button";
import { CashGpaySegmentedControl } from "@/components/ui/CashGpaySegmentedControl";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { CorrectionSectionSelect } from "@/components/customers/CorrectionSectionSelect";
import {
  isFinancialCorrectionSection,
  type FinancialCorrectionSection,
} from "@/lib/constants/financial-corrections";
import { formatBusinessDayDate } from "@/lib/business-day/format";
import { formatCurrency } from "@/lib/utils/format";
import type { FinancialCorrectionEligibleDayDTO } from "@/types";
import type { RemainderPaymentMode } from "@/components/counter/EntryPaymentFields";

interface MissedPaymentDialogProps {
  open: boolean;
  customerId: string;
  customerName: string;
  eligibleDays: FinancialCorrectionEligibleDayDTO[];
  onClose: () => void;
}

export function MissedPaymentDialog({
  open,
  customerId,
  customerName,
  eligibleDays,
  onClose,
}: MissedPaymentDialogProps) {
  const router = useRouter();
  const [dayId, setDayId] = useState("");
  const [amount, setAmount] = useState("");
  const [section, setSection] = useState<FinancialCorrectionSection | "">("");
  const [paymentMode, setPaymentMode] = useState<RemainderPaymentMode | "">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedDay = useMemo(
    () => eligibleDays.find((day) => day.businessDayId === dayId) ?? null,
    [eligibleDays, dayId]
  );
  const remaining = selectedDay?.remainingAmount ?? 0;
  const parsedAmount = Number.parseInt(amount, 10) || 0;
  const canSubmit =
    Boolean(selectedDay) &&
    parsedAmount > 0 &&
    parsedAmount <= remaining &&
    isFinancialCorrectionSection(section) &&
    (paymentMode === "CASH" || paymentMode === "GPAY") &&
    reason.trim().length >= 3 &&
    !isPending;

  const reset = () => {
    setDayId("");
    setAmount("");
    setSection("");
    setPaymentMode("");
    setReason("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!selectedDay) {
      setError("Select the affected Business Day.");
      return;
    }
    if (parsedAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (parsedAmount > remaining) {
      setError(
        `Amount cannot exceed remaining outstanding of ${formatCurrency(remaining)} for this Business Day.`
      );
      return;
    }
    if (paymentMode !== "CASH" && paymentMode !== "GPAY") {
      setError("Select Cash or GPay.");
      return;
    }
    if (!isFinancialCorrectionSection(section)) {
      setError("Select a section.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Please provide a reason.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("customerId", customerId);
      formData.set("affectedBusinessDayId", selectedDay.businessDayId);
      formData.set("amount", String(parsedAmount));
      formData.set("section", section);
      formData.set("paymentMethod", paymentMode);
      formData.set("reason", reason.trim());

      const result = await recordMissedPaymentAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }

      handleClose();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} title="Record Missed Payment">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Records a payment that already happened on an earlier Business Day for{" "}
          <span className="font-medium text-gray-900">{customerName}</span>.
          This is not today&apos;s Outstanding Collection.
        </p>

        <div>
          <Label htmlFor="missed-payment-day">
            Affected Business Day <span className="text-red-600">*</span>
          </Label>
          <select
            id="missed-payment-day"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600/20"
            value={dayId}
            disabled={isPending}
            onChange={(event) => {
              setDayId(event.target.value);
              setError(null);
            }}
          >
            <option value="">Select a Business Day</option>
            {eligibleDays.map((day) => (
              <option key={day.businessDayId} value={day.businessDayId}>
                {day.publicId} · {formatBusinessDayDate(day.businessDate)} ·
                remaining {formatCurrency(day.remainingAmount)}
              </option>
            ))}
          </select>
        </div>

        {selectedDay ? (
          <p className="text-xs text-gray-500">
            Remaining on {selectedDay.publicId}:{" "}
            <span className="font-semibold tabular-nums text-gray-800">
              {formatCurrency(remaining)}
            </span>
          </p>
        ) : null}

        <CorrectionSectionSelect
          id="missed-payment-section"
          value={section}
          allowEmpty
          disabled={isPending}
          onChange={(next) => {
            setSection(next);
            setError(null);
          }}
        />

        <div>
          <Label htmlFor="missed-payment-amount">
            Amount <span className="text-red-600">*</span>
          </Label>
          <Input
            id="missed-payment-amount"
            type="number"
            min={1}
            max={remaining || undefined}
            step={1}
            inputMode="numeric"
            value={amount}
            disabled={isPending || !selectedDay}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
          />
        </div>

        <div>
          <Label>
            Payment Mode <span className="text-red-600">*</span>
          </Label>
          <CashGpaySegmentedControl
            value={paymentMode}
            onChange={(mode) => {
              setPaymentMode(mode);
              setError(null);
            }}
            disabled={isPending}
            idPrefix="missed-payment-mode"
          />
        </div>

        <div>
          <Label htmlFor="missed-payment-reason">
            Reason <span className="text-red-600">*</span>
          </Label>
          <Input
            id="missed-payment-reason"
            value={reason}
            disabled={isPending}
            maxLength={500}
            placeholder="Why was this payment missed?"
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? "Saving…" : "Record Missed Payment"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
