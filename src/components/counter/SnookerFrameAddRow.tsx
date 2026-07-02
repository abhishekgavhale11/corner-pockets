"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSnookerFrameEntry } from "@/actions/notebook-entries";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import type { SnookerFrameType } from "@/lib/constants/counter-sections";
import {
  SnookerFrameFields,
  useSnookerFrameAmountDefaults,
} from "@/components/counter/SnookerFrameFields";
import { invalidateCustomerGlanceCache } from "@/components/counter/CustomerPreviewContext";

interface SnookerFrameAddRowProps {
  section: NotebookSection;
}

export function SnookerFrameAddRow({ section }: SnookerFrameAddRowProps) {
  const router = useRouter();
  const [frameType, setFrameType] = useState<SnookerFrameType | "">("");
  const [amount, setAmount] = useState("");
  const [playerCount, setPlayerCount] = useState("4");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultAmount = useSnookerFrameAmountDefaults(frameType, playerCount);

  useEffect(() => {
    if (!frameType) {
      setAmount("");
      return;
    }
    setAmount(defaultAmount);
  }, [frameType, playerCount, defaultAmount]);

  const resetForm = () => {
    setFrameType("");
    setAmount("");
    setPlayerCount("4");
    setError(null);
  };

  const submit = () => {
    if (!frameType) {
      setError("Select a frame type");
      return;
    }

    const parsedAmount = Number.parseInt(amount, 10);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("section", section);
      formData.set("frameType", frameType);
      formData.set("amount", String(parsedAmount));
      if (frameType === "RUMMY") {
        formData.set("playerCount", playerCount);
      }

      const result = await createSnookerFrameEntry(formData);
      if (result.success) {
        invalidateCustomerGlanceCache();
        router.refresh();
        resetForm();
        return;
      }
      setError(result.error);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && frameType && !isPending) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-b border-emerald-200/80 bg-gradient-to-b from-emerald-50 to-emerald-50/40 px-3 py-3">
      <SnookerFrameFields
        frameType={frameType}
        onFrameTypeChange={(type) => {
          setFrameType(type);
          if (type === "RUMMY") {
            setPlayerCount("4");
          }
          setError(null);
        }}
        amount={amount}
        onAmountChange={(value) => {
          setAmount(value);
          setError(null);
        }}
        playerCount={playerCount}
        onPlayerCountChange={(count) => {
          setPlayerCount(count);
          setError(null);
        }}
        disabled={isPending}
        onKeyDown={handleKeyDown}
        submitSlot={
          <div className="shrink-0 pb-0.5">
            <button
              type="button"
              onClick={submit}
              disabled={isPending || !frameType}
              className="h-9 whitespace-nowrap rounded-lg bg-emerald-800 px-4 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isPending ? "Adding…" : "+ Add Frame"}
            </button>
          </div>
        }
      />

      {error && (
        <p className="mt-2 text-[11px] font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
