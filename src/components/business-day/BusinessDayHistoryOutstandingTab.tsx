import {
  AmountCell,
  CustomerCell,
  HistoryActivityTable,
  HistoryEmptyState,
  HistoryIconOutstanding,
  HistoryOverviewSection,
  HistoryTableCell,
  HistoryTableRow,
  PaymentBadge,
  type HistoryMetric,
} from "@/components/business-day/history";
import { formatCurrency } from "@/lib/utils/format";
import type { BusinessDayHistoryOutstandingTrendDTO } from "@/types";

interface BusinessDayHistoryOutstandingTabProps {
  trend: BusinessDayHistoryOutstandingTrendDTO;
}

export function BusinessDayHistoryOutstandingTab({
  trend,
}: BusinessDayHistoryOutstandingTabProps) {
  const netPrefix =
    trend.netChange > 0 ? "+" : trend.netChange < 0 ? "−" : "";
  const netTone =
    trend.netChange > 0
      ? "negative"
      : trend.netChange < 0
        ? "positive"
        : "neutral";

  const metrics: HistoryMetric[] = [
    {
      key: "opening",
      label: "Opening Outstanding",
      value: formatCurrency(trend.openingOutstanding),
      tone: "muted",
    },
    {
      key: "created",
      label: "New Outstanding Created",
      value: `${trend.newOutstandingCreated > 0 ? "+" : ""}${formatCurrency(trend.newOutstandingCreated)}`,
      tone: "negative",
    },
    {
      key: "recovered",
      label: "Outstanding Recovered",
      value: `${trend.outstandingRecovered > 0 ? "−" : ""}${formatCurrency(trend.outstandingRecovered)}`,
      tone: "positive",
    },
    {
      key: "net",
      label: "Net Change",
      value: `${netPrefix}${formatCurrency(Math.abs(trend.netChange))}`,
      tone: netTone,
    },
    {
      key: "closing",
      label: "Club Outstanding (EOD)",
      value: formatCurrency(trend.closingOutstanding),
      tone: "negative",
    },
  ];

  return (
    <div className="space-y-6">
      <HistoryOverviewSection
        title="Outstanding Summary"
        subtitle="How the club's total Outstanding moved during this Business Day."
        icon={<HistoryIconOutstanding />}
        tone="negative"
        metrics={metrics}
      >
        <p className="text-[12px] text-gray-500">
          Club Outstanding (End of Day) = Opening Outstanding + New Outstanding
          Created − Outstanding Recovered. Historical for this Business Day —
          does not change after later collections.
        </p>
      </HistoryOverviewSection>

      {trend.created.length === 0 ? (
        <HistoryEmptyState message="No new Outstanding was created on this Business Day." />
      ) : (
        <HistoryActivityTable
          title="New Outstanding Created"
          columns={[
            { key: "customer", label: "Customer" },
            { key: "amount", label: "Amount", align: "right" },
          ]}
          minWidth="0"
        >
          {trend.created.map((row) => (
            <HistoryTableRow key={row.customerId}>
              <HistoryTableCell>
                <CustomerCell
                  name={row.customerName}
                  href={`/customers/${row.customerId}`}
                />
              </HistoryTableCell>
              <HistoryTableCell align="right">
                <AmountCell amount={row.amount} tone="negative" />
              </HistoryTableCell>
            </HistoryTableRow>
          ))}
        </HistoryActivityTable>
      )}

      {trend.recovered.length === 0 ? (
        <HistoryEmptyState message="No Outstanding collections were recorded during this Business Day." />
      ) : (
        <HistoryActivityTable
          title="Outstanding Recovered"
          columns={[
            { key: "customer", label: "Customer" },
            { key: "amount", label: "Amount Collected", align: "right" },
            {
              key: "method",
              label: "Payment Mode",
              align: "right",
              className: "hidden md:table-cell",
            },
          ]}
          minWidth="0"
        >
          {trend.recovered.map((row, index) => (
            <HistoryTableRow
              key={`${row.customerId}-${row.collectedAt}-${index}`}
            >
              <HistoryTableCell>
                <CustomerCell
                  name={row.customerName}
                  href={`/customers/${row.customerId}`}
                />
              </HistoryTableCell>
              <HistoryTableCell align="right">
                <AmountCell amount={row.amount} tone="positive" />
              </HistoryTableCell>
              <HistoryTableCell align="right" className="hidden md:table-cell">
                <PaymentBadge method={row.paymentMethod} />
              </HistoryTableCell>
            </HistoryTableRow>
          ))}
        </HistoryActivityTable>
      )}
    </div>
  );
}
