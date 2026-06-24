import { Card, CardTitle } from "@/components/ui/Card";

export default function BalancesPlaceholderPage() {
  return (
    <Card>
      <CardTitle className="mb-2">Balances (Udhar)</CardTitle>
      <p className="text-sm text-gray-600">
        Customer credit tracking will be available in Phase 3. Outstanding credit
        balances are separate from wallet balances and pending bills.
      </p>
    </Card>
  );
}
