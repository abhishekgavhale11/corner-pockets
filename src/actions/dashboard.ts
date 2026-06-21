"use server";

import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import Transaction from "@/models/Transaction";
import type { DashboardStats } from "@/types";

export async function getDashboardStats(): Promise<DashboardStats> {
  const authResult = await authorizePermission("DASHBOARD_VIEW");
  if (!("session" in authResult)) {
    throw new Error(
      authResult.success === false ? authResult.error : "Unauthorized"
    );
  }

  await connectDB();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [result] = await Transaction.aggregate<{
    todayRecharges: number;
    todayDeductions: number;
    todayTransactionCount: number;
  }>([
    { $match: { createdAt: { $gte: startOfDay } } },
    {
      $group: {
        _id: null,
        todayRecharges: {
          $sum: {
            $cond: [
              { $eq: ["$type", "credit"] },
              { $ifNull: ["$creditedAmount", 0] },
              0,
            ],
          },
        },
        todayDeductions: {
          $sum: {
            $cond: [{ $eq: ["$type", "debit"] }, { $ifNull: ["$amount", 0] }, 0],
          },
        },
        todayTransactionCount: { $sum: 1 },
      },
    },
  ]);

  return {
    todayRecharges: result?.todayRecharges ?? 0,
    todayDeductions: result?.todayDeductions ?? 0,
    todayTransactionCount: result?.todayTransactionCount ?? 0,
  };
}
