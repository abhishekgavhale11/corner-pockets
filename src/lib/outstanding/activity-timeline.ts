import mongoose from "mongoose";
import Outstanding from "@/models/Outstanding";
import OutstandingCollection from "@/models/OutstandingCollection";
import BusinessDay from "@/models/BusinessDay";
import NotebookEntry from "@/models/NotebookEntry";
import CafeOrder from "@/models/CafeOrder";
import Transaction from "@/models/Transaction";
import { CAFE_SECTION } from "@/lib/constants/counter-sections";
import { entryTypeLabel } from "@/lib/constants/notebook-entry-types";
import { formatBusinessDayPublicId } from "@/lib/business-day/format";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import type { OutstandingPaymentMethod } from "@/lib/constants/outstanding";
import { CAFE_ITEM_TYPE_LABELS, type CafeItemType } from "@/lib/constants/cafe";
import { resolveBusinessDate } from "@/lib/utils/business-date";
import { frameDueAmount, framePaidAmount } from "@/lib/utils/frame-payment";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import {
  walletPaymentPurposeLabel,
  type WalletPaymentContext,
  type WalletPaymentPurpose,
} from "@/lib/wallet/wallet-payment-context";
import type {
  CustomerActivityBusinessDaySummaryDTO,
  CustomerActivityCountLineDTO,
  CustomerActivityItemDTO,
  NotebookEntryDTO,
} from "@/types";

function paymentMethodLabel(
  method: OutstandingPaymentMethod | "CASH" | "GPAY" | "WALLET" | string | null | undefined
): string {
  if (method === "CASH") return "Cash";
  if (method === "GPAY") return "GPay";
  if (method === "WALLET") return "Wallet";
  return method ? String(method) : "—";
}

function toWalletPaymentActivity(
  ctx: WalletPaymentContext
): NonNullable<CustomerActivityItemDTO["walletPayment"]> {
  return {
    purpose: ctx.purpose,
    purposeLabel: walletPaymentPurposeLabel(ctx.purpose),
    billAmount: ctx.billAmount,
    walletUsed: ctx.walletUsed,
    remainderAmount: ctx.remainderAmount,
    remainderMethod: ctx.remainderMethod,
    remainderMethodLabel: ctx.remainderMethod
      ? paymentMethodLabel(ctx.remainderMethod)
      : undefined,
    totalPaid: ctx.totalPaid,
    lines: ctx.lines,
    billAmountLabel:
      ctx.purpose === "OUTSTANDING_COLLECTION"
        ? "Outstanding Paid"
        : "Bill Amount",
  };
}

function inferWalletPaymentContext(input: {
  txnAmount: number;
  remainingPaymentMethod?: "CASH" | "GPAY";
  description?: string;
  businessDayId?: string;
  frameEntry?: {
    amount: number;
    paidAmount?: number;
    walletAmount?: number;
    paymentMethod?: string;
    type: string;
    playerCount?: number;
    snookerGame?: string;
    rateType?: string;
  };
  cafeOrder?: {
    amount: number;
    received?: number;
    walletAmount?: number;
    paymentMethod?: string;
    items?: Array<{
      type: string;
      description?: string;
      quantity?: number;
      amount: number;
    }>;
  };
  collection?: {
    amount: number;
    walletAmount?: number;
    paymentMethod?: string;
  };
}): WalletPaymentContext {
  if (input.collection) {
    const billAmount = Math.round(input.collection.amount);
    const walletUsed = Math.round(
      input.collection.walletAmount ?? input.txnAmount
    );
    const remainderAmount = Math.max(0, billAmount - walletUsed);
    return {
      purpose: "OUTSTANDING_COLLECTION",
      billAmount,
      walletUsed,
      remainderAmount,
      remainderMethod:
        remainderAmount > 0 &&
        (input.collection.paymentMethod === "CASH" ||
          input.collection.paymentMethod === "GPAY")
          ? input.collection.paymentMethod
          : input.remainingPaymentMethod,
      totalPaid: billAmount,
      businessDayId: input.businessDayId,
    };
  }

  if (input.cafeOrder) {
    const billAmount = Math.round(
      input.cafeOrder.received ?? input.cafeOrder.amount
    );
    const walletUsed = Math.round(
      input.cafeOrder.walletAmount ?? input.txnAmount
    );
    const remainderAmount = Math.max(0, billAmount - walletUsed);
    const lines = (input.cafeOrder.items ?? []).map((item) => ({
      label:
        item.description?.trim() ||
        CAFE_ITEM_TYPE_LABELS[item.type as CafeItemType] ||
        item.type,
      quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
    }));
    return {
      purpose: "CAFE_PAYMENT",
      billAmount,
      walletUsed,
      remainderAmount,
      remainderMethod:
        remainderAmount > 0 &&
        (input.cafeOrder.paymentMethod === "CASH" ||
          input.cafeOrder.paymentMethod === "GPAY")
          ? input.cafeOrder.paymentMethod
          : input.remainingPaymentMethod,
      totalPaid: billAmount,
      lines,
      businessDayId: input.businessDayId,
    };
  }

  if (input.frameEntry) {
    const billAmount = Math.round(
      input.frameEntry.paidAmount ?? input.frameEntry.amount
    );
    const walletUsed = Math.round(
      input.frameEntry.walletAmount ?? input.txnAmount
    );
    const remainderAmount = Math.max(0, billAmount - walletUsed);
    const label = getEntryDisplayLabel({
      type: input.frameEntry.type as never,
      amount: input.frameEntry.amount,
      playerCount: input.frameEntry.playerCount,
      snookerGame: input.frameEntry.snookerGame as never,
      rateType: input.frameEntry.rateType as never,
    });
    return {
      purpose: "FRAME_PAYMENT",
      billAmount,
      walletUsed,
      remainderAmount,
      remainderMethod:
        remainderAmount > 0 &&
        (input.frameEntry.paymentMethod === "CASH" ||
          input.frameEntry.paymentMethod === "GPAY")
          ? input.frameEntry.paymentMethod
          : input.remainingPaymentMethod,
      totalPaid: billAmount,
      lines: [{ label, quantity: 1 }],
      businessDayId: input.businessDayId,
    };
  }

  const desc = (input.description ?? "").toLowerCase();
  let purpose: WalletPaymentPurpose = "OTHER";
  if (desc.includes("outstanding")) purpose = "OUTSTANDING_COLLECTION";
  else if (desc.includes("cafe")) purpose = "CAFE_PAYMENT";
  else if (desc.includes("frame") || desc.includes("pool") || desc.includes("split"))
    purpose = "FRAME_PAYMENT";

  const walletUsed = Math.round(input.txnAmount);
  return {
    purpose,
    billAmount: walletUsed,
    walletUsed,
    remainderAmount: 0,
    remainderMethod: input.remainingPaymentMethod,
    totalPaid: walletUsed,
    businessDayId: input.businessDayId,
  };
}

function sameCustomerId(
  left: string | undefined | null,
  right: string
): boolean {
  return Boolean(left) && String(left) === String(right);
}

/**
 * Per-customer share of a NotebookEntry for Timeline display.
 * Split frames: contributor Amount / Received only (never the parent ₹180).
 */
function customerShare(
  entry: NotebookEntryDTO,
  customerId: string
): { amount: number; paidAmount: number } | null {
  if (entry.contributors && entry.contributors.length > 0) {
    const contributor = entry.contributors.find((row) =>
      sameCustomerId(row.customerId, customerId)
    );
    if (!contributor) return null;
    return {
      amount: contributor.amount,
      paidAmount: framePaidAmount(contributor.paidAmount),
    };
  }

  if (!sameCustomerId(entry.customerId, customerId)) return null;

  return {
    amount: entry.amount,
    paidAmount: framePaidAmount(entry.paidAmount),
  };
}

function bumpLine(
  map: Map<string, { quantity: number; amount: number }>,
  label: string,
  quantity: number,
  amount: number
) {
  const existing = map.get(label);
  if (existing) {
    existing.quantity += quantity;
    existing.amount += amount;
  } else {
    map.set(label, { quantity, amount });
  }
}

function toCountLines(
  map: Map<string, { quantity: number; amount: number }>
): CustomerActivityCountLineDTO[] {
  return [...map.entries()]
    .map(([label, row]) => ({
      label,
      quantity: row.quantity,
      amount: row.amount,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Timeline Games row label — split shares stay separate from full frames. */
function gameSummaryLabel(entry: NotebookEntryDTO): string {
  const base = getEntryDisplayLabel(entry);
  if (entry.contributors && entry.contributors.length > 0) {
    return `${base} (Split)`;
  }
  return base;
}

function buildDaySummaryForCustomer(
  entries: NotebookEntryDTO[],
  customerId: string,
  todaysDue: number,
  frameCharges: Array<{ sourceRecordId: string; originalAmount: number }> = []
): CustomerActivityBusinessDaySummaryDTO {
  const games = new Map<string, { quantity: number; amount: number }>();
  const cafe = new Map<string, { quantity: number; amount: number }>();
  let todaysBill = 0;
  let todaysPayment = 0;
  const countedEntryIds = new Set<string>();

  for (const entry of entries) {
    const share = customerShare(entry, customerId);
    if (!share) continue;

    countedEntryIds.add(entry.id);
    todaysBill += share.amount;
    todaysPayment += share.paidAmount;

    if (entry.section === CAFE_SECTION) {
      const label =
        entry.type === "FOOD" && entry.itemNote?.trim()
          ? `${entryTypeLabel(entry.type)} — ${entry.itemNote.trim()}`
          : entryTypeLabel(entry.type);
      bumpLine(cafe, label, entry.quantity ?? 1, share.amount);
      continue;
    }

    bumpLine(games, gameSummaryLabel(entry), 1, share.amount);
  }

  // Display backfill: Outstanding FRAME rows point at the source entry.
  // When the NotebookEntry query missed a split contributor, still render
  // that customer's share on the Business Day card (never the parent amount).
  if (frameCharges.length > 0) {
    const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
    for (const charge of frameCharges) {
      if (countedEntryIds.has(charge.sourceRecordId)) continue;

      const entry = entriesById.get(charge.sourceRecordId);
      if (entry) {
        if (entry.section === CAFE_SECTION) continue;
        const share = customerShare(entry, customerId);
        const amount = share?.amount ?? charge.originalAmount;
        const paidAmount = share?.paidAmount ?? 0;
        todaysBill += amount;
        todaysPayment += paidAmount;
        bumpLine(games, gameSummaryLabel(entry), 1, amount);
        countedEntryIds.add(entry.id);
        continue;
      }

      todaysBill += charge.originalAmount;
      bumpLine(games, "Frame (Split)", 1, charge.originalAmount);
    }
  }

  return {
    games: toCountLines(games),
    cafe: toCountLines(cafe),
    todaysBill,
    todaysPayment,
    todaysDue,
    previousOutstanding: 0,
    currentOutstanding: 0,
  };
}

function entryDueForCustomer(
  entries: NotebookEntryDTO[],
  customerId: string
): number {
  let due = 0;
  for (const entry of entries) {
    const share = customerShare(entry, customerId);
    if (!share) continue;
    due += frameDueAmount(share.amount, share.paidAmount);
  }
  return Math.max(0, due);
}

function isCollectionKind(
  kind: CustomerActivityItemDTO["kind"]
): boolean {
  return (
    kind === "OUTSTANDING_COLLECTED" ||
    kind === "OUTSTANDING_PARTIALLY_COLLECTED"
  );
}

function isBusinessDayClosedKind(
  kind: CustomerActivityItemDTO["kind"]
): boolean {
  return kind === "BUSINESS_DAY_SUMMARY";
}

/**
 * Walk oldest → newest so each Balance History event gets
 * previous / delta / current Outstanding for a continuous passbook story.
 *
 * Balance only moves on:
 * - Business Day Closed (+ Today's Due)
 * - Outstanding Collected (− amount)
 */
function applyRunningOutstandingBalances(
  items: CustomerActivityItemDTO[]
): CustomerActivityItemDTO[] {
  const chronological = [...items].sort((a, b) => {
    const timeDiff =
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    if (timeDiff !== 0) return timeDiff;
    // Same moment: charge before collect.
    if (isBusinessDayClosedKind(a.kind) && isCollectionKind(b.kind)) {
      return -1;
    }
    if (isBusinessDayClosedKind(b.kind) && isCollectionKind(a.kind)) {
      return 1;
    }
    return a.id.localeCompare(b.id);
  });

  let running = 0;

  for (const item of chronological) {
    if (isBusinessDayClosedKind(item.kind) && item.businessDaySummary) {
      const previous = running;
      const todaysDue = item.businessDaySummary.todaysDue;
      running = previous + todaysDue;

      item.businessDaySummary.previousOutstanding = previous;
      item.businessDaySummary.currentOutstanding = running;
      item.previousOutstanding = previous;
      item.outstandingBalance = running;
      continue;
    }

    if (isCollectionKind(item.kind)) {
      const collected = item.amount ?? 0;
      const previous = running;
      const current = Math.max(0, previous - collected);

      running = current;
      item.previousOutstanding = previous;
      item.outstandingBalance = current;
    }
  }

  return items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Customer Timeline (All Activity): every closed Business Day the customer
 * participated in, plus Outstanding Collection events. Newest first.
 *
 * Balance History is a client filter over this list (events that changed
 * Outstanding only).
 */
export async function getCustomerActivityTimeline(
  customerId: string
): Promise<CustomerActivityItemDTO[]> {
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return [];
  }

  const customerObjectId = new mongoose.Types.ObjectId(customerId);

  const [rawEntriesInitial, outstandingRecords, collections, cafeOrders, walletTxns] =
    await Promise.all([
      NotebookEntry.find({
        status: { $nin: ["CANCELLED", "REVERSED"] },
        businessDayId: { $exists: true, $ne: null },
        $or: [
          { customerId },
          { "contributors.customerId": customerId },
        ],
      })
        .sort({ createdAt: 1 })
        .lean(),
      Outstanding.find({ customerId: customerObjectId })
        .select("businessDayId originalAmount sourceRecordId sourceType")
        .lean(),
      OutstandingCollection.find({ customerId: customerObjectId })
        .sort({ createdAt: 1 })
        .lean(),
      CafeOrder.find({
        customerId: customerObjectId,
        status: "OPEN",
        businessDayId: { $exists: true, $ne: null },
      })
        .sort({ createdAt: 1 })
        .lean(),
      Transaction.find({
        customerId: customerObjectId,
        isReversal: { $ne: true },
      })
        .sort({ createdAt: 1 })
        .lean(),
    ]);

  // Ensure FRAME sources linked from Outstanding are present for Games/Bill.
  // Split contributors can be missed by the customer $or query in edge cases;
  // sourceRecordId is the display pointer (Outstanding math is unchanged).
  const loadedEntryIds = new Set(
    rawEntriesInitial.map((entry) => entry._id.toString())
  );
  const missingFrameSourceIds = [
    ...new Set(
      outstandingRecords
        .filter(
          (record) =>
            record.sourceType === "FRAME" &&
            record.sourceRecordId &&
            !loadedEntryIds.has(record.sourceRecordId.toString())
        )
        .map((record) => record.sourceRecordId.toString())
    ),
  ];

  const extraFrameEntries =
    missingFrameSourceIds.length > 0
      ? await NotebookEntry.find({
          _id: {
            $in: missingFrameSourceIds.map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          },
          status: { $nin: ["CANCELLED", "REVERSED"] },
        })
          .sort({ createdAt: 1 })
          .lean()
      : [];

  const rawEntries = [...rawEntriesInitial, ...extraFrameEntries];

  const frameChargesByDay = new Map<
    string,
    Array<{ sourceRecordId: string; originalAmount: number }>
  >();
  for (const record of outstandingRecords) {
    if (record.sourceType !== "FRAME" || !record.sourceRecordId) continue;
    const dayId = record.businessDayId.toString();
    const list = frameChargesByDay.get(dayId) ?? [];
    list.push({
      sourceRecordId: record.sourceRecordId.toString(),
      originalAmount: record.originalAmount,
    });
    frameChargesByDay.set(dayId, list);
  }

  const entriesByDay = new Map<string, NotebookEntryDTO[]>();
  for (const raw of rawEntries) {
    let dayId = raw.businessDayId?.toString();
    if (!dayId) {
      // Extra FRAME fetch may omit businessDayId filter; map via Outstanding.
      for (const [outstandingDayId, charges] of frameChargesByDay) {
        if (
          charges.some(
            (charge) => charge.sourceRecordId === raw._id.toString()
          )
        ) {
          dayId = outstandingDayId;
          break;
        }
      }
    }
    if (!dayId) continue;
    const list = entriesByDay.get(dayId) ?? [];
    // Avoid duplicating if the same entry appears in both queries.
    if (list.some((entry) => entry.id === raw._id.toString())) continue;
    list.push(toNotebookEntryDTO(raw));
    entriesByDay.set(dayId, list);
  }

  const cafeByDay = new Map<
    string,
    { bill: number; paid: number; lines: Map<string, { quantity: number; amount: number }> }
  >();
  for (const order of cafeOrders) {
    if (!order.businessDayId) continue;
    const dayId = order.businessDayId.toString();
    const bucket =
      cafeByDay.get(dayId) ??
      {
        bill: 0,
        paid: 0,
        lines: new Map(),
      };
    bucket.bill += order.amount;
    bucket.paid += order.received ?? 0;
    for (const item of order.items ?? []) {
      const label =
        item.type === "FOOD" || item.type === "COLD_DRINK"
          ? item.description?.trim() || item.type
          : item.type === "CIGARETTE"
            ? "Cigarette"
            : item.type === "WATER"
              ? "Water"
              : item.type;
      const quantity =
        item.type === "CIGARETTE" || item.type === "WATER"
          ? item.quantity ?? 1
          : 1;
      const existing = bucket.lines.get(label);
      if (existing) {
        existing.quantity += quantity;
        existing.amount += item.amount;
      } else {
        bucket.lines.set(label, { quantity, amount: item.amount });
      }
    }
    cafeByDay.set(dayId, bucket);
  }

  const chargeByDay = new Map<string, number>();
  for (const record of outstandingRecords) {
    const dayId = record.businessDayId.toString();
    chargeByDay.set(
      dayId,
      (chargeByDay.get(dayId) ?? 0) + record.originalAmount
    );
  }

  // Include days that have a charge / cafe even if entry lookup missed.
  const walletDayIds = walletTxns
    .map((txn) => {
      const fromCtx = (
        txn as { paymentContext?: { businessDayId?: string } }
      ).paymentContext?.businessDayId;
      const fromTxn = txn.businessDayId?.toString();
      return fromCtx || fromTxn || undefined;
    })
    .filter((id): id is string => Boolean(id));

  const dayIds = [
    ...new Set([
      ...entriesByDay.keys(),
      ...chargeByDay.keys(),
      ...cafeByDay.keys(),
      ...walletDayIds,
    ]),
  ];

  const days = dayIds.length
    ? await BusinessDay.find({ _id: { $in: dayIds } })
        .select("_id businessDayNumber businessDate openedAt closedAt status")
        .lean()
    : [];

  const dayById = new Map(days.map((day) => [day._id.toString(), day]));

  const items: CustomerActivityItemDTO[] = [];

  for (const dayId of dayIds) {
    const day = dayById.get(dayId);
    if (!day) continue;

    // Outstanding balance only changes when a Business Day closes.
    if (day.status !== "CLOSED" || !day.closedAt) continue;

    const dayEntries = entriesByDay.get(dayId) ?? [];
    const cafeDay = cafeByDay.get(dayId);
    const chargeFromOutstanding = chargeByDay.get(dayId) ?? 0;
    const dueFromEntries = entryDueForCustomer(dayEntries, customerId);
    const dueFromCafe = cafeDay
      ? Math.max(0, cafeDay.bill - cafeDay.paid)
      : 0;
    const todaysDue =
      chargeFromOutstanding > 0
        ? chargeFromOutstanding
        : dueFromEntries + dueFromCafe;

    const summary = buildDaySummaryForCustomer(
      dayEntries,
      customerId,
      todaysDue,
      frameChargesByDay.get(dayId) ?? []
    );

    if (cafeDay) {
      summary.todaysBill += cafeDay.bill;
      summary.todaysPayment += cafeDay.paid;
      for (const [label, row] of cafeDay.lines) {
        const existing = summary.cafe.find((line) => line.label === label);
        if (existing) {
          existing.quantity += row.quantity;
          existing.amount += row.amount;
        } else {
          summary.cafe.push({
            label,
            quantity: row.quantity,
            amount: row.amount,
          });
        }
      }
      summary.cafe.sort((a, b) => a.label.localeCompare(b.label));
      // Recalculate due display from bill/payment when no outstanding charge stamp.
      if (chargeFromOutstanding <= 0) {
        summary.todaysDue = Math.max(
          0,
          summary.todaysBill - summary.todaysPayment
        );
      }
    }

    // All Activity: every closed day the customer participated in (even Due = 0).
    const participated =
      summary.games.length > 0 ||
      summary.cafe.length > 0 ||
      summary.todaysBill > 0 ||
      summary.todaysDue > 0;
    if (!participated) continue;

    const businessDate = resolveBusinessDate(day.businessDate, day.openedAt);

    items.push({
      id: `bd-${dayId}`,
      // Chronology follows close time so collections after close sort correctly.
      timestamp: day.closedAt.toISOString(),
      businessDate: businessDate.toISOString(),
      kind: "BUSINESS_DAY_SUMMARY",
      label: "Business Day Closed",
      businessDayId: dayId,
      businessDayPublicId: formatBusinessDayPublicId(day.businessDayNumber),
      businessDaySummary: summary,
    });
  }

  for (const collection of collections) {
    const remainingAfter =
      typeof collection.remainingBalanceAfter === "number"
        ? collection.remainingBalanceAfter
        : undefined;
    const isPartial =
      remainingAfter !== undefined ? remainingAfter > 0 : false;

    items.push({
      id: `collection-${collection._id.toString()}`,
      timestamp: collection.createdAt.toISOString(),
      kind: isPartial
        ? "OUTSTANDING_PARTIALLY_COLLECTED"
        : "OUTSTANDING_COLLECTED",
      label: "Outstanding Collected",
      amount: collection.amount,
      paymentMethod: collection.paymentMethod,
      paymentMethodLabel: paymentMethodLabel(collection.paymentMethod),
      createdBy: collection.createdBy,
      // Running balance is recomputed; do not trust stale remainingBalanceAfter
      // when mixing charge sources.
    });
  }

  for (const txn of walletTxns) {
    if (txn.type === "credit") {
      items.push({
        id: `wallet-credit-${txn._id.toString()}`,
        timestamp: txn.createdAt.toISOString(),
        kind: "WALLET_RECHARGE",
        label: "Wallet Recharge",
        amount: txn.paidAmount ?? txn.creditedAmount ?? 0,
        bonusAmount: txn.bonusAmount,
        creditedAmount: txn.creditedAmount,
        paymentMethod: txn.paymentMethod,
        paymentMethodLabel: paymentMethodLabel(txn.paymentMethod),
        walletBalanceAfter: txn.balanceAfter,
        createdBy: txn.staffUsername,
        businessDayId: txn.businessDayId?.toString(),
        businessDayPublicId: txn.businessDayId
          ? (() => {
              const day = dayById.get(txn.businessDayId.toString());
              return day
                ? formatBusinessDayPublicId(day.businessDayNumber)
                : undefined;
            })()
          : undefined,
      });
      continue;
    }

    if (txn.type === "debit") {
      const txnId = txn._id.toString();
      const storedCtx = (
        txn as { paymentContext?: WalletPaymentContext }
      ).paymentContext;

      const frameEntry = rawEntries.find(
        (entry) => entry.walletTransactionId?.toString() === txnId
      );
      const cafeOrder = cafeOrders.find(
        (order) => order.walletTransactionId?.toString() === txnId
      );
      const collection = collections.find(
        (row) =>
          (row as { walletTransactionId?: { toString(): string } })
            .walletTransactionId?.toString() === txnId
      );

      const remaining =
        txn.remainingPaymentMethod === "CASH" ||
        txn.remainingPaymentMethod === "GPAY"
          ? txn.remainingPaymentMethod
          : undefined;

      const businessDayId =
        storedCtx?.businessDayId ||
        txn.businessDayId?.toString() ||
        frameEntry?.businessDayId?.toString() ||
        cafeOrder?.businessDayId?.toString() ||
        undefined;

      const ctx =
        storedCtx && storedCtx.purpose
          ? storedCtx
          : inferWalletPaymentContext({
              txnAmount: txn.amount ?? 0,
              remainingPaymentMethod: remaining,
              description: txn.description,
              businessDayId,
              frameEntry: frameEntry
                ? {
                    amount: frameEntry.amount,
                    paidAmount: frameEntry.paidAmount,
                    walletAmount: frameEntry.walletAmount,
                    paymentMethod: frameEntry.paymentMethod,
                    type: frameEntry.type,
                    playerCount: frameEntry.playerCount,
                    snookerGame: frameEntry.snookerGame,
                    rateType: frameEntry.rateType,
                  }
                : undefined,
              cafeOrder: cafeOrder
                ? {
                    amount: cafeOrder.amount,
                    received: cafeOrder.received,
                    walletAmount: cafeOrder.walletAmount,
                    paymentMethod: cafeOrder.paymentMethod,
                    items: cafeOrder.items,
                  }
                : undefined,
              collection: collection
                ? {
                    amount: collection.amount,
                    walletAmount: (
                      collection as { walletAmount?: number }
                    ).walletAmount,
                    paymentMethod: collection.paymentMethod,
                  }
                : undefined,
            });

      const day = businessDayId ? dayById.get(businessDayId) : undefined;

      items.push({
        id: `wallet-debit-${txnId}`,
        timestamp: txn.createdAt.toISOString(),
        kind: "WALLET_PAYMENT",
        label: walletPaymentPurposeLabel(ctx.purpose),
        amount: ctx.walletUsed || txn.amount || 0,
        paymentMethod: "WALLET",
        paymentMethodLabel: paymentMethodLabel("WALLET"),
        remainingPaymentMethod: ctx.remainderMethod ?? remaining,
        remainingPaymentMethodLabel: paymentMethodLabel(
          ctx.remainderMethod ?? remaining
        ),
        walletPayment: toWalletPaymentActivity(ctx),
        walletBalanceAfter: txn.balanceAfter,
        createdBy: txn.staffUsername,
        businessDayId,
        businessDayPublicId: day
          ? formatBusinessDayPublicId(day.businessDayNumber)
          : undefined,
        businessDate: day
          ? resolveBusinessDate(day.businessDate, day.openedAt).toISOString()
          : undefined,
      });
    }
  }

  return applyRunningOutstandingBalances(items);
}
