import OutstandingCollection from "@/models/OutstandingCollection";
import FinancialCorrection from "@/models/FinancialCorrection";
import BusinessDay from "@/models/BusinessDay";
import { listCorrectedBusinessDayFinalSummaries } from "@/lib/financial-summary";
import {
  getBusinessDate,
  getBusinessDayBounds,
  resolveBusinessDate,
} from "@/lib/utils/business-date";
import type { OutstandingMovementPointDTO } from "@/types";

const KOLKATA_TZ = "Asia/Kolkata";

type DailyTotalRow = {
  _id: string;
  total: number;
};

async function groupAmountByKolkataCreatedAt(
  model: typeof OutstandingCollection | typeof FinancialCorrection,
  from?: Date
): Promise<Map<string, number>> {
  const match = from ? { createdAt: { $gte: from } } : {};
  const rows = await model.aggregate<DailyTotalRow>([
    ...(from ? [{ $match: match }] : []),
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: KOLKATA_TZ,
          },
        },
        total: { $sum: "$amount" },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id, row.total]));
}

async function sumAmountBefore(
  model: typeof OutstandingCollection | typeof FinancialCorrection,
  before: Date
): Promise<number> {
  const agg = await model.aggregate<{ total: number }>([
    { $match: { createdAt: { $lt: before } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return agg[0]?.total ?? 0;
}

function addKolkataDate(date: string, days: number): string {
  const noon = new Date(`${date}T12:00:00+05:30`);
  noon.setTime(noon.getTime() + days * 24 * 60 * 60 * 1000);
  return getBusinessDate(noon);
}

function enumerateKolkataDates(from: string, to: string): string[] {
  if (from > to) return [];
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    const next = addKolkataDate(cursor, 1);
    if (next <= cursor) break;
    cursor = next;
    if (dates.length > 400) break;
  }
  return dates;
}

/**
 * Calendar-day running Club Outstanding.
 *
 * Created  = corrected BusinessDayFinalSummary.outstandingCreated
 *            on that Business Day's businessDate (not Outstanding.createdAt)
 * Collected = OutstandingCollection.amount on Asia/Kolkata createdAt date
 * Corrections = FinancialCorrection.amount on Asia/Kolkata recorded date
 *
 * balance = previous + created − collected − corrections
 * Last point = live Current Club Outstanding.
 */
export async function buildDailyClubOutstandingBalance(input: {
  from: string;
  liveCurrent: number;
  now?: Date;
}): Promise<{
  openingOutstanding: number;
  series: OutstandingMovementPointDTO[];
}> {
  const today = getBusinessDate(input.now ?? new Date());
  const from = input.from.trim();
  if (!from || from > today) {
    return { openingOutstanding: 0, series: [] };
  }

  const { start } = getBusinessDayBounds(from);

  const closedDays = await BusinessDay.find({
    status: "CLOSED",
    closedAt: { $exists: true, $ne: null },
  })
    .select("_id businessDate openedAt")
    .lean();

  const [summaries, collectedBefore, correctedBefore, collectedByDay, correctedByDay] =
    await Promise.all([
      listCorrectedBusinessDayFinalSummaries(closedDays.map((day) => day._id)),
      sumAmountBefore(OutstandingCollection, start),
      sumAmountBefore(FinancialCorrection, start),
      groupAmountByKolkataCreatedAt(OutstandingCollection, start),
      groupAmountByKolkataCreatedAt(FinancialCorrection, start),
    ]);

  const createdByDay = new Map<string, number>();
  let createdBefore = 0;

  for (const day of closedDays) {
    const summary = summaries.get(day._id.toString());
    if (!summary) continue;
    const dateKey = getBusinessDate(
      resolveBusinessDate(day.businessDate, day.openedAt)
    );
    if (dateKey < from) {
      createdBefore += summary.outstandingCreated;
      continue;
    }
    createdByDay.set(
      dateKey,
      (createdByDay.get(dateKey) ?? 0) + summary.outstandingCreated
    );
  }

  const openingOutstanding = createdBefore - collectedBefore - correctedBefore;
  let balance = openingOutstanding;
  const dates = enumerateKolkataDates(from, today);
  const points: OutstandingMovementPointDTO[] = [];
  let started = false;

  dates.forEach((date, index) => {
    const created = createdByDay.get(date) ?? 0;
    const collected = collectedByDay.get(date) ?? 0;
    const corrected = correctedByDay.get(date) ?? 0;
    const hasMovement = created !== 0 || collected !== 0 || corrected !== 0;
    balance += created - collected - corrected;

    const isLast = index === dates.length - 1;
    const closingOutstanding = isLast ? input.liveCurrent : balance;
    const isZeroOnly = closingOutstanding === 0 && !hasMovement && balance === 0;

    if (!started) {
      if (!hasMovement && isZeroOnly && !isLast) return;
      started = true;
    }

    points.push({
      date,
      closingOutstanding,
      isToday: date === today,
    });
  });

  if (points.length === 0) {
    return {
      openingOutstanding,
      series: [
        {
          date: today,
          closingOutstanding: input.liveCurrent,
          isToday: true,
        },
      ],
    };
  }

  points[points.length - 1] = {
    ...points[points.length - 1],
    closingOutstanding: input.liveCurrent,
    isToday: true,
  };

  return { openingOutstanding, series: points };
}
