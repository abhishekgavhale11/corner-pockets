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

const hideOnMobile = "hidden md:table-cell";
const compactPad = "!px-1.5 md:!px-3";
const moneyCol = `${compactPad} w-[1%]`;

const COLUMNS = [
  { key: "id", label: "Business Day", className: compactPad },
  { key: "date", label: "Business Date", className: compactPad },
  { key: "opened", label: "Opened", className: `${hideOnMobile} ${compactPad}` },
  { key: "closed", label: "Closed", className: `${hideOnMobile} ${compactPad}` },
  { key: "revenue", label: "Revenue", align: "right" as const, className: moneyCol },
  {
    key: "collection",
    label: (
      <>
        <span className="md:hidden">Collection</span>
        <span className="hidden md:inline">Business Collection</span>
      </>
    ),
    align: "right" as const,
    className: moneyCol,
  },
  {
    key: "created",
    label: (
      <>
        <span className="md:hidden">Outstanding</span>
        <span className="hidden md:inline">Outstanding Created</span>
      </>
    ),
    align: "right" as const,
    className: moneyCol,
  },
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
      minWidth="0"
    >
      {items.map((item) => (
        <HistoryTableRow key={item.id}>
          <HistoryTableCell className={compactPad}>
            <Link
              href={`/business-day/history/${item.id}`}
              className="text-[13px] font-semibold text-emerald-700 hover:text-emerald-900 md:text-[14px]"
            >
              {item.publicId}
            </Link>
          </HistoryTableCell>
          <HistoryTableCell className={compactPad}>
            <span className="whitespace-nowrap text-[12px] font-medium text-gray-800 md:text-[13px]">
              {formatBusinessDayDate(item.businessDate)}
            </span>
          </HistoryTableCell>
          <HistoryTableCell className={`${hideOnMobile} ${compactPad}`}>
            <span className="text-[13px] tabular-nums text-gray-600">
              {formatBusinessDayTime(item.openedAt)}
            </span>
          </HistoryTableCell>
          <HistoryTableCell className={`${hideOnMobile} ${compactPad}`}>
            <span className="text-[13px] tabular-nums text-gray-600">
              {formatBusinessDayTime(item.closedAt)}
            </span>
          </HistoryTableCell>
          <HistoryTableCell align="right" className={moneyCol}>
            <span className="whitespace-nowrap text-[12px] font-semibold tabular-nums text-gray-900 md:text-[13px]">
              {formatCurrency(item.todaysBill)}
            </span>
          </HistoryTableCell>
          <HistoryTableCell align="right" className={moneyCol}>
            <span className="whitespace-nowrap text-[12px] font-semibold tabular-nums text-emerald-700 md:text-[13px]">
              {formatCurrency(item.totalReceived)}
            </span>
          </HistoryTableCell>
          <HistoryTableCell align="right" className={moneyCol}>
            <span className="whitespace-nowrap text-[12px] font-semibold tabular-nums text-orange-600 md:text-[13px]">
              {formatCurrency(item.outstandingCreated)}
            </span>
          </HistoryTableCell>
        </HistoryTableRow>
      ))}
    </HistoryActivityTable>
  );
}
