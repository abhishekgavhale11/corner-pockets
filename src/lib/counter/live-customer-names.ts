import Customer from "@/models/Customer";
import type { CafeOrderDTO } from "@/lib/mappers/cafe-order";
import type { NotebookEntryDTO, TableSessionDTO } from "@/types";

export async function loadLiveCustomerNamesById(
  customerIds: Iterable<string | undefined | null>
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      [...customerIds].filter((id): id is string => Boolean(id && id.trim()))
    ),
  ];
  if (ids.length === 0) {
    return new Map();
  }

  const rows = await Customer.find({ _id: { $in: ids } })
    .select("_id name")
    .lean();

  return new Map(rows.map((row) => [row._id.toString(), row.name]));
}

function displayName(
  names: Map<string, string>,
  customerId: string | undefined,
  fallback: string
): string {
  if (!customerId) return fallback;
  return names.get(customerId) ?? fallback;
}

function collectNotebookCustomerIds(entries: NotebookEntryDTO[]): string[] {
  const ids: string[] = [];
  for (const entry of entries) {
    if (entry.customerId) ids.push(entry.customerId);
    for (const contributor of entry.contributors ?? []) {
      if (contributor.customerId) ids.push(contributor.customerId);
    }
  }
  return ids;
}

export async function withLiveCustomerNamesOnNotebookEntries(
  entries: NotebookEntryDTO[]
): Promise<NotebookEntryDTO[]> {
  const names = await loadLiveCustomerNamesById(
    collectNotebookCustomerIds(entries)
  );
  return entries.map((entry) => ({
    ...entry,
    customerName: displayName(names, entry.customerId, entry.customerName),
    contributors: entry.contributors?.map((contributor) => ({
      ...contributor,
      customerName: displayName(
        names,
        contributor.customerId,
        contributor.customerName
      ),
    })),
  }));
}

export async function withLiveCustomerNamesOnTableSessions(
  sessions: TableSessionDTO[]
): Promise<TableSessionDTO[]> {
  const names = await loadLiveCustomerNamesById(
    sessions.flatMap((session) =>
      session.assignedCustomers.map((row) => row.customerId)
    )
  );

  return sessions.map((session) => {
    const assignedCustomers = session.assignedCustomers.map((row) => ({
      ...row,
      customerName: displayName(names, row.customerId, row.customerName),
    }));
    return {
      ...session,
      assignedCustomers,
      assignedCustomerNames: assignedCustomers.map((row) => row.customerName),
    };
  });
}

export async function withLiveCustomerNamesOnCafeOrders(
  orders: CafeOrderDTO[]
): Promise<CafeOrderDTO[]> {
  const names = await loadLiveCustomerNamesById(
    orders.map((order) => order.customerId)
  );
  return orders.map((order) => ({
    ...order,
    customerName: displayName(names, order.customerId, order.customerName),
  }));
}
