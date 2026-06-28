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

export function getBusinessDayBounds(businessDate: string): {
  start: Date;
  end: Date;
} {
  const start = new Date(`${businessDate}T00:00:00+05:30`);
  const end = new Date(`${businessDate}T23:59:59.999+05:30`);
  return { start, end };
}
