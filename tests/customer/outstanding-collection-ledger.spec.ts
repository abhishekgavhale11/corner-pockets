import "../helpers/env";
import { test, expect } from "@playwright/test";
import { resetE2eDatabase, disconnectTestDb } from "../helpers/db";
import {
  bootstrapTestWorld,
  cleanupCustomers,
  closeOpenBusinessDay,
  collectOutstandingForTestCustomer,
  createOpeningOutstandingForCustomer,
  createTestCustomer,
  openFreshBusinessDay,
  type TestStaff,
} from "../helpers/financial-integrity";
import { getOutstandingCollectionLedger } from "../../src/lib/outstanding/collection-ledger";
import { getBusinessDate } from "../../src/lib/utils/business-date";

test.describe.configure({ mode: "serial" });

test.describe("Outstanding Collection Ledger", () => {
  let staff: TestStaff;
  let tracked: string[] = [];

  test.beforeAll(async () => {
    await resetE2eDatabase();
    staff = await bootstrapTestWorld();
  });

  test.afterEach(async () => {
    await cleanupCustomers(tracked);
    tracked = [];
  });

  test.afterAll(async () => {
    await cleanupCustomers(tracked);
    await disconnectTestDb();
  });

  test("ledger lists collections with summary matching filter", async () => {
    const a = await createTestCustomer("LedA");
    const b = await createTestCustomer("LedB");
    tracked.push(a.id, b.id);

    await createOpeningOutstandingForCustomer({
      customerId: a.id,
      amount: 500,
      createdBy: staff.username,
    });
    await createOpeningOutstandingForCustomer({
      customerId: b.id,
      amount: 400,
      createdBy: staff.username,
    });

    // Need a closed day for club state; collections do not require an open day.
    await openFreshBusinessDay(staff);
    await closeOpenBusinessDay(staff);

    await collectOutstandingForTestCustomer({
      customerId: a.id,
      receivedAmount: 200,
      paymentMethod: "CASH",
      staff,
    });
    await collectOutstandingForTestCustomer({
      customerId: a.id,
      receivedAmount: 100,
      paymentMethod: "GPAY",
      staff,
    });
    await collectOutstandingForTestCustomer({
      customerId: b.id,
      receivedAmount: 150,
      paymentMethod: "CASH",
      staff,
    });

    const today = getBusinessDate();
    const ledger = await getOutstandingCollectionLedger({
      from: today,
      to: today,
    });

    expect(ledger.items.length).toBe(3);
    expect(ledger.summary.totalOutstandingRecovered).toBe(450);
    expect(ledger.summary.collectionCount).toBe(3);
    expect(ledger.summary.customersPaidCount).toBe(2);
    // Live club total after collections: A 200 + B 250 = 450
    expect(ledger.summary.totalClubOutstanding).toBe(450);

    const sumAmounts = ledger.items.reduce(
      (sum, row) => sum + row.amountCollected,
      0
    );
    expect(sumAmounts).toBe(ledger.summary.totalOutstandingRecovered);

    // Newest first
    for (let i = 1; i < ledger.items.length; i++) {
      expect(
        new Date(ledger.items[i - 1].collectedAt).getTime()
      ).toBeGreaterThanOrEqual(
        new Date(ledger.items[i].collectedAt).getTime()
      );
    }

    const firstA = ledger.items.find(
      (row) => row.customerId === a.id && row.amountCollected === 100
    );
    expect(firstA).toBeTruthy();
    expect(firstA!.previousOutstanding).toBe(
      firstA!.amountCollected + firstA!.remainingOutstanding
    );
  });
});
