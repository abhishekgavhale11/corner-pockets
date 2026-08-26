import {
  getBusinessDayHistoryListAction,
  getOutstandingHistoryTabAction,
} from "@/actions/business-day-history";
import {
  BusinessDayHistoryFilters,
  BusinessDayHistoryTabs,
  type BusinessDayHistoryListTab,
} from "@/components/business-day/BusinessDayHistoryFilters";
import { BusinessDayHistoryBusinessPanel } from "@/components/business-day/BusinessDayHistoryBusinessPanel";
import { BusinessDayHistoryOutstandingRange } from "@/components/business-day/BusinessDayHistoryOutstandingRange";
import { HistoryPageLayout } from "@/components/business-day/history";
import { formatBusinessDayDate } from "@/lib/business-day/format";
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

  const [listResult, outstandingResult] = await Promise.all([
    tab === "days"
      ? getBusinessDayHistoryListAction({ from, to })
      : Promise.resolve(null),
    tab === "outstanding"
      ? getOutstandingHistoryTabAction({ from, to })
      : Promise.resolve(null),
  ]);

  const filterFrom = listResult?.from ?? outstandingResult?.from ?? from;
  const filterTo = listResult?.to ?? outstandingResult?.to ?? to;
  const periodLabel =
    filterFrom === filterTo
      ? formatBusinessDayDate(`${filterFrom}T12:00:00+05:30`)
      : `${formatBusinessDayDate(`${filterFrom}T12:00:00+05:30`)} – ${formatBusinessDayDate(`${filterTo}T12:00:00+05:30`)}`;
  const headingSub =
    listResult != null
      ? `${listResult.summary.totalBusinessDays} closed Business Day${
          listResult.summary.totalBusinessDays === 1 ? "" : "s"
        } · ${periodLabel}`
      : periodLabel;

  return (
    <HistoryPageLayout
      compact
      filters={
        <BusinessDayHistoryFilters
          key={`${tab}-${filterFrom}-${filterTo}`}
          from={filterFrom}
          to={filterTo}
          tab={tab}
          heading="Business History"
          subheading={headingSub}
        />
      }
      tabs={
        <BusinessDayHistoryTabs tab={tab} from={filterFrom} to={filterTo} />
      }
    >
      {tab === "days" && listResult ? (
        <BusinessDayHistoryBusinessPanel
          summary={listResult.summary}
          items={listResult.items}
          corrections={listResult.corrections}
          from={listResult.from}
          to={listResult.to}
        />
      ) : null}

      {tab === "outstanding" && outstandingResult ? (
        <BusinessDayHistoryOutstandingRange data={outstandingResult} />
      ) : null}
    </HistoryPageLayout>
  );
}
