import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerById } from "@/actions/customers";
import { getPlansForCustomer } from "@/lib/constants/recharge-plans";
import { CustomerBackLink } from "@/components/customers/CustomerBackLink";
import { WalletRechargeFlow } from "@/components/wallet/WalletRechargeFlow";

interface RechargePageProps {
  params: Promise<{ id: string }>;
}

export default async function RechargePage({ params }: RechargePageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <CustomerBackLink customer={customer} />
      <div>
        <Link
          href={`/customers/${customer.id}`}
          className="text-sm font-medium text-emerald-800 hover:underline"
        >
          ← Back to customer
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Recharge</h1>
        <p className="mt-1 text-gray-600">
          Verify the customer before recharging their wallet.
        </p>
      </div>
      <WalletRechargeFlow
        initialCardId={customer.cardId}
        plansForCustomer={(verifiedCustomer) =>
          getPlansForCustomer(verifiedCustomer.isStudent)
        }
        walletLabelForCustomer={(verifiedCustomer) =>
          verifiedCustomer.isStudent ? "Student Wallet" : "Club Wallet"
        }
      />
    </div>
  );
}
