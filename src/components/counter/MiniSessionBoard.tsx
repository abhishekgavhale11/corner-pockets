"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getSessionCafeDisplayItems,
  resumeTableSession,
  startTableSession,
  stopTableSession,
  updateSessionBillAmounts,
} from "@/actions/table-sessions";
import { calculateGameChargeFromActiveMs } from "@/lib/utils/session-billing";
import {
  computeActivePlayMs,
  formatActiveDuration,
  formatClockTime,
} from "@/lib/utils/session-timer";
import { formatTime } from "@/lib/utils/format-time";
import { formatCurrency } from "@/lib/utils/format";
import { formatAssignedCustomers, formatSessionActivityLine } from "@/lib/utils/session-display";
import { checkoutHrefForSession } from "@/lib/utils/checkout-navigation";
import {
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/utils/table-session-history";
import type { SessionCafeEditItemDTO } from "@/types";
import type {
  TableSessionDTO,
  TableSessionHistoryDTO,
  PoolMiniTableSummaryDTO,
} from "@/types";
import { StartSessionDialog } from "@/components/counter/StartSessionDialog";
import { Input } from "@/components/ui/Input";
import {
  CafeAddItemDialog,
  type CafeAddItemTarget,
} from "@/components/counter/CafeAddItemDialog";
import { cn } from "@/lib/utils/cn";
import { entryTypeLabel } from "@/lib/constants/notebook-entry-types";

export type MiniSessionLedgerItem =
  | { kind: "active"; session: TableSessionDTO }
  | { kind: "stopped"; session: TableSessionDTO }
  | { kind: "history"; row: TableSessionHistoryDTO };

function sessionItemId(item: MiniSessionLedgerItem): string {
  return item.kind === "history" ? item.row.sessionId : item.session.id;
}

function SessionActivityLine({
  line,
  playTime,
}: {
  line: string;
  playTime?: string;
}) {
  return (
    <p className="text-[13px] leading-snug text-gray-600">
      {line}
      {playTime ? (
        <>
          <span className="text-gray-300"> · </span>
          <span className="font-semibold text-gray-800">{playTime} play</span>
        </>
      ) : null}
    </p>
  );
}

const miniActionBtn =
  "inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold shadow-sm transition-colors";
const miniActionPrimary = cn(
  miniActionBtn,
  "bg-emerald-800 text-white hover:bg-emerald-900 disabled:opacity-50"
);
const miniActionSecondary = cn(
  miniActionBtn,
  "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50"
);

function cafeItemUsesQuantityArrows(item: SessionCafeEditItemDTO): boolean {
  return item.itemType !== "FOOD";
}

function cafeQuantityItemLabel(
  item: SessionCafeEditItemDTO,
  quantity: number
): string {
  const base = entryTypeLabel(item.itemType);
  return quantity > 1 ? `${base} × ${quantity}` : base;
}

function getCafeItemQuantity(
  item: SessionCafeEditItemDTO,
  amount: number
): number {
  const unit = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : 1;
  if (amount <= 0) return 0;
  return Math.max(1, Math.round(amount / unit));
}

const BILL_CONTROL_WIDTH = "w-[8rem]";

function BillAmountValue({ amount }: { amount: number }) {
  return (
    <span
      className={cn(
        "block text-right text-base font-bold tabular-nums text-gray-900",
        BILL_CONTROL_WIDTH
      )}
    >
      {formatCurrency(amount)}
    </span>
  );
}

function QuantityStepper({
  quantity,
  unitPrice,
  onChange,
  disabled,
}: {
  quantity: number;
  unitPrice: number;
  onChange: (qty: number) => void;
  disabled?: boolean;
}) {
  const amount = quantity * unitPrice;

  return (
    <div
      className={cn(
        "flex shrink-0 items-stretch overflow-hidden rounded-md border border-gray-300 shadow-sm",
        BILL_CONTROL_WIDTH
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="flex w-8 shrink-0 items-center justify-center bg-gray-50 text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40"
        disabled={disabled || quantity <= 0}
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(0, quantity - 1))}
      >
        ↓
      </button>
      <span className="flex h-9 min-w-0 flex-1 items-center justify-center border-x border-gray-300 bg-white px-1 text-sm font-bold tabular-nums text-gray-900">
        {formatCurrency(amount)}
      </span>
      <button
        type="button"
        className="flex w-8 shrink-0 items-center justify-center bg-gray-50 text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40"
        disabled={disabled}
        aria-label="Increase quantity"
        onClick={() => onChange(quantity + 1)}
      >
        ↑
      </button>
    </div>
  );
}

function DirectAmountInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      inputMode="numeric"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      className={cn(
        "h-9 shrink-0 text-right text-base font-bold tabular-nums",
        BILL_CONTROL_WIDTH
      )}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function SessionBillPanel({
  sessionId,
  frame,
  cafeRevision,
  editing,
  onSave,
  onCancelEdit,
  isPending,
  saveError,
}: {
  sessionId: string;
  frame: number;
  cafeRevision: number;
  editing: boolean;
  onSave: (payload: {
    gameAmount: number;
    cafeItems: { entryId: string; amount: number }[];
  }) => void;
  onCancelEdit?: () => void;
  isPending: boolean;
  saveError?: string | null;
}) {
  const [cafeItems, setCafeItems] = useState<SessionCafeEditItemDTO[]>([]);
  const [cafeAmounts, setCafeAmounts] = useState<Record<string, number>>({});
  const [frameInput, setFrameInput] = useState(String(frame));
  const [foodInputs, setFoodInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFrameInput(String(frame));
    setLoading(true);
    void getSessionCafeDisplayItems(sessionId).then((items) => {
      setCafeItems(items);
      setCafeAmounts(
        Object.fromEntries(items.map((item) => [item.entryId, item.amount]))
      );
      setFoodInputs(
        Object.fromEntries(
          items
            .filter((item) => item.itemType === "FOOD")
            .map((item) => [item.entryId, String(item.amount)])
        )
      );
      setLoading(false);
    });
  }, [sessionId, frame, cafeRevision, editing]);

  const frameValue = Number(frameInput);
  const parsedFrame = Number.isFinite(frameValue) ? frameValue : frame;
  const cafeTotal = cafeItems.reduce((sum, item) => {
    if (item.itemType === "FOOD" && editing) {
      const value = Number(foodInputs[item.entryId] ?? String(item.amount));
      return sum + (Number.isFinite(value) ? value : item.amount);
    }
    const value = cafeAmounts[item.entryId] ?? item.amount;
    return sum + value;
  }, 0);
  const total = (editing ? parsedFrame : frame) + cafeTotal;

  const handleSave = () => {
    if (!Number.isFinite(parsedFrame) || parsedFrame < 0) {
      return;
    }
    const items = cafeItems.map((item) => {
      if (item.itemType === "FOOD") {
        const value = Number(foodInputs[item.entryId] ?? String(item.amount));
        return {
          entryId: item.entryId,
          amount: Number.isFinite(value) && value >= 0 ? value : item.amount,
        };
      }
      return {
        entryId: item.entryId,
        amount: cafeAmounts[item.entryId] ?? item.amount,
      };
    });
    onSave({
      gameAmount: parsedFrame,
      cafeItems: items,
    });
  };

  const setCafeQuantity = (item: SessionCafeEditItemDTO, quantity: number) => {
    const unit = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : 1;
    setCafeAmounts((prev) => ({
      ...prev,
      [item.entryId]: quantity * unit,
    }));
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-1 shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 py-2.5">
        <span className="min-w-0 flex-1 text-sm font-semibold tracking-wide text-gray-700">
          Frame
        </span>
        <div className={cn("ml-auto shrink-0", BILL_CONTROL_WIDTH)}>
        {editing ? (
          <DirectAmountInput
            value={frameInput}
            disabled={isPending}
            onChange={setFrameInput}
          />
        ) : (
          <BillAmountValue amount={frame} />
        )}
        </div>
      </div>

      {loading ? (
        <p className="py-3 text-sm text-gray-500">Loading items…</p>
      ) : cafeItems.length === 0 ? (
        <p className="py-3 text-sm text-gray-500">No cafe items yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {cafeItems.map((item) => {
            const amount = cafeAmounts[item.entryId] ?? item.amount;
            const quantity = getCafeItemQuantity(item, amount);
            const rowLabel =
              editing && cafeItemUsesQuantityArrows(item)
                ? cafeQuantityItemLabel(item, quantity)
                : item.label;

            return (
            <li
              key={item.entryId}
              className="flex items-center gap-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
                {rowLabel}
              </span>
              <div className={cn("ml-auto shrink-0", BILL_CONTROL_WIDTH)}>
              {editing ? (
                cafeItemUsesQuantityArrows(item) ? (
                  <QuantityStepper
                    quantity={quantity}
                    unitPrice={item.unitPrice && item.unitPrice > 0 ? item.unitPrice : 1}
                    disabled={isPending}
                    onChange={(next) => setCafeQuantity(item, next)}
                  />
                ) : (
                  <DirectAmountInput
                    value={foodInputs[item.entryId] ?? String(item.amount)}
                    disabled={isPending}
                    onChange={(value) =>
                      setFoodInputs((prev) => ({
                        ...prev,
                        [item.entryId]: value,
                      }))
                    }
                  />
                )
              ) : (
                <BillAmountValue amount={item.amount} />
              )}
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-4 border-t-2 border-gray-200 py-2.5">
        <span className="min-w-0 flex-1 text-[15px] font-bold text-gray-900">Total</span>
        <span
          className={cn(
            "ml-auto shrink-0 text-right text-lg font-bold tabular-nums text-gray-900",
            BILL_CONTROL_WIDTH
          )}
        >
          {formatCurrency(editing ? total : frame + cafeItems.reduce((s, i) => s + i.amount, 0))}
        </span>
      </div>

      {editing && (
        <div
          className="border-t border-gray-100 pb-2 pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          {saveError ? (
            <p className="mb-2 text-xs text-red-700">{saveError}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(miniActionPrimary, "flex-1 justify-center")}
              disabled={isPending || loading}
              onClick={handleSave}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className={cn(miniActionSecondary, "flex-1 justify-center")}
              disabled={isPending}
              onClick={onCancelEdit}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface MiniSessionLedgerRowProps {
  item: MiniSessionLedgerItem;
  expanded: boolean;
  onToggle: () => void;
  now: number;
  onAddCafe: () => void;
  onSaveBill: (
    sessionId: string,
    payload: {
      gameAmount: number;
      cafeItems: { entryId: string; amount: number }[];
    }
  ) => void;
  onStartEditAmount: () => void;
  onCancelEditAmount: () => void;
  editingAmount: boolean;
  onSessionAction: (sessionId: string, type: "resume" | "stop") => void;
  isPending: boolean;
  saveError: string | null;
}

function MiniSessionLedgerRow({
  item,
  expanded,
  onToggle,
  now,
  onAddCafe,
  onSaveBill,
  onStartEditAmount,
  onCancelEditAmount,
  editingAmount,
  onSessionAction,
  isPending,
  saveError,
}: MiniSessionLedgerRowProps) {
  const isActive = item.kind === "active";
  const isStopped = item.kind === "stopped";
  const session = item.kind !== "history" ? item.session : null;

  const live = useMemo(() => {
    if (!session || !isActive) return null;
    const activeMs = computeActivePlayMs({
      status: session.status,
      startedAt: session.startedAt,
      pausedAt: session.pausedAt,
      totalPausedMs: session.totalPausedMs,
      now: new Date(now),
    });
    const gameAmount = calculateGameChargeFromActiveMs(
      activeMs,
      session.hourlyRate
    );
    const cafeAmount = session.cafeChargeAmount;
    return { activeMs, gameAmount, cafeAmount, total: gameAmount + cafeAmount };
  }, [session, now, isActive]);

  const timeLabel = session
    ? formatTime(session.startedAt)
    : formatTime(item.row.startedAt);

  const timerLabel = isActive && live
    ? formatActiveDuration(live.activeMs)
    : isStopped && session
      ? formatActiveDuration(session.activePlayMs)
      : item.kind === "history"
        ? formatActiveDuration(item.row.activePlayMs)
        : "—";

  const amount =
    isActive && live
      ? live.gameAmount
      : isStopped && session
        ? session.gameChargeAmount
        : item.kind === "history"
          ? item.row.gameAmount
          : 0;

  const assigned = session
    ? formatAssignedCustomers(session.assignedCustomerNames)
    : item.row.customerNames.length > 0
      ? item.row.customerNames.join(", ")
      : "Unassigned";

  const statusLabel = isActive
    ? session!.status === "PAUSED"
      ? "Paused"
      : "Active"
    : isStopped
      ? "Stopped"
      : item.row.paymentStatus === "PENDING"
        ? "Unpaid"
        : paymentStatusLabel(item.row.paymentStatus);

  const statusBadgeClass = isActive
    ? session!.status === "PAUSED"
      ? "bg-amber-100 text-amber-800"
      : "bg-emerald-100 text-emerald-800"
    : isStopped
      ? "bg-amber-100 text-amber-800"
      : item.kind === "history" && item.row.paymentStatus === "PAID"
        ? "bg-emerald-100 text-emerald-800"
        : "bg-gray-100 text-gray-700";

  const rowTint =
    isActive || isStopped ? "bg-emerald-50/60" : "bg-white";

  const activityLine = session
    ? formatSessionActivityLine({
        startedAt: session.startedAt,
        auditLog: session.auditLog,
      })
    : item.kind === "history"
      ? item.row.activityLine
      : "";

  const playTimeLabel =
    isActive && live
      ? formatActiveDuration(live.activeMs)
      : isStopped && session
        ? formatActiveDuration(session.activePlayMs)
        : item.kind === "history"
          ? formatActiveDuration(item.row.activePlayMs)
          : undefined;

  const sessionId =
    session?.id ?? (item.kind === "history" ? item.row.sessionId : "");

  const billFrame =
    isActive && live
      ? live.gameAmount
      : isStopped && session
        ? session.gameChargeAmount
        : item.kind === "history"
          ? item.row.gameAmount
          : 0;

  const cafeRevision =
    isActive && live
      ? live.cafeAmount
      : isStopped && session
        ? session.cafeChargeAmount
        : item.kind === "history"
          ? item.row.cafeAmount
          : 0;

  return (
    <tbody
      className={cn(
        "border-b-[3px] border-gray-300",
        rowTint,
        expanded && "bg-emerald-50/90"
      )}
    >
      <tr
        className={cn(
          "cursor-pointer",
          expanded && "border-b border-gray-200"
        )}
        onClick={onToggle}
      >
        <td className="px-3 py-2.5 align-top font-mono text-[13px] font-semibold tabular-nums text-gray-600">
          {timeLabel}
        </td>
        <td className="px-3 py-2.5 align-top text-[14px] font-semibold text-gray-800">
          <span>Mini</span>
          <span className="ml-1.5 font-bold tabular-nums text-emerald-800">
            {timerLabel}
          </span>
        </td>
        <td className="px-3 py-2.5 align-top text-[15px] font-bold tabular-nums text-gray-900">
          {formatCurrency(amount)}
        </td>
        <td className="px-3 py-2.5 align-top text-right text-[13px] font-semibold text-gray-800">
          {assigned}
        </td>
        <td className="px-3 py-2.5 align-top text-right">
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-[11px] font-bold",
              statusBadgeClass
            )}
          >
            {statusLabel}
          </span>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={5} className="border-t border-gray-200 bg-gray-50/80 px-3 py-3">
            {isActive && session && live ? (
              <div className="space-y-3">
                <SessionActivityLine line={activityLine} playTime={playTimeLabel} />
                <SessionBillPanel
                  sessionId={sessionId}
                  frame={billFrame}
                  cafeRevision={cafeRevision}
                  editing={false}
                  onSave={(payload) => onSaveBill(sessionId, payload)}
                  isPending={isPending}
                />
                <div
                  className="flex flex-wrap gap-2 border-t border-gray-200 pt-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {session.status === "ACTIVE" && (
                    <>
                      <button
                        type="button"
                        className={miniActionSecondary}
                        disabled={isPending}
                        onClick={onAddCafe}
                      >
                        Add Cafe
                      </button>
                      <button
                        type="button"
                        className={miniActionSecondary}
                        disabled={isPending}
                        onClick={() => onSessionAction(session.id, "stop")}
                      >
                        Stop
                      </button>
                    </>
                  )}
                  {session.status === "PAUSED" && (
                    <>
                      <button
                        type="button"
                        className={miniActionPrimary}
                        disabled={isPending}
                        onClick={() => onSessionAction(session.id, "resume")}
                      >
                        Resume
                      </button>
                      <button
                        type="button"
                        className={miniActionSecondary}
                        disabled={isPending}
                        onClick={() => onSessionAction(session.id, "stop")}
                      >
                        Stop
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : isStopped && session ? (
              <div className="space-y-3">
                <SessionActivityLine line={activityLine} playTime={playTimeLabel} />
                <SessionBillPanel
                  sessionId={sessionId}
                  frame={billFrame}
                  cafeRevision={cafeRevision}
                  editing={editingAmount}
                  onSave={(payload) => onSaveBill(sessionId, payload)}
                  onCancelEdit={onCancelEditAmount}
                  isPending={isPending}
                  saveError={saveError}
                />
                <div
                  className="flex flex-wrap gap-2 border-t border-gray-200 pt-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className={miniActionPrimary}
                    disabled={isPending}
                    onClick={() => onSessionAction(session.id, "resume")}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    className={miniActionSecondary}
                    disabled={isPending}
                    onClick={onAddCafe}
                  >
                    Add Cafe
                  </button>
                  {!editingAmount && (
                    <button
                      type="button"
                      className={miniActionSecondary}
                      disabled={isPending}
                      onClick={onStartEditAmount}
                    >
                      Edit Amount
                    </button>
                  )}
                  <Link
                    href={checkoutHrefForSession(session.id)}
                    className={miniActionPrimary}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open Checkout
                  </Link>
                </div>
              </div>
            ) : item.kind === "history" ? (
              <div className="space-y-3">
                <SessionActivityLine line={activityLine} playTime={playTimeLabel} />
                <SessionBillPanel
                  sessionId={sessionId}
                  frame={billFrame}
                  cafeRevision={cafeRevision}
                  editing={false}
                  onSave={() => {}}
                  isPending={false}
                />
                {item.row.paymentEvents.length > 0 && (
                  <div className="space-y-1 text-sm text-gray-700">
                    {item.row.paymentEvents.map((event, index) =>
                      event.kind === "paid" ? (
                        <p key={`${event.at}-${index}`} className="font-medium">
                          Paid{" "}
                          {formatCurrency(
                            event.amount ?? item.row.totalAmount
                          )}{" "}
                          {paymentMethodLabel(event.paymentMethod)}{" "}
                          {formatClockTime(event.at)}
                        </p>
                      ) : (
                        <p
                          key={`${event.at}-${index}`}
                          className="font-medium text-amber-800"
                        >
                          Reversed {formatClockTime(event.at)}
                        </p>
                      )
                    )}
                  </div>
                )}
                {item.row.paymentStatus === "PAID" && (
                  <p className="text-xs text-gray-500">
                    Paid — editing locked. Reverse payment from Checkout if
                    needed.
                  </p>
                )}
              </div>
            ) : null}
          </td>
        </tr>
      )}
    </tbody>
  );
}

interface MiniSessionBoardProps {
  session: TableSessionDTO | null;
  pendingCheckouts: TableSessionDTO[];
  summary: PoolMiniTableSummaryDTO;
  history: TableSessionHistoryDTO[];
  canStartNewSession: boolean;
}

export function MiniSessionBoard({
  session,
  pendingCheckouts,
  summary,
  history,
  canStartNewSession,
}: MiniSessionBoardProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showStart, setShowStart] = useState(false);
  const [cafeTarget, setCafeTarget] = useState<CafeAddItemTarget | null>(
    null
  );
  const [startError, setStartError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (session?.status !== "ACTIVE") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session?.status]);

  const items: MiniSessionLedgerItem[] = useMemo(() => {
    const rows: MiniSessionLedgerItem[] = [];
    const pendingIds = new Set(pendingCheckouts.map((row) => row.id));

    if (session) rows.push({ kind: "active", session });

    const endedRows: MiniSessionLedgerItem[] = [
      ...pendingCheckouts.map((row) => ({
        kind: "stopped" as const,
        session: row,
      })),
      ...history
        .filter(
          (row) =>
            row.paymentStatus === "PAID" || row.paymentStatus === "REVERSED"
        )
        .filter((row) => row.sessionId !== session?.id)
        .filter((row) => !pendingIds.has(row.sessionId))
        .map((row) => ({ kind: "history" as const, row })),
    ];

    endedRows.sort((a, b) => {
      const aTime =
        a.kind === "history" ? a.row.startedAt : a.session.startedAt;
      const bTime =
        b.kind === "history" ? b.row.startedAt : b.session.startedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    rows.push(...endedRows);
    return rows;
  }, [session, pendingCheckouts, history]);

  const openCafeForSession = (targetSession: TableSessionDTO) => {
    setCafeTarget({
      kind: "table",
      tableId: "MINI_SNOOKER",
      name: "Mini",
      sessionId: targetSession.id,
      hasActiveSession: targetSession.status === "ACTIVE",
    });
  };

  const handleStart = (rateType: string) => {
    setStartError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tableId", "MINI_SNOOKER");
      formData.set("rateType", rateType);
      const result = await startTableSession(formData);
      if (!result.success) {
        setStartError(result.error ?? "Failed to start session");
        return;
      }
      setShowStart(false);
      router.refresh();
    });
  };

  const runSessionAction = (
    sessionId: string,
    type: "resume" | "stop"
  ) => {
    setActionError(null);
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    startTransition(async () => {
      const result =
        type === "resume"
          ? await resumeTableSession(formData)
          : await stopTableSession(formData);
      if (!result.success) {
        setActionError(result.error ?? "Action failed");
        return;
      }
      if (type === "stop") {
        setExpandedId(sessionId);
      }
      router.refresh();
    });
  };

  const saveBillAmounts = (
    sessionId: string,
    payload: {
      gameAmount: number;
      cafeItems: { entryId: string; amount: number }[];
    }
  ) => {
    setSaveError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("sessionId", sessionId);
      formData.set("gameAmount", String(payload.gameAmount));
      formData.set("cafeItems", JSON.stringify(payload.cafeItems));
      const result = await updateSessionBillAmounts(formData);
      if (!result.success) {
        setSaveError(result.error ?? "Failed to save amounts");
        return;
      }
      setEditingSessionId(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex min-h-0 flex-col overflow-hidden border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-2 py-2">
          <div>
            <h3 className="text-[14px] font-bold tracking-tight text-gray-900">
              Mini
            </h3>
            <p className="text-[11px] text-gray-500">
              Today {formatCurrency(summary.revenueToday)} ·{" "}
              {summary.sessionsToday} sessions · {summary.pendingCount} pending
            </p>
          </div>
          {!session && canStartNewSession && (
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg bg-emerald-800 px-4 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-900 disabled:opacity-50"
              disabled={isPending}
              onClick={() => {
                setStartError(null);
                setShowStart(true);
              }}
            >
              + Start Session
            </button>
          )}
        </div>

        {actionError && (
          <p className="border-b border-red-100 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
            {actionError}
          </p>
        )}

        <MiniSessionLedgerTable>
          {items.length === 0 ? (
            <tbody>
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-10 text-center text-[13px] text-gray-400"
                >
                  No sessions today. Tap + Start Session to begin.
                </td>
              </tr>
            </tbody>
          ) : (
            items.map((item) => {
              const id = sessionItemId(item);
              const rowSession =
                item.kind !== "history" ? item.session : null;
              return (
                <MiniSessionLedgerRow
                  key={id}
                  item={item}
                  expanded={expandedId === id}
                  now={now}
                  onToggle={() =>
                    setExpandedId((prev) => {
                      const next = prev === id ? null : id;
                      if (next !== id) {
                        setEditingSessionId((current) =>
                          current === id ? null : current
                        );
                      }
                      return next;
                    })
                  }
                  onAddCafe={() => {
                    if (rowSession) openCafeForSession(rowSession);
                  }}
                  onSaveBill={saveBillAmounts}
                  editingAmount={editingSessionId === id}
                  onStartEditAmount={() => {
                    setSaveError(null);
                    setEditingSessionId(id);
                  }}
                  onCancelEditAmount={() => {
                    setSaveError(null);
                    setEditingSessionId(null);
                  }}
                  onSessionAction={runSessionAction}
                  isPending={isPending}
                  saveError={saveError}
                />
              );
            })
          )}
        </MiniSessionLedgerTable>
      </div>

      <StartSessionDialog
        tableId={showStart ? "MINI_SNOOKER" : null}
        onClose={() => {
          setShowStart(false);
          setStartError(null);
        }}
        onStart={(_, rateType) => handleStart(rateType)}
        isPending={isPending}
        error={startError}
      />

      <CafeAddItemDialog
        target={cafeTarget}
        onClose={() => setCafeTarget(null)}
      />
    </>
  );
}

function MiniSessionLedgerTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-[calc(100vh-200px)] flex-1 overflow-y-auto">
      <table className="w-full table-fixed border-collapse">
        <thead className="sticky top-0 z-10 border-b-2 border-gray-300 bg-gray-100">
          <tr className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
            <th className="w-[3.25rem] px-3 py-2.5 text-left">Time</th>
            <th className="w-[30%] px-3 py-2.5 text-left">Session</th>
            <th className="w-[4.75rem] px-3 py-2.5 text-left">Frame</th>
            <th className="px-3 py-2.5 text-right">Assigned</th>
            <th className="w-[5rem] px-3 py-2.5 text-right">Status</th>
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
}
