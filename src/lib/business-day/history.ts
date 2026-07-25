import mongoose from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import NotebookEntry from "@/models/NotebookEntry";
import CafeOrder from "@/models/CafeOrder";
import { toBusinessDayDTO } from "@/lib/mappers/business-day";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import {
  CAFE_SECTION,
  isBigSnookerSection,
  isPoolMiniSection,
} from "@/lib/constants/counter-sections";
import { CAFE_ITEM_TYPE_LABELS } from "@/lib/constants/cafe";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { NOTEBOOK_SECTIONS } from "@/lib/constants/notebook-sections";
import { buildBusinessDayCloseSummaryForId } from "@/lib/business-day/close-summary";
import { formatBusinessDayPublicId } from "@/lib/business-day/format";
import {
  getBusinessDateRangeBounds,
  getDefaultBusinessDayHistoryRange,
  resolveBusinessDate,
} from "@/lib/utils/business-date";
import { attributePaymentCollections } from "@/lib/business-day/payment-collections";
import { frameDueAmount, framePaidAmount } from "@/lib/utils/frame-payment";
import {
  formatCafeItemLabel,
  getEntryDisplayLabel,
} from "@/lib/utils/notebook-entry-label";
import {
  addSectionSummaries,
  buildSnookerSectionInsights,
  countCafeOrders,
  emptyHistoryInsights,
} from "@/lib/business-day/history-insights";
import {
  buildWalletActivityForBusinessDays,
} from "@/lib/business-day/wallet-activity";
import type {
  BusinessDayHistoryCafeLineDTO,
  BusinessDayHistoryCategorySummaryDTO,
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
  walletAmount?: number;
  createdAt: string;
};

function collectChargeLines(entry: NotebookEntryDTO): ChargeLine[] {
  if (entry.contributors && entry.contributors.length > 0) {
    return entry.contributors.map((contributor) => ({
      entryId: entry.id,
      customerId: contributor.customerId,
      customerName: contributor.customerName,
      amount: contributor.amount,
      paidAmount: framePaidAmount(contributor.paidAmount),
      paymentMethod: contributor.paymentMethod ?? entry.paymentMethod,
      walletAmount: contributor.walletAmount,
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
      paidAmount: framePaidAmount(entry.paidAmount),
      paymentMethod: entry.paymentMethod,
      walletAmount: entry.walletAmount,
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
      walletAmount: line.walletAmount,
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
      walletAmount: line.walletAmount,
      createdAt: line.createdAt,
    }))
  );
}

function buildSettlementRows(
  frames: BusinessDayHistoryFrameLineDTO[],
  cafe: BusinessDayHistoryCafeLineDTO[]
): BusinessDayHistorySettlementRowDTO[] {
  type Acc = {
    customerId: string;
    customerName: string;
    bigSnooker: number;
    poolMini: number;
    cafe: number;
    received: number;
    cashCollection: number;
    gpayCollection: number;
    walletCollection: number;
  };

  const byCustomer = new Map<string, Acc>();

  function ensure(customerId: string, customerName: string): Acc {
    const existing = byCustomer.get(customerId);
    if (existing) {
      if (customerName && existing.customerName === "—") {
        existing.customerName = customerName;
      }
      return existing;
    }
    const created: Acc = {
      customerId,
      customerName: customerName || "—",
      bigSnooker: 0,
      poolMini: 0,
      cafe: 0,
      received: 0,
      cashCollection: 0,
      gpayCollection: 0,
      walletCollection: 0,
    };
    byCustomer.set(customerId, created);
    return created;
  }

  function addPayment(
    row: Acc,
    paidAmount: number,
    paymentMethod?: BusinessDayHistoryFrameLineDTO["paymentMethod"],
    walletAmount?: number
  ) {
    const paid = framePaidAmount(paidAmount);
    row.received += paid;
    const portion = attributePaymentCollections({
      paidAmount: paid,
      paymentMethod,
      walletAmount,
    });
    row.cashCollection += portion.cash;
    row.gpayCollection += portion.gpay;
    row.walletCollection += portion.wallet;
  }

  for (const line of frames) {
    if (!line.customerId) continue;
    const row = ensure(line.customerId, line.customerName);
    if (isBigSnookerSection(line.section)) {
      row.bigSnooker += line.amount;
    } else if (isPoolMiniSection(line.section)) {
      row.poolMini += line.amount;
    } else {
      row.bigSnooker += line.amount;
    }
    addPayment(row, line.paidAmount, line.paymentMethod, line.walletAmount);
  }

  for (const line of cafe) {
    if (!line.customerId) continue;
    const row = ensure(line.customerId, line.customerName);
    row.cafe += line.amount;
    addPayment(row, line.paidAmount, line.paymentMethod, line.walletAmount);
  }

  return [...byCustomer.values()]
    .map((row) => {
      const bill = row.bigSnooker + row.poolMini + row.cafe;
      const received = framePaidAmount(row.received);
      return {
        customerId: row.customerId,
        customerName: row.customerName,
        bigSnooker: row.bigSnooker,
        poolMini: row.poolMini,
        cafe: row.cafe,
        bill,
        received,
        cashCollection: row.cashCollection,
        gpayCollection: row.gpayCollection,
        walletCollection: row.walletCollection,
        due: frameDueAmount(bill, received),
      };
    })
    .sort((a, b) =>
      a.customerName.localeCompare(b.customerName, undefined, {
        sensitivity: "base",
      })
    );
}

/** History Total Outstanding Created = sum of Settlement Due rows. */
function totalOutstandingCreatedFromSettlements(
  settlements: BusinessDayHistorySettlementRowDTO[]
): number {
  return settlements.reduce((sum, row) => sum + row.due, 0);
}

/**
 * Groups already-built History charge lines into a category summary.
 * Uses the same Bill / Received / Due primitives as Settlement (no new formulas).
 */
function aggregateHistoryCategorySummary(
  lines: Array<{
    amount: number;
    paidAmount: number;
    paymentMethod?: NotebookEntryDTO["paymentMethod"];
    walletAmount?: number;
  }>
): BusinessDayHistoryCategorySummaryDTO {
  let bill = 0;
  let received = 0;
  let cashCollection = 0;
  let gpayCollection = 0;
  let walletCollection = 0;

  for (const line of lines) {
    bill += line.amount;
    const paid = framePaidAmount(line.paidAmount);
    received += paid;
    const portion = attributePaymentCollections({
      paidAmount: paid,
      paymentMethod: line.paymentMethod,
      walletAmount: line.walletAmount,
    });
    cashCollection += portion.cash;
    gpayCollection += portion.gpay;
    walletCollection += portion.wallet;
  }

  return {
    bill,
    received,
    cashCollection,
    gpayCollection,
    walletCollection,
    outstandingCreated: frameDueAmount(bill, received),
  };
}

type LeanCafeOrder = {
  _id: Types.ObjectId;
  customerId?: Types.ObjectId | null;
  customerName: string;
  amount: number;
  received?: number;
  paymentMethod?: NotebookEntryDTO["paymentMethod"];
  walletAmount?: number;
  createdAt: Date;
  items?: Array<{
    type: string;
    description?: string;
    quantity?: number;
    amount: number;
  }>;
};

/**
 * Operational History views for one Business Day.
 * Settlement and Total Outstanding Created share this charge path.
 */
async function buildHistoryOperationalViews(businessDayId: Types.ObjectId): Promise<{
  frames: BusinessDayHistoryFrameLineDTO[];
  cafe: BusinessDayHistoryCafeLineDTO[];
  settlements: BusinessDayHistorySettlementRowDTO[];
  gamesSummary: BusinessDayHistoryCategorySummaryDTO;
  cafeSummary: BusinessDayHistoryCategorySummaryDTO;
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

  // Snapshot: item-level lines for display
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
        walletAmount:
          order.amount > 0 && order.walletAmount
            ? Math.round((order.walletAmount * item.amount) / order.amount)
            : undefined,
        createdAt: order.createdAt.toISOString(),
      }))
  );

  // Settlement: order-level CafeOrder amounts (same grain as Outstanding create)
  const cafeOrdersForSettlement: BusinessDayHistoryCafeLineDTO[] =
    cafeOrders.map((order) => ({
      entryId: order._id.toString(),
      customerId: order.customerId?.toString(),
      customerName: order.customerName,
      item: "Cafe Order",
      amount: order.amount,
      paidAmount: framePaidAmount(order.received),
      paymentMethod: order.paymentMethod,
      walletAmount: order.walletAmount,
      createdAt: order.createdAt.toISOString(),
    }));

  const cafe = [...cafeFromEntries, ...cafeFromOrders];
  const cafeForMoney = [...cafeFromEntries, ...cafeOrdersForSettlement];
  const settlements = buildSettlementRows(frames, cafeForMoney);
  const gamesSummary = aggregateHistoryCategorySummary(frames);
  const cafeSummary = aggregateHistoryCategorySummary(cafeForMoney);

  return { frames, cafe, settlements, gamesSummary, cafeSummary };
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

  // Filter by Business Date (not createdAt). Legacy days without businessDate
  // fall back to openedAt within the same range.
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

  const items: BusinessDayHistoryListItemDTO[] = [];
  let insights = emptyHistoryInsights();
  const matchedDayIds: Types.ObjectId[] = [];

  for (const day of days) {
    const summary = await buildBusinessDayCloseSummaryForId(day._id);
    if (!summary || !day.closedAt) continue;

    const businessDate = resolveBusinessDate(day.businessDate, day.openedAt);

    // Extra guard for edge cases where openedAt matched but resolved date is outside.
    if (businessDate < start || businessDate > end) {
      continue;
    }

    matchedDayIds.push(day._id);

    const { frames, cafe, settlements, cafeSummary } =
      await buildHistoryOperationalViews(day._id);
    const outstandingCreated =
      totalOutstandingCreatedFromSettlements(settlements);
    const snooker = buildSnookerSectionInsights(frames);

    items.push({
      id: day._id.toString(),
      businessDayNumber: day.businessDayNumber,
      publicId: formatBusinessDayPublicId(day.businessDayNumber),
      businessDate: businessDate.toISOString(),
      openedAt: day.openedAt.toISOString(),
      closedAt: day.closedAt.toISOString(),
      todaysBill: summary.todaysBill,
      totalReceived: summary.totalPaid,
      outstandingCreated,
    });

    insights = {
      overall: {
        totalRevenue: insights.overall.totalRevenue + summary.todaysBill,
        totalReceived: insights.overall.totalReceived + summary.totalPaid,
        cashCollection:
          insights.overall.cashCollection + summary.cashCollection,
        gpayCollection:
          insights.overall.gpayCollection + summary.gpayCollection,
        walletCollection:
          insights.overall.walletCollection + summary.walletCollection,
        outstandingCreated:
          insights.overall.outstandingCreated + outstandingCreated,
      },
      bigSnooker: addSectionSummaries(insights.bigSnooker, snooker.bigSnooker),
      poolMini: addSectionSummaries(insights.poolMini, snooker.poolMini),
      totalSnooker: addSectionSummaries(
        insights.totalSnooker,
        snooker.totalSnooker
      ),
      cafe: addSectionSummaries(insights.cafe, {
        ...cafeSummary,
        gamesPlayed: countCafeOrders(cafe),
      }),
    };
  }

  const walletActivity =
    await buildWalletActivityForBusinessDays(matchedDayIds);

  const listSummary: BusinessDayHistorySummaryDTO = {
    totalBusinessDays: items.length,
    totalBill: insights.overall.totalRevenue,
    totalReceived: insights.overall.totalReceived,
    outstandingCreated: insights.overall.outstandingCreated,
    insights,
    walletActivity,
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

  const summary = await buildBusinessDayCloseSummaryForId(day._id);
  if (!summary) return null;

  const { frames, cafe, settlements, gamesSummary, cafeSummary } =
    await buildHistoryOperationalViews(day._id);
  const outstandingCreated =
    totalOutstandingCreatedFromSettlements(settlements);
  const walletActivity = await buildWalletActivityForBusinessDays([day._id]);

  return {
    day: toBusinessDayDTO(day),
    publicId: formatBusinessDayPublicId(day.businessDayNumber),
    businessDate: resolveBusinessDate(
      day.businessDate,
      day.openedAt
    ).toISOString(),
    summary: {
      todaysBill: summary.todaysBill,
      totalReceived: summary.totalPaid,
      cashCollection: summary.cashCollection,
      gpayCollection: summary.gpayCollection,
      walletCollection: summary.walletCollection,
      outstandingCreated,
    },
    gamesSummary,
    cafeSummary,
    walletActivity,
    settlements,
    frames,
    cafe,
  };
}
