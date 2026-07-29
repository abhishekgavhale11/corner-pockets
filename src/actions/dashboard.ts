"use server";

import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import NotebookEntry from "@/models/NotebookEntry";
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

  const [pendingRow, paidTodayRow, countRow] = await Promise.all([
    NotebookEntry.aggregate<{ total: number }>([
      { $match: { status: "PENDING" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    NotebookEntry.aggregate<{ total: number }>([
      {
        $match: {
          status: "PAID",
          createdAt: { $gte: startOfDay },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    NotebookEntry.countDocuments({ createdAt: { $gte: startOfDay } }),
  ]);

  return {
    pendingNotebookAmount: pendingRow[0]?.total ?? 0,
    paidTodayAmount: paidTodayRow[0]?.total ?? 0,
    todayEntryCount: countRow,
  };
}
