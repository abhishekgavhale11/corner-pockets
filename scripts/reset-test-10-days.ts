/**
 * TEST10 reset for the 10-day dataset on `corner-pockets-dev` only.
 *
 * Removes ONLY records owned by this seed (TEST10_ marker / TEST10_SEED actor).
 * Never dropDatabase. Never deleteMany without that filter.
 * Production `corner-pockets` is permanently blocked.
 *
 * PowerShell:
 *   $env:CONFIRM_TEST10_RESET="yes"; npm run seed:test-10-days:reset
 *
 * bash:
 *   CONFIRM_TEST10_RESET=yes npm run seed:test-10-days:reset
 */
import "./lib/load-env";
import mongoose from "mongoose";
import {
  assertTest10DatabaseAllowed,
  assertTest10ResetConfirmed,
  reportTest10Target,
  TEST10_ALLOWED_DATABASE_NAME,
} from "./lib/db-safety";
import {
  TEST10_ACTOR,
  TEST10_BUSINESS_DAY_FILTER,
  TEST10_CUSTOMER_FILTER,
  TEST10_MARKER,
} from "./lib/test10-dataset";
import { connectDB } from "../src/lib/db/connect";
import BusinessDay from "../src/models/BusinessDay";
import BusinessDayFinalSummary from "../src/models/BusinessDayFinalSummary";
import CafeOrder from "../src/models/CafeOrder";
import Customer from "../src/models/Customer";
import CustomerBalancePayment from "../src/models/CustomerBalancePayment";
import FinancialCorrection from "../src/models/FinancialCorrection";
import NotebookEntry from "../src/models/NotebookEntry";
import Outstanding from "../src/models/Outstanding";
import OutstandingCollection from "../src/models/OutstandingCollection";
import TableSession from "../src/models/TableSession";
import Transaction from "../src/models/Transaction";

type CountRow = { label: string; count: number };

async function reset() {
  assertTest10DatabaseAllowed("TEST10 test-data reset");
  assertTest10ResetConfirmed();

  console.log("Resetting TEST10 seed data only...");
  reportTest10Target(TEST10_ALLOWED_DATABASE_NAME, "TEST RESET");
  console.log(`Marker: ${TEST10_MARKER} / actor ${TEST10_ACTOR}`);

  await connectDB();

  const seedCustomers = await Customer.find(TEST10_CUSTOMER_FILTER)
    .select("_id name cardId")
    .lean();
  const seedDays = await BusinessDay.find(TEST10_BUSINESS_DAY_FILTER)
    .select("_id businessDayNumber businessDate")
    .lean();

  const customerIds = seedCustomers.map((row) => row._id);
  const dayIds = seedDays.map((row) => row._id);

  if (customerIds.length === 0 && dayIds.length === 0) {
    console.log("\nNo TEST10 seed records found. Nothing to remove.");
    return;
  }

  const extraEntries = await NotebookEntry.find({
    createdBy: TEST10_ACTOR,
    ...(dayIds.length > 0 ? { businessDayId: { $nin: dayIds } } : {}),
  })
    .select("_id")
    .lean();
  const extraSessions = await TableSession.find({
    createdBy: TEST10_ACTOR,
    ...(dayIds.length > 0 ? { businessDayId: { $nin: dayIds } } : {}),
  })
    .select("_id")
    .lean();
  const extraCafe = await CafeOrder.find({
    createdBy: TEST10_ACTOR,
    ...(dayIds.length > 0 ? { businessDayId: { $nin: dayIds } } : {}),
  })
    .select("_id")
    .lean();

  const entryFilter = {
    $or: [
      ...(dayIds.length > 0 ? [{ businessDayId: { $in: dayIds } }] : []),
      ...(customerIds.length > 0
        ? [
            { customerId: { $in: customerIds } },
            { "contributors.customerId": { $in: customerIds } },
          ]
        : []),
      { createdBy: TEST10_ACTOR },
      ...(extraEntries.length > 0
        ? [{ _id: { $in: extraEntries.map((row) => row._id) } }]
        : []),
    ],
  };

  const cafeFilter = {
    $or: [
      ...(dayIds.length > 0 ? [{ businessDayId: { $in: dayIds } }] : []),
      ...(customerIds.length > 0 ? [{ customerId: { $in: customerIds } }] : []),
      { createdBy: TEST10_ACTOR },
      ...(extraCafe.length > 0
        ? [{ _id: { $in: extraCafe.map((row) => row._id) } }]
        : []),
    ],
  };

  const sessionFilter = {
    $or: [
      ...(dayIds.length > 0 ? [{ businessDayId: { $in: dayIds } }] : []),
      { createdBy: TEST10_ACTOR },
      ...(customerIds.length > 0
        ? [{ "assignedCustomers.customerId": { $in: customerIds } }]
        : []),
      ...(extraSessions.length > 0
        ? [{ _id: { $in: extraSessions.map((row) => row._id) } }]
        : []),
    ],
  };

  const removed: CountRow[] = [];

  async function remove(
    label: string,
    count: number,
    del: () => Promise<unknown>
  ) {
    if (count > 0) {
      await del();
    }
    removed.push({ label, count });
  }

  if (customerIds.length > 0) {
    await remove(
      "financialcorrections",
      await FinancialCorrection.countDocuments({
        customerId: { $in: customerIds },
      }),
      () => FinancialCorrection.deleteMany({ customerId: { $in: customerIds } })
    );
    await remove(
      "outstandingcollections",
      await OutstandingCollection.countDocuments({
        $or: [
          { customerId: { $in: customerIds } },
          { createdBy: TEST10_ACTOR },
        ],
      }),
      () =>
        OutstandingCollection.deleteMany({
          $or: [
            { customerId: { $in: customerIds } },
            { createdBy: TEST10_ACTOR },
          ],
        })
    );
    await remove(
      "outstandings",
      await Outstanding.countDocuments({
        $or: [
          { customerId: { $in: customerIds } },
          ...(dayIds.length > 0 ? [{ businessDayId: { $in: dayIds } }] : []),
        ],
      }),
      () =>
        Outstanding.deleteMany({
          $or: [
            { customerId: { $in: customerIds } },
            ...(dayIds.length > 0 ? [{ businessDayId: { $in: dayIds } }] : []),
          ],
        })
    );
    await remove(
      "customerbalancepayments",
      await CustomerBalancePayment.countDocuments({
        customerId: { $in: customerIds },
      }),
      () =>
        CustomerBalancePayment.deleteMany({ customerId: { $in: customerIds } })
    );
    await remove(
      "transactions",
      await Transaction.countDocuments({
        $or: [
          { customerId: { $in: customerIds } },
          ...(dayIds.length > 0 ? [{ businessDayId: { $in: dayIds } }] : []),
        ],
      }),
      () =>
        Transaction.deleteMany({
          $or: [
            { customerId: { $in: customerIds } },
            ...(dayIds.length > 0 ? [{ businessDayId: { $in: dayIds } }] : []),
          ],
        })
    );
  } else {
    removed.push({ label: "financialcorrections", count: 0 });
    removed.push({ label: "outstandingcollections", count: 0 });
    removed.push({ label: "outstandings", count: 0 });
    removed.push({ label: "customerbalancepayments", count: 0 });
    removed.push({ label: "transactions", count: 0 });
  }

  await remove(
    "notebookentries",
    await NotebookEntry.countDocuments(entryFilter),
    () => NotebookEntry.deleteMany(entryFilter)
  );
  await remove(
    "cafeorders",
    await CafeOrder.countDocuments(cafeFilter),
    () => CafeOrder.deleteMany(cafeFilter)
  );
  await remove(
    "tablesessions",
    await TableSession.countDocuments(sessionFilter),
    () => TableSession.deleteMany(sessionFilter)
  );

  if (dayIds.length > 0) {
    await remove(
      "businessdayfinalsummaries",
      await BusinessDayFinalSummary.countDocuments({
        businessDayId: { $in: dayIds },
      }),
      () =>
        BusinessDayFinalSummary.deleteMany({ businessDayId: { $in: dayIds } })
    );
    await remove(
      "businessdays",
      dayIds.length,
      () => BusinessDay.deleteMany({ _id: { $in: dayIds } })
    );
  } else {
    removed.push({ label: "businessdayfinalsummaries", count: 0 });
    removed.push({ label: "businessdays", count: 0 });
  }

  await remove(
    "customers",
    customerIds.length,
    () => Customer.deleteMany({ _id: { $in: customerIds } })
  );

  console.log("\nRemoved TEST10 records:");
  for (const row of removed) {
    console.log(`  ${row.label.padEnd(28)} ${row.count}`);
  }
  console.log(`\nCustomers matched: ${seedCustomers.length}`);
  console.log(`Business Days matched: ${seedDays.length}`);
  console.log("\nUnrelated customers, staff, expenses, and non-TEST10 days were not touched.");
}

reset()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
