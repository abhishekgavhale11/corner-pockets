export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

export function toTimeInputValue(date: Date | string): string {
  const value = new Date(date);
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function applyTimeToDate(date: Date | string, timeValue: string): Date {
  const [hours, minutes] = timeValue.split(":").map((part) => Number.parseInt(part, 10));
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}
