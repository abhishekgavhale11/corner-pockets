import mongoose from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import NotebookEntry from "@/models/NotebookEntry";
import CafeOrder from "@/models/CafeOrder";
import { CAFE_SECTION } from "@/lib/constants/counter-sections";
import type {
  BusinessDayCloseFinancialProofIssue,
  BusinessDayCloseFinancialProofResult,
  FinancialProofCustomerTotals,
  FinancialProofOwnershipLine,
  FinancialProofSnapshot,
} from "@/types";

type LeanContributor = {
  customerId?: mongoose.Types.ObjectId | null;
  customerName?: string;
  amount?: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
};

type LeanNotebookEntry = {
  _id: mongoose.Types.ObjectId;
  section: string;
  amount: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  customerId?: mongoose.Types.ObjectId | null;
  customerName?: string;
  contributors?: LeanContributor[];
};

type LeanCafeOrder = {
  _id: mongoose.Types.ObjectId;
  amount: number;
  received?: number;
  customerId?: mongoose.Types.ObjectId | null;
  customerName?: string;
};

function lineReceived(paidAmount?: number, balanceCollectedAmount?: number): number {
  return (paidAmount ?? 0) + (balanceCollectedAmount ?? 0);
}

function pushIssue(
  issues: BusinessDayCloseFinancialProofIssue[],
  issue: BusinessDayCloseFinancialProofIssue
) {
  issues.push(issue);
}

/**
 * Build ownership lines from operational records only.
 * Games: NotebookEntry (non-CAFE). Cafe: CafeOrder only.
 * Received = paidAmount + balanceCollectedAmount (game lines).
 */
function collectOwnershipLines(
  entries: LeanNotebookEntry[],
  cafeOrders: LeanCafeOrder[]
): FinancialProofOwnershipLine[] {
  const lines: FinancialProofOwnershipLine[] = [];

  for (const entry of entries) {
    if (entry.section === CAFE_SECTION) {
      continue;
    }

    const contributors = entry.contributors ?? [];
    if (contributors.length > 0) {
      for (const row of contributors) {
        const bill = row.amount ?? 0;
        const received = lineReceived(row.paidAmount, row.balanceCollectedAmount);
        lines.push({
          customerId: row.customerId?.toString(),
          customerName: row.customerName?.trim() || "—",
          bill,
          received,
          due: bill - received,
          sourceType: "FRAME",
          sourceRecordId: entry._id.toString(),
          recordType: "NOTEBOOK_ENTRY",
        });
      }
      continue;
    }

    const bill = entry.amount ?? 0;
    const received = lineReceived(entry.paidAmount, entry.balanceCollectedAmount);
    lines.push({
      customerId: entry.customerId?.toString(),
      customerName: entry.customerName?.trim() || "—",
      bill,
      received,
      due: bill - received,
      sourceType: "FRAME",
      sourceRecordId: entry._id.toString(),
      recordType: "NOTEBOOK_ENTRY",
    });
  }

  for (const order of cafeOrders) {
    const bill = order.amount ?? 0;
    const received = order.received ?? 0;
    lines.push({
      customerId: order.customerId?.toString(),
      customerName: order.customerName?.trim() || "—",
      bill,
      received,
      due: bill - received,
      sourceType: "CAFE",
      sourceRecordId: order._id.toString(),
      recordType: "CAFE_ORDER",
    });
  }

  return lines;
}

function aggregateCustomers(lines: FinancialProofOwnershipLine[]): {
  customers: FinancialProofCustomerTotals[];
  unassignedBill: number;
  unassignedReceived: number;
} {
  const byCustomer = new Map<string, FinancialProofCustomerTotals>();
  let unassignedBill = 0;
  let unassignedReceived = 0;

  for (const line of lines) {
    if (!line.customerId) {
      unassignedBill += line.bill;
      unassignedReceived += line.received;
      continue;
    }

    const existing = byCustomer.get(line.customerId);
    if (existing) {
      existing.bill += line.bill;
      existing.received += line.received;
      if (existing.customerName === "—" && line.customerName !== "—") {
        existing.customerName = line.customerName;
      }
    } else {
      byCustomer.set(line.customerId, {
        customerId: line.customerId,
        customerName: line.customerName,
        bill: line.bill,
        received: line.received,
        due: 0,
      });
    }
  }

  const customers = [...byCustomer.values()].map((row) => ({
    ...row,
    due: row.bill - row.received,
  }));

  return { customers, unassignedBill, unassignedReceived };
}

/**
 * Loads Financial Proof numbers from operational data (read-only).
 * Used by Phase 1B validation and Phase 2 Outstanding candidate proof.
 */
export async function loadFinancialProofSnapshot(
  businessDayId?: string
): Promise<
  | { ok: false; result: BusinessDayCloseFinancialProofResult }
  | { ok: true; snapshot: FinancialProofSnapshot }
> {
  const day = businessDayId
    ? await BusinessDay.findById(businessDayId).lean()
    : await BusinessDay.findOne({ status: "OPEN" }).lean();

  if (!day) {
    return {
      ok: false,
      result: {
        status: "FAIL",
        issues: [
          {
            invariant: "BUSINESS_DAY_BILL_IDENTITY",
            expected: 0,
            actual: 0,
            affectedCustomers: [],
            reason: businessDayId
              ? "Business Day not found."
              : "No OPEN Business Day to prove.",
          },
        ],
      },
    };
  }

  if (day.status !== "OPEN") {
    return {
      ok: false,
      result: {
        status: "FAIL",
        businessDayId: day._id.toString(),
        issues: [
          {
            invariant: "BUSINESS_DAY_BILL_IDENTITY",
            expected: 0,
            actual: 0,
            affectedCustomers: [],
            reason: "Financial proof only validates an OPEN Business Day.",
          },
        ],
      },
    };
  }

  const openDayId = day._id;
  const openDayIdStr = openDayId.toString();

  const [rawEntries, cafeOrders] = await Promise.all([
    NotebookEntry.find({
      businessDayId: openDayId,
      status: { $nin: ["CANCELLED", "REVERSED"] },
    }).lean() as Promise<LeanNotebookEntry[]>,
    CafeOrder.find({
      businessDayId: openDayId,
      status: "OPEN",
    }).lean() as Promise<LeanCafeOrder[]>,
  ]);

  const ownershipLines = collectOwnershipLines(rawEntries, cafeOrders);
  const { customers, unassignedBill, unassignedReceived } =
    aggregateCustomers(ownershipLines);

  const businessDayBill = ownershipLines.reduce((sum, line) => sum + line.bill, 0);
  const businessDayReceived = ownershipLines.reduce(
    (sum, line) => sum + line.received,
    0
  );
  const businessDayDue = businessDayBill - businessDayReceived;
  const unassignedDue = unassignedBill - unassignedReceived;

  return {
    ok: true,
    snapshot: {
      businessDayId: openDayIdStr,
      businessDayBill,
      businessDayReceived,
      businessDayDue,
      customerCount: customers.length,
      customers,
      ownershipLines,
      unassignedBill,
      unassignedReceived,
      unassignedDue,
    },
  };
}

/**
 * Phase 1B — Business Day Close Financial Proof.
 *
 * Read-only. Does not write to the database.
 * Does not create Outstanding. Does not close the Business Day.
 * Does not use History, Reports, or Outstanding documents.
 */
export async function validateBusinessDayCloseFinancialProof(
  businessDayId?: string
): Promise<BusinessDayCloseFinancialProofResult> {
  const issues: BusinessDayCloseFinancialProofIssue[] = [];
  const loaded = await loadFinancialProofSnapshot(businessDayId);

  if (!loaded.ok) {
    return loaded.result;
  }

  const {
    businessDayId: openDayIdStr,
    businessDayBill,
    businessDayReceived,
    businessDayDue,
    customerCount,
    customers,
    unassignedBill,
    unassignedReceived,
    unassignedDue,
  } = loaded.snapshot;

  const sumCustomerDue = customers.reduce((sum, row) => sum + row.due, 0);

  const identityActual = businessDayReceived + businessDayDue;
  if (businessDayBill !== identityActual) {
    pushIssue(issues, {
      invariant: "BUSINESS_DAY_BILL_IDENTITY",
      expected: businessDayBill,
      actual: identityActual,
      affectedCustomers: [],
      reason: `Business Day Bill (${businessDayBill}) ≠ Received (${businessDayReceived}) + Due (${businessDayDue}).`,
    });
  }

  if (businessDayDue < 0) {
    pushIssue(issues, {
      invariant: "NO_NEGATIVE_DUE",
      expected: 0,
      actual: businessDayDue,
      affectedCustomers: [],
      reason: `Business Day Due is negative (${businessDayDue}). Received exceeds Bill.`,
    });
  }

  if (unassignedDue < 0) {
    pushIssue(issues, {
      invariant: "NO_NEGATIVE_DUE",
      expected: 0,
      actual: unassignedDue,
      affectedCustomers: ["Unassigned"],
      reason: `Unassigned Due is negative (${unassignedDue}).`,
    });
  }

  for (const row of customers) {
    if (row.due < 0) {
      pushIssue(issues, {
        invariant: "NO_NEGATIVE_DUE",
        expected: 0,
        actual: row.due,
        affectedCustomers: [row.customerName],
        reason: `Customer Due is negative for ${row.customerName} (${row.due}). Received exceeds Bill.`,
      });
    }
  }

  for (const row of customers) {
    const actual = row.received + row.due;
    if (row.bill !== actual) {
      pushIssue(issues, {
        invariant: "CUSTOMER_BILL_IDENTITY",
        expected: row.bill,
        actual,
        affectedCustomers: [row.customerName],
        reason: `Customer Bill (${row.bill}) ≠ Received (${row.received}) + Due (${row.due}) for ${row.customerName}.`,
      });
    }
  }

  const expectedCustomerDueSum = businessDayDue - unassignedDue;
  if (sumCustomerDue !== businessDayDue) {
    const affected =
      unassignedBill > 0 || unassignedReceived > 0
        ? [
            ...customers
              .filter((row) => row.due !== 0)
              .map((row) => row.customerName),
            "Unassigned",
          ]
        : customers.map((row) => row.customerName);

    pushIssue(issues, {
      invariant: "CUSTOMER_DUE_EQUALS_BUSINESS_DAY_DUE",
      expected: businessDayDue,
      actual: sumCustomerDue,
      affectedCustomers: [...new Set(affected)],
      reason:
        unassignedBill > 0 || unassignedReceived > 0
          ? `Σ(Customer Due) (${sumCustomerDue}) ≠ Business Day Due (${businessDayDue}). Unassigned Bill ${unassignedBill}, Unassigned Received ${unassignedReceived}, Unassigned Due ${unassignedDue}. Assigned customer dues should total ${expectedCustomerDueSum}.`
          : `Σ(Customer Due) (${sumCustomerDue}) ≠ Business Day Due (${businessDayDue}).`,
    });
  }

  if (issues.length > 0) {
    return {
      status: "FAIL",
      businessDayId: openDayIdStr,
      businessDayBill,
      businessDayReceived,
      businessDayDue,
      customerCount,
      issues,
    };
  }

  return {
    status: "PASS",
    businessDayId: openDayIdStr,
    businessDayBill,
    businessDayReceived,
    businessDayDue,
    customerCount,
  };
}
