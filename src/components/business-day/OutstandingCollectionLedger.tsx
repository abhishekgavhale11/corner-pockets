import {
  AmountCell,
  CustomerCell,
  DateTimeCell,
  HistoryActivityTable,
  HistoryEmptyState,
  HistoryIconOutstanding,
  HistoryOverviewSection,
  HistoryTableCell,
  HistoryTableRow,
  PaymentBadge,
  type HistoryMetric,
} from "@/components/business-day/history";
import {
  formatBusinessDayDate,
} from "@/lib/business-day/format";
import { formatCurrency } from "@/lib/utils/format";
import type { OutstandingCollectionLedgerResultDTO } from "@/types";

interface OutstandingCollectionLedgerProps {
  ledger: OutstandingCollectionLedgerResultDTO;
}

const COLUMNS = [
  { key: "when", label: "Date & Time" },
  { key: "customer", label: "Customer" },
  { key: "amount", label: "Amount Collected", align: "right" as const },
  { key: "method", label: "Payment Method" },
  { key: "previous", label: "Previous Outstanding", align: "right" as const },
  { key: "remaining", label: "Remaining Outstanding", align: "right" as const },
  { key: "by", label: "Collected By" },
];

export function OutstandingCollectionLedger({
  ledger,
}: OutstandingCollectionLedgerProps) {
  const { summary, items, from, to } = ledger;
  const rangeLabel =
    from === to
      ? formatBusinessDayDate(`${from}T12:00:00+05:30`)
      : `${formatBusinessDayDate(`${from}T12:00:00+05:30`)} → ${formatBusinessDayDate(`${to}T12:00:00+05:30`)}`;

  const metrics: HistoryMetric[] = [
    {
      key: "club",
      label: "Total Outstanding",
      value: formatCurrency(summary.totalClubOutstanding),
      hint: "Live · all customers",
      tone: "negative",
    },
    {
      key: "recovered",
      label: "Recovered",
      value: formatCurrency(summary.totalOutstandingRecovered),
      tone: "positive",
    },
    {
      key: "collections",
      label: "Collections",
      value: String(summary.collectionCount),
      tone: "info",
    },
    {
      key: "customers",
      label: "Customers Paid",
      value: String(summary.customersPaidCount),
      tone: "neutral",
    },
  ];

  return (
    <div className="space-y-6">
      <HistoryOverviewSection
        title="Outstanding Overview"
        subtitle={`When outstanding was collected from customers · ${rangeLabel}`}
        icon={<HistoryIconOutstanding />}
        tone="negative"
        metrics={metrics}
      />

      {items.length === 0 ? (
        <HistoryEmptyState message="No Outstanding collections in this date range." />
      ) : (
        <HistoryActivityTable
          title="Collection Activity"
          columns={COLUMNS}
          minWidth="980px"
        >
          {items.map((row) => (
            <HistoryTableRow key={row.id}>
              <HistoryTableCell>
                <DateTimeCell value={row.collectedAt} />
              </HistoryTableCell>
              <HistoryTableCell>
                <CustomerCell
                  name={row.customerName}
                  href={`/customers/${row.customerId}`}
                />
              </HistoryTableCell>
              <HistoryTableCell align="right">
                <AmountCell amount={row.amountCollected} tone="positive" />
              </HistoryTableCell>
              <HistoryTableCell>
                <PaymentBadge method={row.paymentMethod} />
              </HistoryTableCell>
              <HistoryTableCell align="right">
                <AmountCell amount={row.previousOutstanding} tone="muted" />
              </HistoryTableCell>
              <HistoryTableCell align="right">
                <AmountCell amount={row.remainingOutstanding} tone="negative" />
              </HistoryTableCell>
              <HistoryTableCell>
                <span className="text-[13px] text-gray-600">
                  {row.collectedBy ?? "—"}
                </span>
              </HistoryTableCell>
            </HistoryTableRow>
          ))}
        </HistoryActivityTable>
      )}
    </div>
  );
}
