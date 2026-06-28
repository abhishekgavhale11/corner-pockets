"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRummyCounterEntry } from "@/actions/notebook-entries";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import {
  RUMMY_DEFAULT_AMOUNTS,
  RUMMY_PLAYER_PRESETS,
} from "@/lib/constants/snooker-pricing";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils/cn";

interface RummyEntryDialogProps {
  createSection?: NotebookSection | null;
  onClose: () => void;
}

const DEFAULT_PLAYERS = 4;

export function RummyEntryDialog({
  createSection = null,
  onClose,
}: RummyEntryDialogProps) {
  const router = useRouter();
  const [players, setPlayers] = useState(String(DEFAULT_PLAYERS));
  const [amount, setAmount] = useState(String(RUMMY_DEFAULT_AMOUNTS[DEFAULT_PLAYERS]));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = createSection !== null;

  useEffect(() => {
    if (!open) return;
    setPlayers(String(DEFAULT_PLAYERS));
    setAmount(String(RUMMY_DEFAULT_AMOUNTS[DEFAULT_PLAYERS]));
    setError(null);
  }, [open, createSection]);

  const applyPreset = (count: (typeof RUMMY_PLAYER_PRESETS)[number]) => {
    setPlayers(String(count));
    setAmount(String(RUMMY_DEFAULT_AMOUNTS[count]));
  };

  const submit = () => {
    if (!createSection) return;

    const playerCount = Number.parseInt(players, 10);
    if (!Number.isFinite(playerCount) || playerCount < 2) {
      setError("Enter a valid player count");
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
      formData.set("section", createSection);
      formData.set("playerCount", String(playerCount));
      formData.set("amount", String(parsedAmount));
      const result = await createRummyCounterEntry(formData);
      if (result.success) {
        router.refresh();
        onClose();
        return;
      }
      setError(result.error);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Rummy">
      <div className="space-y-3">
        <div>
          <Label>Players</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {RUMMY_PLAYER_PRESETS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => applyPreset(count)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                  players === String(count)
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-emerald-200 bg-white text-emerald-900 hover:border-emerald-400 hover:bg-emerald-50"
                )}
              >
                {count}P · ₹{RUMMY_DEFAULT_AMOUNTS[count]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="rummy-amount">Amount (₹)</Label>
          <Input
            id="rummy-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 text-sm"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            type="button"
            fullWidth
            disabled={isPending}
            onClick={submit}
          >
            {isPending ? "Adding..." : "Add Rummy"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
