import type { CafeAddItemTarget } from "@/components/counter/CafeAddItemDialog";
import {
  CAFE_TABLE_IDS,
  type CafeTableId,
} from "@/lib/constants/counter-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { NotebookEntryDTO, TableSessionDTO } from "@/types";

export function isCafeTableSection(section: string): section is CafeTableId {
  return (CAFE_TABLE_IDS as readonly string[]).includes(section);
}

export function buildCafeTargetFromCustomer(
  customerId: string,
  customerName: string
): CafeAddItemTarget {
  return { kind: "customer", id: customerId, name: customerName };
}

export function buildCafeTargetFromEntry(
  entry: NotebookEntryDTO
): CafeAddItemTarget | null {
  if (entry.customerId) {
    return buildCafeTargetFromCustomer(
      entry.customerId,
      entry.customerName?.trim() || "Customer"
    );
  }
  if (isCafeTableSection(entry.section)) {
    return {
      kind: "table",
      tableId: entry.section,
      name: sectionLabel(entry.section),
    };
  }
  return null;
}

export function buildCafeTargetFromSession(
  session: TableSessionDTO,
  tableName?: string
): CafeAddItemTarget {
  return {
    kind: "table",
    tableId: session.tableId as CafeTableId,
    name: tableName ?? sectionLabel(session.tableId),
    sessionId: session.id,
    hasActiveSession: session.status === "ACTIVE",
  };
}
