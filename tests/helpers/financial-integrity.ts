import mongoose from "mongoose";
import { ensureDefaultStaff } from "../../src/lib/auth/ensure-default-staff";
import { openBusinessDay } from "../../src/lib/business-day/open-business-day";
import { closeBusinessDay } from "../../src/lib/business-day/close-business-day";
import { getCustomerOutstandingBalance } from "../../src/lib/outstanding/queries";
import { getCustomerActivityTimeline } from "../../src/lib/outstanding/activity-timeline";
import { getBusinessDayHistoryDetail } from "../../src/lib/business-day/history";
import { parseBusinessDateInput, getBusinessDate } from "../../src/lib/utils/business-date";
import Customer from "../../src/models/Customer";
import Staff from "../../src/models/Staff";
import NotebookEntry from "../../src/models/NotebookEntry";
import CafeOrder from "../../src/models/CafeOrder";
import BusinessDay from "../../src/models/BusinessDay";
import Outstanding from "../../src/models/Outstanding";
import OutstandingCollection from "../../src/models/OutstandingCollection";
import type { BusinessDayCloseExecutionResult } from "../../src/types";
import { connectTestDb } from "./db";

export type TestCustomer = {
  id: string;
  name: string;
  phone: string;
  firstName: string;
  lastName: string;
};

export type TestStaff = {
  id: string;
  username: string;
};

export type FramePayment = {
  amount: number;
  received?: number;
  paymentMethod?: "CASH" | "GPAY";
  /** Split Cash+GPay — clears paymentMethod; amounts must sum to received. */
  paymentAllocations?: Array<{
    paymentMethod: "CASH" | "GPAY";
    amount: number;
  }>;
  section?:
    | "BIG_SNOOKER_1"
    | "BIG_SNOOKER_2"
    | "BIG_SNOOKER_3"
    | "MINI_SNOOKER"
    | "POOL_1"
    | "POOL_2";
  snookerGame?: "SINGLES" | "INDIVIDUAL" | "SHUFFLE";
};

export type CafePayment = {
  amount: number;
  received?: number;
  paymentMethod?: "CASH" | "GPAY";
  itemType?: "WATER" | "CIGARETTE" | "COLD_DRINK" | "FOOD";
};

export type SplitContributorInput = {
  customerId: string;
  customerName: string;
  amount: number;
  received?: number;
  paymentMethod?: "CASH" | "GPAY";
};

let phoneSeq = 0;

function nextPhone(): string {
  phoneSeq += 1;
  const suffix = `${Date.now().toString().slice(-7)}${phoneSeq}`
    .padStart(9, "0")
    .slice(-9);
  return `7${suffix}`;
}

function nextName(label: string): { firstName: string; lastName: string; name: string } {
  const token = `${Date.now().toString(36)}${phoneSeq}`;
  const firstName = "QAFI";
  const lastName = `${label}_${token}`;
  return { firstName, lastName, name: `${firstName} ${lastName}` };
}

export async function bootstrapTestWorld(): Promise<TestStaff> {
  await connectTestDb();
  await ensureDefaultStaff();
  const staff =
    (await Staff.findOne({ username: "abhishek" }).lean()) ??
    (await Staff.findOne({ role: "SUPER_MASTER" }).lean());
  if (!staff) {
    throw new Error("bootstrapTestWorld: no SUPER_MASTER staff after ensureDefaultStaff.");
  }
  return {
    id: staff._id.toString(),
    username: staff.username,
  };
}

export async function createTestCustomer(label = "Cust"): Promise<TestCustomer> {
  await connectTestDb();
  const { firstName, lastName, name } = nextName(label);
  const phone = nextPhone();
  const doc = await Customer.create({
    firstName,
    lastName,
    name,
    phone,
    cardId: "",
    isActive: true,
    isStudent: false,
  });
  return {
    id: doc._id.toString(),
    name: doc.name,
    phone: doc.phone,
    firstName: doc.firstName,
    lastName: doc.lastName,
  };
}

/**
 * Ensure exactly one OPEN Business Day exists for the e2e DB.
 * Closes any prior OPEN day only when the e2e DB has no pending operational debt
 * that would surprise later asserts (e2e DB is disposable).
 */
export async function ensureOpenBusinessDay(
  staff: TestStaff,
  businessDate = getBusinessDate()
): Promise<{ id: string; businessDate: Date; businessDayNumber: number }> {
  await connectTestDb();
  const existing = await BusinessDay.findOne({ status: "OPEN" });
  if (existing) {
    return {
      id: existing._id.toString(),
      businessDate: existing.businessDate,
      businessDayNumber: existing.businessDayNumber,
    };
  }

  const day = await openBusinessDay({
    businessDate: parseBusinessDateInput(businessDate),
    openingCash: 0,
    openedBy: staff.username,
  });

  return {
    id: day.id,
    businessDate: parseBusinessDateInput(businessDate),
    businessDayNumber: day.businessDayNumber,
  };
}

export async function createFrameForCustomer(
  staff: TestStaff,
  customer: TestCustomer,
  payment: FramePayment
): Promise<string> {
  await connectTestDb();
  const amount = payment.amount;
  const received = payment.received ?? 0;
  if (received > amount) {
    throw new Error("createFrameForCustomer: received cannot exceed amount.");
  }

  const allocations = payment.paymentAllocations;
  if (allocations && allocations.length === 2) {
    const sum = allocations.reduce((s, row) => s + row.amount, 0);
    if (sum !== received) {
      throw new Error(
        "createFrameForCustomer: paymentAllocations must sum to received."
      );
    }
  } else if (received > 0 && !payment.paymentMethod) {
    throw new Error("createFrameForCustomer: paymentMethod required when received > 0.");
  }

  const entry = await NotebookEntry.create({
    section: payment.section ?? "BIG_SNOOKER_1",
    type: "SNOOKER",
    amount,
    snookerGame: payment.snookerGame ?? "SINGLES",
    rateType: "REGULAR",
    paidAmount: received,
    paymentMethod:
      allocations && allocations.length === 2
        ? undefined
        : received > 0
          ? payment.paymentMethod
          : undefined,
    paymentAllocations:
      allocations && allocations.length === 2 ? allocations : undefined,
    customerId: new mongoose.Types.ObjectId(customer.id),
    customerName: customer.name,
    phoneNumber: customer.phone,
    status: received >= amount ? "PAID" : "PENDING",
    createdBy: staff.username,
    createdByStaffId: new mongoose.Types.ObjectId(staff.id),
  });

  return entry._id.toString();
}

export async function createSplitFrame(
  staff: TestStaff,
  contributors: SplitContributorInput[],
  options?: { section?: FramePayment["section"]; snookerGame?: FramePayment["snookerGame"] }
): Promise<string> {
  await connectTestDb();
  if (contributors.length < 2) {
    throw new Error("createSplitFrame: need at least two contributors.");
  }

  const amount = contributors.reduce((sum, row) => sum + row.amount, 0);
  const rows = contributors.map((row) => {
    const received = row.received ?? 0;
    if (received > row.amount) {
      throw new Error(`createSplitFrame: received exceeds amount for ${row.customerName}`);
    }
    if (received > 0 && !row.paymentMethod) {
      throw new Error(
        `createSplitFrame: paymentMethod required when received > 0 (${row.customerName})`
      );
    }
    return {
      customerId: new mongoose.Types.ObjectId(row.customerId),
      customerName: row.customerName,
      amount: row.amount,
      paidAmount: received,
      paymentMethod: received > 0 ? row.paymentMethod : undefined,
      status: (received >= row.amount ? "PAID" : "PENDING") as "PAID" | "PENDING",
    };
  });

  const entry = await NotebookEntry.create({
    section: options?.section ?? "BIG_SNOOKER_1",
    type: "SNOOKER",
    amount,
    snookerGame: options?.snookerGame ?? "SINGLES",
    rateType: "REGULAR",
    paidAmount: 0,
    customerName: "",
    phoneNumber: "",
    status: "PENDING",
    contributors: rows,
    createdBy: staff.username,
    createdByStaffId: new mongoose.Types.ObjectId(staff.id),
  });

  return entry._id.toString();
}

export async function createCafeOrderForCustomer(
  staff: TestStaff,
  customer: TestCustomer,
  payment: CafePayment,
  businessDayId: string,
  businessDate: Date
): Promise<string> {
  await connectTestDb();
  const amount = payment.amount;
  const received = payment.received ?? 0;
  if (received > amount) {
    throw new Error("createCafeOrderForCustomer: received cannot exceed amount.");
  }
  if (received > 0 && !payment.paymentMethod) {
    throw new Error(
      "createCafeOrderForCustomer: paymentMethod required when received > 0."
    );
  }

  const itemType = payment.itemType ?? "WATER";
  const order = await CafeOrder.create({
    businessDayId: new mongoose.Types.ObjectId(businessDayId),
    businessDate,
    customerId: new mongoose.Types.ObjectId(customer.id),
    customerName: customer.name,
    status: "OPEN",
    items: [
      {
        type: itemType,
        quantity: 1,
        unitPrice: amount,
        amount,
        description: itemType === "FOOD" ? "QA FI meal" : undefined,
      },
    ],
    amount,
    received,
    paymentMethod: received > 0 ? payment.paymentMethod : undefined,
    createdBy: staff.username,
  });

  return order._id.toString();
}

export async function closeOpenBusinessDay(
  staff: TestStaff
): Promise<BusinessDayCloseExecutionResult> {
  await connectTestDb();
  return closeBusinessDay({
    closedBy: staff.username,
    closedByStaffId: staff.id,
    closedByUsername: staff.username,
  });
}

export async function reopenClosedBusinessDay(
  businessDayId: string,
  staff: TestStaff,
  reason = "QA FI reopen for duplicate-close coverage"
): Promise<void> {
  await connectTestDb();
  const { reopenBusinessDay } = await import(
    "../../src/lib/business-day/reopen-business-day"
  );
  await reopenBusinessDay({
    businessDayId,
    reason,
    reopenedBy: staff.username,
  });
}

export async function getOutstandingRecordsForCustomer(customerId: string) {
  await connectTestDb();
  return Outstanding.find({
    customerId: new mongoose.Types.ObjectId(customerId),
  })
    .sort({ outstandingNumber: 1 })
    .lean();
}

export async function getOutstandingRecordsForBusinessDay(businessDayId: string) {
  await connectTestDb();
  return Outstanding.find({
    businessDayId: new mongoose.Types.ObjectId(businessDayId),
  })
    .sort({ outstandingNumber: 1 })
    .lean();
}

export async function sumOutstandingOriginal(
  customerId: string,
  businessDayId?: string
): Promise<number> {
  await connectTestDb();
  const match: Record<string, unknown> = {
    customerId: new mongoose.Types.ObjectId(customerId),
  };
  if (businessDayId) {
    match.businessDayId = new mongoose.Types.ObjectId(businessDayId);
  }
  const rows = await Outstanding.find(match).select("originalAmount").lean();
  return rows.reduce((sum, row) => sum + row.originalAmount, 0);
}

export async function customerOutstandingBalance(customerId: string): Promise<number> {
  await connectTestDb();
  return getCustomerOutstandingBalance(customerId);
}

export async function createOpeningOutstandingForCustomer(input: {
  customerId: string;
  amount: number;
  createdBy: string;
  reason?: string;
  effectiveDate?: Date;
}): Promise<void> {
  await connectTestDb();
  const { createOpeningOutstanding } = await import(
    "../../src/lib/outstanding/create-opening"
  );
  await createOpeningOutstanding(input);
}

export async function collectOutstandingForTestCustomer(input: {
  customerId: string;
  receivedAmount: number;
  paymentMethod: "CASH" | "GPAY";
  staff: TestStaff;
}): Promise<number> {
  await connectTestDb();
  const { collectOutstandingForCustomer } = await import(
    "../../src/lib/outstanding/collect-for-customer"
  );
  const result = await collectOutstandingForCustomer({
    customerId: input.customerId,
    receivedAmount: input.receivedAmount,
    paymentMethod: input.paymentMethod,
    collectedBy: input.staff.username,
    staffId: input.staff.id,
  });
  return result.remainingBalance;
}

export async function customerTimeline(customerId: string) {
  await connectTestDb();
  return getCustomerActivityTimeline(customerId);
}

export async function businessDayHistory(businessDayId: string) {
  await connectTestDb();
  return getBusinessDayHistoryDetail(businessDayId);
}

/**
 * Delete customers and all financial artefacts created for them.
 * Safe for e2e DB; keyed by customer ids (never hard-coded).
 */
export async function cleanupCustomers(customerIds: string[]): Promise<void> {
  if (customerIds.length === 0) return;
  await connectTestDb();
  const objectIds = customerIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const entries = await NotebookEntry.find({
    $or: [
      { customerId: { $in: objectIds } },
      { "contributors.customerId": { $in: objectIds } },
    ],
  })
    .select("_id businessDayId")
    .lean();

  const cafeOrders = await CafeOrder.find({ customerId: { $in: objectIds } })
    .select("_id businessDayId")
    .lean();

  const entryIds = entries.map((e) => e._id);
  const orderIds = cafeOrders.map((o) => o._id);
  const dayIds = [
    ...new Set(
      [...entries, ...cafeOrders]
        .map((row) => row.businessDayId?.toString())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  await Promise.all([
    Outstanding.deleteMany({ customerId: { $in: objectIds } }),
    OutstandingCollection.deleteMany({ customerId: { $in: objectIds } }),
    NotebookEntry.deleteMany({ _id: { $in: entryIds } }),
    CafeOrder.deleteMany({ _id: { $in: orderIds } }),
    Customer.deleteMany({ _id: { $in: objectIds } }),
  ]);

  // Remove CLOSED QA business days that no longer have operational records.
  for (const dayId of dayIds) {
    const remainingOps = await Promise.all([
      NotebookEntry.countDocuments({ businessDayId: dayId }),
      CafeOrder.countDocuments({ businessDayId: dayId }),
      Outstanding.countDocuments({ businessDayId: dayId }),
    ]);
    if (remainingOps.every((n) => n === 0)) {
      const day = await BusinessDay.findById(dayId);
      if (day && day.status === "CLOSED") {
        const { default: FinalSummaryModel } = await import(
          "../../src/models/BusinessDayFinalSummary"
        );
        if (FinalSummaryModel?.deleteOne) {
          await FinalSummaryModel.deleteOne({
            businessDayId: new mongoose.Types.ObjectId(dayId),
          });
        } else {
          await mongoose.connection.collection("businessdayfinalsummaries").deleteOne({
            businessDayId: new mongoose.Types.ObjectId(dayId),
          });
        }
        await BusinessDay.deleteOne({ _id: dayId });
      }
    }
  }
}

/**
 * After a test closes a day, open a fresh Business Day for the next case.
 * Outstanding for prior closed days remains until cleanupCustomers runs.
 */
export async function openFreshBusinessDay(staff: TestStaff): Promise<{
  id: string;
  businessDate: Date;
  businessDayNumber: number;
}> {
  await connectTestDb();
  const open = await BusinessDay.findOne({ status: "OPEN" });
  if (open) {
    return {
      id: open._id.toString(),
      businessDate: open.businessDate,
      businessDayNumber: open.businessDayNumber,
    };
  }

  // Use today; multiple CLOSED days may share the same calendar date.
  return ensureOpenBusinessDay(staff, getBusinessDate());
}
