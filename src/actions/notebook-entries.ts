"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { getNotebookReversalReasonLabel } from "@/lib/constants/notebook-payments";
import type { NotebookReversalReasonKey } from "@/lib/constants/notebook-payments";
import { CHECKOUT_ELIGIBLE_STATUSES } from "@/lib/constants/notebook-payments";
import { CAFE_SECTION, isBigSnookerSection } from "@/lib/constants/counter-sections";
import {
  ACTIVE_TABLE_SESSION_STATUSES,
  OPEN_TABLE_SESSION_STATUSES,
  UNPAID_TABLE_SESSION_STATUSES,
  isPoolMiniTableId,
} from "@/lib/constants/table-sessions";
import {
  assignCounterEntryCustomerSchema,
  assignCheckoutBillToCustomerSchema,
  dismissCheckoutBillSchema,
  addCafeItemsSchema,
  cancelCounterEntrySchema,
  createNotebookEntrySchema,
  createQuickCounterEntrySchema,
  createRummyCounterEntrySchema,
  createSnookerFrameEntrySchema,
  updateSnookerFrameEntrySchema,
  correctCounterEntrySchema,
  correctCafeEntrySchema,
  setEntryContributorsSchema,
  openTabSearchSchema,
  reverseNotebookEntrySchema,
} from "@/lib/validators/notebook";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { formatCurrency } from "@/lib/utils/format";
import { applyTimeToDate } from "@/lib/utils/format-time";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import { buildSnookerAmountCorrectionChanges } from "@/lib/utils/entry-corrections";
import { buildCustomerTodayGlance } from "@/lib/utils/customer-today-glance";
import {
  inferRateTypeFromStoredAmount,
  inferSnookerGameFromAmount,
  isRatedCounterEntryType,
  resolveCounterRateAmount,
} from "@/lib/constants/counter-rates";
import type { NotebookEntryCorrectionChangeDTO } from "@/types";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import { revalidateCounterPaths, revalidateCustomerFinancials } from "@/lib/utils/revalidate-counter";
import { parseCheckoutCustomerId } from "@/lib/utils/checkout-navigation";
import Customer from "@/models/Customer";
import NotebookEntry from "@/models/NotebookEntry";
import TableSession from "@/models/TableSession";
import { closeTableSessionAfterSettlement, ensureSessionGameEntryForCheckout } from "@/actions/table-sessions";
import type { ICustomer } from "@/models/Customer";
import type { NotebookEntryDTO, OpenTabSummaryDTO, CustomerPendingItemDTO, CustomerOpenTabSummaryDTO, CustomerTodayGlanceDTO } from "@/types";
import type { CafeTableId } from "@/lib/constants/counter-sections";
import {
  buildTableOpenTabSummaries,
  buildSessionOpenTabSummaries,
  isTableCheckoutEntry,
  toCustomerOpenTabSummary,
} from "@/lib/utils/checkout-tabs";
import {
  entryAmountRemaining,
  entryHasContributors,
  getCheckoutQueueObligations,
  getLedgerObligations,
  isEntryCheckoutEligible,
  isSessionPayableEntry,
  sessionEntryAmountRemaining,
} from "@/lib/utils/entry-contributors";
import { freezeCounterPaySnapshot, ensureCounterPaySnapshot } from "@/lib/utils/freeze-counter-pay-snapshot";
import { reconcileEntryPaymentFields } from "@/lib/wallet/reconcile-entry-payments";
import { linkEntryToActiveVisitBill, linkEntriesToActiveVisitBill } from "@/lib/visit-bill/attach-entry";
import { linkSplitEntryToContributorVisits } from "@/lib/visit-bill/link-split-entry";
import { getCustomerBillSlice } from "@/lib/visit-bill/customer-bill-slice";

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

export async function createSnookerFrameEntry(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = createSnookerFrameEntrySchema.safeParse({
    section: formData.get("section"),
    frameType: formData.get("frameType"),
    amount: formData.get("amount"),
    playerCount: formData.get("playerCount") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const { section, frameType, amount, playerCount } = parsed.data;

  if (frameType === "RUMMY") {
    const entry = await NotebookEntry.create({
      section,
      type: "RUMMY",
      amount,
      playerCount,
      customerName: "",
      phoneNumber: "",
      status: "PENDING",
      createdBy: authResult.session.user.username,
      createdByStaffId: authResult.session.user.id,
    });

    revalidateCounterPaths();
    return success(toNotebookEntryDTO(entry));
  }

  const rateType = inferRateTypeFromStoredAmount(
    "SNOOKER",
    amount,
    frameType
  );

  const entry = await NotebookEntry.create({
    section,
    type: "SNOOKER",
    amount,
    snookerGame: frameType,
    rateType,
    customerName: "",
    phoneNumber: "",
    status: "PENDING",
    createdBy: authResult.session.user.username,
    createdByStaffId: authResult.session.user.id,
  });

  revalidateCounterPaths();
  return success(toNotebookEntryDTO(entry));
}

export async function updateSnookerFrameEntry(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = updateSnookerFrameEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    frameType: formData.get("frameType"),
    amount: formData.get("amount"),
    playerCount: formData.get("playerCount") || undefined,
    entryTime: formData.get("entryTime"),
    customerId: formData.get("customerId") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const entry = await NotebookEntry.findById(parsed.data.entryId);
  if (!entry) {
    return failure("Entry not found");
  }

  if (!isBigSnookerSection(entry.section)) {
    return failure("Only Big Snooker frame entries can be edited here");
  }

  if (entry.status !== "PENDING" && entry.status !== "PAID") {
    return failure("Only pending or paid entries can be edited");
  }

  if (entry.type !== "SNOOKER" && entry.type !== "RUMMY") {
    return failure("Only frame entries can be edited");
  }

  const hasContributors = Boolean(entry.contributors && entry.contributors.length > 0);

  const { frameType, amount, playerCount, entryTime, customerId } = parsed.data;

  if (frameType === "RUMMY") {
    entry.type = "RUMMY";
    entry.amount = amount;
    entry.playerCount = playerCount;
    entry.snookerGame = undefined;
    entry.rateType = undefined;
  } else {
    entry.type = "SNOOKER";
    entry.amount = amount;
    entry.snookerGame = frameType;
    entry.rateType =
      inferRateTypeFromStoredAmount("SNOOKER", amount, frameType) ?? undefined;
    entry.playerCount = undefined;
  }

  entry.createdAt = applyTimeToDate(entry.createdAt, entryTime);
  entry.markModified("createdAt");

  if (!hasContributors && customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer || !customer.isActive) {
      return failure("Customer not found");
    }

    const currentCustomerId = entry.customerId?.toString();
    if (currentCustomerId !== customerId) {
      entry.customerId = customer._id;
      entry.customerName = customer.name;
      entry.phoneNumber = customer.phone;
      if (!entry.assignedAt) {
        entry.assignedAt = new Date();
        entry.assignedBy = authResult.session.user.username;
      }
    }
  }

  await entry.save();

  revalidateCounterPaths(entry.customerId?.toString());

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

  await linkEntryToActiveVisitBill(entry, {
    username: authResult.session.user.username,
    staffId: authResult.session.user.id,
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
  await linkEntryToActiveVisitBill(entry, {
    username: authResult.session.user.username,
    staffId: authResult.session.user.id,
  });

  revalidateCounterPaths(customer._id.toString());

  return success(toNotebookEntryDTO(entry));
}

export async function assignCheckoutBillToCustomer(
  formData: FormData
): Promise<ActionResult<{ assignedCount: number }>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  let entryIds: string[] = [];
  try {
    entryIds = JSON.parse(String(formData.get("entryIds") ?? "[]"));
  } catch {
    return failure("Invalid bill lines");
  }

  const parsed = assignCheckoutBillToCustomerSchema.safeParse({
    customerId: formData.get("customerId"),
    entryIds: entryIds.length > 0 ? entryIds : undefined,
    sessionId: formData.get("sessionId") || undefined,
    tableId: formData.get("tableId") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const customer = await Customer.findById(parsed.data.customerId);
  if (!customer || !customer.isActive) {
    return failure("Customer not found");
  }

  let resolvedEntryIds = parsed.data.entryIds ?? [];

  if (resolvedEntryIds.length === 0 && parsed.data.sessionId) {
    await ensureSessionGameEntryForCheckout(parsed.data.sessionId, {
      id: authResult.session.user.id,
      username: authResult.session.user.username,
    });
    const sessionEntries = await NotebookEntry.find({
      sessionId: parsed.data.sessionId,
      status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
    }).lean();
    resolvedEntryIds = sessionEntries
      .map((entry) => toNotebookEntryDTO(entry))
      .filter((dto) => isSessionPayableEntry(dto, parsed.data.sessionId!))
      .map((dto) => dto.id);
  }

  if (resolvedEntryIds.length === 0 && parsed.data.tableId) {
    const tableId = parsed.data.tableId as CafeTableId;
    const tableEntries = await NotebookEntry.find({
      status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
    })
      .sort({ createdAt: 1 })
      .lean();
    resolvedEntryIds = tableEntries
      .map((entry) => toNotebookEntryDTO(entry))
      .filter((dto) => isTableCheckoutEntry(dto, tableId))
      .map((dto) => dto.id);
  }

  if (resolvedEntryIds.length === 0) {
    return failure("No payable lines on this bill. Please refresh and try again.");
  }

  const entries = await NotebookEntry.find({
    _id: { $in: resolvedEntryIds },
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
  });

  if (entries.length !== resolvedEntryIds.length) {
    return failure(
      "One or more bill lines are no longer open. Please refresh and try again."
    );
  }

  const assignedAt = new Date();
  const assignedBy = authResult.session.user.username;
  let assignedCount = 0;

  for (const entry of entries) {
    if (entryHasContributors({ contributors: entry.contributors })) {
      return failure("Split bills must be settled from the counter first");
    }
    if (entry.customerId) {
      if (entry.customerId.toString() !== parsed.data.customerId) {
        return failure("One or more bill lines belong to another customer");
      }
    } else {
      entry.customerId = customer._id;
      entry.customerName = customer.name;
      entry.phoneNumber = customer.phone;
      entry.assignedAt = assignedAt;
      entry.assignedBy = assignedBy;
      assignedCount += 1;
    }

    if (!entry.assignedAt) {
      entry.assignedAt = assignedAt;
      entry.assignedBy = assignedBy;
    }
    if (!entry.checkoutDismissedAt) {
      entry.checkoutDismissedAt = assignedAt;
      entry.checkoutDismissedBy = assignedBy;
      freezeCounterPaySnapshot(entry);
    }
  }

  await linkEntriesToActiveVisitBill(entries, {
    username: authResult.session.user.username,
    staffId: authResult.session.user.id,
  });

  await Promise.all(entries.map((entry) => entry.save()));

  await reconcileEntryPaymentFields(resolvedEntryIds);

  const dismissedEntries = await NotebookEntry.find({
    _id: { $in: resolvedEntryIds },
    checkoutDismissedAt: { $exists: true, $ne: null },
  });
  for (const entry of dismissedEntries) {
    if (ensureCounterPaySnapshot(entry)) {
      await entry.save();
    }
  }

  if (parsed.data.sessionId) {
    const session = await TableSession.findById(parsed.data.sessionId);
    if (session) {
      const alreadyAssigned = session.assignedCustomers.some(
        (row) => row.customerId.toString() === parsed.data.customerId
      );
      if (!alreadyAssigned) {
        session.assignedCustomers.push({
          customerId: customer._id,
          customerName: customer.name,
        });
        await session.save();
      }
    }

    const allAssignedToCustomer = entries.every(
      (entry) => entry.customerId?.toString() === parsed.data.customerId
    );
    if (assignedCount > 0 || allAssignedToCustomer) {
      await closeTableSessionAfterSettlement(parsed.data.sessionId);
    }
  }

  revalidateCustomerFinancials(customer._id.toString());
  revalidatePath("/checkout");

  if (assignedCount === 0) {
    const allAssignedToCustomer = entries.every(
      (entry) => entry.customerId?.toString() === parsed.data.customerId
    );
    if (!allAssignedToCustomer) {
      return failure(
        "Could not add to balance. Select a customer and try again."
      );
    }
  }

  return success({ assignedCount: assignedCount || entries.length });
}

export async function dismissCheckoutBill(
  formData: FormData
): Promise<ActionResult<{ dismissedCount: number }>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  let entryIds: string[] = [];
  try {
    entryIds = JSON.parse(String(formData.get("entryIds") ?? "[]"));
  } catch {
    return failure("Invalid bill lines");
  }

  const parsed = dismissCheckoutBillSchema.safeParse({
    customerId: formData.get("customerId"),
    entryIds: entryIds.length > 0 ? entryIds : undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const customer = await Customer.findById(parsed.data.customerId);
  if (!customer || !customer.isActive) {
    return failure("Customer not found");
  }

  let resolvedEntryIds = parsed.data.entryIds ?? [];

  if (resolvedEntryIds.length === 0) {
    const pendingItems = await getCustomerPendingItems(parsed.data.customerId);
    resolvedEntryIds = pendingItems
      .filter((item) => !item.entry.checkoutDismissedAt)
      .map((item) => item.entry.id);
  }

  if (resolvedEntryIds.length === 0) {
    return failure("No open bill lines to dismiss");
  }

  const entries = await NotebookEntry.find({
    _id: { $in: resolvedEntryIds },
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
  });

  if (entries.length !== resolvedEntryIds.length) {
    return failure(
      "One or more bill lines are no longer open. Please refresh and try again."
    );
  }

  const dismissedAt = new Date();
  const dismissedBy = authResult.session.user.username;
  let dismissedCount = 0;

  for (const entry of entries) {
    const dto = toNotebookEntryDTO(entry);
    const owesCustomer = getCheckoutQueueObligations(dto).some(
      (obligation) => obligation.customerId === parsed.data.customerId
    );
    if (!owesCustomer) {
      return failure("One or more bill lines belong to another customer");
    }

    if (!entry.assignedAt && entry.customerId) {
      entry.assignedAt = dismissedAt;
      entry.assignedBy = dismissedBy;
    }

    if (!entry.checkoutDismissedAt) {
      entry.checkoutDismissedAt = dismissedAt;
      entry.checkoutDismissedBy = dismissedBy;
      freezeCounterPaySnapshot(entry);
      dismissedCount += 1;
    }

    await entry.save();
  }

  await reconcileEntryPaymentFields(resolvedEntryIds);
  revalidateCustomerFinancials(customer._id.toString());
  revalidatePath("/checkout");

  return success({ dismissedCount });
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

  if (parsed.data.contributors.length === 0) {
    entry.contributors = [];
    entry.customerId = undefined;
    entry.customerName = "";
    entry.phoneNumber = "";
    entry.assignedAt = undefined;
    entry.assignedBy = undefined;
    await entry.save();

    revalidateCounterPaths();
    return success(toNotebookEntryDTO(entry));
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
  entry.visitId = undefined;
  entry.billId = undefined;
  await entry.save();

  await linkSplitEntryToContributorVisits(entry, {
    username: authResult.session.user.username,
    staffId: authResult.session.user.id,
  });

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
  const forceCustomerId = parseCheckoutCustomerId(searchParams);

  await connectDB();

  const entries = await NotebookEntry.find({
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
  }).lean();

  const allEntryDtos = entries.map((entry) => toNotebookEntryDTO(entry));

  const tabMap = new Map<
    string,
    { pendingAmount: number; pendingCount: number }
  >();

  for (const dto of allEntryDtos) {
    for (const obligation of getLedgerObligations(dto)) {
      if (obligation.amount <= 0) continue;
      const existing = tabMap.get(obligation.customerId) ?? {
        pendingAmount: 0,
        pendingCount: 0,
      };
      existing.pendingAmount += obligation.amount;
      existing.pendingCount += 1;
      tabMap.set(obligation.customerId, existing);
    }
  }

  const tableTabs = buildTableOpenTabSummaries(allEntryDtos);

  const checkoutSessions = await TableSession.find({
    status: { $in: ["STOPPED", "ENDED", "CHECKOUT_PENDING"] },
  }).lean();

  const payableSessions = checkoutSessions.filter((session) =>
    isPoolMiniTableId(session.tableId)
  );

  const sessionTabs = buildSessionOpenTabSummaries({
    sessions: payableSessions.map((session) => ({
      id: session._id.toString(),
      sessionNumber: session.sessionNumber,
      tableSessionNumber:
        session.tableSessionNumber ?? session.sessionNumber,
      tableId: session.tableId,
      gameChargeAmount: session.gameChargeAmount,
      startedAt: session.startedAt.toISOString(),
    })),
    entries: allEntryDtos,
  });

  if (tabMap.size === 0 && tableTabs.length === 0 && sessionTabs.length === 0) {
    return [];
  }

  let customerTabs: CustomerOpenTabSummaryDTO[] = [];

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
      .filter((row): row is CustomerOpenTabSummaryDTO => row !== null);
  }

  if (forceCustomerId && !customerTabs.some((tab) => tab.customerId === forceCustomerId)) {
    const forcedCustomer = await Customer.findOne({
      _id: forceCustomerId,
      isActive: true,
    }).lean();

    if (forcedCustomer) {
      const forcedTotals = { pendingAmount: 0, pendingCount: 0 };
      for (const dto of allEntryDtos) {
        for (const obligation of getLedgerObligations(dto)) {
          if (obligation.customerId !== forceCustomerId) continue;
          if (obligation.amount <= 0) continue;
          forcedTotals.pendingAmount += obligation.amount;
          forcedTotals.pendingCount += 1;
        }
      }

      if (forcedTotals.pendingAmount > 0) {
        customerTabs.push(
          toCustomerOpenTabSummary({
            customerId: forcedCustomer._id.toString(),
            customerName: forcedCustomer.name,
            phoneNumber: forcedCustomer.phone,
            cardId: forcedCustomer.cardId,
            walletEnabled: forcedCustomer.walletEnabled ?? true,
            pendingAmount: forcedTotals.pendingAmount,
            pendingCount: forcedTotals.pendingCount,
          })
        );
      }
    }
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

    for (const obligation of getCheckoutQueueObligations(dto)) {
      if (obligation.customerId !== customerId) continue;
      const slice = getCustomerBillSlice(dto, customerId);
      items.push({
        entry: dto,
        contributionAmount: obligation.amount,
        contributorCustomerId: customerId,
        lineAmount: slice?.lineTotal,
        linePaidAmount: slice?.paid,
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

  await ensureSessionGameEntryForCheckout(sessionId, {
    id: authResult.session.user.id,
    username: authResult.session.user.username,
  });

  const entries = await NotebookEntry.find({
    sessionId,
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
  })
    .sort({ createdAt: 1 })
    .lean();

  const items: CustomerPendingItemDTO[] = [];

  for (const entry of entries) {
    const dto = toNotebookEntryDTO(entry);
    if (!isSessionPayableEntry(dto, sessionId)) continue;

    items.push({
      entry: dto,
      contributionAmount: sessionEntryAmountRemaining(dto),
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
      contributionAmount: entryAmountRemaining(dto),
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

export async function getCustomerTodayGlance(
  customerId: string
): Promise<CustomerTodayGlanceDTO> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return {
      frameCount: 0,
      frameTotal: 0,
      cafeTotal: 0,
      grandTotal: 0,
      frames: [],
      cafe: [],
    };
  }

  await connectDB();

  const { start, end } = getDayBounds();

  const entries = await NotebookEntry.find({
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "CANCELLED" },
    $or: [{ customerId }, { "contributors.customerId": customerId }],
  })
    .sort({ createdAt: 1 })
    .lean();

  return buildCustomerTodayGlance(
    entries.map((entry) => toNotebookEntryDTO(entry)),
    customerId
  );
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
  const visitBillStaff = {
    username: authResult.session.user.username,
    staffId: authResult.session.user.id,
  };

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
      if (!isTable && customer) {
        await linkEntryToActiveVisitBill(existing, visitBillStaff);
      }
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
      if (!isTable && customer) {
        await linkEntryToActiveVisitBill(entry, visitBillStaff);
      }
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
