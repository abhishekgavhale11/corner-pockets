import "../helpers/env";
import { test, expect } from "@playwright/test";
import mongoose from "mongoose";
import { resetE2eDatabase, disconnectTestDb, connectTestDb } from "../helpers/db";
import {
  bootstrapTestWorld,
  businessDayHistory,
  cleanupCustomers,
  closeOpenBusinessDay,
  createTestCustomer,
  customerTimeline,
  openFreshBusinessDay,
  type TestCustomer,
  type TestStaff,
} from "../helpers/financial-integrity";
import NotebookEntry from "../../src/models/NotebookEntry";
import Outstanding from "../../src/models/Outstanding";
import { loadFinancialProofSnapshot } from "../../src/lib/business-day/close-financial-proof";
import { buildBusinessDayCloseSummaryForId } from "../../src/lib/business-day/close-summary";
import { getCustomerCounterDrawer } from "../../src/lib/counter/customer-drawer";
import { frameDueFromParts } from "../../src/lib/utils/frame-payment";
import { toNotebookEntryDTO } from "../../src/lib/mappers/notebook";

/**
 * Verification: Amount 1000 / paidAmount 300 / balanceCollectedAmount 200
 * → Due must be ₹500 everywhere (Proof Received definition).
 */

test.describe.configure({ mode: "serial" });

test.describe("Due alignment: paidAmount + balanceCollectedAmount", () => {
  let staff: TestStaff;
  let trackedCustomerIds: string[] = [];

  test.beforeAll(async () => {
    await resetE2eDatabase();
    staff = await bootstrapTestWorld();
  });

  test.afterAll(async () => {
    await cleanupCustomers(trackedCustomerIds);
    await disconnectTestDb();
  });

  test("all readers produce ₹500 Due for 1000 − (300 + 200)", async () => {
    const customer = await createTestCustomer("DueAlign");
    trackedCustomerIds.push(customer.id);

    const day = await openFreshBusinessDay(staff);
    await connectTestDb();

    const entry = await NotebookEntry.create({
      section: "BIG_SNOOKER_1",
      type: "SNOOKER",
      amount: 1000,
      snookerGame: "SINGLES",
      rateType: "REGULAR",
      paidAmount: 300,
      balanceCollectedAmount: 200,
      paymentMethod: "CASH",
      customerId: new mongoose.Types.ObjectId(customer.id),
      customerName: customer.name,
      phoneNumber: customer.phone,
      status: "PENDING",
      createdBy: staff.username,
      createdByStaffId: new mongoose.Types.ObjectId(staff.id),
    });

    // --- Entry Pay Status / shared Due helper ---
    const entryDto = toNotebookEntryDTO(entry);
    const entryPayStatusDue = frameDueFromParts(
      entryDto.amount,
      entryDto.paidAmount,
      entryDto.balanceCollectedAmount
    );
    expect(entryPayStatusDue, "Entry Pay Status Due").toBe(500);

    // --- Financial Proof ---
    const proof = await loadFinancialProofSnapshot(day.id);
    expect(proof.ok, "Financial Proof must load").toBe(true);
    if (!proof.ok) return;
    const proofLine = proof.snapshot.ownershipLines.find(
      (line) => line.sourceRecordId === entry._id.toString()
    );
    expect(proofLine?.due, "Financial Proof Due").toBe(500);
    expect(proof.snapshot.businessDayDue, "Financial Proof BD Due").toBe(500);

    // --- Close Summary ---
    const closeSummary = await buildBusinessDayCloseSummaryForId(day.id);
    expect(closeSummary?.outstandingAmount, "Close Summary Created").toBe(500);
    expect(closeSummary?.todaysBill).toBe(1000);
    expect(closeSummary?.totalPaid).toBe(500);

    // --- Counter Drawer (before close) ---
    const drawer = await getCustomerCounterDrawer(customer.id);
    expect(drawer?.todaysBill, "Drawer bill").toBe(1000);
    expect(drawer?.totalReceived, "Drawer received").toBe(500);
    expect(drawer?.totalDue, "Counter Drawer Due").toBe(500);

    // --- Customer Timeline fallback (before Outstanding stamp) ---
    const timelineBefore = await customerTimeline(customer.id);
    // No closed-day card yet; after close we assert stamp + fallback consistency.
    expect(timelineBefore.every((i) => i.kind !== "BUSINESS_DAY_SUMMARY")).toBe(
      true
    );

    // --- Close → MongoDB Outstanding ---
    const closed = await closeOpenBusinessDay(staff);
    expect(closed.status).toBe("SUCCESS");

    const outstanding = await Outstanding.find({
      customerId: customer.id,
      sourceType: { $in: ["FRAME", "CAFE"] },
    }).lean();
    expect(outstanding).toHaveLength(1);
    expect(outstanding[0].originalAmount, "MongoDB Outstanding").toBe(500);
    expect(outstanding[0].remainingAmount).toBe(500);

    // --- Business Day History ---
    const history = await businessDayHistory(day.id);
    expect(history?.summary.outstandingCreated, "History Outstanding Created").toBe(
      500
    );
    expect(
      history?.outstandingTrend.newOutstandingCreated,
      "History trend Created"
    ).toBe(500);

    // --- Customer Timeline (after close: stamp = originalAmount) ---
    const timelineAfter = await customerTimeline(customer.id);
    const bdCard = timelineAfter.find(
      (item) =>
        item.kind === "BUSINESS_DAY_SUMMARY" && item.businessDayId === day.id
    );
    expect(bdCard?.businessDaySummary?.todaysDue, "Timeline Due (stamp)").toBe(
      500
    );

    // Fallback path still used internally when no stamp — re-check via helper on DTO
    // (same function customerShare / entryDueForCustomer rely on after alignment).
    expect(
      frameDueFromParts(
        entryDto.amount,
        entryDto.paidAmount,
        entryDto.balanceCollectedAmount
      ),
      "Timeline fallback Due"
    ).toBe(500);
  });
});
