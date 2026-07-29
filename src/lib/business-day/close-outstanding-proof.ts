import mongoose from "mongoose";
import {
  loadFinancialProofSnapshot,
  validateBusinessDayCloseFinancialProof,
} from "@/lib/business-day/close-financial-proof";
import {
  buildOutstandingCandidatesForBusinessDay,
  type OutstandingCandidate,
} from "@/lib/outstanding/generate-on-close";
import type {
  BusinessDayCloseOutstandingProofIssue,
  BusinessDayCloseOutstandingProofResult,
} from "@/types";

function recordRef(line: {
  recordType?: string;
  sourceRecordId: string;
  sourceType: string;
}): string {
  return `${line.recordType ?? line.sourceType}:${line.sourceRecordId}`;
}

/**
 * Phase 2 — Outstanding Candidate Proof.
 *
 * Builds Outstanding candidates with current generation logic (no insert)
 * and proves they match Phase 1B Financial Proof dues.
 *
 * Read-only. Does not write to the database.
 * Does not close the Business Day.
 */
export async function validateBusinessDayCloseOutstandingProof(
  businessDayId?: string
): Promise<BusinessDayCloseOutstandingProofResult> {
  const issues: BusinessDayCloseOutstandingProofIssue[] = [];

  const loaded = await loadFinancialProofSnapshot(businessDayId);
  if (!loaded.ok) {
    return {
      status: "FAIL",
      issues: [
        {
          validation: "FINANCIAL_PROOF_PREREQUISITE",
          expected: 0,
          actual: 0,
          affectedCustomers: [],
          affectedRecords: [],
          rootCause:
            loaded.result.status === "FAIL"
              ? loaded.result.issues[0]?.reason ??
                "Financial Proof must PASS before Outstanding candidate proof."
              : "Financial Proof must PASS before Outstanding candidate proof.",
        },
      ],
    };
  }

  const snapshot = loaded.snapshot;
  const financialProof = await validateBusinessDayCloseFinancialProof(
    snapshot.businessDayId
  );

  if (financialProof.status === "FAIL") {
    return {
      status: "FAIL",
      businessDayId: snapshot.businessDayId,
      businessDayDue: snapshot.businessDayDue,
      issues: [
        {
          validation: "FINANCIAL_PROOF_PREREQUISITE",
          expected: 0,
          actual: financialProof.issues.length,
          affectedCustomers: financialProof.issues.flatMap(
            (issue) => issue.affectedCustomers
          ),
          affectedRecords: [],
          rootCause: `Financial Proof failed (${financialProof.issues.length} issue(s)). Fix Phase 1B before Outstanding candidate proof. First issue: ${financialProof.issues[0]?.reason ?? "unknown"}`,
        },
      ],
    };
  }

  const dayObjectId = new mongoose.Types.ObjectId(snapshot.businessDayId);
  const candidates = await buildOutstandingCandidatesForBusinessDay(dayObjectId);

  const nameByCustomerId = new Map(
    snapshot.customers.map((row) => [row.customerId, row.customerName])
  );

  const expectedCustomers = snapshot.customers.filter((row) => row.due > 0);
  const expectedLines = snapshot.ownershipLines.filter(
    (line) => line.customerId && line.due > 0
  );

  const candidatesByCustomer = new Map<string, OutstandingCandidate[]>();
  for (const candidate of candidates) {
    const list = candidatesByCustomer.get(candidate.customerId) ?? [];
    list.push(candidate);
    candidatesByCustomer.set(candidate.customerId, list);
  }

  // Exactly one Outstanding candidate per customer with Due > 0
  for (const [customerId, list] of candidatesByCustomer) {
    if (list.length <= 1) continue;
    const sample = list[0];
    issues.push({
      validation: "NO_DUPLICATE_CANDIDATES",
      expected: 1,
      actual: list.length,
      affectedCustomers: [
        nameByCustomerId.get(customerId) ?? customerId,
      ],
      affectedRecords: list.map(
        (row) => `${row.sourceType}:${row.sourceRecordId}`
      ),
      rootCause: `Outstanding generation produced ${list.length} candidates for customer ${customerId}. Close must create exactly one Outstanding record per customer.`,
    });
  }

  // Every Financial Proof customer with Due > 0 must have one candidate for that total
  for (const customer of expectedCustomers) {
    const list = candidatesByCustomer.get(customer.customerId) ?? [];
    const actualAmount = list.reduce((sum, row) => sum + row.dueAmount, 0);
    const customerRecords = expectedLines
      .filter((line) => line.customerId === customer.customerId)
      .map((line) => recordRef(line));

    if (list.length === 0) {
      issues.push({
        validation: "NO_SKIPPED_OWNERSHIP_LINES",
        expected: customer.due,
        actual: 0,
        affectedCustomers: [customer.customerName],
        affectedRecords: customerRecords,
        rootCause:
          "Financial Proof has Due > 0 for this customer, but Outstanding generation produced no candidate.",
      });
      continue;
    }

    if (actualAmount !== customer.due) {
      issues.push({
        validation: "CUSTOMER_DUE_EQUALS_CANDIDATE_SUM",
        expected: customer.due,
        actual: actualAmount,
        affectedCustomers: [customer.customerName],
        affectedRecords: customerRecords,
        rootCause:
          "Outstanding candidate total does not equal Financial Proof Due for this customer.",
      });
    }
  }

  // Every candidate must belong to a Financial Proof customer with Due > 0
  for (const [customerId, list] of candidatesByCustomer) {
    const proof = expectedCustomers.find((row) => row.customerId === customerId);
    if (proof) continue;
    const sample = list[0];
    const customerName =
      nameByCustomerId.get(customerId) ?? customerId;
    issues.push({
      validation: "NO_EXTRA_CANDIDATES",
      expected: 0,
      actual: sample.dueAmount,
      affectedCustomers: [customerName],
      affectedRecords: list.map(
        (row) => `${row.sourceType}:${row.sourceRecordId}`
      ),
      rootCause:
        "Outstanding generation produced a candidate for a customer with Financial Proof Due ≤ 0.",
    });
  }

  // Business Day: Σ(Customer Due) = Σ(Outstanding Candidate Amount)
  const sumProofCustomerDue = snapshot.customers.reduce(
    (sum, row) => sum + row.due,
    0
  );
  const sumCandidateAmount = candidates.reduce(
    (sum, row) => sum + row.dueAmount,
    0
  );

  if (sumProofCustomerDue !== sumCandidateAmount) {
    issues.push({
      validation: "BUSINESS_DAY_DUE_EQUALS_CANDIDATE_SUM",
      expected: sumProofCustomerDue,
      actual: sumCandidateAmount,
      affectedCustomers: snapshot.customers
        .filter((row) => row.due !== 0)
        .map((row) => row.customerName),
      affectedRecords: candidates.map(
        (row) => `${row.sourceType}:${row.sourceRecordId}`
      ),
      rootCause: `Σ(Customer Due) from Financial Proof (${sumProofCustomerDue}) ≠ Σ(Outstanding Candidate Amount) (${sumCandidateAmount}). Business Day Due is ${snapshot.businessDayDue}.`,
    });
  }

  // Also require Business Day Due === candidate sum when proof has no unassigned
  if (
    snapshot.unassignedDue === 0 &&
    snapshot.businessDayDue !== sumCandidateAmount
  ) {
    issues.push({
      validation: "BUSINESS_DAY_DUE_EQUALS_CANDIDATE_SUM",
      expected: snapshot.businessDayDue,
      actual: sumCandidateAmount,
      affectedCustomers: [],
      affectedRecords: [],
      rootCause: `Business Day Due (${snapshot.businessDayDue}) ≠ Total Outstanding To Create (${sumCandidateAmount}).`,
    });
  }

  if (issues.length > 0) {
    return {
      status: "FAIL",
      businessDayId: snapshot.businessDayId,
      businessDayDue: snapshot.businessDayDue,
      totalOutstandingToCreate: sumCandidateAmount,
      customerCount: snapshot.customerCount,
      outstandingRecordCount: candidates.length,
      issues,
    };
  }

  return {
    status: "PASS",
    businessDayId: snapshot.businessDayId,
    businessDayDue: snapshot.businessDayDue,
    totalOutstandingToCreate: sumCandidateAmount,
    customerCount: snapshot.customerCount,
    outstandingRecordCount: candidates.length,
  };
}
