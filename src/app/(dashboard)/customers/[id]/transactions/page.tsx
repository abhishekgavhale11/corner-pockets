import { redirect } from "next/navigation";
import { getCustomerById } from "@/actions/customers";

interface TransactionsPageProps {
  params: Promise<{ id: string }>;
}

export default async function TransactionsPage({
  params,
}: TransactionsPageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    redirect("/customers");
  }

  redirect(`/customers/${customer.id}?activity=transactions`);
}
