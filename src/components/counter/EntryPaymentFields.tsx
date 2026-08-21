"use client";

import { formatCurrency } from "@/lib/utils/format";
import { frameDueAmount } from "@/lib/utils/frame-payment";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  CashGpaySegmentedControl,
  type PaymentModeOption,
} from "@/components/ui/CashGpaySegmentedControl";
import {
  DueStatusBadge,
  isPaymentModeSelected,
} from "@/components/counter/DueStatusBadge";
import {
  defaultPaymentRow,
  defaultPaymentRows,
  framePaymentRemaining,
  resolveEntryPayments,
  type PaymentRowInput,
} from "@/lib/utils/payment-allocations";

export type EntryPaymentMode = "CASH" | "GPAY";
export type RemainderPaymentMode = "CASH" | "GPAY";

interface EntryPaymentFieldsProps {
  amount: number;
  disabled?: boolean;
  paymentDisabled?: boolean;
  idPrefix?: string;
  layout?: "stack" | "row";
  /** UI-only denser controls (e.g. Cafe side panel). */
  compact?: boolean;
  allowMultiplePaymentMethods?: boolean;
  maxPaymentRows?: number;
  paymentRows?: PaymentRowInput[];
  onPaymentRowsChange?: (rows: PaymentRowInput[]) => void;
  /** Legacy single-row API (cafe and other callers). */
  paidAmount?: string;
  paymentMode?: RemainderPaymentMode | "";
  onPaidAmountChange?: (value: string) => void;
  onPaymentModeChange?: (value: RemainderPaymentMode | "") => void;
}

const posLabelClass =
  "mb-1.5 block text-[12px] font-medium uppercase tracking-wide text-gray-500";

const moneyInputClass =
  "h-[46px] w-full rounded-[11px] border border-gray-200 bg-white py-2 pl-8 pr-3 text-right text-[20px] font-bold tabular-nums text-gray-900 shadow-sm shadow-gray-900/5 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 disabled:opacity-60";

const moneyInputCompactClass =
  "h-9 w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-7 pr-2.5 text-right text-sm font-semibold tabular-nums text-gray-900 shadow-sm shadow-gray-900/5 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 disabled:opacity-60";

const posLabelCompactClass =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500";

function usePaymentRowsState(props: EntryPaymentFieldsProps) {
  const isControlledRows =
    props.paymentRows !== undefined && props.onPaymentRowsChange !== undefined;

  if (isControlledRows) {
    return {
      rows: props.paymentRows,
      setRows: props.onPaymentRowsChange,
      isMultiRowCapable: true,
    };
  }

  const row: PaymentRowInput = {
    received: props.paidAmount ?? "",
    paymentMode: props.paymentMode ?? "",
  };

  return {
    rows: [row],
    setRows: (nextRows: PaymentRowInput[]) => {
      const first = nextRows[0] ?? defaultPaymentRow();
      props.onPaidAmountChange?.(first.received);
      props.onPaymentModeChange?.(first.paymentMode);
    },
    isMultiRowCapable: false,
  };
}

function rowDuePaymentMode(
  row: PaymentRowInput,
  rows: PaymentRowInput[],
  frameAmount: number
): RemainderPaymentMode | "" {
  const resolved = resolveEntryPayments({ frameAmount, rows });
  const rowReceived = Number.parseInt(row.received, 10) || 0;
  if (rowReceived <= 0) return "";
  if (rows.length > 1) {
    return resolved.valid ? "CASH" : row.paymentMode;
  }
  return row.paymentMode;
}

export function EntryPaymentFields(props: EntryPaymentFieldsProps) {
  const {
    amount,
    disabled = false,
    paymentDisabled = false,
    idPrefix = "entry",
    layout = "stack",
    compact = false,
    allowMultiplePaymentMethods = false,
    maxPaymentRows = 2,
  } = props;

  const labelClass = compact ? posLabelCompactClass : posLabelClass;
  const moneyClass = compact ? moneyInputCompactClass : moneyInputClass;
  const controlHeight = compact ? "h-9" : "h-[46px]";
  const dueBadgeSize = compact ? "sm" : "md";
  const modeSize = compact ? "sm" : "md";

  const { rows: rawRows, setRows, isMultiRowCapable } = usePaymentRowsState(props);
  const rows = rawRows ?? defaultPaymentRows();
  const fieldsDisabled = disabled || paymentDisabled;
  const totalReceived = rows.reduce(
    (sum, row) => sum + (Number.parseInt(row.received, 10) || 0),
    0
  );
  const frameDue = frameDueAmount(amount, totalReceived);
  const multiRow = rows.length > 1;
  const frameRemaining = multiRow ? framePaymentRemaining(amount, rows) : 0;
  const paymentResolved = resolveEntryPayments({
    frameAmount: amount,
    rows,
  });

  const updateRow = (index: number, patch: Partial<PaymentRowInput>) => {
    setRows?.(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    );
  };

  const handleReceivedChange = (index: number, raw: string) => {
    const next = raw.replace(/[^\d]/g, "");
    const nextReceived = next === "" ? 0 : Number.parseInt(next, 10) || 0;

    if (rows.length === 1 && next === "" && isMultiRowCapable) {
      setRows?.([defaultPaymentRow()]);
      return;
    }

    setRows?.(
      rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        return {
          ...row,
          received: next,
          ...(nextReceived === 0 ? { paymentMode: "" as const } : {}),
        };
      })
    );
  };

  const handlePaymentModeChange = (
    index: number,
    mode: PaymentModeOption
  ) => {
    if (mode !== "CASH" && mode !== "GPAY") return;
    updateRow(index, { paymentMode: mode });
  };

  const addPaymentRow = () => {
    if (!isMultiRowCapable || rows.length >= maxPaymentRows) return;
    setRows?.([...rows, defaultPaymentRow()]);
  };

  const removeLastRow = () => {
    if (rows.length <= 1) return;
    setRows?.(rows.slice(0, -1));
  };

  const renderPaymentModeCell = (
    row: PaymentRowInput,
    index: number,
    showAddLink: boolean
  ) => {
    const rowReceived = Number.parseInt(row.received, 10) || 0;

    if (rowReceived <= 0) {
      return layout === "row" ? (
        <div
          className={cn(
            "flex items-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 font-medium text-gray-400",
            controlHeight,
            compact ? "text-xs" : "rounded-[11px] text-[13px]"
          )}
        >
          Unassigned
        </div>
      ) : (
        <p className={cn("mt-1 text-gray-500", compact ? "text-[11px]" : "text-xs")}>
          Unassigned
        </p>
      );
    }

    return (
      <div className={cn("space-y-1", layout === "stack" && index === 0 && !compact && "mt-1")}>
        <CashGpaySegmentedControl
          className={layout === "row" ? "w-full" : undefined}
          size={layout === "row" ? (compact ? "sm" : "lg") : modeSize}
          idPrefix={`${idPrefix}-mode-${index}`}
          value={row.paymentMode}
          onChange={(mode) => handlePaymentModeChange(index, mode)}
          disabled={fieldsDisabled}
          aria-label="Payment mode"
        />
        {showAddLink && allowMultiplePaymentMethods && isMultiRowCapable ? (
          <button
            type="button"
            className="text-[12px] font-medium text-emerald-700 underline-offset-2 hover:text-emerald-900 hover:underline disabled:opacity-60"
            disabled={fieldsDisabled}
            onClick={addPaymentRow}
          >
            + Add Payment Method
          </button>
        ) : null}
        {index === rows.length - 1 && rows.length > 1 && isMultiRowCapable ? (
          <button
            type="button"
            className="text-[12px] font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline disabled:opacity-60"
            disabled={fieldsDisabled}
            onClick={removeLastRow}
          >
            Remove row
          </button>
        ) : null}
      </div>
    );
  };

  const renderRow = (row: PaymentRowInput, index: number) => {
    const rowReceived = Number.parseInt(row.received, 10) || 0;
    const showLabels = index === 0;
    const showAddLink = index === 0 && rows.length === 1;
    const dueMode = rowDuePaymentMode(row, rows, amount);

    if (layout === "row") {
      return (
        <div
          key={index}
          className={cn(
            "grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start",
            compact && "gap-2",
            index > 0 && "pt-0"
          )}
        >
          <div className="min-w-0">
            {showLabels ? (
              <label
                htmlFor={`${idPrefix}-received-${index}`}
                className={labelClass}
              >
                Received
              </label>
            ) : (
              <span className={cn(labelClass, "invisible")} aria-hidden>
                Received
              </span>
            )}
            <div className="relative">
              <span
                className={cn(
                  "pointer-events-none absolute top-1/2 -translate-y-1/2 font-semibold text-gray-400",
                  compact ? "left-2 text-xs" : "left-3 text-[15px]"
                )}
              >
                ₹
              </span>
              <input
                id={`${idPrefix}-received-${index}`}
                type="text"
                inputMode="numeric"
                value={row.received}
                onChange={(event) =>
                  handleReceivedChange(index, event.target.value)
                }
                disabled={fieldsDisabled}
                className={cn(
                  moneyClass,
                  rowReceived > 0 &&
                    "border-emerald-700 focus:border-emerald-700"
                )}
              />
            </div>
          </div>

          <div className="min-w-0">
            {showLabels ? (
              <span className={labelClass}>Payment Mode</span>
            ) : (
              <span className={cn(labelClass, "invisible")} aria-hidden>
                Payment Mode
              </span>
            )}
            {renderPaymentModeCell(row, index, showAddLink)}
          </div>

          <div className="min-w-0">
            {showLabels ? (
              <span className={labelClass}>Due</span>
            ) : (
              <span className={cn(labelClass, "invisible")} aria-hidden>
                Due
              </span>
            )}
            <div className={cn("flex items-center", controlHeight)}>
              <DueStatusBadge
                dueAmount={frameDue}
                paymentMode={dueMode}
                allowPaidStatus={!paymentDisabled}
                size={dueBadgeSize}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={index} className={cn(index > 0 && "pt-0")}>
        <div>
          <Label
            htmlFor={`${idPrefix}-received-${index}`}
            className={compact ? labelClass : undefined}
          >
            Received Amount
          </Label>
          {compact ? (
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                ₹
              </span>
              <input
                id={`${idPrefix}-received-${index}`}
                type="text"
                inputMode="numeric"
                value={row.received}
                onChange={(event) =>
                  handleReceivedChange(index, event.target.value)
                }
                disabled={fieldsDisabled}
                className={moneyClass}
              />
            </div>
          ) : (
            <Input
              id={`${idPrefix}-received-${index}`}
              inputMode="numeric"
              value={row.received}
              onChange={(event) =>
                handleReceivedChange(index, event.target.value)
              }
              disabled={fieldsDisabled}
              className="mt-1 h-10"
            />
          )}
        </div>
        <div className={compact ? "mt-2.5" : "mt-3"}>
          <p className={compact ? labelClass : "text-[11px] font-bold uppercase tracking-wide text-gray-500"}>
            Payment Mode
          </p>
          {renderPaymentModeCell(row, index, showAddLink)}
        </div>
        {!compact ? (
          <div className="mt-3 flex items-baseline justify-between gap-3 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-500">Due</span>
            <span
              className={cn(
                "font-bold tabular-nums",
                frameDue > 0
                  ? "text-orange-700"
                  : paymentDisabled
                    ? "text-gray-500"
                    : paymentResolved.valid || isPaymentModeSelected(dueMode)
                      ? "text-emerald-800"
                      : "text-orange-800"
              )}
            >
              {frameDue > 0
                ? formatCurrency(frameDue)
                : paymentDisabled
                  ? "—"
                  : paymentResolved.valid || isPaymentModeSelected(dueMode)
                    ? "Paid"
                    : "Select Payment Mode"}
            </span>
          </div>
        ) : null}
      </div>
    );
  };

  if (layout === "row") {
    return (
      <div className={cn(compact ? "space-y-2" : "space-y-3.5")}>
        {rows.map((row, index) => renderRow(row, index))}
        {multiRow && frameRemaining !== 0 ? (
          <p
            className={cn(
              "font-medium",
              compact ? "text-xs" : "text-[13px]",
              frameRemaining > 0 ? "text-amber-700" : "text-red-700"
            )}
          >
            {frameRemaining > 0
              ? `Remaining ${formatCurrency(frameRemaining)}`
              : `Over by ${formatCurrency(Math.abs(frameRemaining))}`}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn(compact ? "space-y-1.5" : "space-y-3")}>
      {rows.map((row, index) => renderRow(row, index))}
      {multiRow && frameRemaining !== 0 ? (
        <p
          className={cn(
            "font-medium",
            compact ? "text-xs" : "text-sm",
            frameRemaining > 0 ? "text-amber-700" : "text-red-700"
          )}
        >
          {frameRemaining > 0
            ? `Remaining ${formatCurrency(frameRemaining)}`
            : `Over by ${formatCurrency(Math.abs(frameRemaining))}`}
        </p>
      ) : null}
    </div>
  );
}

export function resolveEntryPaymentSubmit(input: {
  frameAmount?: number;
  paidAmount?: number;
  paymentMode?: RemainderPaymentMode | "";
  paymentRows?: PaymentRowInput[];
  /** @deprecated */
  splitPaymentActive?: boolean;
  /** @deprecated */
  splitPaymentRows?: Array<{ amount: string; paymentMode: RemainderPaymentMode | "" }>;
}): {
  paymentMethod: EntryPaymentMode | undefined;
  paymentAllocations?: import("@/lib/utils/payment-allocations").PaymentAllocation[];
  valid: boolean;
  error?: string;
  remaining?: number;
} {
  if (input.paymentRows) {
    const resolved = resolveEntryPayments({
      frameAmount: input.frameAmount ?? 0,
      rows: input.paymentRows,
    });
    return {
      paymentMethod: resolved.paymentMethod,
      paymentAllocations: resolved.paymentAllocations,
      valid: resolved.valid,
      error: resolved.error,
      remaining: resolved.remaining,
    };
  }

  const frameAmount = input.frameAmount ?? input.paidAmount ?? 0;
  const rows: PaymentRowInput[] = [
    {
      received: String(Math.round(input.paidAmount ?? 0)),
      paymentMode: input.paymentMode ?? "",
    },
  ];

  if (input.splitPaymentActive && input.splitPaymentRows) {
    rows.push(
      ...input.splitPaymentRows.slice(1).map((row) => ({
        received: row.amount,
        paymentMode: row.paymentMode,
      }))
    );
    rows[0] = {
      received: String(Math.round(input.paidAmount ?? 0)),
      paymentMode: input.splitPaymentRows[0]?.paymentMode ?? input.paymentMode ?? "",
    };
  }

  const resolved = resolveEntryPayments({ frameAmount, rows });
  return {
    paymentMethod: resolved.paymentMethod,
    paymentAllocations: resolved.paymentAllocations,
    valid: resolved.valid,
    error: resolved.error,
    remaining: resolved.remaining,
  };
}

export function appendEntryPaymentFormData(
  formData: FormData,
  input: {
    frameAmount?: number;
    paidAmount?: number;
    paymentMode?: RemainderPaymentMode | "";
    paymentRows?: PaymentRowInput[];
    splitPaymentActive?: boolean;
    splitPaymentRows?: Array<{ amount: string; paymentMode: RemainderPaymentMode | "" }>;
  }
): { ok: true } | { ok: false; error: string } {
  const resolved = resolveEntryPaymentSubmit(input);
  if (!resolved.valid) {
    return { ok: false, error: resolved.error ?? "Invalid payment" };
  }

  const paidAmount = input.paymentRows
    ? input.paymentRows.reduce(
        (sum, row) => sum + (Number.parseInt(row.received, 10) || 0),
        0
      )
    : Math.round(input.paidAmount ?? 0);

  formData.set("paidAmount", String(paidAmount));
  if (resolved.paymentAllocations) {
    formData.set(
      "paymentAllocations",
      JSON.stringify(resolved.paymentAllocations)
    );
  } else if (resolved.paymentMethod) {
    formData.set("paymentMethod", resolved.paymentMethod);
  }
  return { ok: true };
}
