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
import { applyCashGpayReceipt } from "@/lib/utils/payment-receipt";
import {
  revalidateCounterPaths,
  revalidateCustomerFinancials,
} from "@/lib/utils/revalidate-counter";
import {
  assignCafeOrderCustomerSchema,
  createCafeOrderSchema,
  deleteCafeOrderSchema,
  updateCafeOrderSchema,
} from "@/lib/validators/cafe";
import CafeOrder from "@/models/CafeOrder";
import Customer from "@/models/Customer";
import BusinessDay from "@/models/BusinessDay";

function receiptFieldsForCashGpay(
  actor: { id: string; username: string },
  paymentMethod: string | undefined,
  received: number
) {
  const receipt: {
    receivedByStaffId?: mongoose.Types.ObjectId;
    receivedByUsername?: string;
    receivedAt?: Date;
  } = {};
  applyCashGpayReceipt(receipt, actor, paymentMethod, received);
  if (!receipt.receivedByStaffId) return {};
  return {
    receivedByStaffId: receipt.receivedByStaffId,
    receivedByUsername: receipt.receivedByUsername!,
    receivedAt: receipt.receivedAt!,
  };
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
  paymentMethod?: "CASH" | "GPAY";
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
      ...receiptFieldsForCashGpay(
        { id: session.user.id, username: session.user.username },
        paymentMethod,
        received
      ),
    });

    revalidateCounterPaths(customerId?.toString());
    if (customerId) {
      revalidateCustomerFinancials(customerId.toString());
    }
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

    const received = Math.min(parsed.data.received, amount);
    const paymentMethod =
      received > 0 ? parsed.data.paymentMethod : undefined;

    validatePaymentForSave({
      amount,
      received,
      paymentMethod,
      customerId: order.customerId?.toString(),
    });

    order.items = items as typeof order.items;
    order.amount = amount;
    order.received = received;
    order.paymentMethod = paymentMethod;
    order.updatedBy = session.user.username;
    applyCashGpayReceipt(
      order,
      { id: session.user.id, username: session.user.username },
      paymentMethod,
      received
    );

    await order.save();

    revalidateCounterPaths(order.customerId?.toString());
    if (order.customerId) {
      revalidateCustomerFinancials(order.customerId.toString());
    }
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
    revalidateCustomerFinancials(customer._id.toString());
    return success({ order: toCafeOrderDTO(order) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to assign customer";
    return failure(message);
  }
}

/**
 * Soft-cancels a cafe order while the Business Day is OPEN.
 * Unassigned orders are hard-deleted (no customer financial trail).
 */
export async function deleteCafeOrderAction(
  input: unknown
): Promise<ActionResult<{ orderId: string }>> {
  try {
    const session = await requireStaff();
    await connectDB();

    const parsed = deleteCafeOrderSchema.safeParse(input);
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const order = await assertOrderEditable(parsed.data.orderId);
    const orderId = order._id.toString();
    const customerId = order.customerId?.toString();

    if (!customerId) {
      await order.deleteOne();
      revalidateCounterPaths();
      return success({ orderId });
    }

    order.status = "CANCELLED";
    order.updatedBy = session.user.username;
    await order.save();

    revalidateCounterPaths(customerId);
    revalidateCustomerFinancials(customerId);
    return success({ orderId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete cafe order";
    return failure(message);
  }
}

/** @deprecated Use deleteCafeOrderAction */
export async function deleteUnassignedCafeOrderAction(
  input: unknown
): Promise<ActionResult<{ orderId: string }>> {
  return deleteCafeOrderAction(input);
}
