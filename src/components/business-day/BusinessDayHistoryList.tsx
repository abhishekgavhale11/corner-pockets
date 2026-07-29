import Link from "next/link";
import {
  AmountCell,
  HistoryActivityTable,
  HistoryEmptyState,
  HistoryTableCell,
  HistoryTableRow,
} from "@/components/business-day/history";
import {
  formatBusinessDayDate,
  formatBusinessDayTime,
} from "@/lib/business-day/format";
import type { BusinessDayHistoryListItemDTO } from "@/types";

interface BusinessDayHistoryListProps {
  items: BusinessDayHistoryListItemDTO[];
}

const COLUMNS = [
  { key: "id", label: "Business Day" },
  { key: "date", label: "Business Date" },
  { key: "opened", label: "Opened" },
  { key: "closed", label: "Closed" },
  { key: "revenue", label: "Revenue", align: "right" as const },
  { key: "collection", label: "Business Collection", align: "right" as const },
  { key: "created", label: "Outstanding Created", align: "right" as const },
  {
    key: "closing",
    label: "Club Outstanding (EOD)",
    align: "right" as const,
  },
];

export function BusinessDayHistoryList({ items }: BusinessDayHistoryListProps) {
  if (items.length === 0) {
    return (
      <HistoryEmptyState message="No closed Business Days in this date range." />
    );
  }

  return (
    <HistoryActivityTable
      title="Business Day Activity"
      columns={COLUMNS}
      minWidth="1100px"
    >
      {items.map((item) => (
        <HistoryTableRow key={item.id}>
          <HistoryTableCell>
            <Link
              href={`/business-day/history/${item.id}`}
              className="text-[15px] font-semibold text-emerald-800 hover:text-emerald-950"
            >
              {item.publicId}
            </Link>
          </HistoryTableCell>
          <HistoryTableCell>
            <span className="text-[13px] font-medium text-gray-800">
              {formatBusinessDayDate(item.businessDate)}
            </span>
          </HistoryTableCell>
          <HistoryTableCell>
            <span className="text-[13px] tabular-nums text-gray-700">
              {formatBusinessDayTime(item.openedAt)}
            </span>
          </HistoryTableCell>
          <HistoryTableCell>
            <span className="text-[13px] tabular-nums text-gray-700">
              {formatBusinessDayTime(item.closedAt)}
            </span>
          </HistoryTableCell>
          <HistoryTableCell align="right">
            <AmountCell amount={item.todaysBill} />
          </HistoryTableCell>
          <HistoryTableCell align="right">
            <AmountCell amount={item.totalReceived} tone="positive" />
          </HistoryTableCell>
          <HistoryTableCell align="right">
            <AmountCell amount={item.outstandingCreated} tone="negative" />
          </HistoryTableCell>
          <HistoryTableCell align="right">
            <AmountCell amount={item.closingOutstanding} tone="negative" />
          </HistoryTableCell>
        </HistoryTableRow>
      ))}
    </HistoryActivityTable>
  );
}
