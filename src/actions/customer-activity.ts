"use server";

import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { getEntryDisplayLabel, getRummyActivityLabel } from "@/lib/utils/notebook-entry-label";
import { getAggregatedCorrections } from "@/lib/utils/entry-corrections";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { formatCurrency } from "@/lib/utils/format";
import { payLaterBalanceAtDismiss } from "@/lib/utils/freeze-counter-pay-snapshot";
import { customerActivityFilterSchema } from "@/lib/validators/customer";
import type { CustomerActivityEventDTO } from "@/types";
import Customer from "@/models/Customer";
import NotebookEntry from "@/models/NotebookEntry";
import NotebookSettlement from "@/models/NotebookSettlement";
import NotebookSettlementReversal from "@/models/NotebookSettlementReversal";
import Transaction from "@/models/Transaction";

export async function getCustomerActivity(
  customerId: string,
  filterInput = "all"
): Promise<CustomerActivityEventDTO[]> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return [];
  }

  const parsed = customerActivityFilterSchema.safeParse({
    customerId,
    filter: filterInput,
  });

  if (!parsed.success) {
    return [];
  }

  await connectDB();

  const customer = await Customer.findById(customerId).lean();
  if (!customer) {
    return [];
  }

  const filter = parsed.data.filter;
  const events: CustomerActivityEventDTO[] = [];

  const includeCounter =
    filter === "all" || filter === "counter" || filter === "cafe";
  const includePayments = filter === "all" || filter === "payments";
  const includeWallet =
    filter === "all" ||
    filter === "transactions" ||
    filter === "reversals";
  const includeReversals = filter === "all" || filter === "reversals";

  if (includeCounter) {
    const entryFilter: Record<string, unknown> = {
      $or: [{ customerId }, { "contributors.customerId": customerId }],
    };
    if (filter === "counter") {
      entryFilter.section = { $ne: "CAFE" };
    } else if (filter === "cafe") {
      entryFilter.section = "CAFE";
    }

    const entries = await NotebookEntry.find(entryFilter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    for (const entry of entries) {
      const isCafe = entry.section === "CAFE";
      if (filter === "counter" && isCafe) continue;
      if (filter === "cafe" && !isCafe) continue;

      const contributor = entry.contributors?.find(
        (row) => row.customerId.toString() === customerId
      );
      const isContributorEntry = Boolean(contributor);
      if (
        !isContributorEntry &&
        entry.customerId?.toString() !== customerId
      ) {
        continue;
      }

      const entryDto = toNotebookEntryDTO(entry);
      const entryLabel = getEntryDisplayLabel(entryDto);
      const isRummy = entry.type === "RUMMY";
      const rummyLabel =
        isRummy && entry.playerCount
          ? getRummyActivityLabel(entry.playerCount)
          : null;

      const contributionAmount = contributor?.amount;
      const contributionPaymentMethod = contributor?.paymentMethod;

      let title: string;
      if (isContributorEntry) {
        title = entryLabel;
      } else if (isRummy && rummyLabel) {
        title =
          entry.status === "CANCELLED"
            ? `${rummyLabel} (Cancelled)`
            : rummyLabel;
      } else {
        title =
          entry.status === "CANCELLED"
            ? `${sectionLabel(entry.section)} — ${entryLabel} (Cancelled)`
            : `${sectionLabel(entry.section)} — ${entryLabel} ${formatCurrency(entry.amount)}`;
      }

      const correctionSummary = getAggregatedCorrections({
        corrections: entryDto.corrections ?? [],
        type: entryDto.type,
        amount: entryDto.amount,
        playerCount: entryDto.playerCount,
        customerName: entryDto.customerName,
        isUnassigned: entryDto.isUnassigned,
        snookerGame: entryDto.snookerGame,
        rateType: entryDto.rateType,
      }).map((item) => ({
        field: item.field,
        fromLabel: item.from,
        toLabel: item.to,
      }));

      events.push({
        id: `entry-${entry._id.toString()}`,
        kind: isCafe ? "CAFE_ENTRY" : "COUNTER_ENTRY",
        timestamp: entry.createdAt.toISOString(),
        title,
        amount:
          entry.status === "CANCELLED"
            ? undefined
            : contributionAmount ?? entry.amount,
        staffUsername: entry.createdBy,
        paymentMethod: contributionPaymentMethod ?? entry.paymentMethod,
        reversalReason:
          entry.cancellationReason ?? entry.reversalReason,
        section: entry.section,
        entryType: entry.type,
        playerCount: entry.playerCount,
        contributionAmount,
        contributionPaymentMethod,
        correctionSummary,
        corrections: entryDto.corrections,
      });

      if (
        entry.checkoutDismissedAt &&
        entry.customerId?.toString() === customerId
      ) {
        const balanceAtDismiss = payLaterBalanceAtDismiss(entryDto);
        if (balanceAtDismiss > 0) {
          events.push({
            id: `balance-recorded-${entry._id.toString()}`,
            kind: "BALANCE_RECORDED",
            timestamp: entry.checkoutDismissedAt.toISOString(),
            title: `Pay later — ${entryLabel}`,
            amount: balanceAtDismiss,
            staffUsername:
              entry.checkoutDismissedBy ?? entry.assignedBy ?? entry.createdBy,
            section: entry.section,
            entryType: entry.type,
          });
        }
      }
    }
  }

  if (includePayments || includeReversals) {
    const customerEntries = await NotebookEntry.find({
      $or: [{ customerId }, { "contributors.customerId": customerId }],
    })
      .select("settlementId contributors")
      .lean();
    const settlementIds = [
      ...new Set(
        customerEntries.flatMap((entry) => {
          const ids: string[] = [];
          if (entry.settlementId) {
            ids.push(entry.settlementId.toString());
          }
          for (const contributor of entry.contributors ?? []) {
            if (
              contributor.customerId.toString() === customerId &&
              contributor.settlementId
            ) {
              ids.push(contributor.settlementId.toString());
            }
          }
          return ids;
        })
      ),
    ];

    const settlements = await NotebookSettlement.find({
      _id: { $in: settlementIds },
    })
      .sort({ createdAt: -1 })
      .lean();

    for (const settlement of settlements) {
      if (includePayments && settlement.status === "COMPLETED") {
        const contributorPayment = settlement.contributorPayments?.find(
          (payment) => payment.customerId.toString() === customerId
        );
        events.push({
          id: `settlement-${settlement._id.toString()}`,
          kind: "SETTLEMENT",
          timestamp: settlement.createdAt.toISOString(),
          title: contributorPayment
            ? `Contribution paid`
            : `Settlement ${formatCurrency(settlement.totalAmount)}`,
          amount: contributorPayment?.amount ?? settlement.totalAmount,
          staffUsername: settlement.createdBy,
          paymentMethod: settlement.paymentMethod,
          settlementId: settlement._id.toString(),
        });
      }
    }

    const reversals = await NotebookSettlementReversal.find({
      originalSettlementId: { $in: settlements.map((s) => s._id) },
    })
      .sort({ createdAt: -1 })
      .lean();

    for (const reversal of reversals) {
      if (includeReversals) {
        events.push({
          id: `settlement-reversal-${reversal._id.toString()}`,
          kind: "SETTLEMENT_REVERSAL",
          timestamp: reversal.createdAt.toISOString(),
          title: "Settlement Reversal",
          staffUsername: reversal.reversedBy,
          reversalReason: reversal.reversalReason,
        });
      }
    }
  }

  if (includeWallet) {
    const transactions = await Transaction.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(filter === "transactions" ? 100 : 50)
      .lean();

    for (const tx of transactions) {
      const isReversal = Boolean(tx.isReversal);
      if (filter === "reversals" && !isReversal) {
        continue;
      }

      events.push({
        id: `tx-${tx._id.toString()}`,
        kind:
          tx.type === "credit" && !isReversal
            ? "WALLET_RECHARGE"
            : "WALLET_DEDUCT",
        timestamp: tx.createdAt.toISOString(),
        title: tx.description,
        amount: tx.amount ?? tx.creditedAmount ?? tx.paidAmount,
        staffUsername: tx.staffUsername,
        reversalReason: tx.reversalReason,
        transactionId: tx._id.toString(),
        walletRechargeReversed: Boolean(tx.reversedAt),
        walletTransactionIsReversal: isReversal,
      });
    }
  }

  if (customer.notes?.trim() && filter === "all") {
    events.push({
      id: `note-${customer._id.toString()}`,
      kind: "NOTE",
      timestamp: customer.updatedAt.toISOString(),
      title: customer.notes,
      staffUsername: "—",
    });
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
