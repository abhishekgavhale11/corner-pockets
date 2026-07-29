const CLUB_TIMEZONE = "Asia/Kolkata";

/** Calendar date for club operations (YYYY-MM-DD in Asia/Kolkata). */
export function getBusinessDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLUB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Parse a date-picker value (YYYY-MM-DD) into a Date at local noon.
 * Noon avoids timezone edge cases when displaying the calendar day.
 */
export function parseBusinessDateInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error("Business Date must be a valid date.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error("Business Date must be a valid date.");
  }
  return parsed;
}

/** Resolve stored Business Date with fallback for legacy records. */
export function resolveBusinessDate(
  businessDate: Date | string | undefined | null,
  fallback: Date | string
): Date {
  if (businessDate instanceof Date && !Number.isNaN(businessDate.getTime())) {
    return businessDate;
  }
  if (typeof businessDate === "string" && businessDate.trim()) {
    const asDate = new Date(businessDate);
    if (!Number.isNaN(asDate.getTime())) return asDate;
  }
  return fallback instanceof Date ? fallback : new Date(fallback);
}

export function getBusinessDayBounds(businessDate: string): {
  start: Date;
  end: Date;
} {
  const start = new Date(`${businessDate}T00:00:00+05:30`);
  const end = new Date(`${businessDate}T23:59:59.999+05:30`);
  return { start, end };
}

/** Default History filter: first day of current month → today (Asia/Kolkata). */
export function getDefaultBusinessDayHistoryRange(now = new Date()): {
  from: string;
  to: string;
} {
  return getBusinessDayHistoryPresetRange("month", now);
}

export type BusinessDayHistoryPreset =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "lastMonth"
  | "custom";

/**
 * History filter presets in Asia/Kolkata calendar dates.
 * Week = Monday of current week → today.
 */
export function getBusinessDayHistoryPresetRange(
  preset: Exclude<BusinessDayHistoryPreset, "custom">,
  now = new Date()
): { from: string; to: string } {
  const to = getBusinessDate(now);
  const [year, month, day] = to.split("-").map(Number);
  const todayNoon = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (preset === "today") {
    return { from: to, to };
  }

  if (preset === "yesterday") {
    const yesterday = new Date(todayNoon);
    yesterday.setDate(yesterday.getDate() - 1);
    const from = getBusinessDate(yesterday);
    return { from, to: from };
  }

  if (preset === "week") {
    const weekStart = new Date(todayNoon);
    const dayOfWeek = weekStart.getDay(); // 0 Sun … 6 Sat
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - daysFromMonday);
    return { from: getBusinessDate(weekStart), to };
  }

  if (preset === "lastMonth") {
    const firstOfThisMonth = new Date(year, month - 1, 1, 12, 0, 0, 0);
    const lastOfPrev = new Date(firstOfThisMonth);
    lastOfPrev.setDate(0);
    const firstOfPrev = new Date(
      lastOfPrev.getFullYear(),
      lastOfPrev.getMonth(),
      1,
      12,
      0,
      0,
      0
    );
    return {
      from: getBusinessDate(firstOfPrev),
      to: getBusinessDate(lastOfPrev),
    };
  }

  // month
  return {
    from: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`,
    to,
  };
}

/** Infer which preset matches an applied from/to range (best-effort). */
export function matchBusinessDayHistoryPreset(
  from: string,
  to: string,
  now = new Date()
): BusinessDayHistoryPreset {
  const presets: Exclude<BusinessDayHistoryPreset, "custom">[] = [
    "today",
    "yesterday",
    "week",
    "month",
    "lastMonth",
  ];
  for (const preset of presets) {
    const range = getBusinessDayHistoryPresetRange(preset, now);
    if (range.from === from && range.to === to) return preset;
  }
  return "custom";
}

/** Inclusive Business Date range bounds for Mongo queries. */
export function getBusinessDateRangeBounds(
  from: string,
  to: string
): { start: Date; end: Date } {
  const { start } = getBusinessDayBounds(from);
  const { end } = getBusinessDayBounds(to);
  return { start, end };
}
