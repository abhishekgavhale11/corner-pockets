"use server";

import mongoose from "mongoose";
import { requireStaff } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { getOpenBusinessDayContext } from "@/lib/business-day/require-open-business-day";
import {
  normalizeCafeItems,
  toCafeOrderDTO,
  type CafeOrderDTO,
} from "@/lib/mappers/cafe-order";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import { revalidateCounterPaths } from "@/lib/utils/revalidate-counter";
import {
  debitWalletForOperationalPayment,
  remainingPaymentMethodForDebit,
  resolveWalletDebitAmount,
} from "@/lib/wallet/operational-payment";
import { buildWalletPaymentContext } from "@/lib/wallet/wallet-payment-context";
import { CAFE_ITEM_TYPE_LABELS } from "@/lib/constants/cafe";
import type { CafeItemType } from "@/lib/constants/cafe";
import {
  assignCafeOrderCustomerSchema,
  createCafeOrderSchema,
  updateCafeOrderSchema,
} from "@/lib/validators/cafe";
import CafeOrder from "@/models/CafeOrder";
import Customer from "@/models/Customer";
import BusinessDay from "@/models/BusinessDay";

async function walletAvailableBalance(
  customerId: string | undefined,
  previousWalletDebit = 0
): Promise<number> {
  if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) return 0;
  const customer = await Customer.findById(customerId).select("balance").lean();
  if (!customer) return previousWalletDebit;
  return Math.max(0, Math.round(customer.balance ?? 0) + previousWalletDebit);
}

async function assertOrderEditable(orderId: string) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error("Invalid cafe order.");
  }

  const order = await CafeOrder.findById(orderId);
  if (!order || order.status === "CANCELLED") {
    throw new Error("Cafe order not found.");
  }

  const day = await BusinessDay.findById(order.businessDayId).lean();
  if (!day || day.status !== "OPEN") {
    throw new Error("Cafe orders are read-only after Business Day closes.");
  }

  return order;
}

function validatePaymentForSave(input: {
  amount: number;
  received: number;
  paymentMethod?: "CASH" | "GPAY" | "WALLET";
  customerId?: string;
}) {
  if (input.received > input.amount) {
    throw new Error("Received cannot exceed Amount.");
  }
  if (input.received > 0 && !input.paymentMethod) {
    throw new Error("Payment Mode is required when Received > 0.");
  }
  if (input.received > 0 && !input.customerId) {
    throw new Error("Assign a customer before recording Received.");
  }
}

export async function getOpenBusinessDayCafeOrders(): Promise<CafeOrderDTO[]> {
  await connectDB();
  const openDay = await getOpenBusinessDayContext();
  if (!openDay) return [];

  const orders = await CafeOrder.find({
    businessDayId: openDay.businessDayId,
    status: "OPEN",
  })
    .sort({ createdAt: -1 })
    .lean();

  return orders.map((order) => toCafeOrderDTO(order as never));
}

export async function createCafeOrderAction(
  input: unknown
): Promise<ActionResult<{ order: CafeOrderDTO }>> {
  try {
    const session = await requireStaff();
    await connectDB();

    const openDay = await getOpenBusinessDayContext();
    if (!openDay) {
      return failure("No open Business Day. Start a Business Day first.");
    }

    const parsed = createCafeOrderSchema.safeParse(input);
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const items = normalizeCafeItems(parsed.data.items);
    const amount = items.reduce((sum, item) => sum + item.amount, 0);
    if (amount <= 0) {
      return failure("Cafe order amount must be greater than zero.");
    }

    let customerId: mongoose.Types.ObjectId | undefined;
    let customerName = "Walk-in Customer";

    if (parsed.data.customerId) {
      if (!mongoose.Types.ObjectId.isValid(parsed.data.customerId)) {
        return failure("Invalid customer.");
      }
      const customer = await Customer.findById(parsed.data.customerId).lean();
      if (!customer || customer.isActive === false) {
        return failure("Customer not found.");
      }
      customerId = customer._id as mongoose.Types.ObjectId;
      customerName = customer.name;
    }

    const received = parsed.data.received ?? 0;
    const paymentMethod =
      received > 0 ? parsed.data.paymentMethod : undefined;

    validatePaymentForSave({
      amount,
      received,
      paymentMethod,
      customerId: customerId?.toString(),
    });

    let walletDebit = 0;
    try {
      const availableBalance = await walletAvailableBalance(
        customerId?.toString()
      );
      walletDebit = resolveWalletDebitAmount({
        paidAmount: received,
        paymentMethod,
        useWallet: parsed.data.useWallet,
        availableBalance,
        walletAmount: parsed.data.walletAmount,
      });
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : "Invalid wallet amount"
      );
    }

    if (walletDebit > 0 && !customerId) {
      return failure("Assign a customer before using wallet");
    }

    if (walletDebit > 0 && customerId) {
      const dbSession = await mongoose.startSession();
      try {
        let orderDoc: InstanceType<typeof CafeOrder> | null = null;
        await dbSession.withTransaction(async () => {
          const remainderMethod = remainingPaymentMethodForDebit(
            walletDebit,
            received,
            paymentMethod
          );
          const cafeLines = items.map((item) => ({
            label:
              item.description?.trim() ||
              CAFE_ITEM_TYPE_LABELS[item.type as CafeItemType] ||
              item.type,
            quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
          }));
          const txnId = await debitWalletForOperationalPayment({
            customerId: customerId!.toString(),
            amount: walletDebit,
            description: `Cafe order — ₹${walletDebit.toLocaleString("en-IN")}`,
            staffId: session.user.id,
            staffUsername: session.user.username,
            dbSession,
            remainingPaymentMethod: remainderMethod,
            businessDayId: openDay.businessDayId.toString(),
            paymentContext: buildWalletPaymentContext({
              purpose: "CAFE_PAYMENT",
              billAmount: received,
              walletUsed: walletDebit,
              totalWalletApplied: walletDebit,
              remainderMethod,
              lines: cafeLines,
              businessDayId: openDay.businessDayId.toString(),
            }),
          });
          const [created] = await CafeOrder.create(
            [
              {
                businessDayId: openDay.businessDayId,
                businessDate: openDay.businessDate,
                customerId,
                customerName,
                status: "OPEN",
                items,
                amount,
                received,
                paymentMethod,
                walletAmount: walletDebit,
                walletTransactionId: txnId,
                createdBy: session.user.username,
              },
            ],
            { session: dbSession }
          );
          orderDoc = created ?? null;
        });
        if (!orderDoc) {
          return failure("Failed to create cafe order");
        }
        revalidateCounterPaths(customerId.toString());
        return success({ order: toCafeOrderDTO(orderDoc) });
      } catch (error) {
        return failure(
          error instanceof Error ? error.message : "Wallet payment failed"
        );
      } finally {
        await dbSession.endSession();
      }
    }

    const order = await CafeOrder.create({
      businessDayId: openDay.businessDayId,
      businessDate: openDay.businessDate,
      customerId,
      customerName,
      status: "OPEN",
      items,
      amount,
      received,
      paymentMethod,
      createdBy: session.user.username,
    });

    revalidateCounterPaths(customerId?.toString());
    return success({ order: toCafeOrderDTO(order) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create cafe order";
    return failure(message);
  }
}

export async function updateCafeOrderAction(
  input: unknown
): Promise<ActionResult<{ order: CafeOrderDTO }>> {
  try {
    const session = await requireStaff();
    await connectDB();

    const parsed = updateCafeOrderSchema.safeParse(input);
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const order = await assertOrderEditable(parsed.data.orderId);
    const items = normalizeCafeItems(parsed.data.items);
    const amount = items.reduce((sum, item) => sum + item.amount, 0);
    if (amount <= 0) {
      return failure("Cafe order amount must be greater than zero.");
    }

    const received = parsed.data.received;
    const paymentMethod =
      received > 0 ? parsed.data.paymentMethod : undefined;

    validatePaymentForSave({
      amount,
      received,
      paymentMethod,
      customerId: order.customerId?.toString(),
    });

    let walletDebit = 0;
    try {
      const previousWalletDebit = Math.round(order.walletAmount ?? 0);
      const availableBalance = await walletAvailableBalance(
        order.customerId?.toString(),
        previousWalletDebit
      );
      walletDebit = resolveWalletDebitAmount({
        paidAmount: received,
        paymentMethod,
        useWallet: parsed.data.useWallet,
        availableBalance,
        walletAmount: parsed.data.walletAmount,
      });
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : "Invalid wallet amount"
      );
    }

    order.items = items as typeof order.items;
    order.amount = amount;
    order.received = received;
    order.paymentMethod = paymentMethod;
    order.updatedBy = session.user.username;

    if (walletDebit > 0) {
      const walletCustomerId = order.customerId?.toString();
      if (!walletCustomerId) {
        return failure("Assign a customer before using wallet");
      }

      const previousWalletDebit = Math.round(order.walletAmount ?? 0);
      const walletDebitDelta = Math.max(0, walletDebit - previousWalletDebit);

      if (walletDebitDelta > 0) {
        const dbSession = await mongoose.startSession();
        try {
          await dbSession.withTransaction(async () => {
            const remainderMethod = remainingPaymentMethodForDebit(
              walletDebit,
              received,
              paymentMethod
            );
            const cafeLines = items.map((item) => ({
              label:
                item.description?.trim() ||
                CAFE_ITEM_TYPE_LABELS[item.type as CafeItemType] ||
                item.type,
              quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
            }));
            const txnId = await debitWalletForOperationalPayment({
              customerId: walletCustomerId,
              amount: walletDebitDelta,
              description: `Cafe order — ₹${walletDebitDelta.toLocaleString("en-IN")}`,
              staffId: session.user.id,
              staffUsername: session.user.username,
              dbSession,
              remainingPaymentMethod: remainderMethod,
              businessDayId: order.businessDayId?.toString(),
              paymentContext: buildWalletPaymentContext({
                purpose: "CAFE_PAYMENT",
                billAmount: received,
                walletUsed: walletDebitDelta,
                totalWalletApplied: walletDebit,
                remainderMethod,
                lines: cafeLines,
                businessDayId: order.businessDayId?.toString(),
              }),
            });
            order.walletAmount = walletDebit;
            order.walletTransactionId = txnId;
            await order.save({ session: dbSession });
          });
        } catch (error) {
          return failure(
            error instanceof Error ? error.message : "Wallet payment failed"
          );
        } finally {
          await dbSession.endSession();
        }
      } else {
        order.walletAmount = walletDebit;
        await order.save();
      }
    } else {
      order.walletAmount = undefined;
      order.walletTransactionId = undefined;
      await order.save();
    }

    revalidateCounterPaths(order.customerId?.toString());
    return success({ order: toCafeOrderDTO(order) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update cafe order";
    return failure(message);
  }
}

export async function assignCafeOrderCustomerAction(
  input: unknown
): Promise<ActionResult<{ order: CafeOrderDTO }>> {
  try {
    const session = await requireStaff();
    await connectDB();

    const parsed = assignCafeOrderCustomerSchema.safeParse(input);
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const order = await assertOrderEditable(parsed.data.orderId);
    if (order.customerId) {
      return failure("This cafe order already has a customer.");
    }

    if (!mongoose.Types.ObjectId.isValid(parsed.data.customerId)) {
      return failure("Invalid customer.");
    }

    const customer = await Customer.findById(parsed.data.customerId).lean();
    if (!customer || customer.isActive === false) {
      return failure("Customer not found.");
    }

    order.customerId = customer._id as mongoose.Types.ObjectId;
    order.customerName = customer.name;
    order.updatedBy = session.user.username;
    await order.save();

    revalidateCounterPaths(customer._id.toString());
    return success({ order: toCafeOrderDTO(order) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to assign customer";
    return failure(message);
  }
}
