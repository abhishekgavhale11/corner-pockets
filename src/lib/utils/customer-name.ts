/** Escape a string for safe use inside a RegExp pattern. */
function escapeRegExpLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive, whitespace-normalized exact-match regex for a name part. */
export function nameMatchRegex(value: string): RegExp {
  const normalized = value.trim().replace(/\s+/g, " ");
  return new RegExp(`^${escapeRegExpLiteral(normalized)}$`, "i");
}

/** Build display name from first + last. */
export function formatCustomerFullName(
  firstName: string,
  lastName: string
): string {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ").trim();
}

/** Split a legacy single name into first / last (first token / remainder). */
export function splitCustomerFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }
  const space = trimmed.indexOf(" ");
  if (space < 0) {
    return { firstName: trimmed, lastName: "" };
  }
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1),
  };
}

export function resolveCustomerNameParts(customer: {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
}): { firstName: string; lastName: string; name: string } {
  const firstName = (customer.firstName ?? "").trim();
  const lastName = (customer.lastName ?? "").trim();
  if (firstName || lastName) {
    return {
      firstName,
      lastName,
      name: formatCustomerFullName(firstName, lastName) || customer.name,
    };
  }
  const split = splitCustomerFullName(customer.name);
  return {
    firstName: split.firstName,
    lastName: split.lastName,
    name: customer.name,
  };
}
