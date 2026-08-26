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
  applyFinancialCorrections,
  listCorrectedBusinessDayFinalSummaries,
  requireBusinessDayFinalSummary,
  type BusinessDayFinalSummaryPayload,
} from "@/lib/financial-summary";
import { listFinancialCorrectionsByAffectedDayIds } from "@/lib/financial-corrections/queries";
import { getOutstandingCollectionLedger } from "@/lib/outstanding/collection-ledger";
import Customer from "@/models/Customer";
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
  addCafeItemSaleToBreakdown,
  addSectionSummaries,
  emptyCafeSalesBreakdown,
  emptyHistoryInsights,
} from "@/lib/business-day/history-insights";
import {
  buildBusinessDayOutstandingTrend,
  getOutstandingRecoveredForReportRange,
} from "@/lib/business-day/history-outstanding";
import { buildDailyClubOutstandingBalance } from "@/lib/outstanding/daily-balance";
import { loadLiveCustomerNamesById } from "@/lib/counter/live-customer-names";
import type {
  BusinessDayHistoryCafeLineDTO,
  BusinessDayHistoryDetailDTO,
  BusinessDayHistoryFrameLineDTO,
  BusinessDayHistoryListItemDTO,
  BusinessDayHistoryListResultDTO,
  NotebookPaymentAllocationDTO,
  BusinessDayHistorySettlementRowDTO,
  BusinessDayHistorySummaryDTO,
  CafeSalesBreakdownDTO,
  FinancialCorrectionHistoryRowDTO,
  NotebookEntryDTO,
  OutstandingHistoryTabDTO,
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

/** Display-only: same Cafe counter format (`Cigarette ×2`). */
function cafeSnapshotQtyLabel(base: string, quantity: number): string {
  return quantity > 1 ? `${base} ×${quantity}` : base;
}

type CafeSnapshotDraft = BusinessDayHistoryCafeLineDTO & {
  groupKey: string;
  itemLabel: string;
  quantity: number;
  showQuantity: boolean;
};

function mergeCafeSnapshotAllocations(
  lines: CafeSnapshotDraft[]
): NotebookPaymentAllocationDTO[] | undefined {
  const totals = new Map<"CASH" | "GPAY", number>();
  let hadAny = false;

  for (const line of lines) {
    const rows =
      line.paymentAllocations && line.paymentAllocations.length > 0
        ? line.paymentAllocations
        : line.paymentMethod && line.paidAmount > 0
          ? [
              {
                paymentMethod: line.paymentMethod,
                amount: line.paidAmount,
              },
            ]
          : [];

    for (const row of rows) {
      if (row.paymentMethod !== "CASH" && row.paymentMethod !== "GPAY") {
        continue;
      }
      if (row.amount <= 0) continue;
      hadAny = true;
      totals.set(
        row.paymentMethod,
        (totals.get(row.paymentMethod) ?? 0) + row.amount
      );
    }
  }

  if (!hadAny) return undefined;
  return [...totals.entries()].map(([paymentMethod, amount]) => ({
    paymentMethod,
    amount,
  }));
}

/**
 * Display-only grouping for History Cafe Snapshot.
 * Collapses repeated qty items (Cigarette, Water) into `Item ×N` like Cafe.
 * Does not change Final Summary money.
 */
function collapseHistoryCafeSnapshot(
  drafts: CafeSnapshotDraft[]
): BusinessDayHistoryCafeLineDTO[] {
  const groups = new Map<string, CafeSnapshotDraft[]>();

  for (const draft of drafts) {
    const key = `${draft.customerId ?? `name:${draft.customerName}`}|${draft.groupKey}`;
    const list = groups.get(key);
    if (list) {
      list.push(draft);
    } else {
      groups.set(key, [draft]);
    }
  }

  const collapsed: BusinessDayHistoryCafeLineDTO[] = [];

  for (const list of groups.values()) {
    const first = list[0]!;
    const quantity = list.reduce((sum, row) => sum + row.quantity, 0);
    const amount = list.reduce((sum, row) => sum + row.amount, 0);
    const paidAmount = list.reduce((sum, row) => sum + row.paidAmount, 0);
    const allocations = mergeCafeSnapshotAllocations(list);
    const methods = new Set(
      list
        .map((row) => row.paymentMethod)
        .filter((method): method is NonNullable<typeof method> => Boolean(method))
    );
    const latestReceipt = list.reduce((latest, row) => {
      if (!row.receivedAt) return latest;
      if (!latest.receivedAt || row.receivedAt > latest.receivedAt) return row;
      return latest;
    }, first);

    collapsed.push({
      entryId: first.entryId,
      customerId: first.customerId,
      customerName: first.customerName,
      item: first.showQuantity
        ? cafeSnapshotQtyLabel(first.itemLabel, quantity)
        : first.itemLabel,
      amount,
      paidAmount,
      paymentMethod: methods.size === 1 ? [...methods][0] : undefined,
      paymentAllocations: allocations,
      receivedByUsername: latestReceipt.receivedByUsername,
      receivedAt: latestReceipt.receivedAt,
      createdAt: first.createdAt,
    });
  }

  return collapsed.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function cafeDraftFromNotebookEntry(
  entry: NotebookEntryDTO,
  line: ChargeLine
): CafeSnapshotDraft {
  const isFood = entry.type === "FOOD" || entry.type === "COLD_DRINK";

  if (isFood) {
    const note = entry.itemNote?.trim() ?? "";
    return {
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
      groupKey: `food:${note.toLowerCase().replace(/\s+/g, " ")}`,
      itemLabel: formatCafeItemLabel(entry),
      quantity: 1,
      showQuantity: false,
    };
  }

  const quantity = entry.quantity && entry.quantity > 0 ? entry.quantity : 1;
  const unitPrice =
    entry.unitPrice ??
    (quantity > 0 ? Math.round(line.amount / quantity) : line.amount);

  return {
    entryId: line.entryId,
    customerId: line.customerId,
    customerName: line.customerName,
    item: getEntryDisplayLabel(entry),
    amount: line.amount,
    paidAmount: line.paidAmount,
    paymentMethod: line.paymentMethod,
    paymentAllocations: line.paymentAllocations,
    receivedByUsername: line.receivedByUsername,
    receivedAt: line.receivedAt,
    createdAt: line.createdAt,
    groupKey: `qty:${entry.type}:${unitPrice}`,
    itemLabel: getEntryDisplayLabel(entry),
    quantity,
    showQuantity: true,
  };
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
    unitPrice?: number;
    amount: number;
  }>;
};

function cafeItemTypeLabel(type: string): string {
  return (
    CAFE_ITEM_TYPE_LABELS[type as keyof typeof CAFE_ITEM_TYPE_LABELS] || type
  );
}

function cafeDraftFromOrderItem(
  order: LeanCafeOrder,
  item: NonNullable<LeanCafeOrder["items"]>[number],
  index: number
): CafeSnapshotDraft {
  const paidAmount =
    order.amount > 0
      ? Math.round(((order.received ?? 0) * item.amount) / order.amount)
      : 0;
  const base = {
    entryId: `${order._id.toString()}-${index}`,
    customerId: order.customerId?.toString(),
    customerName: order.customerName,
    amount: item.amount,
    paidAmount,
    paymentMethod: order.paymentMethod,
    receivedByUsername: order.receivedByUsername,
    receivedAt: order.receivedAt?.toISOString(),
    createdAt: order.createdAt.toISOString(),
  };

  if (item.type === "FOOD" || item.type === "COLD_DRINK") {
    const description =
      item.description?.trim() || cafeItemTypeLabel(item.type);
    return {
      ...base,
      item: description,
      groupKey: `food:${description.toLowerCase().replace(/\s+/g, " ")}`,
      itemLabel: description,
      quantity: 1,
      showQuantity: false,
    };
  }

  const quantity =
    item.quantity && item.quantity > 0 ? item.quantity : 1;
  const unitPrice =
    item.unitPrice ??
    (quantity > 0 ? Math.round(item.amount / quantity) : item.amount);
  const label = cafeItemTypeLabel(item.type);

  return {
    ...base,
    item: label,
    groupKey: `qty:${item.type}:${unitPrice}`,
    itemLabel: label,
    quantity,
    showQuantity: true,
  };
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

function buildCafeLines(entries: NotebookEntryDTO[]): CafeSnapshotDraft[] {
  return sortEntries(entries).flatMap((entry) =>
    collectChargeLines(entry).map((line) =>
      cafeDraftFromNotebookEntry(entry, line)
    )
  );
}

async function loadCafeSalesBreakdown(
  businessDayIds: Types.ObjectId[]
): Promise<CafeSalesBreakdownDTO> {
  const breakdown = emptyCafeSalesBreakdown();
  if (businessDayIds.length === 0) {
    return breakdown;
  }

  const orders = (await CafeOrder.find({
    businessDayId: { $in: businessDayIds },
    status: "OPEN",
  })
    .select("items.type items.amount")
    .lean()) as Array<{
    items?: Array<{ type?: string; amount?: number }>;
  }>;

  for (const order of orders) {
    for (const item of order.items ?? []) {
      addCafeItemSaleToBreakdown(
        breakdown,
        item.type ?? "",
        item.amount ?? 0
      );
    }
  }

  return breakdown;
}

function overlayHistoryCustomerName(
  names: Map<string, string>,
  customerId: string | undefined,
  fallback: string
): string {
  if (!customerId) return fallback;
  return names.get(customerId) ?? fallback;
}

/** Display-only: current Customer.name for History rows. Does not write records. */
async function withLiveCustomerNamesOnHistoryDetail(input: {
  settlements: BusinessDayHistorySettlementRowDTO[];
  frames: BusinessDayHistoryFrameLineDTO[];
  cafe: BusinessDayHistoryCafeLineDTO[];
}): Promise<{
  settlements: BusinessDayHistorySettlementRowDTO[];
  frames: BusinessDayHistoryFrameLineDTO[];
  cafe: BusinessDayHistoryCafeLineDTO[];
}> {
  const names = await loadLiveCustomerNamesById([
    ...input.settlements.map((row) => row.customerId),
    ...input.frames.map((row) => row.customerId),
    ...input.cafe.map((row) => row.customerId),
  ]);

  return {
    settlements: input.settlements.map((row) => ({
      ...row,
      customerName: overlayHistoryCustomerName(
        names,
        row.customerId,
        row.customerName
      ),
    })),
    frames: input.frames.map((row) => ({
      ...row,
      customerName: overlayHistoryCustomerName(
        names,
        row.customerId,
        row.customerName
      ),
    })),
    cafe: input.cafe.map((row) => ({
      ...row,
      customerName: overlayHistoryCustomerName(
        names,
        row.customerId,
        row.customerName
      ),
    })),
  };
}

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

async function loadCorrectionHistoryRowsForDays(
  businessDayIds: Types.ObjectId[]
): Promise<FinancialCorrectionHistoryRowDTO[]> {
  if (businessDayIds.length === 0) return [];

  const byDay = await listFinancialCorrectionsByAffectedDayIds(businessDayIds);
  const records = [...byDay.values()].flat();
  if (records.length === 0) return [];

  const customerIds = [...new Set(records.map((row) => row.customerId))];
  const dayIdsForPublicId = [
    ...new Set([
      ...records.map((row) => row.affectedBusinessDayId),
      ...records
        .map((row) => row.recordedOnBusinessDayId)
        .filter((id): id is string => Boolean(id)),
    ]),
  ];

  const [customers, days] = await Promise.all([
    Customer.find({
      _id: { $in: customerIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select("name")
      .lean(),
    BusinessDay.find({
      _id: {
        $in: dayIdsForPublicId.map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
      .select("_id businessDayNumber businessDate openedAt")
      .lean(),
  ]);

  const nameById = new Map(
    customers.map((customer) => [customer._id.toString(), customer.name as string])
  );
  const publicIdByDay = new Map(
    days.map((day) => [
      day._id.toString(),
      formatBusinessDayPublicId(day.businessDayNumber),
    ])
  );
  const businessDateByDay = new Map(
    days.map((day) => [
      day._id.toString(),
      resolveBusinessDate(day.businessDate, day.openedAt).toISOString(),
    ])
  );

  return records
    .map((record) => ({
      id: record.id,
      type: record.type,
      customerId: record.customerId,
      customerName: nameById.get(record.customerId) ?? "—",
      amount: record.amount,
      paymentMethod: record.paymentMethod,
      section: record.section,
      reason: record.reason,
      createdBy: record.createdBy,
      createdAt: record.createdAt.toISOString(),
      affectedBusinessDayId: record.affectedBusinessDayId,
      affectedPublicId: publicIdByDay.get(record.affectedBusinessDayId) ?? "—",
      affectedBusinessDate:
        businessDateByDay.get(record.affectedBusinessDayId) ??
        record.createdAt.toISOString(),
      recordedOnBusinessDayId: record.recordedOnBusinessDayId,
      recordedOnPublicId: record.recordedOnBusinessDayId
        ? (publicIdByDay.get(record.recordedOnBusinessDayId) ?? null)
        : null,
    }))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

async function loadCorrectionHistoryRows(
  businessDayId: Types.ObjectId
): Promise<FinancialCorrectionHistoryRowDTO[]> {
  return loadCorrectionHistoryRowsForDays([businessDayId]);
}

/**
 * History → Outstanding tab payload.
 *
 * Created  = corrected Final Summary overlay for the selected range
 * Paid     = OutstandingCollection ledger for the selected range
 * Current  = live club receivable (Σ PENDING remainingAmount)
 * Series   = calendar-day running balance from corrected BD outstandingCreated
 *            − OutstandingCollection − FinancialCorrection (recorded date)
 *            Last point = live Current Club Outstanding.
 *
 * New outstanding is dated by Business Day businessDate, not Outstanding.createdAt.
 */
export async function getOutstandingHistoryTab(
  options?: {
    from?: string;
    to?: string;
  }
): Promise<OutstandingHistoryTabDTO> {
  const list = await getClosedBusinessDayHistoryList(options);
  const ledger = await getOutstandingCollectionLedger({
    from: list.from,
    to: list.to,
  });
  const { openingOutstanding, series } = await buildDailyClubOutstandingBalance({
    from: list.from,
    liveCurrent: ledger.summary.totalClubOutstanding,
  });

  return {
    from: list.from,
    to: list.to,
    movement: {
      openingOutstanding,
      outstandingCreated: list.summary.outstandingCreated,
      outstandingPaid: ledger.summary.totalOutstandingRecovered,
      currentClubOutstanding: ledger.summary.totalClubOutstanding,
    },
    series,
    ledger,
    corrections: list.corrections,
  };
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
  const cafe = collapseHistoryCafeSnapshot([
    ...buildCafeLines(cafeEntries),
    ...cafeOrders.flatMap((order) =>
      (order.items ?? []).map((item, index) =>
        cafeDraftFromOrderItem(order, item, index)
      )
    ),
  ]);

  return { frames, cafe };
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

  const finalById = await listCorrectedBusinessDayFinalSummaries(
    matchedDays.map((day) => day._id)
  );
  const reportRangeRecovered = await getOutstandingRecoveredForReportRange(
    from,
    to
  );

  const items: BusinessDayHistoryListItemDTO[] = [];
  let insights = emptyHistoryInsights();
  const includedDayIds: Types.ObjectId[] = [];

  for (const day of matchedDays) {
    const dayId = day._id.toString();
    const finalSummary = finalById.get(dayId);
    if (!finalSummary) continue;

    includedDayIds.push(day._id);

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
      cafeSalesBreakdown: insights.cafeSalesBreakdown,
    };
  }

  insights = {
    ...insights,
    cafeSalesBreakdown: await loadCafeSalesBreakdown(includedDayIds),
  };

  const listSummary: BusinessDayHistorySummaryDTO = {
    totalBusinessDays: items.length,
    totalBill: insights.overall.totalRevenue,
    totalReceived: insights.overall.totalReceived,
    outstandingCreated: insights.overall.outstandingCreated,
    outstandingRecovered: reportRangeRecovered,
    insights,
  };

  const corrections = await loadCorrectionHistoryRowsForDays(includedDayIds);

  return { from, to, items, summary: listSummary, corrections };
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

  const originalSummary = await requireBusinessDayFinalSummary(day._id);
  const corrections = await loadCorrectionHistoryRows(day._id);
  const finalSummary = applyFinancialCorrections(
    originalSummary,
    corrections.map((row) => ({
      type: row.type,
      customerId: row.customerId,
      amount: row.amount,
      paymentMethod: row.paymentMethod,
      section: row.section,
    }))
  );
  const { frames, cafe, settlements } = await withLiveCustomerNamesOnHistoryDetail({
    settlements: settlementsFromFinalSummary(finalSummary),
    ...(await buildHistoryDrilldownLines(day._id)),
  });

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
      cafeSalesBreakdown: await loadCafeSalesBreakdown([day._id]),
    },
    outstandingTrend,
    settlements,
    frames,
    cafe,
    originalSummary:
      corrections.length > 0
        ? {
            todaysBill: originalSummary.bill,
            totalReceived: originalSummary.paid,
            cashCollection: originalSummary.cashCollection,
            gpayCollection: originalSummary.gpayCollection,
            outstandingCreated: originalSummary.outstandingCreated,
            closingOutstanding: originalSummary.closingOutstanding,
          }
        : undefined,
    corrections,
  };
}
