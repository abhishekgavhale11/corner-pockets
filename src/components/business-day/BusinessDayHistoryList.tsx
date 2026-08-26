import Link from "next/link";
import {
  HistoryActivityTable,
  HistoryEmptyState,
  HistoryTableCell,
  HistoryTableRow,
} from "@/components/business-day/history";
import {
  formatBusinessDayDate,
  formatBusinessDayTime,
} from "@/lib/business-day/format";
import { formatCurrency } from "@/lib/utils/format";
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
];

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BusinessDayHistoryList({ items }: BusinessDayHistoryListProps) {
  if (items.length === 0) {
    return (
      <HistoryEmptyState message="No closed Business Days in this date range." />
    );
  }

  return (
    <HistoryActivityTable
      title={
        <div className="flex items-start gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <CalendarIcon />
          </span>
          <div>
            <h3 className="text-[16px] font-semibold tracking-tight text-gray-900">
              Business Day Activity
            </h3>
            <p className="text-[12px] text-gray-500">
              Daily wise business performance
            </p>
          </div>
        </div>
      }
      columns={COLUMNS}
      minWidth="960px"
    >
      {items.map((item) => (
        <HistoryTableRow key={item.id}>
          <HistoryTableCell>
            <Link
              href={`/business-day/history/${item.id}`}
              className="text-[14px] font-semibold text-emerald-700 hover:text-emerald-900"
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
            <span className="text-[13px] tabular-nums text-gray-600">
              {formatBusinessDayTime(item.openedAt)}
            </span>
          </HistoryTableCell>
          <HistoryTableCell>
            <span className="text-[13px] tabular-nums text-gray-600">
              {formatBusinessDayTime(item.closedAt)}
            </span>
          </HistoryTableCell>
          <HistoryTableCell align="right">
            <span className="text-[13px] font-semibold tabular-nums text-gray-900">
              {formatCurrency(item.todaysBill)}
            </span>
          </HistoryTableCell>
          <HistoryTableCell align="right">
            <span className="text-[13px] font-semibold tabular-nums text-emerald-700">
              {formatCurrency(item.totalReceived)}
            </span>
          </HistoryTableCell>
          <HistoryTableCell align="right">
            <span className="text-[13px] font-semibold tabular-nums text-orange-600">
              {formatCurrency(item.outstandingCreated)}
            </span>
          </HistoryTableCell>
        </HistoryTableRow>
      ))}
    </HistoryActivityTable>
  );
}
