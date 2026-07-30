import { getOpenBusinessDayCafeOrders } from "@/actions/cafe-orders";
import { CafeOrdersWorkspace } from "@/components/counter/CafeOrdersWorkspace";

export const dynamic = "force-dynamic";

export default async function CafeCounterPage() {
  const orders = await getOpenBusinessDayCafeOrders();

  return (
    <div>
      <CafeOrdersWorkspace orders={orders} />
    </div>
  );
}
