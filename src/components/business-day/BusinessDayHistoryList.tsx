import Link from "next/link";
import {
  formatBusinessDayDate,
  formatBusinessDayTime,
} from "@/lib/business-day/format";
import { formatCurrency } from "@/lib/utils/format";
import type { BusinessDayHistoryListItemDTO } from "@/types";

interface BusinessDayHistoryListProps {
  items: BusinessDayHistoryListItemDTO[];
}

export function BusinessDayHistoryList({ items }: BusinessDayHistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500 shadow-sm">
        No closed Business Days in this date range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[880px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2.5">Business Day ID</th>
            <th className="px-3 py-2.5">Business Date</th>
            <th className="px-3 py-2.5">Opening Time</th>
            <th className="px-3 py-2.5">Closing Time</th>
            <th className="px-3 py-2.5 text-right">Today&apos;s Bill</th>
            <th className="px-3 py-2.5 text-right">Total Received</th>
            <th className="px-3 py-2.5 text-right">Total Outstanding Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-emerald-50/40">
              <td className="px-3 py-2.5">
                <Link
                  href={`/business-day/history/${item.id}`}
                  className="font-semibold text-emerald-800 hover:text-emerald-950"
                >
                  {item.publicId}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-gray-800">
                {formatBusinessDayDate(item.businessDate)}
              </td>
              <td className="px-3 py-2.5 tabular-nums text-gray-700">
                {formatBusinessDayTime(item.openedAt)}
              </td>
              <td className="px-3 py-2.5 tabular-nums text-gray-700">
                {formatBusinessDayTime(item.closedAt)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-medium text-gray-900">
                {formatCurrency(item.todaysBill)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-medium text-emerald-800">
                {formatCurrency(item.totalReceived)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-medium text-orange-700">
                {formatCurrency(item.outstandingCreated)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
