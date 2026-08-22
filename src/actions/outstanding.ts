"use server";

import { revalidatePath } from "next/cache";
import { authorizePermission, requireStaff } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { collectOutstandingForCustomer } from "@/lib/outstanding/collect-for-customer";
import {
  createOpeningOutstanding,
  customerHasOpeningOutstanding,
} from "@/lib/outstanding/create-opening";
import { customerIsEligibleForOpeningOutstanding } from "@/lib/outstanding/opening-eligibility";
import { getCustomerOutstandingHistory } from "@/lib/outstanding/customer-history";
import { parseBusinessDateInput } from "@/lib/utils/business-date";
import {
  collectCustomerOutstandingSchema,
  createOpeningOutstandingSchema,
} from "@/lib/validators/outstanding";
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

export async function customerHasOpeningOutstandingAction(
  customerId: string
): Promise<boolean> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return false;
  }

  await connectDB();
  return customerHasOpeningOutstanding(customerId);
}

/** Brand-new customer eligibility for Opening Outstanding. */
export async function customerIsEligibleForOpeningOutstandingAction(
  customerId: string
): Promise<boolean> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return false;
  }

  await connectDB();
  return customerIsEligibleForOpeningOutstanding(customerId);
}

export async function createOpeningOutstandingAction(
  formData: FormData
): Promise<ActionResult<{ outstandingId: string }>> {
  try {
    const session = await requireStaff();
    await connectDB();

    const parsed = createOpeningOutstandingSchema.safeParse({
      customerId: String(formData.get("customerId") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      effectiveDate: String(formData.get("effectiveDate") ?? ""),
    });

    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const reason = parsed.data.reason?.trim() || undefined;
    const effectiveRaw = parsed.data.effectiveDate?.trim() || "";
    let effectiveDate: Date | undefined;
    if (effectiveRaw) {
      try {
        effectiveDate = parseBusinessDateInput(effectiveRaw);
      } catch {
        return failure("Effective Date must be a valid date (YYYY-MM-DD).");
      }
    }

    const created = await createOpeningOutstanding({
      customerId: parsed.data.customerId,
      amount: parsed.data.amount,
      reason,
      effectiveDate,
      createdBy: session.user.username,
    });

    revalidateOutstandingPaths(parsed.data.customerId);
    return success({ outstandingId: created.outstandingId });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create Opening Outstanding";
    return failure(message);
  }
}
