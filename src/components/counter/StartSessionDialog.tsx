"use client";

import { useEffect, useState, useTransition } from "react";
import { counterRateTypeSuffix } from "@/lib/constants/counter-rates";
import { getRateOptionsForPreset } from "@/lib/constants/counter-rates";
import { poolMiniGameType, type PoolMiniTableId } from "@/lib/constants/table-sessions";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";

interface StartSessionDialogProps {
  tableId: PoolMiniTableId | null;
  onClose: () => void;
  onStart: (tableId: PoolMiniTableId, rateType: string) => void;
  isPending: boolean;
  error: string | null;
}

export function StartSessionDialog({
  tableId,
  onClose,
  onStart,
  isPending,
  error,
}: StartSessionDialogProps) {
  if (!tableId) return null;

  const gameType = poolMiniGameType(tableId);
  const options = getRateOptionsForPreset({ type: gameType });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl">
        <h2 className="text-lg font-bold text-gray-900">
          Start session — {sectionLabel(tableId)}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Time-based billing. Pause time is never charged.
        </p>
        <div className="mt-4 space-y-2">
          {options.map((option) => (
            <Button
              key={option.rateType}
              type="button"
              fullWidth
              disabled={isPending}
              onClick={() => onStart(tableId, option.rateType)}
              className="h-11 justify-between text-sm font-semibold"
            >
              <span>
                {option.rateType === "REGULAR" ? "Regular" : "Happy Hour"}
                {counterRateTypeSuffix(option.rateType)}
              </span>
              <span>{formatCurrency(option.amount)}/hr</span>
            </Button>
          ))}
        </div>
        {error && (
          <p className="mt-3 rounded bg-red-50 px-2 py-1.5 text-sm text-red-700">
            {error}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          fullWidth
          className="mt-3"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
