"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCafeItems } from "@/actions/notebook-entries";
import { CAFE_QUICK_ITEMS } from "@/lib/constants/counter-sections";
import type { CafeTableId } from "@/lib/constants/counter-sections";
import type { NotebookEntryType } from "@/lib/constants/notebook-entry-types";
import { isPoolMiniTableId } from "@/lib/constants/table-sessions";
import type { UnpaidSessionOption } from "@/actions/table-sessions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  EntryPaymentFields,
  appendEntryPaymentFormData,
  resolveEntryPaymentSubmit,
  type EntryPaymentMode,
} from "@/components/counter/EntryPaymentFields";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { invalidateCustomerGlanceCache } from "@/components/counter/CustomerPreviewContext";

const ADDABLE_ITEMS = CAFE_QUICK_ITEMS.filter((item) => item.key !== "food");
type AddableType = (typeof ADDABLE_ITEMS)[number]["type"] | "FOOD";

export type CafeAddItemTarget =
  | { kind: "customer"; id: string; name: string }
  | {
      kind: "table";
      tableId: CafeTableId;
      name: string;
      hasActiveSession?: boolean;
      unpaidSessions?: UnpaidSessionOption[];
      /** When set, cafe items always attach to this session (no picker). */
      sessionId?: string;
    };

interface CafeAddItemDialogProps {
  target: CafeAddItemTarget | null;
  onClose: () => void;
}

export function CafeAddItemDialog({ target, onClose }: CafeAddItemDialogProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<AddableType | null>(null);
  const [qty, setQty] = useState(1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [paymentMode, setPaymentMode] = useState<EntryPaymentMode | "">("");
  const [previousSessionId, setPreviousSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = target !== null;
  const isCustomerTarget = target?.kind === "customer";
  const isPoolMiniTable =
    target?.kind === "table" && isPoolMiniTableId(target.tableId);
  const unpaidSessions =
    target?.kind === "table" ? (target.unpaidSessions ?? []) : [];
  const hasActiveSession =
    target?.kind === "table" ? Boolean(target.hasActiveSession) : false;
  const fixedSessionId =
    target?.kind === "table" ? target.sessionId : undefined;
  const showSessionPicker =
    isPoolMiniTable && unpaidSessions.length > 0 && !fixedSessionId;

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setQty(1);
      setAmount("");
      setNote("");
      setPaidAmount("0");
      setPaymentMode("");
      setPreviousSessionId("");
      setError(null);
    }
  }, [open, target]);

  const orderAmount = useMemo(() => {
    if (!selected) return 0;
    if (selected === "FOOD") {
      return Number.parseInt(amount, 10) || 0;
    }
    const preset = ADDABLE_ITEMS.find((item) => item.type === selected);
    if (!preset || !("unitPrice" in preset)) return 0;
    return preset.unitPrice * qty;
  }, [selected, amount, qty]);

  if (!target) return null;

  const isFood = selected === "FOOD";

  const submit = () => {
    setError(null);

    if (!selected) {
      setError("Select an item");
      return;
    }

    const parsedPaid = Number.parseInt(paidAmount, 10) || 0;
    if (parsedPaid > orderAmount) {
      setError("Received amount cannot exceed item amount");
      return;
    }
    if (parsedPaid > 0 && !isCustomerTarget) {
      setError("Assign a customer before recording payment");
      return;
    }
    const paymentCheck = resolveEntryPaymentSubmit({
      paidAmount: parsedPaid,
      paymentMode,
    });
    if (!paymentCheck.valid) {
      setError(paymentCheck.error ?? "Select payment mode");
      return;
    }

    let items: {
      type: NotebookEntryType;
      quantity: number;
      unitPrice: number;
      note?: string;
    }[];

    if (isFood) {
      const unitPrice = Number(amount);
      if (!unitPrice || unitPrice <= 0) {
        setError("Enter a valid amount");
        return;
      }
      if (!note.trim()) {
        setError("Food note is required");
        return;
      }
      items = [
        {
          type: "FOOD",
          quantity: 1,
          unitPrice,
          note: note.trim(),
        },
      ];
    } else {
      const preset = ADDABLE_ITEMS.find((item) => item.type === selected);
      if (!preset || !("unitPrice" in preset)) {
        setError("Invalid item");
        return;
      }
      items = [
        {
          type: selected,
          quantity: qty,
          unitPrice: preset.unitPrice,
        },
      ];
    }

    startTransition(async () => {
      const formData = new FormData();
      if (target.kind === "customer") {
        formData.set("customerId", target.id);
      } else {
        formData.set("tableId", target.tableId);
        const sessionId = fixedSessionId ?? previousSessionId;
        if (sessionId) {
          formData.set("sessionId", sessionId);
        }
      }
      formData.set("items", JSON.stringify(items));
      const paymentFields = appendEntryPaymentFormData(formData, {
        paidAmount: parsedPaid,
        paymentMode,
      });
      if (!paymentFields.ok) {
        setError(paymentFields.error);
        return;
      }
      const result = await addCafeItems(formData);
      if (result.success) {
        if (target.kind === "customer") {
          invalidateCustomerGlanceCache();
        }
        onClose();
        router.refresh();
        return;
      }
      setError(result.error);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl">
        <h2 className="text-lg font-bold text-gray-900">
          Add Item — {target.name}
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {target.kind === "table" ? "Table tab" : "Customer tab"}
        </p>

        {showSessionPicker && (
          <div className="mt-3">
            <Label htmlFor="cafe-session-target">Bill session</Label>
            <select
              id="cafe-session-target"
              value={previousSessionId}
              onChange={(e) => setPreviousSessionId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              {hasActiveSession && (
                <option value="">Current session</option>
              )}
              {unpaidSessions.map((session) => (
                <option key={session.sessionId} value={session.sessionId}>
                  Add to previous — {session.displayLabel}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {ADDABLE_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setSelected(item.type);
                setQty(1);
                setError(null);
              }}
              className={cn(
                "rounded border px-3 py-2.5 text-sm font-semibold",
                selected === item.type
                  ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                  : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
              )}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSelected("FOOD");
              setError(null);
            }}
            className={cn(
              "rounded border px-3 py-2.5 text-sm font-semibold",
              selected === "FOOD"
                ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
            )}
          >
            Food
          </button>
        </div>

        {selected && !isFood && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="text-sm font-medium text-gray-700">Qty</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-9 w-9 items-center justify-center rounded bg-gray-100 text-lg font-bold"
            >
              −
            </button>
            <span className="min-w-[2rem] text-center text-lg font-bold tabular-nums">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              className="flex h-9 w-9 items-center justify-center rounded bg-emerald-800 text-lg font-bold text-white"
            >
              +
            </button>
          </div>
        )}

        {isFood && (
          <div className="mt-3 space-y-2">
            <div>
              <Label htmlFor="cafe-food-amount">Amount</Label>
              <Input
                id="cafe-food-amount"
                inputMode="numeric"
                placeholder="e.g. 120"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/\D/g, ""))
                }
                className="mt-1 h-10 text-base"
              />
            </div>
            <div>
              <Label htmlFor="cafe-food-note">Note</Label>
              <Input
                id="cafe-food-note"
                placeholder="e.g. Maggi"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 h-10 text-base"
              />
            </div>
          </div>
        )}

        {selected && (
          <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold tabular-nums text-gray-900">
                {formatCurrency(orderAmount)}
              </span>
            </div>

            <EntryPaymentFields
              idPrefix="cafe-add"
              amount={orderAmount}
              paidAmount={paidAmount}
              paymentMode={paymentMode}
              disabled={isPending}
              onPaidAmountChange={(value) => {
                setPaidAmount(value);
                setError(null);
              }}
              onPaymentModeChange={(value) => {
                setPaymentMode(value);
                setError(null);
              }}
            />
          </div>
        )}

        {error && (
          <p className="mt-2 rounded bg-red-50 px-2 py-1.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            className="h-10 flex-1 text-sm font-semibold"
            disabled={!selected || isPending}
            onClick={submit}
          >
            {isPending ? "Adding..." : "Add"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-10 text-sm"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
