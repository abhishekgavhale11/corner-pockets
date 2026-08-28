"use client";

import { useEffect, useLayoutEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  assignCafeOrderCustomerAction,
  createCafeOrderAction,
  deleteCafeOrderAction,
  updateCafeOrderAction,
} from "@/actions/cafe-orders";
import {
  CAFE_ADD_ITEM_CATEGORIES,
  CAFE_DEFAULT_UNIT_PRICE,
  CAFE_ITEM_TYPE_LABELS,
  cafeItemLineAmount,
  isQtyCafeItemType,
  type CafeItemType,
} from "@/lib/constants/cafe";
import { paymentMethodLabel } from "@/lib/constants/notebook-payments";
import type { CafeOrderDTO, CafeOrderItemDTO } from "@/lib/mappers/cafe-order";
import { cafeReceivedInput, frameDueAmount } from "@/lib/utils/frame-payment";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  EntryPaymentFields,
  resolveEntryPaymentSubmit,
  type EntryPaymentMode,
} from "@/components/counter/EntryPaymentFields";
import {
  CustomerPreviewNameButton,
  CustomerPreviewProvider,
  invalidateCustomerGlanceCache,
} from "@/components/counter/CustomerPreviewContext";
import {
  AlertIcon,
  CafeItemTypeIcon,
  FilterIcon,
  PencilIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/counter/CafeItemIcons";
import { CafeNewTabDialog } from "@/components/counter/CafeNewTabDialog";
import { CounterWorkspaceTabs } from "@/components/counter/CounterWorkspaceTabs";
import { NewCustomerButton } from "@/components/counter/NewCustomerButton";
import { CustomerPickerDialog } from "@/components/customers/CustomerPickerDialog";

type DraftItem = {
  key: string;
  type: CafeItemType;
  quantity?: number;
  unitPrice?: number;
  description?: string;
  amount: number;
};

type PanelState =
  | { mode: "create"; order: null }
  | { mode: "edit"; order: CafeOrderDTO };

function draftAmount(item: DraftItem): number {
  return cafeItemLineAmount(item);
}

function toDraftItems(items: CafeOrderItemDTO[]): DraftItem[] {
  return items.map((item, index) => ({
    key: item.id || `item-${index}`,
    type: item.type,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    description: item.description,
    amount: item.amount,
  }));
}

/** Display-only grouping of identical qty lines (same type + unit price). No @ price line. */
type OrderSummaryLine = {
  key: string;
  title: string;
  total: number;
};

function buildOrderSummaryLines(items: DraftItem[]): OrderSummaryLine[] {
  const qtyMap = new Map<
    string,
    { type: CafeItemType; qty: number; unitPrice: number; total: number }
  >();
  const manual: OrderSummaryLine[] = [];

  for (const item of items) {
    if (isQtyCafeItemType(item.type)) {
      const unitPrice = item.unitPrice ?? 0;
      const key = `${item.type}:${unitPrice}`;
      const qty = item.quantity ?? 0;
      const prev = qtyMap.get(key);
      if (prev) {
        prev.qty += qty;
        prev.total += draftAmount(item);
      } else {
        qtyMap.set(key, {
          type: item.type,
          qty,
          unitPrice,
          total: draftAmount(item),
        });
      }
    } else {
      manual.push({
        key: item.key,
        title: item.description?.trim() || CAFE_ITEM_TYPE_LABELS[item.type],
        total: item.amount,
      });
    }
  }

  const qtyLines: OrderSummaryLine[] = [...qtyMap.entries()].map(
    ([key, row]) => ({
      key,
      title: `${row.qty}×${CAFE_ITEM_TYPE_LABELS[row.type]}`,
      total: row.total,
    })
  );

  return [...qtyLines, ...manual];
}

/** Draft-only consolidate of same type + unit price for Edit Order. Totals unchanged. */
function consolidateDraftItems(items: DraftItem[]): DraftItem[] {
  const qtyMap = new Map<string, DraftItem>();
  const manual: DraftItem[] = [];

  for (const item of items) {
    if (isQtyCafeItemType(item.type)) {
      const unitPrice = item.unitPrice ?? 0;
      const mapKey = `${item.type}:${unitPrice}`;
      const existing = qtyMap.get(mapKey);
      if (existing) {
        const quantity = (existing.quantity ?? 0) + (item.quantity ?? 0);
        qtyMap.set(mapKey, {
          ...existing,
          quantity,
          amount: quantity * unitPrice,
        });
      } else {
        qtyMap.set(mapKey, {
          ...item,
          key: `group-${mapKey}`,
          unitPrice,
          quantity: item.quantity ?? 0,
          amount: draftAmount(item),
        });
      }
    } else {
      manual.push(item);
    }
  }

  return [...qtyMap.values(), ...manual];
}

function statusDotClass(due: number, received: number, hasCustomer: boolean) {
  if (!hasCustomer) return "bg-gray-400";
  if (due <= 0) return "bg-emerald-600";
  if (received > 0) return "bg-amber-400";
  return "bg-amber-400";
}

function itemDisplayName(
  item: Pick<CafeOrderItemDTO, "type" | "description" | "quantity">
): string {
  if (isQtyCafeItemType(item.type)) {
    return CAFE_ITEM_TYPE_LABELS[item.type];
  }
  return item.description?.trim() || CAFE_ITEM_TYPE_LABELS[item.type];
}

/** Compact qty list for cafe tables, e.g. `2*Cigarette, 1*Water, 1*Sandwich`. */
function orderItemsSummary(order: CafeOrderDTO): string {
  const qtyMap = new Map<string, { label: string; qty: number }>();
  const manual: string[] = [];

  for (const item of order.items) {
    if (isQtyCafeItemType(item.type)) {
      const label = CAFE_ITEM_TYPE_LABELS[item.type];
      const key = item.type;
      const qty = item.quantity ?? 0;
      const prev = qtyMap.get(key);
      if (prev) {
        prev.qty += qty;
      } else {
        qtyMap.set(key, { label, qty });
      }
    } else {
      const label = itemDisplayName(item);
      manual.push(`1×${label}`);
    }
  }

  const parts = [
    ...[...qtyMap.values()]
      .filter((row) => row.qty > 0)
      .map((row) => `${row.qty}×${row.label}`),
    ...manual,
  ];

  return parts.length > 0 ? parts.join(", ") : "No items";
}

function orderItemCount(order: CafeOrderDTO): number {
  let count = 0;
  for (const item of order.items) {
    if (isQtyCafeItemType(item.type)) {
      count += item.quantity ?? 0;
    } else {
      count += 1;
    }
  }
  return count;
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 3.5 11 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Due column: "Paid" (or payment mode) when settled — never ₹0. */
function CafeDueDisplay({
  due,
  paymentMethod,
  className,
}: {
  due: number;
  paymentMethod?: CafeOrderDTO["paymentMethod"];
  className?: string;
}) {
  if (due <= 0) {
    if (paymentMethod === "CASH" || paymentMethod === "GPAY") {
      return (
        <span
          className={cn(
            "inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold",
            paymentMethod === "CASH"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-blue-50 text-blue-800",
            className
          )}
        >
          {paymentMethodLabel(paymentMethod)}
        </span>
      );
    }
    return (
      <span className={cn("text-[11px] font-bold text-emerald-700", className)}>
        Paid
      </span>
    );
  }

  return (
    <span
      className={cn(
        "font-semibold tabular-nums text-red-600",
        className
      )}
    >
      {formatCurrency(due)}
    </span>
  );
}

function CafeMobileOrderRow({
  order,
  selected,
  onOpen,
  onDelete,
}: {
  order: CafeOrderDTO;
  selected: boolean;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const due = frameDueAmount(order.amount, order.received);
  const count = orderItemCount(order);
  const countLabel =
    count === 1 ? "1 item" : `${count} items`;
  const itemsSummary = orderItemsSummary(order);
  const subtitle =
    itemsSummary === "No items" ? countLabel : `${countLabel} · ${itemsSummary}`;

  return (
    <div
      className={cn(
        "flex items-stretch border-b border-gray-100 last:border-b-0",
        selected ? "bg-emerald-50" : "bg-white active:bg-gray-50"
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            statusDotClass(due, order.received, Boolean(order.customerId))
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            {order.customerId ? (
              <CustomerPreviewNameButton
                customerId={order.customerId}
                customerName={order.customerName}
                className="text-[15px] font-semibold"
              />
            ) : (
              <span className="truncate text-[15px] font-semibold leading-tight text-gray-900">
                {order.customerName}
              </span>
            )}
            <span className="shrink-0 text-[15px] font-bold tabular-nums text-gray-900">
              {formatCurrency(order.amount)}
            </span>
          </span>
          <span className="mt-0.5 flex min-w-0 items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[12px] text-gray-500">
              {subtitle}
            </span>
            <CafeDueDisplay
              due={due}
              paymentMethod={order.paymentMethod}
              className="shrink-0"
            />
          </span>
        </span>
        <ChevronIcon className="h-4 w-4 shrink-0 text-gray-400" />
      </div>
      {onDelete ? (
        <button
          type="button"
          className="shrink-0 px-2.5 text-red-600"
          aria-label={`Delete cafe order for ${order.customerName}`}
          onClick={onDelete}
        >
          <TrashIcon />
        </button>
      ) : null}
    </div>
  );
}

function ManualItemEditDialog({
  item,
  onClose,
  onSave,
}: {
  item: DraftItem;
  onClose: () => void;
  onSave: (item: DraftItem) => void;
}) {
  const [description, setDescription] = useState(item.description ?? "");
  const [amount, setAmount] = useState(String(item.amount));
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit ${CAFE_ITEM_TYPE_LABELS[item.type]}`}
    >
      <div className="space-y-3">
        <div>
          <Label>Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Amount</Label>
          <Input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            className="mt-1"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const desc = description.trim();
              const amt = Number.parseInt(amount, 10);
              if (!desc) {
                setError("Description is required");
                return;
              }
              if (!Number.isFinite(amt) || amt < 1) {
                setError("Amount must be at least ₹1");
                return;
              }
              onSave({ ...item, description: desc, amount: amt });
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Persistent right-hand detail panel.
 * Stays open while editing items / payment.
 * Closes only via Close / X (never via backdrop).
 */
function CafeOrderPanel({
  mode,
  order,
  onClose,
}: {
  mode: "create" | "edit";
  order: CafeOrderDTO | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<EntryPaymentMode | "">("");
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CafeItemType | null>(
    null
  );
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState(
    String(CAFE_DEFAULT_UNIT_PRICE.CIGARETTE)
  );
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [editingManual, setEditingManual] = useState<DraftItem | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  const resetAddFields = (category: CafeItemType | null) => {
    setAddError(null);
    if (category && isQtyCafeItemType(category)) {
      setQuantity("1");
      setUnitPrice(String(CAFE_DEFAULT_UNIT_PRICE[category]));
      setDescription("");
      setAmount("");
      return;
    }
    setQuantity("1");
    setUnitPrice(String(CAFE_DEFAULT_UNIT_PRICE.CIGARETTE));
    setDescription("");
    setAmount("");
  };

  useEffect(() => {
    setCustomer(
      order?.customerId
        ? {
            id: order.customerId,
            name: order.customerName,
          }
        : null
    );
    setItems(order ? toDraftItems(order.items) : []);
    setPaidAmount(order ? cafeReceivedInput(order.received) : "");
    setPaymentMode(
      order?.paymentMethod === "CASH" || order?.paymentMethod === "GPAY"
        ? order.paymentMethod
        : ""
    );
    setError(null);
    setActiveCategory(null);
    resetAddFields(null);
    setEditingManual(null);
    setIsEditingOrder(false);
    // Reset when the selected order or panel mode changes, not on every order field update.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- order fields are copied once per open/switch
  }, [order?.id, mode]);

  const cafeTotal = items.reduce((sum, item) => sum + draftAmount(item), 0);
  const received = Number.parseInt(paidAmount, 10) || 0;
  const due = frameDueAmount(cafeTotal, received);
  const summaryLines = useMemo(() => buildOrderSummaryLines(items), [items]);

  const enterEditOrder = () => {
    setItems((prev) => consolidateDraftItems(prev));
    setIsEditingOrder(true);
    setEditingManual(null);
  };

  const finishEditOrder = () => {
    setIsEditingOrder(false);
    setEditingManual(null);
  };

  const bumpEditQty = (key: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.key !== key || !isQtyCafeItemType(item.type)) return item;
          const quantity = Math.max(0, (item.quantity ?? 0) + delta);
          return {
            ...item,
            quantity,
            amount: quantity * (item.unitPrice ?? 0),
          };
        })
        .filter((item) =>
          isQtyCafeItemType(item.type) ? (item.quantity ?? 0) > 0 : true
        )
    );
  };

  const selectCategory = (next: CafeItemType) => {
    setActiveCategory(next);
    resetAddFields(next);
  };

  const handleInlineAdd = () => {
    if (!activeCategory) {
      setAddError("Select a category");
      return;
    }

    if (isQtyCafeItemType(activeCategory)) {
      const qty = Number.parseInt(quantity, 10);
      const price = Number.parseInt(unitPrice, 10);
      if (!Number.isFinite(qty) || qty < 1) {
        setAddError("Quantity must be at least 1");
        return;
      }
      if (!Number.isFinite(price) || price < 1) {
        setAddError("Unit price must be at least ₹1");
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          key: `${activeCategory}-${Date.now()}`,
          type: activeCategory,
          quantity: qty,
          unitPrice: price,
          amount: qty * price,
        },
      ]);
      resetAddFields(activeCategory);
      setError(null);
      return;
    }

    const desc = description.trim();
    const amt = Number.parseInt(amount, 10);
    if (!desc) {
      setAddError("Description is required");
      return;
    }
    if (!Number.isFinite(amt) || amt < 1) {
      setAddError("Amount must be at least ₹1");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        key: `${activeCategory}-${Date.now()}`,
        type: activeCategory,
        description: desc,
        amount: amt,
      },
    ]);
    resetAddFields(activeCategory);
    setError(null);
  };

  const handleSave = () => {
    if (items.length === 0) {
      setError("Add at least one cafe item");
      return;
    }
    if (received > cafeTotal) {
      setError("Received cannot exceed Amount");
      return;
    }
    if (received > 0 && !customer) {
      setError("Assign a customer before recording Received");
      return;
    }
    const paymentCheck = resolveEntryPaymentSubmit({
      paidAmount: received,
      paymentMode,
    });
    if (!paymentCheck.valid) {
      setError(paymentCheck.error ?? "Payment Mode is required when Received > 0");
      return;
    }

    const payloadItems = items.map((item) => {
      if (isQtyCafeItemType(item.type)) {
        return {
          type: item.type,
          quantity: item.quantity ?? 1,
          unitPrice: item.unitPrice ?? 0,
        };
      }
      return {
        type: item.type,
        description: item.description ?? "",
        amount: item.amount,
      };
    });

    setError(null);
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCafeOrderAction({
              customerId: customer?.id,
              items: payloadItems,
              received,
              paymentMethod: paymentCheck.paymentMethod,
            })
          : await updateCafeOrderAction({
              orderId: order!.id,
              items: payloadItems,
              received,
              paymentMethod: paymentCheck.paymentMethod,
            });

      if (!result.success) {
        setError(result.error);
        return;
      }
      invalidateCustomerGlanceCache(customer?.id);
      onClose();
      router.refresh();
    });
  };

  return (
    <aside className="z-10 flex max-h-[min(92dvh,40rem)] min-h-0 w-full max-w-none shrink-0 flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-900/20 pb-[max(0.5rem,env(safe-area-inset-bottom))] max-lg:relative lg:max-h-[min(calc(100vh-8.5rem),calc(100dvh-7rem))] lg:max-w-md lg:rounded-xl lg:pb-0 lg:shadow-sm lg:shadow-gray-900/5">
      <div
        className="flex shrink-0 justify-center pt-2 lg:hidden"
        aria-hidden
      >
        <span className="h-1 w-10 rounded-full bg-gray-300" />
      </div>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {customer ? (
              <CustomerPreviewNameButton
                customerId={customer.id}
                customerName={customer.name}
                className="text-lg font-bold"
              />
            ) : (
              <h2 className="text-lg font-bold text-gray-900">
                Walk-in Customer
              </h2>
            )}
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
              Cafe Order
            </span>
          </div>
          {!customer && (
            <button
              type="button"
              onClick={() => setShowCustomerPicker(true)}
              className="mt-1 text-xs font-semibold text-emerald-800 hover:underline"
            >
              Assign Customer
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-[18px] overflow-x-hidden overflow-y-auto px-4 py-3">
        <section className="shrink-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Add Item
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {CAFE_ADD_ITEM_CATEGORIES.map(({ type: itemType, label }) => (
              <button
                key={itemType}
                type="button"
                onClick={() => selectCategory(itemType)}
                className={cn(
                  "flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-1.5 py-2 text-center text-xs font-semibold leading-snug transition-colors",
                  activeCategory === itemType
                    ? "border-emerald-700 bg-emerald-50 text-emerald-900 shadow-sm shadow-emerald-900/5"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                )}
              >
                <CafeItemTypeIcon type={itemType} className="h-5 w-5 shrink-0" />
                <span className="min-w-0 text-balance">{label}</span>
              </button>
            ))}
          </div>

          {activeCategory ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2">
              {isQtyCafeItemType(activeCategory) ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="cafe-inline-qty" className="text-[11px]">
                      Qty
                    </Label>
                    <Input
                      id="cafe-inline-qty"
                      inputMode="numeric"
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(e.target.value.replace(/[^\d]/g, ""))
                      }
                      className="mt-1 h-9"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="cafe-inline-rate" className="text-[11px]">
                      Price
                    </Label>
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                        ₹
                      </span>
                      <Input
                        id="cafe-inline-rate"
                        inputMode="numeric"
                        value={unitPrice}
                        onChange={(e) =>
                          setUnitPrice(e.target.value.replace(/[^\d]/g, ""))
                        }
                        className="h-9 pl-6"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="h-9 shrink-0 bg-[#2E7D32] px-3 text-xs hover:bg-[#1B5E20]"
                    onClick={handleInlineAdd}
                  >
                    Add to Order
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-[1.6]">
                    <Label htmlFor="cafe-inline-desc" className="text-[11px]">
                      Description
                    </Label>
                    <Input
                      id="cafe-inline-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 h-9"
                      placeholder="e.g. Maggi, Sandwich, Cold Drink"
                    />
                  </div>
                  <div className="min-w-[5rem] flex-1">
                    <Label htmlFor="cafe-inline-amt" className="text-[11px]">
                      Amount
                    </Label>
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                        ₹
                      </span>
                      <Input
                        id="cafe-inline-amt"
                        inputMode="numeric"
                        value={amount}
                        onChange={(e) =>
                          setAmount(e.target.value.replace(/[^\d]/g, ""))
                        }
                        className="h-9 pl-6"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="h-9 shrink-0 bg-[#2E7D32] px-3 text-xs hover:bg-[#1B5E20]"
                    onClick={handleInlineAdd}
                  >
                    Add to Order
                  </Button>
                </div>
              )}
              {addError ? (
                <p className="mt-1.5 text-xs text-red-600">{addError}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="shrink-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Current Order
            </p>
            {items.length > 0 && !isEditingOrder ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 shrink-0 gap-1 px-2.5 text-[11px] font-semibold"
                onClick={enterEditOrder}
              >
                <PencilIcon className="h-3.5 w-3.5 text-emerald-700" />
                Edit Order
              </Button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-center text-xs text-gray-400">
              No items yet — select a category above
            </p>
          ) : isEditingOrder ? (
            <div className="space-y-2">
              <ul className="max-h-40 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-emerald-200 bg-emerald-50/30 shadow-sm shadow-gray-900/5">
                {items.map((item) => (
                  <li key={item.key} className="px-2.5 py-1.5">
                    {isQtyCafeItemType(item.type) ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                          {CAFE_ITEM_TYPE_LABELS[item.type]}
                        </p>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50"
                            onClick={() => bumpEditQty(item.key, -1)}
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-xs font-bold tabular-nums text-gray-900">
                            {item.quantity ?? 0}
                          </span>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50"
                            onClick={() => bumpEditQty(item.key, 1)}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums text-gray-900">
                          {formatCurrency(draftAmount(item))}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded-md p-1 text-red-500 hover:bg-red-50"
                          onClick={() =>
                            setItems((prev) =>
                              prev.filter((row) => row.key !== item.key)
                            )
                          }
                          aria-label="Delete item"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                          {item.description ||
                            CAFE_ITEM_TYPE_LABELS[item.type]}
                        </p>
                        <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums text-gray-900">
                          {formatCurrency(item.amount)}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                          onClick={() => setEditingManual(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                          onClick={() =>
                            setItems((prev) =>
                              prev.filter((row) => row.key !== item.key)
                            )
                          }
                          aria-label="Delete item"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="secondary"
                className="h-8 w-full text-xs"
                onClick={finishEditOrder}
              >
                Done Editing
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm shadow-gray-900/5">
              {summaryLines.map((line) => (
                <li
                  key={line.key}
                  className="flex min-w-0 items-center justify-between gap-3 px-3 py-2"
                >
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                    {line.title}
                  </p>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900">
                    {formatCurrency(line.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-xl border border-gray-200 bg-emerald-50/40 text-center shadow-sm shadow-gray-900/5">
          <div className="min-w-0 border-r border-gray-200 px-2 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Cafe Total
            </p>
            <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-gray-900">
              {formatCurrency(cafeTotal)}
            </p>
          </div>
          <div className="min-w-0 border-r border-gray-200 px-2 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Received
            </p>
            <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-gray-900">
              {formatCurrency(received)}
            </p>
          </div>
          <div className="min-w-0 px-2 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Due
            </p>
            <div className="mt-0.5 flex justify-center">
              <CafeDueDisplay
                due={due}
                className="text-sm font-bold"
                paymentMethod={
                  paymentMode === "CASH" || paymentMode === "GPAY"
                    ? paymentMode
                    : order?.paymentMethod === "CASH" ||
                        order?.paymentMethod === "GPAY"
                      ? order.paymentMethod
                      : undefined
                }
              />
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <EntryPaymentFields
            amount={cafeTotal}
            paidAmount={paidAmount}
            paymentMode={paymentMode}
            onPaidAmountChange={setPaidAmount}
            onPaymentModeChange={setPaymentMode}
            idPrefix="cafe-order"
            compact
          />

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-gray-200 px-4 py-3">
            <Button
              variant="secondary"
              className="h-10 flex-1"
              onClick={onClose}
              disabled={isPending}
            >
              Close
            </Button>
            <Button
              className="h-10 flex-1 bg-[#2E7D32] hover:bg-[#1B5E20]"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
      </div>

      {editingManual && (
        <ManualItemEditDialog
          key={editingManual.key}
          item={editingManual}
          onClose={() => setEditingManual(null)}
          onSave={(next) =>
            setItems((prev) =>
              prev.map((row) => (row.key === next.key ? next : row))
            )
          }
        />
      )}

      <CustomerPickerDialog
        open={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        onSelect={(selected: CustomerDTO) => {
          setCustomer({
            id: selected.id,
            name: selected.name,
          });
          setShowCustomerPicker(false);
        }}
        title="Assign Customer"
      />
    </aside>
  );
}

export function CafeOrdersWorkspace({
  orders,
}: {
  orders: CafeOrderDTO[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [assignOrderId, setAssignOrderId] = useState<string | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [assignError, setAssignError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) =>
      order.customerName.toLowerCase().includes(q)
    );
  }, [orders, search]);

  const unassigned = filtered.filter((order) => !order.customerId);
  const assigned = filtered.filter((order) => order.customerId);

  const totals = filtered.reduce(
    (acc, order) => {
      acc.amount += order.amount;
      acc.received += order.received;
      acc.due += frameDueAmount(order.amount, order.received);
      return acc;
    },
    { amount: 0, received: 0, due: 0 }
  );

  const selectedOrderId = panel?.mode === "edit" ? panel.order.id : null;
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const openOrder = (order: CafeOrderDTO) => {
    setPanel({ mode: "edit", order });
  };

  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsMobileViewport(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!panel || !isMobileViewport) return;

    const previousBody = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBody;
    };
  }, [panel, isMobileViewport]);

  const orderPanel = panel ? (
    <CafeOrderPanel
      mode={panel.mode}
      order={panel.mode === "edit" ? panel.order : null}
      onClose={() => setPanel(null)}
    />
  ) : null;

  return (
    <CustomerPreviewProvider>
    <CounterWorkspaceTabs
      trailing={<NewCustomerButton onClick={() => setNewCustomerOpen(true)} />}
    />
    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 overflow-x-clip">
        <div className="mb-2 flex min-w-0 flex-col gap-2 lg:mb-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <h2 className="truncate text-[15px] font-bold text-gray-900 lg:text-base">
              Cafe Orders
            </h2>
            <Button
              variant="secondary"
              className="h-9 shrink-0 border-emerald-700 px-3 text-xs text-emerald-900 lg:text-sm"
              onClick={() => setPanel({ mode: "create", order: null })}
            >
              + New Cafe Order
            </Button>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0 flex-1 lg:flex-none">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer..."
                className="h-9 w-full min-w-0 pl-8 text-sm lg:w-48"
              />
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                <SearchIcon />
              </span>
            </div>
            <button
              type="button"
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 lg:flex"
              aria-label="Filter"
              title="Filter (coming soon)"
            >
              <FilterIcon />
            </button>
          </div>
        </div>

        {unassigned.length > 0 && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <div className="mb-2 flex items-center gap-2 text-amber-900">
              <AlertIcon className="text-amber-700" />
              <p className="text-xs font-bold uppercase tracking-wide">
                Unassigned Cafe Orders
              </p>
            </div>
            <ul className="space-y-2">
              {unassigned.map((order) => {
                const due = frameDueAmount(order.amount, order.received);
                const selected = selectedOrderId === order.id;
                return (
                  <li
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openOrder(order)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openOrder(order);
                      }
                    }}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm cursor-pointer",
                      selected
                        ? "border-emerald-600 bg-emerald-50"
                        : "border-amber-100 bg-white hover:border-amber-300"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">
                        {order.customerName}
                      </p>
                      <p className="truncate text-xs text-gray-600">
                        {orderItemsSummary(order)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Amount {formatCurrency(order.amount)} · Received{" "}
                        {formatCurrency(order.received)} ·{" "}
                        {due > 0 ? (
                          <span className="font-semibold text-red-600">
                            Due {formatCurrency(due)}
                          </span>
                        ) : (
                          <CafeDueDisplay
                            due={due}
                            paymentMethod={order.paymentMethod}
                            className="align-middle"
                          />
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignOrderId(order.id);
                        }}
                        disabled={isPending}
                      >
                        Assign Customer
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteError(null);
                          setDeleteOrderId(order.id);
                        }}
                        disabled={isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {assignError && (
              <p className="mt-2 text-sm text-red-600">{assignError}</p>
            )}
          </div>
        )}

        <div className="overflow-clip rounded-xl border border-gray-200 bg-white lg:hidden">
          {assigned.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-400">
              No cafe orders yet.
            </p>
          ) : (
            assigned.map((order) => (
              <CafeMobileOrderRow
                key={order.id}
                order={order}
                selected={selectedOrderId === order.id}
                onOpen={() => openOrder(order)}
                onDelete={() => {
                  setDeleteError(null);
                  setDeleteOrderId(order.id);
                }}
              />
            ))
          )}
          <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
            <p>
              Showing {assigned.length} cafe{" "}
              {assigned.length === 1 ? "order" : "orders"}
            </p>
            <p className="mt-0.5 tabular-nums">
              Total Amount: {formatCurrency(totals.amount)} · Received:{" "}
              {formatCurrency(totals.received)} ·{" "}
              {totals.due > 0 ? (
                <span className="font-semibold text-red-600">
                  Due: {formatCurrency(totals.due)}
                </span>
              ) : assigned.length > 0 ? (
                <span className="font-semibold text-emerald-700">Due: Paid</span>
              ) : (
                <span>Due: {formatCurrency(0)}</span>
              )}
            </p>
          </div>
        </div>

        <div className="hidden overflow-clip rounded-xl border border-gray-200 bg-white shadow-sm lg:block">
          <div className="overflow-x-auto overflow-y-clip overscroll-x-contain">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2.5">Customer / Status</th>
                <th className="px-3 py-2.5">Items</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right">Amount</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right">Received</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right">Due</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {assigned.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-gray-400"
                  >
                    No cafe orders yet.
                  </td>
                </tr>
              ) : (
                assigned.map((order) => {
                  const due = frameDueAmount(order.amount, order.received);
                  const selected = selectedOrderId === order.id;
                  return (
                    <tr
                      key={order.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openOrder(order)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openOrder(order);
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-b border-gray-100 last:border-0",
                        selected ? "bg-emerald-50" : "hover:bg-gray-50"
                      )}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-2.5 w-2.5 shrink-0 rounded-full",
                              statusDotClass(due, order.received, true)
                            )}
                          />
                          {order.customerId ? (
                            <CustomerPreviewNameButton
                              customerId={order.customerId}
                              customerName={order.customerName}
                              className="text-sm font-medium"
                            />
                          ) : (
                            <span className="font-medium text-gray-900">
                              {order.customerName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[14rem] truncate px-3 py-3 text-gray-600">
                        {orderItemsSummary(order)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(order.amount)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrency(order.received)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <CafeDueDisplay
                          due={due}
                          paymentMethod={order.paymentMethod}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteError(null);
                            setDeleteOrderId(order.id);
                          }}
                          disabled={isPending}
                        >
                          <TrashIcon className="text-red-600" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
            <span>
              Showing {assigned.length} cafe{" "}
              {assigned.length === 1 ? "order" : "orders"}
            </span>
            <span className="tabular-nums">
              Total Amount: {formatCurrency(totals.amount)} · Total Received:{" "}
              {formatCurrency(totals.received)} ·{" "}
              {totals.due > 0 ? (
                <span className="font-semibold text-red-600">
                  Total Due: {formatCurrency(totals.due)}
                </span>
              ) : assigned.length > 0 ? (
                <span className="font-semibold text-emerald-700">
                  Total Due: Paid
                </span>
              ) : (
                <span className="font-semibold text-gray-600">
                  Total Due: {formatCurrency(0)}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {isMobileViewport
        ? panel && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-[180] flex items-end justify-center">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/45"
                  aria-label="Close cafe order"
                  onClick={() => setPanel(null)}
                />
                <div className="relative z-10 w-full max-w-lg">
                  {orderPanel}
                </div>
              </div>,
              document.body
            )
          : null
        : panel
          ? (
            <div className="sticky top-2 z-20 w-full max-w-md shrink-0 self-start">
              {orderPanel}
            </div>
          )
          : (
            <div className="sticky top-2 hidden w-full max-w-md shrink-0 items-center justify-center self-start rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center text-sm text-gray-400 lg:flex">
              Select a cafe order to view details
            </div>
          )}

      <CafeNewTabDialog
        open={newCustomerOpen}
        onClose={() => setNewCustomerOpen(false)}
        submitLabel="Create Customer"
        onCreated={() => {
          router.refresh();
        }}
      />

      <CustomerPickerDialog
        open={assignOrderId !== null}
        onClose={() => {
          setAssignOrderId(null);
          setAssignError(null);
        }}
        onSelect={(customer) => {
          if (!assignOrderId) return;
          setAssignError(null);
          startTransition(async () => {
            const result = await assignCafeOrderCustomerAction({
              orderId: assignOrderId,
              customerId: customer.id,
            });
            if (!result.success) {
              setAssignError(result.error);
              return;
            }
            invalidateCustomerGlanceCache(customer.id);
            setAssignOrderId(null);
            router.refresh();
          });
        }}
        title="Assign Customer"
      />

      <Dialog
        open={deleteOrderId !== null}
        onClose={() => {
          if (isPending) return;
          setDeleteOrderId(null);
          setDeleteError(null);
        }}
        title="Delete this cafe order?"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This removes the order from today&apos;s cafe notebook. It cannot be
            undone after the Business Day closes.
          </p>
          {deleteError ? (
            <p className="text-xs text-red-600">{deleteError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setDeleteOrderId(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isPending || !deleteOrderId}
              onClick={() => {
                if (!deleteOrderId) return;
                setDeleteError(null);
                startTransition(async () => {
                  const orderId = deleteOrderId;
                  const result = await deleteCafeOrderAction({
                    orderId,
                  });
                  if (!result.success) {
                    setDeleteError(result.error);
                    return;
                  }
                  setDeleteOrderId(null);
                  setPanel((current) =>
                    current?.mode === "edit" && current.order.id === orderId
                      ? null
                      : current
                  );
                  router.refresh();
                });
              }}
            >
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
    </CustomerPreviewProvider>
  );
}
