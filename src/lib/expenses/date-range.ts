import {
  getBusinessDate,
  getBusinessDateRangeBounds,
  parseBusinessDateInput,
} from "@/lib/utils/business-date";

/**
 * Default expense range: 17th → 16th cycle.
 * On/after the 17th: this month 17 → next month 16.
 * Before the 17th: previous month 17 → this month 16.
 */
export function defaultExpenseDateRange(now = new Date()): {
  from: string;
  to: string;
} {
  const today = getBusinessDate(now);
  const [yearStr, monthStr, dayStr] = today.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1–12
  const day = Number(dayStr);

  let fromYear: number;
  let fromMonth: number;
  let toYear: number;
  let toMonth: number;

  if (day >= 17) {
    fromYear = year;
    fromMonth = month;
    if (month === 12) {
      toYear = year + 1;
      toMonth = 1;
    } else {
      toYear = year;
      toMonth = month + 1;
    }
  } else {
    toYear = year;
    toMonth = month;
    if (month === 1) {
      fromYear = year - 1;
      fromMonth = 12;
    } else {
      fromYear = year;
      fromMonth = month - 1;
    }
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${fromYear}-${pad(fromMonth)}-17`,
    to: `${toYear}-${pad(toMonth)}-16`,
  };
}

export function resolveExpenseDateRange(
  customFrom?: string,
  customTo?: string,
  now = new Date()
): { from: string; to: string } {
  const defaults = defaultExpenseDateRange(now);
  const from = (customFrom ?? defaults.from).trim() || defaults.from;
  const to = (customTo ?? defaults.to).trim() || defaults.to;
  return from <= to ? { from, to } : { from: to, to: from };
}

export function expenseDateRangeMongoBounds(from: string, to: string): {
  start: Date;
  end: Date;
} {
  return getBusinessDateRangeBounds(from, to);
}

/** Validate YYYY-MM-DD values used by the expense date pickers. */
export function isExpenseCalendarDate(value: string): boolean {
  try {
    parseBusinessDateInput(value);
    return true;
  } catch {
    return false;
  }
}
