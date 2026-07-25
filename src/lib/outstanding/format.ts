/** Human-readable Outstanding ID, e.g. OUT-000001 */
export function formatOutstandingPublicId(outstandingNumber: number): string {
  return `OUT-${String(outstandingNumber).padStart(6, "0")}`;
}

export function outstandingSourceLabel(
  sourceType: import("@/lib/constants/outstanding").OutstandingSourceType
): string {
  return sourceType === "FRAME" ? "Frame" : "Cafe";
}
