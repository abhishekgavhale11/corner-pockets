"use server";

import type { PipelineStage } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import {
  CAFE_SECTION,
  CAFE_TABLE_IDS,
} from "@/lib/constants/counter-sections";
import { ACTIVE_TABLE_SESSION_STATUSES } from "@/lib/constants/table-sessions";
import { toTableSessionDTO } from "@/lib/mappers/table-session";
import {
  notebookCustomerSearchSchema,
  sectionLedgerSchema,
} from "@/lib/validators/notebook";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { toCustomerDTO } from "@/lib/mappers";
import Customer from "@/models/Customer";
import NotebookEntry from "@/models/NotebookEntry";
import TableSession from "@/models/TableSession";
import type { CustomerDTO, NotebookEntryDTO, TableSessionDTO } from "@/types";

function getDayBounds(dateInput?: string) {
  const date = dateInput ? new Date(dateInput) : new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function getSectionLedger(
  section: NotebookSection,
  dateInput?: string
): Promise<NotebookEntryDTO[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  const parsed = sectionLedgerSchema.safeParse({ section, date: dateInput });
  if (!parsed.success) {
    return [];
  }

  const { start, end } = getDayBounds(parsed.data.date);

  await connectDB();

  const entries = await NotebookEntry.find({
    section: parsed.data.section,
    createdAt: { $gte: start, $lte: end },
  })
    .sort({ createdAt: 1 })
    .lean();

  return entries.map((entry) => toNotebookEntryDTO(entry));
}

export async function getRecentNotebookCustomers(
  limit = 15
): Promise<CustomerDTO[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const pipeline: PipelineStage[] = [
    { $match: { customerId: { $exists: true, $ne: null } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$customerId",
        lastUsedAt: { $first: "$createdAt" },
      },
    },
    { $sort: { lastUsedAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "customers",
        localField: "_id",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: "$customer" },
    { $match: { "customer.isActive": true } },
  ];

  const results = await NotebookEntry.aggregate<{
    customer: Parameters<typeof toCustomerDTO>[0];
  }>(pipeline);

  return results.map((row) => toCustomerDTO(row.customer));
}

export async function searchNotebookCustomers(
  query?: string,
  options?: { alphabetical?: boolean }
): Promise<CustomerDTO[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  const parsed = notebookCustomerSearchSchema.safeParse({ query });
  const term = parsed.success ? parsed.data.query?.trim() : undefined;

  if (!term) {
    if (options?.alphabetical) {
      await connectDB();
      const customers = await Customer.find({ isActive: true })
        .collation({ locale: "en", strength: 2 })
        .sort({ name: 1 })
        .limit(500)
        .lean();
      return customers.map((customer) => toCustomerDTO(customer));
    }
    return getRecentNotebookCustomers();
  }

  await connectDB();

  const customers = await Customer.find({
    isActive: true,
    $or: [
      { name: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { cardId: { $regex: term, $options: "i" } },
    ],
  })
    .collation({ locale: "en", strength: 2 })
    .sort({ name: 1 })
    .limit(options?.alphabetical ? 50 : 20)
    .lean();

  return customers.map((customer) => toCustomerDTO(customer));
}

export async function getCustomerCardIdMap(
  customerIds: string[]
): Promise<Record<string, string>> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return {};
  }

  const uniqueIds = [...new Set(customerIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return {};
  }

  await connectDB();

  const customers = await Customer.find({
    _id: { $in: uniqueIds },
    isActive: true,
  })
    .select("_id cardId")
    .lean();

  return Object.fromEntries(
    customers.map((customer) => [
      customer._id.toString(),
      customer.cardId?.trim() ?? "",
    ])
  );
}

export type CafePageData = {
  cafeEntries: NotebookEntryDTO[];
  gameEntries: NotebookEntryDTO[];
  cardIdByCustomerId: Record<string, string>;
  poolMiniSessions: TableSessionDTO[];
};

export async function getCafePageData(): Promise<CafePageData> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return {
      cafeEntries: [],
      gameEntries: [],
      cardIdByCustomerId: {},
      poolMiniSessions: [],
    };
  }

  const { start, end } = getDayBounds();
  await connectDB();

  const [cafeEntries, gameEntries, openSessions] = await Promise.all([
    NotebookEntry.find({
      section: CAFE_SECTION,
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: 1 })
      .lean(),
    NotebookEntry.find({
      section: { $in: [...CAFE_TABLE_IDS] },
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: 1 })
      .lean(),
    TableSession.find({
      status: { $in: [...ACTIVE_TABLE_SESSION_STATUSES] },
    }).lean(),
  ]);

  const cafeDtos = cafeEntries.map((entry) => toNotebookEntryDTO(entry));
  const customerIds = [
    ...new Set(
      cafeDtos
        .map((entry) => entry.customerId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const customers = await Customer.find({
    _id: { $in: customerIds },
    isActive: true,
  })
    .select("_id cardId")
    .lean();

  const cardIdByCustomerId = Object.fromEntries(
    customers.map((customer) => [
      customer._id.toString(),
      customer.cardId?.trim() ?? "",
    ])
  );

  const poolMiniSessions = await Promise.all(
    openSessions.map(async (session) => {
      const cafeChargeAmount = cafeDtos
        .filter(
          (entry) =>
            entry.sessionId === session._id.toString() &&
            entry.status !== "PAID" &&
            entry.status !== "CANCELLED"
        )
        .reduce((sum, entry) => sum + entry.amount, 0);
      return toTableSessionDTO(session, cafeChargeAmount);
    })
  );

  return {
    cafeEntries: cafeDtos,
    gameEntries: gameEntries.map((entry) => toNotebookEntryDTO(entry)),
    cardIdByCustomerId,
    poolMiniSessions,
  };
}
