"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignTableSessionCustomers,
  endTableSession,
  pauseTableSession,
  resumeTableSession,
  startTableSession,
} from "@/actions/table-sessions";
import { calculateGameChargeFromActiveMs } from "@/lib/utils/session-billing";
import {
  computeActivePlayMs,
  formatActiveDuration,
  formatClockTime,
} from "@/lib/utils/session-timer";
import { formatCurrency } from "@/lib/utils/format";
import { formatAssignedCustomers } from "@/lib/utils/session-display";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { CustomerDTO } from "@/types";
import type { PoolMiniTableId } from "@/lib/constants/table-sessions";
import type {
  PoolMiniTableSummaryDTO,
  TableSessionDTO,
  TableSessionHistoryDTO,
} from "@/types";
import { Button } from "@/components/ui/Button";
import { StartSessionDialog } from "@/components/counter/StartSessionDialog";
import { SessionHistoryRow } from "@/components/counter/SessionHistoryRow";
import { CustomerPickerDialog } from "@/components/customers/CustomerPickerDialog";
import { CafeAddItemDialog } from "@/components/counter/CafeAddItemDialog";
import { CafeQuickButton } from "@/components/counter/CafeQuickButton";
import { useCafeAddItem } from "@/components/counter/useCafeAddItem";
import { cn } from "@/lib/utils/cn";

interface TableSessionCardProps {
  tableId: PoolMiniTableId;
  session: TableSessionDTO | null;
  pendingCheckouts: TableSessionDTO[];
  summary: PoolMiniTableSummaryDTO;
  history: TableSessionHistoryDTO[];
  onStart: () => void;
  onAddCafe: () => void;
}

function statusBadge(status: TableSessionDTO["status"] | "AVAILABLE") {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", dot: "bg-emerald-500", text: "text-emerald-800" };
    case "PAUSED":
      return { label: "Paused", dot: "bg-amber-400", text: "text-amber-800" };
    default:
      return { label: "Available", dot: "bg-gray-300", text: "text-gray-600" };
  }
}

export function TableSessionCard({
  tableId,
  session,
  summary,
  history,
  onStart,
  onAddCafe,
}: TableSessionCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showAssign, setShowAssign] = useState(false);

  const status = session?.status ?? "AVAILABLE";
  const badge = statusBadge(status);

  useEffect(() => {
    if (session?.status !== "ACTIVE") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session?.status]);

  const live = useMemo(() => {
    if (!session) return null;
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
    return {
      activeMs,
      gameAmount,
      cafeAmount,
      total: gameAmount + cafeAmount,
    };
  }, [session, now]);

  const runAction = (action: () => Promise<{ success: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Action failed");
        return;
      }
      router.refresh();
    });
  };

  const sessionAction = (type: "pause" | "resume" | "end") => {
    if (!session) return;
    const formData = new FormData();
    formData.set("sessionId", session.id);
    if (type === "pause") {
      runAction(() => pauseTableSession(formData));
    } else if (type === "resume") {
      runAction(() => resumeTableSession(formData));
    } else {
      runAction(() => endTableSession(formData));
    }
  };

  const assignCustomer = (customer: CustomerDTO) => {
    if (!session) return;
    setError(null);
    startTransition(async () => {
      const existingIds = session.assignedCustomers.map((row) => row.customerId);
      const customerIds = existingIds.includes(customer.id)
        ? existingIds
        : [...existingIds, customer.id];
      const formData = new FormData();
      formData.set("sessionId", session.id);
      formData.set("customerIds", JSON.stringify(customerIds));
      const result = await assignTableSessionCustomers(formData);
      if (!result.success) {
        setError(result.error ?? "Failed to assign customer");
        return;
      }
      setShowAssign(false);
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-bold text-gray-900">
            {sectionLabel(tableId)}
          </h3>
          <div className="flex flex-col items-end gap-1">
            {session && (
              <CafeQuickButton onClick={onAddCafe} disabled={isPending} />
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold",
                badge.text
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", badge.dot)} />
              {badge.label}
            </span>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-md bg-gray-50 px-1 py-1.5">
            <p className="text-gray-500">Revenue Today</p>
            <p className="font-bold tabular-nums text-gray-900">
              {formatCurrency(summary.revenueToday)}
            </p>
          </div>
          <div className="rounded-md bg-gray-50 px-1 py-1.5">
            <p className="text-gray-500">Sessions</p>
            <p className="font-bold tabular-nums text-gray-900">
              {summary.sessionsToday}
            </p>
          </div>
          <div className="rounded-md bg-gray-50 px-1 py-1.5">
            <p className="text-gray-500">Pending</p>
            <p
              className={cn(
                "font-bold tabular-nums",
                summary.pendingCount > 0 ? "text-amber-700" : "text-gray-900"
              )}
            >
              {summary.pendingCount}
            </p>
          </div>
        </div>

        {!session ? (
          <Button
            type="button"
            className="mt-2.5 w-full"
            disabled={isPending}
            onClick={onStart}
          >
            Start Session
          </Button>
        ) : live ? (
          <div className="mt-2.5 rounded-md border border-emerald-100 bg-emerald-50/60 px-2.5 py-2 text-xs">
            <p className="font-semibold text-gray-900">{session.displayLabel}</p>
            <p className="mt-0.5 text-gray-600">
              {formatActiveDuration(live.activeMs)} · {formatCurrency(live.total)}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 w-full text-[10px] text-gray-400 hover:text-gray-600"
        >
          {expanded ? "Tap to collapse" : "Tap for session details & history"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-gray-100 p-3">
          {session && live ? (
            <section className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                {session.displayLabel}
              </p>
              <p className="text-xs text-gray-600">
                Assigned:{" "}
                <span className="font-medium text-gray-900">
                  {formatAssignedCustomers(session.assignedCustomerNames)}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                <span>Started</span>
                <span className="text-right font-medium text-gray-900">
                  {formatClockTime(session.startedAt)}
                </span>
                <span>Active time</span>
                <span className="text-right font-bold tabular-nums text-gray-900">
                  {formatActiveDuration(live.activeMs)}
                </span>
                {session.status === "PAUSED" && session.pausedAt && (
                  <>
                    <span>Paused since</span>
                    <span className="text-right font-medium text-gray-900">
                      {formatClockTime(session.pausedAt)}
                    </span>
                  </>
                )}
                <span>Game</span>
                <span className="text-right font-semibold tabular-nums text-gray-900">
                  {formatCurrency(live.gameAmount)}
                </span>
                <span>Cafe</span>
                <span className="text-right font-semibold tabular-nums text-gray-900">
                  {formatCurrency(live.cafeAmount)}
                </span>
                <span className="font-semibold text-gray-800">Total</span>
                <span className="text-right text-base font-bold tabular-nums text-gray-900">
                  {formatCurrency(live.total)}
                </span>
              </div>
              {error && (
                <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setShowAssign(true)}
                >
                  Assign
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isPending}
                  onClick={onAddCafe}
                >
                  Cafe
                </Button>
                {session.status === "ACTIVE" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    disabled={isPending}
                    onClick={() => sessionAction("pause")}
                  >
                    Pause
                  </Button>
                )}
                {session.status === "PAUSED" && (
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    disabled={isPending}
                    onClick={() => sessionAction("resume")}
                  >
                    Resume
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  disabled={isPending}
                  onClick={() => sessionAction("end")}
                >
                  End Session
                </Button>
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Today&apos;s Session History
            </p>
            {history.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">
                No sessions ended yet today.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
                {history.map((row) => (
                  <SessionHistoryRow key={row.sessionId} row={row} />
                ))}
              </div>
            )}
          </section>

          {summary.pendingCount > 0 && (
            <Link
              href="/checkout"
              className="block text-center text-xs font-semibold text-blue-800 hover:underline"
            >
              {summary.pendingCount} pending bill
              {summary.pendingCount === 1 ? "" : "s"} in Checkout →
            </Link>
          )}
        </div>
      )}

      <CustomerPickerDialog
        open={showAssign}
        onClose={() => setShowAssign(false)}
        onSelect={assignCustomer}
        title="Assign to session"
        selectLabel="Assign"
        disabled={isPending}
      />
    </div>
  );
}

interface PoolMiniSessionBoardProps {
  tables: {
    tableId: PoolMiniTableId;
    session: TableSessionDTO | null;
    pendingCheckouts: TableSessionDTO[];
    summary: PoolMiniTableSummaryDTO;
    history: TableSessionHistoryDTO[];
  }[];
}

export function PoolMiniSessionBoard({ tables }: PoolMiniSessionBoardProps) {
  const router = useRouter();
  const [startTable, setStartTable] = useState<PoolMiniTableId | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { cafeTarget, closeCafe, openCafeForSession, openCafeForTable } =
    useCafeAddItem();

  const handleStart = (tableId: PoolMiniTableId, rateType: string) => {
    setStartError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tableId", tableId);
      formData.set("rateType", rateType);
      const result = await startTableSession(formData);
      if (!result.success) {
        setStartError(result.error ?? "Failed to start session");
        return;
      }
      setStartTable(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {tables.map((table) => (
          <TableSessionCard
            key={table.tableId}
            tableId={table.tableId}
            session={table.session}
            pendingCheckouts={table.pendingCheckouts}
            summary={table.summary}
            history={table.history}
            onStart={() => {
              setStartError(null);
              setStartTable(table.tableId);
            }}
            onAddCafe={() => {
              if (table.session) {
                openCafeForSession(
                  table.session,
                  sectionLabel(table.tableId)
                );
                return;
              }
              const pending = table.pendingCheckouts[0];
              if (pending) {
                void openCafeForTable(table.tableId, sectionLabel(table.tableId), {
                  sessionId: pending.id,
                });
              }
            }}
          />
        ))}
      </div>

      <StartSessionDialog
        tableId={startTable}
        onClose={() => {
          setStartTable(null);
          setStartError(null);
        }}
        onStart={handleStart}
        isPending={isPending}
        error={startError}
      />

      <CafeAddItemDialog target={cafeTarget} onClose={closeCafe} />
    </>
  );
}
