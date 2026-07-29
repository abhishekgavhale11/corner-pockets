/** Normalize login identity — case does not matter. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/** Normalize password before hash/compare — case does not matter. */
export function normalizePassword(value: string): string {
  return value.trim().toLowerCase();
}
