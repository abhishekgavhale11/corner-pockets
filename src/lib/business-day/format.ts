/** Human-readable Business Day ID, e.g. BD-000001 */
export function formatBusinessDayPublicId(businessDayNumber: number): string {
  return `BD-${String(businessDayNumber).padStart(6, "0")}`;
}

export function formatBusinessDayDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatBusinessDayTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}
