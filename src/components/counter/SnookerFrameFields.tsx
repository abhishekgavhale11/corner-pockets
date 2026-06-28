"use client";

import { useMemo } from "react";
import {
  SNOOKER_FRAME_TYPE_LABELS,
  SNOOKER_FRAME_TYPES,
  type SnookerFrameType,
} from "@/lib/constants/counter-sections";
import { getSnookerFrameAmountPresets } from "@/lib/constants/counter-rates";
import {
  RUMMY_DEFAULT_AMOUNTS,
  RUMMY_PLAYER_PRESETS,
  getRummyDefaultAmount,
} from "@/lib/constants/snooker-pricing";
import { cn } from "@/lib/utils/cn";

export const snookerFrameFieldLabelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80";

export const snookerFrameControlClass =
  "h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-[13px] font-medium text-gray-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

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
  frameType: SnookerFrameType | "";
  onFrameTypeChange: (type: SnookerFrameType | "") => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  playerCount: string;
  onPlayerCountChange: (count: string) => void;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  submitSlot?: React.ReactNode;
  variant?: "toolbar" | "dialog";
}

export function SnookerFrameFields({
  frameType,
  onFrameTypeChange,
  amount,
  onAmountChange,
  playerCount,
  onPlayerCountChange,
  disabled = false,
  onKeyDown,
  submitSlot,
  variant = "toolbar",
}: SnookerFrameFieldsProps) {
  const amountPresets = useMemo(() => {
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
  }, [frameType]);

  const applyPreset = (preset: {
    amount: number;
    playerCount?: number;
  }) => {
    if (frameType === "RUMMY" && preset.playerCount != null) {
      onPlayerCountChange(String(preset.playerCount));
      onAmountChange(String(preset.amount));
      return;
    }
    onAmountChange(String(preset.amount));
  };

  const isPresetActive = (preset: {
    amount: number;
    playerCount?: number;
  }) => {
    if (frameType === "RUMMY" && preset.playerCount != null) {
      return playerCount === String(preset.playerCount);
    }
    return Number(amount) === preset.amount;
  };

  const isDialog = variant === "dialog";

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-end gap-2.5",
          isDialog && "flex-col items-stretch sm:flex-row sm:items-end"
        )}
      >
        <SnookerFrameField
          label="Type"
          className={cn("min-w-[7.5rem]", isDialog ? "w-full sm:flex-[1.2]" : "flex-[1.2]")}
        >
          <select
            value={frameType}
            onChange={(e) =>
              onFrameTypeChange(e.target.value as SnookerFrameType | "")
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

        <SnookerFrameField
          label="Amount"
          className={cn("min-w-[6.5rem]", isDialog ? "w-full sm:flex-1" : "flex-1")}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-gray-500">
              ₹
            </span>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="0"
              disabled={!frameType || disabled}
              className={cn(
                snookerFrameControlClass,
                "pl-7 font-bold tabular-nums"
              )}
            />
          </div>
        </SnookerFrameField>

        {submitSlot}
      </div>

      {frameType && amountPresets.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium text-gray-500">
            {frameType === "RUMMY" ? "Players:" : "Quick:"}
          </span>
          {amountPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              onClick={() => applyPreset(preset)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                isPresetActive(preset)
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-emerald-200 bg-white text-emerald-900 hover:border-emerald-400 hover:bg-emerald-50"
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
