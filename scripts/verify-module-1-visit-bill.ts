/**
 * Module 1 — Visit & Bill Engine verification.
 * Run: npx tsx scripts/verify-module-1-visit-bill.ts
 */
import "./lib/load-env";
import mongoose from "mongoose";
import { assertDevDatabaseAllowed } from "./lib/db-safety";
import { connectDB } from "../src/lib/db/connect";
import { getBusinessDate, getBusinessDayBounds } from "../src/lib/utils/business-date";
import { ensureActiveVisitBill } from "../src/lib/visit-bill/ensure-visit-bill";
import { linkEntryToActiveVisitBill } from "../src/lib/visit-bill/attach-entry";
import { backfillVisitBillsForCustomer } from "../src/lib/visit-bill/backfill";
import { syncBillTotals } from "../src/lib/visit-bill/sync-bill-totals";
import { nextPublicId } from "../src/lib/visit-bill/public-id";
import Customer from "../src/models/Customer";
import NotebookEntry from "../src/models/NotebookEntry";
import Visit from "../src/models/Visit";
import Bill from "../src/models/Bill";
import Staff from "../src/models/Staff";

type Result = { id: string; pass: boolean; detail: string };

const results: Result[] = [];

function record(id: string, pass: boolean, detail: string) {
  results.push({ id, pass, detail });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${id}: ${detail}`);
}

async function sumBillFromEntries(billId: mongoose.Types.ObjectId) {
  const entries = await NotebookEntry.find({
    billId,
    status: { $ne: "CANCELLED" },
  }).lean();
  let totalAmount = 0;
  let paidAmount = 0;
  for (const entry of entries) {
    totalAmount += entry.amount;
    paidAmount += entry.paidAmount ?? 0;
  }
  return { totalAmount, paidAmount, dueAmount: Math.max(0, totalAmount - paidAmount), count: entries.length };
}

async function auditExistingData() {
  const visits = await Visit.find({}).lean();
  const bills = await Bill.find({}).lean();

  const visitPublicIds = visits.map((v) => v.publicId);
  const billPublicIds = bills.map((b) => b.publicId);
  const visitDupes = visitPublicIds.length - new Set(visitPublicIds).size;
  const billDupes = billPublicIds.length - new Set(billPublicIds).size;

  record(
    "13-public-ids",
    visitDupes === 0 && billDupes === 0,
    visitDupes === 0 && billDupes === 0
      ? `All ${visitPublicIds.length} visit and ${billPublicIds.length} bill public IDs are unique`
      : `Duplicate public IDs found (visits: ${visitDupes}, bills: ${billDupes})`
  );

  const activeByCustomerDate = new Map<string, number>();
  for (const visit of visits.filter((v) => v.status === "ACTIVE")) {
    const key = `${visit.customerId}:${visit.businessDate}`;
    activeByCustomerDate.set(key, (activeByCustomerDate.get(key) ?? 0) + 1);
  }
  const duplicateActive = [...activeByCustomerDate.values()].filter((n) => n > 1);
  record(
    "11-no-duplicate-visits",
    duplicateActive.length === 0,
    duplicateActive.length === 0
      ? "No duplicate ACTIVE visits per customer per business day"
      : `${duplicateActive.length} customer-day pair(s) have multiple ACTIVE visits`
  );

  let billMismatch = 0;
  for (const bill of bills) {
    const computed = await sumBillFromEntries(bill._id);
    if (
      bill.totalAmount !== computed.totalAmount ||
      bill.paidAmount !== computed.paidAmount ||
      bill.dueAmount !== computed.dueAmount
    ) {
      billMismatch += 1;
    }
  }
  record(
    "12-bill-totals-match",
    billMismatch === 0,
    billMismatch === 0
      ? `All ${bills.length} bill(s) match sum of linked entries`
      : `${billMismatch} bill(s) have totals that do not match linked entries`
  );
}

async function runScenarioTests(staff: { id: string; username: string }) {
  await Customer.deleteMany({ name: /^Module1 Test / });
  await Visit.deleteMany({ notes: "MODULE1_TEST_CLEANUP" });
  const testPhone = `M1${Date.now().toString().slice(-8)}`;
  const customer = await Customer.create({
    name: `Module1 Test ${testPhone}`,
    phone: testPhone,
    cardId: `M1-${testPhone}`,
    isActive: true,
    walletEnabled: false,
  });

  const staffCtx = { username: staff.username, staffId: staff.id };
  const today = getBusinessDate();

  try {
    // Scenario 1: first visit
    const first = await ensureActiveVisitBill(customer._id, staffCtx);
    record(
      "1-first-visit",
      first.visit.status === "ACTIVE" &&
        first.bill.status === "ACTIVE" &&
        first.bill.totalAmount === 0,
      `Created visit ${first.visit.publicId} + bill ${first.bill.publicId} with zero totals`
    );

    // Scenario 1 continued: idempotent second call
    const again = await ensureActiveVisitBill(customer._id, staffCtx);
    record(
      "11-backfill-idempotent-ensure",
      again.visit._id.toString() === first.visit._id.toString() &&
        again.bill._id.toString() === first.bill._id.toString(),
      "Second ensureActiveVisitBill returns same visit and bill"
    );

    // Scenario 3 & 4: multiple game + cafe entries
    const entryA = await NotebookEntry.create({
      section: "BIG_SNOOKER_1",
      type: "SNOOKER",
      amount: 160,
      customerId: customer._id,
      customerName: customer.name,
      status: "PENDING",
      createdBy: staff.username,
      createdByStaffId: staff.id,
    });
    const entryB = await NotebookEntry.create({
      section: "BIG_SNOOKER_1",
      type: "SNOOKER",
      amount: 130,
      customerId: customer._id,
      customerName: customer.name,
      status: "PENDING",
      createdBy: staff.username,
      createdByStaffId: staff.id,
    });
    const entryC = await NotebookEntry.create({
      section: "CAFE",
      type: "FOOD",
      amount: 80,
      quantity: 1,
      unitPrice: 80,
      itemNote: "Tea",
      customerId: customer._id,
      customerName: customer.name,
      status: "PENDING",
      createdBy: staff.username,
      createdByStaffId: staff.id,
    });

    await linkEntryToActiveVisitBill(entryA, staffCtx);
    await linkEntryToActiveVisitBill(entryB, staffCtx);
    await linkEntryToActiveVisitBill(entryC, staffCtx);

    const afterEntries = await syncBillTotals(first.bill._id);
    const expectedTotal = 160 + 130 + 80;
    record(
      "3-multiple-games",
      afterEntries?.totalAmount === expectedTotal &&
        entryA.billId?.toString() === first.bill._id.toString() &&
        entryB.billId?.toString() === first.bill._id.toString(),
      `Bill total ₹${afterEntries?.totalAmount} (expected ₹${expectedTotal}), entries linked`
    );
    record(
      "4-game-and-cafe",
      afterEntries?.totalAmount === expectedTotal && Boolean(entryC.billId),
      "Cafe entry linked to same bill as game entries"
    );

    // Scenario 5: partial payment
    entryA.paidAmount = 100;
    await entryA.save();
    const afterPartial = await syncBillTotals(first.bill._id);
    record(
      "5-partial-payment",
      afterPartial?.paidAmount === 100 &&
        afterPartial?.dueAmount === expectedTotal - 100 &&
        afterPartial?.status === "DUE",
      `Paid ₹${afterPartial?.paidAmount}, due ₹${afterPartial?.dueAmount}, status ${afterPartial?.status}`
    );

    // Scenario 6: multiple payments
    entryB.paidAmount = 130;
    entryC.paidAmount = 40;
    await entryB.save();
    await entryC.save();
    const afterMulti = await syncBillTotals(first.bill._id);
    record(
      "6-multiple-payments",
      afterMulti?.paidAmount === 270 && afterMulti?.dueAmount === 100,
      `Paid ₹${afterMulti?.paidAmount}, due ₹${afterMulti?.dueAmount}`
    );

    // Scenario 7: full payment -> PAID
    entryA.paidAmount = 160;
    entryC.paidAmount = 80;
    await entryA.save();
    await entryC.save();
    const afterFull = await syncBillTotals(first.bill._id);
    record(
      "7-full-payment-paid",
      afterFull?.dueAmount === 0 &&
        afterFull?.paidAmount === expectedTotal &&
        afterFull?.status === "PAID",
      `Due ₹${afterFull?.dueAmount}, status ${afterFull?.status}`
    );

    // Scenario 8: second table/session style entry same day
    const entryD = await NotebookEntry.create({
      section: "POOL_1",
      type: "POOL",
      amount: 120,
      customerId: customer._id,
      customerName: customer.name,
      sessionId: new mongoose.Types.ObjectId(),
      status: "PENDING",
      createdBy: staff.username,
      createdByStaffId: staff.id,
    });
    await linkEntryToActiveVisitBill(entryD, staffCtx);
    const afterSession = await syncBillTotals(first.bill._id);
    record(
      "8-two-sessions-same-visit",
      entryD.visitId?.toString() === first.visit._id.toString() &&
        afterSession!.totalAmount === expectedTotal + 120,
      "Session-style entry attached to same active visit/bill"
    );

    // Scenario 9: assign after charges exist
    const unassigned = await NotebookEntry.create({
      section: "BIG_SNOOKER_1",
      type: "SNOOKER",
      amount: 160,
      status: "PENDING",
      createdBy: staff.username,
      createdByStaffId: staff.id,
    });
    unassigned.customerId = customer._id;
    unassigned.customerName = customer.name;
    await linkEntryToActiveVisitBill(unassigned, staffCtx);
    record(
      "9-assign-after-charges",
      unassigned.billId?.toString() === first.bill._id.toString() &&
        unassigned.visitId?.toString() === first.visit._id.toString(),
      "Late-assigned entry linked to active visit/bill"
    );

    // Scenario 10: historical unlinked entry still readable
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 7);
    const historical = await NotebookEntry.create({
      section: "BIG_SNOOKER_1",
      type: "SNOOKER",
      amount: 160,
      customerId: customer._id,
      customerName: customer.name,
      status: "PAID",
      paidAmount: 160,
      createdAt: yesterday,
      createdBy: staff.username,
      createdByStaffId: staff.id,
    });
    record(
      "10-historical-unlinked",
      !historical.billId && historical.status === "PAID",
      "Historical entry without billId remains valid and does not break queries"
    );

    // Scenario 11: backfill does not duplicate
    const unlinkedToday = await NotebookEntry.create({
      section: "CAFE",
      type: "FOOD",
      amount: 50,
      quantity: 1,
      unitPrice: 50,
      customerId: customer._id,
      customerName: customer.name,
      status: "PENDING",
      createdBy: staff.username,
      createdByStaffId: staff.id,
    });
    const visitsBefore = await Visit.countDocuments({
      customerId: customer._id,
      businessDate: today,
      status: "ACTIVE",
    });
    const backfill = await backfillVisitBillsForCustomer(
      customer._id.toString(),
      staffCtx,
      today
    );
    const visitsAfter = await Visit.countDocuments({
      customerId: customer._id,
      businessDate: today,
      status: "ACTIVE",
    });
    const backfilled = await NotebookEntry.findById(unlinkedToday._id);
    record(
      "11-backfill-no-duplicates",
      visitsBefore === visitsAfter && visitsAfter === 1 && backfill.linkedCount >= 1,
      `Backfill linked ${backfill.linkedCount} entries; ACTIVE visits stayed at ${visitsAfter}`
    );
    record(
      "11-backfill-links-entry",
      backfilled?.billId?.toString() === first.bill._id.toString(),
      "Backfilled entry attached to existing bill"
    );

    // Scenario 2: new business day creates new visit
    const tomorrowDate = "2099-12-31";
    const nextDay = await ensureActiveVisitBill(customer._id, staffCtx, {
      businessDate: tomorrowDate,
    });
    record(
      "2-new-day-new-visit",
      nextDay.visit.businessDate === tomorrowDate &&
        nextDay.visit._id.toString() !== first.visit._id.toString() &&
        nextDay.bill._id.toString() !== first.bill._id.toString(),
      `New visit ${nextDay.visit.publicId} for business date ${tomorrowDate}`
    );

    const id1 = await nextPublicId("V", "2099-01-01");
    const id2 = await nextPublicId("V", "2099-01-01");
    record(
      "13-public-id-generation",
      id1 !== id2 && /^V-\d{8}-\d{4}$/.test(id1),
      `Sequential IDs: ${id1}, ${id2}`
    );
  } finally {
    await NotebookEntry.deleteMany({ customerId: customer._id });
    await Visit.deleteMany({ customerId: customer._id });
    await Bill.deleteMany({ customerId: customer._id });
    await Customer.deleteOne({ _id: customer._id });
  }
}

async function main() {
  assertDevDatabaseAllowed("Module 1 verification");
  await connectDB();
  const staff = await Staff.findOne({ username: "abhishek", isActive: true });
  if (!staff) {
    throw new Error("No staff account found for verification (expected abhishek)");
  }

  console.log("\n=== Module 1: Existing data audit ===\n");
  await auditExistingData();

  console.log("\n=== Module 1: Scenario tests (isolated) ===\n");
  await runScenarioTests({ id: staff._id.toString(), username: staff.username });

  const failed = results.filter((r) => !r.pass);
  console.log("\n=== Summary ===");
  console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log("\nFailed checks:");
    for (const f of failed) {
      console.log(`  - ${f.id}: ${f.detail}`);
    }
    process.exitCode = 1;
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
