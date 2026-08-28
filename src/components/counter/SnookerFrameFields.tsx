"use client";

import { useMemo, type KeyboardEvent, type ReactNode } from "react";
import {
  SNOOKER_FRAME_TYPE_LABELS,
  SNOOKER_FRAME_TYPES,
  type SnookerFrameType,
} from "@/lib/constants/counter-sections";
import {
  COUNTER_RATE_TYPES,
  getRateOptionsForPreset,
  getSnookerFrameAmountPresets,
  type CounterRateType,
} from "@/lib/constants/counter-rates";
import {
  RUMMY_DEFAULT_AMOUNTS,
  RUMMY_PLAYER_PRESETS,
  getRummyDefaultAmount,
} from "@/lib/constants/snooker-pricing";
import { cn } from "@/lib/utils/cn";

export const snookerFrameFieldLabelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500";

export const snookerFrameControlClass =
  "h-9 w-full rounded-[10px] border border-gray-200 bg-white px-2.5 text-[13px] font-medium text-gray-900 shadow-sm shadow-gray-900/5 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

export const snookerFrameToolbarControlClass =
  "h-10 w-full rounded-md border border-gray-300 bg-white px-2.5 text-[13px] font-medium text-gray-800 shadow-none outline-none transition-shadow placeholder:text-gray-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

export const counterAddControlsShellClass =
  "rounded-lg border border-gray-200 bg-white px-2 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const counterTableBadgeClass =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-800 text-[13px] font-bold tracking-wide text-white";

export const counterAddFrameButtonClass =
  "h-10 shrink-0 whitespace-nowrap rounded-md bg-emerald-800 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-45";

export function SnookerFrameField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <span className={snookerFrameFieldLabelClass}>{label}</span>
      {children}
    </div>
  );
}

interface SnookerFrameFieldsProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  disabled?: boolean;
  onKeyDown?: (e: KeyboardEvent) => void;
  submitSlot?: ReactNode;
  /** Compact counter chrome: table id (T1 / T2 / T3) before Type. */
  leadingSlot?: ReactNode;
  /** Replaces the toolbar type select (e.g. Regular / HH). */
  typeSlot?: ReactNode;
  variant?: "toolbar" | "dialog";
  /** POS dialog: first cell on row 1 (e.g. Time). */
  timeSlot?: ReactNode;
  /** POS dialog: sits beside Quick Amount on row 2. Omitted for Pool/Mini. */
  ownershipSlot?: ReactNode;
  /** Default Big Snooker frame fields. */
  entryKind?: "snooker" | "poolMini";
  frameType?: SnookerFrameType | "";
  onFrameTypeChange?: (type: SnookerFrameType | "") => void;
  playerCount?: string;
  onPlayerCountChange?: (count: string) => void;
  /** Pool & Mini: Regular / Happy Hour in the same Type slot. */
  rateType?: CounterRateType | "";
  onRateTypeChange?: (type: CounterRateType | "") => void;
  poolMiniEntryType?: "MINI" | "POOL";
}

export function SnookerFrameFields({
  frameType = "",
  onFrameTypeChange,
  amount,
  onAmountChange,
  playerCount = "4",
  onPlayerCountChange,
  disabled = false,
  onKeyDown,
  submitSlot,
  leadingSlot,
  typeSlot,
  variant = "toolbar",
  timeSlot,
  ownershipSlot,
  entryKind = "snooker",
  rateType = "",
  onRateTypeChange,
  poolMiniEntryType = "POOL",
}: SnookerFrameFieldsProps) {
  const isPoolMini = entryKind === "poolMini";

  const amountPresets = useMemo(() => {
    if (isPoolMini) {
      if (!rateType) return [];
      return getRateOptionsForPreset({ type: poolMiniEntryType }).map(
        ({ rateType: option, amount: presetAmount }) => ({
          amount: presetAmount,
          rateType: option,
          label:
            option === "REGULAR"
              ? `${presetAmount} (Regular)`
              : `${presetAmount} HH`,
        })
      );
    }
    if (!frameType) return [];
    if (frameType === "RUMMY") {
      return RUMMY_PLAYER_PRESETS.map((count) => ({
        amount: RUMMY_DEFAULT_AMOUNTS[count],
        playerCount: count,
        label: `${count}P · ₹${RUMMY_DEFAULT_AMOUNTS[count]}`,
      }));
    }
    return getSnookerFrameAmountPresets(frameType).map((preset) => ({
      amount: preset.amount,
      label: preset.label
        .replace(" (Regular)", "")
        .replace(" (Happy Hour)", " HH"),
    }));
  }, [isPoolMini, rateType, poolMiniEntryType, frameType]);

  const applyPreset = (preset: {
    amount: number;
    playerCount?: number;
    rateType?: CounterRateType;
  }) => {
    if (isPoolMini) {
      if (preset.rateType && onRateTypeChange) {
        onRateTypeChange(preset.rateType);
      }
      onAmountChange(String(preset.amount));
      return;
    }
    if (frameType === "RUMMY" && preset.playerCount != null) {
      onPlayerCountChange?.(String(preset.playerCount));
      onAmountChange(String(preset.amount));
      return;
    }
    onAmountChange(String(preset.amount));
  };

  const isPresetActive = (preset: {
    amount: number;
    playerCount?: number;
    rateType?: CounterRateType;
  }) => {
    if (isPoolMini) {
      return (
        rateType === preset.rateType && Number(amount) === preset.amount
      );
    }
    if (frameType === "RUMMY" && preset.playerCount != null) {
      return playerCount === String(preset.playerCount);
    }
    return Number(amount) === preset.amount;
  };

  const typeSelected =
    Boolean(typeSlot) || (isPoolMini ? Boolean(rateType) : Boolean(frameType));
  const isDialog = variant === "dialog";

  const typeSelect = isPoolMini ? (
    <SnookerFrameField label="Game Type" className="min-w-0">
      <select
        value={rateType}
        onChange={(e) =>
          onRateTypeChange?.(e.target.value as CounterRateType | "")
        }
        className={cn(
          snookerFrameControlClass,
          !rateType && "text-gray-500"
        )}
        disabled={disabled}
      >
        <option value="">Select type</option>
        {COUNTER_RATE_TYPES.map((option) => (
          <option key={option} value={option}>
            {option === "REGULAR" ? "Regular" : "Happy Hour"}
          </option>
        ))}
      </select>
    </SnookerFrameField>
  ) : (
    <SnookerFrameField label="Frame Type" className="min-w-0">
      <select
        value={frameType}
        onChange={(e) =>
          onFrameTypeChange?.(e.target.value as SnookerFrameType | "")
        }
        className={cn(
          snookerFrameControlClass,
          !frameType && "text-gray-500"
        )}
        disabled={disabled}
      >
        <option value="">Select type</option>
        {SNOOKER_FRAME_TYPES.map((type) => (
          <option key={type} value={type}>
            {SNOOKER_FRAME_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
    </SnookerFrameField>
  );

  const amountField = (
    <SnookerFrameField
      label={isDialog ? "Total Amount" : "Amount"}
      className={isDialog ? "min-w-0" : "min-w-[6.5rem] flex-1"}
    >
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-gray-500">
          ₹
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => {
            const next = e.target.value.replace(/[^\d]/g, "");
            onAmountChange(next);
          }}
          onKeyDown={onKeyDown}
          placeholder="0"
          disabled={!typeSelected || disabled}
          className={cn(
            snookerFrameControlClass,
            "pl-7 font-bold tabular-nums"
          )}
        />
      </div>
    </SnookerFrameField>
  );

  const quickAmountBlock =
    typeSelected && amountPresets.length > 0 ? (
      <div>
        <span className={snookerFrameFieldLabelClass}>
          {!isPoolMini && frameType === "RUMMY" ? "Players" : "Quick Amount"}
        </span>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {amountPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              onClick={() => applyPreset(preset)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600",
                isPresetActive(preset)
                  ? "border-emerald-800 bg-emerald-800 text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    ) : (
      <div />
    );

  if (isDialog) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {timeSlot}
          {typeSelect}
          {amountField}
        </div>

        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            ownershipSlot ? "sm:grid-cols-2" : ""
          )}
        >
          {quickAmountBlock}
          {ownershipSlot}
        </div>
      </div>
    );
  }

  // Counter toolbar: Type (or typeSlot) + Amount + Add.
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        {leadingSlot}
        {typeSlot ?? (
          <select
            value={frameType}
            onChange={(e) =>
              onFrameTypeChange?.(e.target.value as SnookerFrameType | "")
            }
            aria-label="Type"
            className={cn(
              snookerFrameToolbarControlClass,
              "min-w-[6.75rem] flex-1 whitespace-nowrap text-[12px] text-gray-800 [&_option]:text-[12px] [&_option]:text-gray-800",
              !frameType && "text-gray-600"
            )}
            disabled={disabled}
          >
            <option value="" className="text-gray-600">
              Select type
            </option>
            {SNOOKER_FRAME_TYPES.map((type) => (
              <option key={type} value={type} className="text-gray-800">
                {SNOOKER_FRAME_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        )}

        <div className="relative w-[5.75rem] shrink-0">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-medium text-gray-500">
            ₹
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d]/g, "");
              onAmountChange(next);
            }}
            onKeyDown={onKeyDown}
            placeholder="0"
            aria-label="Amount"
            disabled={!typeSelected || disabled}
            className={cn(
              snookerFrameToolbarControlClass,
              "pl-6 font-semibold tabular-nums"
            )}
          />
        </div>
        {submitSlot}
      </div>

      {frameType && amountPresets.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-medium text-gray-500">
            {frameType === "RUMMY" ? "Players" : "Quick"}
          </span>
          {amountPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              onClick={() => applyPreset(preset)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors",
                isPresetActive(preset)
                  ? "bg-emerald-800 text-white"
                  : "bg-white text-gray-600 ring-1 ring-inset ring-gray-200/80 hover:bg-emerald-50 hover:text-emerald-900"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function useSnookerFrameAmountDefaults(
  frameType: SnookerFrameType | "",
  playerCount: string
) {
  return useMemo(() => {
    if (!frameType) return "";
    if (frameType === "RUMMY") {
      const count = Number.parseInt(playerCount, 10);
      const preset = getRummyDefaultAmount(count);
      return preset ? String(preset) : "";
    }
    const defaultAmount = getSnookerFrameAmountPresets(frameType)[0]?.amount;
    return defaultAmount ? String(defaultAmount) : "";
  }, [frameType, playerCount]);
}

export function usePoolMiniAmountDefaults(
  entryType: "MINI" | "POOL",
  rateType: CounterRateType | ""
) {
  return useMemo(() => {
    if (!rateType) return "";
    const amount = getRateOptionsForPreset({ type: entryType }).find(
      (row) => row.rateType === rateType
    )?.amount;
    return amount ? String(amount) : "";
  }, [entryType, rateType]);
}
