"use server";

import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { CAFE_SECTION } from "@/lib/constants/counter-sections";
import {
  ACTIVE_TABLE_SESSION_STATUSES,
  UNPAID_TABLE_SESSION_STATUSES,
  poolMiniGameType,
  type PoolMiniTableId,
} from "@/lib/constants/table-sessions";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { toTableSessionDTO } from "@/lib/mappers/table-session";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { toCustomerDTO } from "@/lib/mappers";
import { generateTableSessionNumber, generateTableLocalSessionNumber } from "@/lib/table-sessions/session-number";
import {
  calculateSessionGameCharge,
  resolveHourlyRate,
} from "@/lib/utils/session-billing";
import { computeActivePlayMs } from "@/lib/utils/session-timer";
import {
  startTableSessionSchema,
  tableSessionActionSchema,
  assignTableSessionCustomersSchema,
  updateSessionGameAmountSchema,
  updateSessionBillAmountsSchema,
} from "@/lib/validators/table-sessions";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import { revalidateCounterPaths } from "@/lib/utils/revalidate-counter";
import NotebookEntry from "@/models/NotebookEntry";
import NotebookSettlement from "@/models/NotebookSettlement";
import TableSession from "@/models/TableSession";
import {
  buildTableSessionHistoryRow,
  isHistorySessionRow,
} from "@/lib/utils/table-session-history";
import type {
  PoolMiniTableSummaryDTO,
  SessionCheckoutDetailsDTO,
  SessionCafeEditItemDTO,
  TableSessionDTO,
  TableSessionHistoryDTO,
  CustomerDTO,
} from "@/types";
import { CHECKOUT_ELIGIBLE_STATUSES } from "@/lib/constants/notebook-payments";
import { buildCompactSessionCheckoutTimeline } from "@/lib/utils/session-checkout-timeline";
import { formatTableSessionLabel } from "@/lib/utils/session-display";
import { formatCafeItemLabel } from "@/lib/utils/notebook-entry-label";
import Customer from "@/models/Customer";
import mongoose from "mongoose";

export type PoolMiniSessionBoardData = {
  tables: {
    tableId: PoolMiniTableId;
    session: TableSessionDTO | null;
    pendingCheckouts: TableSessionDTO[];
    summary: PoolMiniTableSummaryDTO;
    history: TableSessionHistoryDTO[];
    canStartNewSession: boolean;
  }[];
};

function getDayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function sumCafeChargesForSession(sessionId: string): Promise<number> {
  const entries = await NotebookEntry.find({
    sessionId,
    section: CAFE_SECTION,
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
  }).lean();

  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

async function findActiveSessionForTable(tableId: PoolMiniTableId) {
  return TableSession.findOne({
    tableId,
    status: { $in: [...ACTIVE_TABLE_SESSION_STATUSES] },
  }).sort({ startedAt: -1 });
}

async function findPendingCheckoutSessionsForTable(tableId: PoolMiniTableId) {
  return TableSession.find({
    tableId,
    status: { $in: [...UNPAID_TABLE_SESSION_STATUSES] },
  }).sort({ endedAt: -1 });
}

async function toSessionDto(
  session: InstanceType<typeof TableSession>
): Promise<TableSessionDTO> {
  const cafeChargeAmount = await sumCafeChargesForSession(
    session._id.toString()
  );
  return toTableSessionDTO(session, cafeChargeAmount);
}

function appendAudit(
  session: InstanceType<typeof TableSession>,
  action: "STARTED" | "PAUSED" | "RESUMED" | "STOPPED" | "ENDED",
  username: string,
  staffId: string
) {
  session.auditLog.push({
    action,
    at: new Date(),
    by: username,
    byStaffId: new mongoose.Types.ObjectId(staffId),
  });
}

export async function getPoolMiniSessionBoardData(): Promise<PoolMiniSessionBoardData> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return {
      tables: [
        {
          tableId: "MINI_SNOOKER",
          session: null,
          pendingCheckouts: [],
          summary: { revenueToday: 0, sessionsToday: 0, pendingCount: 0 },
          history: [],
          canStartNewSession: true,
        },
        {
          tableId: "POOL_1",
          session: null,
          pendingCheckouts: [],
          summary: { revenueToday: 0, sessionsToday: 0, pendingCount: 0 },
          history: [],
          canStartNewSession: true,
        },
        {
          tableId: "POOL_2",
          session: null,
          pendingCheckouts: [],
          summary: { revenueToday: 0, sessionsToday: 0, pendingCount: 0 },
          history: [],
          canStartNewSession: true,
        },
      ],
    };
  }

  await connectDB();

  const { start, end } = getDayBounds();
  const tableIds: PoolMiniTableId[] = ["MINI_SNOOKER", "POOL_1", "POOL_2"];

  const todaySessions = await TableSession.find({
    tableId: { $in: tableIds },
    startedAt: { $gte: start, $lte: end },
  })
    .sort({ startedAt: -1 })
    .lean();

  const sessionIds = todaySessions.map((s) => s._id);
  const allEntries = sessionIds.length
    ? await NotebookEntry.find({ sessionId: { $in: sessionIds } }).lean()
    : [];

  const entryIds = allEntries.map((e) => e._id);
  const allSettlements =
    entryIds.length > 0
      ? await NotebookSettlement.find({
          entryIds: { $in: entryIds },
        })
          .sort({ createdAt: 1 })
          .lean()
      : [];

  const tables = await Promise.all(
    tableIds.map(async (tableId) => {
      const [activeSession, pendingSessions] = await Promise.all([
        findActiveSessionForTable(tableId),
        findPendingCheckoutSessionsForTable(tableId),
      ]);

      const tableTodaySessions = todaySessions.filter(
        (s) => s.tableId === tableId
      );

      const historyRows = tableTodaySessions
        .filter(isHistorySessionRow)
        .map((session) => {
          const sessionEntryIds = new Set(
            allEntries
              .filter(
                (e) => e.sessionId?.toString() === session._id.toString()
              )
              .map((e) => e._id.toString())
          );
          const settlements = allSettlements.filter((settlement) =>
            settlement.entryIds.some((id) =>
              sessionEntryIds.has(id.toString())
            )
          );
          return buildTableSessionHistoryRow(
            session,
            allEntries,
            settlements
          );
        });

      const historyIds = new Set(historyRows.map((row) => row.sessionId));
      for (const pending of pendingSessions) {
        const pendingId = pending._id.toString();
        if (historyIds.has(pendingId)) continue;
        const sessionEntryIds = new Set(
          allEntries
            .filter((e) => e.sessionId?.toString() === pendingId)
            .map((e) => e._id.toString())
        );
        const settlements = allSettlements.filter((settlement) =>
          settlement.entryIds.some((id) => sessionEntryIds.has(id.toString()))
        );
        historyRows.push(
          buildTableSessionHistoryRow(pending, allEntries, settlements)
        );
      }

      const history = historyRows.sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );

      const revenueToday = history
        .filter((row) => row.paymentStatus === "PAID")
        .reduce((sum, row) => sum + row.totalAmount, 0);

      const pendingCount = history.filter(
        (row) =>
          row.paymentStatus === "PENDING" || row.paymentStatus === "REVERSED"
      ).length;

      return {
        tableId,
        session: activeSession ? await toSessionDto(activeSession) : null,
        pendingCheckouts: await Promise.all(
          pendingSessions.map((row) => toSessionDto(row))
        ),
        summary: {
          revenueToday,
          sessionsToday: tableTodaySessions.length,
          pendingCount,
        },
        history,
        canStartNewSession: !activeSession,
      };
    })
  );

  return { tables };
}

export async function startTableSession(
  formData: FormData
): Promise<ActionResult<TableSessionDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = startTableSessionSchema.safeParse({
    tableId: formData.get("tableId"),
    rateType: formData.get("rateType"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const existing = await findActiveSessionForTable(parsed.data.tableId);
  if (existing) {
    const label = formatTableSessionLabel(
      existing.tableId,
      existing.tableSessionNumber ?? existing.sessionNumber
    );
    return failure(
      `${sectionLabel(existing.tableId)} already has a session in play (${label}). End or pause it before starting another — unpaid ended sessions do not block a new start.`
    );
  }

  try {
    const [sessionNumber, tableSessionNumber] = await Promise.all([
      generateTableSessionNumber(),
      generateTableLocalSessionNumber(parsed.data.tableId),
    ]);
    const hourlyRate = resolveHourlyRate(
      parsed.data.tableId,
      parsed.data.rateType
    );
    const now = new Date();

    const session = await TableSession.create({
      sessionNumber,
      tableSessionNumber,
      tableId: parsed.data.tableId,
      status: "ACTIVE",
      rateType: parsed.data.rateType,
      startedAt: now,
      totalPausedMs: 0,
      activePlayMs: 0,
      hourlyRate,
      gameChargeAmount: 0,
      auditLog: [
        {
          action: "STARTED",
          at: now,
          by: authResult.session.user.username,
          byStaffId: new mongoose.Types.ObjectId(authResult.session.user.id),
        },
      ],
      createdBy: authResult.session.user.username,
      createdByStaffId: new mongoose.Types.ObjectId(authResult.session.user.id),
    });

    revalidateCounterPaths();
    return success(toTableSessionDTO(session, 0));
  } catch (error) {
    console.error("startTableSession failed:", error);
    return failure("Failed to start session");
  }
}

export async function pauseTableSession(
  formData: FormData
): Promise<ActionResult<TableSessionDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = tableSessionActionSchema.safeParse({
    sessionId: formData.get("sessionId"),
  });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const session = await TableSession.findById(parsed.data.sessionId);
  if (!session) {
    return failure("Session not found");
  }
  if (session.status !== "ACTIVE") {
    return failure("Only active sessions can be paused");
  }

  const now = new Date();
  session.status = "PAUSED";
  session.pausedAt = now;
  appendAudit(
    session,
    "PAUSED",
    authResult.session.user.username,
    authResult.session.user.id
  );
  await session.save();

  const cafeChargeAmount = await sumCafeChargesForSession(session._id.toString());
  revalidateCounterPaths();
  return success(toTableSessionDTO(session, cafeChargeAmount));
}

export async function resumeTableSession(
  formData: FormData
): Promise<ActionResult<TableSessionDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = tableSessionActionSchema.safeParse({
    sessionId: formData.get("sessionId"),
  });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const session = await TableSession.findById(parsed.data.sessionId);
  if (!session) {
    return failure("Session not found");
  }
  if (session.status === "PAUSED" && session.pausedAt) {
    const now = new Date();
    session.totalPausedMs += now.getTime() - session.pausedAt.getTime();
    session.pausedAt = undefined;
    session.status = "ACTIVE";
    appendAudit(
      session,
      "RESUMED",
      authResult.session.user.username,
      authResult.session.user.id
    );
    await session.save();
    const cafeChargeAmount = await sumCafeChargesForSession(
      session._id.toString()
    );
    revalidateCounterPaths();
    return success(toTableSessionDTO(session, cafeChargeAmount));
  }

  if (session.status === "STOPPED") {
    if (!session.endedAt) {
      return failure("Stopped session is missing stop time");
    }
    const now = new Date();
    session.totalPausedMs += now.getTime() - session.endedAt.getTime();
    session.endedAt = undefined;
    session.status = "ACTIVE";
    appendAudit(
      session,
      "RESUMED",
      authResult.session.user.username,
      authResult.session.user.id
    );
    await session.save();
    const cafeChargeAmount = await sumCafeChargesForSession(
      session._id.toString()
    );
    revalidateCounterPaths();
    return success(toTableSessionDTO(session, cafeChargeAmount));
  }

  return failure("Only paused or stopped sessions can be resumed");
}

export async function stopTableSession(
  formData: FormData
): Promise<ActionResult<TableSessionDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = tableSessionActionSchema.safeParse({
    sessionId: formData.get("sessionId"),
  });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const session = await TableSession.findById(parsed.data.sessionId);
  if (!session) {
    return failure("Session not found");
  }
  if (session.status !== "ACTIVE" && session.status !== "PAUSED") {
    return failure("Only active or paused sessions can be stopped");
  }

  const now = new Date();
  if (session.status === "PAUSED" && session.pausedAt) {
    session.totalPausedMs += now.getTime() - session.pausedAt.getTime();
    session.pausedAt = undefined;
  }

  const billing = calculateSessionGameCharge({
    tableId: session.tableId,
    rateType: session.rateType,
    startedAt: session.startedAt,
    totalPausedMs: session.totalPausedMs,
    status: "ENDED",
    endedAt: now,
  });

  const gameAmount = billing.amount > 0 ? Math.max(1, billing.amount) : 0;

  let gameEntryId = session.gameEntryId;
  if (gameAmount > 0) {
    const gameType = poolMiniGameType(session.tableId);
    if (session.gameEntryId) {
      const existingEntry = await NotebookEntry.findById(session.gameEntryId);
      if (existingEntry) {
        existingEntry.amount = gameAmount;
        await existingEntry.save();
        gameEntryId = existingEntry._id;
      }
    } else {
      const gameEntry = await NotebookEntry.create({
        section: session.tableId,
        type: gameType,
        amount: gameAmount,
        sessionId: session._id,
        rateType: session.rateType,
        customerName: "",
        phoneNumber: "",
        status: "PENDING",
        createdBy: authResult.session.user.username,
        createdByStaffId: new mongoose.Types.ObjectId(authResult.session.user.id),
      });
      gameEntryId = gameEntry._id;
    }
  }

  session.status = "STOPPED";
  session.endedAt = now;
  session.activePlayMs = billing.activeMs;
  session.gameChargeAmount = gameAmount;
  session.hourlyRate = billing.hourlyRate;
  if (gameEntryId) {
    session.gameEntryId = gameEntryId;
  }
  appendAudit(
    session,
    "STOPPED",
    authResult.session.user.username,
    authResult.session.user.id
  );
  await session.save();

  const cafeChargeAmount = await sumCafeChargesForSession(session._id.toString());
  revalidateCounterPaths();
  return success(toTableSessionDTO(session, cafeChargeAmount));
}

/** @deprecated Use stopTableSession */
export async function endTableSession(
  formData: FormData
): Promise<ActionResult<TableSessionDTO>> {
  return stopTableSession(formData);
}

export async function getActiveSessionForTable(
  tableId: PoolMiniTableId
): Promise<TableSessionDTO | null> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return null;
  }

  await connectDB();
  const session = await findActiveSessionForTable(tableId);
  if (!session) return null;

  return toSessionDto(session);
}

export async function closeTableSessionAfterSettlement(
  sessionId: string
): Promise<void> {
  await connectDB();
  const session = await TableSession.findById(sessionId);
  if (
    !session ||
    !(
      session.status === "STOPPED" ||
      session.status === "CHECKOUT_PENDING" ||
      session.status === "ENDED"
    )
  ) {
    return;
  }
  session.status = "PAID";
  await session.save();
}

export async function assignTableSessionCustomers(
  formData: FormData
): Promise<ActionResult<TableSessionDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  let customerIds: string[] = [];
  try {
    customerIds = JSON.parse(String(formData.get("customerIds") ?? "[]"));
  } catch {
    return failure("Invalid customer list");
  }

  const parsed = assignTableSessionCustomersSchema.safeParse({
    sessionId: formData.get("sessionId"),
    customerIds,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const session = await TableSession.findById(parsed.data.sessionId);
  if (!session) {
    return failure("Session not found");
  }
  if (
    session.status !== "ACTIVE" &&
    session.status !== "PAUSED" &&
    session.status !== "STOPPED" &&
    session.status !== "CHECKOUT_PENDING" &&
    session.status !== "ENDED"
  ) {
    return failure("Paid sessions cannot be reassigned");
  }

  const customers = await Customer.find({
    _id: { $in: parsed.data.customerIds },
    isActive: true,
  }).lean();

  if (customers.length !== parsed.data.customerIds.length) {
    return failure("One or more customers not found");
  }

  session.assignedCustomers = customers.map((customer) => ({
    customerId: customer._id,
    customerName: customer.name,
  }));
  await session.save();

  const cafeChargeAmount = await sumCafeChargesForSession(session._id.toString());
  revalidateCounterPaths();
  return success(toTableSessionDTO(session, cafeChargeAmount));
}

export async function getSessionCafeDisplayItems(
  sessionId: string
): Promise<SessionCafeEditItemDTO[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const entries = await NotebookEntry.find({
    sessionId,
    section: CAFE_SECTION,
    status: { $in: ["PENDING", "REVERSED", "PAID"] },
  })
    .sort({ createdAt: 1 })
    .lean();

  return entries.map((entry) => mapSessionCafeEditItem(entry));
}

function mapSessionCafeEditItem(
  entry: Parameters<typeof toNotebookEntryDTO>[0]
): SessionCafeEditItemDTO {
  const dto = toNotebookEntryDTO(entry);
  const quantity = dto.quantity ?? 1;
  const unitPrice =
    dto.unitPrice ?? (quantity > 0 ? Math.round(dto.amount / quantity) : dto.amount);
  return {
    entryId: dto.id,
    label: formatCafeItemLabel(dto),
    amount: dto.amount,
    itemType: dto.type,
    itemNote: dto.itemNote,
    unitPrice,
    quantity,
  };
}

export async function getSessionCafeEditItems(
  sessionId: string
): Promise<SessionCafeEditItemDTO[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const entries = await NotebookEntry.find({
    sessionId,
    section: CAFE_SECTION,
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
  })
    .sort({ createdAt: 1 })
    .lean();

  return entries.map((entry) => mapSessionCafeEditItem(entry));
}

export async function updateSessionBillAmounts(
  formData: FormData
): Promise<ActionResult<TableSessionDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  let cafeItems: { entryId: string; amount: number }[] = [];
  try {
    cafeItems = JSON.parse(String(formData.get("cafeItems") ?? "[]"));
  } catch {
    return failure("Invalid cafe items");
  }

  const parsed = updateSessionBillAmountsSchema.safeParse({
    sessionId: formData.get("sessionId"),
    gameAmount: formData.get("gameAmount"),
    cafeItems,
  });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const session = await TableSession.findById(parsed.data.sessionId);
  if (!session) {
    return failure("Session not found");
  }
  if (
    session.status !== "ACTIVE" &&
    session.status !== "STOPPED" &&
    session.status !== "CHECKOUT_PENDING" &&
    session.status !== "ENDED"
  ) {
    return failure("This session cannot be edited");
  }

  const cafeOnly = session.status === "ACTIVE";
  const gameAmount = cafeOnly
    ? session.gameChargeAmount
    : Math.round(parsed.data.gameAmount);

  if (!cafeOnly) {
    if (gameAmount > 0) {
      if (session.gameEntryId) {
        const entry = await NotebookEntry.findById(session.gameEntryId);
        if (entry) {
          entry.amount = gameAmount;
          await entry.save();
        }
      } else {
        const gameType = poolMiniGameType(session.tableId);
        const gameEntry = await NotebookEntry.create({
          section: session.tableId,
          type: gameType,
          amount: gameAmount,
          sessionId: session._id,
          rateType: session.rateType,
          customerName: "",
          phoneNumber: "",
          status: "PENDING",
          createdBy: authResult.session.user.username,
          createdByStaffId: new mongoose.Types.ObjectId(authResult.session.user.id),
        });
        session.gameEntryId = gameEntry._id;
      }
    } else if (session.gameEntryId) {
      const entry = await NotebookEntry.findById(session.gameEntryId);
      if (entry) {
        entry.amount = 0;
        await entry.save();
      }
    }
    session.gameChargeAmount = gameAmount;
  }

  for (const item of parsed.data.cafeItems) {
    const entry = await NotebookEntry.findById(item.entryId);
    if (
      !entry ||
      entry.sessionId?.toString() !== session._id.toString() ||
      entry.section !== CAFE_SECTION
    ) {
      return failure("Cafe item not found for this session");
    }
    if (entry.status === "PAID") {
      return failure("Paid cafe items cannot be edited");
    }
    const amount = Math.round(item.amount);
    const quantity = entry.quantity ?? 1;
    if (quantity > 1) {
      entry.unitPrice = Math.max(1, Math.round(amount / quantity));
      entry.amount = entry.unitPrice * quantity;
    } else {
      entry.unitPrice = amount;
      entry.quantity = 1;
      entry.amount = amount;
    }
    await entry.save();
  }

  await session.save();

  const cafeChargeAmount = await sumCafeChargesForSession(session._id.toString());
  revalidateCounterPaths();
  return success(toTableSessionDTO(session, cafeChargeAmount));
}

export async function updateSessionGameAmount(
  formData: FormData
): Promise<ActionResult<TableSessionDTO>> {
  const billForm = new FormData();
  const sessionId = formData.get("sessionId");
  const amount = formData.get("amount");
  if (sessionId) billForm.set("sessionId", String(sessionId));
  if (amount != null) billForm.set("gameAmount", String(amount));
  billForm.set("cafeItems", "[]");
  return updateSessionBillAmounts(billForm);
}

async function resolveSessionDefaultPayer(
  session: TableSessionDTO
): Promise<CustomerDTO | null> {
  const primary = session.assignedCustomers[0];
  if (!primary?.customerId) return null;

  const customer = await Customer.findById(primary.customerId).lean();
  if (!customer || !customer.isActive) return null;

  return toCustomerDTO(customer);
}

export type UnpaidSessionOption = {
  sessionId: string;
  displayLabel: string;
};

export async function getUnpaidSessionsForCafeTable(
  tableId: PoolMiniTableId
): Promise<UnpaidSessionOption[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const sessions = await TableSession.find({
    tableId,
    status: { $in: [...UNPAID_TABLE_SESSION_STATUSES] },
  })
    .sort({ endedAt: -1 })
    .lean();

  return sessions.map((session) => ({
    sessionId: session._id.toString(),
    displayLabel: formatTableSessionLabel(
      session.tableId,
      session.tableSessionNumber ?? session.sessionNumber
    ),
  }));
}

export async function getSessionCheckoutDetails(
  sessionId: string
): Promise<SessionCheckoutDetailsDTO | null> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return null;
  }

  await connectDB();

  const session = await TableSession.findById(sessionId);
  if (!session) return null;

  const cafeChargeAmount = await sumCafeChargesForSession(sessionId);
  const sessionDto = toTableSessionDTO(session, cafeChargeAmount);

  const entries = await NotebookEntry.find({
    sessionId,
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
  })
    .sort({ createdAt: 1 })
    .lean();

  const defaultPayer = await resolveSessionDefaultPayer(sessionDto);

  return {
    session: sessionDto,
    timeline: buildCompactSessionCheckoutTimeline(
      sessionDto,
      entries.map((entry) => toNotebookEntryDTO(entry))
    ),
    defaultPayer,
  };
}
