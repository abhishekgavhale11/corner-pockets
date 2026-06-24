import type { CustomerDTO } from "@/types";

/** Wallet members: Card ID + phone. Regular customers: phone or — */
export function formatCustomerContactLine(
  customer: Pick<CustomerDTO, "walletEnabled" | "cardId" | "phone">
): string {
  const phone = customer.phone?.trim();
  const cardId = customer.cardId?.trim();

  if (customer.walletEnabled && cardId) {
    return phone ? `${cardId} · ${phone}` : cardId;
  }

  return phone || "—";
}

export function hasMembershipCardId(
  customer: Pick<CustomerDTO, "walletEnabled" | "cardId">
): boolean {
  return customer.walletEnabled && Boolean(customer.cardId?.trim());
}

export function getCustomerMembershipLabel(
  customer: Pick<CustomerDTO, "walletEnabled" | "isStudent">
): string {
  if (customer.walletEnabled && customer.isStudent) return "Student";
  if (customer.walletEnabled) return "Member";
  return "Regular";
}

export function getCustomerBadgeIcon(
  customer: Pick<CustomerDTO, "walletEnabled" | "isStudent">
): string {
  if (customer.walletEnabled && customer.isStudent) return "🎓💳";
  if (customer.walletEnabled) return "💳";
  return "⚪";
}
