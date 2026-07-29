"use server";

import { authorizePermission } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { verifyOutstandingIntegrity } from "@/lib/integrity/verify-outstanding";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import type { OutstandingIntegrityReport } from "@/types";

/**
 * Admin read-only Outstanding ledger integrity check.
 * Does not modify any data.
 */
export async function verifyOutstandingIntegrityAction(): Promise<
  ActionResult<OutstandingIntegrityReport>
> {
  const authResult = await authorizePermission("STAFF_VIEW");
  if (!("session" in authResult)) {
    return authResult;
  }

  try {
    await connectDB();
    const report = await verifyOutstandingIntegrity();
    return success(report);
  } catch (error) {
    console.error("verifyOutstandingIntegrityAction failed:", error);
    return failure("Could not verify Outstanding integrity");
  }
}
