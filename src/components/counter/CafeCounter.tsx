"use client";

import { useEffect, useMemo, useState } from "react";
import type { CafeTableId } from "@/lib/constants/counter-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { isPoolMiniTableId } from "@/lib/constants/table-sessions";
import { getUnpaidSessionsForCafeTable } from "@/actions/table-sessions";
import {
  buildCafeOpenTabs,
  matchesCafeTabSearch,
  mergeCafeTabsWithStaged,
  type CafeOpenTab,
} from "@/lib/utils/cafe-tabs";
import type { CustomerDTO, NotebookEntryDTO, TableSessionDTO } from "@/types";
import { CafeCustomerTabs } from "@/components/counter/CafeCustomerTabs";
import { CafeNewTabDialog } from "@/components/counter/CafeNewTabDialog";
import { CafeExistingCustomerDialog } from "@/components/counter/CafeExistingCustomerDialog";
import { CafeTableTabDialog } from "@/components/counter/CafeTableTabDialog";
import {
  CafeAddItemDialog,
  type CafeAddItemTarget,
} from "@/components/counter/CafeAddItemDialog";
import { CafeEditPickerDialog } from "@/components/counter/CafeEditPickerDialog";
import { CafeEntryEditDialog } from "@/components/counter/CafeEntryEditDialog";
import { formatCurrency } from "@/lib/utils/format";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CafeCounterProps {
  cafeEntries: NotebookEntryDTO[];
  gameEntries: NotebookEntryDTO[];
  cardIdByCustomerId?: Record<string, string>;
  poolMiniSessions?: TableSessionDTO[];
}

export function CafeCounter({
  cafeEntries,
  gameEntries,
  cardIdByCustomerId = {},
  poolMiniSessions = [],
}: CafeCounterProps) {
  const [tabFilter, setTabFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewTab, setShowNewTab] = useState(false);
  const [showExistingCustomer, setShowExistingCustomer] = useState(false);
  const [showTableTab, setShowTableTab] = useState(false);
  const [stagedCustomers, setStagedCustomers] = useState<CustomerDTO[]>([]);
  const [stagedTableIds, setStagedTableIds] = useState<CafeTableId[]>([]);
  const [addItemTarget, setAddItemTarget] = useState<CafeAddItemTarget | null>(
    null
  );
  const [editTab, setEditTab] = useState<CafeOpenTab | null>(null);
  const [editingEntry, setEditingEntry] = useState<NotebookEntryDTO | null>(
    null
  );

  const entryTabs = useMemo(
    () =>
      buildCafeOpenTabs(
        cafeEntries,
        gameEntries,
        cardIdByCustomerId,
        poolMiniSessions
      ),
    [cafeEntries, gameEntries, cardIdByCustomerId, poolMiniSessions]
  );

  useEffect(() => {
    setStagedCustomers((prev) =>
      prev.filter(
        (customer) =>
          !entryTabs.some(
            (tab) => tab.kind === "customer" && tab.customerId === customer.id
          )
      )
    );
    setStagedTableIds((prev) =>
      prev.filter(
        (tableId) =>
          !entryTabs.some(
            (tab) => tab.kind === "table" && tab.tableId === tableId
          )
      )
    );
  }, [entryTabs]);

  const openTabs = useMemo(
    () => mergeCafeTabsWithStaged(entryTabs, stagedCustomers, stagedTableIds),
    [entryTabs, stagedCustomers, stagedTableIds]
  );

  const filteredTabs = useMemo(
    () => openTabs.filter((tab) => matchesCafeTabSearch(tab, tabFilter)),
    [openTabs, tabFilter]
  );

  const pendingCafeTotal = entryTabs.reduce(
    (sum, tab) => sum + (tab.kind === "table" ? tab.cafeTotal : tab.total),
    0
  );

  const openCustomerTab = (customer: CustomerDTO) => {
    setExpandedId(`customer:${customer.id}`);
    if (
      !entryTabs.some(
        (tab) => tab.kind === "customer" && tab.customerId === customer.id
      )
    ) {
      setStagedCustomers((prev) => [
        ...prev.filter((c) => c.id !== customer.id),
        customer,
      ]);
    }
  };

  const openTableTab = (tableId: CafeTableId) => {
    setExpandedId(`table:${tableId}`);
    if (
      !entryTabs.some(
        (tab) => tab.kind === "table" && tab.tableId === tableId
      )
    ) {
      setStagedTableIds((prev) => [
        ...prev.filter((id) => id !== tableId),
        tableId,
      ]);
    }
  };

  const handleNewTabCreated = (customer: CustomerDTO) => {
    openCustomerTab(customer);
    setAddItemTarget({ kind: "customer", id: customer.id, name: customer.name });
  };

  const handleExistingCustomerSelected = (customer: CustomerDTO) => {
    openCustomerTab(customer);
  };

  const openTableAddTarget = async (tableId: CafeTableId, name: string) => {
    if (isPoolMiniTableId(tableId)) {
      const unpaidSessions = await getUnpaidSessionsForCafeTable(tableId);
      const hasActiveSession = poolMiniSessions.some(
        (session) =>
          session.tableId === tableId &&
          (session.status === "ACTIVE" || session.status === "PAUSED")
      );
      setAddItemTarget({
        kind: "table",
        tableId,
        name,
        hasActiveSession,
        unpaidSessions,
      });
      return;
    }
    setAddItemTarget({ kind: "table", tableId, name });
  };

  const handleTableSelected = (tableId: CafeTableId) => {
    openTableTab(tableId);
    void openTableAddTarget(tableId, sectionLabel(tableId));
  };

  const handleAddItem = (tab: CafeOpenTab) => {
    if (tab.kind === "customer") {
      setAddItemTarget({
        kind: "customer",
        id: tab.customerId,
        name: tab.customerName,
      });
      return;
    }
    void openTableAddTarget(tab.tableId, tab.tableName);
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          value={tabFilter}
          onChange={(e) => setTabFilter(e.target.value)}
          placeholder="Filter open tabs"
          className="h-8 w-full max-w-[14rem] text-sm sm:max-w-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 shrink-0 px-2 text-xs font-semibold"
          onClick={() => setShowExistingCustomer(true)}
        >
          + Existing Customer
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 px-2 text-xs font-semibold"
          onClick={() => setShowNewTab(true)}
        >
          + New Customer
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 shrink-0 px-2 text-xs font-semibold"
          onClick={() => setShowTableTab(true)}
        >
          + Table Tab
        </Button>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>
          Open Tabs:{" "}
          <span className="font-bold text-gray-900">
            {tabFilter.trim()
              ? `${filteredTabs.length}/${openTabs.length}`
              : openTabs.length}
          </span>
        </span>
        <span>
          Pending Cafe Total:{" "}
          <span className="font-bold tabular-nums text-gray-900">
            {formatCurrency(
              tabFilter.trim()
                ? filteredTabs.reduce(
                    (sum, tab) =>
                      sum + (tab.kind === "table" ? tab.cafeTotal : tab.total),
                    0
                  )
                : pendingCafeTotal
            )}
          </span>
        </span>
      </div>

      {tabFilter.trim() && filteredTabs.length === 0 ? (
        <p className="py-3 text-center text-xs text-gray-500">
          No open tabs match this filter.
        </p>
      ) : (
        <CafeCustomerTabs
          tabs={filteredTabs}
          expandedId={expandedId}
          onToggleExpand={setExpandedId}
          onAddItem={handleAddItem}
          onEdit={setEditTab}
        />
      )}

      <CafeExistingCustomerDialog
        open={showExistingCustomer}
        onClose={() => setShowExistingCustomer(false)}
        onSelect={handleExistingCustomerSelected}
      />

      <CafeNewTabDialog
        open={showNewTab}
        onClose={() => setShowNewTab(false)}
        onCreated={handleNewTabCreated}
      />

      <CafeTableTabDialog
        open={showTableTab}
        onClose={() => setShowTableTab(false)}
        onSelect={handleTableSelected}
      />

      <CafeAddItemDialog
        target={addItemTarget}
        onClose={() => setAddItemTarget(null)}
      />

      <CafeEditPickerDialog
        tab={editTab}
        onClose={() => setEditTab(null)}
        onSelectEntry={setEditingEntry}
      />

      <CafeEntryEditDialog
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
      />
    </div>
  );
}
