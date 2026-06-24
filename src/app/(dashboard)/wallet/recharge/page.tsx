import { WalletRechargeFlow } from "@/components/wallet/WalletRechargeFlow";

export default function WalletRechargePage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recharge Wallet</h1>
        <p className="mt-1 text-gray-600">
          Verify the customer using Card ID or phone before recharging.
        </p>
      </div>
      <WalletRechargeFlow />
    </div>
  );
}
