import { WalletDeductFlow } from "@/components/wallet/WalletDeductFlow";

export default function WalletDeductPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Deduct from Wallet</h1>
        <p className="mt-1 text-gray-600">
          Verify the customer using Card ID or phone before deducting.
        </p>
      </div>
      <WalletDeductFlow />
    </div>
  );
}
