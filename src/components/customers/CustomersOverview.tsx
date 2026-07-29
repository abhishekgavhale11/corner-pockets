import {

  HistoryIconChart,

  HistoryOverviewSection,

  type HistoryMetric,

} from "@/components/business-day/history";

import { formatCurrency } from "@/lib/utils/format";



interface CustomersOverviewProps {

  totalCustomers: number;

  customersWithOutstanding: number;

  totalOutstanding: number;

}



export function CustomersOverview({

  totalCustomers,

  customersWithOutstanding,

  totalOutstanding,

}: CustomersOverviewProps) {

  const metrics: HistoryMetric[] = [

    {

      key: "total",

      label: "Total Customers",

      value: String(totalCustomers),

      tone: "neutral",

    },

    {

      key: "with-outstanding",

      label: "Customers with Outstanding",

      value: String(customersWithOutstanding),

      tone: customersWithOutstanding > 0 ? "negative" : "positive",

    },

    {

      key: "outstanding",

      label: "Total Outstanding",

      value: formatCurrency(totalOutstanding),

      hint: "Visible on this page",

      tone: totalOutstanding > 0 ? "negative" : "positive",

    },

  ];



  return (

    <HistoryOverviewSection

      title="Customer Overview"

      subtitle="Active customers in CPOS"

      icon={<HistoryIconChart />}

      tone="info"

      metrics={metrics}

    />

  );

}

