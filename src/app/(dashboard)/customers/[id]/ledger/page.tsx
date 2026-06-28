import { redirect } from "next/navigation";

interface CustomerLedgerPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerLedgerPage({
  params,
}: CustomerLedgerPageProps) {
  const { id } = await params;
  redirect(`/customers/${id}`);
}
