export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.length <= 4) {
    return "XXXX";
  }

  return `${"X".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

export function normalizeCardId(cardId: string): string {
  return cardId.trim().toUpperCase();
}
