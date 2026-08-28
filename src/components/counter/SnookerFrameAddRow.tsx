"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSnookerFrameEntry } from "@/actions/notebook-entries";
import type { SnookerFrameType } from "@/lib/constants/counter-sections";
import {
  SnookerFrameFields,
  counterAddControlsShellClass,
  counterAddFrameButtonClass,
  counterTableBadgeClass,
  useSnookerFrameAmountDefaults,
} from "@/components/counter/SnookerFrameFields";
import { invalidateCustomerGlanceCache } from "@/components/counter/CustomerPreviewContext";
import {
  sectionLabel,
  sectionShortLabel,
  type NotebookSection,
} from "@/lib/constants/notebook-sections";

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

  // Keep Type, Amount, and Rummy players; only clear ephemeral error.
  const resetForm = () => {
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
    <div className="py-2">
      <div className={counterAddControlsShellClass}>
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
        leadingSlot={
          <span
            className={counterTableBadgeClass}
            title={sectionLabel(section)}
          >
            {sectionShortLabel(section)}
          </span>
        }
        submitSlot={
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !frameType}
            className={counterAddFrameButtonClass}
          >
            {isPending ? "Adding…" : "+ Add Frame"}
          </button>
        }
      />
      </div>

      {error && (
        <p className="mt-1.5 text-[11px] font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
