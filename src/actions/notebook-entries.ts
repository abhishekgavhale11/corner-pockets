"use server";

import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { getOpenBusinessDayContext } from "@/lib/business-day/require-open-business-day";
import { getNotebookReversalReasonLabel } from "@/lib/constants/notebook-payments";
import type { NotebookReversalReasonKey } from "@/lib/constants/notebook-payments";
import { CHECKOUT_ELIGIBLE_STATUSES } from "@/lib/constants/notebook-payments";
import { CAFE_SECTION, isBigSnookerSection, isPoolMiniSection, poolMiniEntryTypeForSection } from "@/lib/constants/counter-sections";
import {
  ACTIVE_TABLE_SESSION_STATUSES,
  OPEN_TABLE_SESSION_STATUSES,
  isPoolMiniTableId,
} from "@/lib/constants/table-sessions";
import {
  assignCounterEntryCustomerSchema,
  addCafeItemsSchema,
  cancelCounterEntrySchema,
  deleteFrameSchema,
  createNotebookEntrySchema,
  createQuickCounterEntrySchema,
  createRummyCounterEntrySchema,
  createSnookerFrameEntrySchema,
  updateSnookerFrameEntrySchema,
  createPoolMiniEntrySchema,
  updatePoolMiniEntrySchema,
  correctCounterEntrySchema,
  correctCafeEntrySchema,
  setEntryContributorsSchema,
  reverseNotebookEntrySchema,
} from "@/lib/validators/notebook";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { formatCurrency } from "@/lib/utils/format";
import { applyTimeToDate } from "@/lib/utils/format-time";
import { framePaymentStatus } from "@/lib/utils/frame-payment";
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
import {
  debitWalletForOperationalPayment,
  parseUseWalletFlag,
  remainingPaymentMethodForDebit,
  resolveWalletDebitAmount,
} from "@/lib/wallet/operational-payment";
import { buildWalletPaymentContext } from "@/lib/wallet/wallet-payment-context";
import { CAFE_ITEM_TYPE_LABELS } from "@/lib/constants/cafe";
import type { CafeItemType } from "@/lib/constants/cafe";
import Customer from "@/models/Customer";
import NotebookEntry from "@/models/NotebookEntry";
import TableSession from "@/models/TableSession";
import { ensureSessionGameEntryForCheckout } from "@/actions/table-sessions";
import type { ICustomer } from "@/models/Customer";
import type {
  NotebookEntryDTO,
  OpenTabSummaryDTO,
  CustomerPendingItemDTO,
  CustomerTodayGlanceDTO,
} from "@/types";
import type { CafeTableId } from "@/lib/constants/counter-sections";
import {
  entryAmountRemaining,
  entryHasContributors,
  isSessionPayableEntry,
  sessionEntryAmountRemaining,
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
      paidAmount: 0,
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
    paidAmount: 0,
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

  const splitBilling = formData.get("splitBilling") === "true";
  const walletAmountRaw = formData.get("walletAmount");
  const parsed = updateSnookerFrameEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    frameType: formData.get("frameType"),
    amount: formData.get("amount"),
    paidAmount: splitBilling ? 0 : formData.get("paidAmount") || 0,
    paymentMethod: formData.get("paymentMethod") || undefined,
    useWallet: splitBilling
      ? false
      : parseUseWalletFlag(formData.get("useWallet")),
    walletAmount:
      !splitBilling &&
      walletAmountRaw !== null &&
      String(walletAmountRaw).trim() !== ""
        ? walletAmountRaw
        : undefined,
    playerCount: formData.get("playerCount") || undefined,
    entryTime: formData.get("entryTime"),
    customerId: formData.get("customerId") || undefined,
    splitBilling: splitBilling ? "true" : undefined,
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

  if (entry.status === "CANCELLED" || entry.status === "REVERSED") {
    return failure("Cancelled or reversed frames cannot be edited");
  }

  if (entry.type !== "SNOOKER" && entry.type !== "RUMMY") {
    return failure("Only frame entries can be edited");
  }

  const priorCustomerId = entry.customerId?.toString();

  const {
    frameType,
    amount,
    paidAmount,
    paymentMethod,
    playerCount,
    entryTime,
    customerId,
    walletAmount,
    useWallet,
  } = parsed.data;

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

  if (!parsed.data.splitBilling) {
    entry.paidAmount = paidAmount;
    entry.status = framePaymentStatus(amount, paidAmount);
    if (paidAmount > 0 && paymentMethod) {
      entry.paymentMethod = paymentMethod;
    } else {
      entry.paymentMethod = undefined;
    }
  }

  entry.createdAt = applyTimeToDate(entry.createdAt, entryTime);
  entry.markModified("createdAt");

  if (customerId) {
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

  let walletDebit = 0;
  if (!parsed.data.splitBilling) {
    try {
      const priorWallet = Math.round(entry.walletAmount ?? 0);
      let availableBalance = priorWallet;
      const walletCustomerId =
        customerId ?? entry.customerId?.toString() ?? undefined;
      if (walletCustomerId) {
        const walletCustomer = await Customer.findById(walletCustomerId)
          .select("balance")
          .lean();
        if (walletCustomer) {
          availableBalance =
            Math.round(walletCustomer.balance ?? 0) + priorWallet;
        }
      }
      walletDebit = resolveWalletDebitAmount({
        paidAmount,
        paymentMethod,
        useWallet,
        availableBalance,
        walletAmount,
      });
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : "Invalid wallet amount"
      );
    }
  }

  const previousWalletDebit = Math.round(entry.walletAmount ?? 0);
  const walletDebitDelta = Math.max(0, walletDebit - previousWalletDebit);

  if (walletDebitDelta > 0) {
    const walletCustomerId = entry.customerId?.toString();
    if (!walletCustomerId) {
      return failure("Assign a customer before using wallet");
    }

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const frameLabel = getEntryDisplayLabel(entry);
        const remainderMethod = remainingPaymentMethodForDebit(
          walletDebit,
          paidAmount,
          paymentMethod
        );
        const txnId = await debitWalletForOperationalPayment({
          customerId: walletCustomerId,
          amount: walletDebitDelta,
          description: `Frame payment — ${frameLabel}`,
          staffId: authResult.session.user.id,
          staffUsername: authResult.session.user.username,
          dbSession,
          remainingPaymentMethod: remainderMethod,
          businessDayId: entry.businessDayId?.toString(),
          paymentContext: buildWalletPaymentContext({
            purpose: "FRAME_PAYMENT",
            billAmount: paidAmount,
            walletUsed: walletDebitDelta,
            totalWalletApplied: walletDebit,
            remainderMethod,
            lines: [{ label: frameLabel, quantity: 1 }],
            businessDayId: entry.businessDayId?.toString(),
          }),
        });
        entry.walletAmount = walletDebit;
        entry.walletTransactionId = txnId;
        await entry.save({ session: dbSession });
      });
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : "Wallet payment failed"
      );
    } finally {
      await dbSession.endSession();
    }
  } else if (walletDebit > 0) {
    entry.walletAmount = walletDebit;
    await entry.save();
  } else {
    if (!parsed.data.splitBilling) {
      entry.walletAmount = undefined;
      entry.walletTransactionId = undefined;
    }
    await entry.save();
  }

  revalidateCounterPaths(entry.customerId?.toString());
  if (priorCustomerId && priorCustomerId !== entry.customerId?.toString()) {
    revalidateCounterPaths(priorCustomerId);
    revalidateCustomerFinancials(priorCustomerId);
  }
  if (entry.customerId) {
    revalidateCustomerFinancials(entry.customerId.toString());
  }

  return success(toNotebookEntryDTO(entry));
}

export async function createPoolMiniEntry(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = createPoolMiniEntrySchema.safeParse({
    section: formData.get("section"),
    amount: formData.get("amount"),
    rateType: formData.get("rateType") || "REGULAR",
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const { section, amount, rateType } = parsed.data;
  const now = new Date();

  const entry = await NotebookEntry.create({
    section,
    type: poolMiniEntryTypeForSection(section),
    amount,
    rateType,
    paidAmount: 0,
    customerName: "",
    phoneNumber: "",
    status: "PENDING",
    playStartedAt: now,
    notes: "",
    createdBy: authResult.session.user.username,
    createdByStaffId: authResult.session.user.id,
  });

  revalidateCounterPaths();
  return success(toNotebookEntryDTO(entry));
}

export async function updatePoolMiniEntry(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const walletAmountRaw = formData.get("walletAmount");
  const parsed = updatePoolMiniEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    amount: formData.get("amount"),
    paidAmount: formData.get("paidAmount") || 0,
    paymentMethod: formData.get("paymentMethod") || undefined,
    useWallet: parseUseWalletFlag(formData.get("useWallet")),
    walletAmount:
      walletAmountRaw !== null && String(walletAmountRaw).trim() !== ""
        ? walletAmountRaw
        : undefined,
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime") || undefined,
    notes: formData.get("notes") ?? "",
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

  if (!isPoolMiniSection(entry.section)) {
    return failure("Only Pool & Mini entries can be edited here");
  }

  if (entry.type !== "MINI" && entry.type !== "POOL") {
    return failure("Only Pool & Mini entries can be edited");
  }

  if (entry.status === "CANCELLED" || entry.status === "REVERSED") {
    return failure("Cancelled or reversed entries cannot be edited");
  }

  if (entryHasContributors(entry)) {
    return failure("Pool & Mini entries do not support Split");
  }

  const priorCustomerId = entry.customerId?.toString();
  const {
    amount,
    paidAmount,
    paymentMethod,
    startTime,
    endTime,
    notes,
    customerId,
    walletAmount,
    useWallet,
  } = parsed.data;

  entry.amount = amount;
  entry.rateType =
    inferRateTypeFromStoredAmount(
      entry.type === "MINI" ? "MINI" : "POOL",
      amount
    ) ?? entry.rateType;
  entry.paidAmount = paidAmount;
  entry.status = framePaymentStatus(amount, paidAmount);
  if (paidAmount > 0 && paymentMethod) {
    entry.paymentMethod = paymentMethod;
  } else {
    entry.paymentMethod = undefined;
  }

  const baseDate = entry.playStartedAt ?? entry.createdAt;
  entry.playStartedAt = applyTimeToDate(baseDate, startTime);
  if (endTime) {
    entry.playEndedAt = applyTimeToDate(baseDate, endTime);
  } else {
    entry.playEndedAt = undefined;
  }
  entry.notes = notes;
  entry.markModified("playStartedAt");
  entry.markModified("playEndedAt");

  if (customerId) {
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

  let walletDebit = 0;
  try {
    const previousWalletDebit = Math.round(entry.walletAmount ?? 0);
    let availableBalance = previousWalletDebit;
    const walletCustomerId = entry.customerId?.toString();
    if (walletCustomerId) {
      const walletCustomer = await Customer.findById(walletCustomerId)
        .select("balance")
        .lean();
      if (walletCustomer) {
        availableBalance =
          Math.round(walletCustomer.balance ?? 0) + previousWalletDebit;
      }
    }
    walletDebit = resolveWalletDebitAmount({
      paidAmount,
      paymentMethod,
      useWallet,
      availableBalance,
      walletAmount,
    });
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Invalid wallet amount"
    );
  }

  const previousWalletDebit = Math.round(entry.walletAmount ?? 0);
  const walletDebitDelta = Math.max(0, walletDebit - previousWalletDebit);

  if (walletDebitDelta > 0) {
    const walletCustomerId = entry.customerId?.toString();
    if (!walletCustomerId) {
      return failure("Assign a customer before using wallet");
    }

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const frameLabel = getEntryDisplayLabel(entry);
        const remainderMethod = remainingPaymentMethodForDebit(
          walletDebit,
          paidAmount,
          paymentMethod
        );
        const txnId = await debitWalletForOperationalPayment({
          customerId: walletCustomerId,
          amount: walletDebitDelta,
          description: `Pool/Mini payment — ${frameLabel}`,
          staffId: authResult.session.user.id,
          staffUsername: authResult.session.user.username,
          dbSession,
          remainingPaymentMethod: remainderMethod,
          businessDayId: entry.businessDayId?.toString(),
          paymentContext: buildWalletPaymentContext({
            purpose: "FRAME_PAYMENT",
            billAmount: paidAmount,
            walletUsed: walletDebitDelta,
            totalWalletApplied: walletDebit,
            remainderMethod,
            lines: [{ label: frameLabel, quantity: 1 }],
            businessDayId: entry.businessDayId?.toString(),
          }),
        });
        entry.walletAmount = walletDebit;
        entry.walletTransactionId = txnId;
        await entry.save({ session: dbSession });
      });
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : "Wallet payment failed"
      );
    } finally {
      await dbSession.endSession();
    }
  } else if (walletDebit > 0) {
    entry.walletAmount = walletDebit;
    await entry.save();
  } else {
    entry.walletAmount = undefined;
    entry.walletTransactionId = undefined;
    await entry.save();
  }

  revalidateCounterPaths(entry.customerId?.toString());
  if (priorCustomerId && priorCustomerId !== entry.customerId?.toString()) {
    revalidateCounterPaths(priorCustomerId);
    revalidateCustomerFinancials(priorCustomerId);
  }
  if (entry.customerId) {
    revalidateCustomerFinancials(entry.customerId.toString());
  }

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
  const priorCustomerId = entry.customerId?.toString();

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
  if (priorCustomerId && priorCustomerId !== entry.customerId?.toString()) {
    revalidateCounterPaths(priorCustomerId);
    revalidateCustomerFinancials(priorCustomerId);
  }
  if (entry.customerId) {
    revalidateCustomerFinancials(entry.customerId.toString());
  }

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
    correctionReason: formData.get("correctionReason") || undefined,
    quantity: formData.get("quantity") || undefined,
    amount: formData.get("amount") || undefined,
    itemNote: formData.get("itemNote") ?? undefined,
    paidAmount:
      formData.get("paidAmount") !== null &&
      formData.get("paidAmount") !== undefined &&
      String(formData.get("paidAmount")).trim() !== ""
        ? formData.get("paidAmount")
        : undefined,
    paymentMethod: formData.get("paymentMethod") || undefined,
    useWallet: parseUseWalletFlag(formData.get("useWallet")),
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

  if (entry.status === "CANCELLED" || entry.status === "REVERSED") {
    return failure("Cancelled or reversed cafe items cannot be edited");
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

  const nextPaidAmount =
    parsed.data.paidAmount !== undefined
      ? parsed.data.paidAmount
      : (entry.paidAmount ?? 0);

  if (nextPaidAmount > entry.amount) {
    return failure("Received amount cannot exceed item amount");
  }

  if (
    nextPaidAmount > 0 &&
    !entry.customerId &&
    !(parsed.data.paidAmount === undefined && (entry.paidAmount ?? 0) > 0)
  ) {
    if (parsed.data.paidAmount !== undefined && parsed.data.paidAmount > 0) {
      return failure("Assign a customer before recording payment");
    }
  }

  if (parsed.data.paidAmount !== undefined) {
    if (parsed.data.paidAmount > 0 && !parsed.data.paymentMethod) {
      return failure(
        "Select Cash or GPay when received amount is greater than zero"
      );
    }
    entry.paidAmount = parsed.data.paidAmount;
    if (parsed.data.paidAmount > 0 && parsed.data.paymentMethod) {
      entry.paymentMethod = parsed.data.paymentMethod;
    } else {
      entry.paymentMethod = undefined;
    }
  }

  entry.status = framePaymentStatus(entry.amount, entry.paidAmount ?? 0);

  const hasContentChanges = changes.length > 0;
  const paymentOnly =
    !hasContentChanges && parsed.data.paidAmount !== undefined;

  if (!hasContentChanges && !paymentOnly) {
    return failure("No changes to save");
  }

  if (hasContentChanges) {
    if (!parsed.data.correctionReason || parsed.data.correctionReason.length < 3) {
      return failure("Please provide a correction reason");
    }
    entry.corrections.push({
      changes,
      correctedBy: authResult.session.user.username,
      correctedByStaffId: new mongoose.Types.ObjectId(
        authResult.session.user.id
      ),
      correctedAt: new Date(),
      correctionReason: parsed.data.correctionReason,
    });
  }

  await entry.save();

  revalidateCounterPaths(entry.customerId?.toString());
  if (entry.customerId) {
    revalidateCustomerFinancials(entry.customerId.toString());
  }

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

  let contributorsInput: {
    customerId: string;
    amount: number;
    paidAmount?: number;
    paymentMethod?: "CASH" | "GPAY" | "WALLET";
    useWallet?: boolean;
    walletAmount?: number;
  }[] = [];
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

  if (entry.status === "CANCELLED" || entry.status === "REVERSED") {
    return failure("Cancelled or reversed frames cannot be updated");
  }

  if (isPoolMiniSection(entry.section)) {
    return failure("Pool & Mini entries do not support Split");
  }

  if (parsed.data.contributors.length === 0) {
    entry.contributors = [];
    entry.customerId = undefined;
    entry.customerName = "";
    entry.phoneNumber = "";
    entry.assignedAt = undefined;
    entry.assignedBy = undefined;
    entry.paidAmount = 0;
    entry.status = "PENDING";
    await entry.save();

    revalidateCounterPaths();
    return success(toNotebookEntryDTO(entry));
  }

  const total = parsed.data.contributors.reduce((sum, row) => sum + row.amount, 0);
  if (total !== entry.amount) {
    return failure(
      `Contributor amounts must equal frame amount (${entry.amount}). Remaining: ${entry.amount - total}`
    );
  }

  const priorWalletByCustomer = new Map<string, number>();
  for (const existing of entry.contributors ?? []) {
    priorWalletByCustomer.set(
      existing.customerId.toString(),
      Math.round(
        (existing as { walletAmount?: number }).walletAmount ?? 0
      )
    );
  }

  const contributorDocs: {
    customerId: mongoose.Types.ObjectId;
    customerName: string;
    amount: number;
    paidAmount: number;
    status: "PENDING" | "PAID";
    paymentMethod?: "CASH" | "GPAY" | "WALLET";
    walletAmount?: number;
  }[] = [];
  let totalPaid = 0;
  const walletDebits: {
    customerId: string;
    amount: number;
    name: string;
    paidAmount: number;
    paymentMethod?: "CASH" | "GPAY" | "WALLET";
    targetWallet: number;
  }[] = [];

  for (const row of parsed.data.contributors) {
    const customer = await Customer.findById(row.customerId);
    if (!customer || !customer.isActive) {
      return failure("Customer not found");
    }

    const paidAmount = row.paidAmount ?? 0;
    totalPaid += paidAmount;

    const priorWallet =
      priorWalletByCustomer.get(customer._id.toString()) ?? 0;
    const availableBalance =
      Math.round(customer.balance ?? 0) + priorWallet;

    let targetWallet = 0;
    try {
      targetWallet = resolveWalletDebitAmount({
        paidAmount,
        paymentMethod: row.paymentMethod,
        useWallet: row.useWallet,
        availableBalance,
      });
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : "Invalid wallet amount"
      );
    }

    const walletDebitDelta = Math.max(0, targetWallet - priorWallet);
    if (walletDebitDelta > 0) {
      walletDebits.push({
        customerId: customer._id.toString(),
        amount: walletDebitDelta,
        name: customer.name,
        paidAmount,
        paymentMethod: row.paymentMethod,
        targetWallet,
      });
    }

    contributorDocs.push({
      customerId: customer._id,
      customerName: customer.name,
      amount: row.amount,
      paidAmount,
      status: framePaymentStatus(row.amount, paidAmount),
      paymentMethod:
        paidAmount > 0 && row.paymentMethod ? row.paymentMethod : undefined,
      ...(targetWallet > 0 ? { walletAmount: targetWallet } : {}),
    });
  }

  entry.contributors = contributorDocs;
  entry.customerId = undefined;
  entry.customerName = "";
  entry.phoneNumber = "";
  entry.assignedAt = undefined;
  entry.assignedBy = undefined;
  // Payment mode lives per contributor for splits.
  entry.paymentMethod = undefined;
  entry.paidAmount = totalPaid;
  entry.status = framePaymentStatus(entry.amount, totalPaid);

  if (walletDebits.length > 0) {
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        for (const debit of walletDebits) {
          const remainderMethod = remainingPaymentMethodForDebit(
            debit.targetWallet,
            debit.paidAmount,
            debit.paymentMethod
          );
          const frameLabel = getEntryDisplayLabel(entry);
          await debitWalletForOperationalPayment({
            customerId: debit.customerId,
            amount: debit.amount,
            description: `Split frame payment — ${debit.name}`,
            staffId: authResult.session.user.id,
            staffUsername: authResult.session.user.username,
            dbSession,
            remainingPaymentMethod: remainderMethod,
            businessDayId: entry.businessDayId?.toString(),
            paymentContext: buildWalletPaymentContext({
              purpose: "FRAME_PAYMENT",
              billAmount: debit.paidAmount,
              walletUsed: debit.amount,
              totalWalletApplied: debit.targetWallet,
              remainderMethod,
              lines: [{ label: frameLabel, quantity: 1 }],
              businessDayId: entry.businessDayId?.toString(),
            }),
          });
        }
        await entry.save({ session: dbSession });
      });
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : "Wallet payment failed"
      );
    } finally {
      await dbSession.endSession();
    }
  } else {
    await entry.save();
  }

  revalidateCounterPaths();
  for (const row of contributorDocs) {
    revalidateCounterPaths(row.customerId.toString());
    revalidateCustomerFinancials(row.customerId.toString());
  }

  return success(toNotebookEntryDTO(entry));
}

export async function getOpenTabs(
  _searchParams: Record<string, string | string[] | undefined> = {}
): Promise<OpenTabSummaryDTO[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }
  // Checkout queue removed with Financial Engine V1.
  return [];
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
    $or: [{ customerId }, { "contributors.customerId": customerId }],
  })
    .sort({ createdAt: 1 })
    .lean();

  const items: CustomerPendingItemDTO[] = [];

  for (const entry of entries) {
    const dto = toNotebookEntryDTO(entry);
    if (entryHasContributors(dto)) {
      const contributor = dto.contributors!.find(
        (row) => row.customerId === customerId
      );
      if (!contributor || contributor.status === "PAID") continue;
      const remaining = Math.max(
        0,
        contributor.amount -
          (contributor.paidAmount ?? 0) -
          (contributor.balanceCollectedAmount ?? 0)
      );
      if (remaining <= 0) continue;
      items.push({
        entry: dto,
        contributionAmount: remaining,
        contributorCustomerId: customerId,
        lineAmount: contributor.amount,
        linePaidAmount:
          (contributor.paidAmount ?? 0) +
          (contributor.balanceCollectedAmount ?? 0),
      });
      continue;
    }

    if (dto.customerId !== customerId) continue;
    const remaining = entryAmountRemaining(dto);
    if (remaining <= 0) continue;
    items.push({
      entry: dto,
      contributionAmount: remaining,
      contributorCustomerId: customerId,
      lineAmount: dto.amount,
      linePaidAmount:
        (dto.paidAmount ?? 0) + (dto.balanceCollectedAmount ?? 0),
    });
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
    tableId,
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
    customerId: { $exists: false },
  })
    .sort({ createdAt: 1 })
    .lean();

  const items: CustomerPendingItemDTO[] = [];

  for (const entry of entries) {
    const dto = toNotebookEntryDTO(entry);
    if (entryHasContributors(dto)) continue;
    const remaining = entryAmountRemaining(dto);
    if (remaining <= 0) continue;

    items.push({
      entry: dto,
      contributionAmount: remaining,
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

  const openDay = await getOpenBusinessDayContext();
  if (!openDay) {
    return {
      frameCount: 0,
      frameTotal: 0,
      cafeTotal: 0,
      grandTotal: 0,
      frames: [],
      cafe: [],
    };
  }

  const entries = await NotebookEntry.find({
    businessDayId: openDay.businessDayId,
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

  const openDay = await getOpenBusinessDayContext();
  if (!openDay) {
    return failure(
      "Frames can only be deleted while the Business Day is OPEN."
    );
  }

  const entry = await NotebookEntry.findById(parsed.data.entryId);
  if (!entry) {
    return failure("Entry not found");
  }

  if (entry.section === CAFE_SECTION) {
    return failure("Cafe entries cannot be cancelled. Use reversal instead.");
  }

  if (
    !entry.businessDayId ||
    entry.businessDayId.toString() !== openDay.businessDayId.toString()
  ) {
    return failure(
      "Frames can only be deleted while the Business Day is OPEN."
    );
  }

  if (entry.status === "CANCELLED" || entry.status === "REVERSED") {
    return failure("This frame is already removed.");
  }

  if (entry.status !== "PENDING" && entry.status !== "PAID") {
    return failure("This frame cannot be deleted.");
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

  revalidateFrameCustomers(entry);

  return success(toNotebookEntryDTO(entry));
}

/**
 * Delete Frame (notebook correction while Business Day is OPEN).
 * Soft-cancels the entry so Close / Outstanding / History ignore it.
 * Closed Business Days cannot delete frames.
 */
export async function deleteFrame(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_REVERSE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = deleteFrameSchema.safeParse({
    entryId: formData.get("entryId"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const openDay = await getOpenBusinessDayContext();
  if (!openDay) {
    return failure(
      "Frames can only be deleted while the Business Day is OPEN."
    );
  }

  const entry = await NotebookEntry.findById(parsed.data.entryId);
  if (!entry) {
    return failure("Entry not found");
  }

  if (entry.section === CAFE_SECTION) {
    return failure("Cafe items cannot be deleted from Frames.");
  }

  if (
    !entry.businessDayId ||
    entry.businessDayId.toString() !== openDay.businessDayId.toString()
  ) {
    return failure(
      "Frames can only be deleted while the Business Day is OPEN."
    );
  }

  if (entry.status === "CANCELLED" || entry.status === "REVERSED") {
    return failure("This frame is already deleted.");
  }

  if (entry.status !== "PENDING" && entry.status !== "PAID") {
    return failure("This frame cannot be deleted.");
  }

  entry.status = "CANCELLED";
  entry.cancelledAt = new Date();
  entry.cancelledBy = authResult.session.user.username;
  entry.cancellationReason = "Deleted while Business Day open";
  await entry.save();

  revalidateFrameCustomers(entry);

  return success(toNotebookEntryDTO(entry));
}

function revalidateFrameCustomers(entry: {
  customerId?: { toString(): string } | null;
  contributors?: Array<{ customerId?: { toString(): string } | null }>;
}) {
  const ids = new Set<string>();
  if (entry.customerId) {
    ids.add(entry.customerId.toString());
  }
  for (const row of entry.contributors ?? []) {
    if (row.customerId) {
      ids.add(row.customerId.toString());
    }
  }
  if (ids.size === 0) {
    revalidateCounterPaths();
    return;
  }
  for (const id of ids) {
    revalidateCounterPaths(id);
  }
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
    paidAmount: formData.get("paidAmount") || 0,
    paymentMethod: formData.get("paymentMethod") || undefined,
    useWallet: parseUseWalletFlag(formData.get("useWallet")),
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

  const openDay = await getOpenBusinessDayContext();
  if (!openDay) {
    return failure(
      "No OPEN Business Day. Start the Business Day before creating Cafe items."
    );
  }

  const paidAmount = parsed.data.paidAmount;
  const paymentMethod =
    paidAmount > 0 ? parsed.data.paymentMethod : undefined;

  let walletDebit = 0;
  try {
    walletDebit = resolveWalletDebitAmount({
      paidAmount,
      paymentMethod,
      useWallet: parsed.data.useWallet,
      availableBalance: customer ? Math.round(customer.balance ?? 0) : 0,
    });
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Invalid wallet amount"
    );
  }

  if (walletDebit > 0 && !customer) {
    return failure("Assign a customer before using wallet");
  }

  const results: NotebookEntryDTO[] = [];

  const createCafeItemEntries = async (
    dbSession?: import("mongoose").ClientSession
  ) => {
    let tableSessionId: import("mongoose").Types.ObjectId | undefined;
    if (
      isTable &&
      parsed.data.tableId &&
      isPoolMiniTableId(parsed.data.tableId)
    ) {
      if (parsed.data.sessionId) {
        const manualSession = await TableSession.findById(
          parsed.data.sessionId
        ).session(dbSession ?? null);
        if (
          !manualSession ||
          manualSession.tableId !== parsed.data.tableId ||
          !(OPEN_TABLE_SESSION_STATUSES as readonly string[]).includes(
            manualSession.status
          )
        ) {
          throw new Error("Session not found for this table");
        }
        tableSessionId = manualSession._id;
      } else {
        const openSession = await TableSession.findOne({
          tableId: parsed.data.tableId,
          status: { $in: [...ACTIVE_TABLE_SESSION_STATUSES] },
          businessDayId: openDay.businessDayId,
        })
          .sort({ startedAt: -1 })
          .session(dbSession ?? null);
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
        throw new Error("Food items require a note");
      }

      const lineAmount = item.unitPrice * item.quantity;
      const linePaid = Math.min(paidAmount, lineAmount);
      const lineStatus = framePaymentStatus(lineAmount, linePaid);
      const linePaymentMethod =
        linePaid > 0 && paymentMethod ? paymentMethod : undefined;
      const lineWalletAmount =
        walletDebit > 0 && linePaid > 0
          ? Math.min(linePaid, walletDebit)
          : undefined;

      // Only merge unpaid identical lines — paid lines stay independent like Frames.
      const canMerge = linePaid === 0;

      const mergeQuery: Record<string, unknown> = {
        section: CAFE_SECTION,
        type: item.type,
        status: "PENDING",
        businessDayId: openDay.businessDayId,
        $or: [{ paidAmount: { $exists: false } }, { paidAmount: 0 }],
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

      const existing = canMerge
        ? await NotebookEntry.findOne(mergeQuery).session(dbSession ?? null)
        : null;

      if (existing) {
        existing.quantity = (existing.quantity ?? 1) + item.quantity;
        existing.unitPrice = item.unitPrice;
        existing.amount = existing.unitPrice * existing.quantity;
        if (item.type === "FOOD" && item.note?.trim()) {
          existing.itemNote = item.note.trim();
        }
        existing.paidAmount = 0;
        existing.paymentMethod = undefined;
        existing.status = "PENDING";
        await existing.save({ session: dbSession ?? undefined });
        results.push(toNotebookEntryDTO(existing));
      } else {
        const [entry] = await NotebookEntry.create(
          [
            {
              section: CAFE_SECTION,
              type: item.type,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: lineAmount,
              paidAmount: linePaid,
              ...(linePaymentMethod
                ? { paymentMethod: linePaymentMethod }
                : {}),
              ...(lineWalletAmount !== undefined
                ? { walletAmount: lineWalletAmount }
                : {}),
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
              status: lineStatus,
              createdBy: authResult.session.user.username,
              createdByStaffId: authResult.session.user.id,
            },
          ],
          { session: dbSession ?? undefined }
        );
        results.push(toNotebookEntryDTO(entry));
      }
    }
  };

  if (walletDebit > 0 && customer) {
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const remainderMethod = remainingPaymentMethodForDebit(
          walletDebit,
          paidAmount,
          paymentMethod
        );
        const cafeLines = parsed.data.items.map((item) => ({
          label:
            item.type === "FOOD" && item.note?.trim()
              ? item.note.trim()
              : CAFE_ITEM_TYPE_LABELS[item.type as CafeItemType] ?? item.type,
          quantity: item.quantity,
        }));
        await debitWalletForOperationalPayment({
          customerId: customer._id.toString(),
          amount: walletDebit,
          description: `Cafe items — ₹${walletDebit.toLocaleString("en-IN")}`,
          staffId: authResult.session.user.id,
          staffUsername: authResult.session.user.username,
          dbSession,
          remainingPaymentMethod: remainderMethod,
          businessDayId: openDay.businessDayId.toString(),
          paymentContext: buildWalletPaymentContext({
            purpose: "CAFE_PAYMENT",
            billAmount: paidAmount,
            walletUsed: walletDebit,
            totalWalletApplied: walletDebit,
            remainderMethod,
            lines: cafeLines,
            businessDayId: openDay.businessDayId.toString(),
          }),
        });
        await createCafeItemEntries(dbSession);
      });
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : "Wallet payment failed"
      );
    } finally {
      await dbSession.endSession();
    }
  } else {
    try {
      await createCafeItemEntries();
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : "Failed to add cafe items"
      );
    }
  }

  revalidateCounterPaths(customer?._id?.toString());
  if (customer) {
    revalidateCustomerFinancials(customer._id.toString());
  }
  return success(results);
}

/** @deprecated Use addCafeItems */
export async function addCafeItemsToCustomer(
  formData: FormData
): Promise<ActionResult<NotebookEntryDTO[]>> {
  return addCafeItems(formData);
}
