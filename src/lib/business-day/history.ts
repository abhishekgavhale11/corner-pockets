import mongoose from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import NotebookEntry from "@/models/NotebookEntry";
import CafeOrder from "@/models/CafeOrder";
import { toBusinessDayDTO } from "@/lib/mappers/business-day";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import {
  CAFE_SECTION,
} from "@/lib/constants/counter-sections";
import { CAFE_ITEM_TYPE_LABELS } from "@/lib/constants/cafe";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { NOTEBOOK_SECTIONS } from "@/lib/constants/notebook-sections";
import {
  listBusinessDayFinalSummaries,
  requireBusinessDayFinalSummary,
  type BusinessDayFinalSummaryPayload,
} from "@/lib/financial-summary";
import { formatBusinessDayPublicId } from "@/lib/business-day/format";
import {
  getBusinessDateRangeBounds,
  getDefaultBusinessDayHistoryRange,
  resolveBusinessDate,
} from "@/lib/utils/business-date";
import { frameReceivedAmount } from "@/lib/utils/frame-payment";
import {
  formatCafeItemLabel,
  getEntryDisplayLabel,
} from "@/lib/utils/notebook-entry-label";
import {
  addSectionSummaries,
  emptyHistoryInsights,
} from "@/lib/business-day/history-insights";
import {
  buildBusinessDayOutstandingTrend,
  getOutstandingRecoveredForReportRange,
} from "@/lib/business-day/history-outstanding";
import type {
  BusinessDayHistoryCafeLineDTO,
  BusinessDayHistoryDetailDTO,
  BusinessDayHistoryFrameLineDTO,
  BusinessDayHistoryListItemDTO,
  BusinessDayHistoryListResultDTO,
  BusinessDayHistorySettlementRowDTO,
  BusinessDayHistorySummaryDTO,
  NotebookEntryDTO,
} from "@/types";
import type { Types } from "mongoose";

function entryTableLabel(entry: NotebookEntryDTO): string {
  if (entry.section === "CAFE") {
    return entry.tableId ? sectionLabel(entry.tableId) : "—";
  }
  return sectionLabel(entry.section);
}

function drawerTableOrder(entry: NotebookEntryDTO): number {
  const section =
    entry.section === "CAFE" && entry.tableId ? entry.tableId : entry.section;
  const index = (NOTEBOOK_SECTIONS as readonly string[]).indexOf(section);
  return index >= 0 ? index : NOTEBOOK_SECTIONS.length;
}

function sortEntries(entries: NotebookEntryDTO[]): NotebookEntryDTO[] {
  return [...entries].sort((a, b) => {
    const tableDiff = drawerTableOrder(a) - drawerTableOrder(b);
    if (tableDiff !== 0) return tableDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

type ChargeLine = {
  entryId: string;
  customerId?: string;
  customerName: string;
  amount: number;
  paidAmount: number;
  paymentMethod?: NotebookEntryDTO["paymentMethod"];
  paymentAllocations?: NotebookEntryDTO["paymentAllocations"];
  receivedByUsername?: string;
  receivedAt?: string;
  createdAt: string;
};

function collectChargeLines(entry: NotebookEntryDTO): ChargeLine[] {
  if (entry.contributors && entry.contributors.length > 0) {
    return entry.contributors.map((contributor) => ({
      entryId: entry.id,
      customerId: contributor.customerId,
      customerName: contributor.customerName,
      amount: contributor.amount,
      // History charge-line paidAmount = full Received (Proof): paid + balanceCollected.
      paidAmount: frameReceivedAmount(
        contributor.paidAmount,
        contributor.balanceCollectedAmount
      ),
      paymentMethod: contributor.paymentMethod ?? entry.paymentMethod,
      receivedByUsername: contributor.receivedByUsername,
      receivedAt: contributor.receivedAt,
      createdAt: entry.createdAt,
    }));
  }

  if (!entry.customerId) {
    return [];
  }

  return [
    {
      entryId: entry.id,
      customerId: entry.customerId,
      customerName: entry.customerName,
      amount: entry.amount,
      // History charge-line paidAmount = full Received (Proof): paid + balanceCollected.
      paidAmount: frameReceivedAmount(
        entry.paidAmount,
        entry.balanceCollectedAmount
      ),
      paymentMethod: entry.paymentMethod,
      paymentAllocations: entry.paymentAllocations,
      receivedByUsername: entry.receivedByUsername,
      receivedAt: entry.receivedAt,
      createdAt: entry.createdAt,
    },
  ];
}

function buildFrameLines(
  entries: NotebookEntryDTO[]
): BusinessDayHistoryFrameLineDTO[] {
  return sortEntries(entries).flatMap((entry) =>
    collectChargeLines(entry).map((line) => ({
      entryId: line.entryId,
      section: entry.section,
      table: entryTableLabel(entry),
      customerId: line.customerId,
      customerName: line.customerName,
      gameType: getEntryDisplayLabel(entry),
      amount: line.amount,
      paidAmount: line.paidAmount,
      paymentMethod: line.paymentMethod,
      paymentAllocations: line.paymentAllocations,
      receivedByUsername: line.receivedByUsername,
      receivedAt: line.receivedAt,
      createdAt: line.createdAt,
    }))
  );
}

function buildCafeLines(
  entries: NotebookEntryDTO[]
): BusinessDayHistoryCafeLineDTO[] {
  return sortEntries(entries).flatMap((entry) =>
    collectChargeLines(entry).map((line) => ({
      entryId: line.entryId,
      customerId: line.customerId,
      customerName: line.customerName,
      item: formatCafeItemLabel(entry),
      amount: line.amount,
      paidAmount: line.paidAmount,
      paymentMethod: line.paymentMethod,
      paymentAllocations: line.paymentAllocations,
      receivedByUsername: line.receivedByUsername,
      receivedAt: line.receivedAt,
      createdAt: line.createdAt,
    }))
  );
}

type LeanCafeOrder = {
  _id: Types.ObjectId;
  customerId?: Types.ObjectId | null;
  customerName: string;
  amount: number;
  received?: number;
  paymentMethod?: NotebookEntryDTO["paymentMethod"];
  receivedByUsername?: string;
  receivedAt?: Date;
  createdAt: Date;
  items?: Array<{
    type: string;
    description?: string;
    quantity?: number;
    amount: number;
  }>;
};

function settlementsFromFinalSummary(
  summary: BusinessDayFinalSummaryPayload
): BusinessDayHistorySettlementRowDTO[] {
  return summary.customers.map((row) => ({
    customerId: row.customerId,
    customerName: row.customerName,
    bigSnooker: row.bigSnooker,
    poolMini: row.poolMini,
    cafe: row.cafe,
    bill: row.bill,
    received: row.received,
    cashCollection: row.cashCollection,
    gpayCollection: row.gpayCollection,
    due: row.due,
  }));
}

/**
 * Drill-down operational lines only (frames / cafe items).
 * Financial totals come from Business Day Final Summary — never from these lines.
 */
async function buildHistoryDrilldownLines(businessDayId: Types.ObjectId): Promise<{
  frames: BusinessDayHistoryFrameLineDTO[];
  cafe: BusinessDayHistoryCafeLineDTO[];
}> {
  const [rawEntries, cafeOrders] = await Promise.all([
    NotebookEntry.find({
      businessDayId,
      status: { $nin: ["CANCELLED", "REVERSED"] },
    })
      .sort({ createdAt: 1 })
      .lean(),
    CafeOrder.find({
      businessDayId,
      status: "OPEN",
    })
      .sort({ createdAt: 1 })
      .lean() as Promise<LeanCafeOrder[]>,
  ]);

  const entries = rawEntries.map((entry) => toNotebookEntryDTO(entry));
  const frameEntries = entries.filter((entry) => entry.section !== CAFE_SECTION);
  const cafeEntries = entries.filter((entry) => entry.section === CAFE_SECTION);

  const frames = buildFrameLines(frameEntries);
  const cafeFromEntries = buildCafeLines(cafeEntries);

  const cafeFromOrders: BusinessDayHistoryCafeLineDTO[] = cafeOrders.flatMap(
    (order) =>
      (order.items ?? []).map((item, index) => ({
        entryId: `${order._id.toString()}-${index}`,
        customerId: order.customerId?.toString(),
        customerName: order.customerName,
        item:
          item.type === "FOOD" || item.type === "COLD_DRINK"
            ? item.description?.trim() ||
              CAFE_ITEM_TYPE_LABELS[
                item.type as keyof typeof CAFE_ITEM_TYPE_LABELS
              ] ||
              item.type
            : `${
                CAFE_ITEM_TYPE_LABELS[
                  item.type as keyof typeof CAFE_ITEM_TYPE_LABELS
                ] || item.type
              }${item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ""}`,
        amount: item.amount,
        paidAmount:
          order.amount > 0
            ? Math.round(((order.received ?? 0) * item.amount) / order.amount)
            : 0,
        paymentMethod: order.paymentMethod,
        receivedByUsername: order.receivedByUsername,
        receivedAt: order.receivedAt?.toISOString(),
        createdAt: order.createdAt.toISOString(),
      }))
  );

  return { frames, cafe: [...cafeFromEntries, ...cafeFromOrders] };
}

export async function getClosedBusinessDayHistoryList(
  options: {
    from?: string;
    to?: string;
    limit?: number;
  } = {}
): Promise<BusinessDayHistoryListResultDTO> {
  const defaults = getDefaultBusinessDayHistoryRange();
  const from = options.from?.trim() || defaults.from;
  const to = options.to?.trim() || defaults.to;
  const limit = options.limit ?? 500;

  const { start, end } = getBusinessDateRangeBounds(from, to);

  const days = await BusinessDay.find({
    status: "CLOSED",
    $or: [
      { businessDate: { $gte: start, $lte: end } },
      {
        $and: [
          {
            $or: [
              { businessDate: { $exists: false } },
              { businessDate: null },
            ],
          },
          { openedAt: { $gte: start, $lte: end } },
        ],
      },
    ],
  })
    .sort({ businessDayNumber: -1 })
    .limit(limit)
    .lean();

  const matchedDays: Array<{
    _id: Types.ObjectId;
    businessDayNumber: number;
    openedAt: Date;
    closedAt: Date;
    resolvedBusinessDate: Date;
  }> = [];

  for (const day of days) {
    if (!day.closedAt) continue;
    const businessDate = resolveBusinessDate(day.businessDate, day.openedAt);
    if (businessDate < start || businessDate > end) continue;
    matchedDays.push({
      _id: day._id,
      businessDayNumber: day.businessDayNumber,
      openedAt: day.openedAt,
      closedAt: day.closedAt,
      resolvedBusinessDate: businessDate,
    });
  }

  const finalById = await listBusinessDayFinalSummaries(
    matchedDays.map((day) => day._id)
  );
  const reportRangeRecovered = await getOutstandingRecoveredForReportRange(
    from,
    to
  );

  const items: BusinessDayHistoryListItemDTO[] = [];
  let insights = emptyHistoryInsights();

  for (const day of matchedDays) {
    const dayId = day._id.toString();
    const finalSummary = finalById.get(dayId);
    if (!finalSummary) continue;

    items.push({
      id: dayId,
      businessDayNumber: day.businessDayNumber,
      publicId: formatBusinessDayPublicId(day.businessDayNumber),
      businessDate: day.resolvedBusinessDate.toISOString(),
      openedAt: day.openedAt.toISOString(),
      closedAt: day.closedAt!.toISOString(),
      todaysBill: finalSummary.bill,
      totalReceived: finalSummary.paid,
      outstandingCreated: finalSummary.outstandingCreated,
      outstandingRecovered: finalSummary.outstandingCollected,
      closingOutstanding: finalSummary.closingOutstanding,
    });

    insights = {
      overall: {
        totalRevenue: insights.overall.totalRevenue + finalSummary.bill,
        totalReceived: insights.overall.totalReceived + finalSummary.paid,
        cashCollection:
          insights.overall.cashCollection + finalSummary.cashCollection,
        gpayCollection:
          insights.overall.gpayCollection + finalSummary.gpayCollection,
        outstandingCreated:
          insights.overall.outstandingCreated + finalSummary.outstandingCreated,
        outstandingRecovered:
          insights.overall.outstandingRecovered +
          finalSummary.outstandingCollected,
      },
      bigSnooker: addSectionSummaries(
        insights.bigSnooker,
        finalSummary.bigSnooker
      ),
      poolMini: addSectionSummaries(insights.poolMini, finalSummary.poolMini),
      totalSnooker: addSectionSummaries(
        insights.totalSnooker,
        finalSummary.snooker
      ),
      cafe: addSectionSummaries(insights.cafe, finalSummary.cafe),
    };
  }

  const listSummary: BusinessDayHistorySummaryDTO = {
    totalBusinessDays: items.length,
    totalBill: insights.overall.totalRevenue,
    totalReceived: insights.overall.totalReceived,
    outstandingCreated: insights.overall.outstandingCreated,
    outstandingRecovered: reportRangeRecovered,
    insights,
  };

  return { from, to, items, summary: listSummary };
}

export async function getBusinessDayHistoryDetail(
  businessDayId: string
): Promise<BusinessDayHistoryDetailDTO | null> {
  if (!mongoose.Types.ObjectId.isValid(businessDayId)) {
    return null;
  }

  const day = await BusinessDay.findById(businessDayId).lean();
  if (!day || day.status !== "CLOSED" || !day.closedAt) {
    return null;
  }

  const finalSummary = await requireBusinessDayFinalSummary(day._id);
  const settlements = settlementsFromFinalSummary(finalSummary);
  const { frames, cafe } = await buildHistoryDrilldownLines(day._id);

  const outstandingTrend = await buildBusinessDayOutstandingTrend({
    businessDayNumber: day.businessDayNumber,
    openedAt: day.openedAt,
    closedAt: day.closedAt,
    settlements,
    outstandingCreated: finalSummary.outstandingCreated,
    snapshotted: {
      openingOutstanding: finalSummary.openingOutstanding,
      closingOutstanding: finalSummary.closingOutstanding,
      outstandingRecovered: finalSummary.outstandingCollected,
    },
  });

  return {
    day: toBusinessDayDTO(day),
    publicId: formatBusinessDayPublicId(day.businessDayNumber),
    businessDate: resolveBusinessDate(
      day.businessDate,
      day.openedAt
    ).toISOString(),
    summary: {
      todaysBill: finalSummary.bill,
      totalReceived: finalSummary.paid,
      cashCollection: finalSummary.cashCollection,
      gpayCollection: finalSummary.gpayCollection,
      outstandingCreated: finalSummary.outstandingCreated,
      closingOutstanding: finalSummary.closingOutstanding,
    },
    gamesSummary: {
      bill: finalSummary.snooker.bill,
      received: finalSummary.snooker.received,
      cashCollection: finalSummary.snooker.cashCollection,
      gpayCollection: finalSummary.snooker.gpayCollection,
      outstandingCreated: finalSummary.snooker.outstandingCreated,
    },
    cafeSummary: {
      bill: finalSummary.cafe.bill,
      received: finalSummary.cafe.received,
      cashCollection: finalSummary.cafe.cashCollection,
      gpayCollection: finalSummary.cafe.gpayCollection,
      outstandingCreated: finalSummary.cafe.outstandingCreated,
    },
    insights: {
      overall: {
        totalRevenue: finalSummary.bill,
        totalReceived: finalSummary.paid,
        cashCollection: finalSummary.cashCollection,
        gpayCollection: finalSummary.gpayCollection,
        outstandingCreated: finalSummary.outstandingCreated,
        outstandingRecovered: finalSummary.outstandingCollected,
      },
      bigSnooker: finalSummary.bigSnooker,
      poolMini: finalSummary.poolMini,
      totalSnooker: finalSummary.snooker,
      cafe: finalSummary.cafe,
    },
    outstandingTrend,
    settlements,
    frames,
    cafe,
  };
}
