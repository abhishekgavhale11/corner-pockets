"use client";

import { useCallback, useState } from "react";
import { getUnpaidSessionsForCafeTable } from "@/actions/table-sessions";
import type { CafeAddItemTarget } from "@/components/counter/CafeAddItemDialog";
import {
  buildCafeTargetFromCustomer,
  buildCafeTargetFromEntry,
  buildCafeTargetFromSession,
} from "@/lib/utils/cafe-add-target";
import type { CafeTableId } from "@/lib/constants/counter-sections";
import { isPoolMiniTableId } from "@/lib/constants/table-sessions";
import type { NotebookEntryDTO, TableSessionDTO } from "@/types";

export function useCafeAddItem() {
  const [cafeTarget, setCafeTarget] = useState<CafeAddItemTarget | null>(null);

  const closeCafe = useCallback(() => {
    setCafeTarget(null);
  }, []);

  const openCafeForEntry = useCallback((entry: NotebookEntryDTO) => {
    const target = buildCafeTargetFromEntry(entry);
    if (target) {
      setCafeTarget(target);
    }
  }, []);

  const openCafeForCustomer = useCallback(
    (customerId: string, customerName: string) => {
      setCafeTarget(buildCafeTargetFromCustomer(customerId, customerName));
    },
    []
  );

  const openCafeForSession = useCallback(
    (session: TableSessionDTO, tableName?: string) => {
      setCafeTarget(buildCafeTargetFromSession(session, tableName));
    },
    []
  );

  const openCafeForTable = useCallback(
    async (
      tableId: CafeTableId,
      name: string,
      options?: {
        sessionId?: string;
        hasActiveSession?: boolean;
      }
    ) => {
      if (options?.sessionId) {
        setCafeTarget({
          kind: "table",
          tableId,
          name,
          sessionId: options.sessionId,
          hasActiveSession: options.hasActiveSession,
        });
        return;
      }

      if (isPoolMiniTableId(tableId)) {
        const unpaidSessions = await getUnpaidSessionsForCafeTable(tableId);
        setCafeTarget({
          kind: "table",
          tableId,
          name,
          hasActiveSession: options?.hasActiveSession ?? false,
          unpaidSessions,
        });
        return;
      }

      setCafeTarget({ kind: "table", tableId, name });
    },
    []
  );

  return {
    cafeTarget,
    closeCafe,
    openCafeForEntry,
    openCafeForCustomer,
    openCafeForSession,
    openCafeForTable,
  };
}
