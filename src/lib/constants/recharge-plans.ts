export type WalletType = "student" | "club";

export interface RechargePlan {
  key: string;
  paidAmount: number;
  creditedAmount: number;
  walletType: WalletType;
}

export const RECHARGE_PLANS: RechargePlan[] = [
  {
    key: "student-1000",
    paidAmount: 1000,
    creditedAmount: 1100,
    walletType: "student",
  },
  {
    key: "club-3000",
    paidAmount: 3000,
    creditedAmount: 3300,
    walletType: "club",
  },
  {
    key: "club-5000",
    paidAmount: 5000,
    creditedAmount: 5700,
    walletType: "club",
  },
  {
    key: "club-10000",
    paidAmount: 10000,
    creditedAmount: 11500,
    walletType: "club",
  },
];

export function getBonusAmount(plan: RechargePlan): number {
  return plan.creditedAmount - plan.paidAmount;
}

export function getPlansForCustomer(isStudent: boolean): RechargePlan[] {
  const walletType: WalletType = isStudent ? "student" : "club";
  return RECHARGE_PLANS.filter((plan) => plan.walletType === walletType);
}

export function getPlanByKey(key: string): RechargePlan | undefined {
  return RECHARGE_PLANS.find((plan) => plan.key === key);
}

export function getRechargeAmounts(plan: RechargePlan) {
  const bonusAmount = getBonusAmount(plan);
  return {
    paidAmount: plan.paidAmount,
    bonusAmount,
    creditedAmount: plan.creditedAmount,
  };
}

export function buildRechargeDescription(plan: RechargePlan): string {
  const { paidAmount, bonusAmount, creditedAmount } = getRechargeAmounts(plan);
  return `Wallet recharge — Paid ₹${paidAmount.toLocaleString("en-IN")}, bonus ₹${bonusAmount.toLocaleString("en-IN")}, credited ₹${creditedAmount.toLocaleString("en-IN")}`;
}
