"use server";

import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { CAFE_SECTION } from "@/lib/constants/counter-sections";
import {
  ACTIVE_TABLE_SESSION_STATUSES,
  UNPAID_TABLE_SESSION_STATUSES,
  isBigSnookerTableId,
  isPoolMiniTableId,
  poolMiniGameType,
  type BigSnookerTableId,
  type PoolMiniTableId,
  type TableSessionTableId,
} from "@/lib/constants/table-sessions";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import {
  inferRateTypeFromStoredAmount,
} from "@/lib/constants/counter-rates";
import { toTableSessionDTO } from "@/lib/mappers/table-session";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { withLiveCustomerNamesOnTableSessions } from "@/lib/counter/live-customer-names";
import { toCustomerDTO } from "@/lib/mappers";
import { generateTableSessionNumber, generateTableLocalSessionNumber } from "@/lib/table-sessions/session-number";
import { getOpenBusinessDayContext } from "@/lib/business-day/require-open-business-day";
import {
  calculateSessionGameCharge,
  resolveHourlyRate,
} from "@/lib/utils/session-billing";
import { computeActivePlayMs } from "@/lib/utils/session-timer";
import {
  startTableSessionSchema,
  startBigSnookerSessionSchema,
  tableSessionActionSchema,
  assignTableSessionCustomersSchema,
  updateSessionBillAmountsSchema,
  setBigSnookerSessionGameSchema,
} from "@/lib/validators/table-sessions";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import { revalidateCounterPaths } from "@/lib/utils/revalidate-counter";
import NotebookEntry from "@/models/NotebookEntry";
import TableSession from "@/models/TableSession";
import {
  buildTableSessionHistoryRow,
  isHistorySessionRow,
} from "@/lib/utils/table-session-history";
import type {
  PoolMiniTableSummaryDTO,
  SessionCheckoutDetailsDTO,
  CompactSessionCheckoutLineDTO,
  SessionCafeEditItemDTO,
  TableSessionDTO,
  TableSessionHistoryDTO,
  CustomerDTO,
  NotebookEntryDTO,
} from "@/types";
import { CHECKOUT_ELIGIBLE_STATUSES } from "@/lib/constants/notebook-payments";
import { entryAmountRemaining } from "@/lib/utils/entry-contributors";
import { formatTableSessionLabel } from "@/lib/utils/session-display";
import { formatCafeItemLabel, getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import Customer from "@/models/Customer";

export type BigSnookerSessionBoardData = {
  tables: {
    tableId: BigSnookerTableId;
    session: TableSessionDTO | null;
    pendingCheckouts: TableSessionDTO[];
    summary: PoolMiniTableSummaryDTO;
    history: TableSessionHistoryDTO[];
    canStartNewSession: boolean;
  }[];
};

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

async function sumCafeChargesForSession(sessionId: string): Promise<number> {
  const entries = await NotebookEntry.find({
    sessionId,
    section: CAFE_SECTION,
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
  }).lean();

  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}


async function findActiveSessionForTable(tableId: TableSessionTableId) {
  return TableSession.findOne({
    tableId,
    status: { $in: [...ACTIVE_TABLE_SESSION_STATUSES] },
  }).sort({ startedAt: -1 });
}

async function findPendingCheckoutSessionsForTable(tableId: TableSessionTableId) {
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

  const tableIds: PoolMiniTableId[] = ["MINI_SNOOKER", "POOL_1", "POOL_2"];

  const openDay = await getOpenBusinessDayContext();
  if (!openDay) {
    return {
      tables: tableIds.map((tableId) => ({
        tableId,
        session: null,
        pendingCheckouts: [],
        summary: { revenueToday: 0, sessionsToday: 0, pendingCount: 0 },
        history: [],
        canStartNewSession: true,
      })),
    };
  }

  const todaySessions = await TableSession.find({
    tableId: { $in: tableIds },
    businessDayId: openDay.businessDayId,
  })
    .sort({ startedAt: -1 })
    .lean();

  const sessionIds = todaySessions.map((s) => s._id);
  const allEntries = sessionIds.length
    ? await NotebookEntry.find({ sessionId: { $in: sessionIds } }).lean()
    : [];

  // Settlements removed with Financial Engine V1 - history uses entry status only.

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
          return buildTableSessionHistoryRow(
            session,
            allEntries,
            []
          );
        });

      const historyIds = new Set(historyRows.map((row) => row.sessionId));
      for (const pending of pendingSessions) {
        const pendingId = pending._id.toString();
        if (historyIds.has(pendingId)) continue;
        historyRows.push(
          buildTableSessionHistoryRow(pending, allEntries, [])
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

  const sessionDtos = tables.flatMap((table) => [
    ...(table.session ? [table.session] : []),
    ...table.pendingCheckouts,
  ]);
  const liveSessions = await withLiveCustomerNamesOnTableSessions(sessionDtos);
  const liveById = new Map(liveSessions.map((session) => [session.id, session]));

  return {
    tables: tables.map((table) => ({
      ...table,
      session: table.session
        ? (liveById.get(table.session.id) ?? table.session)
        : null,
      pendingCheckouts: table.pendingCheckouts.map(
        (session) => liveById.get(session.id) ?? session
      ),
    })),
  };
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
      `${sectionLabel(existing.tableId)} already has a session in play (${label}). End or pause it before starting another â€” unpaid ended sessions do not block a new start.`
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

  const activeMs = computeActivePlayMs({
    status: "ENDED",
    startedAt: session.startedAt,
    pausedAt: undefined,
    endedAt: now,
    totalPausedMs: session.totalPausedMs,
    now,
  });

  if (isBigSnookerTableId(session.tableId)) {
    session.status = "STOPPED";
    session.endedAt = now;
    session.activePlayMs = activeMs;
    session.gameChargeAmount = 0;
    session.rateType = undefined;
    session.hourlyRate = 0;
    appendAudit(
      session,
      "STOPPED",
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

  if (!session.rateType) {
    return failure("Session rate type is missing");
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

export async function startBigSnookerSession(
  formData: FormData
): Promise<ActionResult<TableSessionDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = startBigSnookerSessionSchema.safeParse({
    tableId: formData.get("tableId"),
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
      `${sectionLabel(existing.tableId)} already has a session in play (${label}). Stop it before starting another.`
    );
  }

  try {
    const [sessionNumber, tableSessionNumber] = await Promise.all([
      generateTableSessionNumber(),
      generateTableLocalSessionNumber(parsed.data.tableId),
    ]);
    const now = new Date();

    const session = await TableSession.create({
      sessionNumber,
      tableSessionNumber,
      tableId: parsed.data.tableId,
      status: "ACTIVE",
      startedAt: now,
      totalPausedMs: 0,
      activePlayMs: 0,
      hourlyRate: 0,
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
    console.error("startBigSnookerSession failed:", error);
    return failure("Failed to start session");
  }
}

export async function getBigSnookerSessionBoardData(): Promise<BigSnookerSessionBoardData> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return {
      tables: ["BIG_SNOOKER_1", "BIG_SNOOKER_2", "BIG_SNOOKER_3"].map(
        (tableId) => ({
          tableId: tableId as BigSnookerTableId,
          session: null,
          pendingCheckouts: [],
          summary: { revenueToday: 0, sessionsToday: 0, pendingCount: 0 },
          history: [],
          canStartNewSession: true,
        })
      ),
    };
  }

  await connectDB();

  const tableIds: BigSnookerTableId[] = [
    "BIG_SNOOKER_1",
    "BIG_SNOOKER_2",
    "BIG_SNOOKER_3",
  ];

  const openDay = await getOpenBusinessDayContext();
  if (!openDay) {
    return {
      tables: tableIds.map((tableId) => ({
        tableId,
        session: null,
        pendingCheckouts: [],
        summary: { revenueToday: 0, sessionsToday: 0, pendingCount: 0 },
        history: [],
        canStartNewSession: true,
      })),
    };
  }

  const todaySessions = await TableSession.find({
    tableId: { $in: tableIds },
    businessDayId: openDay.businessDayId,
  })
    .sort({ startedAt: -1 })
    .lean();

  const sessionIds = todaySessions.map((s) => s._id);
  const allEntries = sessionIds.length
    ? await NotebookEntry.find({ sessionId: { $in: sessionIds } }).lean()
    : [];

  // Settlements removed with Financial Engine V1 - history uses entry status only.

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
          return buildTableSessionHistoryRow(
            session,
            allEntries,
            []
          );
        });

      const historyIds = new Set(historyRows.map((row) => row.sessionId));
      for (const pending of pendingSessions) {
        const pendingId = pending._id.toString();
        if (historyIds.has(pendingId)) continue;
        historyRows.push(
          buildTableSessionHistoryRow(pending, allEntries, [])
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

export async function setBigSnookerSessionGameCharge(
  formData: FormData
): Promise<ActionResult<TableSessionDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = setBigSnookerSessionGameSchema.safeParse({
    sessionId: formData.get("sessionId"),
    snookerGame: formData.get("snookerGame"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const session = await TableSession.findById(parsed.data.sessionId);
  if (!session) {
    return failure("Session not found");
  }
  if (!isBigSnookerTableId(session.tableId)) {
    return failure("Game charge only applies to Big Snooker time sessions");
  }
  if (session.status !== "STOPPED") {
    return failure("Set the game charge after the session is stopped");
  }

  const amount = Math.round(parsed.data.amount);
  const rateType =
    inferRateTypeFromStoredAmount("SNOOKER", amount, parsed.data.snookerGame) ??
    "REGULAR";

  if (session.gameEntryId) {
    const entry = await NotebookEntry.findById(session.gameEntryId);
    if (!entry) {
      return failure("Game entry not found");
    }
    entry.amount = amount;
    entry.snookerGame = parsed.data.snookerGame;
    entry.rateType = rateType;
    await entry.save();
  } else {
    const gameEntry = await NotebookEntry.create({
      section: session.tableId,
      type: "SNOOKER",
      amount,
      snookerGame: parsed.data.snookerGame,
      rateType,
      sessionId: session._id,
      customerName: "",
      phoneNumber: "",
      status: "PENDING",
      createdBy: authResult.session.user.username,
      createdByStaffId: new mongoose.Types.ObjectId(authResult.session.user.id),
    });
    session.gameEntryId = gameEntry._id;
  }

  session.rateType = rateType;
  session.gameChargeAmount = amount;
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

/** Ensures a payable notebook line exists for a stopped session checkout. */
export async function ensureSessionGameEntryForCheckout(
  sessionId: string,
  staff: { id: string; username: string }
): Promise<void> {
  await connectDB();
  const session = await TableSession.findById(sessionId);
  if (!session || session.gameChargeAmount <= 0) {
    return;
  }
  if (!isPoolMiniTableId(session.tableId)) {
    return;
  }

  if (session.gameEntryId) {
    const existingEntry = await NotebookEntry.findById(session.gameEntryId);
    if (existingEntry) {
      if (existingEntry.amount !== session.gameChargeAmount) {
        existingEntry.amount = session.gameChargeAmount;
        await existingEntry.save();
      }
      return;
    }
  }

  const gameType = poolMiniGameType(session.tableId);
  const gameEntry = await NotebookEntry.create({
    section: session.tableId,
    type: gameType,
    amount: session.gameChargeAmount,
    sessionId: session._id,
    rateType: session.rateType,
    customerName: "",
    phoneNumber: "",
    status: "PENDING",
    createdBy: staff.username,
    createdByStaffId: new mongoose.Types.ObjectId(staff.id),
  });
  session.gameEntryId = gameEntry._id;
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

  return mapSessionCafeEditItems(entries);
}

function mapSessionCafeEditItem(
  entry: NotebookEntryDTO
): SessionCafeEditItemDTO {
  const quantity = entry.quantity ?? 1;
  const unitPrice =
    entry.unitPrice ?? (quantity > 0 ? Math.round(entry.amount / quantity) : entry.amount);
  return {
    entryId: entry.id,
    label: formatCafeItemLabel(entry),
    amount: entry.amount,
    itemType: entry.type,
    itemNote: entry.itemNote,
    unitPrice,
    quantity,
    isLocked: entry.isLocked ?? false,
  };
}

async function mapSessionCafeEditItems(
  entries: Parameters<typeof toNotebookEntryDTO>[0][]
): Promise<SessionCafeEditItemDTO[]> {
  return entries
    .map((entry) => toNotebookEntryDTO(entry))
    .map((entry) => mapSessionCafeEditItem(entry));
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

  return mapSessionCafeEditItems(entries);
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

  const canEditSingleGameEntry =
    isPoolMiniTableId(session.tableId) ||
    (isBigSnookerTableId(session.tableId) && Boolean(session.gameEntryId));

  if (!cafeOnly && canEditSingleGameEntry) {
    if (gameAmount > 0) {
      if (session.gameEntryId) {
        const entry = await NotebookEntry.findById(session.gameEntryId);
        if (entry) {
          entry.amount = gameAmount;
          await entry.save();
        }
      } else if (isPoolMiniTableId(session.tableId)) {
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


function gameTimeLabel(tableId: TableSessionDTO["tableId"]): string {
  if (isBigSnookerTableId(tableId)) {
    return "Snooker Time";
  }
  return poolMiniGameType(tableId) === "POOL" ? "Pool Time" : "Mini Time";
}

function lineSortTime(line: CompactSessionCheckoutLineDTO): number {
  if (line.kind === "game") {
    return new Date(line.endAt).getTime();
  }
  return new Date(line.at).getTime();
}

function buildCompactSessionCheckoutTimeline(
  session: TableSessionDTO,
  entries: NotebookEntryDTO[]
): CompactSessionCheckoutLineDTO[] {
  const lines: CompactSessionCheckoutLineDTO[] = [];

  const gameEntry = entries.find(
    (entry) =>
      entry.section !== CAFE_SECTION && entry.sessionId === session.id
  );

  if (gameEntry) {
    const remaining = entryAmountRemaining(gameEntry);
    if (remaining > 0) {
      lines.push({
        kind: "game",
        startAt: session.startedAt,
        endAt: session.endedAt ?? session.startedAt,
        durationMs: session.activePlayMs,
        label: isBigSnookerTableId(session.tableId)
          ? getEntryDisplayLabel(gameEntry)
          : gameTimeLabel(session.tableId),
        amount: remaining,
      });
    }
  } else if (session.gameChargeAmount > 0) {
    lines.push({
      kind: "game",
      startAt: session.startedAt,
      endAt: session.endedAt ?? session.startedAt,
      durationMs: session.activePlayMs,
      label: gameTimeLabel(session.tableId),
      amount: session.gameChargeAmount,
    });
  }

  for (const entry of entries) {
    if (entry.section !== CAFE_SECTION || entry.customerId) continue;
    const remaining = entryAmountRemaining(entry);
    if (remaining <= 0) continue;
    lines.push({
      kind: "cafe",
      at: entry.createdAt,
      label: getEntryDisplayLabel(entry),
      amount: remaining,
    });
  }

  return lines.sort((a, b) => lineSortTime(a) - lineSortTime(b));
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
