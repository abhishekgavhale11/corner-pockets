/**
 * Resolve recharge paid → bonus → credit using current club offers.
 * Custom / unmatched amounts credit 1:1 (no bonus).
 */
export function resolveRechargeCredit(paidAmount: number): {
  paidAmount: number;
  bonusAmount: number;
  creditedAmount: number;
} {
  const paid = Math.round(paidAmount);

  if (paid === 1000) {
    return { paidAmount: 1000, bonusAmount: 100, creditedAmount: 1100 };
  }
  if (paid === 3000) {
    return { paidAmount: 3000, bonusAmount: 300, creditedAmount: 3300 };
  }
  if (paid === 5000) {
    return { paidAmount: 5000, bonusAmount: 700, creditedAmount: 5700 };
  }
  if (paid === 10000) {
    return { paidAmount: 10000, bonusAmount: 1500, creditedAmount: 11500 };
  }

  return { paidAmount: paid, bonusAmount: 0, creditedAmount: paid };
}

export const RECHARGE_AMOUNT_PRESETS = [1000, 3000, 5000, 10000] as const;

export const RECHARGE_OFFER_LABELS: { paid: number; credited: number }[] = [
  { paid: 1000, credited: 1100 },
  { paid: 3000, credited: 3300 },
  { paid: 5000, credited: 5700 },
  { paid: 10000, credited: 11500 },
];
