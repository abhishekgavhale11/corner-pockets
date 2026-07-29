import type { CustomerDTO } from "@/types";

export function formatCustomerContactLine(
  customer: Pick<CustomerDTO, "cardId" | "phone">
): string {
  const phone = customer.phone?.trim();
  const cardId = customer.cardId?.trim();

  if (cardId) {
    return phone ? `${cardId} · ${phone}` : cardId;
  }

  return phone || "—";
}

export function hasMembershipCardId(
  customer: Pick<CustomerDTO, "cardId">
): boolean {
  return Boolean(customer.cardId?.trim());
}

export function getCustomerBadgeIcon(
  customer: Pick<CustomerDTO, "isStudent" | "cardId">
): string {
  if (customer.cardId?.trim() && customer.isStudent) return "🎓";
  if (customer.cardId?.trim()) return "🪪";
  return "⚪";
}

export function getCustomerMembershipLabel(
  customer: Pick<CustomerDTO, "isStudent" | "cardId">
): string {
  if (customer.cardId?.trim() && customer.isStudent) return "Student";
  if (customer.cardId?.trim()) return "Member";
  return "Walk-in";
}
