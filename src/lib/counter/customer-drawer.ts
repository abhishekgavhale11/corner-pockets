import { connectDB } from "@/lib/db/connect";
import BusinessDay from "@/models/BusinessDay";
import Customer from "@/models/Customer";
import CafeOrder from "@/models/CafeOrder";
import NotebookEntry from "@/models/NotebookEntry";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import {
  toCafeOrderDTO,
  type CafeOrderDTO,
} from "@/lib/mappers/cafe-order";
import { frameDueAmount, frameReceivedAmount } from "@/lib/utils/frame-payment";
import { CAFE_SECTION } from "@/lib/constants/counter-sections";
import { CAFE_ITEM_TYPES, type CafeItemType } from "@/lib/constants/cafe";
import { NOTEBOOK_SECTIONS } from "@/lib/constants/notebook-sections";
import type { CustomerCounterDrawerDTO, NotebookEntryDTO } from "@/types";

/** Table order for drawer lists — staff think in tables, then time within each table. */
function drawerTableOrder(entry: NotebookEntryDTO): number {
  const section =
    entry.section === "CAFE" && entry.tableId ? entry.tableId : entry.section;
  const index = (NOTEBOOK_SECTIONS as readonly string[]).indexOf(section);
  return index >= 0 ? index : NOTEBOOK_SECTIONS.length;
}

function sortDrawerEntries(entries: NotebookEntryDTO[]): NotebookEntryDTO[] {
  return [...entries].sort((a, b) => {
    const tableDiff = drawerTableOrder(a) - drawerTableOrder(b);
    if (tableDiff !== 0) return tableDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function sortCafeOrders(orders: CafeOrderDTO[]): CafeOrderDTO[] {
  return [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function isCafeItemType(type: string): type is CafeItemType {
  return (CAFE_ITEM_TYPES as readonly string[]).includes(type);
}

/**
 * Legacy notebook CAFE rows → CafeOrderDTO so the drawer has one cafe list shape.
 */
function legacyNotebookCafeToOrderDTO(entry: NotebookEntryDTO): CafeOrderDTO | null {
  if (!isCafeItemType(entry.type)) return null;

  const amount = entry.amount;
  const received = frameReceivedAmount(
    entry.paidAmount,
    entry.balanceCollectedAmount
  );
  const paymentMethod =
    entry.paymentMethod === "CASH" || entry.paymentMethod === "GPAY"
      ? entry.paymentMethod
      : undefined;

  return {
    id: entry.id,
    businessDayId: "",
    businessDate: entry.createdAt,
    customerId: entry.customerId,
    customerName: entry.customerName,
    status: "OPEN",
    items: [
      {
        id: entry.id,
        type: entry.type,
        quantity: entry.quantity,
        unitPrice: entry.unitPrice,
        description: entry.itemNote,
        amount,
      },
    ],
    amount,
    received,
    paymentMethod,
    itemCount: 1,
    createdBy: entry.createdBy,
    createdAt: entry.createdAt,
    updatedAt: entry.createdAt,
  };
}

function emptyDrawerSummary(
  customerId: string,
  customerName: string
): CustomerCounterDrawerDTO {
  return {
    customerId,
    customerName,
    todaysBill: 0,
    totalReceived: 0,
    totalDue: 0,
    todaysFrames: [],
    todaysCafeOrders: [],
  };
}

/**
 * Read-only Counter drawer summary for one customer on the OPEN Business Day.
 *
 * Aggregation layer for operational modules (today: NotebookEntry frames +
 * CafeOrder; future modules should contribute here into the same totals).
 */
export async function getCustomerCounterDrawer(
  customerId: string
): Promise<CustomerCounterDrawerDTO | null> {
  await connectDB();

  const customer = await Customer.findById(customerId).lean();
  if (!customer) return null;

  const customerIdStr = customer._id.toString();
  const customerName = customer.name;

  const openDay = await BusinessDay.findOne({ status: "OPEN" })
    .select("_id")
    .lean();

  if (!openDay) {
    return emptyDrawerSummary(customerIdStr, customerName);
  }

  const [entries, cafeOrdersRaw] = await Promise.all([
    NotebookEntry.find({
      businessDayId: openDay._id,
      status: { $nin: ["CANCELLED", "REVERSED"] },
      $or: [
        { customerId: customer._id },
        { "contributors.customerId": customer._id },
      ],
    })
      .sort({ createdAt: -1 })
      .lean(),
    CafeOrder.find({
      businessDayId: openDay._id,
      customerId: customer._id,
      status: "OPEN",
    })
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  const todaysFrames: NotebookEntryDTO[] = [];
  const todaysCafeOrders: CafeOrderDTO[] = [];
  let todaysBill = 0;
  let totalReceived = 0;

  const addToTotals = (
    amount: number,
    paidAmount?: number | null,
    balanceCollectedAmount?: number | null
  ) => {
    todaysBill += amount;
    totalReceived += frameReceivedAmount(paidAmount, balanceCollectedAmount);
  };

  for (const raw of entries) {
    const dto = toNotebookEntryDTO(raw);
    const contributor = raw.contributors?.find(
      (row) => row.customerId.toString() === customerId
    );

    if (contributor) {
      addToTotals(
        contributor.amount,
        contributor.paidAmount,
        contributor.balanceCollectedAmount
      );
    } else {
      addToTotals(raw.amount, raw.paidAmount, raw.balanceCollectedAmount);
    }

    if (raw.section === CAFE_SECTION) {
      const asOrder = legacyNotebookCafeToOrderDTO(dto);
      if (asOrder) {
        todaysCafeOrders.push(asOrder);
      }
    } else {
      todaysFrames.push(dto);
    }
  }

  for (const raw of cafeOrdersRaw) {
    const order = toCafeOrderDTO(raw as never);
    addToTotals(order.amount, order.received);
    todaysCafeOrders.push(order);
  }

  return {
    customerId: customerIdStr,
    customerName,
    todaysBill,
    totalReceived,
    totalDue: frameDueAmount(todaysBill, totalReceived),
    todaysFrames: sortDrawerEntries(todaysFrames),
    todaysCafeOrders: sortCafeOrders(todaysCafeOrders),
  };
}
