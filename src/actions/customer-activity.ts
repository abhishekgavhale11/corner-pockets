"use server";

import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { getEntryDisplayLabel, getRummyActivityLabel } from "@/lib/utils/notebook-entry-label";
import { getAggregatedCorrections } from "@/lib/utils/entry-corrections";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { formatCurrency } from "@/lib/utils/format";
import { customerActivityFilterSchema } from "@/lib/validators/customer";
import type { CustomerActivityEventDTO, NotebookEntryDTO } from "@/types";
import Customer from "@/models/Customer";
import NotebookEntry from "@/models/NotebookEntry";
import Transaction from "@/models/Transaction";


function payLaterBalanceAtDismiss(
  entry: Pick<
    NotebookEntryDTO,
    "counterBalanceAmount" | "counterPaidAmount" | "amount"
  >
): number {
  if (entry.counterBalanceAmount != null) {
    return entry.counterBalanceAmount;
  }
  if (entry.counterPaidAmount != null) {
    return Math.max(0, entry.amount - entry.counterPaidAmount);
  }
  return 0;
}

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
  const includeWallet =
    filter === "all" ||
    filter === "transactions" ||
    filter === "reversals";

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

    const dismissGroups = new Map<
      string,
      {
        timestamp: Date;
        staffUsername: string;
        total: number;
        firstEntryId: string;
      }
    >();

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

      if (entry.checkoutDismissedAt) {
        const isCustomerEntry =
          entry.customerId?.toString() === customerId ||
          entry.contributors?.some(
            (row) => row.customerId.toString() === customerId
          );
        if (isCustomerEntry) {
          const balanceAtDismiss = payLaterBalanceAtDismiss(entryDto);
          if (balanceAtDismiss > 0) {
            const dismissedAt = entry.checkoutDismissedAt;
            const staffUsername =
              entry.checkoutDismissedBy ?? entry.assignedBy ?? entry.createdBy;
            const groupKey = `${dismissedAt.getTime()}::${staffUsername}`;
            const existing = dismissGroups.get(groupKey);
            if (existing) {
              existing.total += balanceAtDismiss;
            } else {
              dismissGroups.set(groupKey, {
                timestamp: dismissedAt,
                staffUsername,
                total: balanceAtDismiss,
                firstEntryId: entry._id.toString(),
              });
            }
          }
        }
      }
    }

    for (const group of dismissGroups.values()) {
      events.push({
        id: `outstanding-created-${group.firstEntryId}-${group.timestamp.getTime()}`,
        kind: "BALANCE_RECORDED",
        timestamp: group.timestamp.toISOString(),
        title: "Due Converted to Outstanding",
        amount: group.total,
        staffUsername: group.staffUsername,
      });
    }
  }

  // Settlement / settlement-reversal feed removed with Financial Engine V1.

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
