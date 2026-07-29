import {
  getBusinessDayHistoryListAction,
  getOutstandingCollectionLedgerAction,
} from "@/actions/business-day-history";
import {
  BusinessDayHistoryFilters,
  BusinessDayHistoryTabs,
  type BusinessDayHistoryListTab,
} from "@/components/business-day/BusinessDayHistoryFilters";
import { BusinessDayHistoryList } from "@/components/business-day/BusinessDayHistoryList";
import { BusinessDayHistorySummary } from "@/components/business-day/BusinessDayHistorySummary";
import { OutstandingCollectionLedger } from "@/components/business-day/OutstandingCollectionLedger";
import { HistoryPageLayout } from "@/components/business-day/history";
import { getDefaultBusinessDayHistoryRange } from "@/lib/utils/business-date";

interface BusinessDayHistoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function readTab(
  value: string | string[] | undefined
): BusinessDayHistoryListTab {
  const raw = readParam(value);
  if (raw === "outstanding") return "outstanding";
  return "days";
}

export default async function BusinessDayHistoryPage({
  searchParams,
}: BusinessDayHistoryPageProps) {
  const params = await searchParams;
  const defaults = getDefaultBusinessDayHistoryRange();
  const from = readParam(params.from) ?? defaults.from;
  const to = readParam(params.to) ?? defaults.to;
  const tab = readTab(params.tab);

  const [listResult, ledgerResult] = await Promise.all([
    tab === "days"
      ? getBusinessDayHistoryListAction({ from, to })
      : Promise.resolve(null),
    tab === "outstanding"
      ? getOutstandingCollectionLedgerAction({ from, to })
      : Promise.resolve(null),
  ]);

  const filterFrom = listResult?.from ?? ledgerResult?.from ?? from;
  const filterTo = listResult?.to ?? ledgerResult?.to ?? to;

  return (
    <HistoryPageLayout
      title="Business Day History"
      subtitle="Closed Business Days and Outstanding collections — read-only."
      tabs={<BusinessDayHistoryTabs tab={tab} from={filterFrom} to={filterTo} />}
      filters={
        <BusinessDayHistoryFilters
          key={`${tab}-${filterFrom}-${filterTo}`}
          from={filterFrom}
          to={filterTo}
          tab={tab}
        />
      }
    >
      {tab === "days" && listResult ? (
        <>
          <BusinessDayHistorySummary
            summary={listResult.summary}
            from={listResult.from}
            to={listResult.to}
          />
          <BusinessDayHistoryList items={listResult.items} />
        </>
      ) : null}

      {tab === "outstanding" && ledgerResult ? (
        <OutstandingCollectionLedger ledger={ledgerResult} />
      ) : null}
    </HistoryPageLayout>
  );
}
