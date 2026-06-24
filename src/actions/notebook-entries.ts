"use server";

import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { getNotebookReversalReasonLabel } from "@/lib/constants/notebook-payments";
import type { NotebookReversalReasonKey } from "@/lib/constants/notebook-payments";
import { CHECKOUT_ELIGIBLE_STATUSES } from "@/lib/constants/notebook-payments";
import { CAFE_SECTION } from "@/lib/constants/counter-sections";
import {
  ACTIVE_TABLE_SESSION_STATUSES,
  OPEN_TABLE_SESSION_STATUSES,
  UNPAID_TABLE_SESSION_STATUSES,
  isPoolMiniTableId,
} from "@/lib/constants/table-sessions";
import {
  assignCounterEntryCustomerSchema,
  addCafeItemsSchema,
  cancelCounterEntrySchema,
  createNotebookEntrySchema,
  createQuickCounterEntrySchema,
  createRummyCounterEntrySchema,
  correctCounterEntrySchema,
  correctCafeEntrySchema,
  setEntryContributorsSchema,
  openTabSearchSchema,
  reverseNotebookEntrySchema,
} from "@/lib/validators/notebook";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { formatCurrency } from "@/lib/utils/format";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import { buildSnookerAmountCorrectionChanges } from "@/lib/utils/entry-corrections";
import {
  inferRateTypeFromStoredAmount,
  inferSnookerGameFromAmount,
  isRatedCounterEntryType,
  resolveCounterRateAmount,
} from "@/lib/constants/counter-rates";
import type { NotebookEntryCorrectionChangeDTO } from "@/types";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import { revalidateCounterPaths } from "@/lib/utils/revalidate-counter";
import Customer from "@/models/Customer";
import NotebookEntry from "@/models/NotebookEntry";
import TableSession from "@/models/TableSession";
import type { ICustomer } from "@/models/Customer";
import type { NotebookEntryDTO, OpenTabSummaryDTO, CustomerPendingItemDTO } from "@/types";
import type { CafeTableId } from "@/lib/constants/counter-sections";
import {
  buildTableOpenTabSummaries,
  buildSessionOpenTabSummaries,
  isSessionCheckoutEntry,
  isTableCheckoutEntry,
  toCustomerOpenTabSummary,
} from "@/lib/utils/checkout-tabs";
import {
  getPendingObligations,
  isEntryCheckoutEligible,
} from "@/lib/utils/entry-contributors";

export async function createQuickCounterEntry(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = createQuickCounterEntrySchema.safeParse({
    section: formData.get("section"),
    type: formData.get("type"),
    rateType: formData.get("rateType"),
    snookerGame: formData.get("snookerGame") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  if (parsed.data.section === CAFE_SECTION) {
    return failure("Cafe entries require a customer");
  }

  if (!isRatedCounterEntryType(parsed.data.type)) {
    return failure("Invalid entry type");
  }

  const amount = resolveCounterRateAmount({
    type: parsed.data.type,
    rateType: parsed.data.rateType,
    snookerGame: parsed.data.snookerGame,
  });

  if (amount === null) {
    return failure("Invalid rate selection");
  }

  await connectDB();

  if (
    isPoolMiniTableId(parsed.data.section) &&
    (parsed.data.type === "POOL" || parsed.data.type === "MINI")
  ) {
    const openSession = await TableSession.findOne({
      tableId: parsed.data.section,
      status: { $in: [...ACTIVE_TABLE_SESSION_STATUSES] },
    });
    if (openSession) {
      return failure(
        "This table uses session billing. Start, pause, or end the open session from the Pool & Mini counter."
      );
    }
  }

  const entry = await NotebookEntry.create({
    section: parsed.data.section,
    type: parsed.data.type,
    amount,
    snookerGame: parsed.data.snookerGame,
    rateType: parsed.data.rateType,
    customerName: "",
    phoneNumber: "",
    status: "PENDING",
    createdBy: authResult.session.user.username,
    createdByStaffId: authResult.session.user.id,
  });

  revalidateCounterPaths();

  return success(toNotebookEntryDTO(entry));
}

export async function createRummyCounterEntry(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = createRummyCounterEntrySchema.safeParse({
    section: formData.get("section"),
    playerCount: formData.get("playerCount"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const entry = await NotebookEntry.create({
    section: parsed.data.section,
    type: "RUMMY",
    amount: parsed.data.amount,
    playerCount: parsed.data.playerCount,
    customerName: "",
    phoneNumber: "",
    status: "PENDING",
    createdBy: authResult.session.user.username,
    createdByStaffId: authResult.session.user.id,
  });

  revalidateCounterPaths();

  return success(toNotebookEntryDTO(entry));
}

export async function correctCounterEntry(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = correctCounterEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    correctionReason: formData.get("correctionReason"),
    customerId: formData.get("customerId") || undefined,
    amount: formData.get("amount") || undefined,
    playerCount: formData.get("playerCount") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const entry = await NotebookEntry.findById(parsed.data.entryId);
  if (!entry) {
    return failure("Entry not found");
  }

  if (entry.section === CAFE_SECTION) {
    return failure("Use reversal for cafe entry corrections");
  }

  if (entry.status !== "PENDING") {
    return failure("Only pending entries can be corrected");
  }

  const changes: NotebookEntryCorrectionChangeDTO[] = [];

  if (parsed.data.customerId) {
    const nextCustomerId = parsed.data.customerId;
    const currentCustomerId = entry.customerId?.toString();

    if (nextCustomerId !== currentCustomerId) {
      if (!entry.assignedAt) {
        return failure(
          "Use Assign Customer for first assignment. Corrections apply only to already assigned entries."
        );
      }

      const customer = await Customer.findById(nextCustomerId);
      if (!customer || !customer.isActive) {
        return failure("Customer not found");
      }

      const fromLabel = entry.customerName;
      changes.push({
        field: "customer",
        fromLabel,
        toLabel: customer.name,
      });

      entry.customerId = customer._id;
      entry.customerName = customer.name;
      entry.phoneNumber = customer.phone;
    }
  }

  if (parsed.data.amount !== undefined && parsed.data.amount !== entry.amount) {
    if (entry.type === "SNOOKER") {
      changes.push(
        ...buildSnookerAmountCorrectionChanges(
          entry.type,
          entry.amount,
          parsed.data.amount
        )
      );
      const game =
        entry.snookerGame ?? inferSnookerGameFromAmount(parsed.data.amount);
      const rate = inferRateTypeFromStoredAmount(
        "SNOOKER",
        parsed.data.amount,
        game
      );
      if (game) entry.snookerGame = game;
      if (rate) entry.rateType = rate;
      entry.amount = parsed.data.amount;
    } else if (entry.type === "RUMMY") {
      changes.push({
        field: "amount",
        fromLabel: formatCurrency(entry.amount),
        toLabel: formatCurrency(parsed.data.amount),
      });
      entry.amount = parsed.data.amount;
    } else {
      return failure(
        "Amount corrections are only allowed for Snooker and Rummy entries"
      );
    }
  }

  if (
    entry.type === "RUMMY" &&
    parsed.data.playerCount !== undefined &&
    parsed.data.playerCount !== entry.playerCount
  ) {
    const fromCount = entry.playerCount ?? 0;
    changes.push({
      field: "playerCount",
      fromLabel: `${fromCount}P`,
      toLabel: `${parsed.data.playerCount}P`,
    });

    const fromTypeLabel = getEntryDisplayLabel({
      type: entry.type,
      amount: entry.amount,
      playerCount: fromCount,
      snookerGame: entry.snookerGame,
      rateType: entry.rateType,
    });
    const toTypeLabel = getEntryDisplayLabel({
      type: entry.type,
      amount: entry.amount,
      playerCount: parsed.data.playerCount,
      snookerGame: entry.snookerGame,
      rateType: entry.rateType,
    });
    if (fromTypeLabel !== toTypeLabel) {
      changes.push({
        field: "entryType",
        fromLabel: fromTypeLabel,
        toLabel: toTypeLabel,
      });
    }

    entry.playerCount = parsed.data.playerCount;
  }

  if (changes.length === 0) {
    return failure("No changes to save");
  }

  entry.corrections.push({
    changes,
    correctedBy: authResult.session.user.username,
    correctedByStaffId: new mongoose.Types.ObjectId(
      authResult.session.user.id
    ),
    correctedAt: new Date(),
    correctionReason: parsed.data.correctionReason.trim(),
  });

  await entry.save();

  revalidateCounterPaths(entry.customerId?.toString());

  return success(toNotebookEntryDTO(entry));
}

export async function correctCafeEntry(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = correctCafeEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    correctionReason: formData.get("correctionReason"),
    quantity: formData.get("quantity") || undefined,
    amount: formData.get("amount") || undefined,
    itemNote: formData.get("itemNote") ?? undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const entry = await NotebookEntry.findById(parsed.data.entryId);
  if (!entry) {
    return failure("Entry not found");
  }

  if (entry.section !== CAFE_SECTION) {
    return failure("Only cafe entries can be corrected here");
  }

  if (entry.status !== "PENDING") {
    return failure("Only pending entries can be corrected");
  }

  const changes: NotebookEntryCorrectionChangeDTO[] = [];

  if (
    parsed.data.quantity !== undefined &&
    parsed.data.quantity !== (entry.quantity ?? 1)
  ) {
    if (entry.type === "FOOD") {
      return failure("Use amount correction for food items");
    }

    const fromQty = entry.quantity ?? 1;
    changes.push({
      field: "quantity",
      fromLabel: `×${fromQty}`,
      toLabel: `×${parsed.data.quantity}`,
    });
    entry.quantity = parsed.data.quantity;
    const unitPrice = entry.unitPrice ?? entry.amount / fromQty;
    entry.unitPrice = unitPrice;
    entry.amount = unitPrice * parsed.data.quantity;
  }

  if (parsed.data.amount !== undefined && parsed.data.amount !== entry.amount) {
    changes.push({
      field: "amount",
      fromLabel: formatCurrency(entry.amount),
      toLabel: formatCurrency(parsed.data.amount),
    });
    entry.amount = parsed.data.amount;
    if (entry.type === "FOOD") {
      entry.unitPrice = parsed.data.amount;
      entry.quantity = 1;
    }
  }

  if (parsed.data.itemNote !== undefined) {
    const fromNote = entry.itemNote?.trim() || "(none)";
    const toNote = parsed.data.itemNote.trim() || "(none)";
    if (fromNote !== toNote) {
      if (entry.type !== "FOOD") {
        return failure("Notes apply only to food items");
      }
      changes.push({
        field: "itemNote",
        fromLabel: fromNote,
        toLabel: toNote,
      });
      entry.itemNote = parsed.data.itemNote.trim();
    }
  }

  if (changes.length === 0) {
    return failure("No changes to save");
  }

  entry.corrections.push({
    changes,
    correctedBy: authResult.session.user.username,
    correctedByStaffId: new mongoose.Types.ObjectId(
      authResult.session.user.id
    ),
    correctedAt: new Date(),
    correctionReason: parsed.data.correctionReason.trim(),
  });

  await entry.save();

  revalidateCounterPaths(entry.customerId?.toString());

  return success(toNotebookEntryDTO(entry));
}

/** @deprecated Use correctCounterEntry with correctionReason */
export async function updateRummyCounterEntry(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  formData.set(
    "correctionReason",
    formData.get("correctionReason")?.toString() || "Entry updated"
  );
  return correctCounterEntry(formData);
}

export async function createNotebookEntry(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = createNotebookEntrySchema.safeParse({
    section: formData.get("section"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    customerId: formData.get("customerId"),
    rateType: formData.get("rateType") || undefined,
    snookerGame: formData.get("snookerGame") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  if (isRatedCounterEntryType(parsed.data.type)) {
    const expectedAmount = resolveCounterRateAmount({
      type: parsed.data.type,
      rateType: parsed.data.rateType!,
      snookerGame: parsed.data.snookerGame,
    });
    if (expectedAmount === null || expectedAmount !== parsed.data.amount) {
      return failure("Amount does not match selected rate");
    }
  }

  await connectDB();

  const customer = await Customer.findById(parsed.data.customerId);
  if (!customer || !customer.isActive) {
    return failure("Customer not found");
  }

  const entry = await NotebookEntry.create({
    section: parsed.data.section,
    type: parsed.data.type,
    amount: parsed.data.amount,
    snookerGame: parsed.data.snookerGame,
    rateType: parsed.data.rateType,
    customerId: customer._id,
    customerName: customer.name,
    phoneNumber: customer.phone,
    status: "PENDING",
    createdBy: authResult.session.user.username,
    createdByStaffId: authResult.session.user.id,
  });

  revalidateCounterPaths(customer._id.toString());

  return success(toNotebookEntryDTO(entry));
}

export async function assignCounterEntryCustomer(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = assignCounterEntryCustomerSchema.safeParse({
    entryId: formData.get("entryId"),
    customerId: formData.get("customerId"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const entry = await NotebookEntry.findById(parsed.data.entryId);
  if (!entry) {
    return failure("Entry not found");
  }

  if (entry.status !== "PENDING") {
    return failure("Only pending entries can be assigned");
  }

  if (entry.customerId) {
    return failure("Entry already has a customer");
  }

  const customer = await Customer.findById(parsed.data.customerId);
  if (!customer || !customer.isActive) {
    return failure("Customer not found");
  }

  entry.customerId = customer._id;
  entry.customerName = customer.name;
  entry.phoneNumber = customer.phone;
  entry.assignedAt = new Date();
  entry.assignedBy = authResult.session.user.username;
  await entry.save();

  revalidateCounterPaths(customer._id.toString());

  return success(toNotebookEntryDTO(entry));
}

export async function setEntryContributors(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  let contributorsInput: { customerId: string; amount: number }[] = [];
  try {
    contributorsInput = JSON.parse(String(formData.get("contributors") ?? "[]"));
  } catch {
    return failure("Invalid contributors");
  }

  const parsed = setEntryContributorsSchema.safeParse({
    entryId: formData.get("entryId"),
    contributors: contributorsInput,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const entry = await NotebookEntry.findById(parsed.data.entryId);
  if (!entry) {
    return failure("Entry not found");
  }

  if (entry.status !== "PENDING") {
    return failure("Only pending entries can have contributors assigned");
  }

  const total = parsed.data.contributors.reduce((sum, row) => sum + row.amount, 0);
  if (total !== entry.amount) {
    return failure(
      `Contributor total must equal entry total (${entry.amount}). Remaining: ${entry.amount - total}`
    );
  }

  const contributorDocs = [];
  for (const row of parsed.data.contributors) {
    const customer = await Customer.findById(row.customerId);
    if (!customer || !customer.isActive) {
      return failure("Customer not found");
    }
    contributorDocs.push({
      customerId: customer._id,
      customerName: customer.name,
      amount: row.amount,
      status: "PENDING" as const,
    });
  }

  entry.contributors = contributorDocs;
  entry.customerId = undefined;
  entry.customerName = "";
  entry.phoneNumber = "";
  entry.assignedAt = undefined;
  entry.assignedBy = undefined;
  await entry.save();

  revalidateCounterPaths();
  for (const row of contributorDocs) {
    revalidateCounterPaths(row.customerId.toString());
  }

  return success(toNotebookEntryDTO(entry));
}

export async function getOpenTabs(
  searchParams: Record<string, string | string[] | undefined> = {}
): Promise<OpenTabSummaryDTO[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  const parsed = openTabSearchSchema.safeParse({
    query: typeof searchParams.q === "string" ? searchParams.q : undefined,
  });

  const query = parsed.success ? parsed.data.query?.trim() : undefined;

  await connectDB();

  const entries = await NotebookEntry.find({
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
  }).lean();

  const entryDtos = entries
    .map((entry) => toNotebookEntryDTO(entry))
    .filter((dto) => isEntryCheckoutEligible(dto));

  const tabMap = new Map<
    string,
    { pendingAmount: number; pendingCount: number }
  >();

  for (const dto of entryDtos) {
    for (const obligation of getPendingObligations(dto)) {
      const existing = tabMap.get(obligation.customerId) ?? {
        pendingAmount: 0,
        pendingCount: 0,
      };
      existing.pendingAmount += obligation.amount;
      existing.pendingCount += 1;
      tabMap.set(obligation.customerId, existing);
    }
  }

  const tableTabs = buildTableOpenTabSummaries(entryDtos);

  const checkoutSessions = await TableSession.find({
    status: { $in: ["STOPPED", "ENDED", "CHECKOUT_PENDING"] },
  }).lean();

  const sessionTabs = buildSessionOpenTabSummaries({
    sessions: checkoutSessions.map((session) => ({
      id: session._id.toString(),
      sessionNumber: session.sessionNumber,
      tableSessionNumber:
        session.tableSessionNumber ?? session.sessionNumber,
      tableId: session.tableId,
      gameChargeAmount: session.gameChargeAmount,
      startedAt: session.startedAt.toISOString(),
    })),
    entries: entryDtos,
  });

  if (tabMap.size === 0 && tableTabs.length === 0 && sessionTabs.length === 0) {
    return [];
  }

  let customerTabs: OpenTabSummaryDTO[] = [];

  if (tabMap.size > 0) {
    const customers = await Customer.find({
      _id: { $in: [...tabMap.keys()] },
      isActive: true,
    }).lean();

    customerTabs = customers
      .map((customer) => {
        const totals = tabMap.get(customer._id.toString());
        if (!totals) return null;
        return toCustomerOpenTabSummary({
          customerId: customer._id.toString(),
          customerName: customer.name,
          phoneNumber: customer.phone,
          cardId: customer.cardId,
          walletEnabled: customer.walletEnabled ?? true,
          pendingAmount: totals.pendingAmount,
          pendingCount: totals.pendingCount,
        });
      })
      .filter((row): row is OpenTabSummaryDTO => row !== null);
  }

  let results: OpenTabSummaryDTO[] = [
    ...sessionTabs,
    ...tableTabs,
    ...customerTabs,
  ].sort((a, b) => b.pendingAmount - a.pendingAmount);

  if (query) {
    const q = query.toLowerCase();
    results = results.filter((row) => {
      if (row.kind === "session") {
        return (
          row.displayLabel.toLowerCase().includes(q) ||
          row.tableName.toLowerCase().includes(q) ||
          String(row.tableSessionNumber).includes(q)
        );
      }
      if (row.kind === "table") {
        return row.tableName.toLowerCase().includes(q);
      }
      return (
        row.customerName.toLowerCase().includes(q) ||
        row.phoneNumber.includes(q) ||
        row.cardId.toLowerCase().includes(q)
      );
    });
  }

  return results;
}

export async function getCustomerPendingItems(
  customerId: string
): Promise<CustomerPendingItemDTO[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const entries = await NotebookEntry.find({
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
    $or: [
      { customerId, $or: [{ contributors: { $size: 0 } }, { contributors: { $exists: false } }] },
      { "contributors.customerId": customerId },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();

  const items: CustomerPendingItemDTO[] = [];

  for (const entry of entries) {
    const dto = toNotebookEntryDTO(entry);
    if (!isEntryCheckoutEligible(dto)) continue;

    for (const obligation of getPendingObligations(dto)) {
      if (obligation.customerId !== customerId) continue;
      items.push({
        entry: dto,
        contributionAmount: obligation.amount,
        contributorCustomerId: customerId,
      });
    }
  }

  return items;
}

export async function getSessionPendingItems(
  sessionId: string
): Promise<CustomerPendingItemDTO[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const entries = await NotebookEntry.find({
    sessionId,
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
  })
    .sort({ createdAt: 1 })
    .lean();

  const items: CustomerPendingItemDTO[] = [];

  for (const entry of entries) {
    const dto = toNotebookEntryDTO(entry);
    if (!isSessionCheckoutEntry(dto, sessionId)) continue;
    if (dto.customerId) continue;

    items.push({
      entry: dto,
      contributionAmount: dto.amount,
      contributorCustomerId: "",
    });
  }

  return items;
}

export async function getTablePendingItems(
  tableId: CafeTableId
): Promise<CustomerPendingItemDTO[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const entries = await NotebookEntry.find({
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
  })
    .sort({ createdAt: 1 })
    .lean();

  const items: CustomerPendingItemDTO[] = [];

  for (const entry of entries) {
    const dto = toNotebookEntryDTO(entry);
    if (!isTableCheckoutEntry(dto, tableId)) continue;

    items.push({
      entry: dto,
      contributionAmount: dto.amount,
      contributorCustomerId: "",
    });
  }

  return items;
}

export async function getCustomerPendingEntries(
  customerId: string
): Promise<NotebookEntryDTO[]> {
  const items = await getCustomerPendingItems(customerId);
  return items.map((item) => item.entry);
}

export async function getCustomerTabEntries(
  customerId: string
): Promise<NotebookEntryDTO[]> {
  return getCustomerPendingEntries(customerId);
}

export async function reverseNotebookEntry(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_REVERSE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = reverseNotebookEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    reversalReason: formData.get("reversalReason"),
    reversalReasonOther: formData.get("reversalReasonOther") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const entry = await NotebookEntry.findById(parsed.data.entryId);
  if (!entry) {
    return failure("Entry not found");
  }

  if (entry.section !== CAFE_SECTION) {
    return failure("Use cancel for counter entries. Cafe entries use reversal.");
  }

  if (entry.status !== "PENDING") {
    return failure("Only pending entries can be reversed");
  }

  const reasonLabel = getNotebookReversalReasonLabel(
    parsed.data.reversalReason as NotebookReversalReasonKey,
    parsed.data.reversalReasonOther
  );

  entry.status = "REVERSED";
  entry.reversedAt = new Date();
  entry.reversedBy = authResult.session.user.username;
  entry.reversalReason = reasonLabel;
  await entry.save();

  revalidateCounterPaths(entry.customerId?.toString());

  return success(toNotebookEntryDTO(entry));
}

export async function cancelCounterEntry(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_REVERSE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = cancelCounterEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    cancellationReason: formData.get("cancellationReason"),
    cancellationReasonOther: formData.get("cancellationReasonOther") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const entry = await NotebookEntry.findById(parsed.data.entryId);
  if (!entry) {
    return failure("Entry not found");
  }

  if (entry.section === CAFE_SECTION) {
    return failure("Cafe entries cannot be cancelled. Use reversal instead.");
  }

  if (entry.status !== "PENDING") {
    return failure("Only pending entries can be cancelled");
  }

  const reasonLabel = getNotebookReversalReasonLabel(
    parsed.data.cancellationReason as NotebookReversalReasonKey,
    parsed.data.cancellationReasonOther
  );

  entry.status = "CANCELLED";
  entry.cancelledAt = new Date();
  entry.cancelledBy = authResult.session.user.username;
  entry.cancellationReason = reasonLabel;
  await entry.save();

  revalidateCounterPaths(entry.customerId?.toString());

  return success(toNotebookEntryDTO(entry));
}

function getDayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function addCafeItems(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO[]>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const itemsRaw = formData.get("items");
  let items: {
    type: string;
    quantity: number;
    unitPrice: number;
    note?: string;
  }[] = [];
  try {
    items = JSON.parse(String(itemsRaw));
  } catch {
    return failure("Invalid items");
  }

  const tableIdRaw = formData.get("tableId");
  const sessionIdRaw = formData.get("sessionId");
  const parsed = addCafeItemsSchema.safeParse({
    customerId: formData.get("customerId") || undefined,
    tableId: tableIdRaw ? String(tableIdRaw) : undefined,
    sessionId: sessionIdRaw ? String(sessionIdRaw) : undefined,
    items,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const isTable = Boolean(parsed.data.tableId);
  let customer: ICustomer | null = null;

  if (parsed.data.customerId) {
    customer = await Customer.findById(parsed.data.customerId);
    if (!customer || !customer.isActive) {
      return failure("Customer not found");
    }
  }

  const { start, end } = getDayBounds();
  const results: NotebookEntryDTO[] = [];

  let tableSessionId: import("mongoose").Types.ObjectId | undefined;
  if (isTable && parsed.data.tableId && isPoolMiniTableId(parsed.data.tableId)) {
    if (parsed.data.sessionId) {
      const manualSession = await TableSession.findById(parsed.data.sessionId);
      if (
        !manualSession ||
        manualSession.tableId !== parsed.data.tableId ||
        !(OPEN_TABLE_SESSION_STATUSES as readonly string[]).includes(
          manualSession.status
        )
      ) {
        return failure("Session not found for this table");
      }
      tableSessionId = manualSession._id;
    } else {
      const openSession = await TableSession.findOne({
        tableId: parsed.data.tableId,
        status: { $in: [...ACTIVE_TABLE_SESSION_STATUSES] },
      }).sort({ startedAt: -1 });
      if (
        openSession &&
        (openSession.status === "ACTIVE" || openSession.status === "PAUSED")
      ) {
        tableSessionId = openSession._id;
      }
    }
  }

  for (const item of parsed.data.items) {
    if (item.type === "FOOD" && !item.note?.trim()) {
      return failure("Food items require a note");
    }

    const mergeQuery: Record<string, unknown> = {
      section: CAFE_SECTION,
      type: item.type,
      status: "PENDING",
      createdAt: { $gte: start, $lte: end },
    };

    if (isTable) {
      mergeQuery.tableId = parsed.data.tableId;
      mergeQuery.customerId = { $exists: false };
      if (tableSessionId) {
        mergeQuery.sessionId = tableSessionId;
      }
    } else {
      mergeQuery.customerId = customer!._id;
      mergeQuery.tableId = { $exists: false };
    }

    if (item.type === "FOOD") {
      mergeQuery.itemNote = item.note?.trim() ?? "";
      mergeQuery.unitPrice = item.unitPrice;
    }

    const existing = await NotebookEntry.findOne(mergeQuery);

    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + item.quantity;
      existing.unitPrice = item.unitPrice;
      existing.amount = existing.unitPrice * existing.quantity;
      if (item.type === "FOOD" && item.note?.trim()) {
        existing.itemNote = item.note.trim();
      }
      await existing.save();
      results.push(toNotebookEntryDTO(existing));
    } else {
      const entry = await NotebookEntry.create({
        section: CAFE_SECTION,
        type: item.type,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.unitPrice * item.quantity,
        itemNote: item.type === "FOOD" ? item.note?.trim() ?? "" : "",
        ...(isTable
          ? {
              tableId: parsed.data.tableId,
              ...(tableSessionId ? { sessionId: tableSessionId } : {}),
              customerName: "",
              phoneNumber: "",
            }
          : {
              customerId: customer!._id,
              customerName: customer!.name,
              phoneNumber: customer!.phone,
            }),
        status: "PENDING",
        createdBy: authResult.session.user.username,
        createdByStaffId: authResult.session.user.id,
      });
      results.push(toNotebookEntryDTO(entry));
    }
  }

  revalidateCounterPaths(customer?._id?.toString());
  return success(results);
}

/** @deprecated Use addCafeItems */
export async function addCafeItemsToCustomer(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO[]>> {
  return addCafeItems(formData);
}
