import { redirect } from "next/navigation";
import { getCustomerById } from "@/actions/customers";

interface RechargePageProps {
  params: Promise<{ id: string }>;
}

export default async function RechargePage({ params }: RechargePageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    redirect("/customers");
  }

  redirect(`/customers/${customer.id}?recharge=1`);
}
