"use server";

import { revalidatePath } from "next/cache";
import { authorizePermission, requireStaff } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { collectOutstandingForCustomer } from "@/lib/outstanding/collect-for-customer";
import { getCustomerOutstandingHistory } from "@/lib/outstanding/customer-history";
import { collectCustomerOutstandingSchema } from "@/lib/validators/outstanding";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";

function revalidateOutstandingPaths(customerId: string) {
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/business-day/history");
}

export async function getCustomerOutstandingHistoryAction(
  customerId: string
) {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();
  return getCustomerOutstandingHistory(customerId);
}

export async function collectCustomerOutstandingAction(
  formData: FormData
): Promise<ActionResult<{ remainingBalance: number }>> {
  try {
    const session = await requireStaff();
    await connectDB();

    const parsed = collectCustomerOutstandingSchema.safeParse({
      customerId: String(formData.get("customerId") ?? ""),
      receivedAmount: String(formData.get("receivedAmount") ?? ""),
      paymentMethod: String(formData.get("paymentMethod") ?? ""),
    });

    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const result = await collectOutstandingForCustomer({
      customerId: parsed.data.customerId,
      receivedAmount: parsed.data.receivedAmount,
      paymentMethod: parsed.data.paymentMethod,
      collectedBy: session.user.username,
      staffId: session.user.id,
    });

    revalidateOutstandingPaths(parsed.data.customerId);
    return success({ remainingBalance: result.remainingBalance });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to collect Outstanding";
    return failure(message);
  }
}
