const CLUB_NAME = "Corner Pockets Snooker Club";

export function buildOutstandingBalanceMessage(
  customerName: string,
  outstandingAmount: number
): string {
  const amount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(outstandingAmount);

  return `Hello ${customerName},

According to our records, your outstanding balance at ${CLUB_NAME} is ${amount}.

Please visit the club or make the payment at your convenience.

Thank you!`;
}

export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

export function whatsAppShareUrl(phone: string, message: string): string {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) {
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
