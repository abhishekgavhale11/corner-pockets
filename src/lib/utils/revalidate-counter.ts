import { revalidatePath } from "next/cache";

export function revalidateCustomerFinancials(customerId: string) {
  revalidateCounterPaths(customerId);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/notebook/balances");
}

export function revalidateCounterPaths(customerId?: string) {
  revalidatePath("/counter");
  revalidatePath("/counter/big-snooker");
  revalidatePath("/counter/pool");
  revalidatePath("/counter/mini");
  revalidatePath("/counter/pool-mini");
  revalidatePath("/counter/cafe");
  revalidatePath("/checkout");
  revalidatePath("/notebook/balances");
  revalidatePath("/notebook/snooker");
  revalidatePath("/notebook/checkout");
  if (customerId) {
    revalidatePath(`/customers/${customerId}`);
  }
  revalidatePath("/admin/closing");
}
