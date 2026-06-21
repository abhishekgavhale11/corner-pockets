import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";

interface CustomerActionsProps {
  customerId: string;
}

export function CustomerActions({ customerId }: CustomerActionsProps) {
  const base = `/customers/${customerId}`;

  return (
    <Card>
      <CardTitle className="mb-4">Actions</CardTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href={`${base}/recharge`}>
          <Button fullWidth size="lg">
            Recharge
          </Button>
        </Link>
        <Link href={`${base}/deduct`}>
          <Button variant="danger" fullWidth size="lg">
            Deduct
          </Button>
        </Link>
        <Link href={`${base}/transactions`}>
          <Button variant="secondary" fullWidth size="lg">
            Transactions
          </Button>
        </Link>
      </div>
    </Card>
  );
}
