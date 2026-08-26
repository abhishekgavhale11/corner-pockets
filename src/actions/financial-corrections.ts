"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { listEligibleCorrectionDays } from "@/lib/financial-corrections/eligible-days";
import { postFinancialCorrection } from "@/lib/financial-corrections/post-correction";
import {
  recordMissedPaymentSchema,
  recordOutstandingCorrectionSchema,
} from "@/lib/validators/financial-corrections";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import type { FinancialCorrectionEligibleDayDTO } from "@/types";

function revalidateCorrectionPaths(
  customerId: string,
  affectedBusinessDayId: string
) {
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/business-day/history");
  revalidatePath(`/business-day/history/${affectedBusinessDayId}`);
}

export async function getCustomerCorrectionEligibleDaysAction(
  customerId: string
): Promise<FinancialCorrectionEligibleDayDTO[]> {
  await requireStaff();
  await connectDB();
  return listEligibleCorrectionDays(customerId);
}

export async function recordMissedPaymentAction(
  formData: FormData
): Promise<ActionResult<{ remainingAmount: number }>> {
  try {
    const session = await requireStaff();
    await connectDB();

    const parsed = recordMissedPaymentSchema.safeParse({
      customerId: String(formData.get("customerId") ?? ""),
      affectedBusinessDayId: String(formData.get("affectedBusinessDayId") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      paymentMethod: String(formData.get("paymentMethod") ?? ""),
      section: String(formData.get("section") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });

    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const result = await postFinancialCorrection({
      type: "MISSED_PAYMENT",
      customerId: parsed.data.customerId,
      affectedBusinessDayId: parsed.data.affectedBusinessDayId,
      amount: parsed.data.amount,
      paymentMethod: parsed.data.paymentMethod,
      section: parsed.data.section,
      reason: parsed.data.reason,
      createdBy: session.user.username,
    });

    revalidateCorrectionPaths(
      parsed.data.customerId,
      parsed.data.affectedBusinessDayId
    );
    return success({ remainingAmount: result.remainingAmount });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record missed payment";
    return failure(message);
  }
}

export async function recordOutstandingCorrectionAction(
  formData: FormData
): Promise<ActionResult<{ remainingAmount: number }>> {
  try {
    const session = await requireStaff();
    await connectDB();

    const parsed = recordOutstandingCorrectionSchema.safeParse({
      customerId: String(formData.get("customerId") ?? ""),
      affectedBusinessDayId: String(
        formData.get("affectedBusinessDayId") ?? ""
      ),
      amount: String(formData.get("amount") ?? ""),
      section: String(formData.get("section") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });

    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const result = await postFinancialCorrection({
      type: "OUTSTANDING_CORRECTION",
      customerId: parsed.data.customerId,
      affectedBusinessDayId: parsed.data.affectedBusinessDayId,
      amount: parsed.data.amount,
      section: parsed.data.section,
      reason: parsed.data.reason,
      createdBy: session.user.username,
    });

    revalidateCorrectionPaths(
      parsed.data.customerId,
      parsed.data.affectedBusinessDayId
    );
    return success({ remainingAmount: result.remainingAmount });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to record outstanding correction";
    return failure(message);
  }
}
