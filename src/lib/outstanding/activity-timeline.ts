import mongoose from "mongoose";
import Outstanding from "@/models/Outstanding";
import OutstandingCollection from "@/models/OutstandingCollection";
import BusinessDay from "@/models/BusinessDay";
import NotebookEntry from "@/models/NotebookEntry";
import CafeOrder from "@/models/CafeOrder";
import { CAFE_SECTION } from "@/lib/constants/counter-sections";
import { entryTypeLabel } from "@/lib/constants/notebook-entry-types";
import { formatBusinessDayPublicId } from "@/lib/business-day/format";
import { listFinancialCorrectionsForCustomer } from "@/lib/financial-corrections/queries";
import { FINANCIAL_CORRECTION_SECTION_LABELS } from "@/lib/constants/financial-corrections";
import {
  customerEntryShare,
  listCorrectedBusinessDayFinalSummaries,
  type BusinessDayFinalSummaryPayload,
} from "@/lib/financial-summary";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import type { OutstandingPaymentMethod } from "@/lib/constants/outstanding";
import { resolveBusinessDate } from "@/lib/utils/business-date";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import type {
  CustomerActivityBusinessDaySummaryDTO,
  CustomerActivityCountLineDTO,
  CustomerActivityItemDTO,
  NotebookEntryDTO,
} from "@/types";

function paymentMethodLabel(
  method: OutstandingPaymentMethod | "CASH" | "GPAY" | string | null | undefined
): string {
  if (method === "CASH") return "Cash";
  if (method === "GPAY") return "GPay";
  return method ? String(method) : "—";
}

function customerShare(
  entry: NotebookEntryDTO,
  customerId: string
): { amount: number; paidAmount: number } | null {
  return customerEntryShare(entry, customerId);
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

function gameSummaryLabel(entry: NotebookEntryDTO): string {
  const base = getEntryDisplayLabel(entry);
  if (entry.contributors && entry.contributors.length > 0) {
    return `${base} (Split)`;
  }
  return base;
}

function buildActivityLinesForCustomer(
  entries: NotebookEntryDTO[],
  customerId: string
): {
  games: CustomerActivityCountLineDTO[];
  cafe: CustomerActivityCountLineDTO[];
} {
  const games = new Map<string, { quantity: number; amount: number }>();
  const cafe = new Map<string, { quantity: number; amount: number }>();

  for (const entry of entries) {
    const share = customerShare(entry, customerId);
    if (!share) continue;

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

  return { games: toCountLines(games), cafe: toCountLines(cafe) };
}

function summaryFromFinalCustomer(
  finalSummary: BusinessDayFinalSummaryPayload,
  customerId: string,
  activity: {
    games: CustomerActivityCountLineDTO[];
    cafe: CustomerActivityCountLineDTO[];
  }
): CustomerActivityBusinessDaySummaryDTO | null {
  const row = finalSummary.customers.find(
    (customer) => customer.customerId === customerId
  );
  if (!row && activity.games.length === 0 && activity.cafe.length === 0) {
    return null;
  }

  const bill = row?.bill ?? 0;
  const paid = row?.received ?? 0;
  const due = row?.due ?? Math.max(0, bill - paid);

  return {
    games: activity.games,
    cafe: activity.cafe,
    todaysBill: bill,
    todaysPayment: paid,
    paymentSummary: {
      cash: row?.cashCollection ?? 0,
      gpay: row?.gpayCollection ?? 0,
      totalPaid: (row?.cashCollection ?? 0) + (row?.gpayCollection ?? 0),
    },
    todaysDue: due,
    previousOutstanding: 0,
    currentOutstanding: 0,
  };
}

function isCollectionKind(
  kind: CustomerActivityItemDTO["kind"]
): boolean {
  return (
    kind === "OUTSTANDING_COLLECTED" ||
    kind === "OUTSTANDING_PARTIALLY_COLLECTED"
  );
}

function isCorrectionKind(
  kind: CustomerActivityItemDTO["kind"]
): boolean {
  return kind === "MISSED_PAYMENT" || kind === "OUTSTANDING_CORRECTION";
}

function isBusinessDayClosedKind(
  kind: CustomerActivityItemDTO["kind"]
): boolean {
  return kind === "BUSINESS_DAY_SUMMARY";
}

function isOpeningOutstandingKind(
  kind: CustomerActivityItemDTO["kind"]
): boolean {
  return kind === "OPENING_OUTSTANDING";
}

function applyRunningOutstandingBalances(
  items: CustomerActivityItemDTO[]
): CustomerActivityItemDTO[] {
  const chronological = [...items].sort((a, b) => {
    const timeDiff =
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    if (timeDiff !== 0) return timeDiff;
    const rank = (item: CustomerActivityItemDTO) => {
      if (isOpeningOutstandingKind(item.kind)) return 0;
      if (isBusinessDayClosedKind(item.kind)) return 1;
      if (isCollectionKind(item.kind)) return 2;
      if (isCorrectionKind(item.kind)) return 3;
      return 4;
    };
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.id.localeCompare(b.id);
  });

  let running = 0;

  for (const item of chronological) {
    if (isOpeningOutstandingKind(item.kind) && item.openingOutstanding) {
      const previous = running;
      const amount = item.openingOutstanding.amount;
      running = previous + amount;

      item.previousOutstanding = previous;
      item.outstandingBalance = running;
      continue;
    }

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
      continue;
    }

    if (isCorrectionKind(item.kind)) {
      item.previousOutstanding = running;
      item.outstandingBalance = running;
    }
  }

  return items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function getCustomerActivityTimeline(
  customerId: string
): Promise<CustomerActivityItemDTO[]> {
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return [];
  }

  const customerObjectId = new mongoose.Types.ObjectId(customerId);

  const [rawEntriesInitial, outstandingRecords, collections, cafeOrders, financialCorrections] =
    await Promise.all([
      NotebookEntry.find({
        status: { $nin: ["CANCELLED", "REVERSED"] },
        businessDayId: { $exists: true, $ne: null },
        $or: [{ customerId }, { "contributors.customerId": customerId }],
      })
        .sort({ createdAt: 1 })
        .lean(),
      Outstanding.find({ customerId: customerObjectId })
        .select(
          "_id businessDayId originalAmount sourceRecordId sourceType reason effectiveDate createdBy createdAt"
        )
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
      listFinancialCorrectionsForCustomer(customerId),
    ]);

  const loadedEntryIds = new Set(
    rawEntriesInitial.map((entry) => entry._id.toString())
  );
  const missingFrameSourceIds = [
    ...new Set(
      outstandingRecords
        .filter(
          (record) =>
            record.sourceType === "FRAME" &&
            Boolean(record.sourceRecordId) &&
            !loadedEntryIds.has(record.sourceRecordId!.toString())
        )
        .map((record) => record.sourceRecordId!.toString())
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
    if (!record.businessDayId) continue;
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
    if (record.sourceType === "OPENING" || !record.businessDayId) continue;
    const dayId = record.businessDayId.toString();
    chargeByDay.set(
      dayId,
      (chargeByDay.get(dayId) ?? 0) + record.originalAmount
    );
  }

  const dayIds = [
    ...new Set([
      ...entriesByDay.keys(),
      ...chargeByDay.keys(),
      ...cafeByDay.keys(),
    ]),
  ];

  const days = dayIds.length
    ? await BusinessDay.find({ _id: { $in: dayIds } })
        .select("_id businessDayNumber businessDate openedAt closedAt status")
        .lean()
    : [];

  const dayById = new Map(days.map((day) => [day._id.toString(), day]));

  const items: CustomerActivityItemDTO[] = [];

  for (const record of outstandingRecords) {
    if (record.sourceType !== "OPENING") continue;

    items.push({
      id: `opening-${record._id.toString()}`,
      timestamp: new Date(record.createdAt).toISOString(),
      kind: "OPENING_OUTSTANDING",
      label: "Opening Outstanding",
      amount: record.originalAmount,
      createdBy: record.createdBy,
      openingOutstanding: {
        amount: record.originalAmount,
        reason: record.reason?.trim() || undefined,
        effectiveDate: record.effectiveDate
          ? new Date(record.effectiveDate).toISOString()
          : undefined,
        createdBy: record.createdBy?.trim() || "—",
      },
    });
  }

  const closedDayIds = dayIds.filter((dayId) => {
    const day = dayById.get(dayId);
    return Boolean(day && day.status === "CLOSED" && day.closedAt);
  });
  const finalByDayId = await listCorrectedBusinessDayFinalSummaries(closedDayIds);

  for (const dayId of dayIds) {
    const day = dayById.get(dayId);
    if (!day) continue;

    if (day.status !== "CLOSED" || !day.closedAt) continue;

    const finalSummary = finalByDayId.get(dayId);
    if (!finalSummary) continue;

    const dayEntries = entriesByDay.get(dayId) ?? [];
    const cafeDay = cafeByDay.get(dayId);
    const activity = buildActivityLinesForCustomer(dayEntries, customerId);

    if (cafeDay) {
      for (const [label, row] of cafeDay.lines) {
        const existing = activity.cafe.find((line) => line.label === label);
        if (existing) {
          existing.quantity += row.quantity;
          existing.amount += row.amount;
        } else {
          activity.cafe.push({
            label,
            quantity: row.quantity,
            amount: row.amount,
          });
        }
      }
      activity.cafe.sort((a, b) => a.label.localeCompare(b.label));
    }

    const summary = summaryFromFinalCustomer(
      finalSummary,
      customerId,
      activity
    );
    if (!summary) continue;

    const participated =
      summary.games.length > 0 ||
      summary.cafe.length > 0 ||
      summary.todaysBill > 0 ||
      summary.todaysDue > 0;
    if (!participated) continue;

    const businessDate = resolveBusinessDate(day.businessDate, day.openedAt);

    items.push({
      id: `bd-${dayId}`,
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
      createdBy:
        (collection as { receivedByUsername?: string }).receivedByUsername ||
        collection.createdBy,
      receivedByUsername:
        (collection as { receivedByUsername?: string }).receivedByUsername ||
        collection.createdBy,
      receivedAt:
        (collection as { receivedAt?: Date }).receivedAt?.toISOString() ||
        collection.createdAt.toISOString(),
    });
  }

  const affectedDayIds = [
    ...new Set(financialCorrections.map((row) => row.affectedBusinessDayId)),
  ];
  const affectedDays =
    affectedDayIds.length > 0
      ? await BusinessDay.find({
          _id: {
            $in: affectedDayIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .select("_id businessDayNumber businessDate openedAt")
          .lean()
      : [];
  const affectedPublicId = new Map(
    affectedDays.map((day) => [
      day._id.toString(),
      formatBusinessDayPublicId(day.businessDayNumber),
    ])
  );
  const affectedBusinessDate = new Map(
    affectedDays.map((day) => [
      day._id.toString(),
      resolveBusinessDate(day.businessDate, day.openedAt).toISOString(),
    ])
  );

  for (const correction of financialCorrections) {
    const isMissed = correction.type === "MISSED_PAYMENT";
    items.push({
      id: `correction-${correction.id}`,
      timestamp: correction.createdAt.toISOString(),
      kind: isMissed ? "MISSED_PAYMENT" : "OUTSTANDING_CORRECTION",
      label: isMissed ? "Missed Payment" : "Outstanding Correction",
      amount: correction.amount,
      paymentMethod: correction.paymentMethod ?? undefined,
      paymentMethodLabel: isMissed
        ? paymentMethodLabel(correction.paymentMethod)
        : undefined,
      createdBy: correction.createdBy,
      reason: correction.reason,
      section: correction.section,
      sectionLabel: correction.section
        ? FINANCIAL_CORRECTION_SECTION_LABELS[correction.section]
        : undefined,
      businessDayId: correction.affectedBusinessDayId,
      businessDayPublicId:
        affectedPublicId.get(correction.affectedBusinessDayId) ?? undefined,
      businessDate:
        affectedBusinessDate.get(correction.affectedBusinessDayId) ?? undefined,
    });
  }

  return applyRunningOutstandingBalances(items);
}
