/**
 * TEST10 10-day CPOS test dataset for `corner-pockets-dev` only.
 *
 * Production `corner-pockets` is permanently blocked.
 * Does not honor ALLOW_DB_RESET.
 * Does not create FinancialCorrection records.
 * Does not open today's Business Day.
 *
 * Dry-run:  npm run seed:test-10-days -- --dry-run
 * Seed:     npm run seed:test-10-days
 * Reset:    $env:CONFIRM_TEST10_RESET="yes"; npm run seed:test-10-days:reset
 */
import "./lib/load-env";
import mongoose from "mongoose";
import {
  assertTest10DatabaseAllowed,
  getMongoDatabaseName,
  getMongoUri,
  reportTest10Target,
  TEST10_ALLOWED_DATABASE_NAME,
} from "./lib/db-safety";
import {
  TEST10_ACTOR,
  TEST10_CUSTOMER_FILTER,
  TEST10_NOTES,
  buildTest10Plan,
  customerDisplayName,
  kolkataDateTime,
  parsePlanBusinessDate,
  summarizeTest10Plan,
  type Test10CafeOrder,
  type Test10CustomerDef,
  type Test10CustomerKey,
  type Test10DayPlan,
  type Test10Frame,
  type Test10Plan,
  type Test10PlanCounts,
  type Test10Session,
} from "./lib/test10-dataset";
import { connectDB } from "../src/lib/db/connect";
import { ensureDefaultStaff } from "../src/lib/auth/ensure-default-staff";
import { openBusinessDay } from "../src/lib/business-day/open-business-day";
import {
  closeBusinessDay,
  formatBusinessDayCloseFailure,
} from "../src/lib/business-day/close-business-day";
import { collectOutstandingForCustomer } from "../src/lib/outstanding/collect-for-customer";
import { generateTableSessionNumber } from "../src/lib/table-sessions/session-number";
import {
  isPoolMiniTableId,
  poolMiniGameType,
} from "../src/lib/constants/table-sessions";
import { normalizeCafeItems } from "../src/lib/mappers/cafe-order";
import { applyCashGpayReceipt } from "../src/lib/utils/payment-receipt";
import { framePaymentStatus } from "../src/lib/utils/frame-payment";
import BusinessDay from "../src/models/BusinessDay";
import BusinessDayFinalSummary from "../src/models/BusinessDayFinalSummary";
import CafeOrder from "../src/models/CafeOrder";
import Customer from "../src/models/Customer";
import NotebookEntry from "../src/models/NotebookEntry";
import Outstanding from "../src/models/Outstanding";
import OutstandingCollection from "../src/models/OutstandingCollection";
import Staff from "../src/models/Staff";
import TableSession from "../src/models/TableSession";

type SeedStaff = { id: string; username: string };
type SeedCustomer = Test10CustomerDef & { id: string; name: string };

function isDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run") || argv.includes("-n");
}

function printCounts(counts: Test10PlanCounts) {
  console.log(`  Business Days:        ${counts.businessDays}`);
  console.log(`  Customers:            ${counts.customers}`);
  console.log(`  Frames:               ${counts.frames}`);
  console.log(`  Table Sessions:       ${counts.tableSessions}`);
  console.log(`  Cafe Orders:          ${counts.cafeOrders}`);
  console.log(`  Payments:             ${counts.payments}`);
  console.log(`  Outstanding records:  ${counts.outstandingRecords}`);
}

function printPlanPreview(plan: Test10Plan, counts: Test10PlanCounts) {
  console.log("\nDates (closed historical days, Asia/Kolkata):");
  for (const [index, date] of plan.dates.entries()) {
    console.log(`  ${index + 1}. ${date}  — ${plan.days[index].theme}`);
  }

  console.log("\nCustomers:");
  for (const customer of plan.customers) {
    console.log(
      `  ${customer.cardId}  ${customerDisplayName(customer)}  (${customer.phone})`
    );
    console.log(`      ${customer.role}`);
  }

  console.log("\nPlanned totals (no writes):");
  printCounts(counts);

  console.log("\nManual UI scenarios left for you (no FinancialCorrection created):");
  console.log("  Missed Payment → Big Snooker:  TEST10_Saurabh Seed  (₹600 remaining, mixed day)");
  console.log("  Missed Payment → Cafe:         TEST10_Saurabh Seed  (same day, also TEST10_Harsh Seed cafe due)");
  console.log("  Outstanding Correction:        TEST10_Nikhil Seed   (₹500 remaining)");
  console.log("  Collect Outstanding (partial): TEST10_Aman Seed     (₹500 remaining)");
  console.log("  Collect Outstanding (full):    TEST10_Vikram Seed   (₹160 remaining)");
}

function receiptFields(
  staff: SeedStaff,
  paymentMethod: string | undefined,
  received: number,
  receivedAt: Date
) {
  const receipt: {
    receivedByStaffId?: mongoose.Types.ObjectId;
    receivedByUsername?: string;
    receivedAt?: Date;
  } = {};
  applyCashGpayReceipt(receipt, staff, paymentMethod, received);
  if (!receipt.receivedByStaffId) return {};
  return {
    receivedByStaffId: receipt.receivedByStaffId,
    receivedByUsername: receipt.receivedByUsername,
    receivedAt,
  };
}

async function stampCreatedAt(
  model: { collection: mongoose.Collection },
  id: mongoose.Types.ObjectId,
  at: Date
) {
  await model.collection.updateOne(
    { _id: id },
    { $set: { createdAt: at, updatedAt: at } }
  );
}

async function resolveStaff(): Promise<SeedStaff> {
  await ensureDefaultStaff();
  const staff =
    (await Staff.findOne({ username: "abhishek" }).lean()) ??
    (await Staff.findOne({ role: "SUPER_MASTER" }).lean());
  if (!staff) {
    throw new Error("No staff account found. Start the app once or create the default admin first.");
  }
  return { id: staff._id.toString(), username: staff.username };
}

async function createSeedCustomers(
  plan: Test10Plan
): Promise<Map<Test10CustomerKey, SeedCustomer>> {
  const byKey = new Map<Test10CustomerKey, SeedCustomer>();

  for (const def of plan.customers) {
    const name = customerDisplayName(def);
    const existingPhone = await Customer.findOne({ phone: def.phone }).lean();
    if (existingPhone) {
      throw new Error(
        `Phone ${def.phone} already belongs to "${existingPhone.name}". TEST10 seed will not overwrite it.`
      );
    }
    const existingCard = await Customer.findOne({ cardId: def.cardId }).lean();
    if (existingCard) {
      throw new Error(
        `Card ID ${def.cardId} already belongs to "${existingCard.name}". Run the TEST10 reset first.`
      );
    }

    const doc = await Customer.create({
      cardId: def.cardId,
      firstName: def.firstName,
      lastName: def.lastName,
      name,
      phone: def.phone,
      notes: TEST10_NOTES,
      isStudent: def.isStudent,
      isActive: true,
    });

    byKey.set(def.key, {
      ...def,
      id: doc._id.toString(),
      name,
    });
  }

  return byKey;
}

async function createFrame(input: {
  staff: SeedStaff;
  customers: Map<Test10CustomerKey, SeedCustomer>;
  frame: Test10Frame;
  at: Date;
}) {
  const { staff, customers, frame, at } = input;
  const staffId = new mongoose.Types.ObjectId(staff.id);

  if (frame.contributors && frame.contributors.length > 0) {
    const contributors = frame.contributors.map((row) => {
      const customer = customers.get(row.customer);
      if (!customer) throw new Error(`Unknown contributor ${row.customer}`);
      const received = row.received;
      return {
        customerId: new mongoose.Types.ObjectId(customer.id),
        customerName: customer.name,
        amount: row.amount,
        paidAmount: received,
        status: framePaymentStatus(row.amount, received),
        paymentMethod: received > 0 ? row.paymentMethod : undefined,
        ...receiptFields(staff, row.paymentMethod, received, at),
      };
    });

    const doc = await NotebookEntry.create({
      section: frame.section,
      type: frame.type,
      amount: frame.amount,
      snookerGame: frame.snookerGame,
      rateType: frame.rateType,
      playerCount: frame.playerCount,
      paidAmount: 0,
      customerName: "",
      phoneNumber: "",
      status: "PENDING",
      contributors,
      assignedAt: at,
      assignedBy: TEST10_ACTOR,
      createdBy: TEST10_ACTOR,
      createdByStaffId: staffId,
    });
    await stampCreatedAt(NotebookEntry, doc._id, at);
    return;
  }

  if (!frame.customer) {
    throw new Error("Non-split frame requires a customer.");
  }
  const customer = customers.get(frame.customer);
  if (!customer) throw new Error(`Unknown customer ${frame.customer}`);
  const received = frame.received ?? 0;

  const doc = await NotebookEntry.create({
    section: frame.section,
    type: frame.type,
    amount: frame.amount,
    snookerGame: frame.snookerGame,
    rateType: frame.rateType,
    playerCount: frame.playerCount,
    paidAmount: received,
    paymentMethod: received > 0 ? frame.paymentMethod : undefined,
    customerId: new mongoose.Types.ObjectId(customer.id),
    customerName: customer.name,
    phoneNumber: customer.phone,
    status: framePaymentStatus(frame.amount, received),
    assignedAt: at,
    assignedBy: TEST10_ACTOR,
    createdBy: TEST10_ACTOR,
    createdByStaffId: staffId,
    ...receiptFields(staff, frame.paymentMethod, received, at),
  });
  await stampCreatedAt(NotebookEntry, doc._id, at);
}

async function createCafe(input: {
  staff: SeedStaff;
  customers: Map<Test10CustomerKey, SeedCustomer>;
  order: Test10CafeOrder;
  businessDayId: mongoose.Types.ObjectId;
  businessDate: Date;
  at: Date;
}) {
  const customer = input.customers.get(input.order.customer);
  if (!customer) throw new Error(`Unknown cafe customer ${input.order.customer}`);
  const items = normalizeCafeItems(input.order.items);
  const amount = items.reduce((sum, item) => sum + item.amount, 0);
  const received = input.order.received;

  const doc = await CafeOrder.create({
    businessDayId: input.businessDayId,
    businessDate: input.businessDate,
    customerId: new mongoose.Types.ObjectId(customer.id),
    customerName: customer.name,
    status: "OPEN",
    items,
    amount,
    received,
    paymentMethod: received > 0 ? input.order.paymentMethod : undefined,
    createdBy: TEST10_ACTOR,
    ...receiptFields(input.staff, input.order.paymentMethod, received, input.at),
  });
  await stampCreatedAt(CafeOrder, doc._id, input.at);
}

async function createSession(input: {
  staff: SeedStaff;
  customers: Map<Test10CustomerKey, SeedCustomer>;
  session: Test10Session;
  tableSessionNumber: number;
  startedAt: Date;
  endedAt: Date;
}) {
  const customer = input.customers.get(input.session.customer);
  if (!customer) throw new Error(`Unknown session customer ${input.session.customer}`);
  if (!isPoolMiniTableId(input.session.tableId)) {
    throw new Error(`TEST10 sessions are Pool/Mini only: ${input.session.tableId}`);
  }

  const staffId = new mongoose.Types.ObjectId(input.staff.id);
  const sessionNumber = await generateTableSessionNumber();
  const received = input.session.received;
  const paid = received >= input.session.amount;
  const activePlayMs = input.session.durationMinutes * 60 * 1000;

  const tableSession = await TableSession.create({
    sessionNumber,
    tableSessionNumber: input.tableSessionNumber,
    tableId: input.session.tableId,
    status: paid ? "PAID" : "ENDED",
    rateType: input.session.rateType,
    billingMethod: "TIME",
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    totalPausedMs: 0,
    activePlayMs,
    hourlyRate: input.session.amount,
    gameChargeAmount: input.session.amount,
    assignedCustomers: [
      {
        customerId: new mongoose.Types.ObjectId(customer.id),
        customerName: customer.name,
      },
    ],
    auditLog: [
      {
        action: "STARTED",
        at: input.startedAt,
        by: TEST10_ACTOR,
        byStaffId: staffId,
      },
      {
        action: "ENDED",
        at: input.endedAt,
        by: TEST10_ACTOR,
        byStaffId: staffId,
      },
    ],
    createdBy: TEST10_ACTOR,
    createdByStaffId: staffId,
  });

  const entry = await NotebookEntry.create({
    section: input.session.tableId,
    type: poolMiniGameType(input.session.tableId),
    amount: input.session.amount,
    sessionId: tableSession._id,
    rateType: input.session.rateType,
    paidAmount: received,
    paymentMethod: received > 0 ? input.session.paymentMethod : undefined,
    customerId: new mongoose.Types.ObjectId(customer.id),
    customerName: customer.name,
    phoneNumber: customer.phone,
    status: framePaymentStatus(input.session.amount, received),
    playStartedAt: input.startedAt,
    playEndedAt: input.endedAt,
    assignedAt: input.startedAt,
    assignedBy: TEST10_ACTOR,
    createdBy: TEST10_ACTOR,
    createdByStaffId: staffId,
    ...receiptFields(input.staff, input.session.paymentMethod, received, input.endedAt),
  });

  tableSession.gameEntryId = entry._id;
  await tableSession.save();
  await stampCreatedAt(TableSession, tableSession._id, input.startedAt);
  await stampCreatedAt(NotebookEntry, entry._id, input.endedAt);
}

async function seedDay(input: {
  staff: SeedStaff;
  customers: Map<Test10CustomerKey, SeedCustomer>;
  date: string;
  day: Test10DayPlan;
}) {
  const businessDate = parsePlanBusinessDate(input.date);
  const openedAt = kolkataDateTime(input.date, 10, 15);
  const closedAt = kolkataDateTime(input.date, 23, 5);

  const opened = await openBusinessDay({
    businessDate,
    openingCash: input.day.openingCash,
    openedBy: TEST10_ACTOR,
  });
  const dayId = new mongoose.Types.ObjectId(opened.id);

  await BusinessDay.updateOne(
    { _id: dayId },
    { $set: { openedAt, createdAt: openedAt, updatedAt: openedAt } }
  );

  let minute = 0;
  for (const frame of input.day.frames) {
    const at = kolkataDateTime(input.date, 11, (minute * 7) % 50);
    await createFrame({
      staff: input.staff,
      customers: input.customers,
      frame,
      at,
    });
    minute += 1;
  }

  const sessionCountByTable = new Map<string, number>();
  for (const [index, session] of input.day.sessions.entries()) {
    const startedAt = kolkataDateTime(input.date, 14, (index * 20) % 50);
    const endedAt = new Date(startedAt.getTime() + session.durationMinutes * 60 * 1000);
    const nextNumber = (sessionCountByTable.get(session.tableId) ?? 0) + 1;
    sessionCountByTable.set(session.tableId, nextNumber);
    await createSession({
      staff: input.staff,
      customers: input.customers,
      session,
      tableSessionNumber: nextNumber,
      startedAt,
      endedAt,
    });
  }

  for (const [index, order] of input.day.cafe.entries()) {
    const at = kolkataDateTime(input.date, 16, (index * 11) % 50);
    await createCafe({
      staff: input.staff,
      customers: input.customers,
      order,
      businessDayId: dayId,
      businessDate,
      at,
    });
  }

  const collectionAt = kolkataDateTime(input.date, 18, 40);
  for (const collection of input.day.collections) {
    const customer = input.customers.get(collection.customer);
    if (!customer) throw new Error(`Unknown collection customer ${collection.customer}`);
    const result = await collectOutstandingForCustomer({
      customerId: customer.id,
      receivedAmount: collection.amount,
      paymentMethod: collection.paymentMethod,
      collectedBy: TEST10_ACTOR,
      staffId: input.staff.id,
    });
    await OutstandingCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(result.collectionId) },
      {
        $set: {
          createdAt: collectionAt,
          receivedAt: collectionAt,
        },
      }
    );
  }

  const closeResult = await closeBusinessDay({
    closedBy: TEST10_ACTOR,
    closedByStaffId: input.staff.id,
    closedByUsername: TEST10_ACTOR,
  });

  if (closeResult.status !== "SUCCESS") {
    if (closeResult.status === "ALREADY_CLOSED") {
      throw new Error(`Business Day ${input.date} was already closed.`);
    }
    throw new Error(formatBusinessDayCloseFailure(closeResult));
  }

  await BusinessDay.updateOne(
    { _id: dayId },
    { $set: { closedAt, closedBy: TEST10_ACTOR, updatedAt: closedAt } }
  );
  await BusinessDayFinalSummary.updateOne(
    { businessDayId: dayId },
    { $set: { closedAt, createdAt: closedAt, updatedAt: closedAt } }
  );
  await Outstanding.updateMany(
    { businessDayId: dayId },
    { $set: { createdAt: closedAt, updatedAt: closedAt, businessDate } }
  );

  return {
    date: input.date,
    outstandingCreated: closeResult.outstandingCreated,
  };
}

async function assertSafeToSeed() {
  const openDay = await BusinessDay.findOne({ status: "OPEN" }).lean();
  if (openDay) {
    throw new Error(
      `An OPEN Business Day already exists (#${openDay.businessDayNumber}). ` +
        `Close it in the app (or reset TEST10 data) before seeding. ` +
        `This seed will not close a day it did not create.`
    );
  }

  const existing = await Customer.countDocuments(TEST10_CUSTOMER_FILTER);
  if (existing > 0) {
    throw new Error(
      `Found ${existing} existing TEST10_ customer(s). Reset them first:\n` +
        `  PowerShell: $env:CONFIRM_TEST10_RESET="yes"; npm run seed:test-10-days:reset\n` +
        `  bash:       CONFIRM_TEST10_RESET=yes npm run seed:test-10-days:reset`
    );
  }
}

async function seed() {
  const dryRun = isDryRun(process.argv.slice(2));
  const plan = buildTest10Plan();
  const counts = summarizeTest10Plan(plan);

  console.log("CPOS TEST10 10-day dataset");
  console.log("FinancialCorrection records: none (create missed payments / corrections in the UI)");
  console.log("Today's Business Day: not opened — you can open it normally after seeding.");

  if (dryRun) {
    try {
      const uri = getMongoUri();
      const dbName = getMongoDatabaseName(uri);
      console.log("");
      reportTest10Target(dbName, "TEST SEED (dry-run)");
      if (dbName !== TEST10_ALLOWED_DATABASE_NAME) {
        console.log(
          `\nThe actual seed command will refuse this database. Only "${TEST10_ALLOWED_DATABASE_NAME}" is allowed.`
        );
      }
    } catch (error) {
      console.log(
        `\n${error instanceof Error ? error.message : String(error)}`
      );
    }
    printPlanPreview(plan, counts);
    console.log("\nDry-run complete. No database writes were made.");
    console.log("To seed corner-pockets-dev:");
    console.log("  npm run seed:test-10-days");
    return;
  }

  assertTest10DatabaseAllowed("TEST10 10-day seed");
  console.log("");
  reportTest10Target(TEST10_ALLOWED_DATABASE_NAME, "TEST SEED");

  printPlanPreview(plan, counts);

  await connectDB();
  await assertSafeToSeed();
  const staff = await resolveStaff();
  const customers = await createSeedCustomers(plan);

  console.log("\nSeeding closed Business Days via open → activity → close...");
  for (const [index, date] of plan.dates.entries()) {
    const day = plan.days[index];
    const result = await seedDay({
      staff,
      customers,
      date,
      day,
    });
    console.log(
      `  Closed ${result.date}  (${day.theme})  outstanding created: ${result.outstandingCreated}`
    );
  }

  const leftoverOpen = await BusinessDay.findOne({ status: "OPEN" }).lean();
  if (leftoverOpen) {
    throw new Error(
      "Seed finished with an OPEN Business Day. Today's day should remain unopened."
    );
  }

  console.log("\nSeed complete.");
  printCounts(counts);
  console.log("\nLogin with a local staff account (example: abhishek / corner123).");
  console.log("Open today's Business Day from the app when you are ready.");
}

seed()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
