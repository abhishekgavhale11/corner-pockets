"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignCafeOrderCustomerAction,
  createCafeOrderAction,
  deleteCafeOrderAction,
  updateCafeOrderAction,
} from "@/actions/cafe-orders";
import {
  CAFE_DEFAULT_UNIT_PRICE,
  CAFE_ITEM_TYPE_LABELS,
  cafeItemLineAmount,
  isQtyCafeItemType,
  type CafeItemType,
} from "@/lib/constants/cafe";
import { paymentMethodLabel } from "@/lib/constants/notebook-payments";
import type { CafeOrderDTO, CafeOrderItemDTO } from "@/lib/mappers/cafe-order";
import { defaultReceivedForEdit, frameDueAmount } from "@/lib/utils/frame-payment";
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

function orderItemsSummary(order: CafeOrderDTO): string {
  const names = order.items.map(itemDisplayName);
  const countLabel = `${order.itemCount} ${order.itemCount === 1 ? "Item" : "Items"}`;
  if (names.length === 0) return countLabel;
  return `${countLabel}: ${names.join(", ")}`;
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

function CafeAddItemModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (item: DraftItem) => void;
}) {
  const [type, setType] = useState<CafeItemType>("CIGARETTE");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState(
    String(CAFE_DEFAULT_UNIT_PRICE.CIGARETTE)
  );
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setType("CIGARETTE");
    setQuantity("1");
    setUnitPrice(String(CAFE_DEFAULT_UNIT_PRICE.CIGARETTE));
    setDescription("");
    setAmount("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleTypeChange = (next: CafeItemType) => {
    setType(next);
    setError(null);
    if (next === "CIGARETTE" || next === "WATER") {
      setQuantity("1");
      setUnitPrice(String(CAFE_DEFAULT_UNIT_PRICE[next]));
    } else {
      setDescription("");
      setAmount("");
    }
  };

  const handleAdd = () => {
    if (type === "CIGARETTE" || type === "WATER") {
      const qty = Number.parseInt(quantity, 10);
      const price = Number.parseInt(unitPrice, 10);
      if (!Number.isFinite(qty) || qty < 1) {
        setError("Quantity must be at least 1");
        return;
      }
      if (!Number.isFinite(price) || price < 1) {
        setError("Unit price must be at least ₹1");
        return;
      }
      onAdd({
        key: `${type}-${Date.now()}`,
        type,
        quantity: qty,
        unitPrice: price,
        amount: qty * price,
      });
      handleClose();
      return;
    }

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
    onAdd({
      key: `${type}-${Date.now()}`,
      type,
      description: desc,
      amount: amt,
    });
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} title="Add Cafe Item">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CAFE_ITEM_TYPE_LABELS) as CafeItemType[]).map(
            (itemType) => (
              <button
                key={itemType}
                type="button"
                onClick={() => handleTypeChange(itemType)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm font-semibold transition-colors",
                  type === itemType
                    ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                )}
              >
                <CafeItemTypeIcon type={itemType} className="h-9 w-9" />
                {CAFE_ITEM_TYPE_LABELS[itemType]}
              </button>
            )
          )}
        </div>

        {isQtyCafeItemType(type) ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cafe-qty">Quantity</Label>
              <Input
                id="cafe-qty"
                inputMode="numeric"
                value={quantity}
                onChange={(e) =>
                  setQuantity(e.target.value.replace(/[^\d]/g, ""))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cafe-rate">Unit Price</Label>
              <Input
                id="cafe-rate"
                inputMode="numeric"
                value={unitPrice}
                onChange={(e) =>
                  setUnitPrice(e.target.value.replace(/[^\d]/g, ""))
                }
                className="mt-1"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="cafe-desc">Description</Label>
              <Input
                id="cafe-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
                placeholder={
                  type === "FOOD" ? "Chicken Fried Rice" : "Coca-Cola 750ml"
                }
              />
            </div>
            <div>
              <Label htmlFor="cafe-amt">Amount</Label>
              <Input
                id="cafe-amt"
                inputMode="numeric"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^\d]/g, ""))
                }
                className="mt-1"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>Add</Button>
        </div>
      </div>
    </Dialog>
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
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingManual, setEditingManual] = useState<DraftItem | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [confirmRemoveKey, setConfirmRemoveKey] = useState<string | null>(null);

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
    setPaidAmount(
      order
        ? defaultReceivedForEdit(order.amount, order.received)
        : ""
    );
    setPaymentMode(
      order?.paymentMethod === "CASH" || order?.paymentMethod === "GPAY"
        ? order.paymentMethod
        : ""
    );
    setError(null);
    setShowAddItem(false);
    setEditingManual(null);
    setConfirmRemoveKey(null);
  }, [order?.id, mode]);

  const cafeTotal = items.reduce((sum, item) => sum + draftAmount(item), 0);
  const received = Number.parseInt(paidAmount, 10) || 0;
  const due = frameDueAmount(cafeTotal, received);

  const bumpQty = (key: string, delta: number) => {
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.key !== key || !isQtyCafeItemType(item.type)) return item;
        const quantity = Math.max(0, (item.quantity ?? 0) + delta);
        return {
          ...item,
          quantity,
          amount: quantity * (item.unitPrice ?? 0),
        };
      });
      const target = next.find((item) => item.key === key);
      if (target && (target.quantity ?? 0) === 0) {
        setConfirmRemoveKey(key);
        return prev;
      }
      return next;
    });
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
    <aside className="flex h-[calc(100vh-11rem)] min-h-[28rem] w-full max-w-md shrink-0 flex-col rounded-xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-3">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <div>
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
              className="mt-1 text-xs font-medium text-emerald-800 hover:underline"
            >
              Assign Customer
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm"
            >
              {isQtyCafeItemType(item.type) ? (
                <div className="flex items-center gap-3">
                  <CafeItemTypeIcon type={item.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {CAFE_ITEM_TYPE_LABELS[item.type]}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Qty: {item.quantity ?? 0} · Rate:{" "}
                      {formatCurrency(item.unitPrice ?? 0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-base font-bold text-gray-700 hover:bg-gray-100"
                      onClick={() => bumpQty(item.key, -1)}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums text-gray-900">
                      {item.quantity ?? 0}
                    </span>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-base font-bold text-gray-700 hover:bg-gray-100"
                      onClick={() => bumpQty(item.key, 1)}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-14 text-right text-sm font-bold tabular-nums text-gray-900">
                    {formatCurrency(draftAmount(item))}
                  </span>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
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
                <div className="flex items-center gap-3">
                  <CafeItemTypeIcon type={item.type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {item.description}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {CAFE_ITEM_TYPE_LABELS[item.type]} · Amount:{" "}
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-gray-900">
                    {formatCurrency(item.amount)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => setEditingManual(item)}
                      aria-label="Edit item"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
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
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          variant="secondary"
          className="w-full border-dashed border-gray-300"
          onClick={() => setShowAddItem(true)}
        >
          + Add Item
        </Button>

        <div className="space-y-1.5 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Cafe Total</span>
            <span className="font-semibold tabular-nums">
              {formatCurrency(cafeTotal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Received</span>
            <span className="font-semibold tabular-nums">
              {formatCurrency(received)}
            </span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1.5">
            <span className="text-gray-500">Due</span>
            <CafeDueDisplay
              due={due}
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

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            Payment Received
          </p>
          <EntryPaymentFields
            amount={cafeTotal}
            paidAmount={paidAmount}
            paymentMode={paymentMode}
            onPaidAmountChange={setPaidAmount}
            onPaymentModeChange={setPaymentMode}
            idPrefix="cafe-order"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex gap-2 border-t border-gray-200 px-4 py-3">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={onClose}
          disabled={isPending}
        >
          Close
        </Button>
        <Button
          className="flex-1 bg-[#2E7D32] hover:bg-[#1B5E20]"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      <CafeAddItemModal
        open={showAddItem}
        onClose={() => setShowAddItem(false)}
        onAdd={(item) => {
          setItems((prev) => {
            if (isQtyCafeItemType(item.type)) {
              const existing = prev.find((row) => row.type === item.type);
              if (existing) {
                const quantity =
                  (existing.quantity ?? 0) + (item.quantity ?? 0);
                const unitPrice = item.unitPrice ?? existing.unitPrice ?? 0;
                return prev.map((row) =>
                  row.key === existing.key
                    ? {
                        ...row,
                        quantity,
                        unitPrice,
                        amount: quantity * unitPrice,
                      }
                    : row
                );
              }
            }
            return [...prev, item];
          });
        }}
      />

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

      <Dialog
        open={confirmRemoveKey !== null}
        onClose={() => setConfirmRemoveKey(null)}
        title="Remove item?"
      >
        <p className="text-sm text-gray-600">
          Quantity is zero. Remove this item from the order?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmRemoveKey(null)}>
            Keep
          </Button>
          <Button
            onClick={() => {
              if (confirmRemoveKey) {
                setItems((prev) =>
                  prev.filter((row) => row.key !== confirmRemoveKey)
                );
              }
              setConfirmRemoveKey(null);
            }}
          >
            Remove
          </Button>
        </div>
      </Dialog>
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

  const openOrder = (order: CafeOrderDTO) => {
    setPanel({ mode: "edit", order });
  };

  return (
    <CustomerPreviewProvider>
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-gray-900">Cafe Orders</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              className="border-emerald-200 text-emerald-900"
              onClick={() => setNewCustomerOpen(true)}
            >
              + New Customer
            </Button>
            <Button
              variant="secondary"
              className="border-emerald-700 text-emerald-900"
              onClick={() => setPanel({ mode: "create", order: null })}
            >
              + New Cafe Order
            </Button>
            <div className="relative">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer..."
                className="h-9 w-48 pl-8 text-sm"
              />
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                <SearchIcon />
              </span>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
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
                      <p className="font-medium text-gray-900">
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

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2.5">Customer / Status</th>
                <th className="px-3 py-2.5">Items</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-right">Received</th>
                <th className="px-3 py-2.5 text-right">Due</th>
                <th className="px-3 py-2.5 text-right">Action</th>
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
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              openOrder(order);
                            }}
                          >
                            <PencilIcon className="text-emerald-700" />
                            Edit
                          </button>
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
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

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

      {panel ? (
        <CafeOrderPanel
          mode={panel.mode}
          order={panel.mode === "edit" ? panel.order : null}
          onClose={() => setPanel(null)}
        />
      ) : (
        <div className="hidden w-full max-w-md shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center text-sm text-gray-400 lg:flex">
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
