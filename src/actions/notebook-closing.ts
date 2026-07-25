"use server";

import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { NOTEBOOK_SECTIONS } from "@/lib/constants/notebook-sections";
import { dailyClosingSchema } from "@/lib/validators/notebook";
import type { DailyClosingDTO } from "@/types";
import NotebookEntry from "@/models/NotebookEntry";

function getDayBounds(dateInput?: string) {
  const date = dateInput ? new Date(dateInput) : new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end, dateLabel: start.toISOString().slice(0, 10) };
}

export async function getDailyClosing(
  searchParams: Record<string, string | string[] | undefined> = {}
): Promise<DailyClosingDTO | null> {
  const authResult = await authorizePermission("NOTEBOOK_CLOSING_VIEW");
  if (!("session" in authResult)) {
    return null;
  }

  const parsed = dailyClosingSchema.safeParse({
    date:
      typeof searchParams.date === "string" ? searchParams.date : undefined,
  });

  const { start, end, dateLabel } = getDayBounds(
    parsed.success ? parsed.data.date : undefined
  );

  await connectDB();

  const [pendingRow, sectionRows] = await Promise.all([
    NotebookEntry.aggregate<{ total: number }>([
      { $match: { status: "PENDING" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    NotebookEntry.aggregate<{
      _id: string;
      total: number;
    }>([
      {
        $match: {
          status: "PAID",
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$section",
          total: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  // Settlement aggregates removed with Financial Engine V1 — payment method
  // totals are stubbed until OS V2 closing is wired.
  const cashCollection = 0;
  const gpayCollection = 0;
  const walletCollection = 0;
  const pendingAmount = pendingRow[0]?.total ?? 0;

  const sectionSummary = NOTEBOOK_SECTIONS.map((section) => ({
    section,
    amount: sectionRows.find((row) => row._id === section)?.total ?? 0,
  }));

  return {
    date: dateLabel,
    cashCollection,
    gpayCollection,
    walletCollection,
    pendingAmount,
    grandTotal: cashCollection + gpayCollection + walletCollection,
    sectionSummary,
  };
}
