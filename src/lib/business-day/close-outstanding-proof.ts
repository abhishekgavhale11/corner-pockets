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
  FinancialProofOwnershipLine,
} from "@/types";

function candidateKey(c: {
  sourceType: string;
  sourceRecordId: string;
  customerId: string;
}): string {
  return `${c.sourceType}:${c.sourceRecordId}:${c.customerId}`;
}

function ownershipKey(line: FinancialProofOwnershipLine): string | null {
  if (!line.customerId) return null;
  return `${line.sourceType}:${line.sourceRecordId}:${line.customerId}`;
}

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

  const expectedLines = snapshot.ownershipLines.filter(
    (line) => line.customerId && line.due > 0
  );

  const expectedByKey = new Map<string, FinancialProofOwnershipLine>();
  for (const line of expectedLines) {
    const key = ownershipKey(line);
    if (!key) continue;
    if (expectedByKey.has(key)) {
      issues.push({
        validation: "NO_DUPLICATE_CANDIDATES",
        expected: 1,
        actual: 2,
        affectedCustomers: [line.customerName],
        affectedRecords: [recordRef(line)],
        rootCause:
          "Financial Proof ownership lines contain a duplicate source key for the same customer.",
      });
    } else {
      expectedByKey.set(key, line);
    }
  }

  const candidatesByKey = new Map<string, OutstandingCandidate[]>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const list = candidatesByKey.get(key) ?? [];
    list.push(candidate);
    candidatesByKey.set(key, list);
  }

  // Duplicate candidates (same ownership line more than once)
  for (const [key, list] of candidatesByKey) {
    if (list.length <= 1) continue;
    const sample = list[0];
    issues.push({
      validation: "NO_DUPLICATE_CANDIDATES",
      expected: 1,
      actual: list.length,
      affectedCustomers: [
        nameByCustomerId.get(sample.customerId) ?? sample.customerId,
      ],
      affectedRecords: [`${sample.sourceType}:${sample.sourceRecordId}`],
      rootCause: `Outstanding generation produced ${list.length} candidates for the same ownership line (${key}).`,
    });
  }

  // Every expected ownership line with Due > 0 must have exactly one matching candidate
  for (const [key, line] of expectedByKey) {
    const list = candidatesByKey.get(key) ?? [];
    const actualAmount = list.reduce((sum, row) => sum + row.dueAmount, 0);
    const customerName = line.customerName;

    if (list.length === 0) {
      issues.push({
        validation: "NO_SKIPPED_OWNERSHIP_LINES",
        expected: line.due,
        actual: 0,
        affectedCustomers: [customerName],
        affectedRecords: [recordRef(line)],
        rootCause:
          "Financial Proof has Due > 0 on this ownership line, but Outstanding generation produced no candidate (line skipped).",
      });
      continue;
    }

    if (list.length === 1 && list[0].dueAmount !== line.due) {
      issues.push({
        validation: "OWNERSHIP_LINE_DUE_MATCH",
        expected: line.due,
        actual: list[0].dueAmount,
        affectedCustomers: [customerName],
        affectedRecords: [recordRef(line)],
        rootCause:
          "Outstanding candidate Due does not equal Financial Proof Due for this ownership line. Generation may use a different Received definition (e.g. omitting balanceCollectedAmount) or a different Cafe source set.",
      });
    } else if (list.length > 1 && actualAmount !== line.due) {
      issues.push({
        validation: "OWNERSHIP_LINE_DUE_MATCH",
        expected: line.due,
        actual: actualAmount,
        affectedCustomers: [customerName],
        affectedRecords: [recordRef(line)],
        rootCause:
          "Sum of duplicate Outstanding candidates does not equal Financial Proof Due for this ownership line.",
      });
    }

    // Wrong customer on matching source would be a different key — caught as skipped + extra
  }

  // Every candidate must match exactly one expected ownership line
  for (const [key, list] of candidatesByKey) {
    if (expectedByKey.has(key)) continue;
    const sample = list[0];
    const customerName =
      nameByCustomerId.get(sample.customerId) ?? sample.customerId;
    issues.push({
      validation: "NO_EXTRA_CANDIDATES",
      expected: 0,
      actual: sample.dueAmount,
      affectedCustomers: [customerName],
      affectedRecords: [`${sample.sourceType}:${sample.sourceRecordId}`],
      rootCause:
        sample.sourceType === "CAFE"
          ? "Outstanding generation produced a Cafe candidate that is not in the Financial Proof ownership set (possible legacy NotebookEntry CAFE or unmatched CafeOrder)."
          : "Outstanding generation produced a candidate with no matching Financial Proof ownership line (extra or mis-owned charge).",
    });
  }

  // Per-customer: Financial Proof Due = Σ Outstanding Candidate Amount
  const candidateSumByCustomer = new Map<string, number>();
  for (const candidate of candidates) {
    candidateSumByCustomer.set(
      candidate.customerId,
      (candidateSumByCustomer.get(candidate.customerId) ?? 0) +
        candidate.dueAmount
    );
  }

  const allCustomerIds = new Set([
    ...snapshot.customers.map((row) => row.customerId),
    ...candidateSumByCustomer.keys(),
  ]);

  for (const customerId of allCustomerIds) {
    const proof = snapshot.customers.find((row) => row.customerId === customerId);
    const expectedDue = proof?.due ?? 0;
    const actualDue = candidateSumByCustomer.get(customerId) ?? 0;
    const customerName =
      proof?.customerName ?? nameByCustomerId.get(customerId) ?? customerId;

    if (expectedDue !== actualDue) {
      const customerRecords = [
        ...expectedLines
          .filter((line) => line.customerId === customerId)
          .map((line) => recordRef(line)),
        ...candidates
          .filter((row) => row.customerId === customerId)
          .map((row) => `${row.sourceType}:${row.sourceRecordId}`),
      ];

      issues.push({
        validation: "CUSTOMER_DUE_EQUALS_CANDIDATE_SUM",
        expected: expectedDue,
        actual: actualDue,
        affectedCustomers: [customerName],
        affectedRecords: [...new Set(customerRecords)],
        rootCause:
          expectedDue > actualDue
            ? "Financial Proof Due exceeds Outstanding candidate total for this customer (generation under-counted or skipped lines)."
            : "Outstanding candidate total exceeds Financial Proof Due for this customer (generation over-counted, wrong Received, or duplicate Cafe source).",
      });
    }
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
