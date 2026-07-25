import { getOpenBusinessDayCafeOrders } from "@/actions/cafe-orders";
import { CafeOrdersWorkspace } from "@/components/counter/CafeOrdersWorkspace";
import { CounterWorkspaceTabs } from "@/components/counter/CounterWorkspaceTabs";

export const dynamic = "force-dynamic";

export default async function CafeCounterPage() {
  const orders = await getOpenBusinessDayCafeOrders();

  return (
    <div>
      <CounterWorkspaceTabs />
      <CafeOrdersWorkspace orders={orders} />
    </div>
  );
}
