"use server";

import { authorizePermission } from "@/lib/auth/session";
import { getCustomerCounterDrawer } from "@/lib/counter/customer-drawer";
import type { CustomerCounterDrawerDTO } from "@/types";

export async function getCustomerCounterDrawerAction(
  customerId: string
): Promise<CustomerCounterDrawerDTO | null> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return null;
  }
  if (!customerId.trim()) {
    return null;
  }
  return getCustomerCounterDrawer(customerId.trim());
}
