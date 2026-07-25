"use server";

import { revalidatePath } from "next/cache";
import { authorizePermission, requireStaff } from "@/lib/auth/session";
import { isAdminRole, type StaffRole } from "@/lib/auth/roles";
import { connectDB } from "@/lib/db/connect";
import { openBusinessDay } from "@/lib/business-day/open-business-day";
import { closeBusinessDay, formatBusinessDayCloseFailure } from "@/lib/business-day/close-business-day";
import { reopenBusinessDay } from "@/lib/business-day/reopen-business-day";
import {
  getBusinessDayClosePreview,
  getBusinessDayHistory,
  getCurrentOpenBusinessDay,
  hasOpenBusinessDay,
} from "@/lib/business-day/queries";
import { validateBusinessDayClosePreflight } from "@/lib/business-day/close-preflight";
import { validateBusinessDayCloseFinancialProof } from "@/lib/business-day/close-financial-proof";
import { validateBusinessDayCloseOutstandingProof } from "@/lib/business-day/close-outstanding-proof";
import {
  openBusinessDaySchema,
  reopenBusinessDaySchema,
} from "@/lib/validators/business-day";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import type {
  BusinessDayCloseFinancialProofResult,
  BusinessDayCloseOutstandingProofResult,
  BusinessDayClosePreflightResult,
  BusinessDayClosePreviewDTO,
  BusinessDayDTO,
} from "@/types";

function revalidateBusinessDayPaths() {
  revalidatePath("/business-day");
  revalidatePath("/business-day/history");
  revalidatePath("/admin/business-day");
  revalidatePath("/admin");
  revalidatePath("/counter");
  revalidatePath("/counter/big-snooker");
  revalidatePath("/counter/pool-mini");
  revalidatePath("/counter/pool");
  revalidatePath("/counter/mini");
  revalidatePath("/counter/cafe");
  revalidatePath("/customers");
}

/** Counter asks only: is there an OPEN Business Day? */
export async function hasOpenBusinessDayAction(): Promise<boolean> {
  await requireStaff();
  await connectDB();
  return hasOpenBusinessDay();
}

export async function getBusinessDayClosePreviewAction(): Promise<BusinessDayClosePreviewDTO | null> {
  await requireStaff();
  await connectDB();
  return getBusinessDayClosePreview();
}

/**
 * Phase 1 — Close Preflight only.
 * Read-only validation. Does not close the day or create Outstanding.
 */
export async function validateBusinessDayClosePreflightAction(): Promise<
  ActionResult<BusinessDayClosePreflightResult>
> {
  try {
    await requireStaff();
    await connectDB();
    const result = await validateBusinessDayClosePreflight();
    return success(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to validate Business Day Close preflight";
    return failure(message);
  }
}

/**
 * Phase 1B — Close Financial Proof only.
 * Read-only. Does not close the day or create Outstanding.
 */
export async function validateBusinessDayCloseFinancialProofAction(): Promise<
  ActionResult<BusinessDayCloseFinancialProofResult>
> {
  try {
    await requireStaff();
    await connectDB();
    const result = await validateBusinessDayCloseFinancialProof();
    return success(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to validate Business Day Close financial proof";
    return failure(message);
  }
}

/**
 * Phase 2 — Outstanding Candidate Proof only.
 * Builds candidates with current generation logic; does not insert.
 */
export async function validateBusinessDayCloseOutstandingProofAction(): Promise<
  ActionResult<BusinessDayCloseOutstandingProofResult>
> {
  try {
    await requireStaff();
    await connectDB();
    const result = await validateBusinessDayCloseOutstandingProof();
    return success(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to validate Business Day Close outstanding proof";
    return failure(message);
  }
}

export async function getBusinessDayPageData(): Promise<{
  current: BusinessDayDTO | null;
  history: BusinessDayDTO[];
  closePreview: BusinessDayClosePreviewDTO | null;
  canReopen: boolean;
}> {
  const session = await requireStaff();
  await connectDB();

  const current = await getCurrentOpenBusinessDay();
  const history = await getBusinessDayHistory(20);
  const role = session.user.role as StaffRole;

  const closePreview = current ? await getBusinessDayClosePreview() : null;

  return {
    current,
    history,
    closePreview,
    canReopen: isAdminRole(role),
  };
}

export async function openBusinessDayAction(
  formData: FormData
): Promise<ActionResult<BusinessDayDTO>> {
  try {
    const authResult = await authorizePermission("BUSINESS_DAY_MANAGE");
    if (!("session" in authResult)) {
      return authResult;
    }

    await connectDB();

    const parsed = openBusinessDaySchema.safeParse({
      businessDate: String(formData.get("businessDate") ?? ""),
      openingCash: String(formData.get("openingCash") ?? ""),
    });
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const day = await openBusinessDay({
      businessDate: parsed.data.businessDate,
      openingCash: parsed.data.openingCash ?? 0,
      openedBy:
        authResult.session.user.name?.trim() ||
        authResult.session.user.username,
    });

    revalidateBusinessDayPaths();
    return success(day);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to open Business Day";
    return failure(message);
  }
}

export async function closeBusinessDayAction(): Promise<
  ActionResult<BusinessDayDTO>
> {
  try {
    const authResult = await authorizePermission("BUSINESS_DAY_MANAGE");
    if (!("session" in authResult)) {
      return authResult;
    }

    await connectDB();

    const result = await closeBusinessDay({
      closedBy:
        authResult.session.user.name?.trim() ||
        authResult.session.user.username,
    });

    if (result.status === "SUCCESS" || result.status === "ALREADY_CLOSED") {
      revalidateBusinessDayPaths();
      return success(result.day);
    }

    return failure(formatBusinessDayCloseFailure(result));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to close Business Day";
    return failure(message);
  }
}

export async function reopenBusinessDayAction(
  formData: FormData
): Promise<ActionResult<BusinessDayDTO>> {
  try {
    const authResult = await authorizePermission("BUSINESS_DAY_MANAGE");
    if (!("session" in authResult)) {
      return authResult;
    }

    // Reopen stays Admin-only; Staff may open/close but not reopen.
    if (!isAdminRole(authResult.session.user.role as StaffRole)) {
      return failure("You do not have permission to perform this action");
    }

    await connectDB();

    const parsed = reopenBusinessDaySchema.safeParse({
      businessDayId: String(formData.get("businessDayId") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const day = await reopenBusinessDay({
      businessDayId: parsed.data.businessDayId,
      reason: parsed.data.reason,
      reopenedBy:
        authResult.session.user.name?.trim() ||
        authResult.session.user.username,
    });

    revalidateBusinessDayPaths();
    return success(day);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reopen Business Day";
    return failure(message);
  }
}
