import { getCustomersWithOutstanding } from "@/actions/customer-ledger";
import { OutstandingPage } from "@/components/customers/OutstandingPage";

interface BalancesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BalancesPage({ searchParams }: BalancesPageProps) {
  const params = await searchParams;
  const rows = await getCustomersWithOutstanding(params);
  const initialQuery = typeof params.q === "string" ? params.q : "";

  return <OutstandingPage rows={rows} initialQuery={initialQuery} />;
}
