import mongoose from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import NotebookEntry from "@/models/NotebookEntry";
import CafeOrder from "@/models/CafeOrder";
import { CAFE_SECTION } from "@/lib/constants/counter-sections";
import type {
  BusinessDayClosePreflightAffectedRecord,
  BusinessDayClosePreflightIssue,
  BusinessDayClosePreflightResult,
  BusinessDayClosePreflightValidationName,
} from "@/types";

type LeanContributor = {
  customerId?: mongoose.Types.ObjectId | null;
  customerName?: string;
  amount?: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  paymentMethod?: string | null;
};

type LeanNotebookEntry = {
  _id: mongoose.Types.ObjectId;
  businessDayId: mongoose.Types.ObjectId;
  section: string;
  amount: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  paymentMethod?: string | null;
  customerId?: mongoose.Types.ObjectId | null;
  customerName?: string;
  contributors?: LeanContributor[];
  status: string;
};

type LeanCafeOrder = {
  _id: mongoose.Types.ObjectId;
  businessDayId: mongoose.Types.ObjectId;
  amount: number;
  received?: number;
  paymentMethod?: string | null;
  customerId?: mongoose.Types.ObjectId | null;
  customerName?: string;
  status: string;
};

function lineReceived(paidAmount?: number, balanceCollectedAmount?: number): number {
  return (paidAmount ?? 0) + (balanceCollectedAmount ?? 0);
}

function hasContributors(entry: LeanNotebookEntry): boolean {
  return (entry.contributors?.length ?? 0) > 0;
}

function affectedNotebook(
  entry: LeanNotebookEntry,
  detail?: string
): BusinessDayClosePreflightAffectedRecord {
  return {
    recordType: "NOTEBOOK_ENTRY",
    recordId: entry._id.toString(),
    section: entry.section,
    customerName: entry.customerName,
    detail,
  };
}

function affectedCafe(
  order: LeanCafeOrder,
  detail?: string
): BusinessDayClosePreflightAffectedRecord {
  return {
    recordType: "CAFE_ORDER",
    recordId: order._id.toString(),
    section: "CAFE",
    customerName: order.customerName,
    detail,
  };
}

function pushIssue(
  issues: BusinessDayClosePreflightIssue[],
  validation: BusinessDayClosePreflightValidationName,
  reason: string,
  affectedRecords: BusinessDayClosePreflightAffectedRecord[]
) {
  if (affectedRecords.length === 0) {
    issues.push({ validation, reason, affectedRecords: [] });
    return;
  }
  issues.push({ validation, reason, affectedRecords });
}

/**
 * Phase 1 — Business Day Close Preflight Validation.
 *
 * Read-only. Does not write to the database.
 * Does not create Outstanding. Does not close the Business Day.
 */
export async function validateBusinessDayClosePreflight(
  businessDayId?: string
): Promise<BusinessDayClosePreflightResult> {
  const issues: BusinessDayClosePreflightIssue[] = [];

  const day = businessDayId
    ? await BusinessDay.findById(businessDayId).lean()
    : await BusinessDay.findOne({ status: "OPEN" }).lean();

  if (!day) {
    return {
      status: "FAIL",
      issues: [
        {
          validation: "BUSINESS_DAY_SCOPE",
          reason: businessDayId
            ? "Business Day not found."
            : "No OPEN Business Day to validate.",
          affectedRecords: [],
        },
      ],
    };
  }

  if (day.status !== "OPEN") {
    return {
      status: "FAIL",
      businessDayId: day._id.toString(),
      issues: [
        {
          validation: "BUSINESS_DAY_SCOPE",
          reason: "Preflight only validates an OPEN Business Day.",
          affectedRecords: [],
        },
      ],
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

  const checkedRecords = rawEntries.length + cafeOrders.length;

  // 1. Every operational record belongs to the OPEN Business Day.
  const scopeAffected: BusinessDayClosePreflightAffectedRecord[] = [];
  for (const entry of rawEntries) {
    if (entry.businessDayId.toString() !== openDayIdStr) {
      scopeAffected.push(
        affectedNotebook(
          entry,
          `businessDayId ${entry.businessDayId.toString()} does not match OPEN day`
        )
      );
    }
  }
  for (const order of cafeOrders) {
    if (order.businessDayId.toString() !== openDayIdStr) {
      scopeAffected.push(
        affectedCafe(
          order,
          `businessDayId ${order.businessDayId.toString()} does not match OPEN day`
        )
      );
    }
  }
  if (scopeAffected.length > 0) {
    pushIssue(
      issues,
      "BUSINESS_DAY_SCOPE",
      "One or more operational records do not belong to the OPEN Business Day.",
      scopeAffected
    );
  }

  // 6. CafeOrder is the only operational Cafe source.
  const legacyCafe = rawEntries.filter((entry) => entry.section === CAFE_SECTION);
  if (legacyCafe.length > 0) {
    pushIssue(
      issues,
      "CAFE_SOURCE",
      "Legacy NotebookEntry Cafe records exist. CafeOrder must be the only operational Cafe source.",
      legacyCafe.map((entry) =>
        affectedNotebook(entry, "NotebookEntry section=CAFE is not allowed")
      )
    );
  }

  const gameEntries = rawEntries.filter((entry) => entry.section !== CAFE_SECTION);

  for (const entry of gameEntries) {
    const contributors = entry.contributors ?? [];
    const split = hasContributors(entry);

    // 7. No duplicate / ambiguous ownership
    if (split && entry.customerId) {
      pushIssue(
        issues,
        "DUPLICATE_OWNERSHIP",
        "Charge has both a parent customer and split contributors.",
        [
          affectedNotebook(
            entry,
            "Ambiguous ownership: customerId set while contributors exist"
          ),
        ]
      );
    }

    if (split) {
      const seen = new Set<string>();
      const duplicateCustomers: string[] = [];
      for (const row of contributors) {
        const id = row.customerId?.toString();
        if (!id) continue;
        if (seen.has(id)) {
          duplicateCustomers.push(row.customerName ?? id);
        } else {
          seen.add(id);
        }
      }
      if (duplicateCustomers.length > 0) {
        pushIssue(
          issues,
          "DUPLICATE_OWNERSHIP",
          "The same customer appears more than once as a split contributor on one charge.",
          [
            affectedNotebook(
              entry,
              `Duplicate contributors: ${[...new Set(duplicateCustomers)].join(", ")}`
            ),
          ]
        );
      }
    }

    // 2. Ownership (non-split). Split contributor customers → SPLIT_INTEGRITY.
    if (!split && !entry.customerId) {
      pushIssue(
        issues,
        "OWNERSHIP",
        "Operational game record has no customer assigned.",
        [affectedNotebook(entry, "Unassigned frame / Pool & Mini entry")]
      );
    }

    // 3. Split integrity
    if (split) {
      const missingCustomer = contributors.filter((row) => !row.customerId);
      if (missingCustomer.length > 0) {
        pushIssue(
          issues,
          "SPLIT_INTEGRITY",
          "Every split contributor must have a customer.",
          [
            affectedNotebook(
              entry,
              `${missingCustomer.length} contributor(s) missing customer`
            ),
          ]
        );
      }

      const contributorTotal = contributors.reduce(
        (sum, row) => sum + (row.amount ?? 0),
        0
      );
      if (contributorTotal !== entry.amount) {
        pushIssue(
          issues,
          "SPLIT_INTEGRITY",
          "Contributor totals must equal the parent amount.",
          [
            affectedNotebook(
              entry,
              `Contributors sum ${contributorTotal} ≠ parent amount ${entry.amount}`
            ),
          ]
        );
      }
    }

    // 4 & 5. Received + Payment Mode (parent or per contributor)
    if (split) {
      for (const [index, row] of contributors.entries()) {
        const amount = row.amount ?? 0;
        const received = lineReceived(row.paidAmount, row.balanceCollectedAmount);
        const label = row.customerName ?? `contributor[${index}]`;

        if (amount < 0 || (row.paidAmount ?? 0) < 0 || (row.balanceCollectedAmount ?? 0) < 0) {
          pushIssue(
            issues,
            "RECEIVED",
            "Negative Amount or Received is not allowed.",
            [affectedNotebook(entry, `${label}: negative money fields`)]
          );
        }

        if (received > amount) {
          pushIssue(
            issues,
            "RECEIVED",
            "Received cannot exceed Amount.",
            [
              affectedNotebook(
                entry,
                `${label}: received ${received} > amount ${amount}`
              ),
            ]
          );
        }

        if (received > 0 && !row.paymentMethod) {
          pushIssue(
            issues,
            "PAYMENT_MODE",
            "Payment Mode is required when Received > 0.",
            [affectedNotebook(entry, `${label}: received ${received} without payment mode`)]
          );
        }
      }
    } else {
      const amount = entry.amount ?? 0;
      const received = lineReceived(entry.paidAmount, entry.balanceCollectedAmount);

      if (
        amount < 0 ||
        (entry.paidAmount ?? 0) < 0 ||
        (entry.balanceCollectedAmount ?? 0) < 0
      ) {
        pushIssue(
          issues,
          "RECEIVED",
          "Negative Amount or Received is not allowed.",
          [affectedNotebook(entry, "Negative money fields on entry")]
        );
      }

      if (received > amount) {
        pushIssue(
          issues,
          "RECEIVED",
          "Received cannot exceed Amount.",
          [
            affectedNotebook(
              entry,
              `received ${received} > amount ${amount}`
            ),
          ]
        );
      }

      if (received > 0 && !entry.paymentMethod) {
        pushIssue(
          issues,
          "PAYMENT_MODE",
          "Payment Mode is required when Received > 0.",
          [
            affectedNotebook(
              entry,
              `received ${received} without payment mode`
            ),
          ]
        );
      }
    }
  }

  for (const order of cafeOrders) {
    // 2. Ownership
    if (!order.customerId) {
      pushIssue(
        issues,
        "OWNERSHIP",
        "Cafe order has no customer assigned.",
        [affectedCafe(order, "Unassigned CafeOrder")]
      );
    }

    // 4. Received
    const amount = order.amount ?? 0;
    const received = order.received ?? 0;

    if (amount < 0 || received < 0) {
      pushIssue(
        issues,
        "RECEIVED",
        "Negative Amount or Received is not allowed.",
        [affectedCafe(order, "Negative money fields on CafeOrder")]
      );
    }

    if (received > amount) {
      pushIssue(
        issues,
        "RECEIVED",
        "Received cannot exceed Amount.",
        [affectedCafe(order, `received ${received} > amount ${amount}`)]
      );
    }

    // 5. Payment Mode
    if (received > 0 && !order.paymentMethod) {
      pushIssue(
        issues,
        "PAYMENT_MODE",
        "Payment Mode is required when Received > 0.",
        [affectedCafe(order, `received ${received} without payment mode`)]
      );
    }
  }

  if (issues.length > 0) {
    return {
      status: "FAIL",
      businessDayId: openDayIdStr,
      checkedRecords,
      issues,
    };
  }

  return {
    status: "PASS",
    businessDayId: openDayIdStr,
    checkedRecords,
  };
}
