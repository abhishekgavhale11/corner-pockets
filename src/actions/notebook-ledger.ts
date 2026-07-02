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
import { enrichEntriesWithEditLock } from "@/lib/visit-bill/entry-edit-lock";
import { reconcileEntryPaymentFields, repairCounterSnapshotsForEntries } from "@/lib/wallet/reconcile-entry-payments";
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

  const entryIds = entries.map((entry) => entry._id.toString());

  await reconcileEntryPaymentFields(entryIds);
  await repairCounterSnapshotsForEntries(entryIds);

  const refreshed = await NotebookEntry.find({
    _id: { $in: entryIds },
  })
    .sort({ createdAt: 1 })
    .lean();

  return enrichEntriesWithEditLock(
    refreshed.map((entry) => toNotebookEntryDTO(entry))
  );
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

export type AssignCustomerSuggestionGroupId =
  | "playing"
  | "recent"
  | "frequent"
  | "others";

export interface AssignCustomerSuggestionGroup {
  id: AssignCustomerSuggestionGroupId;
  label: string;
  customers: CustomerDTO[];
}

const ASSIGN_SUGGESTION_FREQUENT_LOOKBACK_DAYS = 60;
const ASSIGN_SUGGESTION_FREQUENT_LIMIT = 20;
const ASSIGN_SUGGESTION_OTHERS_LIMIT = 150;
const ASSIGN_SUGGESTION_SEARCH_LIMIT = 80;

function buildCustomerSearchFilter(term: string) {
  return {
    isActive: true,
    $or: [
      { name: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { cardId: { $regex: term, $options: "i" } },
    ],
  };
}

function customerMatchesSearch(
  customer: { name: string; phone?: string | null; cardId?: string | null },
  term: string
): boolean {
  const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return (
    pattern.test(customer.name) ||
    pattern.test(customer.phone ?? "") ||
    pattern.test(customer.cardId ?? "")
  );
}

function touchActivity(
  activityByCustomerId: Map<string, Date>,
  customerId: string,
  at: Date
) {
  const previous = activityByCustomerId.get(customerId);
  if (!previous || at > previous) {
    activityByCustomerId.set(customerId, at);
  }
}

export async function getAssignCustomerSuggestions(
  query?: string
): Promise<AssignCustomerSuggestionGroup[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  const parsed = notebookCustomerSearchSchema.safeParse({ query });
  const term = parsed.success ? parsed.data.query?.trim() : undefined;

  const { start, end } = getDayBounds();
  const frequentLookbackStart = new Date(start);
  frequentLookbackStart.setDate(
    frequentLookbackStart.getDate() - ASSIGN_SUGGESTION_FREQUENT_LOOKBACK_DAYS
  );

  await connectDB();

  const [activeSessions, todayEntries, frequentAgg, searchCustomers] =
    await Promise.all([
      TableSession.find({
        status: { $in: [...ACTIVE_TABLE_SESSION_STATUSES] },
      })
        .select("assignedCustomers")
        .lean(),
      NotebookEntry.find({
        createdAt: { $gte: start, $lte: end },
        status: { $ne: "CANCELLED" },
      })
        .select("customerId contributors createdAt status")
        .lean(),
      NotebookEntry.aggregate([
        {
          $match: {
            createdAt: { $gte: frequentLookbackStart, $lte: end },
            status: { $ne: "CANCELLED" },
          },
        },
        {
          $project: {
            ids: {
              $setUnion: [
                {
                  $cond: [
                    { $ifNull: ["$customerId", false] },
                    ["$customerId"],
                    [],
                  ],
                },
                {
                  $map: {
                    input: { $ifNull: ["$contributors", []] },
                    as: "contributor",
                    in: "$$contributor.customerId",
                  },
                },
              ],
            },
          },
        },
        { $unwind: "$ids" },
        { $group: { _id: "$ids", visitCount: { $sum: 1 } } },
        { $sort: { visitCount: -1 } },
        { $limit: ASSIGN_SUGGESTION_FREQUENT_LIMIT + 30 },
      ]),
      term
        ? Customer.find(buildCustomerSearchFilter(term))
            .collation({ locale: "en", strength: 2 })
            .sort({ name: 1 })
            .limit(ASSIGN_SUGGESTION_SEARCH_LIMIT)
            .lean()
        : Promise.resolve([]),
    ]);

  const playingIds = new Set<string>();
  const playingActivity = new Map<string, Date>();
  const todayActivity = new Map<string, Date>();

  for (const session of activeSessions) {
    for (const assigned of session.assignedCustomers ?? []) {
      const customerId = assigned.customerId.toString();
      playingIds.add(customerId);
      touchActivity(playingActivity, customerId, end);
    }
  }

  for (const entry of todayEntries) {
    const entryTime = entry.createdAt;
    const isOpenBill =
      entry.status === "PENDING" || entry.status === "REVERSED";

    if (entry.customerId) {
      const customerId = entry.customerId.toString();
      touchActivity(todayActivity, customerId, entryTime);
      if (isOpenBill) {
        playingIds.add(customerId);
        touchActivity(playingActivity, customerId, entryTime);
      }
    }

    for (const contributor of entry.contributors ?? []) {
      const customerId = contributor.customerId.toString();
      touchActivity(todayActivity, customerId, entryTime);
      if (isOpenBill && contributor.status === "PENDING") {
        playingIds.add(customerId);
        touchActivity(playingActivity, customerId, entryTime);
      }
    }
  }

  const recentIds = [...todayActivity.entries()]
    .filter(([customerId]) => !playingIds.has(customerId))
    .sort(([, left], [, right]) => right.getTime() - left.getTime())
    .map(([customerId]) => customerId);

  const recentIdSet = new Set(recentIds);

  const frequentIds = frequentAgg
    .map((row) => row._id.toString())
    .filter(
      (customerId) =>
        !playingIds.has(customerId) && !recentIdSet.has(customerId)
    )
    .slice(0, ASSIGN_SUGGESTION_FREQUENT_LIMIT);

  const prioritizedIds = [
    ...playingIds,
    ...recentIds,
    ...frequentIds,
    ...searchCustomers.map((customer) => customer._id.toString()),
  ];

  const uniquePrioritizedIds = [...new Set(prioritizedIds)];

  const prioritizedCustomers = uniquePrioritizedIds.length
    ? await Customer.find({
        _id: { $in: uniquePrioritizedIds },
        isActive: true,
      }).lean()
    : [];

  const customerById = new Map(
    prioritizedCustomers.map((customer) => [
      customer._id.toString(),
      customer,
    ])
  );

  const usedIds = new Set<string>();

  const takeGroup = (
    orderedIds: Iterable<string>,
    sortByActivity?: Map<string, Date>
  ): CustomerDTO[] => {
    const ids = [...orderedIds];
    if (sortByActivity) {
      ids.sort((left, right) => {
        const leftTime = sortByActivity.get(left)?.getTime() ?? 0;
        const rightTime = sortByActivity.get(right)?.getTime() ?? 0;
        if (leftTime !== rightTime) {
          return rightTime - leftTime;
        }
        const leftName = customerById.get(left)?.name ?? "";
        const rightName = customerById.get(right)?.name ?? "";
        return leftName.localeCompare(rightName, undefined, {
          sensitivity: "base",
        });
      });
    }

    const customers: CustomerDTO[] = [];
    for (const customerId of ids) {
      if (usedIds.has(customerId)) continue;
      const customer = customerById.get(customerId);
      if (!customer) continue;
      if (term && !customerMatchesSearch(customer, term)) continue;
      usedIds.add(customerId);
      customers.push(toCustomerDTO(customer));
    }
    return customers;
  };

  const groups: AssignCustomerSuggestionGroup[] = [
    {
      id: "playing",
      label: "Currently Playing",
      customers: takeGroup(playingIds, playingActivity),
    },
    {
      id: "recent",
      label: "Recent",
      customers: takeGroup(recentIds, todayActivity),
    },
    {
      id: "frequent",
      label: "Frequent",
      customers: takeGroup(frequentIds),
    },
  ];

  let others: CustomerDTO[] = [];
  if (term) {
    others = searchCustomers
      .filter((customer) => !usedIds.has(customer._id.toString()))
      .map((customer) => toCustomerDTO(customer));
  } else {
    const remainingCustomers = await Customer.find({
      isActive: true,
      _id: { $nin: [...usedIds] },
    })
      .collation({ locale: "en", strength: 2 })
      .sort({ name: 1 })
      .limit(ASSIGN_SUGGESTION_OTHERS_LIMIT)
      .lean();
    others = remainingCustomers.map((customer) => toCustomerDTO(customer));
  }

  groups.push({
    id: "others",
    label: "All Customers",
    customers: others,
  });

  return groups.filter((group) => group.customers.length > 0);
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

  const cafeDtos = await enrichEntriesWithEditLock(
    cafeEntries.map((entry) => toNotebookEntryDTO(entry))
  );
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
    gameEntries: await enrichEntriesWithEditLock(
      gameEntries.map((entry) => toNotebookEntryDTO(entry))
    ),
    cardIdByCustomerId,
    poolMiniSessions,
  };
}
